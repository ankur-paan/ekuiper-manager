/**
 * @jest-environment jsdom
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
import {
  buildFlowDirtyBaseline,
  type FlowDirtyBaseline,
} from '@/lib/flows/model/flow-dirty-state';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface HarnessProps {
  spec: FlowSpec;
  layout: FlowLayout;
  baseline: FlowDirtyBaseline | null;
  disabled?: boolean;
  onSaved?: (saved: FlowAutosaveSaved) => void;
}

let latestStatus: FlowAutosaveStatus = 'idle';
let latestError: string | null = null;

function Harness({ spec, layout, baseline, disabled, onSaved }: HarnessProps) {
  const result = useFlowAutosave({
    flowId: 'flow-1',
    spec,
    layout,
    baseline,
    disabled,
    onSaved,
  });
  latestStatus = result.status;
  latestError = result.error;
  return <div data-testid="autosave-harness" data-status={result.status} />;
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

async function advanceTimers(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

function fetchMock(): jest.Mock {
  return global.fetch as jest.Mock;
}

function draftSaveResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: () => Promise.resolve(body),
  } as Response;
}

function lastPutBody(): { spec: FlowSpec; layout: FlowLayout } {
  const calls = fetchMock().mock.calls;
  const init = calls[calls.length - 1][1] as RequestInit;
  if (typeof init?.body !== 'string') {
    throw new Error('Expected the draft PUT to send a JSON string body');
  }
  const parsed: unknown = JSON.parse(init.body);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected the draft PUT body to be a JSON object');
  }
  return parsed as { spec: FlowSpec; layout: FlowLayout };
}

function withSourceTopic(spec: FlowSpec, topic: string): FlowSpec {
  return {
    ...spec,
    nodes: spec.nodes.map((node) =>
      node.id === 'node-source-1' ? { ...node, config: { topic } } : node,
    ),
  };
}

beforeEach(() => {
  latestStatus = 'idle';
  latestError = null;
  jest.useFakeTimers();
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('fetch is not mocked for this request')),
  );
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

describe('useFlowAutosave', () => {
  it('debounces for 750ms and coalesces rapid config edits into one draft PUT', async () => {
    expect(FLOW_AUTOSAVE_DEBOUNCE_MS).toBe(750);

    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);
    const saved: FlowAutosaveSaved[] = [];
    const onSaved = (entry: FlowAutosaveSaved): void => {
      saved.push(entry);
    };
    fetchMock().mockResolvedValue(
      draftSaveResponse({
        draft: { flowId: 'flow-1', semanticHash: 'sem-1', layoutHash: 'lay-1' },
      }),
    );

    const editA = withSourceTopic(doc.spec, 'devices/a');
    const editB = withSourceTopic(doc.spec, 'devices/b');
    const root = await renderHarness({ spec: editA, layout: doc.layout, baseline, onSaved });
    expect(latestStatus).toBe('pending');

    await advanceTimers(500);
    expect(fetchMock()).not.toHaveBeenCalled();

    // A second rapid edit resets the debounce window instead of saving twice.
    await updateHarness(root, { spec: editB, layout: doc.layout, baseline, onSaved });
    await advanceTimers(500);
    expect(fetchMock()).not.toHaveBeenCalled();

    await advanceTimers(300);
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/flows/flow-1/draft');
    expect(init.method).toBe('PUT');
    const body = lastPutBody();
    expect(Object.keys(body).sort()).toEqual(['layout', 'spec']);
    expect(body.spec).toEqual(editB);
    expect(body.layout).toEqual(doc.layout);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ semanticHash: 'sem-1', layoutHash: 'lay-1' });
    expect(saved[0].spec).toEqual(editB);

    // The saved payload is not re-sent, and advancing the caller baseline to
    // the saved snapshots clears the pending state like the page does.
    await advanceTimers(5000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(latestStatus).toBe('idle');
    await updateHarness(root, {
      spec: editB,
      layout: doc.layout,
      baseline: buildFlowDirtyBaseline(saved[0].spec, saved[0].layout),
      onSaved,
    });
    expect(latestStatus).toBe('idle');
    await advanceTimers(5000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('autosaves a layout-only move with the spec unchanged', async () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);
    const saved: FlowAutosaveSaved[] = [];
    fetchMock().mockResolvedValue(
      draftSaveResponse({
        draft: { flowId: 'flow-1', semanticHash: 'sem-2', layoutHash: 'lay-2' },
      }),
    );

    const movedLayout: FlowLayout = {
      ...doc.layout,
      nodes: {
        ...doc.layout.nodes,
        'node-source-1': { x: 240, y: 180 },
      },
    };
    await renderHarness({
      spec: doc.spec,
      layout: movedLayout,
      baseline,
      onSaved: (entry) => {
        saved.push(entry);
      },
    });
    expect(latestStatus).toBe('pending');

    await advanceTimers(FLOW_AUTOSAVE_DEBOUNCE_MS + 50);
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    const body = lastPutBody();
    expect(body.spec).toEqual(doc.spec);
    expect(body.layout.nodes['node-source-1']).toEqual({ x: 240, y: 180 });
    expect(saved).toHaveLength(1);
    expect(saved[0].layout).toEqual(movedLayout);
  });

  it('does not save a clean document or while disabled', async () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);

    const root = await renderHarness({ spec: doc.spec, layout: doc.layout, baseline });
    expect(latestStatus).toBe('idle');
    await advanceTimers(2000);
    expect(fetchMock()).not.toHaveBeenCalled();

    const dirtySpec = withSourceTopic(doc.spec, 'devices/changed');
    await updateHarness(root, { spec: dirtySpec, layout: doc.layout, baseline, disabled: true });
    expect(latestStatus).toBe('idle');
    await advanceTimers(2000);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('preserves dirty state and exposes the error when the draft PUT fails', async () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);
    const saved: FlowAutosaveSaved[] = [];
    const onSaved = (entry: FlowAutosaveSaved): void => {
      saved.push(entry);
    };
    fetchMock().mockResolvedValueOnce(
      draftSaveResponse(
        { error: { code: 'DRAFT_SAVE_FAILED', message: 'draft store unavailable' } },
        { ok: false, status: 500 },
      ),
    );

    const dirtySpec = withSourceTopic(doc.spec, 'devices/changed');
    const root = await renderHarness({ spec: dirtySpec, layout: doc.layout, baseline, onSaved });
    await advanceTimers(FLOW_AUTOSAVE_DEBOUNCE_MS + 50);
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    expect(latestStatus).toBe('error');
    expect(latestError).toContain('draft store unavailable');
    expect(saved).toHaveLength(0);

    // A further edit retries and recovers to idle without losing the payload.
    fetchMock().mockResolvedValue(
      draftSaveResponse({
        draft: { flowId: 'flow-1', semanticHash: 'sem-3', layoutHash: 'lay-3' },
      }),
    );
    const retrySpec = withSourceTopic(doc.spec, 'devices/retry');
    await updateHarness(root, { spec: retrySpec, layout: doc.layout, baseline, onSaved });
    // The failure stays exposed while the retry is debounced; it clears
    // only when the next attempt starts and succeeds.
    expect(latestStatus).toBe('error');
    expect(latestError).toContain('draft store unavailable');
    await advanceTimers(FLOW_AUTOSAVE_DEBOUNCE_MS + 50);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(lastPutBody().spec).toEqual(retrySpec);
    expect(saved).toHaveLength(1);
    expect(latestStatus).toBe('idle');
    expect(latestError).toBeNull();
  });

  it('sends draft saves only to the Manager draft API and never to eKuiper', async () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);
    fetchMock().mockResolvedValue(
      draftSaveResponse({
        draft: { flowId: 'flow-1', semanticHash: 'sem-4', layoutHash: 'lay-4' },
      }),
    );

    await renderHarness({
      spec: withSourceTopic(doc.spec, 'devices/changed'),
      layout: doc.layout,
      baseline,
    });
    await advanceTimers(FLOW_AUTOSAVE_DEBOUNCE_MS + 50);

    const calls = fetchMock().mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const url = String(call[0]);
      expect(url).toBe('/api/flows/flow-1/draft');
      expect(url).not.toMatch(/ekuiper/i);
      const init = call[1] as RequestInit;
      expect(init.method).toBe('PUT');
    }
  });
});
