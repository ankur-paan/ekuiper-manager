/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { FlowCanvas } from '../flow-canvas';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if ((globalThis as Record<string, unknown>)['structuredClone'] === undefined) {
  (globalThis as Record<string, unknown>)['structuredClone'] = (value: unknown) =>
    JSON.parse(JSON.stringify(value));
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = (() =>
    ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

const mounted: { container: HTMLElement; root: Root }[] = [];

afterEach(async () => {
  await act(async () => {
    for (const entry of mounted.splice(0)) {
      entry.root.unmount();
      entry.container.remove();
    }
  });
});

function baseNodes() {
  return [
    { id: 'node-a', position: { x: 0, y: 0 }, data: {} },
    { id: 'node-b', position: { x: 350, y: 0 }, data: {} },
  ];
}

function baseEdges() {
  return [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }];
}

async function renderCanvas(
  props: Partial<React.ComponentProps<typeof FlowCanvas>> & {
    onSelectionChange?: (selection: { nodeIds: string[]; edgeIds: string[] }) => void;
  },
): Promise<{ container: HTMLElement; root: Root }> {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      <FlowCanvas
        nodes={baseNodes()}
        edges={baseEdges()}
        selectedNodeIds={[]}
        selectedEdgeIds={[]}
        {...props}
      />,
    );
  });
  return { container, root };
}

function getNodeEl(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(
    `.react-flow__node[data-id="${id}"]`,
  ) as HTMLElement | null;
}

async function clickNode(container: HTMLElement, id: string): Promise<void> {
  const nodeEl = getNodeEl(container, id);
  expect(nodeEl).not.toBeNull();
  await act(async () => {
    // Genuine user path: a click on the rendered node element. Only `click`
    // is dispatched (not mousedown/mouseup) because ReactFlow's drag
    // handling on pointer-down requires browser pointer capture that jsdom
    // does not implement; selection itself is driven by the click.
    nodeEl!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
}

describe('P1: canvas selection round trip', () => {
  it('forwards a click-driven node selection to onSelectionChange', async () => {
    const onSelectionChange = jest.fn();
    const { container } = await renderCanvas({ onSelectionChange });

    // Sanity: nothing selected before the click (real DOM behaviour: no
    // node carries ReactFlow's `selected` class).
    expect(
      container.querySelectorAll('.react-flow__node.selected').length,
    ).toBe(0);

    await clickNode(container, 'node-a');

    // Real behaviour: the click reaches the parent as a selection report.
    expect(onSelectionChange).toHaveBeenCalled();
    const lastCall =
      onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1]![0] as {
        nodeIds: string[];
        edgeIds: string[];
      };
    expect(lastCall.nodeIds).toContain('node-a');
  });

  it('reflects a store-driven selectedNodeIds change on the nodes', async () => {
    const onSelectionChange = jest.fn();
    const { container, root } = await renderCanvas({ onSelectionChange });

    await act(async () => {
      root.render(
        <FlowCanvas
          nodes={baseNodes()}
          edges={baseEdges()}
          selectedNodeIds={['node-b']}
          selectedEdgeIds={[]}
          onSelectionChange={onSelectionChange}
        />,
      );
    });

    // Real behaviour: the store-driven id appears selected in the DOM
    // (ReactFlow's `selected` class, the same signal production CSS and the
    // P1 probe assert on alongside aria-selected in a live browser).
    const selected = getNodeEl(container, 'node-b');
    expect(selected?.classList.contains('selected')).toBe(true);
    expect(getNodeEl(container, 'node-a')?.classList.contains('selected')).toBe(
      false,
    );

    // And clearing the store selection clears the DOM (undo/delete path).
    await act(async () => {
      root.render(
        <FlowCanvas
          nodes={baseNodes()}
          edges={baseEdges()}
          selectedNodeIds={[]}
          selectedEdgeIds={[]}
          onSelectionChange={onSelectionChange}
        />,
      );
    });
    expect(getNodeEl(container, 'node-b')?.classList.contains('selected')).toBe(
      false,
    );
  });

  it('does not echo a redundant store selection back to the parent', async () => {
    const onSelectionChange = jest.fn();
    const { root } = await renderCanvas({
      selectedNodeIds: ['node-a'],
      onSelectionChange,
    });

    await act(async () => {
      root.render(
        <FlowCanvas
          nodes={baseNodes()}
          edges={baseEdges()}
          selectedNodeIds={['node-a']}
          selectedEdgeIds={[]}
          onSelectionChange={onSelectionChange}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Same id set re-rendered must not re-trigger the parent (no loop).
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
