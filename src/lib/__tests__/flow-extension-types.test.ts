import {
  FLOW_EXTENSION_MANIFEST_API_VERSION,
  type FlowExtensionManifest,
  type FlowExtensionNodeDescriptor,
  type FlowExtensionPackage,
} from '@/lib/flows/extensions/types';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';

function buildManifest(): FlowExtensionManifest {
  return {
    apiVersion: 'flow.extensions.ekuiper-manager.io/v1alpha1',
    id: 'com.example.telemetry',
    name: 'Example Telemetry',
    version: '1.0.0',
    manager: '>=2.0.0',
    nodes: ['nodes/example-source.json'],
  };
}

function buildNodeDescriptor(): FlowExtensionNodeDescriptor {
  return {
    type: 'example-source',
    version: 1,
    displayName: 'Example Source',
    description: 'Declarative test source.',
    category: 'source',
    inputs: [],
    outputs: [{ id: 'out', kind: 'stream' }],
    properties: [
      { key: 'topic', label: 'Topic', type: 'string', required: true },
    ],
  };
}

function assertNoFunctions(value: unknown): void {
  if (typeof value === 'function') {
    throw new Error('Executable function field is not allowed.');
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNoFunctions(entry);
    }
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      assertNoFunctions(entry);
    }
  }
}

describe('flow extension manifest and descriptor types', () => {
  it('exposes the v1alpha1 manifest target with all required fields', () => {
    const manifest = buildManifest();

    expect(FLOW_EXTENSION_MANIFEST_API_VERSION).toBe(
      'flow.extensions.ekuiper-manager.io/v1alpha1',
    );
    expect(manifest.apiVersion).toBe(FLOW_EXTENSION_MANIFEST_API_VERSION);
    expect(manifest.id).toBe('com.example.telemetry');
    expect(manifest.name).toBe('Example Telemetry');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.manager).toBe('>=2.0.0');
    expect(manifest.nodes).toEqual(['nodes/example-source.json']);
  });

  it('contains no executable function fields', () => {
    const manifest = buildManifest();
    const descriptor = buildNodeDescriptor();
    const pkg: FlowExtensionPackage = { manifest, nodes: [descriptor] };

    expect(() => assertNoFunctions(pkg)).not.toThrow();
    expect(JSON.parse(JSON.stringify(pkg)) as unknown).toEqual(pkg);
  });

  it('reuses Node Definition-compatible fields for node descriptors', () => {
    const descriptor = buildNodeDescriptor();
    const asNodeDefinition: FlowNodeDefinition = descriptor;
    const backToDescriptor: FlowExtensionNodeDescriptor = asNodeDefinition;

    expect(backToDescriptor.type).toBe('example-source');
    expect(backToDescriptor.category).toBe('source');
    expect(backToDescriptor.outputs).toHaveLength(1);
    expect(backToDescriptor.properties[0]?.key).toBe('topic');
  });

  it('pairs manifest references with embedded descriptors without execution', () => {
    const pkg: FlowExtensionPackage = {
      manifest: buildManifest(),
      nodes: [buildNodeDescriptor()],
    };

    expect(pkg.nodes).toHaveLength(1);
    expect(pkg.manifest.nodes).toHaveLength(1);
    expect(pkg.nodes[0]?.type).toBe('example-source');
  });
});
