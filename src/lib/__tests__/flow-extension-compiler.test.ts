import type { TargetCapabilityProfile } from '@/lib/flows/capabilities/types';
import { canonicalJson } from '@/lib/flows/hashing/canonical-json';
import { compileFlowToEkuiperGraph } from '@/lib/flows/compiler/ekuiper/compile-graph';
import { compileExtensionNode } from '@/lib/flows/compiler/ekuiper/compile-extension-node';
import { isEkuiperGraphNode } from '@/lib/flows/compiler/ekuiper/graph-types';
import { createRuntimeId } from '@/lib/flows/compiler/runtime-id';
import type { FlowDocument } from '@/lib/flows/model/flow-document';
import { FLOW_DOCUMENT_VERSION } from '@/lib/flows/model/flow-document';
import type {
  FlowExtensionManifest,
  FlowExtensionNodeDescriptor,
} from '@/lib/flows/extensions/types';
import { createFlowRegistry } from '@/lib/flows/registry/create-flow-registry';
import type { NodeRegistry } from '@/lib/flows/registry/node-registry';
import {
  FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
  FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
} from '@/lib/flows/registry/node-definition';
import { FLOW_CAPABILITY_UNAVAILABLE } from '@/lib/flows/model/diagnostic';

const SOURCE_ID = 'node-ext-source-1';
const OPERATOR_ID = 'node-ext-op-1';
const SINK_ID = 'node-ext-sink-1';

function buildManifest(
  overrides: Partial<FlowExtensionManifest> = {},
): FlowExtensionManifest {
  return {
    apiVersion: 'flow.extensions.ekuiper-manager.io/v1alpha1',
    id: 'com.example.test',
    name: 'Example Test',
    version: '1.0.0',
    manager: '>=2.0.0',
    nodes: ['nodes/example.json'],
    ...overrides,
  };
}

function buildSourceDescriptor(
  overrides: Partial<FlowExtensionNodeDescriptor> = {},
): FlowExtensionNodeDescriptor {
  return {
    type: 'example-src',
    version: 1,
    displayName: 'Example Source',
    description: 'Declarative test source.',
    category: 'source',
    inputs: [],
    outputs: [{ id: 'out', kind: 'stream' }],
    properties: [{ key: 'topic', label: 'Topic', type: 'string' }],
    runtimeMapping: {
      kind: 'source',
      nodeType: 'examplesrc',
      properties: { topic: 'datasource' },
    },
    ...overrides,
  };
}

function buildOperatorDescriptor(
  overrides: Partial<FlowExtensionNodeDescriptor> = {},
): FlowExtensionNodeDescriptor {
  return {
    type: 'example-op',
    version: 1,
    displayName: 'Example Operator',
    description: 'Declarative test operator.',
    category: 'transform',
    inputs: [{ id: 'in', kind: 'stream' }],
    outputs: [{ id: 'out', kind: 'stream' }],
    properties: [{ key: 'expr', label: 'Expression', type: 'expression' }],
    runtimeMapping: {
      kind: 'operator',
      nodeType: 'exampleop',
      properties: { expr: 'expr' },
    },
    ...overrides,
  };
}

function buildSinkDescriptor(
  overrides: Partial<FlowExtensionNodeDescriptor> = {},
): FlowExtensionNodeDescriptor {
  return {
    type: 'example-sink',
    version: 1,
    displayName: 'Example Sink',
    description: 'Declarative test sink.',
    category: 'sink',
    inputs: [{ id: 'in', kind: 'stream' }],
    outputs: [],
    properties: [{ key: 'topic', label: 'Topic', type: 'string' }],
    runtimeMapping: {
      kind: 'sink',
      nodeType: 'examplesink',
      properties: { topic: 'topic' },
    },
    ...overrides,
  };
}

function buildRegistry(
  nodes: FlowExtensionNodeDescriptor[] = [
    buildSourceDescriptor(),
    buildOperatorDescriptor(),
    buildSinkDescriptor(),
  ],
): NodeRegistry {
  return createFlowRegistry({
    extensionPackages: [{ manifest: buildManifest(), nodes }],
  });
}

