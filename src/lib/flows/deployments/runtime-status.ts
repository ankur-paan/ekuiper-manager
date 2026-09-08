import { ApiError } from '@/lib/api';
import { getFlow } from '../persistence/flow-repository';
import type { FlowRecord } from '../persistence/types';
import { defaultFetchRuleStatus, type FetchRuleStatusArgs } from './deploy-flow';
import {
  getLatestSuccessfulDeployment,
  sanitizeDeploymentError,
} from './deployment-repository';
import type { FlowDeploymentRecord } from './types';

/**
 * Flow runtime desired/actual status read model (FS-0099).
 *
 * One read per call: the caller loads the latest successful Manager
 * deployment for the flow and performs a single typed rule-status read
 * (`GET /v2/rules/{name}/status`, operationId `getRuleStatusV2` in
 * `public/ekuiper-openapi.json` v2.4.1, whose text/plain JSON body decodes
 * to the `RuleStatus` schema `{status, message, ...}` with
 * `additionalProperties: true`). There is no streaming or poll scheduler
 * here; polling policy belongs to the UI layer (FS-0100).
 *
 * Only registered managed-node ids are used; the destination and
 * credential always come from the managed-node row behind the same SSRF
 * boundary as the deployment service. The model never carries raw
 * credentials, base URLs, or arbitrary URLs.
 */

/** What Manager last asked the runtime to do (deploy means run). */
export type FlowRuntimeDesiredState = 'running' | 'stopped' | 'unknown';

/** Normalized eKuiper rule state. */
export type FlowRuntimeActualState = 'running' | 'stopped' | 'error' | 'unknown';

export interface FlowRuntimeStatus {
  flowId: string;
  targetNodeId: string | null;
  /** Rule id of the latest successful deployment, null when never deployed. */
  ruleId: string | null;
  /** Latest successful deployment id, null when never deployed. */
  deploymentId: string | null;
  /** False when no successful deployment exists yet. */
  deployed: boolean;
  desiredState: FlowRuntimeDesiredState;
  actualState: FlowRuntimeActualState;
  /** Safe, bounded, redacted summary; null when there is nothing to report. */
  message: string | null;
  /** ISO timestamp of this read. */
  checkedAt: string;
}

/** Static safe reason when the flow has no successful deployment yet. */
export const FLOW_RUNTIME_NEVER_DEPLOYED_MESSAGE = 'Flow has not been deployed yet';

/** Static fallback when an unexpected (non-protocol) failure occurs. */
export const FLOW_RUNTIME_READ_FAILED_MESSAGE = 'Runtime status could not be read';

export type FetchFlowRuleStatus = (args: FetchRuleStatusArgs) => Promise<unknown>;

export interface RuntimeStatusDependencies {
  loadFlow?: (flowId: string) => Promise<FlowRecord | null>;
  loadLatestDeployment?: (
    flowId: string,
    targetNodeId: string | null,
  ) => Promise<FlowDeploymentRecord | null>;
  fetchRuleStatus?: FetchFlowRuleStatus;
}

/**
 * Normalize an eKuiper `RuleStatus` body to an actual state.
 *
 * The audited `RuleStatus.status` is an open string (commonly `running`,
 * `stopped`, or `stopped: <detail>`). A status mentioning an error, failure,
 * or exception reads as `error` so the safe message carries the detail;
 * anything unrecognized reads as `unknown`, never as a guess.
 */
export function normalizeActualState(statusValue: unknown): FlowRuntimeActualState {
  if (typeof statusValue !== 'string') return 'unknown';
  const text = statusValue.trim().toLowerCase();
  if (text === 'running' || text.startsWith('running:') || text.startsWith('running ')) {
    return 'running';
  }
  if (text === 'error' || text.startsWith('error:') || text.startsWith('error ')) {
    return 'error';
  }
  if (text === 'stopped' || text.startsWith('stopped')) {
    return /error|failed|exception/.test(text) ? 'error' : 'stopped';
  }
  if (/error|failed|exception/.test(text)) return 'error';
  return 'unknown';
}

/**
 * Extract the safe summary from an eKuiper `RuleStatus` body.
 *
 * Only the bounded, redacted `message` string is carried; per-node metrics
 * and any secret-bearing fields are dropped by design.
 */
export function readStatusMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  const message = (body as Record<string, unknown>).message;
  if (typeof message !== 'string' || message.trim().length === 0) {
    return null;
  }
  return sanitizeDeploymentError(message);
}

/** Static summary when a sink cannot reach its destination. */
export const FLOW_RUNTIME_SINK_UNREACHABLE_MESSAGE =
  'A sink cannot connect to its destination. The rule is running but delivering nothing.';

/** Static summary when a sink is receiving rows but failing to emit them. */
export const FLOW_RUNTIME_SINK_FAILING_MESSAGE =
  'A sink is receiving rows but failing to send them. The rule is running but delivering nothing.';

/**
 * eKuiper reports a rule as `running` even when its sink cannot deliver: a broker that is
 * unroutable, or an endpoint the engine refuses to call. The rule status string never changes,
 * so a status-only read shows a healthy rule that emits nothing — measured twice in live
 * acceptance testing (AC-D009, AC-D010).
 *
 * The per-node metrics in the same `RuleStatus` body do carry the truth:
 * - `*_connection_status` is negative while a connection is down.
 * - a sink with `records_in_total > 0`, `records_out_total === 0` and `exceptions_total > 0`
 *   is consuming rows and dropping every one.
 *
 * Returns a static, non-reflected summary (the raw exception can carry broker addresses and
 * credentials, so it is deliberately not surfaced here), or null when nothing is wrong.
 */
