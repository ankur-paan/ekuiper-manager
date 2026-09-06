import { ApiError } from '@/lib/api';
import { query } from '@/lib/db';
import { hashFlowLayout, hashFlowSemantic } from '../hashing/flow-hash';
import type { FlowLayout, FlowSpec } from '../model/flow-document';
import { mapFlowDraftRow, type FlowDraftRecord, type FlowDraftRow } from './types';

const draftColumns =
  'flow_id, semantic_document, layout_document, semantic_hash, layout_hash, updated_by, updated_at';

export interface UpsertFlowDraftInput {
  flowId: unknown;
  semanticDocument: unknown;
  layoutDocument: unknown;
  updatedBy?: unknown;
  /**
   * Optimistic-concurrency predicate. When provided, the write only applies
   * when the stored draft still carries these hashes; a stale writer gets a
   * 409 conflict instead of silently replacing newer edits. Null/undefined
   * preserves the historical unconditional behaviour (e.g. first save).
   */
  expectedSemanticHash?: unknown;
  expectedLayoutHash?: unknown;
}

function normalizeFlowId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Flow id is required');
  }
  return value.trim();
}

function normalizeSpec(value: unknown): FlowSpec {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Semantic document must be an object');
  }
  return value as FlowSpec;
}

function normalizeLayout(value: unknown): FlowLayout {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Layout document must be an object');
  }
  return value as FlowLayout;
}

function normalizeExpectedHash(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeUpdatedBy(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('updatedBy must be a string');
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Loads the draft for one flow. Returns null when no draft exists,
 * matching the `getFlow` null-on-missing convention.
 */
export async function getFlowDraft(flowId: string): Promise<FlowDraftRecord | null> {
  const result = await query<FlowDraftRow>(
    `SELECT ${draftColumns} FROM flow_drafts WHERE flow_id = $1`,
    [flowId],
  );
  const row = result.rows[0];
  return row ? mapFlowDraftRow(row) : null;
}

/**
 * Inserts or replaces the draft for a flow. Hashes are always recomputed
 * server-side from the supplied documents; callers cannot provide
 * authoritative hashes. Only the spec is stored in `semantic_document`
 * and only the layout in `layout_document`, never a full FlowDocument.
 *
 * When `expectedSemanticHash`/`expectedLayoutHash` are provided, the update
 * path is predicated on the stored row still carrying those hashes. A stale
 * writer receives an ApiError 409 (FLOW_DRAFT_CONFLICT) and its documents
 * are not applied, so newer edits are never silently replaced. The caller's
 * local work is preserved by throwing rather than overwriting.
 */
export async function upsertFlowDraft(input: UpsertFlowDraftInput): Promise<FlowDraftRecord> {
  const flowId = normalizeFlowId(input.flowId);
  const semanticDocument = normalizeSpec(input.semanticDocument);
  const layoutDocument = normalizeLayout(input.layoutDocument);
  const updatedBy = normalizeUpdatedBy(input.updatedBy);
  const expectedSemanticHash = normalizeExpectedHash(
    input.expectedSemanticHash,
    'expectedSemanticHash',
  );
  const expectedLayoutHash = normalizeExpectedHash(input.expectedLayoutHash, 'expectedLayoutHash');

  const semanticHash = hashFlowSemantic(semanticDocument);
  const layoutHash = hashFlowLayout(layoutDocument);

  if (expectedSemanticHash === null && expectedLayoutHash === null) {
    const result = await query<FlowDraftRow>(
      `INSERT INTO flow_drafts (flow_id, semantic_document, layout_document, semantic_hash, layout_hash, updated_by)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)
     ON CONFLICT (flow_id) DO UPDATE SET
       semantic_document = EXCLUDED.semantic_document,
       layout_document = EXCLUDED.layout_document,
       semantic_hash = EXCLUDED.semantic_hash,
       layout_hash = EXCLUDED.layout_hash,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     RETURNING ${draftColumns}`,
      [
        flowId,
        JSON.stringify(semanticDocument),
        JSON.stringify(layoutDocument),
        semanticHash,
        layoutHash,
        updatedBy,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Flow draft upsert did not return a row');
    }
    return mapFlowDraftRow(row);
  }

  const conditions: string[] = [];
  const predicateValues: unknown[] = [];
  if (expectedSemanticHash !== null) {
    predicateValues.push(expectedSemanticHash);
    conditions.push(`flow_drafts.semantic_hash = $${6 + predicateValues.length}`);
  }
  if (expectedLayoutHash !== null) {
    predicateValues.push(expectedLayoutHash);
    conditions.push(`flow_drafts.layout_hash = $${6 + predicateValues.length}`);
  }

  const result = await query<FlowDraftRow>(
    `INSERT INTO flow_drafts (flow_id, semantic_document, layout_document, semantic_hash, layout_hash, updated_by)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)
     ON CONFLICT (flow_id) DO UPDATE SET
       semantic_document = EXCLUDED.semantic_document,
       layout_document = EXCLUDED.layout_document,
       semantic_hash = EXCLUDED.semantic_hash,
       layout_hash = EXCLUDED.layout_hash,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     WHERE ${conditions.join(' AND ')}
     RETURNING ${draftColumns}`,
    [
      flowId,
      JSON.stringify(semanticDocument),
      JSON.stringify(layoutDocument),
      semanticHash,
      layoutHash,
      updatedBy,
      ...predicateValues,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    // No row returns only when the conflicting row exists but fails the
    // predicate: an INSERT would have returned a row, so this is a stale
    // writer losing to a newer draft. Never apply it silently.
    throw new ApiError(
      409,
      'Flow draft changed since it was loaded. Reload the draft and reapply your edits; your local changes were not saved.',
      'FLOW_DRAFT_CONFLICT',
    );
  }
  return mapFlowDraftRow(row);
}
