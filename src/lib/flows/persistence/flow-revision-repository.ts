import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '@/lib/db';
import type { FlowLayout, FlowSpec } from '../model/flow-document';
import type { FlowDraftRow } from './types';

/**
 * Immutable Flow revision snapshots (FS-0092).
 *
 * A revision is a point-in-time copy of the server-side draft
 * (`semantic_document` / `layout_document` plus their server-computed
 * hashes) taken from `flow_drafts`. Revisions are append-only: this module
 * exposes create/list/read only, deliberately no update or delete.
 *
 * Raw row shape mirrors `database/migrations/005_flow_revisions.sql`
 * exactly (snake_case). The repository layer cannot import from
 * `persistence/types.ts` in this ticket (allowed-files boundary), so the
 * row/record shapes live here.
 */
export interface FlowRevisionRow {
  id: string;
  flow_id: string;
  revision_number: number;
  semantic_document: FlowSpec;
  layout_document: FlowLayout;
  semantic_hash: string;
  layout_hash: string;
  compiler_version: number | null;
  created_by: string | null;
  created_at: Date;
  message: string | null;
}

/**
 * Domain representation of a `flow_revisions` row.
 * camelCase fields; timestamps are Dates as returned by `pg`.
 */
export interface FlowRevisionRecord {
  id: string;
  flowId: string;
  revisionNumber: number;
  semanticDocument: FlowSpec;
  layoutDocument: FlowLayout;
  semanticHash: string;
  layoutHash: string;
  compilerVersion: number | null;
  createdBy: string | null;
  createdAt: Date;
  message: string | null;
}

const revisionColumns =
  'id, flow_id, revision_number, semantic_document, layout_document, ' +
  'semantic_hash, layout_hash, compiler_version, created_by, created_at, message';

export function mapFlowRevisionRow(row: FlowRevisionRow): FlowRevisionRecord {
  return {
    id: row.id,
    flowId: row.flow_id,
    revisionNumber: row.revision_number,
    semanticDocument: row.semantic_document,
    layoutDocument: row.layout_document,
    semanticHash: row.semantic_hash,
    layoutHash: row.layout_hash,
    compilerVersion: row.compiler_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    message: row.message,
  };
}

function normalizeFlowId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Flow id is required');
  }
  return value.trim();
}

function normalizeOptionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeRevisionNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('Revision number must be a positive integer');
  }
  return value;
}

/**
 * Snapshots the current server-side draft of a flow into a new immutable
 * revision. Documents and hashes are copied verbatim from the stored draft;
 * callers cannot supply them. The snapshot runs in one transaction: the
 * parent `flows` row is locked (`FOR UPDATE`) so concurrent snapshot
 * requests for the same flow serialize and the `MAX(revision_number) + 1`
 * computation cannot hand out duplicate numbers. The
 * `UNIQUE(flow_id, revision_number)` constraint remains as a backstop.
 *
 * `compiler_version` is stored as NULL: snapshotting involves no
 * compilation, so no compiler version applies yet.
 */
export async function createRevisionFromCurrentDraft(
  flowId: unknown,
  userId?: unknown,
  message?: unknown,
): Promise<FlowRevisionRecord> {
  const normalizedFlowId = normalizeFlowId(flowId);
  const createdBy = normalizeOptionalText(userId, 'userId');
  const revisionMessage = normalizeOptionalText(message, 'message');

  return withTransaction(async (client) => {
    const flowLock = await client.query(
      'SELECT id FROM flows WHERE id = $1 FOR UPDATE',
      [normalizedFlowId],
    );
    if (flowLock.rows.length === 0) {
      throw new Error('Flow not found');
    }

    const draftResult = await client.query<FlowDraftRow>(
      'SELECT flow_id, semantic_document, layout_document, semantic_hash, layout_hash, updated_by, updated_at ' +
        'FROM flow_drafts WHERE flow_id = $1',
      [normalizedFlowId],
    );
    const draft = draftResult.rows[0];
    if (!draft) {
      throw new Error('No draft exists for this flow');
    }

    const maxResult = await client.query<{ max_revision_number: number | string | null }>(
      'SELECT MAX(revision_number) AS max_revision_number FROM flow_revisions WHERE flow_id = $1',
      [normalizedFlowId],
    );
    const maxRaw = maxResult.rows[0]?.max_revision_number;
    const maxRevision = maxRaw === null || maxRaw === undefined ? 0 : Number(maxRaw);
    if (!Number.isInteger(maxRevision) || maxRevision < 0) {
      throw new Error('Could not determine the next revision number (internal error)');
    }
    const nextRevisionNumber = maxRevision + 1;

    const id = randomUUID();
    const inserted = await client.query<FlowRevisionRow>(
      `INSERT INTO flow_revisions (id, flow_id, revision_number, semantic_document, layout_document, semantic_hash, layout_hash, compiler_version, created_by, message)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, NULL, $8, $9)
       RETURNING ${revisionColumns}`,
      [
        id,
        normalizedFlowId,
        nextRevisionNumber,
        JSON.stringify(draft.semantic_document),
        JSON.stringify(draft.layout_document),
        draft.semantic_hash,
        draft.layout_hash,
        createdBy,
        revisionMessage,
      ],
    );
    const row = inserted.rows[0];
    if (!row) {
      throw new Error('Revision creation did not return a row');
    }
    return mapFlowRevisionRow(row);
  });
}

/**
 * Lists revisions for one flow, newest first (highest `revision_number`
 * first). Newest-first is the chosen explicit ordering for history UIs.
 */
export async function listRevisions(flowId: unknown): Promise<FlowRevisionRecord[]> {
  const normalizedFlowId = normalizeFlowId(flowId);
  const result = await query<FlowRevisionRow>(
    `SELECT ${revisionColumns} FROM flow_revisions
     WHERE flow_id = $1
     ORDER BY revision_number DESC`,
    [normalizedFlowId],
  );
  return result.rows.map(mapFlowRevisionRow);
}

/**
 * Loads one revision by flow + revision number. Returns null when no such
 * revision exists, matching the `getFlow` null-on-missing convention.
 */
export async function getRevision(
  flowId: unknown,
  revisionNumber: unknown,
): Promise<FlowRevisionRecord | null> {
  const normalizedFlowId = normalizeFlowId(flowId);
  const normalizedRevisionNumber = normalizeRevisionNumber(revisionNumber);
  const result = await query<FlowRevisionRow>(
    `SELECT ${revisionColumns} FROM flow_revisions
     WHERE flow_id = $1 AND revision_number = $2`,
    [normalizedFlowId, normalizedRevisionNumber],
  );
  const row = result.rows[0];
  return row ? mapFlowRevisionRow(row) : null;
}
