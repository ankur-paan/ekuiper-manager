import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { FlowDiagnostic } from '../model/diagnostic';
import type { FlowExtensionPackage } from './types';
import {
  FLOW_EXTENSION_INVALID_MANIFEST,
  isSafeExtensionDescriptorPath,
  validateExtensionManifest,
  validateExtensionPackage,
} from './validate-extension';

/**
 * Read-only local extension directory loader (FS-0113).
 *
 * Loads declarative extension packages from the fixed Manager-controlled
 * `extensions/` root only. Callers supply a bare extension directory name;
 * they can never supply a caller-controlled path. All file access is plain
 * UTF-8 JSON reads followed by `JSON.parse` plus the FS-0112 validators.
 * There is intentionally no dynamic `import`, no `require`, no `eval`, no
 * zip upload/install, and no remote registry access in this module.
 *
 * Server-only: uses `node:fs/promises`. Do not import from client bundles.
 */

/** Extension directory name at the repository root owned by Manager. */
export const FLOW_LOCAL_EXTENSIONS_DIRNAME = 'extensions' as const;

/** Manifest filename inside each extension directory. */
export const FLOW_LOCAL_EXTENSION_MANIFEST_FILENAME =
  'extension.json' as const;

/**
 * Conservative size caps for extension config metadata (FS-0113).
 *
 * Extension packages are plain JSON authoring metadata (manifest plus node
 * descriptors), never code or bulk data. The caps below are generous for
 * that purpose while bounding what the loader will read/parse:
 *
 * - manifest: 64 KiB (identity plus a list of descriptor paths);
 * - one descriptor: 128 KiB (ports/properties/display metadata);
 * - descriptors per package: 32 entries;
 * - whole package on disk (manifest + descriptors): 1 MiB.
 */
export const FLOW_LOCAL_EXTENSION_MAX_MANIFEST_BYTES: number = 64 * 1024;
export const FLOW_LOCAL_EXTENSION_MAX_DESCRIPTOR_BYTES: number = 128 * 1024;
export const FLOW_LOCAL_EXTENSION_MAX_DESCRIPTORS: number = 32;
export const FLOW_LOCAL_EXTENSION_MAX_PACKAGE_BYTES: number = 1024 * 1024;

/** Extension directory name escapes or leaves the managed root. */
export const FLOW_EXTENSION_LOAD_OUTSIDE_ROOT =
  'FLOW_EXTENSION_LOAD_OUTSIDE_ROOT' as const;
/** A file or package exceeds the documented size caps. */
export const FLOW_EXTENSION_LOAD_TOO_LARGE =
  'FLOW_EXTENSION_LOAD_TOO_LARGE' as const;
/** A file is not parseable JSON. */
export const FLOW_EXTENSION_LOAD_INVALID_JSON =
  'FLOW_EXTENSION_LOAD_INVALID_JSON' as const;
/** A file is missing or unreadable. */
export const FLOW_EXTENSION_LOAD_IO_ERROR =
  'FLOW_EXTENSION_LOAD_IO_ERROR' as const;

/**
 * Fixed Manager-controlled extensions root (`<repo>/extensions`).
 *
 * Pure read of `process.cwd()`; callers cannot change it through the load
 * API. Tests may pass an explicit `rootDir` override so they never touch
 * the real checkout; production callers omit it.
 */
export function getFlowLocalExtensionsRoot(): string {
  return path.resolve(process.cwd(), FLOW_LOCAL_EXTENSIONS_DIRNAME);
}

/** Test-only override carrier; production callers omit `rootDir`. */
export interface FlowLocalExtensionLoadOptions {
  /**
   * Test-only filesystem root. When omitted, the fixed
   * Manager-controlled root from `getFlowLocalExtensionsRoot()` is used.
   * Even with an override, the extension name is still constrained to a
   * single directory segment inside that root.
   */
  rootDir?: string;
}

/** Outcome of loading one local extension directory. */
export interface FlowLocalExtensionLoadResult {
  /** Bare directory name that was requested (never a path). */
  extensionName: string;
  /** True only when the package loaded and validated cleanly. */
  ok: boolean;
  /** Validated package; present only when `ok` is true. */
  extensionPackage?: FlowExtensionPackage;
  /** Structured load/parse/validation diagnostics; empty on success. */
  diagnostics: FlowDiagnostic[];
}

