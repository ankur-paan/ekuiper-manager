import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import {
  validateFlowEdgePorts,
  validateFlowSourceSinkPresence,
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

describe('validateFlowSourceSinkPresence', () => {
  function buildCategorizedRegistry(): NodeRegistry {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({ type: 'test-source', version: 1, category: 'source' }),
    );
    registry.register(
      buildDefinition({ type: 'test-sink', version: 1, category: 'sink' }),
    );
    registry.register(
      buildDefinition({ type: 'test-filter', version: 1, category: 'transform' }),
    );
    return registry;
  }

  it('passes when the flow has one source and one sink', () => {
    const registry = buildCategorizedRegistry();
    const doc = createMinimalFlowDocument();

    expect(validateFlowSourceSinkPresence(doc, registry)).toEqual([]);
  });

  it('passes for multi-source and multi-sink flows', () => {
    const registry = buildCategorizedRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source 1',
        }),
        createFlowNode({
          id: 'node-source-2',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source 2',
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink 1',
        }),
        createFlowNode({
          id: 'node-sink-2',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink 2',
        }),
      ],
      edges: [],
    });

    expect(validateFlowSourceSinkPresence(doc, registry)).toEqual([]);
  });

  it('reports FLOW_NO_SOURCE when no known source is present', () => {
    const registry = buildCategorizedRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-filter-1',
          type: 'test-filter',
          typeVersion: 1,
          name: 'Filter',
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink',
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowSourceSinkPresence(doc, registry);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_NO_SOURCE',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.severity).toBe('error');
    expect(diagnostics.some((item) => item.code === 'FLOW_NO_SINK')).toBe(
      false,
    );
  });

  it('reports FLOW_NO_SINK when no known sink is present', () => {
    const registry = buildCategorizedRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
        }),
        createFlowNode({
          id: 'node-filter-1',
          type: 'test-filter',
          typeVersion: 1,
          name: 'Filter',
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowSourceSinkPresence(doc, registry);
    const matches = diagnostics.filter((item) => item.code === 'FLOW_NO_SINK');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.severity).toBe('error');
    expect(diagnostics.some((item) => item.code === 'FLOW_NO_SOURCE')).toBe(
      false,
    );
  });

  it('reports both FLOW_NO_SOURCE and FLOW_NO_SINK independently when neither is present', () => {
    const registry = buildCategorizedRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-filter-1',
          type: 'test-filter',
          typeVersion: 1,
          name: 'Filter',
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowSourceSinkPresence(doc, registry);

    expect(diagnostics.map((item) => item.code).sort()).toEqual([
      'FLOW_NO_SINK',
      'FLOW_NO_SOURCE',
    ]);
  });

  it('does not count unknown node types toward source or sink', () => {
    const registry = buildCategorizedRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-mystery-source',
          type: 'not-registered',
          typeVersion: 1,
          name: 'Mystery source',
        }),
        createFlowNode({
          id: 'node-mystery-sink',
          type: 'also-not-registered',
          typeVersion: 1,
          name: 'Mystery sink',
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowSourceSinkPresence(doc, registry);

    expect(diagnostics.map((item) => item.code).sort()).toEqual([
      'FLOW_NO_SINK',
      'FLOW_NO_SOURCE',
    ]);
  });
});