function buildExtensionFlow(): FlowDocument {
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: { id: 'flow-extension-demo', name: 'Extension Demo' },
    spec: {
      nodes: [
        {
          id: SOURCE_ID,
          type: 'example-src',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 'devices/in', note: 'ignored-unknown' },
        },
        {
          id: OPERATOR_ID,
          type: 'example-op',
          typeVersion: 1,
          name: 'Operator',
          config: { expr: 'temperature > 20', extra: 123 },
        },
        {
          id: SINK_ID,
          type: 'example-sink',
          typeVersion: 1,
          name: 'Sink',
          config: { topic: 'devices/out' },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          sourceNodeId: SOURCE_ID,
          sourcePortId: 'out',
          targetNodeId: OPERATOR_ID,
          targetPortId: 'in',
        },
        {
          id: 'edge-2',
          sourceNodeId: OPERATOR_ID,
          sourcePortId: 'out',
          targetNodeId: SINK_ID,
          targetPortId: 'in',
        },
      ],
    },
    layout: {
      nodes: {
        [SOURCE_ID]: { x: 0, y: 0 },
        [OPERATOR_ID]: { x: 160, y: 0 },
        [SINK_ID]: { x: 320, y: 0 },
      },
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

function buildSupportingProfile(): TargetCapabilityProfile {
  return {
    ekuiperVersion: '2.4.1',
    reachable: true,
    graphRules: true,
    sources: ['examplesrc'],
    operators: ['exampleop'],
    sinks: ['examplesink'],
    ruleTest: false,
    ruleTestSse: false,
  };
}

function buildEmptyProfile(): TargetCapabilityProfile {
  return {
    ekuiperVersion: '2.4.1',
    reachable: true,
    graphRules: true,
    sources: [],
    operators: [],
    sinks: [],
    ruleTest: false,
    ruleTestSse: false,
  };
}

describe('flow extension compiler (declarative mapping)', () => {
  it('compiles extension source/operator/sink through the generic mapping', () => {
    const result = compileFlowToEkuiperGraph(buildExtensionFlow(), {
      registry: buildRegistry(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_ID);
    const operatorRuntimeId = createRuntimeId('exampleop', OPERATOR_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'examplesrc',
            props: { datasource: 'devices/in' },
          },
          [operatorRuntimeId]: {
            type: 'operator',
            nodeType: 'exampleop',
            props: { expr: 'temperature > 20' },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'examplesink',
            props: { topic: 'devices/out' },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [operatorRuntimeId],
            [operatorRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_ID]: sourceRuntimeId,
      [OPERATOR_ID]: operatorRuntimeId,
      [SINK_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('does not map unknown config keys unless explicitly allowlisted', () => {
    const result = compileFlowToEkuiperGraph(buildExtensionFlow(), {
      registry: buildRegistry(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };
    const sourceRuntimeId = createRuntimeId('source', SOURCE_ID);
    const operatorRuntimeId = createRuntimeId('exampleop', OPERATOR_ID);

    expect(graph.nodes[sourceRuntimeId]?.props).toEqual({
      datasource: 'devices/in',
    });
    expect(graph.nodes[sourceRuntimeId]?.props).not.toHaveProperty('note');
    expect(graph.nodes[sourceRuntimeId]?.props).not.toHaveProperty('topic');
    expect(graph.nodes[operatorRuntimeId]?.props).toEqual({
      expr: 'temperature > 20',
    });
    expect(graph.nodes[operatorRuntimeId]?.props).not.toHaveProperty('extra');
  });

  it('emits node entries satisfying the audited eKuiper graph node envelope', () => {
    const result = compileFlowToEkuiperGraph(buildExtensionFlow(), {
      registry: buildRegistry(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, unknown>;
    };

    expect(Object.values(graph.nodes).every(isEkuiperGraphNode)).toBe(true);
  });

  it('is deterministic across recompilations', () => {
    const registry = buildRegistry();
    const first = compileFlowToEkuiperGraph(buildExtensionFlow(), { registry });
    const second = compileFlowToEkuiperGraph(buildExtensionFlow(), {
      registry: buildRegistry(),
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact.ruleDefinition)).toBe(
      canonicalJson(second.artifact.ruleDefinition),
    );
    expect(first.artifact.runtimeNodeMap).toEqual(second.artifact.runtimeNodeMap);
  });

  it('produces a diagnostic for an invalid mapping without executing it', () => {
    // Function-valued mappings never reach the compiler through the
    // registry (createFlowRegistry rejects them first as defence in
    // depth), so this exercises the compiler unit directly: the function
    // must be reported, never called.
    const spy = jest.fn();
    const definition = buildOperatorDescriptor({
      runtimeMapping: {
        kind: 'operator',
        nodeType: 'exampleop',
        properties: { expr: spy as unknown as string },
      },
    });
    const outcome = compileExtensionNode(
      { id: OPERATOR_ID, kind: 'operator', operation: 'exampleop', config: {} },
      definition,
    );

    expect('diagnostic' in outcome).toBe(true);
    if (!('diagnostic' in outcome)) return;
    expect(outcome.diagnostic.code).toBe(
      FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('produces a diagnostic for unknown mapping keys', () => {
    const registry = buildRegistry([
      buildSourceDescriptor({
        runtimeMapping: {
          kind: 'source',
          nodeType: 'examplesrc',
          properties: { topic: 'datasource' },
          template: '{{topic}}',
        } as unknown as FlowExtensionNodeDescriptor['runtimeMapping'],
      }),
      buildOperatorDescriptor(),
      buildSinkDescriptor(),
    ]);
    const result = compileFlowToEkuiperGraph(buildExtensionFlow(), { registry });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
      ),
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.nodeId === SOURCE_ID,
      ),
    ).toBe(true);
  });

  it('fails with a capability diagnostic when the requirement is unavailable', () => {
    const result = compileFlowToEkuiperGraph(buildExtensionFlow(), {
      registry: buildRegistry(),
      capabilities: buildEmptyProfile(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === FLOW_CAPABILITY_UNAVAILABLE,
      ),
    ).toBe(true);
  });

  it('compiles when the capability profile supports the mapped node types', () => {
    const result = compileFlowToEkuiperGraph(buildExtensionFlow(), {
      registry: buildRegistry(),
      capabilities: buildSupportingProfile(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagnostics).toEqual([]);
  });
});
