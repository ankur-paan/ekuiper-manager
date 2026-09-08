/**
 * Flow runtime metrics normalized snapshot types (FS-0101).
 *
 * Bounded point-in-time view only: one snapshot carries the current
 * counters/rates/latency/error counts per Flow node. There is deliberately
 * no history array here; polling callers keep at most the latest snapshot
 * in the separate runtime store (locked decision: runtime metrics/debug
 * state is separate from Flow document/editor state).
 *
 * Flow node identity is a plain string id only; this module never imports
 * `FlowDocument`. All metric fields are optional numbers because eKuiper
 * metrics availability varies by operator and rule state. No persistence
 * lives in this module.
 */

/** Flow node id as a plain string; no `FlowDocument` import. */
export type FlowNodeRuntimeId = string;

/**
 * Bounded current metrics for one Flow node.
 *
 * Every field is an optional number: absent means the runtime did not
 * report that signal for this read. Callers must treat missing and zero
 * distinctly (missing = unknown, never fabricate).
 */
export interface FlowNodeRuntimeMetrics {
  /** Total messages entering the node, when reported. */
  inputTotal?: number;
  /** Total messages leaving the node, when reported. */
  outputTotal?: number;
  /** Total messages dropped by the node, when reported. */
  droppedTotal?: number;
  /** Total error count for the node, when reported. */
  errorTotal?: number;
  /** Input rate per second, only when the source already reports a rate. */
  inputRatePerSec?: number;
  /** Output rate per second, only when the source already reports a rate. */
  outputRatePerSec?: number;
  /** Average latency in milliseconds, when reported. */
  latencyMsAvg?: number;
  /** Max latency in milliseconds, when reported. */
  latencyMsMax?: number;
}

/**
 * One bounded runtime snapshot keyed by Flow node id.
 *
 * No history arrays: `nodes` holds only the current per-node values for
 * this `capturedAt` read.
 */
export interface FlowRuntimeSnapshot {
  /** Flow whose runtime was read. */
  flowId: string;
  /** ISO timestamp of this read. */
  capturedAt: string;
  /** Current metrics by Flow node id. */
  nodes: Record<FlowNodeRuntimeId, FlowNodeRuntimeMetrics>;
}
