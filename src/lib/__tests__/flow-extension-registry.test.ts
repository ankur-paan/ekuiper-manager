import type {
  FlowExtensionManifest,
  FlowExtensionNodeDescriptor,
  FlowExtensionPackage,
} from '@/lib/flows/extensions/types';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import { createFlowRegistry } from '@/lib/flows/registry/create-flow-registry';

function buildManifest(
  overrides: Partial<FlowExtensionManifest> = {},
): FlowExtensionManifest {
  return {
    apiVersion: 'flow.extensions.ekuiper-manager.io/v1alpha1',
    id: 'com.example.telemetry',
    name: 'Example Telemetry',
    version: '1.0.0',
    manager: '>=2.0.0',
    nodes: ['nodes/example-source.json'],
    ...overrides,
  };
}

function buildDescriptor(
  overrides: Partial<FlowExtensionNodeDescriptor> = {},
): FlowExtensionNodeDescriptor {
  return {
    type: 'example-source',
    version: 1,
    displayName: 'Example Source',
    description: 'Declarative test source.',
    category: 'source',
    inputs: [],
    outputs: [{ id: 'out', kind: 'stream' }],
    properties: [{ key: 'topic', label: 'Topic', type: 'string' }],
    ...overrides,
  };
}

function buildPackage(
  manifestOverrides: Partial<FlowExtensionManifest> = {},
  nodes: FlowExtensionNodeDescriptor[] = [buildDescriptor()],
): FlowExtensionPackage {
  return { manifest: buildManifest(manifestOverrides), nodes };
}

describe('createFlowRegistry', () => {
  it('returns the built-in registry when no extensions are supplied', () => {
    const combined = createFlowRegistry();
    const builtins = createBuiltinNodeRegistry();

    expect(combined.list()).toEqual(builtins.list());
    expect(combined.has('filter', 1)).toBe(true);
    expect(combined.has('memory-source', 1)).toBe(true);
  });

  it('merges a valid extension node alongside built-ins', () => {
    const extensionPackage = buildPackage();
    const registry = createFlowRegistry({
      extensionPackages: [extensionPackage],
    });

    expect(registry.has('example-source', 1)).toBe(true);
    expect(registry.get('example-source', 1)).toEqual(buildDescriptor());
    // Built-ins are preserved.
    expect(registry.has('filter', 1)).toBe(true);
    expect(registry.has('memory-source', 1)).toBe(true);
  });

  it('merges nodes from multiple packages in order', () => {
    const first = buildPackage(
      { id: 'com.example.first', nodes: ['nodes/first.json'] },
      [buildDescriptor({ type: 'example-first' })],
    );
    const second = buildPackage(
      { id: 'com.example.second', nodes: ['nodes/second.json'] },
      [buildDescriptor({ type: 'example-second' })],
    );

    const registry = createFlowRegistry({ extensionPackages: [first, second] });

    expect(registry.has('example-first', 1)).toBe(true);
    expect(registry.has('example-second', 1)).toBe(true);
  });

  it('rejects an extension collision with a built-in without overriding it', () => {
    const before = createBuiltinNodeRegistry().get('filter', 1);
    const colliding = buildPackage({}, [buildDescriptor({ type: 'filter' })]);

    expect(() =>
      createFlowRegistry({ extensionPackages: [colliding] }),
    ).toThrow(/collision.*type="filter" version=1.*com\.example\.telemetry/s);

    // The built-in definition is untouched: a fresh registry still holds it.
    expect(createBuiltinNodeRegistry().get('filter', 1)).toEqual(before);
  });

  it('fails deterministically on collision for the same input', () => {
    const colliding = buildPackage({}, [buildDescriptor({ type: 'filter' })]);

    let firstMessage: string | undefined;
    let secondMessage: string | undefined;
    try {
      createFlowRegistry({ extensionPackages: [colliding] });
    } catch (error) {
      firstMessage = (error as Error).message;
    }
    try {
      createFlowRegistry({ extensionPackages: [colliding] });
    } catch (error) {
      secondMessage = (error as Error).message;
    }

    expect(firstMessage).toBeDefined();
    expect(secondMessage).toBe(firstMessage);
  });

  it('rejects a duplicate type+version across two extension packages', () => {
    const first = buildPackage({ id: 'com.example.first' });
    const second = buildPackage({ id: 'com.example.second' });

    expect(() =>
      createFlowRegistry({ extensionPackages: [first, second] }),
    ).toThrow(/collision.*type="example-source" version=1/s);
  });

  it('rejects a duplicate type+version within a single package', () => {
    const duplicate = buildPackage({}, [buildDescriptor(), buildDescriptor()]);

    expect(() =>
      createFlowRegistry({ extensionPackages: [duplicate] }),
    ).toThrow(/collision/s);
  });

  it('treats the same type with a different version as distinct', () => {
    const extensionPackage = buildPackage({}, [buildDescriptor({ version: 2 })]);
    const registry = createFlowRegistry({
      extensionPackages: [extensionPackage],
    });

    expect(registry.has('example-source', 2)).toBe(true);
    expect(registry.has('example-source', 1)).toBe(false);
  });

  it('stores extension definitions as data without React component hooks', () => {
    const descriptor = buildDescriptor();
    const registry = createFlowRegistry({
      extensionPackages: [buildPackage({}, [descriptor])],
    });

    const stored = registry.get('example-source', 1);
    expect(stored).toEqual(descriptor);
    for (const value of Object.values(stored ?? {})) {
      expect(typeof value).not.toBe('function');
    }
    expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
  });

  it('rejects an extension descriptor carrying a function value', () => {
    const descriptor = buildDescriptor() as unknown as Record<string, unknown>;
    descriptor['hook'] = () => undefined;
    const extensionPackage = buildPackage({}, [
      descriptor as unknown as FlowExtensionNodeDescriptor,
    ]);

    expect(() =>
      createFlowRegistry({ extensionPackages: [extensionPackage] }),
    ).toThrow(/executable|hook/i);
  });

  it('isolates registry state from later input mutation', () => {
    const descriptor = buildDescriptor();
    const registry = createFlowRegistry({
      extensionPackages: [buildPackage({}, [descriptor])],
    });

    descriptor.displayName = 'mutated after register';

    expect(registry.get('example-source', 1)?.displayName).toBe(
      'Example Source',
    );
  });

  it('lists the combined registry in deterministic order', () => {
    const extensionPackage = buildPackage(
      { id: 'com.example.telemetry' },
      [buildDescriptor({ type: 'aaa-example' })],
    );

    const first = createFlowRegistry({ extensionPackages: [extensionPackage] });
    const second = createFlowRegistry({ extensionPackages: [extensionPackage] });

    expect(first.list()).toEqual(second.list());
    const keys = first.list().map((item) => `${item.type}@${item.version}`);
    expect([...keys].sort()).toEqual(keys);
    expect(keys).toContain('aaa-example@1');
  });
});
