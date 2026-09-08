'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type {
  FlowNodeRuntimeMetrics,
  FlowRuntimeSnapshot,
} from '@/lib/flows/runtime/metrics-types';
import { useFlowRuntimeStore } from '@/stores/flow-runtime-store';

/**
 * FS-0105: runtime metric poll cadence (UI_PERFORMANCE_SPEC: 1 Hz default).
 */
export const FLOW_RUNTIME_METRICS_POLL_MS = 1000;

export interface UseFlowRuntimeMetricsOptions {
  /**
   * While false no request fires. The caller enables polling only while the
   * runtime is running (live status read), so a stopped/never-deployed flow
   * never pays for 1Hz reads.
   */
  enabled?: boolean;
}

const METRIC_FIELDS = [
  'inputTotal',
  'outputTotal',
  'droppedTotal',
  'errorTotal',
  'inputRatePerSec',
  'outputRatePerSec',
  'latencyMsAvg',
  'latencyMsMax',
] as const satisfies ReadonlyArray<keyof FlowNodeRuntimeMetrics>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalFiniteNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    const nested: unknown = payload['error'];
    if (isRecord(nested)) {
      const message = nested['message'];
      if (typeof message === 'string' && message.length > 0) return message;
    }
  }
  return `Request failed (${status})`;
}

/**
 * Narrow one per-node metrics entry. Unknown fields are ignored and entries
 * with no recognized numeric field are omitted (absent means unknown, never
 * fabricated), matching the counters-only convention of the server mapper.
 */
function parseNodeMetrics(value: unknown): FlowNodeRuntimeMetrics | undefined {
  if (!isRecord(value)) return undefined;
  const metrics: FlowNodeRuntimeMetrics = {};
  let found = false;
  for (const field of METRIC_FIELDS) {
    const numeric = readOptionalFiniteNumber(value, field);
    if (numeric !== undefined) {
      metrics[field] = numeric;
      found = true;
    }
  }
  return found ? metrics : undefined;
}

function parseMetricsSnapshot(payload: unknown, flowId: string): FlowRuntimeSnapshot {
  if (!isRecord(payload)) throw new Error('Unexpected metrics response.');
  const snapshotRaw: unknown = payload['snapshot'];
  if (!isRecord(snapshotRaw)) throw new Error('Unexpected metrics response.');
  const capturedAt = snapshotRaw['capturedAt'];
  const nodesRaw: unknown = snapshotRaw['nodes'];
  const nodes: Record<string, FlowNodeRuntimeMetrics> = {};
  if (isRecord(nodesRaw)) {
    for (const [nodeId, rawMetrics] of Object.entries(nodesRaw)) {
      if (nodeId.length === 0) continue;
      const metrics = parseNodeMetrics(rawMetrics);
      if (metrics) nodes[nodeId] = metrics;
    }
  }
  return {
    // Key by the requested flow so the store entry always lands under the
    // flow the caller polled (the server echoes the same id).
    flowId,
    capturedAt:
      typeof capturedAt === 'string' && capturedAt.length > 0
        ? capturedAt
        : new Date().toISOString(),
    nodes,
  };
}

/**
 * Read one bounded metrics snapshot for a flow.
 *
 * Response shape mirrors `GET /api/flows/:id/runtime/metrics` (FS-0103):
 * `{ snapshot, deployed, deploymentId, ruleId }`. Only the bounded snapshot
 * is returned; no database writes occur server-side.
 */
export async function fetchFlowRuntimeMetrics(
  flowId: string,
): Promise<FlowRuntimeSnapshot> {
  const response = await fetch(
    `/api/flows/${encodeURIComponent(flowId)}/runtime/metrics`,
    { cache: 'no-store' },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readErrorMessage(payload, response.status));
  return parseMetricsSnapshot(payload, flowId);
}

function readPageVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

/**
 * FS-0105: poll the bounded metrics endpoint at 1Hz and write each snapshot
 * into the separate runtime store (never into the Flow document/editor
 * state, so semantic/layout hashes are untouched).
 *
 * Polling runs only while `options.enabled` is true (caller passes runtime
 * running state) and the page is visible when practical via
 * `visibilitychange` gating plus `refetchIntervalInBackground: false`.
 * React Query teardown on unmount stops polling. Failures only surface via
 * the returned query state; no toast, no editor mutation.
 */
export function useFlowRuntimeMetrics(
  flowId: string,
  options?: UseFlowRuntimeMetricsOptions,
) {
  const pollingEnabled = options?.enabled ?? true;
  const [pageVisible, setPageVisible] = React.useState<boolean>(() =>
    readPageVisible(),
  );
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = (): void => {
      setPageVisible(readPageVisible());
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const enabled =
    pollingEnabled && pageVisible && flowId.trim().length > 0;
  const query = useQuery({
    queryKey: ['flow-runtime-metrics', flowId],
    queryFn: () => fetchFlowRuntimeMetrics(flowId),
    enabled,
    staleTime: FLOW_RUNTIME_METRICS_POLL_MS,
    refetchInterval: FLOW_RUNTIME_METRICS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const snapshot = query.data ?? null;
  React.useEffect(() => {
    if (!snapshot) return;
    useFlowRuntimeStore.getState().setRuntimeSnapshot(snapshot);
  }, [snapshot]);

  return query;
}
