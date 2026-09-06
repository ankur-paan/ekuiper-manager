/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReactFlow } from '@xyflow/react';

import { flowNodeTypes } from '@/components/flow-studio/canvas/flow-canvas';
import type { FlowNodeData } from '@/components/flow-studio/nodes/flow-node';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import {
  FLOW_NODE_ACCENT_TOKENS,
  FLOW_NODE_ICON_TOKENS,
  isFlowNodeAccentToken,
  isFlowNodeIconToken,
  resolveFlowNodeSubtitle,
} from '@/lib/flows/registry/node-definition';

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

function buildNodeData(overrides: Partial<FlowNodeData> & { name: string }): FlowNodeData {
  return {
    inputs: [],
    outputs: [],
    ...overrides,
  };
}

async function renderNode(data: FlowNodeData): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      React.createElement(ReactFlow, {
        edges: [],
        nodes: [
          {
            id: 'node-1',
            type: 'flowNode',
            position: { x: 0, y: 0 },
            data,
          },
        ],
        nodeTypes: flowNodeTypes,
      }),
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

describe('flow node presentation tokens (FS-0148)', () => {
  it('exposes fixed icon and accent token sets that stay JSON-serialisable', () => {
    expect(FLOW_NODE_ICON_TOKENS.length).toBeGreaterThan(0);
    expect(FLOW_NODE_ACCENT_TOKENS.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(FLOW_NODE_ICON_TOKENS))).toEqual([
      ...FLOW_NODE_ICON_TOKENS,
    ]);
    expect(JSON.parse(JSON.stringify(FLOW_NODE_ACCENT_TOKENS))).toEqual([
      ...FLOW_NODE_ACCENT_TOKENS,
    ]);
  });

  it('accepts only named tokens and rejects URLs, SVG payloads, and raw colours', () => {
    for (const token of FLOW_NODE_ICON_TOKENS) {
      expect(isFlowNodeIconToken(token)).toBe(true);
    }
    expect(isFlowNodeIconToken('https://example.com/icon.svg')).toBe(false);
    expect(isFlowNodeIconToken('<svg></svg>')).toBe(false);
    expect(isFlowNodeIconToken('not-a-token')).toBe(false);
    expect(isFlowNodeIconToken(undefined)).toBe(false);

    for (const token of FLOW_NODE_ACCENT_TOKENS) {
      expect(isFlowNodeAccentToken(token)).toBe(true);
    }
    expect(isFlowNodeAccentToken('#0f3460')).toBe(false);
    expect(isFlowNodeAccentToken('rgb(255,0,0)')).toBe(false);
    expect(isFlowNodeAccentToken('not-a-token')).toBe(false);
    expect(isFlowNodeAccentToken(undefined)).toBe(false);
  });

  it('resolves subtitles only from scalar config values', () => {
    expect(resolveFlowNodeSubtitle({ topic: 'devices/demo' }, 'topic')).toBe(
      'devices/demo',
    );
    expect(resolveFlowNodeSubtitle({ length: 10 }, 'length')).toBe('10');
    expect(resolveFlowNodeSubtitle({ enabled: false }, 'enabled')).toBe('false');
    expect(resolveFlowNodeSubtitle({}, 'topic')).toBeUndefined();
    expect(resolveFlowNodeSubtitle(undefined, 'topic')).toBeUndefined();
    expect(resolveFlowNodeSubtitle({ topic: 'x' }, undefined)).toBeUndefined();
    expect(resolveFlowNodeSubtitle({ topic: '   ' }, 'topic')).toBeUndefined();
    expect(resolveFlowNodeSubtitle({ topic: { nested: true } }, 'topic')).toBeUndefined();
    expect(resolveFlowNodeSubtitle({ topic: ['a'] }, 'topic')).toBeUndefined();
    expect(resolveFlowNodeSubtitle({ topic: null }, 'topic')).toBeUndefined();
  });

  it('declares only known tokens on built-ins and points subtitleKey at a real property', () => {
    const registry = createBuiltinNodeRegistry();
    expect(registry.list().length).toBeGreaterThan(0);
    for (const definition of registry.list()) {
      if (definition.icon !== undefined) {
        expect(isFlowNodeIconToken(definition.icon)).toBe(true);
      }
      if (definition.accent !== undefined) {
        expect(isFlowNodeAccentToken(definition.accent)).toBe(true);
      }
      if (definition.subtitleKey !== undefined) {
        expect(
          definition.properties.some(
            (property) => property.key === definition.subtitleKey,
          ),
        ).toBe(true);
      }
      // Presentation metadata never carries remote assets or raw colours.
      expect(JSON.stringify(definition)).not.toContain('http://');
      expect(JSON.stringify(definition)).not.toContain('https://');
      expect(JSON.stringify(definition)).not.toContain('<svg');
    }
  });
});