/** Outcome of scanning the whole local extensions root. */
export interface FlowLocalExtensionLoadAllResult {
  /** Successfully loaded packages, sorted by manifest id. */
  extensions: FlowExtensionPackage[];
  /** Per-extension failures (missing/invalid/oversized), if any. */
  failures: FlowLocalExtensionLoadResult[];
  /**
   * Flattened diagnostics across all failures plus any root-level error.
   * Empty when every discovered extension loaded cleanly (or when the
   * root holds no extensions).
   */
  diagnostics: FlowDiagnostic[];
}

/**
 * Narrow an unknown value to a safe extension directory name.
 *
 * Accepts only a single relative segment (`[A-Za-z0-9][A-Za-z0-9._-]*`):
 * rejects `..`, `.`, empty strings, absolute paths (POSIX `/`, Windows
 * `\`, drive-letter `C:`, UNC `\\`), separators, null bytes, and hidden
 * (dot-leading) names. Pure read; never touches the filesystem.
 */
export function isSafeLocalExtensionName(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  if (value.includes('\0')) {
    return false;
  }
  if (
    value.includes('/') ||
    value.includes('\\') ||
    value === '.' ||
    value === '..' ||
    value.startsWith('.')
  ) {
    return false;
  }
  if (/^[A-Za-z]:/.test(value)) {
    return false;
  }
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function pushDiagnostic(
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
 * Resolve a bare extension name to an absolute directory inside `rootDir`.
 *
 * Returns `undefined` when the name is unsafe or the resolved path would
 * leave the root (defence in depth: the name check above already rejects
 * separators, but the containment check also guards exotic segments).
 * Pure read; never touches the filesystem.
 */
export function resolveLocalExtensionDir(
  extensionName: string,
  rootDir: string,
): string | undefined {
  if (!isSafeLocalExtensionName(extensionName)) {
    return undefined;
  }
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(resolvedRoot, extensionName);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative !== extensionName) {
    return undefined;
  }
  return resolved;
}

function outsideRootResult(extensionName: string): FlowLocalExtensionLoadResult {
  const diagnostics: FlowDiagnostic[] = [];
  pushDiagnostic(
    diagnostics,
    FLOW_EXTENSION_LOAD_OUTSIDE_ROOT,
    `Extension "${String(extensionName)}" is outside the managed extensions root. ` +
      `Only a bare extension directory name inside "${FLOW_LOCAL_EXTENSIONS_DIRNAME}/" can be loaded.`,
    'extensionName',
  );
  return { extensionName: String(extensionName), ok: false, diagnostics };
}

/**
 * Read a UTF-8 JSON file only when it fits `maxBytes`.
 *
 * Returns the text plus its byte length. Oversized files are reported via
 * `tooLarge` without being parsed; missing/unreadable files throw so the
 * caller can normalise them into a single IO diagnostic.
 */
async function readCappedJsonFile(
  absolutePath: string,
  maxBytes: number,
): Promise<{ text: string; byteLength: number; tooLarge: boolean }> {
  const fileStat = await stat(absolutePath);
  if (fileStat.size > maxBytes) {
    return { text: '', byteLength: fileStat.size, tooLarge: true };
  }
  const text = await readFile(absolutePath, 'utf8');
  const byteLength = Buffer.byteLength(text, 'utf8');
  if (byteLength > maxBytes) {
    return { text: '', byteLength, tooLarge: true };
  }
  return { text, byteLength, tooLarge: false };
}

function parseJson(
  text: string,
  context: string,
  diagnostics: FlowDiagnostic[],
  propertyPath: string,
): unknown | undefined {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    pushDiagnostic(
      diagnostics,
      FLOW_EXTENSION_LOAD_INVALID_JSON,
      `${context} is not valid JSON: ${error instanceof Error ? error.message : 'parse error'}.`,
      propertyPath,
    );
    return undefined;
  }
}

/**
 * Load one extension directory from the managed `extensions/` root.
 *
 * `extensionName` must be a bare directory name (see
 * `isSafeLocalExtensionName`); anything else fails with
 * `FLOW_EXTENSION_LOAD_OUTSIDE_ROOT` before any filesystem access, so an
 * outside-root path can never be loaded. Missing/unreadable files become
 * `FLOW_EXTENSION_LOAD_IO_ERROR`, unparseable files become
 * `FLOW_EXTENSION_LOAD_INVALID_JSON`, over-cap files become
 * `FLOW_EXTENSION_LOAD_TOO_LARGE`, and semantic problems surface as the
 * FS-0112 validation diagnostics. Diagnostic messages reference the
 * extension name plus package-relative paths only, never absolute server
 * filesystem paths. Never throws for filesystem/JSON/validation failures;
 * never executes extension content.
 */
