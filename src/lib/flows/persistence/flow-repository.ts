import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { mapFlowRow, type FlowRecord, type FlowRow } from './types';

const flowColumns =
  'id, name, description, target_node_id, created_by, created_at, updated_at';

export interface CreateFlowInput {
  name: unknown;
  description?: unknown;
  targetNodeId?: unknown;
  createdBy?: unknown;
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Flow name is required');
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

export async function listFlows(): Promise<FlowRecord[]> {
  const result = await query<FlowRow>(
    `SELECT ${flowColumns} FROM flows ORDER BY created_at DESC, id ASC`,
  );
  return result.rows.map(mapFlowRow);
}

/**
 * Loads one flow by id. Returns null when no such flow exists,
 * matching the `getNode` null-on-missing convention in `src/lib/nodes.ts`.
 */
export async function getFlow(id: string): Promise<FlowRecord | null> {
  const result = await query<FlowRow>(
    `SELECT ${flowColumns} FROM flows WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapFlowRow(row) : null;
}

export async function createFlow(input: CreateFlowInput): Promise<FlowRecord> {
  const name = normalizeName(input.name);
  const description = normalizeOptionalText(input.description, 'description');
  const targetNodeId = normalizeOptionalText(input.targetNodeId, 'targetNodeId');
  const createdBy = normalizeOptionalText(input.createdBy, 'createdBy');
  const id = randomUUID();

  const result = await query<FlowRow>(
    `INSERT INTO flows (id, name, description, target_node_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${flowColumns}`,
    [id, name, description, targetNodeId, createdBy],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Flow creation did not return a row');
  }
  return mapFlowRow(row);
}
