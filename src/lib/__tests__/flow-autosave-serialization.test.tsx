/**
 * @jest-environment jsdom
 *
 * R3 regression: autosave serializes PUTs per flow so an older request can
 * never overwrite a newer draft. While a save is in flight no second PUT
 * starts; only the newest pending snapshot is sent when the in-flight save
 * settles, and the newest snapshot is what ends up persisted and reported.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  FLOW_AUTOSAVE_DEBOUNCE_MS,
  useFlowAutosave,
  type FlowAutosaveSaved,
  type FlowAutosaveStatus,
} from '@/components/flow-studio/hooks/use-flow-autosave';
import { buildFlowDirtyBaseline, type FlowDirtyBaseline } from '@/lib/flows/model/flow-dirty-state';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface HarnessProps {
  flowId: string;
  spec: FlowSpec;
  layout: FlowLayout;
  baseline: FlowDirtyBaseline | null;
  onSaved?: (saved: FlowAutosaveSaved) => void;
}

let latestStatus: FlowAutosaveStatus = 'idle';
let latestError: string | null = null;

function Harness({ flowId, spec, layout, baseline, onSaved }: HarnessProps) {
  const result = useFlowAutosave({ flowId, spec, layout, baseline, onSaved });
  latestStatus = result.status;
  latestError = result.error;
  return null;
}

const mounted: { container: HTMLElement; root: Root }[] = [];

async function renderHarness(props: HarnessProps): Promise<Root> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(<Harness {...props} />);
  });
  return root;
}

async function updateHarness(root: Root, props: HarnessProps): Promise<void> {
  await act(async () => {
    root.render(<Harness {...props} />);
  });
}

function fetchMock(): jest.Mock {
  return global.fetch as jest.Mock;
}

function draftResponse(semanticHash: string, layoutHash: string): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ draft: { flowId: 'flow-1', semanticHash, layoutHash } }),
  } as Response;
}

function putSpecs(): FlowSpec[] {
  return fetchMock().mock.calls.map((call) => {
    const init = call[1] as RequestInit;
    return (JSON.parse(init.body as string) as { spec: FlowSpec }).spec;
  });
}

function withSourceTopic(spec: FlowSpec, topic: string): FlowSpec {
  return {
    ...spec,
    nodes: spec.nodes.map((node) =>
      node.id === 'node-source-1' ? { ...node, config: { topic } } : node,
    ),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  latestStatus = 'idle';
  latestError = null;
  jest.useFakeTimers();
  global.fetch = jest.fn(() => Promise.reject(new Error('fetch is not mocked')));
});

afterEach(async () => {
  await act(async () => {
    for (const entry of mounted.splice(0)) {
      entry.root.unmount();
      entry.container.remove();
    }
  });
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('R3: autosave serialization', () => {
  it('never overlaps PUTs; the newest snapshot is persisted and reported even when the older request settles last', async () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);
    const saved: FlowAutosaveSaved[] = [];

    const first = deferred<Response>();
    const second = deferred<Response>();
    fetchMock()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const editA = withSourceTopic(doc.spec, 'devices/a');
    const editB = withSourceTopic(doc.spec, 'devices/b');
    const props = (spec: FlowSpec): HarnessProps => ({
      flowId: 'flow-1',
      spec,
      layout: doc.layout,
      baseline,
      onSaved: (entry) => {
        saved.push(entry);
      },
    });

    const root = await renderHarness(props(editA));
    expect(latestStatus).toBe('pending');

    // First debounced save starts.
    await act(async () => {
      jest.advanceTimersByTime(FLOW_AUTOSAVE_DEBOUNCE_MS + 50);
    });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(putSpecs()[0]).toEqual(editA);
    expect(latestStatus).toBe('saving');

    // A newer edit lands while the older PUT is still in flight. The hook
    // must NOT start a second PUT concurrently; it queues the newest snapshot.
    await updateHarness(root, props(editB));
    await act(async () => {
      jest.advanceTimersByTime(FLOW_AUTOSAVE_DEBOUNCE_MS + 50);
    });
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    // Let the older request settle last (after the newer edit exists). The
    // queued newest snapshot must be sent next, so commit order stays A then
    // B and the database ends up holding B, not A.
    await act(async () => {
      first.resolve(draftResponse('sem-A', 'lay-A'));
      await first.promise;
    });
    // Flushing the chained save requires one more microtask turn.
    await act(async () => {});
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(putSpecs()[1]).toEqual(editB);

    await act(async () => {
      second.resolve(draftResponse('sem-B', 'lay-B'));
      await second.promise;
    });
    await act(async () => {});

    expect(fetchMock()).toHaveBeenCalledTimes(2);
    // Commit order stays A then B: the stale response for A never surfaces
    // as the final saved state; the newest snapshot is what ends up
    // persisted and reported saved.
    expect(saved.length).toBeGreaterThanOrEqual(1);
    expect(saved[saved.length - 1].spec).toEqual(editB);
    expect(saved[saved.length - 1]).toMatchObject({ semanticHash: 'sem-B', layoutHash: 'lay-B' });
    expect(latestError).toBeNull();
    expect(latestStatus).toBe('idle');
  });

  it('ignores a late response after a flow switch without discarding the new flow work', async () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);
    const saved: FlowAutosaveSaved[] = [];
    const gate = deferred<Response>();
    fetchMock().mockReturnValueOnce(gate.promise);

    const editFlow1 = withSourceTopic(doc.spec, 'devices/flow-1');
    const root = await renderHarness({
      flowId: 'flow-1',
      spec: editFlow1,
      layout: doc.layout,
      baseline,
      onSaved: (entry) => {
        saved.push(entry);
      },
    });
    await act(async () => {
      jest.advanceTimersByTime(FLOW_AUTOSAVE_DEBOUNCE_MS + 50);
    });
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    // Switch flows while the first PUT is still in flight.
    await updateHarness(root, {
      flowId: 'flow-2',
      spec: withSourceTopic(doc.spec, 'devices/flow-2'),
      layout: doc.layout,
      baseline,
      onSaved: (entry) => {
        saved.push(entry);
      },
    });

    // The stale flow-1 response must not invoke the callback for the new flow.
    await act(async () => {
      gate.resolve(draftResponse('sem-old', 'lay-old'));
      await gate.promise;
    });
    await act(async () => {});
    expect(saved).toHaveLength(0);
  });
});
