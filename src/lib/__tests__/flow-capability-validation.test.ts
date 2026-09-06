import { resolveTargetCapabilities } from '@/lib/flows/capabilities/resolve-capabilities';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import {
  isDefinitionSupportedByCapabilities,
  resolveDefinitionCapabilityRequirement,
  validateFlowCapabilities,
} from '@/lib/flows/validation/capability-validation';

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

function buildSourceSinkRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.register(
    buildDefinition({
      type: 'memory-source',
      version: 1,
      category: 'source',
      runtimeKind: 'source',
      operation: 'memory',
    }),
  );
  registry.register(
    buildDefinition({
      type: 'mqtt-source',
      version: 1,
      category: 'source',
      inputs: [],
      outputs: [{ id: 'out', kind: 'stream' }],
    }),
  );
  registry.register(
    buildDefinition({
      type: 'memory-sink',
      version: 1,
      category: 'sink',
      runtimeKind: 'sink',
      operation: 'memory',
    }),
  );
  return registry;
}

describe('validateFlowCapabilities', () => {
  it('passes when the baseline profile supports every node', () => {
    const registry = buildSourceSinkRegistry();
    const profile = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
    });
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Source',
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'memory-sink',
          typeVersion: 1,
          name: 'Sink',
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sink-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(validateFlowCapabilities(doc, registry, profile)).toEqual([]);
  });

  it('emits FLOW_CAPABILITY_UNAVAILABLE with nodeId for a narrowed profile', () => {
    const registry = buildSourceSinkRegistry();
    const profile = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
      sourceNames: ['memory'],
      sinkNames: ['memory'],
      operatorNames: [],
    });
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'mqtt-source',
          typeVersion: 1,
          name: 'MQTT Source',
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'memory-sink',
          typeVersion: 1,
          name: 'Sink',
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sink-1',
          targetPortId: 'in',
        }),
      ],
    });

    const diagnostics = validateFlowCapabilities(doc, registry, profile);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('FLOW_CAPABILITY_UNAVAILABLE');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.nodeId).toBe('node-source-1');
    expect(diagnostics[0]?.message).toContain('mqtt');
  });

  it('reports every node when the target does not support graph rules', () => {
    const registry = buildSourceSinkRegistry();
    const profile = resolveTargetCapabilities({
      version: '2.3.0',
      reachable: true,
    });
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Source',
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'memory-sink',
          typeVersion: 1,
          name: 'Sink',
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowCapabilities(doc, registry, profile);
    expect(diagnostics.map((item) => item.code)).toEqual([
      'FLOW_CAPABILITY_UNAVAILABLE',
      'FLOW_CAPABILITY_UNAVAILABLE',
    ]);
    expect(diagnostics.map((item) => item.nodeId).sort()).toEqual([
      'node-sink-1',
      'node-source-1',
    ]);
  });

  it('skips unknown node types without emitting capability diagnostics', () => {
    const registry = buildSourceSinkRegistry();
    const profile = resolveTargetCapabilities({
      version: '2.3.0',
      reachable: true,
    });
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-mystery-1',
          type: 'not-registered',
          typeVersion: 1,
          name: 'Mystery',
        }),
      ],
      edges: [],
    });

    expect(validateFlowCapabilities(doc, registry, profile)).toEqual([]);
  });

  it('honors explicit requiresCapability metadata without version checks', () => {
    const registry = new NodeRegistry();
    registry.register(
      buildDefinition({
        type: 'custom-source',
        version: 1,
        category: 'source',
        ...{
          requiresCapability: { kind: 'source', name: 'memory' },
        },
      } as Partial<FlowNodeDefinition> & { type: string; version: number }),
    );
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-custom-1',
          type: 'custom-source',
          typeVersion: 1,
          name: 'Custom',
        }),
      ],
      edges: [],
    });

    const supported = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
    });
    expect(validateFlowCapabilities(doc, registry, supported)).toEqual([]);

    const narrowed = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
      sourceNames: ['mqtt'],
    });
    const diagnostics = validateFlowCapabilities(doc, registry, narrowed);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('FLOW_CAPABILITY_UNAVAILABLE');
    expect(diagnostics[0]?.nodeId).toBe('node-custom-1');
  });

  it('does not mutate its inputs', () => {
    const registry = buildSourceSinkRegistry();
    const profile = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
      sourceNames: ['memory'],
      sinkNames: ['memory'],
      operatorNames: [],
    });
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'mqtt-source',
          typeVersion: 1,
          name: 'MQTT Source',
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'memory-sink',
          typeVersion: 1,
          name: 'Sink',
        }),
      ],
      edges: [],
    });
    const snapshot = JSON.parse(JSON.stringify(doc)) as unknown;

    validateFlowCapabilities(doc, registry, profile);

    expect(doc).toEqual(snapshot);
  });
});

describe('isDefinitionSupportedByCapabilities', () => {
  it('returns a human-readable reason for unsupported definitions', () => {
    const profile = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
      sourceNames: ['memory'],
    });
    const status = isDefinitionSupportedByCapabilities(
      buildDefinition({ type: 'mqtt-source', version: 1, category: 'source' }),
      profile,
    );

    expect(status.supported).toBe(false);
    expect(status.reason ?? '').toContain('mqtt');
  });

  it('treats definitions with no determinable requirement as supported', () => {
    const profile = resolveTargetCapabilities({
      version: '2.3.0',
      reachable: true,
    });
    const status = isDefinitionSupportedByCapabilities(
      buildDefinition({ type: 'brand-new-kind', version: 1 }),
      profile,
    );

    expect(status.supported).toBe(true);
  });

  it('prefers runtimeKind/operation over the fallback table', () => {
    const requirement = resolveDefinitionCapabilityRequirement(
      buildDefinition({
        type: 'filter',
        version: 1,
        runtimeKind: 'sink',
        operation: 'rest',
      }),
    );

    expect(requirement).toEqual({ kind: 'sink', name: 'rest' });
  });
});