export async function loadLocalExtension(
  extensionName: string,
  options: FlowLocalExtensionLoadOptions = {},
): Promise<FlowLocalExtensionLoadResult> {
  const rootDir =
    options.rootDir === undefined
      ? getFlowLocalExtensionsRoot()
      : options.rootDir;
  const extensionDir = resolveLocalExtensionDir(extensionName, rootDir);
  if (extensionDir === undefined) {
    return outsideRootResult(extensionName);
  }

  const manifestRelative = `${extensionName}/${FLOW_LOCAL_EXTENSION_MANIFEST_FILENAME}`;
  let manifestText: string;
  try {
    const read = await readCappedJsonFile(
      path.join(extensionDir, FLOW_LOCAL_EXTENSION_MANIFEST_FILENAME),
      FLOW_LOCAL_EXTENSION_MAX_MANIFEST_BYTES,
    );
    if (read.tooLarge) {
      const diagnostics: FlowDiagnostic[] = [];
      pushDiagnostic(
        diagnostics,
        FLOW_EXTENSION_LOAD_TOO_LARGE,
        `Extension manifest "${manifestRelative}" is ${read.byteLength} bytes, ` +
          `above the ${FLOW_LOCAL_EXTENSION_MAX_MANIFEST_BYTES} byte cap.`,
        manifestRelative,
      );
      return { extensionName, ok: false, diagnostics };
    }
    manifestText = read.text;
  } catch {
    const diagnostics: FlowDiagnostic[] = [];
    pushDiagnostic(
      diagnostics,
      FLOW_EXTENSION_LOAD_IO_ERROR,
      `Extension manifest "${manifestRelative}" is missing or unreadable.`,
      manifestRelative,
    );
    return { extensionName, ok: false, diagnostics };
  }

  const manifestDiagnostics: FlowDiagnostic[] = [];
  const manifestValue = parseJson(
    manifestText,
    `Extension manifest "${manifestRelative}"`,
    manifestDiagnostics,
    manifestRelative,
  );
  if (manifestValue === undefined) {
    return { extensionName, ok: false, diagnostics: manifestDiagnostics };
  }

  const manifestIssues = validateExtensionManifest(manifestValue);
  if (manifestIssues.length > 0) {
    return { extensionName, ok: false, diagnostics: manifestIssues };
  }

  const manifest = manifestValue as { nodes: string[] };
  if (manifest.nodes.length > FLOW_LOCAL_EXTENSION_MAX_DESCRIPTORS) {
    const diagnostics: FlowDiagnostic[] = [];
    pushDiagnostic(
      diagnostics,
      FLOW_EXTENSION_LOAD_TOO_LARGE,
      `Extension "${extensionName}" references ${manifest.nodes.length} descriptor(s), ` +
        `above the ${FLOW_LOCAL_EXTENSION_MAX_DESCRIPTORS} descriptor cap.`,
      `${manifestRelative}#nodes`,
    );
    return { extensionName, ok: false, diagnostics };
  }

  const descriptors: unknown[] = [];
  let packageBytes = Buffer.byteLength(manifestText, 'utf8');
  for (let index = 0; index < manifest.nodes.length; index += 1) {
    const reference = manifest.nodes[index] as string;
    const descriptorRelative = `${extensionName}/${reference}`;
    // Re-check the reference even though manifest validation passed, so a
    // caller can never smuggle an absolute/traversal path to the reader.
    if (!isSafeExtensionDescriptorPath(reference)) {
      const diagnostics: FlowDiagnostic[] = [];
      pushDiagnostic(
        diagnostics,
        FLOW_EXTENSION_LOAD_OUTSIDE_ROOT,
        `Extension node path "${descriptorRelative}" is outside the extension package.`,
        `${manifestRelative}#nodes[${index}]`,
      );
      return { extensionName, ok: false, diagnostics };
    }
    const resolved = path.resolve(extensionDir, reference);
    const withinExtension = path.relative(extensionDir, resolved);
    if (
      withinExtension === '' ||
      withinExtension.startsWith('..') ||
      path.isAbsolute(withinExtension)
    ) {
      const diagnostics: FlowDiagnostic[] = [];
      pushDiagnostic(
        diagnostics,
        FLOW_EXTENSION_LOAD_OUTSIDE_ROOT,
        `Extension node path "${descriptorRelative}" is outside the extension package.`,
        `${manifestRelative}#nodes[${index}]`,
      );
      return { extensionName, ok: false, diagnostics };
    }

    let descriptorText: string;
    try {
      const read = await readCappedJsonFile(
        resolved,
        FLOW_LOCAL_EXTENSION_MAX_DESCRIPTOR_BYTES,
      );
      if (read.tooLarge) {
        const diagnostics: FlowDiagnostic[] = [];
        pushDiagnostic(
          diagnostics,
          FLOW_EXTENSION_LOAD_TOO_LARGE,
          `Extension descriptor "${descriptorRelative}" is ${read.byteLength} bytes, ` +
            `above the ${FLOW_LOCAL_EXTENSION_MAX_DESCRIPTOR_BYTES} byte cap.`,
          descriptorRelative,
        );
        return { extensionName, ok: false, diagnostics };
      }
      descriptorText = read.text;
    } catch {
      const diagnostics: FlowDiagnostic[] = [];
      pushDiagnostic(
        diagnostics,
        FLOW_EXTENSION_LOAD_IO_ERROR,
        `Extension descriptor "${descriptorRelative}" is missing or unreadable.`,
        descriptorRelative,
      );
      return { extensionName, ok: false, diagnostics };
    }

    packageBytes += Buffer.byteLength(descriptorText, 'utf8');
    if (packageBytes > FLOW_LOCAL_EXTENSION_MAX_PACKAGE_BYTES) {
      const diagnostics: FlowDiagnostic[] = [];
      pushDiagnostic(
        diagnostics,
        FLOW_EXTENSION_LOAD_TOO_LARGE,
        `Extension "${extensionName}" exceeds the ${FLOW_LOCAL_EXTENSION_MAX_PACKAGE_BYTES} byte package cap.`,
        extensionName,
      );
      return { extensionName, ok: false, diagnostics };
    }

    const descriptorDiagnostics: FlowDiagnostic[] = [];
    const descriptorValue = parseJson(
      descriptorText,
      `Extension descriptor "${descriptorRelative}"`,
      descriptorDiagnostics,
      descriptorRelative,
    );
    if (descriptorValue === undefined) {
      return { extensionName, ok: false, diagnostics: descriptorDiagnostics };
    }
    descriptors.push(descriptorValue);
  }

  const packageIssues = validateExtensionPackage({
    manifest: manifestValue,
    nodes: descriptors,
  });
  if (packageIssues.length > 0) {
    return { extensionName, ok: false, diagnostics: packageIssues };
  }

  return {
    extensionName,
    ok: true,
    extensionPackage: {
      manifest: manifestValue as FlowExtensionPackage['manifest'],
      nodes: descriptors as FlowExtensionPackage['nodes'],
    },
    diagnostics: [],
  };
}

