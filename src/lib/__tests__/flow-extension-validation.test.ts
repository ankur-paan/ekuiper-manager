import type { FlowDiagnostic } from '@/lib/flows/model/diagnostic';
import {
  FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
  FLOW_EXTENSION_INVALID_MANIFEST,
  FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
  FLOW_EXTENSION_UNSAFE_NODE_PATH,
  isSafeExtensionDescriptorPath,
  validateExtensionManifest,
  validateExtensionNodeDescriptor,
  validateExtensionPackage,
} from '@/lib/flows/extensions/validate-extension';
import type {
  FlowExtensionManifest,
  FlowExtensionNodeDescriptor,
  FlowExtensionPackage,
} from '@/lib/flows/extensions/types';

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

function buildNodeDescriptor(
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

function buildPackage(): FlowExtensionPackage {
  return { manifest: buildManifest(), nodes: [buildNodeDescriptor()] };
}

function codes(diagnostics: FlowDiagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

describe('flow extension validation', () => {
  it('passes a valid manifest, descriptor, and package', () => {
    expect(validateExtensionManifest(buildManifest())).toEqual([]);
    expect(
      validateExtensionNodeDescriptor(buildNodeDescriptor()),
    ).toEqual([]);
    expect(validateExtensionPackage(buildPackage())).toEqual([]);
  });

  it('fails missing required manifest fields with structured diagnostics', () => {
    const diagnostics = validateExtensionManifest({
      apiVersion: 'flow.extensions.ekuiper-manager.io/v1alpha1',
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(codes(diagnostics)).toContain(FLOW_EXTENSION_INVALID_MANIFEST);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.severity).toBe('error');
      expect(typeof diagnostic.message).toBe('string');
      expect(diagnostic.message.length).toBeGreaterThan(0);
    }
    const paths = diagnostics.map(
      (diagnostic) => diagnostic.propertyPath ?? '',
    );
    expect(paths).toContain('id');
    expect(paths).toContain('name');
    expect(paths).toContain('version');
    expect(paths).toContain('manager');
    expect(paths).toContain('nodes');
  });

  it('rejects a wrong manifest apiVersion', () => {
    const diagnostics = validateExtensionManifest(
      buildManifest({ apiVersion: 'v2' as never }),
    );

    expect(codes(diagnostics)).toContain(FLOW_EXTENSION_INVALID_MANIFEST);
    expect(
      diagnostics.some(
        (diagnostic) => diagnostic.propertyPath === 'apiVersion',
      ),
    ).toBe(true);
  });

  it('rejects path traversal and absolute descriptor paths', () => {
    const traversal = validateExtensionManifest(
      buildManifest({ nodes: ['../evil.json'] }),
    );
    expect(codes(traversal)).toContain(FLOW_EXTENSION_UNSAFE_NODE_PATH);

    const absolute = validateExtensionManifest(
      buildManifest({ nodes: ['/etc/extension/evil.json'] }),
    );
    expect(codes(absolute)).toContain(FLOW_EXTENSION_UNSAFE_NODE_PATH);

    const windowsAbsolute = validateExtensionManifest(
      buildManifest({ nodes: ['C:\\extensions\\evil.json'] }),
    );
    expect(codes(windowsAbsolute)).toContain(
      FLOW_EXTENSION_UNSAFE_NODE_PATH,
    );

    const nestedTraversal = validateExtensionManifest(
      buildManifest({ nodes: ['nodes/../../evil.json'] }),
    );
    expect(codes(nestedTraversal)).toContain(
      FLOW_EXTENSION_UNSAFE_NODE_PATH,
    );

    expect(isSafeExtensionDescriptorPath('../evil.json')).toBe(false);
    expect(isSafeExtensionDescriptorPath('/abs/nodes/x.json')).toBe(false);
    expect(isSafeExtensionDescriptorPath('nodes/example-source.json')).toBe(
      true,
    );
  });

  it('fails invalid node descriptors with structured diagnostics', () => {
    const diagnostics = validateExtensionNodeDescriptor({
      type: '',
      version: 0,
      category: 'spaceship',
    });

    expect(codes(diagnostics)).toContain(
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
    );
    expect(
      diagnostics.every(
        (diagnostic) =>
          diagnostic.severity === 'error' &&
          diagnostic.message.length > 0,
      ),
    ).toBe(true);
  });

  it('rejects unsupported executable asset declarations without executing them', () => {
    const spy = jest.fn();
    const manifestWithExecutable = {
      ...buildManifest(),
      main: './index.js',
    };
    const manifestDiagnostics =
      validateExtensionManifest(manifestWithExecutable);
    expect(codes(manifestDiagnostics)).toContain(
      FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
    );

    const descriptorWithFunction = {
      ...buildNodeDescriptor(),
      onValidate: spy,
    };
    const descriptorDiagnostics = validateExtensionNodeDescriptor(
      descriptorWithFunction,
    );
    expect(codes(descriptorDiagnostics)).toContain(
      FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('requires embedded descriptor count to match manifest references', () => {
    const diagnostics = validateExtensionPackage({
      manifest: buildManifest({ nodes: ['a.json', 'b.json'] }),
      nodes: [buildNodeDescriptor()],
    });

    expect(codes(diagnostics)).toContain(FLOW_EXTENSION_INVALID_MANIFEST);
  });

  it('accepts version strings by presence without semver evaluation', () => {
    expect(
      validateExtensionManifest(
        buildManifest({ version: 'not-semver-at-all', manager: 'any' }),
      ),
    ).toEqual([]);
  });
});
