import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';

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

describe('NodeRegistry', () => {
  it('registers and looks up a definition by type and version', () => {
    const registry = new NodeRegistry();
    const definition = buildDefinition({ type: 'filter', version: 1 });

    registry.register(definition);

    expect(registry.has('filter', 1)).toBe(true);
    expect(registry.get('filter', 1)).toEqual(definition);
  });

  it('treats same type with different versions as distinct identities', () => {
    const registry = new NodeRegistry();
    registry.register(buildDefinition({ type: 'filter', version: 1 }));
    registry.register(buildDefinition({ type: 'filter', version: 2 }));

    expect(registry.has('filter', 1)).toBe(true);
    expect(registry.has('filter', 2)).toBe(true);
    expect(registry.get('filter', 1)?.version).toBe(1);
    expect(registry.get('filter', 2)?.version).toBe(2);
  });

  it('returns undefined and false for missing lookups', () => {
    const registry = new NodeRegistry();
    registry.register(buildDefinition({ type: 'filter', version: 1 }));

    expect(registry.get('unknown', 1)).toBeUndefined();
    expect(registry.get('filter', 2)).toBeUndefined();
    expect(registry.has('unknown', 1)).toBe(false);
    expect(registry.has('filter', 2)).toBe(false);
  });

  it('rejects duplicate type+version registration', () => {
    const registry = new NodeRegistry();
    registry.register(buildDefinition({ type: 'filter', version: 1 }));

    expect(() =>
      registry.register(buildDefinition({ type: 'filter', version: 1 })),
    ).toThrow(/duplicate/i);
    expect(registry.list()).toHaveLength(1);
  });

  it('lists definitions in deterministic type then version order', () => {
    const registry = new NodeRegistry();
    registry.register(buildDefinition({ type: 'switch', version: 2 }));
    registry.register(buildDefinition({ type: 'filter', version: 2 }));
    registry.register(buildDefinition({ type: 'filter', version: 1 }));
    registry.register(buildDefinition({ type: 'aggregate', version: 1 }));

    const listed = registry.list().map((item) => `${item.type}@${item.version}`);

    expect(listed).toEqual([
      'aggregate@1',
      'filter@1',
      'filter@2',
      'switch@2',
    ]);
  });

  it('stores definitions without mutating them and isolates retrieved copies', () => {
    const registry = new NodeRegistry();
    const definition = buildDefinition({ type: 'filter', version: 1 });
    const snapshot = JSON.stringify(definition);

    registry.register(definition);
    definition.displayName = 'mutated after register';
    definition.inputs.push({ id: 'extra', kind: 'any' });

    expect(JSON.stringify(definition)).not.toBe(snapshot);
    expect(registry.get('filter', 1)?.displayName).toBe('filter v1');
    expect(registry.get('filter', 1)?.inputs).toHaveLength(1);

    const retrieved = registry.get('filter', 1);
    retrieved?.inputs.push({ id: 'extra', kind: 'any' });

    expect(registry.get('filter', 1)?.inputs).toHaveLength(1);
    expect(registry.list()[0]?.inputs).toHaveLength(1);
  });
});
