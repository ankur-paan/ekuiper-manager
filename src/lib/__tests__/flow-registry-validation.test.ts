import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import { validateFlowUnknownNodeTypes } from '@/lib/flows/validation/registry-validation';

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
