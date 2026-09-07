import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  FLOW_EXTENSION_LOAD_INVALID_JSON,
  FLOW_EXTENSION_LOAD_IO_ERROR,
  FLOW_EXTENSION_LOAD_OUTSIDE_ROOT,
  FLOW_EXTENSION_LOAD_TOO_LARGE,
  FLOW_LOCAL_EXTENSION_MAX_MANIFEST_BYTES,
  isSafeLocalExtensionName,
  loadAllLocalExtensions,
  loadLocalExtension,
  resolveLocalExtensionDir,
} from '@/lib/flows/extensions/load-local-extensions';
import { FLOW_EXTENSION_INVALID_MANIFEST } from '@/lib/flows/extensions/validate-extension';

const MANIFEST_FILE = 'extension.json';

function buildManifest(nodes: string[] = ['nodes/example-source.json']) {
  return {
    apiVersion: 'flow.extensions.ekuiper-manager.io/v1alpha1',
    id: 'com.example.telemetry',
    name: 'Example Telemetry',
    version: '1.0.0',
    manager: '>=2.0.0',
    nodes,
  };
}

function buildDescriptor() {
  return {
    type: 'example-source',
    version: 1,
    displayName: 'Example Source',
    description: 'Declarative test source.',
    category: 'source',
    inputs: [],
    outputs: [{ id: 'out', kind: 'stream' }],
    properties: [{ key: 'topic', label: 'Topic', type: 'string' }],
  };
}

async function writeExtension(
  rootDir: string,
  extensionName: string,
  manifestText: string,
  descriptors: Record<string, string> = {},
): Promise<void> {
  const extensionDir = path.join(rootDir, extensionName);
  await mkdir(path.join(extensionDir, 'nodes'), { recursive: true });
  await writeFile(path.join(extensionDir, MANIFEST_FILE), manifestText, 'utf8');
  for (const [relativePath, text] of Object.entries(descriptors)) {
    const absolutePath = path.join(extensionDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text, 'utf8');
  }
}

async function writeValidExtension(
  rootDir: string,
  extensionName = 'com.example.telemetry',
): Promise<void> {
  await writeExtension(rootDir, extensionName, JSON.stringify(buildManifest()), {
    'nodes/example-source.json': JSON.stringify(buildDescriptor()),
  });
}

describe('flow local extension loader', () => {
  it('loads a valid fixture package', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'flow-ext-'));
    await writeValidExtension(rootDir);

    const result = await loadLocalExtension('com.example.telemetry', {
      rootDir,
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.extensionPackage?.manifest.id).toBe('com.example.telemetry');
    expect(result.extensionPackage?.nodes).toHaveLength(1);
    expect(result.extensionPackage?.nodes[0]?.type).toBe('example-source');
  });

  it('rejects outside-root names before any filesystem access', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'flow-ext-'));
    const missingRoot = path.join(rootDir, 'no-such-root');
    for (const name of [
      '../evil',
      '..',
      '/abs/path',
      'C:\\evil',
      'a/b',
      '',
      '.',
      '.hidden',
    ]) {
      expect(isSafeLocalExtensionName(name)).toBe(false);
      expect(resolveLocalExtensionDir(name, missingRoot)).toBeUndefined();
      // Uses a root that does not exist to prove rejection happens before IO.
      const result = await loadLocalExtension(name, {
        rootDir: missingRoot,
      });
      expect(result.ok).toBe(false);
      expect(result.extensionPackage).toBeUndefined();
      expect(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === FLOW_EXTENSION_LOAD_OUTSIDE_ROOT,
        ),
      ).toBe(true);
    }
  });

  it('rejects invalid manifest JSON without executing anything', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'flow-ext-'));
    await writeExtension(rootDir, 'bad-json', '{not valid json');

    const result = await loadLocalExtension('bad-json', { rootDir });

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === FLOW_EXTENSION_LOAD_INVALID_JSON,
      ),
    ).toBe(true);
  });

  it('rejects an invalid manifest with structured validation diagnostics', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'flow-ext-'));
    await writeExtension(
      rootDir,
      'bad-manifest',
      JSON.stringify({ apiVersion: 'wrong' }),
    );

    const result = await loadLocalExtension('bad-manifest', { rootDir });

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === FLOW_EXTENSION_INVALID_MANIFEST,
      ),
    ).toBe(true);
  });

  it('rejects oversized manifest files above the documented cap', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'flow-ext-'));
    const oversized = {
      ...buildManifest(),
      padding: 'x'.repeat(FLOW_LOCAL_EXTENSION_MAX_MANIFEST_BYTES + 1024),
    };
    await writeExtension(rootDir, 'too-big', JSON.stringify(oversized), {
      'nodes/example-source.json': JSON.stringify(buildDescriptor()),
    });

    const result = await loadLocalExtension('too-big', { rootDir });

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === FLOW_EXTENSION_LOAD_TOO_LARGE,
      ),
    ).toBe(true);
  });

  it('reports a missing extension as a safe IO diagnostic', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'flow-ext-'));

    const result = await loadLocalExtension('missing-extension', { rootDir });

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === FLOW_EXTENSION_LOAD_IO_ERROR,
      ),
    ).toBe(true);
  });

  it('loads the valid package while isolating failures via loadAll', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'flow-ext-'));
    await writeValidExtension(rootDir, 'aaa-valid');
    await writeExtension(rootDir, 'zzz-broken', '{not valid json');

    const result = await loadAllLocalExtensions({ rootDir });

    expect(result.extensions).toHaveLength(1);
    expect(result.extensions[0]?.manifest.id).toBe('com.example.telemetry');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.extensionName).toBe('zzz-broken');
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('returns empty success for a missing extensions root', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'flow-ext-'));
    const result = await loadAllLocalExtensions({
      rootDir: path.join(rootDir, 'no-such-root'),
    });

    expect(result).toEqual({ extensions: [], failures: [], diagnostics: [] });
  });

  it('contains no dynamic import, eval, or require of extension files', async () => {
    const sourcePath = path.resolve(
      process.cwd(),
      'src/lib/flows/extensions/load-local-extensions.ts',
    );
    const source = await readFile(sourcePath, 'utf8');

    expect(source).not.toMatch(/(?<![A-Za-z_$])import\s*\(/);
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
    expect(source).not.toMatch(/child_process/);
  });
});
