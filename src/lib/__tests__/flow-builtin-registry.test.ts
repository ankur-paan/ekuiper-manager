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
  it('returns an initially empty registry', () => {
    const registry = createBuiltinNodeRegistry();

    expect(registry.list()).toEqual([]);
    expect(registry.has('filter', 1)).toBe(false);
    expect(registry.get('filter', 1)).toBeUndefined();
  });

  it('returns an isolated registry on each call', () => {
    const first = createBuiltinNodeRegistry();
    const second = createBuiltinNodeRegistry();

    expect(first).not.toBe(second);

    first.register(buildDefinition({ type: 'filter', version: 1 }));

    expect(first.has('filter', 1)).toBe(true);
    expect(first.list()).toHaveLength(1);
    expect(second.list()).toEqual([]);
    expect(second.has('filter', 1)).toBe(false);
    expect(second.get('filter', 1)).toBeUndefined();
  });
});
