import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import { validateFlowEdgePorts } from '@/lib/flows/validation/registry-validation';
import { validateFlowJoinTopology } from '@/lib/flows/validation/join-validation';

const tableSourceDefinition: FlowNodeDefinition = {
  type: 'test-table-source',
  version: 1,
  displayName: 'Test Table Source',
  description: 'Test-only lookup table source.',
  category: 'source',
  inputs: [],
  outputs: [{ id: 'out', label: 'Table', kind: 'table' }],
  properties: [],
};

function buildRegistryWithTable(): NodeRegistry {
  const registry = createBuiltinNodeRegistry();
  registry.register(tableSourceDefinition);
  return registry;
}

function joinConfig() {
  return {
    from: 'stream-left',
    joinName: 'stream-right',
    condition: 'left.deviceId = right.deviceId',
  };
}

function buildValidJoinDocument() {
  return createMinimalFlowDocument({
    nodes: [
      createFlowNode({
        id: 'node-source-1',
        type: 'memory-source',
        typeVersion: 1,
        name: 'Source',
        config: { topic: 'shared-events' },
      }),
      createFlowNode({
        id: 'node-window-1',
        type: 'window',
        typeVersion: 1,
        name: 'Window',
        config: { length: 10, timeUnit: 's' },
      }),
      createFlowNode({
        id: 'node-join-1',
        type: 'join',
        typeVersion: 1,
        name: 'Join',
        config: joinConfig(),
      }),
      createFlowNode({
        id: 'node-log-1',
        type: 'log-sink',
        typeVersion: 1,
        name: 'Log',
        config: {},
      }),
    ],
    edges: [
      createFlowEdge({
        id: 'edge-source-window',
        sourceNodeId: 'node-source-1',
        sourcePortId: 'out',
        targetNodeId: 'node-window-1',
        targetPortId: 'in',
      }),
      createFlowEdge({
        id: 'edge-window-join',
        sourceNodeId: 'node-window-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'in',
      }),
      createFlowEdge({
        id: 'edge-join-log',
        sourceNodeId: 'node-join-1',
        sourcePortId: 'out',
        targetNodeId: 'node-log-1',
        targetPortId: 'in',
      }),
    ],
  });
}

describe('join builtin definition', () => {
  it('registers join v1 with a single collection input and one stream output', () => {
    const registry = createBuiltinNodeRegistry();
    const join = registry.get('join', 1);

    expect(join?.displayName).toBe('Join');
    expect(join?.category).toBe('streaming');
    expect(join?.inputs).toEqual([
      { id: 'in', label: 'Collection', kind: 'collection' },
    ]);
    expect(join?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    const from = join?.properties.find((property) => property.key === 'from');
    expect(from?.required).toBe(true);
    expect(from?.type).toBe('string');
    const joinName = join?.properties.find(
      (property) => property.key === 'joinName',
    );
    expect(joinName?.required).toBe(true);
    expect(joinName?.type).toBe('string');
    const condition = join?.properties.find(
      (property) => property.key === 'condition',
    );
    expect(condition?.required).toBe(true);
    expect(condition?.type).toBe('expression');
  });

  it('carries no SQL join compiler mapping', () => {
    const registry = createBuiltinNodeRegistry();
    const join = registry.get('join', 1);

    expect(join?.runtimeKind).toBeUndefined();
    expect(join?.operation).toBeUndefined();
  });

  it('registers the join definition deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.get('join', 1)).toEqual(second.get('join', 1));
  });
});

describe('validateFlowJoinTopology', () => {
  it('rejects a join fed directly by a stream (engine requires a shared window)', () => {
    const registry = createBuiltinNodeRegistry();
    const document = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 'raw-events' },
        }),
        createFlowNode({
          id: 'node-join-1',
          type: 'join',
          typeVersion: 1,
          name: 'Join',
          config: joinConfig(),
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-source-join',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'in',
        }),
      ],
    });

    const diagnostics = validateFlowJoinTopology(document, registry).filter(
      (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.edgeId).toBe('edge-source-join');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('windowed collection');
  });

  it('accepts a join fed by a shared window', () => {
    const registry = createBuiltinNodeRegistry();
    const document = buildValidJoinDocument();

    expect(validateFlowJoinTopology(document, registry)).toEqual([]);
    expect(validateFlowEdgePorts(document, registry)).toEqual([]);
  });

  it('reports a missing input with an explicit port identity', () => {
    const registry = createBuiltinNodeRegistry();
    const document = buildValidJoinDocument();
    document.spec.edges = document.spec.edges.filter(
      (edge) => edge.targetNodeId !== 'node-join-1',
    );

    const diagnostics = validateFlowJoinTopology(document, registry).filter(
      (item) => item.code === 'FLOW_PORT_TARGET_MISSING',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('"in"');
  });

  it('rejects a lookup table fed directly into the join', () => {
    const registry = buildRegistryWithTable();
    const document = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-table-1',
          type: 'test-table-source',
          typeVersion: 1,
          name: 'Lookup Table',
          config: {},
        }),
        createFlowNode({
          id: 'node-join-1',
          type: 'join',
          typeVersion: 1,
          name: 'Join',
          config: joinConfig(),
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-table-join',
          sourceNodeId: 'node-table-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'in',
        }),
      ],
    });

    const diagnostics = validateFlowJoinTopology(document, registry).filter(
      (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.edgeId).toBe('edge-table-join');
  });

  it('skips unresolvable upstreams without throwing', () => {
    const registry = createBuiltinNodeRegistry();
    const document = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-mystery-1',
          type: 'not-registered',
          typeVersion: 1,
          name: 'Mystery',
          config: {},
        }),
        createFlowNode({
          id: 'node-join-1',
          type: 'join',
          typeVersion: 1,
          name: 'Join',
          config: joinConfig(),
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-mystery-join',
          sourceNodeId: 'node-mystery-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(validateFlowJoinTopology(document, registry)).toEqual([]);
  });

  it('ignores documents without join nodes', () => {
    const registry = createBuiltinNodeRegistry();

    expect(
      validateFlowJoinTopology(createMinimalFlowDocument(), registry),
    ).toEqual([]);
  });
});
