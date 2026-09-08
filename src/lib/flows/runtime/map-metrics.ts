import type {
  FlowNodeRuntimeMetrics,
  FlowRuntimeSnapshot,
} from './metrics-types';

/**
 * Map an eKuiper rule status body to a bounded Flow runtime snapshot (FS-0102).
 *
 * Shape sources (verified, not assumed):
 * - Audited `public/ekuiper-openapi.json` v2.4.1: `GET /v2/rules/{name}/status`
 *   (operationId `getRuleStatusV2`) decodes to the `RuleStatus` schema
 *   `{status, message, lastStartTimestamp, lastStopTimestamp,
 *   nextStartTimestamp}` with `additionalProperties: true`. Per-operator
 *   metrics therefore arrive as dynamically named extra properties.
 * - `src/lib/ekuiper/types.ts` `RuleMetrics` evidences the concrete
 *   per-operator key convention `<runtimeOperatorId>_<counter>`:
 *   `records_in_total`, `records_out_total`, `exceptions_total`
 *   (alongside non-counter gauges such as `process_latency_us`,
 *   `buffer_length`, `last_invocation`, `connection_status`, `last_exception`).
 * - `runtimeNodeMap` direction is Flow node ID -> deterministic runtime
 *   operator ID (`FlowDeploymentArtifact.runtimeNodeMap` in
 *   `src/lib/flows/compiler/types.ts`, persisted by FS-0085); this mapper
 *   inverts it to translate operator IDs back to Flow node IDs.
 *
 * Deliberately counters-only: the audited contract reports no rate fields,
 * so `inputRatePerSec`/`outputRatePerSec` are never populated (computing them
 * would require history). Non-counter gauges are left absent as well because
 * their aggregation semantics (instantaneous vs avg/max) cannot be proven
 * from the audited contract; absent means unknown per FS-0101.
 */

/** Counter suffix -> snapshot field. Only evidenced counter suffixes. */
const COUNTER_SUFFIX_TO_FIELD: Record<string, keyof FlowNodeRuntimeMetrics> = {
  records_in_total: 'inputTotal',
  records_out_total: 'outputTotal',
  exceptions_total: 'errorTotal',
};

export interface MapRuleStatusMetricsInput {
  /** Flow whose runtime was read. */
  flowId: string;
  /**
   * Persisted deployment map: Flow node ID -> runtime operator ID.
   * Never mutated.
   */
  runtimeNodeMap: Record<string, string>;
  /** Raw `GET /v2/rules/{name}/status` body (typed status + metrics). */
  ruleStatus: unknown;
  /** ISO timestamp override for this read; defaults to now. */
  capturedAt?: string;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Translate one rule status body into a bounded snapshot keyed by Flow node ID.
 *
 * - Unknown runtime operators (status keys matching no deployed operator ID)
 *   are ignored safely, never thrown.
 * - A non-object status body yields an empty `nodes` map, never a crash.
 * - Non-numeric metric values (e.g. string `last_exception` detail) are ignored.
 * - The input `runtimeNodeMap` is only read, never written.
 */
export function mapRuleStatusToSnapshot(
  input: MapRuleStatusMetricsInput,
): FlowRuntimeSnapshot {
  if (typeof input.flowId !== 'string' || input.flowId.trim().length === 0) {
    throw new Error('mapRuleStatusToSnapshot: flowId is required');
  }
  const capturedAt =
    typeof input.capturedAt === 'string' && input.capturedAt.length > 0
      ? input.capturedAt
      : new Date().toISOString();

  // Invert without touching the input map: runtime operator ID -> Flow node ID.
  // Entries are narrowed defensively so a malformed persisted map skips
  // safely instead of crashing.
  const operatorToFlowNode = new Map<string, string>();
  for (const [flowNodeId, runtimeId] of Object.entries(input.runtimeNodeMap)) {
    if (typeof flowNodeId !== 'string' || flowNodeId.length === 0) continue;
    if (typeof runtimeId !== 'string' || runtimeId.length === 0) continue;
    // First wins on duplicate runtime IDs so inversion stays deterministic.
    if (!operatorToFlowNode.has(runtimeId)) {
      operatorToFlowNode.set(runtimeId, flowNodeId);
    }
  }
  // Longest operator ID first so nested IDs (e.g. `op` and `op_x`) resolve
  // to the most specific operator.
  const operatorIds = [...operatorToFlowNode.keys()].sort(
    (a, b) => b.length - a.length,
  );

  const nodes: Record<string, FlowNodeRuntimeMetrics> = {};
  const body = input.ruleStatus;
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    for (const [statusKey, rawValue] of Object.entries(
      body as Record<string, unknown>,
    )) {
      const operatorId = operatorIds.find((candidate) =>
        statusKey.startsWith(`${candidate}_`),
      );
      if (operatorId === undefined) continue;
      const suffix = statusKey.slice(operatorId.length + 1);
      const field = COUNTER_SUFFIX_TO_FIELD[suffix];
      if (field === undefined) continue;
      const value = readFiniteNumber(rawValue);
      if (value === undefined) continue;
      const flowNodeId = operatorToFlowNode.get(operatorId);
      if (flowNodeId === undefined) continue;
      const current = nodes[flowNodeId] ?? {};
      current[field] = value;
      nodes[flowNodeId] = current;
    }
  }

  return { flowId: input.flowId, capturedAt, nodes };
}
