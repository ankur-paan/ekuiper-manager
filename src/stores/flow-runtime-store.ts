import { create } from 'zustand';

import type {
  FlowNodeRuntimeMetrics,
  FlowRuntimeSnapshot,
} from '@/lib/flows/runtime/metrics-types';

interface FlowRuntimeState {
  /** Current bounded runtime snapshot by flow ID (latest read only, no history). */
  snapshots: Record<string, FlowRuntimeSnapshot>;
  /** Replace the stored snapshot for a flow with a fresh read. */
  setRuntimeSnapshot: (snapshot: FlowRuntimeSnapshot) => void;
  /** Replace metrics for a single node without touching other nodes. */
  updateNodeMetrics: (
    flowId: string,
    nodeId: string,
    metrics: FlowNodeRuntimeMetrics,
  ) => void;
  /** Drop the stored snapshot for one flow. */
  clearFlowRuntime: (flowId: string) => void;
}

function cloneMetrics(
  metrics: FlowNodeRuntimeMetrics,
): FlowNodeRuntimeMetrics {
  return { ...metrics };
}

function cloneSnapshot(snapshot: FlowRuntimeSnapshot): FlowRuntimeSnapshot {
  const nodes: Record<string, FlowNodeRuntimeMetrics> = {};
  for (const [nodeId, metrics] of Object.entries(snapshot.nodes)) {
    nodes[nodeId] = cloneMetrics(metrics);
  }
  return { flowId: snapshot.flowId, capturedAt: snapshot.capturedAt, nodes };
}

/**
 * Separate runtime metrics/debug state (FS-0104).
 *
 * Deliberately independent from the Flow document/editor store: no
 * FlowDocument, selection, viewport, or history fields live here, so a
 * metrics update never requires replacing the semantic document.
 */
export const useFlowRuntimeStore = create<FlowRuntimeState>((set) => ({
  snapshots: {},

  setRuntimeSnapshot: (snapshot) =>
    set((state) => ({
      snapshots: { ...state.snapshots, [snapshot.flowId]: cloneSnapshot(snapshot) },
    })),

  updateNodeMetrics: (flowId, nodeId, metrics) =>
    set((state) => {
      const existing = state.snapshots[flowId];
      const nextNode = cloneMetrics(metrics);
      if (!existing) {
        return {
          snapshots: {
            ...state.snapshots,
            [flowId]: {
              flowId,
              capturedAt: new Date().toISOString(),
              nodes: { [nodeId]: nextNode },
            },
          },
        };
      }
      return {
        snapshots: {
          ...state.snapshots,
          [flowId]: {
            ...existing,
            nodes: { ...existing.nodes, [nodeId]: nextNode },
          },
        },
      };
    }),

  clearFlowRuntime: (flowId) =>
    set((state) => {
      if (!(flowId in state.snapshots)) {
        return state;
      }
      const next = { ...state.snapshots };
      delete next[flowId];
      return { snapshots: next };
    }),
}));

/** Select the stored snapshot for one flow, if any. */
export function selectFlowRuntimeSnapshot(
  state: FlowRuntimeState,
  flowId: string,
): FlowRuntimeSnapshot | undefined {
  return state.snapshots[flowId];
}

/** Select metrics for a single node; supports fine-grained subscriptions. */
export function selectFlowNodeMetrics(
  state: FlowRuntimeState,
  flowId: string,
  nodeId: string,
): FlowNodeRuntimeMetrics | undefined {
  return state.snapshots[flowId]?.nodes[nodeId];
}
