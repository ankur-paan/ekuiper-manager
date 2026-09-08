import { resolveTargetCapabilities } from '@/lib/flows/capabilities/resolve-capabilities';
import { hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import { generateLargeFlow } from '@/lib/flows/testing/generate-large-flow';
import { validateFlowForEditor } from '@/lib/flows/validation/editor-validation';

const BENCHMARK_SIZES = [50, 250, 500, 1000];

describe('generateLargeFlow', () => {
  it.each(BENCHMARK_SIZES)('generates exactly %i nodes chained acyclically', (size) => {
    const document = generateLargeFlow(size);

    expect(document.spec.nodes).toHaveLength(size);
    expect(document.spec.edges).toHaveLength(size - 1);

    const nodeIds = new Set(document.spec.nodes.map((node) => node.id));
    expect(nodeIds.size).toBe(size);

    for (const [index, edge] of document.spec.edges.entries()) {
      expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
      expect(nodeIds.has(edge.targetNodeId)).toBe(true);
      expect(edge.sourceNodeId).not.toBe(edge.targetNodeId);
      expect(edge.sourceNodeId).toBe(document.spec.nodes[index]?.id);
      expect(edge.targetNodeId).toBe(document.spec.nodes[index + 1]?.id);
    }
  });

  it.each(BENCHMARK_SIZES)('generated %i-node graph validates for the supported template', (size) => {
    const document = generateLargeFlow(size);
    const registry = createBuiltinNodeRegistry();
    const capabilities = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
    });

    const diagnostics = validateFlowForEditor(document, registry, capabilities);
    const errors = diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );

    expect(errors).toEqual([]);
  });

  it.each(BENCHMARK_SIZES)('same size yields same canonical hash (%i nodes)', (size) => {
    const first = generateLargeFlow(size);
    const second = generateLargeFlow(size);

    expect(second).toEqual(first);
    expect(hashFlowSemantic(second.spec)).toBe(hashFlowSemantic(first.spec));
  });

  it('rejects sizes that cannot hold a source and a sink', () => {
    expect(() => generateLargeFlow(1)).toThrow();
    expect(() => generateLargeFlow(0)).toThrow();
    expect(() => generateLargeFlow(2.5)).toThrow();
  });
});