/**
 * Load every extension directory found in the managed `extensions/` root.
 *
 * A missing root (fresh checkout with only `.gitkeep`) yields an empty
 * success rather than an error. Per-extension parse/validation failures
 * are collected into `failures`/`diagnostics`; one bad package never
 * prevents the remaining packages from loading. Successful packages are
 * sorted by manifest id for deterministic output. Never throws for
 * filesystem/JSON/validation failures; never executes extension content.
 */
export async function loadAllLocalExtensions(
  options: FlowLocalExtensionLoadOptions = {},
): Promise<FlowLocalExtensionLoadAllResult> {
  const rootDir =
    options.rootDir === undefined
      ? getFlowLocalExtensionsRoot()
      : options.rootDir;
  let entries: string[];
  try {
    entries = await readdir(rootDir);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT'
    ) {
      return { extensions: [], failures: [], diagnostics: [] };
    }
    const diagnostics: FlowDiagnostic[] = [];
    pushDiagnostic(
      diagnostics,
      FLOW_EXTENSION_LOAD_IO_ERROR,
      `Extensions root "${FLOW_LOCAL_EXTENSIONS_DIRNAME}/" is unreadable.`,
      FLOW_LOCAL_EXTENSIONS_DIRNAME,
    );
    return { extensions: [], failures: [], diagnostics };
  }

  const names = entries
    .filter((entry) => isSafeLocalExtensionName(entry))
    .sort();
  const extensions: FlowExtensionPackage[] = [];
  const failures: FlowLocalExtensionLoadResult[] = [];
  for (const name of names) {
    const result = await loadLocalExtension(name, { rootDir });
    if (result.ok && result.extensionPackage !== undefined) {
      extensions.push(result.extensionPackage);
    } else if (!result.ok) {
      failures.push(result);
    }
  }
  extensions.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  return {
    extensions,
    failures,
    diagnostics: failures.flatMap((failure) => failure.diagnostics),
  };
}
