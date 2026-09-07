import type { FlowDiagnostic } from '../model/diagnostic';
import { FLOW_EXTENSION_MANIFEST_API_VERSION } from './types';

/**
 * Declarative extension validation without a schema dependency (FS-0112).
 *
 * Explicit TypeScript runtime checks over the internal v1alpha1 manifest
 * target from `EXTENSION_SPEC.md` section 3 plus the basic
 * Node Definition-compatible descriptor structure from FS-0111. There is
 * intentionally no zod/ajv/semver dependency: version and manager
 * requirements are presence-checked as safe strings only.
 *
 * All validators return structured `FlowDiagnostic[]` (empty means valid),
 * never throw for JSON-compatible input, never mutate their input, and
 * never execute extension code: there is no dynamic import, require, or
 * eval here, and function-valued or executable-asset fields are reported
 * as diagnostics instead of being run.
 */

/** Manifest envelope is not an object or misses required identity fields. */
export const FLOW_EXTENSION_INVALID_MANIFEST =
  'FLOW_EXTENSION_INVALID_MANIFEST' as const;
/** A referenced node descriptor path escapes or leaves the package root. */
export const FLOW_EXTENSION_UNSAFE_NODE_PATH =
  'FLOW_EXTENSION_UNSAFE_NODE_PATH' as const;
/** An executable asset declaration or function value is not supported. */
export const FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED =
  'FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED' as const;
/** A node descriptor misses required Node Definition-compatible fields. */
export const FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR =
  'FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR' as const;

/**
 * Top-level keys that would declare executable assets and are therefore
 * unsupported in declarative extension packages (see `EXTENSION_SPEC.md`
 * section 4: no executable browser JavaScript, no shell, no npm install
 * into Manager). Presence of any of these keys fails validation with a
 * structured diagnostic; the referenced asset is never loaded or run.
 */
export const FLOW_EXTENSION_EXECUTABLE_KEYS = [
  'main',
  'module',
  'browser',
  'bin',
  'scripts',
  'script',
  'code',
  'js',
  'entry',
  'entrypoint',
  'hooks',
  'hook',
  'runtime',
  'component',
  'components',
  'render',
  'execute',
  'preload',
  'setup',
  'install',
  'postinstall',
] as const;

/** Node descriptor categories shared with the Node Definition contract. */
const FLOW_EXTENSION_NODE_CATEGORIES = [
  'source',
  'transform',
  'streaming',
  'routing',
  'sink',
] as const;

/** Port kinds shared with the Node Definition contract. */
const FLOW_EXTENSION_PORT_KINDS = [
  'stream',
  'collection',
  'table',
  'any',
] as const;

/** Property types shared with the Node Definition contract. */
const FLOW_EXTENSION_PROPERTY_TYPES = [
  'string',
  'number',
  'boolean',
  'select',
  'json',
  'expression',
  'secret-ref',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function push(
  diagnostics: FlowDiagnostic[],
  code: string,
  message: string,
  propertyPath?: string,
): void {
  diagnostics.push({
    code,
    severity: 'error',
    message,
    ...(propertyPath === undefined ? {} : { propertyPath }),
  });
}

/**
 * Narrow a manifest `nodes` entry to a safe package-relative descriptor
 * path (FS-0112, reused by the FS-0113 loader).
 *
 * Accepts only relative `.json` paths that stay inside the
 * Manager-controlled `extensions/` root: rejects `..` segments, absolute
 * paths (POSIX `/`, Windows `\`, drive-letter `C:` and UNC `\\` forms),
 * empty segments, and directory references. Pure read; never touches the
 * filesystem.
 */
export function isSafeExtensionDescriptorPath(
  value: unknown,
): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  if (value.includes('\0')) {
    return false;
  }
  if (
    value.startsWith('/') ||
    value.startsWith('\\') ||
    /^[A-Za-z]:/.test(value)
  ) {
    return false;
  }
  const segments = value.split(/[/\\]/);
  for (const segment of segments) {
    if (segment === '' || segment === '..') {
      return false;
    }
  }
  if (!value.toLowerCase().endsWith('.json')) {
    return false;
  }
  return true;
}

/**
 * Find the first function value nested in plain JSON-compatible data.
 *
 * Returns the dotted key path of the offending value, or undefined when
 * no function value is present. Used to reject executable function fields
 * without ever calling them. Input is assumed JSON-compatible (parsed
 * manifest/descriptor data), matching the surrounding validation style.
 */
