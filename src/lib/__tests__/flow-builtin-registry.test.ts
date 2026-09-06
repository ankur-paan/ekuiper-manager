import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
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

describe('createBuiltinNodeRegistry', () => {
  it('lists the memory, MQTT, REST, log, filter, pick, and func definitions', () => {
    const registry = createBuiltinNodeRegistry();

    expect(registry.has('memory-source', 1)).toBe(true);
    expect(registry.has('memory-sink', 1)).toBe(true);
    expect(registry.has('mqtt-source', 1)).toBe(true);
    expect(registry.has('mqtt-sink', 1)).toBe(true);
    expect(registry.has('rest-sink', 1)).toBe(true);
    expect(registry.has('log-sink', 1)).toBe(true);
    expect(registry.has('filter', 1)).toBe(true);
    expect(registry.has('pick', 1)).toBe(true);
    expect(registry.has('func', 1)).toBe(true);
    expect(registry.list().map((item) => `${item.type}@${item.version}`).sort()).toEqual([
      'filter@1',
      'func@1',
      'log-sink@1',
      'memory-sink@1',
      'memory-source@1',
      'mqtt-sink@1',
      'mqtt-source@1',
      'pick@1',
      'rest-sink@1',
    ]);
  });

  it('uses source/sink port directions with stream kinds', () => {
    const registry = createBuiltinNodeRegistry();
    const source = registry.get('memory-source', 1);
    const sink = registry.get('memory-sink', 1);

    expect(source?.category).toBe('source');
    expect(source?.inputs).toEqual([]);
    expect(source?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    expect(sink?.category).toBe('sink');
    expect(sink?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(sink?.outputs).toEqual([]);
  });

  it('requires topic on both definitions and carries no compiler mapping', () => {
    const registry = createBuiltinNodeRegistry();
    const source = registry.get('memory-source', 1);
    const sink = registry.get('memory-sink', 1);

    for (const definition of [source, sink]) {
      const topic = definition?.properties.find((property) => property.key === 'topic');
      expect(topic?.required).toBe(true);
      expect(topic?.type).toBe('string');
      expect(definition?.runtimeKind).toBeUndefined();
      expect(definition?.operation).toBeUndefined();
    }
  });

  it('uses source/sink port directions with stream kinds for MQTT definitions', () => {
    const registry = createBuiltinNodeRegistry();
    const source = registry.get('mqtt-source', 1);
    const sink = registry.get('mqtt-sink', 1);

    expect(source?.category).toBe('source');
    expect(source?.inputs).toEqual([]);
    expect(source?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    expect(sink?.category).toBe('sink');
    expect(sink?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(sink?.outputs).toEqual([]);
  });

  it('requires topic, exposes a shared-connection reference, and carries no compiler mapping or secret literal', () => {
    const registry = createBuiltinNodeRegistry();
    const source = registry.get('mqtt-source', 1);
    const sink = registry.get('mqtt-sink', 1);

    for (const definition of [source, sink]) {
      const topic = definition?.properties.find((property) => property.key === 'topic');
      expect(topic?.required).toBe(true);
      expect(topic?.type).toBe('string');

      const connection = definition?.properties.find(
        (property) => property.key === 'connectionSelector',
      );
      expect(connection?.type).toBe('string');
      expect(connection?.required).not.toBe(true);

      for (const property of definition?.properties ?? []) {
        expect(property.key).not.toMatch(/password|passwd|secret|token|private.?key|certification/i);
      }

      expect(definition?.runtimeKind).toBeUndefined();
      expect(definition?.operation).toBeUndefined();
    }
  });

  it('registers MQTT definitions deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.list()).toEqual(second.list());
    expect(first.get('mqtt-source', 1)).toEqual(second.get('mqtt-source', 1));
    expect(first.get('mqtt-sink', 1)).toEqual(second.get('mqtt-sink', 1));
  });

  it('uses stream input and no runtime output for REST and log sinks', () => {
    const registry = createBuiltinNodeRegistry();
    const restSink = registry.get('rest-sink', 1);
    const logSink = registry.get('log-sink', 1);

    expect(restSink?.category).toBe('sink');
    expect(restSink?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(restSink?.outputs).toEqual([]);

    expect(logSink?.category).toBe('sink');
    expect(logSink?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(logSink?.outputs).toEqual([]);
  });

  it('requires url on the REST sink, exposes method/body/header concepts, and leaves the log sink field-free', () => {
    const registry = createBuiltinNodeRegistry();
    const restSink = registry.get('rest-sink', 1);
    const logSink = registry.get('log-sink', 1);

    const url = restSink?.properties.find((property) => property.key === 'url');
    expect(url?.required).toBe(true);
    expect(url?.type).toBe('string');

    const method = restSink?.properties.find((property) => property.key === 'method');
    expect(method?.type).toBe('select');
    expect(method?.required).not.toBe(true);

    const bodyType = restSink?.properties.find((property) => property.key === 'bodyType');
    expect(bodyType?.type).toBe('select');

    const headers = restSink?.properties.find((property) => property.key === 'headers');
    expect(headers?.type).toBe('json');

    expect(logSink?.properties).toEqual([]);

    for (const definition of [restSink, logSink]) {
      expect(definition?.runtimeKind).toBeUndefined();
      expect(definition?.operation).toBeUndefined();
    }
  });

  it('registers REST and log definitions deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.get('rest-sink', 1)).toEqual(second.get('rest-sink', 1));
    expect(first.get('log-sink', 1)).toEqual(second.get('log-sink', 1));
  });

  it('registers filter and pick transforms with stream in/out and required expressions', () => {
    const registry = createBuiltinNodeRegistry();
    const filter = registry.get('filter', 1);
    const pick = registry.get('pick', 1);

    expect(filter?.category).toBe('transform');
    expect(filter?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(filter?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    const expression = filter?.properties.find((property) => property.key === 'expression');
    expect(expression?.required).toBe(true);
    expect(expression?.type).toBe('expression');

    expect(pick?.category).toBe('transform');
    expect(pick?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(pick?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    const fields = pick?.properties.find((property) => property.key === 'fields');
    expect(fields?.required).toBe(true);
    expect(fields?.type).toBe('expression');

    for (const definition of [filter, pick]) {
      expect(definition?.runtimeKind).toBeUndefined();
      expect(definition?.operation).toBeUndefined();
    }
  });

  it('validates the required filter expression via the generic property validator', () => {
    const registry = createBuiltinNodeRegistry();

    const missing = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-filter-1',
          type: 'filter',
          typeVersion: 1,
          name: 'Filter',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingDiagnostics = validateFlowRequiredProperties(missing, registry).filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(missingDiagnostics).toHaveLength(1);
    expect(missingDiagnostics[0]?.nodeId).toBe('node-filter-1');
    expect(missingDiagnostics[0]?.propertyPath).toBe('config.expression');

    const present = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-filter-1',
          type: 'filter',
          typeVersion: 1,
          name: 'Filter',
          config: { expression: 'temperature > 30' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(present, registry)).toEqual([]);
  });

  it('registers filter and pick definitions deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.get('filter', 1)).toEqual(second.get('filter', 1));
    expect(first.get('pick', 1)).toEqual(second.get('pick', 1));
  });

  it('registers the func transform with stream in/out and a required expression', () => {
    const registry = createBuiltinNodeRegistry();
    const func = registry.get('func', 1);

    expect(func?.displayName).toBe('Function');
    expect(func?.category).toBe('transform');
    expect(func?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(func?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    const expression = func?.properties.find((property) => property.key === 'expression');
    expect(expression?.required).toBe(true);
    expect(expression?.type).toBe('expression');

    expect(func?.runtimeKind).toBeUndefined();
    expect(func?.operation).toBeUndefined();
  });

  it('validates the required func expression via the generic property validator', () => {
    const registry = createBuiltinNodeRegistry();

    const missing = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-func-1',
          type: 'func',
          typeVersion: 1,
          name: 'Function',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingDiagnostics = validateFlowRequiredProperties(missing, registry).filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(missingDiagnostics).toHaveLength(1);
    expect(missingDiagnostics[0]?.nodeId).toBe('node-func-1');
    expect(missingDiagnostics[0]?.propertyPath).toBe('config.expression');

    const present = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-func-1',
          type: 'func',
          typeVersion: 1,
          name: 'Function',
          config: { expression: 'concat(firstname, lastname)' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(present, registry)).toEqual([]);
  });

  it('registers the func definition deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.get('func', 1)).toEqual(second.get('func', 1));
  });

  it('returns an isolated registry on each call', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first).not.toBe(second);
    expect(first.list()).toHaveLength(9);
    expect(second.list()).toHaveLength(9);

    first.register(buildDefinition({ type: 'test-custom', version: 1 }));

    expect(first.has('test-custom', 1)).toBe(true);
    expect(first.list()).toHaveLength(10);
    expect(second.list()).toHaveLength(9);
    expect(second.has('test-custom', 1)).toBe(false);
    expect(second.get('test-custom', 1)).toBeUndefined();
  });
});