export function detectUnhealthyRuntime(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const entries = Object.entries(body as Record<string, unknown>);

  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  for (const [key, value] of entries) {
    if (!/_connection_status$/.test(key)) continue;
    const status = num(value);
    if (status !== null && status < 0) return FLOW_RUNTIME_SINK_UNREACHABLE_MESSAGE;
  }

  // Group sink counters by their node prefix so one sink's totals are compared with its own.
  const sinks = new Map<string, { in: number | null; out: number | null; exceptions: number | null }>();
  for (const [key, value] of entries) {
    const match = /^(sink_.*)_(records_in_total|records_out_total|exceptions_total)$/.exec(key);
    if (!match) continue;
    const [, prefix, field] = match;
    const bucket = sinks.get(prefix) ?? { in: null, out: null, exceptions: null };
    if (field === 'records_in_total') bucket.in = num(value);
    else if (field === 'records_out_total') bucket.out = num(value);
    else bucket.exceptions = num(value);
    sinks.set(prefix, bucket);
  }
  for (const bucket of sinks.values()) {
    if ((bucket.in ?? 0) > 0 && (bucket.out ?? 0) === 0 && (bucket.exceptions ?? 0) > 0) {
      return FLOW_RUNTIME_SINK_FAILING_MESSAGE;
    }
  }
  return null;
}

/**
 * Map a status-fetch failure to a safe summary.
 *
 * Protocol failures (`ApiError` from the registered-node transport) already
 * carry server-safe static messages, so the bounded/redacted text is kept.
 * Anything else is replaced with a static fallback so internal details
 * never leak to the browser.
 */
export function toSafeStatusReason(error: unknown): string {
  if (error instanceof ApiError) {
    return sanitizeDeploymentError(error.message);
  }
  return FLOW_RUNTIME_READ_FAILED_MESSAGE;
}

function neverDeployedStatus(flow: FlowRecord, checkedAt: string): FlowRuntimeStatus {
  return {
    flowId: flow.id,
    targetNodeId: flow.targetNodeId,
    ruleId: null,
    deploymentId: null,
    deployed: false,
    desiredState: 'unknown',
    actualState: 'unknown',
    message: FLOW_RUNTIME_NEVER_DEPLOYED_MESSAGE,
    checkedAt,
  };
}

/**
 * Read one flow's runtime desired/actual status.
 *
 * - Missing flow throws 404 `FLOW_NOT_FOUND`.
 * - No successful deployment resolves to the never-deployed/unknown model,
 *   never a 500.
 * - An unreachable target or a rule missing on eKuiper resolves to
 *   `actualState: 'unknown'` with a safe reason, never a throw and never
 *   raw credentials or URLs.
 */
export async function getFlowRuntimeStatus(
  flowId: unknown,
  dependencies: RuntimeStatusDependencies = {},
): Promise<FlowRuntimeStatus> {
  if (typeof flowId !== 'string' || flowId.trim().length === 0) {
    throw new ApiError(400, 'Flow id is required', 'INVALID_FLOW_ID');
  }
  const normalizedFlowId = flowId.trim();
  const checkedAt = new Date().toISOString();

  const loadFlow = dependencies.loadFlow ?? getFlow;
  const flow = await loadFlow(normalizedFlowId);
  if (!flow) {
    throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
  }

  const loadLatestDeployment =
    dependencies.loadLatestDeployment ??
    ((id: string, target: string | null) => getLatestSuccessfulDeployment(id, target));
  const deployment = await loadLatestDeployment(flow.id, flow.targetNodeId);
  if (!deployment) {
    return neverDeployedStatus(flow, checkedAt);
  }

  const targetNodeId = deployment.targetNodeId;
  if (targetNodeId === null) {
    return {
      flowId: flow.id,
      targetNodeId,
      ruleId: deployment.ruleId,
      deploymentId: deployment.id,
      deployed: true,
      desiredState: 'running',
      actualState: 'unknown',
      message: 'Add an eKuiper node first',
      checkedAt,
    };
  }

  const fetchRuleStatus = dependencies.fetchRuleStatus ?? defaultFetchRuleStatus;
  let body: unknown;
  try {
    body = await fetchRuleStatus({ targetNodeId, ruleId: deployment.ruleId });
  } catch (error) {
    return {
      flowId: flow.id,
      targetNodeId,
      ruleId: deployment.ruleId,
      deploymentId: deployment.id,
      deployed: true,
      desiredState: 'running',
      actualState: 'unknown',
      message: toSafeStatusReason(error),
      checkedAt,
    };
  }

  const statusValue =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).status
      : undefined;
  const reportedState = normalizeActualState(statusValue);
  // A rule the engine calls `running` can still be delivering nothing. Only downgrade a
  // reported-healthy rule: a rule already in error or stopped keeps its own reason.
  const unhealthyReason =
    reportedState === 'running' ? detectUnhealthyRuntime(body) : null;
  const actualState: FlowRuntimeActualState =
    unhealthyReason === null ? reportedState : 'error';
  return {
    flowId: flow.id,
    targetNodeId,
    ruleId: deployment.ruleId,
    deploymentId: deployment.id,
    deployed: true,
    desiredState: 'running',
    actualState,
    message: unhealthyReason ?? readStatusMessage(body),
    checkedAt,
  };
}