function findFunctionValuePath(value: unknown, path: string): string | undefined {
  if (typeof value === 'function') {
    return path;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findFunctionValuePath(value[index], `${path}[${index}]`);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      const found = findFunctionValuePath(
        value[key],
        path.length === 0 ? key : `${path}.${key}`,
      );
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

function rejectExecutableDeclarations(
  record: Record<string, unknown>,
  prefix: string,
  diagnostics: FlowDiagnostic[],
): void {
  for (const key of FLOW_EXTENSION_EXECUTABLE_KEYS) {
    if (record[key] !== undefined) {
      push(
        diagnostics,
        FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
        `Extension declares unsupported executable asset "${key}". ` +
          `Declarative extensions may not ship executable code.`,
        prefix.length === 0 ? key : `${prefix}.${key}`,
      );
    }
  }
  const functionPath = findFunctionValuePath(
    record,
    prefix.length === 0 ? '' : prefix,
  );
  if (functionPath !== undefined && functionPath.length > 0) {
    push(
      diagnostics,
      FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
      `Extension declares unsupported executable function at "${functionPath}". ` +
        `Declarative extensions may not ship executable code.`,
      functionPath,
    );
  }
}

function validateNodePorts(
  value: unknown,
  prefix: string,
  side: 'inputs' | 'outputs',
  diagnostics: FlowDiagnostic[],
): void {
  const path = prefix.length === 0 ? side : `${prefix}.${side}`;
  if (!Array.isArray(value)) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      `Extension node ${side} must be an array.`,
      path,
    );
    return;
  }
  value.forEach((port, index) => {
    const portPath = `${path}[${index}]`;
    if (!isRecord(port)) {
      push(
        diagnostics,
        FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
        `Extension node ${side === 'inputs' ? 'input' : 'output'} must be an object.`,
        portPath,
      );
      return;
    }
    if (!isNonEmptyString(port['id'])) {
      push(
        diagnostics,
        FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
        `Extension node ${side === 'inputs' ? 'input' : 'output'} id must be a non-empty string.`,
        `${portPath}.id`,
      );
    }
    if (
      typeof port['kind'] !== 'string' ||
      !(FLOW_EXTENSION_PORT_KINDS as readonly string[]).includes(port['kind'])
    ) {
      push(
        diagnostics,
        FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
        `Extension node ${side === 'inputs' ? 'input' : 'output'} kind must be one of ${FLOW_EXTENSION_PORT_KINDS.join(', ')}.`,
        `${portPath}.kind`,
      );
    }
  });
}

function validateNodeProperties(
  value: unknown,
  prefix: string,
  diagnostics: FlowDiagnostic[],
): void {
  const path = prefix.length === 0 ? 'properties' : `${prefix}.properties`;
  if (!Array.isArray(value)) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      'Extension node properties must be an array.',
      path,
    );
    return;
  }
  value.forEach((property, index) => {
    const propertyPath = `${path}[${index}]`;
    if (!isRecord(property)) {
      push(
        diagnostics,
        FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
        'Extension node property must be an object.',
        propertyPath,
      );
      return;
    }
    if (!isNonEmptyString(property['key'])) {
      push(
        diagnostics,
        FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
        'Extension node property key must be a non-empty string.',
        `${propertyPath}.key`,
      );
    }
    if (!isNonEmptyString(property['label'])) {
      push(
        diagnostics,
        FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
        'Extension node property label must be a non-empty string.',
        `${propertyPath}.label`,
      );
    }
    if (
      typeof property['type'] !== 'string' ||
      !(FLOW_EXTENSION_PROPERTY_TYPES as readonly string[]).includes(
        property['type'],
      )
    ) {
      push(
        diagnostics,
        FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
        `Extension node property type must be one of ${FLOW_EXTENSION_PROPERTY_TYPES.join(', ')}.`,
        `${propertyPath}.type`,
      );
    }
  });
}

/**
 * Validate one Node Definition-compatible extension node descriptor.
 *
 * Checks identity (type, version), display metadata, category, ports, and
 * properties at the basic structural level, plus the no-executable-code
 * policy. Returns structured diagnostics; empty means valid. Never throws
 * for JSON-compatible input and never mutates its input.
 */
export function validateExtensionNodeDescriptor(
  value: unknown,
  prefix = '',
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];
  if (!isRecord(value)) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      'Extension node descriptor must be an object.',
      prefix.length === 0 ? undefined : prefix,
    );
    return diagnostics;
  }

  if (!isNonEmptyString(value['type'])) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      'Extension node type must be a non-empty string.',
      prefix.length === 0 ? 'type' : `${prefix}.type`,
    );
  }
  if (
    typeof value['version'] !== 'number' ||
    !Number.isInteger(value['version']) ||
    (value['version'] as number) < 1
  ) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      'Extension node version must be an integer of at least 1.',
      prefix.length === 0 ? 'version' : `${prefix}.version`,
    );
  }
  if (!isNonEmptyString(value['displayName'])) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      'Extension node displayName must be a non-empty string.',
      prefix.length === 0 ? 'displayName' : `${prefix}.displayName`,
    );
  }
  if (typeof value['description'] !== 'string') {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      'Extension node description must be a string.',
      prefix.length === 0 ? 'description' : `${prefix}.description`,
    );
  }
  if (
    typeof value['category'] !== 'string' ||
    !(FLOW_EXTENSION_NODE_CATEGORIES as readonly string[]).includes(
      value['category'],
    )
  ) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      `Extension node category must be one of ${FLOW_EXTENSION_NODE_CATEGORIES.join(', ')}.`,
      prefix.length === 0 ? 'category' : `${prefix}.category`,
    );
  }

  validateNodePorts(value['inputs'], prefix, 'inputs', diagnostics);
  validateNodePorts(value['outputs'], prefix, 'outputs', diagnostics);
  validateNodeProperties(value['properties'], prefix, diagnostics);
  rejectExecutableDeclarations(value, prefix, diagnostics);

  return diagnostics;
}

