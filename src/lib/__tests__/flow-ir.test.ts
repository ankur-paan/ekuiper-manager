import { buildFlowIr } from '@/lib/flows/ir/build-flow-ir';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';

function buildDefinition(
  overrides: Partial<FlowNodeDefinition> & { type: string; version: number },
): FlowNodeDefinition {
  return {
    displayName: `${overrides.type} v${overrides.version}`,
    description: `Test definition for ${overrides.type}`,
    category: 'transform',
    inputs: [{ id: 'in', kind: 'stream' }],
    outputs: [{ id: 'out', kind: 'stream' }],
    properties: [],
    runtimeKind: 'operator',
    operation: `${overrides.type}.v${overrides.version}`,
    ...overrides,
  };
}

function buildRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.register(
    buildDefinition({
      type: 'test-source',
      version: 1,
      category: 'source',
      inputs: [],
      outputs: [{ id: 'out', kind: 'stream' }],
      runtimeKind: 'source',
      operation: 'mqtt_source',
    }),
  );
  registry.register(
    buildDefinition({
      type: 'test-sink',
      version: 1,
      category: 'sink',
      inputs: [{ id: 'in', kind: 'stream' }],
      outputs: [],
      runtimeKind: 'sink',
      operation: 'log_sink',
    }),
  );
  return registry;
}

describe('buildFlowIr', () => {
  it('builds IR nodes from registry runtime metadata with config copied verbatim', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 'devices/+/data', qos: 1, nested: { a: [1, 2] } },
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink',
          config: {},
        }),
      ],
    });

    const result = buildFlowIr(doc, registry);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir).toEqual({
      nodes: [
        {
          id: 'node-sink-1',
          kind: 'sink',
          operation: 'log_sink',
          config: {},
        },
        {
          id: 'node-source-1',
          kind: 'source',
          operation: 'mqtt_source',
          config: { topic: 'devices/+/data', qos: 1, nested: { a: [1, 2] } },
        },
      ],
      edges: [
        {
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sink-1',
          targetPortId: 'in',
        },
      ],
    });
  });

  it('produces deterministic output for normalized input regardless of spec order', () => {
    const registry = buildRegistry();
    const base = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 't' },
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink',
          config: {},
        }),
      ],
    });
    const shuffled = createMinimalFlowDocument({
      nodes: [...base.spec.nodes].reverse(),
      edges: [...base.spec.edges].reverse(),
    });

    const first = buildFlowIr(base, registry);
    const second = buildFlowIr(shuffled, registry);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.ir).toEqual(first.ir);
    expect(JSON.stringify(second.ir)).toBe(JSON.stringify(first.ir));
  });

  it('excludes layout and node display names from IR output', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'My Display Name',
          config: {},
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Another Display Name',
          config: {},
        }),
      ],
    });

    const result = buildFlowIr(doc, registry);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected successful IR result');
    }
    const serialized = JSON.stringify(result.ir);
    expect(serialized).not.toContain('My Display Name');
    expect(serialized).not.toContain('Another Display Name');
    expect(serialized).not.toContain('viewport');
    expect(serialized).not.toContain('edge-1');
    for (const node of result.ir.nodes) {
      expect(Object.keys(node).sort()).toEqual(
        ['config', 'id', 'kind', 'operation'].sort(),
      );
    }
    for (const edge of result.ir.edges) {
      expect(Object.keys(edge).sort()).toEqual(
        ['sourceNodeId', 'sourcePortId', 'targetNodeId', 'targetPortId'].sort(),
      );
    }
  });

  it('ignores layout-only differences when building IR', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument();
    const moved = createMinimalFlowDocument({
      layout: {
        nodes: {
          'node-source-1': { x: 999, y: 999 },
          'node-sink-1': { x: -50, y: 400 },
        },
        viewport: { x: 10, y: 20, zoom: 2 },
      },
    });

    const first = buildFlowIr(doc, registry);
    const second = buildFlowIr(moved, registry);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.ir).toEqual(first.ir);
  });

  it('fails without partial IR when a node definition is missing', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: {},
        }),
        createFlowNode({
          id: 'node-mystery-1',
          type: 'not-registered',
          typeVersion: 1,
          name: 'Mystery',
          config: {},
        }),
      ],
      edges: [],
    });

    const result = buildFlowIr(doc, registry);

    expect(result.ok).toBe(false);
    expect(result.ir).toBeUndefined();
    const matches = result.diagnostics.filter(
      (item) => item.code === 'FLOW_UNKNOWN_NODE_TYPE',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.nodeId).toBe('node-mystery-1');
    expect(matches[0]?.severity).toBe('error');
  });

  it('fails when a known type is requested with the wrong version', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 2,
          name: 'Source',
          config: {},
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink',
          config: {},
        }),
      ],
      edges: [],
    });

    const result = buildFlowIr(doc, registry);

    expect(result.ok).toBe(false);
    expect(result.ir).toBeUndefined();
    expect(
      result.diagnostics.filter(
        (item) => item.code === 'FLOW_UNKNOWN_NODE_TYPE',
      ),
    ).toHaveLength(1);
    expect(result.diagnostics[0]?.nodeId).toBe('node-source-1');
  });

  it('does not mutate the input document', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 't' },
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink',
          config: {},
        }),
      ],
    });
    const snapshot = JSON.stringify(doc);

    const result = buildFlowIr(doc, registry);

    expect(result.ok).toBe(true);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it('isolates IR config from later input mutation', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { nested: { value: 'original' } },
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink',
          config: {},
        }),
      ],
    });

    const result = buildFlowIr(doc, registry);

    expect(result.ok).toBe(true);
    (doc.spec.nodes[0]?.config.nested as { value: string }).value = 'mutated';
    expect(result.ir?.nodes[1]?.config).toEqual({
      nested: { value: 'original' },
    });
  });

  it('reports one diagnostic per unknown node without creating partial operations', () => {
    const registry = new NodeRegistry();
    registry.register(buildDefinition({ type: 'filter', version: 1 }));
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-a',
          type: 'unknown-a',
          typeVersion: 1,
          name: 'A',
          config: {},
        }),
        createFlowNode({
          id: 'node-b',
          type: 'unknown-b',
          typeVersion: 3,
          name: 'B',
          config: {},
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-a',
          sourcePortId: 'out',
          targetNodeId: 'node-b',
          targetPortId: 'in',
        }),
      ],
    });

    const result = buildFlowIr(doc, registry);

    expect(result.ok).toBe(false);
    expect(result.ir).toBeUndefined();
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.map((item) => item.nodeId).sort()).toEqual([
      'node-a',
      'node-b',
    ]);
  });
});
