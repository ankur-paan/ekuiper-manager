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
 */
export async function upsertFlowDraft(input: UpsertFlowDraftInput): Promise<FlowDraftRecord> {
  const flowId = normalizeFlowId(input.flowId);
  const semanticDocument = normalizeSpec(input.semanticDocument);
  const layoutDocument = normalizeLayout(input.layoutDocument);
  const updatedBy = normalizeUpdatedBy(input.updatedBy);

  const semanticHash = hashFlowSemantic(semanticDocument);
  const layoutHash = hashFlowLayout(layoutDocument);

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
