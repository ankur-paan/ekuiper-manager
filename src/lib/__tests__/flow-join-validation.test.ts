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

function buildValidJoinDocument() {
  return createMinimalFlowDocument({
    nodes: [
      createFlowNode({
        id: 'node-left-1',
        type: 'memory-source',
        typeVersion: 1,
        name: 'Left Stream',
        config: { topic: 'left-events' },
      }),
      createFlowNode({
        id: 'node-right-1',
        type: 'memory-source',
        typeVersion: 1,
        name: 'Right Stream',
        config: { topic: 'right-events' },
      }),
      createFlowNode({
        id: 'node-join-1',
        type: 'join',
        typeVersion: 1,
        name: 'Join',
        config: { condition: 'left.deviceId = right.deviceId' },
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
        id: 'edge-left-join',
        sourceNodeId: 'node-left-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'left',
      }),
      createFlowEdge({
        id: 'edge-right-join',
        sourceNodeId: 'node-right-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'right',
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
  it('registers join v1 with stable left/right inputs and one stream output', () => {
    const registry = createBuiltinNodeRegistry();
    const join = registry.get('join', 1);

    expect(join?.displayName).toBe('Join');
    expect(join?.category).toBe('streaming');
    expect(join?.inputs).toEqual([
      { id: 'left', label: 'Left', kind: 'stream' },
      { id: 'right', label: 'Right', kind: 'any' },
    ]);
    expect(join?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

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
  it('rejects a stream+stream join topology (engine requires windowed/table on one side)', () => {
    const registry = createBuiltinNodeRegistry();
    const document = buildValidJoinDocument();

    const diagnostics = validateFlowJoinTopology(document, registry).filter(
      (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.edgeId).toBeUndefined();
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('two plain streams');
    // The generic port check still passes (stream->stream, stream->any);
    // the rejection comes from the join cross-port topology rule.
    expect(validateFlowEdgePorts(document, registry)).toEqual([]);
  });

  it('accepts a windowed collection on the right join input', () => {
    const registry = createBuiltinNodeRegistry();
    const document = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-left-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Left Stream',
          config: { topic: 'left-events' },
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
          config: { condition: 'left.deviceId = right.deviceId' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-left-join',
          sourceNodeId: 'node-left-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'left',
        }),
        createFlowEdge({
          id: 'edge-window-join',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'right',
        }),
      ],
    });

    expect(validateFlowJoinTopology(document, registry)).toEqual([]);
    expect(validateFlowEdgePorts(document, registry)).toEqual([]);
  });

  it('reports a missing right input with an explicit port identity', () => {
    const registry = createBuiltinNodeRegistry();
    const document = buildValidJoinDocument();
    document.spec.edges = document.spec.edges.filter(
      (edge) => edge.targetPortId !== 'right',
    );

    const diagnostics = validateFlowJoinTopology(document, registry).filter(
      (item) => item.code === 'FLOW_PORT_TARGET_MISSING',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('"right"');
  });

  it('reports both inputs when neither is connected', () => {
    const registry = createBuiltinNodeRegistry();
    const document = buildValidJoinDocument();
    document.spec.edges = document.spec.edges.filter(
      (edge) =>
        edge.targetNodeId !== 'node-join-1' ||
        (edge.targetPortId !== 'left' && edge.targetPortId !== 'right'),
    );

    const diagnostics = validateFlowJoinTopology(document, registry).filter(
      (item) => item.code === 'FLOW_PORT_TARGET_MISSING',
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((item) => item.nodeId)).toEqual([
      'node-join-1',
      'node-join-1',
    ]);
    expect(diagnostics[0]?.message).toContain('"left"');
    expect(diagnostics[1]?.message).toContain('"right"');
  });

  it('rejects a windowed collection fed directly into the join', () => {
    const registry = createBuiltinNodeRegistry();
    const document = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-window-1',
          type: 'window',
          typeVersion: 1,
          name: 'Window',
          config: { length: 10, timeUnit: 's' },
        }),
        createFlowNode({
          id: 'node-right-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Right Stream',
          config: { topic: 'right-events' },
        }),
        createFlowNode({
          id: 'node-join-1',
          type: 'join',
          typeVersion: 1,
          name: 'Join',
          config: { condition: 'left.deviceId = right.deviceId' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-window-join',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'left',
        }),
        createFlowEdge({
          id: 'edge-right-join',
          sourceNodeId: 'node-right-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'right',
        }),
      ],
    });

    const diagnostics = validateFlowJoinTopology(document, registry).filter(
      (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.edgeId).toBe('edge-window-join');
    expect(diagnostics[0]?.severity).toBe('error');
  });

  it('allows a lookup table on the right input but not on the left', () => {
    const registry = buildRegistryWithTable();

    const rightTable = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-left-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Left Stream',
          config: { topic: 'left-events' },
        }),
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
          config: { condition: 'left.deviceId = right.deviceId' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-left-join',
          sourceNodeId: 'node-left-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'left',
        }),
        createFlowEdge({
          id: 'edge-table-join',
          sourceNodeId: 'node-table-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'right',
        }),
      ],
    });

    expect(validateFlowJoinTopology(rightTable, registry)).toEqual([]);

    const leftTable = createMinimalFlowDocument({
      nodes: rightTable.spec.nodes,
      edges: [
        createFlowEdge({
          id: 'edge-table-join',
          sourceNodeId: 'node-table-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'left',
        }),
        createFlowEdge({
          id: 'edge-left-join',
          sourceNodeId: 'node-left-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'right',
        }),
      ],
    });

    const diagnostics = validateFlowJoinTopology(leftTable, registry).filter(
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
          id: 'node-right-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Right Stream',
          config: { topic: 'right-events' },
        }),
        createFlowNode({
          id: 'node-join-1',
          type: 'join',
          typeVersion: 1,
          name: 'Join',
          config: { condition: 'left.deviceId = right.deviceId' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-mystery-join',
          sourceNodeId: 'node-mystery-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'left',
        }),
        createFlowEdge({
          id: 'edge-right-join',
          sourceNodeId: 'node-right-1',
          sourcePortId: 'out',
          targetNodeId: 'node-join-1',
          targetPortId: 'right',
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
