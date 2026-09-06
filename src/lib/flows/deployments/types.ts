/**
 * Flow deployment attempt types (FS-0085).
 *
 * Raw row shape mirrors `database/migrations/004_flow_deployments.sql`
 * exactly (snake_case). The table is append-only: every deploy attempt is
 * its own row and prior rows are never overwritten, so the latest
 * `succeeded` row stays the active deployment even after later failures.
 *
 * Only the redacted compiled definition is persisted here (column
 * `redacted_compiled_definition`); the unredacted payload exists only
 * transiently server-side before the eKuiper management request.
 */

/** Explicit deployment attempt lifecycle; terminal rows are never rewritten. */
export type FlowDeploymentStatus = 'pending' | 'succeeded' | 'failed';

/**
 * Raw row shape for the `flow_deployments` table.
 * See `database/migrations/004_flow_deployments.sql`.
 */
export interface FlowDeploymentRow {
  id: string;
  flow_id: string;
  target_node_id: string | null;
  semantic_hash: string;
  compiler_version: number;
  rule_id: string;
  redacted_compiled_definition: Record<string, unknown>;
  runtime_node_map: Record<string, string>;
  status: FlowDeploymentStatus;
  error: string | null;
  created_by: string | null;
  created_at: Date;
}

/**
 * Domain representation of a `flow_deployments` row.
 * camelCase fields; timestamps are Dates as returned by `pg`.
 */
export interface FlowDeploymentRecord {
  id: string;
  flowId: string;
  targetNodeId: string | null;
  semanticHash: string;
  compilerVersion: number;
  ruleId: string;
  redactedCompiledDefinition: Record<string, unknown>;
  runtimeNodeMap: Record<string, string>;
  status: FlowDeploymentStatus;
  error: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export function mapFlowDeploymentRow(row: FlowDeploymentRow): FlowDeploymentRecord {
  return {
    id: row.id,
    flowId: row.flow_id,
    targetNodeId: row.target_node_id,
    semanticHash: row.semantic_hash,
    compilerVersion: row.compiler_version,
    ruleId: row.rule_id,
    redactedCompiledDefinition: row.redacted_compiled_definition,
    runtimeNodeMap: row.runtime_node_map,
    status: row.status,
    error: row.error,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
