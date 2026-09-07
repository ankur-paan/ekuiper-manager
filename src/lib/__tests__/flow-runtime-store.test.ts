import {
  selectFlowNodeMetrics,
  selectFlowRuntimeSnapshot,
  useFlowRuntimeStore,
} from '@/stores/flow-runtime-store';
import type { FlowRuntimeSnapshot } from '@/lib/flows/runtime/metrics-types';

function buildSnapshot(flowId = 'flow-1'): FlowRuntimeSnapshot {
  return {
    flowId,
    capturedAt: '2026-02-01T00:00:00.000Z',
    nodes: {
      'node-source-1': { inputTotal: 10, outputTotal: 9 },
      'node-sink-1': { inputTotal: 9, outputTotal: 9 },
    },
  };
}

beforeEach(() => {
  useFlowRuntimeStore.setState({ snapshots: {} });
});

describe('flow runtime store', () => {
  it('starts empty and holds no editor/document fields', () => {
    const state = useFlowRuntimeStore.getState();

    expect(state.snapshots).toEqual({});
    expect(state).not.toHaveProperty('document');
    expect(state).not.toHaveProperty('spec');
    expect(state).not.toHaveProperty('selectedNodeIds');
    expect(state).not.toHaveProperty('selectedEdgeIds');
    expect(state).not.toHaveProperty('past');
    expect(state).not.toHaveProperty('future');
    expect(state).not.toHaveProperty('viewport');
  });

  it('stores the current snapshot by flow ID', () => {
    useFlowRuntimeStore.getState().setRuntimeSnapshot(buildSnapshot());

    const stored = selectFlowRuntimeSnapshot(
      useFlowRuntimeStore.getState(),
      'flow-1',
    );
    expect(stored).toEqual(buildSnapshot());
    expect(stored).not.toBeUndefined();
  });

  it('replaces the snapshot on the next read without history', () => {
    useFlowRuntimeStore.getState().setRuntimeSnapshot(buildSnapshot());
    const next = buildSnapshot();
    next.capturedAt = '2026-02-01T00:00:01.000Z';
    next.nodes['node-source-1'] = { inputTotal: 20, outputTotal: 19 };

    useFlowRuntimeStore.getState().setRuntimeSnapshot(next);

    const stored = useFlowRuntimeStore.getState().snapshots['flow-1'];
    expect(stored?.capturedAt).toBe('2026-02-01T00:00:01.000Z');
    expect(stored?.nodes['node-source-1']).toEqual({
      inputTotal: 20,
      outputTotal: 19,
    });
  });

  it('copies snapshot input instead of holding caller references', () => {
    const snapshot = buildSnapshot();
    useFlowRuntimeStore.getState().setRuntimeSnapshot(snapshot);

    snapshot.nodes['node-source-1']!.inputTotal = 999;
    snapshot.nodes['node-extra'] = { inputTotal: 1 };

    const stored = useFlowRuntimeStore.getState().snapshots['flow-1'];
    expect(stored?.nodes['node-source-1']).toEqual({
      inputTotal: 10,
      outputTotal: 9,
    });
    expect(stored?.nodes).not.toHaveProperty('node-extra');
  });

  it('updates one node metrics while keeping the other node reference stable', () => {
    useFlowRuntimeStore.getState().setRuntimeSnapshot(buildSnapshot());
    const before = useFlowRuntimeStore.getState().snapshots['flow-1'];
    const untouchedBefore = before?.nodes['node-sink-1'];

    useFlowRuntimeStore
      .getState()
      .updateNodeMetrics('flow-1', 'node-source-1', { inputTotal: 42 });

    const after = useFlowRuntimeStore.getState().snapshots['flow-1'];
    expect(after?.nodes['node-source-1']).toEqual({ inputTotal: 42 });
    // Unrelated node entry keeps its reference so a per-node selector
    // does not observe a change for that node.
    expect(after?.nodes['node-sink-1']).toBe(untouchedBefore);
    expect(selectFlowNodeMetrics(useFlowRuntimeStore.getState(), 'flow-1', 'node-sink-1')).toBe(
      untouchedBefore,
    );
  });

  it('keeps snapshots for other flows untouched on update', () => {
    useFlowRuntimeStore.getState().setRuntimeSnapshot(buildSnapshot('flow-1'));
    useFlowRuntimeStore.getState().setRuntimeSnapshot(buildSnapshot('flow-2'));

    useFlowRuntimeStore
      .getState()
      .updateNodeMetrics('flow-1', 'node-source-1', { inputTotal: 7 });

    expect(
      useFlowRuntimeStore.getState().snapshots['flow-2']?.nodes['node-source-1'],
    ).toEqual({ inputTotal: 10, outputTotal: 9 });
  });

  it('clears one flow runtime without touching other flows', () => {
    useFlowRuntimeStore.getState().setRuntimeSnapshot(buildSnapshot('flow-1'));
    useFlowRuntimeStore.getState().setRuntimeSnapshot(buildSnapshot('flow-2'));

    useFlowRuntimeStore.getState().clearFlowRuntime('flow-1');

    expect(useFlowRuntimeStore.getState().snapshots['flow-1']).toBeUndefined();
    expect(
      useFlowRuntimeStore.getState().snapshots['flow-2'],
    ).toBeDefined();
  });

  it('clearing an unknown flow is a no-op', () => {
    useFlowRuntimeStore.getState().setRuntimeSnapshot(buildSnapshot());
    const before = useFlowRuntimeStore.getState().snapshots;

    useFlowRuntimeStore.getState().clearFlowRuntime('flow-missing');

    expect(useFlowRuntimeStore.getState().snapshots).toBe(before);
  });
});
