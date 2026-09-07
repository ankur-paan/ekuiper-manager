import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '@/lib/db';
import {
  mapFlowDeploymentRow,
  type FlowDeploymentRecord,
  type FlowDeploymentRow,
} from './types';

const deploymentColumns =
  'id, flow_id, target_node_id, semantic_hash, compiler_version, rule_id, ' +
  'redacted_compiled_definition, runtime_node_map, status, error, created_by, created_at, revision_id';

/**
 * FS-0093 runtime row including the additive `revision_id` link from
 * `006_deployment_revision_link.sql`. Declared locally because `./types.ts`
 * is outside this ticket's allowed files: pre-link mocked rows without the
 * column still satisfy the base `FlowDeploymentRow`, while real rows expose
 * the link at runtime (absent reads as null).
 */
type DeploymentRowWithRevision = FlowDeploymentRow & { revision_id?: string | null };

function mapRowWithRevision(row: DeploymentRowWithRevision): FlowDeploymentRecord {
  // Base mapper drops the link (its module is not editable here); reattach
  // it at runtime so successful deployments reference their exact revision.
  // The cast keeps pre-link callers compiling while real rows carry the id.
  return {
    ...mapFlowDeploymentRow(row),
    revisionId: row.revision_id ?? null,
  } as FlowDeploymentRecord;
}

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
  /**
   * FS-0093 explicit revision link. When a non-null string is supplied it
   * is stored directly with no revision ensure. When absent but
   * `layoutHash` is present the repository ensures the exact-current-draft
   * revision itself (reuse-or-create) inside one transaction. When both are
   * absent the legacy revision-less insert runs so pre-link callers keep
   * their exact SQL shape.
   */
  revisionId?: unknown;
  /**
   * FS-0093 current-draft layout hash. Supplied by the deployment service
   * alongside `semanticHash` so the auto-ensure path can reuse a prior
   * identical semantic+layout revision without an extra round trip.
   */
  layoutHash?: unknown;
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

/** Minimal draft snapshot read for FS-0093 auto-ensure (documents stored verbatim). */
interface DraftSnapshotRow {
  semantic_document: unknown;
  layout_document: unknown;
  semantic_hash: string;
  layout_hash: string;
}

/** Latest revision hashes for the FS-0093 reuse check. */
interface LatestRevisionRow {
  id: string;
  semantic_hash: string;
  layout_hash: string;
  revision_number: number;
}