function validateManifestNodeReferences(
  value: unknown,
  prefix: string,
  diagnostics: FlowDiagnostic[],
): string[] {
  const path = prefix.length === 0 ? 'nodes' : `${prefix}.nodes`;
  if (!Array.isArray(value)) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      'Extension manifest nodes must be an array of descriptor paths.',
      path,
    );
    return [];
  }
  if (value.length === 0) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      'Extension manifest nodes must list at least one descriptor path.',
      path,
    );
    return [];
  }
  const valid: string[] = [];
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isSafeExtensionDescriptorPath(entry)) {
      push(
        diagnostics,
        typeof entry === 'string'
          ? FLOW_EXTENSION_UNSAFE_NODE_PATH
          : FLOW_EXTENSION_INVALID_MANIFEST,
        typeof entry === 'string'
          ? `Extension manifest node path "${entry}" is unsafe. ` +
              `Paths must be relative .json files inside the extension package (no "..", no absolute paths).`
          : 'Extension manifest node path must be a string.',
        entryPath,
      );
      return;
    }
    valid.push(entry);
  });
  return valid;
}

/**
 * Validate one raw declarative extension manifest (parsed
 * `extension.json`).
 *
 * Checks the v1alpha1 apiVersion, identity/version presence
 * (`id`, `name`, `version`, `manager` as safe strings only — no semver
 * range evaluation and no new dependency), the referenced descriptor
 * paths (rejecting traversal and absolute paths), and the
 * no-executable-code policy. Returns structured diagnostics; empty means
 * valid. Never throws for JSON-compatible input and never mutates input.
 */
export function validateExtensionManifest(
  value: unknown,
  prefix = '',
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];
  if (!isRecord(value)) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      'Extension manifest must be an object.',
      prefix.length === 0 ? undefined : prefix,
    );
    return diagnostics;
  }

  if (value['apiVersion'] !== FLOW_EXTENSION_MANIFEST_API_VERSION) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      `Extension manifest apiVersion must be "${FLOW_EXTENSION_MANIFEST_API_VERSION}".`,
      prefix.length === 0 ? 'apiVersion' : `${prefix}.apiVersion`,
    );
  }
  if (!isNonEmptyString(value['id'])) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      'Extension manifest id must be a non-empty string.',
      prefix.length === 0 ? 'id' : `${prefix}.id`,
    );
  }
  if (!isNonEmptyString(value['name'])) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      'Extension manifest name must be a non-empty string.',
      prefix.length === 0 ? 'name' : `${prefix}.name`,
    );
  }
  if (!isNonEmptyString(value['version'])) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      'Extension manifest version must be a non-empty string.',
      prefix.length === 0 ? 'version' : `${prefix}.version`,
    );
  }
  if (!isNonEmptyString(value['manager'])) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      'Extension manifest manager requirement must be a non-empty string.',
      prefix.length === 0 ? 'manager' : `${prefix}.manager`,
    );
  }

  validateManifestNodeReferences(value['nodes'], prefix, diagnostics);
  rejectExecutableDeclarations(value, prefix, diagnostics);

  return diagnostics;
}

/**
 * Validate one embedded extension package (manifest plus its resolved
 * node descriptors, per the FS-0111 `FlowExtensionPackage` shape).
 *
 * Runs manifest and per-descriptor validation, then requires the embedded
 * descriptor count to match the manifest reference count so a package can
 * never silently drop or invent nodes. Returns structured diagnostics;
 * empty means valid. Never throws for JSON-compatible input, never
 * mutates its input, and never executes package code.
 */
export function validateExtensionPackage(value: unknown): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];
  if (!isRecord(value)) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      'Extension package must be an object.',
    );
    return diagnostics;
  }

  diagnostics.push(...validateExtensionManifest(value['manifest'], 'manifest'));

  const nodes = value['nodes'];
  if (!Array.isArray(nodes)) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_NODE_DESCRIPTOR,
      'Extension package nodes must be an array of descriptors.',
      'nodes',
    );
    return diagnostics;
  }
  nodes.forEach((node, index) => {
    diagnostics.push(
      ...validateExtensionNodeDescriptor(node, `nodes[${index}]`),
    );
  });

  const manifest = value['manifest'];
  if (
    isRecord(manifest) &&
    Array.isArray(manifest['nodes']) &&
    manifest['nodes'].length !== nodes.length
  ) {
    push(
      diagnostics,
      FLOW_EXTENSION_INVALID_MANIFEST,
      `Extension package embeds ${nodes.length} descriptor(s) but the manifest references ${manifest['nodes'].length}.`,
      'nodes',
    );
  }

  return diagnostics;
}