describe('flow node canvas subtitle and marks (FS-0148)', () => {
  it('shows the referenced property value as a truncated, non-wrapping subtitle', async () => {
    const container = await renderNode(
      buildNodeData({
        name: 'MQTT In',
        config: { topic: 'devices/demo' },
        definition: {
          displayName: 'MQTT Source',
          category: 'source',
          inputs: [],
          outputs: [{ id: 'out', kind: 'stream' }],
          icon: 'mqtt',
          accent: 'source',
          subtitleKey: 'topic',
        },
      }),
    );

    const subtitle = container.querySelector('[data-testid="flow-node-subtitle"]');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent).toBe('devices/demo');
    // Truncated, not wrapped: Tailwind truncate (ellipsis + no wrap).
    expect(subtitle?.className).toContain('truncate');
    expect(subtitle?.className).not.toContain('text-wrap');
    expect(subtitle?.className).not.toContain('whitespace-normal');
    expect(subtitle?.className).not.toContain('break-words');
  });

  it('falls back to the category mark for an unknown icon token without throwing', async () => {
    // renderNode commits through ReactFlow; reaching the assertions below
    // proves an unknown token renders without throwing.
    const container = await renderNode(
      buildNodeData({
        name: 'Mystery',
        config: {},
        definition: {
          displayName: 'Mystery',
          category: 'transform',
          inputs: [],
          outputs: [],
          icon: 'not-a-token',
          accent: 'neutral',
        },
      }),
    );

    const mark = container.querySelector('[data-testid="flow-node-category"]');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('T');
    expect(mark?.getAttribute('data-icon')).toBeNull();
  });

  it('renders a known icon token instead of the category letter', async () => {
    const container = await renderNode(
      buildNodeData({
        name: 'MQTT In',
        config: { topic: 'devices/demo' },
        definition: {
          displayName: 'MQTT Source',
          category: 'source',
          inputs: [],
          outputs: [{ id: 'out', kind: 'stream' }],
          icon: 'mqtt',
          accent: 'source',
          subtitleKey: 'topic',
        },
      }),
    );

    const mark = container.querySelector('[data-testid="flow-node-category"]');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('data-icon')).toBe('mqtt');
    expect(mark?.textContent).toBe('M');
  });

  it('falls back to the neutral accent for an unknown accent token', async () => {
    const container = await renderNode(
      buildNodeData({
        name: 'Odd',
        config: {},
        definition: {
          displayName: 'Odd',
          category: 'source',
          inputs: [],
          outputs: [],
          accent: '#0f3460',
        },
      }),
    );

    expect(
      container.querySelector('[data-testid="flow-node"]')?.getAttribute('data-accent'),
    ).toBe('neutral');
  });

  it('renders no subtitle when the referenced property value is missing', async () => {
    const container = await renderNode(
      buildNodeData({
        name: 'MQTT In',
        config: {},
        definition: {
          displayName: 'MQTT Source',
          category: 'source',
          inputs: [],
          outputs: [{ id: 'out', kind: 'stream' }],
          icon: 'mqtt',
          accent: 'source',
          subtitleKey: 'topic',
        },
      }),
    );

    expect(container.querySelector('[data-testid="flow-node-subtitle"]')).toBeNull();
  });

  it('loads no remote asset for the canvas node', async () => {
    const container = await renderNode(
      buildNodeData({
        name: 'MQTT In',
        config: { topic: 'devices/demo' },
        definition: {
          displayName: 'MQTT Source',
          category: 'source',
          inputs: [],
          outputs: [{ id: 'out', kind: 'stream' }],
          icon: 'mqtt',
          accent: 'source',
          subtitleKey: 'topic',
        },
      }),
    );

    // Scoped to the canvas node itself: the surrounding ReactFlow shell
    // renders its own attribution footer, which is outside this ticket.
    const node = container.querySelector('[data-testid="flow-node"]');
    expect(node).not.toBeNull();
    expect(node?.querySelector('img')).toBeNull();
    expect(node?.innerHTML).not.toContain('http://');
    expect(node?.innerHTML).not.toContain('https://');
    expect(node?.innerHTML).not.toContain('<svg');
  });
});
