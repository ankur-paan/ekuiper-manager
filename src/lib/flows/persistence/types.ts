import type { FlowLayout, FlowSpec } from '../model/flow-document';

/**
 * Raw row shape for the `flows` table.
 * See `database/migrations/002_flows.sql`.
 * Snake_case column names match the database exactly.
 */
export interface FlowRow {
  id: string;
  name: string;
  description: string | null;
  target_node_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Raw row shape for the `flow_drafts` table.
 * See `database/migrations/003_flow_drafts.sql`.
 * `semantic_document` stores the spec only and `layout_document`
 * stores the layout only, never a duplicated full FlowDocument.
 */
export interface FlowDraftRow {
  flow_id: string;
  semantic_document: FlowSpec;
  layout_document: FlowLayout;
  semantic_hash: string;
  layout_hash: string;
  updated_by: string | null;
  updated_at: Date;
}

/**
 * Domain representation of a `flows` row.
 * camelCase fields; timestamps are Dates as returned by `pg`.
 */
export interface FlowRecord {
  id: string;
  name: string;
  description: string | null;
  targetNodeId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Domain representation of a `flow_drafts` row.
 * Hashes are server-computed; callers never supply them authoritatively.
 */
export interface FlowDraftRecord {
  flowId: string;
  semanticDocument: FlowSpec;
  layoutDocument: FlowLayout;
  semanticHash: string;
  layoutHash: string;
  updatedBy: string | null;
  updatedAt: Date;
}

export function mapFlowRow(row: FlowRow): FlowRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    targetNodeId: row.target_node_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFlowDraftRow(row: FlowDraftRow): FlowDraftRecord {
  return {
    flowId: row.flow_id,
    semanticDocument: row.semantic_document,
    layoutDocument: row.layout_document,
    semanticHash: row.semantic_hash,
    layoutHash: row.layout_hash,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}
