import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';

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
  it('lists the memory source and memory sink definitions', () => {
    const registry = createBuiltinNodeRegistry();

    expect(registry.has('memory-source', 1)).toBe(true);
    expect(registry.has('memory-sink', 1)).toBe(true);
    expect(registry.list().map((item) => `${item.type}@${item.version}`).sort()).toEqual([
      'memory-sink@1',
      'memory-source@1',
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

  it('returns an isolated registry on each call', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first).not.toBe(second);
    expect(first.list()).toHaveLength(2);
    expect(second.list()).toHaveLength(2);

    first.register(buildDefinition({ type: 'filter', version: 1 }));

    expect(first.has('filter', 1)).toBe(true);
    expect(first.list()).toHaveLength(3);
    expect(second.list()).toHaveLength(2);
    expect(second.has('filter', 1)).toBe(false);
    expect(second.get('filter', 1)).toBeUndefined();
  });
});