function normalizeNullableRevisionId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('revisionId must be a string');
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeNullableLayoutHash(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('layoutHash must be a string');
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Appends a new `pending` deployment attempt. Prior rows are untouched, so
 * recording an attempt never replaces the latest successful deployment.
 *
 * FS-0093 revision rule: the attempt is created only after server
 * validation/compile have passed (the caller guarantees this ordering), so
 * this is the "about to mutate runtime" point where the exact current
 * draft must be snapshotted. Reuse-or-create rule: when the immediately
 * prior (latest) revision carries the identical semantic+layout hashes as
 * the current draft it is reused; otherwise one new revision is created.
 * The draft itself is never mutated here. A later runtime failure keeps
 * the failed deployment row while the revision remains as history; a
 * revision alone never reads as deployed.
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
  const explicitRevisionId = normalizeNullableRevisionId(input.revisionId);
  const layoutHash = normalizeNullableLayoutHash(input.layoutHash);

  if (explicitRevisionId !== null) {
    const id = randomUUID();
    const result = await query<DeploymentRowWithRevision>(
      `INSERT INTO flow_deployments (id, flow_id, target_node_id, semantic_hash, compiler_version, rule_id, redacted_compiled_definition, runtime_node_map, status, error, created_by, revision_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'pending', NULL, $9, $10)
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
        explicitRevisionId,
      ],
    );
    const explicitRow = result.rows[0];
    if (!explicitRow) {
      throw new Error('Deployment attempt creation did not return a row');
    }
    return mapRowWithRevision(explicitRow);
  }

  if (layoutHash === null) {
    const id = randomUUID();

    const result = await query<DeploymentRowWithRevision>(
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
    return mapRowWithRevision(row);
  }

  return withTransaction(async (client) => {
    const flowLock = await client.query('SELECT id FROM flows WHERE id = $1 FOR UPDATE', [
      flowId,
    ]);
    if (flowLock.rows.length === 0) {
      throw new Error('Flow not found');
    }

    const draftResult = await client.query<DraftSnapshotRow>(
      'SELECT semantic_document, layout_document, semantic_hash, layout_hash ' +
        'FROM flow_drafts WHERE flow_id = $1',
      [flowId],
    );
    const draft = draftResult.rows[0];
    if (!draft) {
      throw new Error('No draft exists for this flow');
    }

    const latestResult = await client.query<LatestRevisionRow>(
      'SELECT id, semantic_hash, layout_hash, revision_number FROM flow_revisions ' +
        'WHERE flow_id = $1 ORDER BY revision_number DESC LIMIT 1',
      [flowId],
    );
    const latest = latestResult.rows[0];

    let revisionId: string;
    if (
      latest &&
      latest.semantic_hash === draft.semantic_hash &&
      latest.layout_hash === draft.layout_hash
    ) {
      revisionId = latest.id;
    } else {
      const maxResult = await client.query<{
        max_revision_number: number | string | null;
      }>('SELECT MAX(revision_number) AS max_revision_number FROM flow_revisions WHERE flow_id = $1', [
        flowId,
      ]);
      const maxRaw = maxResult.rows[0]?.max_revision_number;
      const maxRevision = maxRaw === null || maxRaw === undefined ? 0 : Number(maxRaw);
      if (!Number.isInteger(maxRevision) || maxRevision < 0) {
        throw new Error('Could not determine the next revision number (internal error)');
      }
      revisionId = randomUUID();
      await client.query(
        'INSERT INTO flow_revisions (id, flow_id, revision_number, semantic_document, layout_document, semantic_hash, layout_hash, compiler_version, created_by, message) ' +
          'VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, NULL)',
        [
          revisionId,
          flowId,
          maxRevision + 1,
          JSON.stringify(draft.semantic_document),
          JSON.stringify(draft.layout_document),
          draft.semantic_hash,
          draft.layout_hash,
          compilerVersion,
          createdBy,
        ],
      );
    }

    const id = randomUUID();
    const result = await client.query<DeploymentRowWithRevision>(
      `INSERT INTO flow_deployments (id, flow_id, target_node_id, semantic_hash, compiler_version, rule_id, redacted_compiled_definition, runtime_node_map, status, error, created_by, revision_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'pending', NULL, $9, $10)
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
        revisionId,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Deployment attempt creation did not return a row');
    }
    return mapRowWithRevision(row);
  });
}

/**
 * Transitions a `pending` attempt to `succeeded`. Terminal rows are guarded
 * by `status = 'pending'` so a succeeded/failed record is never rewritten;
 * returns null when no pending attempt with the id exists.
 */
export async function markDeploymentSucceeded(id: string): Promise<FlowDeploymentRecord | null> {
  const attemptId = normalizeRequiredText(id, 'deployment id');
  const result = await query<DeploymentRowWithRevision>(
    `UPDATE flow_deployments SET status = 'succeeded', error = NULL
     WHERE id = $1 AND status = 'pending'
     RETURNING ${deploymentColumns}`,
    [attemptId],
  );
  const row = result.rows[0];
  return row ? mapRowWithRevision(row) : null;
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
  const result = await query<DeploymentRowWithRevision>(
    `UPDATE flow_deployments SET status = 'failed', error = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING ${deploymentColumns}`,
    [attemptId, sanitized],
  );
  const row = result.rows[0];
  return row ? mapRowWithRevision(row) : null;
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
  const result = await query<DeploymentRowWithRevision>(
    `SELECT ${deploymentColumns} FROM flow_deployments
     WHERE flow_id = $1 AND target_node_id IS NOT DISTINCT FROM $2 AND status = 'succeeded'
     ORDER BY created_at DESC, id ASC
     LIMIT 1`,
    [normalizedFlowId, normalizedTarget],
  );
  const row = result.rows[0];
  return row ? mapRowWithRevision(row) : null;
}
