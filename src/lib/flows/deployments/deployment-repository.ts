import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import {
  mapFlowDeploymentRow,
  type FlowDeploymentRecord,
  type FlowDeploymentRow,
} from './types';

const deploymentColumns =
  'id, flow_id, target_node_id, semantic_hash, compiler_version, rule_id, ' +
  'redacted_compiled_definition, runtime_node_map, status, error, created_by, created_at';

/** Upper bound for persisted failure summaries; raw upstream bodies are never stored. */
export const MAX_DEPLOYMENT_ERROR_CHARS = 2000;

export interface CreateDeploymentAttemptInput {
  flowId: unknown;
  targetNodeId?: unknown;
  semanticHash: unknown;
  compilerVersion: unknown;
  ruleId: unknown;
  redactedCompiledDefinition: unknown;
  runtimeNodeMap: unknown;
  createdBy?: unknown;
}

function normalizeRequiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
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

function normalizeCompilerVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('compilerVersion must be a non-negative integer');
  }
  return value;
}

function normalizeRedactedDefinition(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('redactedCompiledDefinition must be an object');
  }
  return value as Record<string, unknown>;
}

function normalizeRuntimeNodeMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('runtimeNodeMap must be an object');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, entry] of entries) {
    if (key.trim().length === 0 || typeof entry !== 'string' || entry.trim().length === 0) {
      throw new Error('runtimeNodeMap must map non-empty string node IDs to non-empty string runtime IDs');
    }
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

/**
 * Bounds and redacts a failure summary before persistence. Raw
 * secret-bearing upstream response bodies must never reach the `error`
 * column; only this sanitized summary is stored.
 */
export function sanitizeDeploymentError(value: unknown): string {
  let message: string;
  if (value instanceof Error) {
    message = value.message;
  } else if (typeof value === 'string') {
    message = value;
  } else if (value === null || value === undefined) {
    message = 'Deployment failed';
  } else {
    try {
      message = JSON.stringify(value);
    } catch {
      message = 'Deployment failed';
    }
  }
  message = message.trim();
  if (message.length === 0) {
    message = 'Deployment failed';
  }
  message = message
    .replace(
      /("(?:password|passwd|token|authorization|credential|secret|private[_-]?key|api[_-]?key)"\s*:\s*)"(?:\\.|[^"\\])*"/gi,
      '$1"[redacted]"',
    )
    .replace(/(\bBearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(
      /((?:password|passwd|token|secret|authorization)\s*[:=]\s*)([^\s,;}\]]+)/gi,
      '$1[redacted]',
    )
    .replace(/(https?:\/\/[^\s:/]+:)([^@\s/]+)(@)/gi, '$1[redacted]$3');
  if (message.length > MAX_DEPLOYMENT_ERROR_CHARS) {
    message = message.slice(0, MAX_DEPLOYMENT_ERROR_CHARS);
  }
  return message;
}

/**
 * Appends a new `pending` deployment attempt. Prior rows are untouched, so
 * recording an attempt never replaces the latest successful deployment.
 */
export async function createDeploymentAttempt(
  input: CreateDeploymentAttemptInput,
): Promise<FlowDeploymentRecord> {
  const flowId = normalizeRequiredText(input.flowId, 'flowId');
  const targetNodeId = normalizeOptionalText(input.targetNodeId, 'targetNodeId');
  const semanticHash = normalizeRequiredText(input.semanticHash, 'semanticHash');
  const compilerVersion = normalizeCompilerVersion(input.compilerVersion);
  const ruleId = normalizeRequiredText(input.ruleId, 'ruleId');
  const redactedCompiledDefinition = normalizeRedactedDefinition(input.redactedCompiledDefinition);
  const runtimeNodeMap = normalizeRuntimeNodeMap(input.runtimeNodeMap);
  const createdBy = normalizeOptionalText(input.createdBy, 'createdBy');
  const id = randomUUID();

  const result = await query<FlowDeploymentRow>(
    `INSERT INTO flow_deployments (id, flow_id, target_node_id, semantic_hash, compiler_version, rule_id, redacted_compiled_definition, runtime_node_map, status, error, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'pending', NULL, $9)
     RETURNING ${deploymentColumns}`,
    [
      id,
      flowId,
      targetNodeId,
      semanticHash,
      compilerVersion,
      ruleId,
      JSON.stringify(redactedCompiledDefinition),
      JSON.stringify(runtimeNodeMap),
      createdBy,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Deployment attempt creation did not return a row');
  }
  return mapFlowDeploymentRow(row);
}

/**
 * Transitions a `pending` attempt to `succeeded`. Terminal rows are guarded
 * by `status = 'pending'` so a succeeded/failed record is never rewritten;
 * returns null when no pending attempt with the id exists.
 */
export async function markDeploymentSucceeded(id: string): Promise<FlowDeploymentRecord | null> {
  const attemptId = normalizeRequiredText(id, 'deployment id');
  const result = await query<FlowDeploymentRow>(
    `UPDATE flow_deployments SET status = 'succeeded', error = NULL
     WHERE id = $1 AND status = 'pending'
     RETURNING ${deploymentColumns}`,
    [attemptId],
  );
  const row = result.rows[0];
  return row ? mapFlowDeploymentRow(row) : null;
}

/**
 * Transitions a `pending` attempt to `failed` with a bounded, sanitized
 * error summary. Returns null when no pending attempt with the id exists.
 */
export async function markDeploymentFailed(
  id: string,
  error?: unknown,
): Promise<FlowDeploymentRecord | null> {
  const attemptId = normalizeRequiredText(id, 'deployment id');
  const sanitized = sanitizeDeploymentError(error);
  const result = await query<FlowDeploymentRow>(
    `UPDATE flow_deployments SET status = 'failed', error = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING ${deploymentColumns}`,
    [attemptId, sanitized],
  );
  const row = result.rows[0];
  return row ? mapFlowDeploymentRow(row) : null;
}

/**
 * Loads the latest `succeeded` deployment for one flow + target node.
 * Failed/pending attempts never match, so a later failure does not replace
 * the active deployment. `IS NOT DISTINCT FROM` keeps NULL targets exact:
 * a null target only matches null-target rows.
 */
export async function getLatestSuccessfulDeployment(
  flowId: string,
  targetNodeId: string | null,
): Promise<FlowDeploymentRecord | null> {
  const normalizedFlowId = normalizeRequiredText(flowId, 'flowId');
  let normalizedTarget: string | null = null;
  if (targetNodeId !== null && targetNodeId !== undefined) {
    normalizedTarget = normalizeRequiredText(targetNodeId, 'targetNodeId');
  }
  const result = await query<FlowDeploymentRow>(
    `SELECT ${deploymentColumns} FROM flow_deployments
     WHERE flow_id = $1 AND target_node_id IS NOT DISTINCT FROM $2 AND status = 'succeeded'
     ORDER BY created_at DESC, id ASC
     LIMIT 1`,
    [normalizedFlowId, normalizedTarget],
  );
  const row = result.rows[0];
  return row ? mapFlowDeploymentRow(row) : null;
}
