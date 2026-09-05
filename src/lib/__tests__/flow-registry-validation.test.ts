import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import {
  validateFlowEdgePorts,
  validateFlowUnknownNodeTypes,
} from '@/lib/flows/validation/registry-validation';

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
    ...overrides,
  };
}

function buildRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.register(buildDefinition({ type: 'test-source', version: 1 }));
  registry.register(buildDefinition({ type: 'test-sink', version: 1 }));
  return registry;
}

describe('validateFlowUnknownNodeTypes', () => {
  it('passes when every node resolves to its exact registered version', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument();

    expect(validateFlowUnknownNodeTypes(doc, registry)).toEqual([]);
  });

  it('fails for a completely unknown node type and includes nodeId', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
        }),
        createFlowNode({
          id: 'node-mystery-1',
          type: 'not-registered',
          typeVersion: 1,
          name: 'Mystery',
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowUnknownNodeTypes(doc, registry);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_UNKNOWN_NODE_TYPE',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.nodeId).toBe('node-mystery-1');
    expect(matches[0]?.severity).toBe('error');
  });

  it('fails for a known type with the wrong version without falling back', () => {
    const registry = new NodeRegistry();
    registry.register(buildDefinition({ type: 'filter', version: 2 }));
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-filter-1',
          type: 'filter',
          typeVersion: 1,
          name: 'Filter',
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowUnknownNodeTypes(doc, registry);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_UNKNOWN_NODE_TYPE',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.nodeId).toBe('node-filter-1');
  });

  it('reports one diagnostic per unknown node', () => {
    const registry = new NodeRegistry();
    registry.register(buildDefinition({ type: 'filter', version: 1 }));
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-a',
          type: 'unknown-a',
          typeVersion: 1,
          name: 'A',
        }),
        createFlowNode({
          id: 'node-b',
          type: 'unknown-b',
          typeVersion: 3,
          name: 'B',
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowUnknownNodeTypes(doc, registry);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((item) => item.nodeId).sort()).toEqual([
      'node-a',
      'node-b',
    ]);
  });
});

describe('validateFlowEdgePorts', () => {
  it('passes when every edge port ID exists on its node definition', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument();

    expect(validateFlowEdgePorts(doc, registry)).toEqual([]);
  });

  it('reports FLOW_PORT_SOURCE_MISSING for an unknown source port', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'no-such-output',
          targetNodeId: 'node-sink-1',
          targetPortId: 'in',
        }),
      ],
    });

    const diagnostics = validateFlowEdgePorts(doc, registry);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_PORT_SOURCE_MISSING',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.edgeId).toBe('edge-1');
    expect(matches[0]?.nodeId).toBe('node-source-1');
    expect(matches[0]?.severity).toBe('error');
  });

  it('reports FLOW_PORT_TARGET_MISSING for an unknown target port', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sink-1',
          targetPortId: 'no-such-input',
        }),
      ],
    });

    const diagnostics = validateFlowEdgePorts(doc, registry);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_PORT_TARGET_MISSING',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.edgeId).toBe('edge-1');
    expect(matches[0]?.nodeId).toBe('node-sink-1');
    expect(matches[0]?.severity).toBe('error');
  });

  it('reports both sides when source and target ports are missing', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'no-such-output',
          targetNodeId: 'node-sink-1',
          targetPortId: 'no-such-input',
        }),
      ],
    });

    const diagnostics = validateFlowEdgePorts(doc, registry);

    expect(diagnostics.map((item) => item.code).sort()).toEqual([
      'FLOW_PORT_SOURCE_MISSING',
      'FLOW_PORT_TARGET_MISSING',
    ]);
  });

  it('does not report port errors for an unknown node definition', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'not-registered',
          typeVersion: 1,
          name: 'Source',
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink',
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'anything',
          targetNodeId: 'node-sink-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(validateFlowEdgePorts(doc, registry)).toEqual([]);
  });

  it('passes when resolved port kinds are compatible', () => {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-source',
        version: 1,
        outputs: [{ id: 'out', kind: 'stream' }],
      }),
    );
    registry.register(
      buildDefinition({
        type: 'test-sink',
        version: 1,
        inputs: [{ id: 'in', kind: 'stream' }],
      }),
    );
    const doc = createMinimalFlowDocument();

    expect(validateFlowEdgePorts(doc, registry)).toEqual([]);
  });

  it('reports FLOW_PORT_INCOMPATIBLE for an incompatible port kind pair', () => {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-source',
        version: 1,
        outputs: [{ id: 'out', kind: 'stream' }],
      }),
    );
    registry.register(
      buildDefinition({
        type: 'test-sink',
        version: 1,
        inputs: [{ id: 'in', kind: 'table' }],
      }),
    );
    const doc = createMinimalFlowDocument();

    const diagnostics = validateFlowEdgePorts(doc, registry);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
    );

    expect(matches).toHaveLength(1);
    expect(diagnostics).toHaveLength(1);
    expect(matches[0]?.edgeId).toBe('edge-1');
    expect(matches[0]?.severity).toBe('error');
    expect(matches[0]?.message).toContain('stream');
    expect(matches[0]?.message).toContain('table');
  });
});
