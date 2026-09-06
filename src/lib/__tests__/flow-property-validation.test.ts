import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import {
  FLOW_INVALID_PROPERTY_VALUE,
  validateFlowPropertyTypes,
  validateFlowRequiredProperties,
} from '@/lib/flows/validation/property-validation';

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

describe('validateFlowRequiredProperties with showWhen (FS-0156)', () => {
  function buildVisibilityRegistry(): NodeRegistry {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-window',
        version: 1,
        properties: [
          {
            key: 'windowType',
            label: 'Window type',
            type: 'string',
            required: true,
          },
          {
            key: 'size',
            label: 'Size',
            type: 'number',
            required: true,
            showWhen: { property: 'windowType', equals: 'tumbling' },
          },
        ],
      }),
    );
    return registry;
  }

  function buildWindowDoc(config: Record<string, unknown>) {
    return createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'n1',
          type: 'test-window',
          typeVersion: 1,
          name: 'Window',
          config,
        }),
      ],
      edges: [],
    });
  }

  it('produces no diagnostic for a hidden required property', () => {
    const registry = buildVisibilityRegistry();
    const doc = buildWindowDoc({ windowType: 'sliding' });

    expect(validateFlowRequiredProperties(doc, registry)).toEqual([]);
  });

  it('still reports a visible required property that is missing', () => {
    const registry = buildVisibilityRegistry();
    const doc = buildWindowDoc({ windowType: 'tumbling' });

    const diagnostics = validateFlowRequiredProperties(doc, registry);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.nodeId).toBe('n1');
    expect(matches[0]?.propertyPath).toBe('config.size');
  });

  it('passes when a visible required property is present', () => {
    const registry = buildVisibilityRegistry();
    const doc = buildWindowDoc({ windowType: 'tumbling', size: 10 });

    expect(validateFlowRequiredProperties(doc, registry)).toEqual([]);
  });

  it('stays required when showWhen is malformed (fail-open)', () => {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-window',
        version: 1,
        properties: [
          {
            key: 'size',
            label: 'Size',
            type: 'number',
            required: true,
            showWhen: { property: 'windowType' },
          },
        ],
      }),
    );
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'n1',
          type: 'test-window',
          typeVersion: 1,
          name: 'Window',
          config: { windowType: 'sliding' },
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowRequiredProperties(doc, registry);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('FLOW_REQUIRED_PROPERTY_MISSING');
    expect(diagnostics[0]?.propertyPath).toBe('config.size');
  });
});

