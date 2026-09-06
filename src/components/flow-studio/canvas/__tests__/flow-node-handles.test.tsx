/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReactFlow } from '@xyflow/react';

import { flowNodeTypes } from '../flow-canvas';
import {
  toReactFlow,
  type FlowCanvasDefinitionResolver,
} from '../to-react-flow';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import {
  FLOW_DOCUMENT_VERSION,
  type FlowDocument,
} from '@/lib/flows/model/flow-document';

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

function buildDefectDocument(): FlowDocument {
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: { id: 'flow-r1', name: 'R1 regression' },
    spec: {
      nodes: [
        {
          id: 'node-memory-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Memory',
          config: { topic: 'devices/demo' },
        },
        {
          id: 'node-unknown-1',
          type: 'no-such-node',
          typeVersion: 99,
          name: 'Mystery',
          config: {},
        },
      ],
      edges: [],
    },
    layout: {
      nodes: {
        'node-memory-1': { x: 0, y: 0 },
        'node-unknown-1': { x: 320, y: 0 },
      },
    },
  };
}

/**
 * Production resolver mirroring the page/view boundary: exact
 * (type, typeVersion) lookup projected to presentation fields only.
 */
function createPageResolver(): FlowCanvasDefinitionResolver {
  const registry = createBuiltinNodeRegistry();
  return (type: string, version: number) => {
    const definition = registry.get(type, version);
    if (!definition) return undefined;
    // Same projection the page applies: only presentation fields travel
    // to the renderer, never the whole definition or runtime metadata.
    return {
      displayName: definition.displayName,
      category: definition.category,
      inputs: definition.inputs.map((port) => ({ ...port })),
      outputs: definition.outputs.map((port) => ({ ...port })),
    };
  };
}

const mounted: { container: HTMLElement; root: Root }[] = [];

async function renderCanvas(nodes: Parameters<typeof ReactFlow>[0]['nodes']): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      <ReactFlow nodes={nodes} edges={[]} nodeTypes={flowNodeTypes} />,
    );
  });
  return container;
}

afterEach(async () => {
  await act(async () => {
    for (const entry of mounted.splice(0)) {
      entry.root.unmount();
      entry.container.remove();
    }
  });
});

describe('R1: built-in canvas nodes render connection handles', () => {
  it('attaches only presentation fields and no runtime/metrics metadata', () => {
    const view = toReactFlow(buildDefectDocument(), createPageResolver());
    const memory = view.nodes.find((node) => node.id === 'node-memory-1');

    expect(memory).toBeDefined();
    const data = memory?.data as Record<string, unknown>;
    // Presentation is attached so the renderer can draw handles.
    expect(data['definition']).toMatchObject({
      displayName: 'Memory Source',
      category: 'source',
    });
    const definition = data['definition'] as {
      inputs: Array<{ id: string }>;
      outputs: Array<{ id: string }>;
    };
    expect(definition.inputs).toEqual([]);
    expect(definition.outputs.map((port) => port.id)).toEqual(['out']);

    // Only presentation fields travel to the renderer: no whole
    // definition, no runtime/compiler metadata, no metrics.
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('runtimeKind');
    expect(serialized).not.toContain('operation');
    expect(serialized).not.toContain('properties');
    expect(serialized).not.toContain('metrics');
    expect(data).not.toHaveProperty('metrics');
    expect(data).not.toHaveProperty('runtime');
    expect(data).not.toHaveProperty('operation');
    expect(data).not.toHaveProperty('properties');
    expect(Object.keys(data['definition'] as object).sort()).toEqual([
      'category',
      'displayName',
      'inputs',
      'outputs',
    ]);
  });

  it('renders the Memory Source output handle through the production renderer', async () => {
    const view = toReactFlow(buildDefectDocument(), createPageResolver());
    const container = await renderCanvas(view.nodes);

    const outputHandle = container.querySelector(
      '[data-testid="flow-node-output-out"]',
    );
    expect(outputHandle).not.toBeNull();
  });

  it('still renders an unknown node type safely as unsupported', async () => {
    const view = toReactFlow(buildDefectDocument(), createPageResolver());
    const unknown = view.nodes.find((node) => node.id === 'node-unknown-1');
    expect(unknown?.data['unsupported']).toBe(true);

    const container = await renderCanvas(view.nodes);

    const nodes = container.querySelectorAll('[data-testid="flow-node"]');
    // Both the built-in and the unknown node render without crashing.
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    const unsupportedMarks = container.querySelectorAll(
      '[data-testid="flow-node-unsupported"]',
    );
    expect(unsupportedMarks.length).toBeGreaterThanOrEqual(1);
  });
});
