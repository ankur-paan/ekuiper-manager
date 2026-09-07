/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useShallow } from 'zustand/shallow';

import {
  selectFlowNodeMetrics,
  useFlowRuntimeStore,
} from '@/stores/flow-runtime-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FLOW_ID = 'flow-perf-1';
const NODE_A = 'node-a';
const NODE_B = 'node-b';

/**
 * Render counts are test-only instrumentation. No production logging or
 * profiler is added (FS-0123 acceptance criterion).
 */
const renderCounts: Record<string, number> = { [NODE_A]: 0, [NODE_B]: 0 };

interface MetricsProbeProps {
  flowId: string;
  nodeId: string;
}

/**
 * Mirrors the FS-0105 FlowNode subscription shape exactly: a fine-grained
 * per-node selector through `useShallow`, so an unrelated node's metrics
 * update must not rerender this component.
 */
function MetricsProbe({ flowId, nodeId }: MetricsProbeProps): React.JSX.Element {
  const metrics = useFlowRuntimeStore(
    useShallow((state) => selectFlowNodeMetrics(state, flowId, nodeId)),
  );
  renderCounts[nodeId] += 1;
  return (
    <div data-testid={`metrics-${nodeId}`}>
      {metrics?.inputTotal ?? 'none'}
    </div>
  );
}

function ProbeTree(): React.JSX.Element {
  return (
    <div>
      <MetricsProbe flowId={FLOW_ID} nodeId={NODE_A} />
      <MetricsProbe flowId={FLOW_ID} nodeId={NODE_B} />
    </div>
  );
}

const mounted: { container: HTMLElement; root: Root }[] = [];

async function renderProbes(): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(<ProbeTree />);
  });
  return container;
}

function probeText(container: HTMLElement, nodeId: string): string | null {
  return container.querySelector(`[data-testid="metrics-${nodeId}"]`)?.textContent ?? null;
}

beforeEach(() => {
  renderCounts[NODE_A] = 0;
  renderCounts[NODE_B] = 0;
  useFlowRuntimeStore.setState({ snapshots: {} });
  useFlowRuntimeStore.getState().setRuntimeSnapshot({
    flowId: FLOW_ID,
    capturedAt: '2026-02-01T00:00:00.000Z',
    nodes: {
      [NODE_A]: { inputTotal: 1, outputTotal: 1 },
      [NODE_B]: { inputTotal: 2, outputTotal: 2 },
    },
  });
});

afterEach(async () => {
  await act(async () => {
    for (const entry of mounted.splice(0)) {
      entry.root.unmount();
      entry.container.remove();
    }
  });
});

describe('flow node render performance guard (FS-0123)', () => {
  it('keeps the unrelated node selector reference stable on a single-node metrics update', () => {
    const beforeB = selectFlowNodeMetrics(
      useFlowRuntimeStore.getState(),
      FLOW_ID,
      NODE_B,
    );
    expect(beforeB).toEqual({ inputTotal: 2, outputTotal: 2 });

    act(() => {
      useFlowRuntimeStore
        .getState()
        .updateNodeMetrics(FLOW_ID, NODE_A, { inputTotal: 100, outputTotal: 99 });
    });

    // Node B entry keeps its reference, so a per-node selector (with the
    // shallow equality used by FlowNode) observes no change for node B.
    expect(
      selectFlowNodeMetrics(useFlowRuntimeStore.getState(), FLOW_ID, NODE_B),
    ).toBe(beforeB);
    expect(
      selectFlowNodeMetrics(useFlowRuntimeStore.getState(), FLOW_ID, NODE_A),
    ).toEqual({ inputTotal: 100, outputTotal: 99 });
  });

  it('does not rerender the component subscribed to node B when node A metrics update', async () => {
    const container = await renderProbes();
    expect(renderCounts[NODE_A]).toBe(1);
    expect(renderCounts[NODE_B]).toBe(1);
    expect(probeText(container, NODE_A)).toBe('1');
    expect(probeText(container, NODE_B)).toBe('2');

    await act(async () => {
      useFlowRuntimeStore
        .getState()
        .updateNodeMetrics(FLOW_ID, NODE_A, { inputTotal: 100, outputTotal: 99 });
    });

    expect(probeText(container, NODE_A)).toBe('100');
    expect(probeText(container, NODE_B)).toBe('2');
    expect(renderCounts[NODE_A]).toBe(2);
    // The node B subscriber saw no selector change, so it did not rerender.
    expect(renderCounts[NODE_B]).toBe(1);

    await act(async () => {
      useFlowRuntimeStore
        .getState()
        .updateNodeMetrics(FLOW_ID, NODE_B, { inputTotal: 200, outputTotal: 199 });
    });

    expect(probeText(container, NODE_B)).toBe('200');
    expect(renderCounts[NODE_B]).toBe(2);
    // Symmetrically, the node A subscriber stays quiet on a node B update.
    expect(renderCounts[NODE_A]).toBe(2);
  });

  it('does not rerender the node B subscriber on a full snapshot poll that leaves node B values unchanged', async () => {
    const container = await renderProbes();
    expect(renderCounts[NODE_A]).toBe(1);
    expect(renderCounts[NODE_B]).toBe(1);

    // The 1Hz poller writes a whole snapshot via setRuntimeSnapshot; the
    // shallow-equality subscription must still isolate node B when only
    // node A values changed.
    await act(async () => {
      useFlowRuntimeStore.getState().setRuntimeSnapshot({
        flowId: FLOW_ID,
        capturedAt: '2026-02-01T00:00:01.000Z',
        nodes: {
          [NODE_A]: { inputTotal: 50, outputTotal: 49 },
          [NODE_B]: { inputTotal: 2, outputTotal: 2 },
        },
      });
    });

    expect(probeText(container, NODE_A)).toBe('50');
    expect(probeText(container, NODE_B)).toBe('2');
    expect(renderCounts[NODE_A]).toBe(2);
    expect(renderCounts[NODE_B]).toBe(1);
  });
});