describe('validateFlowPropertyTypes (FS-0062)', () => {
  function buildTypedRegistry(): NodeRegistry {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-node',
        version: 1,
        properties: [
          { key: 'count', label: 'Count', type: 'number' },
          { key: 'enabled', label: 'Enabled', type: 'boolean' },
          {
            key: 'mode',
            label: 'Mode',
            type: 'select',
            options: [
              { label: 'Fast', value: 'fast' },
              { label: 'Slow', value: 'slow' },
              { label: 'Zero', value: 0 },
              { label: 'Off', value: false },
            ],
          },
          { key: 'headers', label: 'Headers', type: 'json' },
          { key: 'filter', label: 'Filter', type: 'expression' },
          { key: 'nickname', label: 'Nickname', type: 'string' },
        ],
      }),
    );
    return registry;
  }

  function buildDoc(config: Record<string, unknown>) {
    return createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-1',
          type: 'test-node',
          typeVersion: 1,
          name: 'Node',
          config,
        }),
      ],
      edges: [],
    });
  }

  it('passes when every typed value matches its definition', () => {
    const registry = buildTypedRegistry();
    const doc = buildDoc({
      count: 3,
      enabled: true,
      mode: 'fast',
      headers: { Authorization: 'Bearer x' },
      filter: 'temperature > 30',
      nickname: 'anything goes',
    });

    expect(validateFlowPropertyTypes(doc, registry)).toEqual([]);
  });

  it('accepts false and 0 as valid typed values', () => {
    const registry = buildTypedRegistry();
    const doc = buildDoc({ count: 0, enabled: false, mode: 0 });

    expect(validateFlowPropertyTypes(doc, registry)).toEqual([]);
  });

  it('accepts false select option via strict match', () => {
    const registry = buildTypedRegistry();
    const doc = buildDoc({ mode: false });

    expect(validateFlowPropertyTypes(doc, registry)).toEqual([]);
  });

  it('flags a numeric string for a number property without coercing', () => {
    const registry = buildTypedRegistry();
    const doc = buildDoc({ count: '3' });

    const diagnostics = validateFlowPropertyTypes(doc, registry);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe(FLOW_INVALID_PROPERTY_VALUE);
    expect(diagnostics[0]?.code).toBe('FLOW_INVALID_PROPERTY_VALUE');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.nodeId).toBe('node-1');
    expect(diagnostics[0]?.propertyPath).toBe('config.count');
  });

  it('flags NaN and Infinity for number properties', () => {
    const registry = buildTypedRegistry();

    expect(
      validateFlowPropertyTypes(buildDoc({ count: NaN }), registry),
    ).toHaveLength(1);
    expect(
      validateFlowPropertyTypes(buildDoc({ count: Infinity }), registry),
    ).toHaveLength(1);
  });

  it('flags a non-boolean for a boolean property', () => {
    const registry = buildTypedRegistry();
    const doc = buildDoc({ enabled: 'true' });

    const diagnostics = validateFlowPropertyTypes(doc, registry);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe(FLOW_INVALID_PROPERTY_VALUE);
    expect(diagnostics[0]?.nodeId).toBe('node-1');
    expect(diagnostics[0]?.propertyPath).toBe('config.enabled');
  });

  it('flags an unknown select value loaded from an existing document', () => {
    const registry = buildTypedRegistry();
    const doc = buildDoc({ mode: 'not-a-listed-option' });

    const diagnostics = validateFlowPropertyTypes(doc, registry);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe(FLOW_INVALID_PROPERTY_VALUE);
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.nodeId).toBe('node-1');
    expect(diagnostics[0]?.propertyPath).toBe('config.mode');
  });

  it('flags raw text and primitives for json properties', () => {
    const registry = buildTypedRegistry();

    expect(
      validateFlowPropertyTypes(buildDoc({ headers: '{"a": 1' }), registry),
    ).toHaveLength(1);
    expect(
      validateFlowPropertyTypes(buildDoc({ headers: 42 }), registry),
    ).toHaveLength(1);
    expect(
      validateFlowPropertyTypes(buildDoc({ headers: 'text' }), registry),
    ).toHaveLength(1);
  });

  it('accepts objects and arrays for json properties', () => {
    const registry = buildTypedRegistry();

    expect(
      validateFlowPropertyTypes(buildDoc({ headers: { a: 1 } }), registry),
    ).toEqual([]);
    expect(
      validateFlowPropertyTypes(buildDoc({ headers: [{ a: 1 }] }), registry),
    ).toEqual([]);
  });

  it('skips absent values and leaves them to required validation', () => {
    const registry = buildTypedRegistry();
    const doc = buildDoc({});

    expect(validateFlowPropertyTypes(doc, registry)).toEqual([]);
  });

  it('does not validate string, expression, or secret-ref types', () => {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'test-node',
        version: 1,
        properties: [
          { key: 'nickname', label: 'Nickname', type: 'string' },
          { key: 'filter', label: 'Filter', type: 'expression' },
          { key: 'token', label: 'Token', type: 'secret-ref' },
        ],
      }),
    );
    const doc = buildDoc({
      nickname: 42,
      filter: 42,
      token: 42,
    });

    expect(validateFlowPropertyTypes(doc, registry)).toEqual([]);
  });

  it('skips nodes with unknown definitions', () => {
    const registry = buildTypedRegistry();
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-mystery-1',
          type: 'not-registered',
          typeVersion: 1,
          name: 'Mystery',
          config: { count: 'not-a-number' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowPropertyTypes(doc, registry)).toEqual([]);
  });

  it('reports every mismatch in one pass without mutating input', () => {
    const registry = buildTypedRegistry();
    const doc = buildDoc({ count: 'x', enabled: 'y', mode: 'z' });
    const snapshot = JSON.stringify(doc);

    const diagnostics = validateFlowPropertyTypes(doc, registry);

    expect(diagnostics).toHaveLength(3);
    expect(
      diagnostics.every(
        (item) => item.code === FLOW_INVALID_PROPERTY_VALUE,
      ),
    ).toBe(true);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
