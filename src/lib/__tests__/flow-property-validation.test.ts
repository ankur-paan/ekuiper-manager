import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import { validateFlowRequiredProperties } from '@/lib/flows/validation/property-validation';

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
  registry.register(
    buildDefinition({
      type: 'test-source',
      version: 1,
      properties: [{ key: 'topic', label: 'Topic', type: 'string', required: true }],
    }),
  );
  registry.register(
    buildDefinition({
      type: 'test-sink',
      version: 1,
      properties: [],
    }),
  );
  return registry;
}

describe('validateFlowRequiredProperties', () => {
  it('passes when every required property is present', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 'devices/+/data' },
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

    expect(validateFlowRequiredProperties(doc, registry)).toEqual([]);
  });

  it('reports a missing key with nodeId and propertyPath', () => {
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
      ],
      edges: [],
    });

    const diagnostics = validateFlowRequiredProperties(doc, registry);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.nodeId).toBe('node-source-1');
    expect(matches[0]?.propertyPath).toBe('config.topic');
    expect(matches[0]?.severity).toBe('error');
  });

  it('treats null as missing', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: null },
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowRequiredProperties(doc, registry);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('FLOW_REQUIRED_PROPERTY_MISSING');
    expect(diagnostics[0]?.nodeId).toBe('node-source-1');
    expect(diagnostics[0]?.propertyPath).toBe('config.topic');
  });

  it('treats undefined as missing', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: undefined },
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowRequiredProperties(doc, registry);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('FLOW_REQUIRED_PROPERTY_MISSING');
  });

  it('treats empty string as missing', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: '' },
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowRequiredProperties(doc, registry);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('FLOW_REQUIRED_PROPERTY_MISSING');
    expect(diagnostics[0]?.nodeId).toBe('node-source-1');
    expect(diagnostics[0]?.propertyPath).toBe('config.topic');
  });

  it('accepts false and 0 as valid values', () => {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-source',
        version: 1,
        properties: [
          { key: 'enabled', label: 'Enabled', type: 'boolean', required: true },
          { key: 'retries', label: 'Retries', type: 'number', required: true },
        ],
      }),
    );
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { enabled: false, retries: 0 },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(doc, registry)).toEqual([]);
  });

  it('does not flag optional properties', () => {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-source',
        version: 1,
        properties: [
          { key: 'nickname', label: 'Nickname', type: 'string' },
        ],
      }),
    );
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: {},
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(doc, registry)).toEqual([]);
  });

  it('skips nodes with unknown definitions', () => {
    const registry = buildRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
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

    expect(validateFlowRequiredProperties(doc, registry)).toEqual([]);
  });

  it('performs no type coercion or select-option validation', () => {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-source',
        version: 1,
        properties: [
          {
            key: 'mode',
            label: 'Mode',
            type: 'select',
            required: true,
            options: [{ label: 'Fast', value: 'fast' }],
          },
        ],
      }),
    );
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: { mode: 'not-a-listed-option' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(doc, registry)).toEqual([]);
  });
});
