import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import { validateFlowRequiredProperties } from '@/lib/flows/validation/property-validation';
import { validateFlowEdgePorts } from '@/lib/flows/validation/registry-validation';

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

function assertValidCompilerMapping(definition: FlowNodeDefinition | undefined): void {
  if (definition?.runtimeKind !== undefined) {
    expect(['source', 'operator', 'sink']).toContain(definition.runtimeKind);
  }
  if (definition?.operation !== undefined) {
    expect(typeof definition.operation).toBe('string');
    expect(definition.operation.length).toBeGreaterThan(0);
  }
}

describe('createBuiltinNodeRegistry', () => {
  it('lists the memory, MQTT, REST, log, filter, pick, func, window, aggregate, group-by, switch, sort, stream-source, and table-source definitions', () => {
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
    expect(registry.has('window', 1)).toBe(true);
    expect(registry.has('aggregate', 1)).toBe(true);
    expect(registry.has('group-by', 1)).toBe(true);
    expect(registry.has('switch', 1)).toBe(true);
    expect(registry.has('sort', 1)).toBe(true);
    expect(registry.has('stream-source', 1)).toBe(true);
    expect(registry.has('table-source', 1)).toBe(true);
    expect(registry.list().map((item) => `${item.type}@${item.version}`).sort()).toEqual([
      'aggregate@1',
      'filter@1',
      'func@1',
      'group-by@1',
      'join@1',
      'log-sink@1',
      'memory-sink@1',
      'memory-source@1',
      'mqtt-sink@1',
      'mqtt-source@1',
      'pick@1',
      'rest-sink@1',
      'sort@1',
      'stream-source@1',
      'switch@1',
      'table-source@1',
      'window@1',
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

  it('requires topic on both definitions and carries the memory compiler mapping', () => {
    const registry = createBuiltinNodeRegistry();
    const source = registry.get('memory-source', 1);
    const sink = registry.get('memory-sink', 1);

    expect(source?.runtimeKind).toBe('source');
    expect(source?.operation).toBe('memory');
    expect(sink?.runtimeKind).toBe('sink');
    expect(sink?.operation).toBe('memory');

    for (const definition of [source, sink]) {
      const topic = definition?.properties.find((property) => property.key === 'topic');
      expect(topic?.required).toBe(true);
      expect(topic?.type).toBe('string');
      assertValidCompilerMapping(definition);
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

  it('requires topic, exposes a shared-connection reference, and carries no secret literal', () => {
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

      assertValidCompilerMapping(definition);
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

  it('requires url on the REST sink, exposes method/body/header concepts, and exposes omitIfEmpty on the log sink', () => {
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

    // AC-D003: every sink now exposes eKuiper's common `omitIfEmpty`, so the log sink is
    // no longer field-free. It carries that one property and nothing else.
    expect(logSink?.properties.map((property) => property.key)).toEqual(['omitIfEmpty']);
    const omitIfEmpty = logSink?.properties.find((property) => property.key === 'omitIfEmpty');
    expect(omitIfEmpty?.type).toBe('boolean');
    expect(omitIfEmpty?.required).not.toBe(true);

    for (const definition of [restSink, logSink]) {
      assertValidCompilerMapping(definition);
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
      assertValidCompilerMapping(definition);
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

    assertValidCompilerMapping(func);
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

  it('registers the window definition with stream input and collection output', () => {
    const registry = createBuiltinNodeRegistry();
    const window = registry.get('window', 1);

    expect(window?.displayName).toBe('Window');
    expect(window?.category).toBe('streaming');
    expect(window?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(window?.outputs).toEqual([{ id: 'out', label: 'Collection', kind: 'collection' }]);

    const length = window?.properties.find((property) => property.key === 'length');
    expect(length?.required).toBe(true);
    expect(length?.type).toBe('number');

    const timeUnit = window?.properties.find((property) => property.key === 'timeUnit');
    expect(timeUnit?.required).toBe(true);

    assertValidCompilerMapping(window);
  });

  it('validates the required window settings via the generic property validator', () => {
    const registry = createBuiltinNodeRegistry();

    const missing = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-window-1',
          type: 'window',
          typeVersion: 1,
          name: 'Window',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingDiagnostics = validateFlowRequiredProperties(missing, registry).filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(missingDiagnostics.map((item) => item.propertyPath).sort()).toEqual([
      'config.length',
      'config.timeUnit',
    ]);
    for (const diagnostic of missingDiagnostics) {
      expect(diagnostic.nodeId).toBe('node-window-1');
    }

    const present = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-window-1',
          type: 'window',
          typeVersion: 1,
          name: 'Window',
          config: { length: 10, timeUnit: 's' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(present, registry)).toEqual([]);
  });

  it('registers the window definition deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.get('window', 1)).toEqual(second.get('window', 1));
  });

  it('registers the aggregate definition with collection input and stream output', () => {
    const registry = createBuiltinNodeRegistry();
    const aggregate = registry.get('aggregate', 1);

    expect(aggregate?.displayName).toBe('Aggregate');
    expect(aggregate?.category).toBe('streaming');
    expect(aggregate?.inputs).toEqual([{ id: 'in', label: 'Collection', kind: 'collection' }]);
    expect(aggregate?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    const fields = aggregate?.properties.find((property) => property.key === 'fields');
    expect(fields?.required).toBe(true);
    expect(fields?.type).toBe('expression');

    assertValidCompilerMapping(aggregate);
  });

  it('validates the required aggregate fields via the generic property validator', () => {
    const registry = createBuiltinNodeRegistry();

    const missing = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-aggregate-1',
          type: 'aggregate',
          typeVersion: 1,
          name: 'Aggregate',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingDiagnostics = validateFlowRequiredProperties(missing, registry).filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(missingDiagnostics).toHaveLength(1);
    expect(missingDiagnostics[0]?.nodeId).toBe('node-aggregate-1');
    expect(missingDiagnostics[0]?.propertyPath).toBe('config.fields');

    const present = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-aggregate-1',
          type: 'aggregate',
          typeVersion: 1,
          name: 'Aggregate',
          config: { fields: 'avg(power) AS mean_power' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(present, registry)).toEqual([]);
  });

  it('rejects a direct stream->aggregate edge but accepts window->aggregate', () => {
    const registry = createBuiltinNodeRegistry();

    const streamToAggregate = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-filter-1',
          type: 'filter',
          typeVersion: 1,
          name: 'Filter',
          config: { expression: 'power > 10' },
        }),
        createFlowNode({
          id: 'node-aggregate-1',
          type: 'aggregate',
          typeVersion: 1,
          name: 'Aggregate',
          config: { fields: 'avg(power) AS mean_power' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-stream-aggregate',
          sourceNodeId: 'node-filter-1',
          sourcePortId: 'out',
          targetNodeId: 'node-aggregate-1',
          targetPortId: 'in',
        }),
      ],
    });

    const streamDiagnostics = validateFlowEdgePorts(streamToAggregate, registry).filter(
      (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
    );
    expect(streamDiagnostics).toHaveLength(1);
    expect(streamDiagnostics[0]?.edgeId).toBe('edge-stream-aggregate');

    const windowToAggregate = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-window-1',
          type: 'window',
          typeVersion: 1,
          name: 'Window',
          config: { length: 10, timeUnit: 's' },
        }),
        createFlowNode({
          id: 'node-aggregate-1',
          type: 'aggregate',
          typeVersion: 1,
          name: 'Aggregate',
          config: { fields: 'avg(power) AS mean_power' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-window-aggregate',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-aggregate-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(validateFlowEdgePorts(windowToAggregate, registry)).toEqual([]);
  });

  it('registers the group-by definition with collection input and output', () => {
    const registry = createBuiltinNodeRegistry();
    const groupBy = registry.get('group-by', 1);

    expect(groupBy?.displayName).toBe('Group By');
    expect(groupBy?.category).toBe('streaming');
    expect(groupBy?.inputs).toEqual([{ id: 'in', label: 'Collection', kind: 'collection' }]);
    expect(groupBy?.outputs).toEqual([{ id: 'out', label: 'Collection', kind: 'collection' }]);

    const keys = groupBy?.properties.find((property) => property.key === 'keys');
    expect(keys?.required).toBe(true);
    expect(keys?.type).toBe('expression');

    assertValidCompilerMapping(groupBy);
  });

  it('validates the required group-by keys via the generic property validator', () => {
    const registry = createBuiltinNodeRegistry();

    const missing = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-group-by-1',
          type: 'group-by',
          typeVersion: 1,
          name: 'Group By',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingDiagnostics = validateFlowRequiredProperties(missing, registry).filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(missingDiagnostics).toHaveLength(1);
    expect(missingDiagnostics[0]?.nodeId).toBe('node-group-by-1');
    expect(missingDiagnostics[0]?.propertyPath).toBe('config.keys');

    const present = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-group-by-1',
          type: 'group-by',
          typeVersion: 1,
          name: 'Group By',
          config: { keys: 'deviceId' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(present, registry)).toEqual([]);
  });

  it('rejects a direct stream->group-by edge but accepts window->group-by', () => {
    const registry = createBuiltinNodeRegistry();

    const streamToGroupBy = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-filter-1',
          type: 'filter',
          typeVersion: 1,
          name: 'Filter',
          config: { expression: 'power > 10' },
        }),
        createFlowNode({
          id: 'node-group-by-1',
          type: 'group-by',
          typeVersion: 1,
          name: 'Group By',
          config: { keys: 'deviceId' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-stream-group-by',
          sourceNodeId: 'node-filter-1',
          sourcePortId: 'out',
          targetNodeId: 'node-group-by-1',
          targetPortId: 'in',
        }),
      ],
    });

    const streamDiagnostics = validateFlowEdgePorts(streamToGroupBy, registry).filter(
      (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
    );
    expect(streamDiagnostics).toHaveLength(1);
    expect(streamDiagnostics[0]?.edgeId).toBe('edge-stream-group-by');

    const windowToGroupBy = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-window-1',
          type: 'window',
          typeVersion: 1,
          name: 'Window',
          config: { length: 10, timeUnit: 's' },
        }),
        createFlowNode({
          id: 'node-group-by-1',
          type: 'group-by',
          typeVersion: 1,
          name: 'Group By',
          config: { keys: 'deviceId' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-window-group-by',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-group-by-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(validateFlowEdgePorts(windowToGroupBy, registry)).toEqual([]);
  });

  it('registers the aggregate and group-by definitions deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.get('aggregate', 1)).toEqual(second.get('aggregate', 1));
    expect(first.get('group-by', 1)).toEqual(second.get('group-by', 1));
  });

  it('registers the switch definition with one stream input and stable named stream outputs', () => {
    const registry = createBuiltinNodeRegistry();
    const switchNode = registry.get('switch', 1);

    expect(switchNode?.displayName).toBe('Switch');
    expect(switchNode?.category).toBe('routing');
    expect(switchNode?.inputs).toEqual([{ id: 'in', label: 'Stream', kind: 'stream' }]);
    expect(switchNode?.outputs).toEqual([
      { id: 'branch-1', label: 'Branch 1', kind: 'stream' },
      { id: 'branch-2', label: 'Branch 2', kind: 'stream' },
      { id: 'default', label: 'Default', kind: 'stream' },
    ]);

    const cases = switchNode?.properties.find((property) => property.key === 'cases');
    expect(cases?.required).toBe(true);
    expect(cases?.type).toBe('expression');

    assertValidCompilerMapping(switchNode);
  });

  it('uses stable string output port IDs on switch with no array-index edge semantics', () => {
    const registry = createBuiltinNodeRegistry();
    const switchNode = registry.get('switch', 1);

    const outputIds = (switchNode?.outputs ?? []).map((port) => port.id);
    expect(outputIds).toEqual(['branch-1', 'branch-2', 'default']);
    for (const id of outputIds) {
      expect(typeof id).toBe('string');
      expect(Number.isNaN(Number(id))).toBe(true);
    }

    const document = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-switch-1',
          type: 'switch',
          typeVersion: 1,
          name: 'Switch',
          config: { cases: 'temperature > 30 => branch-1; humidity > 80 => branch-2' },
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
          id: 'edge-switch-default-log',
          sourceNodeId: 'node-switch-1',
          sourcePortId: 'default',
          targetNodeId: 'node-log-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(validateFlowEdgePorts(document, registry)).toEqual([]);
    for (const edge of document.spec.edges) {
      expect(typeof edge.sourcePortId).toBe('string');
      expect(typeof edge.targetPortId).toBe('string');
    }
  });

  it('validates the required switch cases via the generic property validator', () => {
    const registry = createBuiltinNodeRegistry();

    const missing = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-switch-1',
          type: 'switch',
          typeVersion: 1,
          name: 'Switch',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingDiagnostics = validateFlowRequiredProperties(missing, registry).filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(missingDiagnostics).toHaveLength(1);
    expect(missingDiagnostics[0]?.nodeId).toBe('node-switch-1');
    expect(missingDiagnostics[0]?.propertyPath).toBe('config.cases');

    const present = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-switch-1',
          type: 'switch',
          typeVersion: 1,
          name: 'Switch',
          config: { cases: 'temperature > 30 => branch-1; humidity > 80 => branch-2' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(present, registry)).toEqual([]);
  });

  it('registers the sort definition with collection in, stream out, and a required order expression', () => {
    const registry = createBuiltinNodeRegistry();
    const sort = registry.get('sort', 1);

    expect(sort?.displayName).toBe('Sort');
    expect(sort?.category).toBe('routing');
    expect(sort?.inputs).toEqual([{ id: 'in', label: 'Collection', kind: 'collection' }]);
    expect(sort?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    const orderBy = sort?.properties.find((property) => property.key === 'orderBy');
    expect(orderBy?.required).toBe(true);
    expect(orderBy?.type).toBe('expression');

    assertValidCompilerMapping(sort);
  });

  it('validates the required sort order via the generic property validator', () => {
    const registry = createBuiltinNodeRegistry();

    const missing = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-sort-1',
          type: 'sort',
          typeVersion: 1,
          name: 'Sort',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingDiagnostics = validateFlowRequiredProperties(missing, registry).filter(
      (item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(missingDiagnostics).toHaveLength(1);
    expect(missingDiagnostics[0]?.nodeId).toBe('node-sort-1');
    expect(missingDiagnostics[0]?.propertyPath).toBe('config.orderBy');

    const present = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-sort-1',
          type: 'sort',
          typeVersion: 1,
          name: 'Sort',
          config: { orderBy: 'mean_power DESC' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(present, registry)).toEqual([]);
  });

  it('rejects a direct stream->sort edge but accepts window->sort', () => {
    const registry = createBuiltinNodeRegistry();

    const streamToSort = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-filter-1',
          type: 'filter',
          typeVersion: 1,
          name: 'Filter',
          config: { expression: 'power > 10' },
        }),
        createFlowNode({
          id: 'node-sort-1',
          type: 'sort',
          typeVersion: 1,
          name: 'Sort',
          config: { orderBy: 'mean_power DESC' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-stream-sort',
          sourceNodeId: 'node-filter-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sort-1',
          targetPortId: 'in',
        }),
      ],
    });

    const streamDiagnostics = validateFlowEdgePorts(streamToSort, registry).filter(
      (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
    );
    expect(streamDiagnostics).toHaveLength(1);
    expect(streamDiagnostics[0]?.edgeId).toBe('edge-stream-sort');

    const windowToSort = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-window-1',
          type: 'window',
          typeVersion: 1,
          name: 'Window',
          config: { length: 10, timeUnit: 's' },
        }),
        createFlowNode({
          id: 'node-sort-1',
          type: 'sort',
          typeVersion: 1,
          name: 'Sort',
          config: { orderBy: 'mean_power DESC' },
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-window-sort',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sort-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(validateFlowEdgePorts(windowToSort, registry)).toEqual([]);
  });

  it('registers the switch and sort definitions deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.get('switch', 1)).toEqual(second.get('switch', 1));
    expect(first.get('sort', 1)).toEqual(second.get('sort', 1));
  });

  it('registers stream and table reference sources with stream/table output kinds', () => {
    const registry = createBuiltinNodeRegistry();
    const streamSource = registry.get('stream-source', 1);
    const tableSource = registry.get('table-source', 1);

    expect(streamSource?.displayName).toBe('Stream Source');
    expect(streamSource?.category).toBe('source');
    expect(streamSource?.inputs).toEqual([]);
    expect(streamSource?.outputs).toEqual([{ id: 'out', label: 'Stream', kind: 'stream' }]);

    expect(tableSource?.displayName).toBe('Table Source');
    expect(tableSource?.category).toBe('source');
    expect(tableSource?.inputs).toEqual([]);
    expect(tableSource?.outputs).toEqual([{ id: 'out', label: 'Table', kind: 'table' }]);
  });

  it('references existing streams/tables via dynamic option providers plus an explicit connector', () => {
    const registry = createBuiltinNodeRegistry();
    const streamSource = registry.get('stream-source', 1);
    const tableSource = registry.get('table-source', 1);

    const stream = streamSource?.properties.find((property) => property.key === 'stream');
    expect(stream?.required).toBe(true);
    expect(stream?.type).toBe('select');
    expect(stream?.optionsProvider).toBe('streams');

    const table = tableSource?.properties.find((property) => property.key === 'table');
    expect(table?.required).toBe(true);
    expect(table?.type).toBe('select');
    expect(table?.optionsProvider).toBe('tables');

    for (const definition of [streamSource, tableSource]) {
      const connector = definition?.properties.find(
        (property) => property.key === 'connector',
      );
      expect(connector?.required).toBe(true);
      expect(connector?.type).toBe('string');

      expect(definition?.subtitleKey).toBe(
        definition?.type === 'stream-source' ? 'stream' : 'table',
      );
      assertValidCompilerMapping(definition);
    }
  });

  it('validates the required stream/table reference settings via the generic property validator', () => {
    const registry = createBuiltinNodeRegistry();

    const missingStream = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-stream-source-1',
          type: 'stream-source',
          typeVersion: 1,
          name: 'Stream Source',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingStreamDiagnostics = validateFlowRequiredProperties(
      missingStream,
      registry,
    ).filter((item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING');
    expect(missingStreamDiagnostics.map((item) => item.propertyPath).sort()).toEqual([
      'config.connector',
      'config.stream',
    ]);
    for (const diagnostic of missingStreamDiagnostics) {
      expect(diagnostic.nodeId).toBe('node-stream-source-1');
    }

    const presentStream = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-stream-source-1',
          type: 'stream-source',
          typeVersion: 1,
          name: 'Stream Source',
          config: { stream: 'demoStream', connector: 'mqtt' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(presentStream, registry)).toEqual([]);

    const missingTable = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-table-source-1',
          type: 'table-source',
          typeVersion: 1,
          name: 'Table Source',
          config: {},
        }),
      ],
      edges: [],
    });

    const missingTableDiagnostics = validateFlowRequiredProperties(
      missingTable,
      registry,
    ).filter((item) => item.code === 'FLOW_REQUIRED_PROPERTY_MISSING');
    expect(missingTableDiagnostics.map((item) => item.propertyPath).sort()).toEqual([
      'config.connector',
      'config.table',
    ]);
    for (const diagnostic of missingTableDiagnostics) {
      expect(diagnostic.nodeId).toBe('node-table-source-1');
    }

    const presentTable = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-table-source-1',
          type: 'table-source',
          typeVersion: 1,
          name: 'Table Source',
          config: { table: 'demoTable', connector: 'redis' },
        }),
      ],
      edges: [],
    });

    expect(validateFlowRequiredProperties(presentTable, registry)).toEqual([]);
  });

  it('registers the stream and table reference definitions deterministically', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first.get('stream-source', 1)).toEqual(second.get('stream-source', 1));
    expect(first.get('table-source', 1)).toEqual(second.get('table-source', 1));
  });

  it('declares only valid compiler mapping shapes when present', () => {
    const registry = createBuiltinNodeRegistry();
    for (const definition of registry.list()) {
      assertValidCompilerMapping(definition);
    }
  });

  it('returns an isolated registry on each call', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first).not.toBe(second);
    expect(first.list()).toHaveLength(17);
    expect(second.list()).toHaveLength(17);

    first.register(buildDefinition({ type: 'test-custom', version: 1 }));

    expect(first.has('test-custom', 1)).toBe(true);
    expect(first.list()).toHaveLength(18);
    expect(second.list()).toHaveLength(17);
    expect(second.has('test-custom', 1)).toBe(false);
    expect(second.get('test-custom', 1)).toBeUndefined();
  });
});
