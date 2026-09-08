import type {
  FlowEkuiperRuntimeMapping,
  FlowNodeDefinition,
} from '../registry/node-definition';
export type { FlowEkuiperRuntimeMapping } from '../registry/node-definition';
export {
  FLOW_EKUIPER_RUNTIME_MAPPING_KEYS,
  FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
  validateFlowEkuiperRuntimeMapping,
} from '../registry/node-definition';

/**
 * Internal v1alpha1 declarative extension manifest target (FS-0111).
 *
 * Mirrors the design target in `EXTENSION_SPEC.md` section 3. This module
 * defines the manifest shape plus the node-descriptor embedding/reference
 * shape sufficient for validation. It performs no filesystem loading and
 * executes no package code; loading and validation land in later tickets.
 */

/** The only manifest apiVersion accepted by the internal v1alpha1 contract. */
export const FLOW_EXTENSION_MANIFEST_API_VERSION =
  'flow.extensions.ekuiper-manager.io/v1alpha1' as const;

/** Manifest apiVersion literal for the internal v1alpha1 contract. */
export type FlowExtensionManifestApiVersion =
  typeof FLOW_EXTENSION_MANIFEST_API_VERSION;

/**
 * Raw declarative extension manifest (parsed `extension.json`).
 *
 * All fields are plain JSON data. There are intentionally no function,
 * component, or hook fields: declarative packages may not ship executable
 * browser JavaScript (see `EXTENSION_SPEC.md` section 4).
 */
export interface FlowExtensionManifest {
  apiVersion: FlowExtensionManifestApiVersion;
  /** Reverse-DNS extension identity, e.g. `com.example.telemetry`. */
  id: string;
  /** Human-readable extension name, e.g. `Example Telemetry`. */
  name: string;
  /** Extension package version, e.g. `1.0.0`. */
  version: string;
  /** Manager version requirement, e.g. `>=2.0.0`. Presence-checked only. */
  manager: string;
  /**
   * Package-relative paths of referenced JSON node descriptor files,
   * e.g. `["nodes/example-source.json"]`. Resolved only against the
   * Manager-controlled `extensions/` root by the later loader ticket.
   */
  nodes: string[];
}

/**
 * Declarative node descriptor for an extension node (FS-0111, FS-0116).
 *
 * Reuses the internal `FlowNodeDefinition` contract directly so built-in
 * and extension nodes share one type system. Extension descriptors use the
 * same Node Definition-compatible fields (identity, display metadata,
 * category, ports, properties, docs/icon metadata); no duplicate
 * incompatible type system is introduced.
 *
 * FS-0116: descriptors may carry an optional declarative eKuiper runtime
 * mapping (`FlowEkuiperRuntimeMapping`, re-exported above as
 * `FlowExtensionRuntimeMapping`): `kind`/`nodeType` plus a direct
 * allowlisted `configKey -> propsKey` property map. Plain JSON data only;
 * never a function, expression, or template. `secret-ref` properties must
 * not be mapped until the secret-binding design allows it.
 */
export type FlowExtensionNodeDescriptor = FlowNodeDefinition;

/** Extension-facing alias for the declarative eKuiper mapping (FS-0116). */
export type FlowExtensionRuntimeMapping = FlowEkuiperRuntimeMapping;

/**
 * Reference to one node descriptor file listed in a manifest.
 *
 * Kept as a distinct object (rather than a bare string) so validation can
 * carry the raw entry alongside its source index without inventing a new
 * stringly-typed convention later.
 */
export interface FlowExtensionNodeReference {
  /** Package-relative descriptor path exactly as listed in the manifest. */
  path: string;
}

/**
 * Embedded (already-loaded) extension package shape.
 *
 * Pairs a manifest with its resolved node descriptors. The manifest keeps
 * the reference form (`nodes: string[]`); this package carries the
 * embedded definitions side-by-side so validation/registry tickets can
 * operate on one value without filesystem access.
 */
export interface FlowExtensionPackage {
  manifest: FlowExtensionManifest;
  nodes: FlowExtensionNodeDescriptor[];
}
