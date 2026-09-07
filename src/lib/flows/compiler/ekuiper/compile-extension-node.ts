import type { TargetCapabilityProfile } from '../../capabilities/types';
import type { FlowIrNode } from '../../ir/flow-ir';
import type { FlowDiagnostic } from '../../model/diagnostic';
import {
  FLOW_CAPABILITY_UNAVAILABLE,
  FLOW_UNKNOWN_NODE_TYPE,
} from '../../model/diagnostic';
import type { FlowNodeDefinition } from '../../registry/node-definition';
import {
  FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
  FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
  validateFlowEkuiperRuntimeMapping,
} from '../../registry/node-definition';
import type { EkuiperGraphNode } from './graph-types';

/**
 * Declarative extension node compiler (FS-0117).
 *
 * Converts one IR node whose definition carries a validated declarative
 * eKuiper runtime mapping (`FlowEkuiperRuntimeMapping`, FS-0116) into an
 * audited eKuiper graph node entry (`type` / `nodeType` / `props` per
 * `public/ekuiper-openapi.json` eKuiper 2.4.1 schema `RuleGraph`).
 *
 * Rules:
 * - config keys copy verbatim into `props` exactly per the mapping
 *   allowlist (`configKey -> propsKey`); unlisted config is never mapped;
 * - no extension code is ever executed: function-valued mapping or config
 *   content is reported, never called;
 * - the capability requirement (mapping `kind`/`nodeType`, or an explicit
 *   `requiresCapability` when the definition carries one) must be satisfied
 *   by the supplied target profile before compile;
 * - output is deterministic for the same input (sorted allowlist order,
 *   no randomness/clock).
 *
 * Every user-correctable failure is returned as a structured
 * `FlowDiagnostic` (never a thrown string); only a failure to clone a
 * plain JSON value would throw as an internal invariant violation, and
 * configs reaching this compiler are JSON-compatible by construction.
 */

export interface CompileExtensionNodeOptions {
  /**
   * Normalized target capability profile. When omitted the capability
   * requirement is treated as satisfied so callers that do not track
   * capabilities (including every pre-FS-0117 caller) keep compiling.
   */
  capabilities?: TargetCapabilityProfile;
}

/** IR kinds permitted as a mapping `kind` (mirrors the graph `type`). */
const EXTENSION_IR_KINDS = ['source', 'operator', 'sink'] as const;

type ExtensionIrKind = (typeof EXTENSION_IR_KINDS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Report whether a definition carries a declarative eKuiper runtime
 * mapping object (FS-0116 `runtimeMapping`). Pure read; never throws for
 * well-typed input.
 */
export function hasExtensionRuntimeMapping(
  definition: FlowNodeDefinition,
): boolean {
  return isRecord(definition.runtimeMapping);
}

/**
 * Derive IR identity (`kind`/`operation`) for an extension definition.
 *
 * The FS-0117 compiler builds IR through the shared `buildFlowIr`, which
 * requires `runtimeKind`/`operation` metadata that extension descriptors
 * intentionally do not author (they author `runtimeMapping` instead). This
 * helper bridges the two: `kind` mirrors the mapping `kind` and
 * `operation` mirrors the mapping `nodeType`, so IR identity already reads
 * as the eKuiper graph address.
 *
 * Malformed mappings still yield a placeholder identity (`operator` /
 * `extension-invalid`, or the valid half when only one half is usable) so
 * that IR construction succeeds and the precise mapping diagnostic is
 * produced by {@link compileExtensionNode} rather than masked as an
 * unknown-type failure. Returns undefined only when the definition carries
 * no mapping object at all.
 */
export function resolveExtensionIrMetadata(
  definition: FlowNodeDefinition,
): { kind: ExtensionIrKind; operation: string } | undefined {
  const mapping = definition.runtimeMapping;
  if (!isRecord(mapping)) {
    return undefined;
  }
  const kind: unknown = mapping['kind'];
  const nodeType: unknown = mapping['nodeType'];
  return {
    kind: (
      EXTENSION_IR_KINDS as readonly string[]
    ).includes(kind as string)
      ? (kind as ExtensionIrKind)
      : 'operator',
    operation:
      typeof nodeType === 'string' && nodeType.length > 0
        ? nodeType
        : 'extension-invalid',
  };
}

interface ExtensionCapabilityRequirement {
  kind: ExtensionIrKind;
  name: string;
}

function readExplicitRequirement(
  definition: FlowNodeDefinition,
): ExtensionCapabilityRequirement | null {
  const candidate: unknown = (
    definition as FlowNodeDefinition & {
      requiresCapability?: unknown;
    }
  ).requiresCapability;
  if (!isRecord(candidate)) {
    return null;
  }
  const kind: unknown = candidate['kind'];
  const name: unknown = candidate['name'];
  if (
    (kind === 'source' || kind === 'operator' || kind === 'sink') &&
    typeof name === 'string' &&
    name.length > 0
  ) {
    return { kind, name };
  }
  return null;
}

function requirementFor(
  definition: FlowNodeDefinition,
): ExtensionCapabilityRequirement | null {
  const explicit = readExplicitRequirement(definition);
  if (explicit !== null) {
    return explicit;
  }
  const mapping = definition.runtimeMapping;
  if (!isRecord(mapping)) {
    return null;
  }
  const kind: unknown = mapping['kind'];
  const nodeType: unknown = mapping['nodeType'];
  if (
    (kind === 'source' || kind === 'operator' || kind === 'sink') &&
    typeof nodeType === 'string' &&
    nodeType.length > 0
  ) {
    return { kind, name: nodeType };
  }
  return null;
}

function profileSetFor(
  profile: TargetCapabilityProfile,
  kind: ExtensionIrKind,
): readonly string[] {
  if (kind === 'source') {
    return profile.sources;
  }
  if (kind === 'sink') {
    return profile.sinks;
  }
  return profile.operators;
}

function checkCapabilities(
  definition: FlowNodeDefinition,
  irNodeId: string,
  profile: TargetCapabilityProfile,
): FlowDiagnostic | null {
  const requirement = requirementFor(definition);
  if (requirement === null) {
    return null;
  }
  if (!profile.graphRules) {
    return {
      code: FLOW_CAPABILITY_UNAVAILABLE,
      severity: 'error',
      message:
        `Flow node "${irNodeId}" requires ${requirement.kind} ` +
        `"${requirement.name}" but this target does not support graph rules.`,
      nodeId: irNodeId,
    };
  }
  const supported = profileSetFor(profile, requirement.kind).some(
    (entry) => entry.toLowerCase() === requirement.name.toLowerCase(),
  );
  if (supported) {
    return null;
  }
  return {
    code: FLOW_CAPABILITY_UNAVAILABLE,
    severity: 'error',
    message:
      `Flow node "${irNodeId}" requires ${requirement.kind} ` +
      `"${requirement.name}" unavailable on this target.`,
    nodeId: irNodeId,
  };
}

/**
 * Compile one extension IR node through its declarative mapping.
 *
 * The definition's `runtimeMapping` is re-validated here (against the
 * declared properties, so undeclared `configKey` entries and `secret-ref`
 * mappings fail) even when an earlier validation stage already approved
 * it: the compiler never trusts unvalidated input. Props are built in
 * sorted `configKey` order so output is deterministic.
 */
export function compileExtensionNode(
  irNode: FlowIrNode,
  definition: FlowNodeDefinition,
  options: CompileExtensionNodeOptions = {},
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const mapping = definition.runtimeMapping;
  if (!isRecord(mapping)) {
    return {
      diagnostic: {
        code: FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
        severity: 'error',
        message:
          `Flow node "${irNode.id}" has no declarative eKuiper runtime mapping.`,
        nodeId: irNode.id,
      },
    };
  }

  const mappingDiagnostics = validateFlowEkuiperRuntimeMapping(
    mapping,
    definition.properties,
  );
  if (mappingDiagnostics.length > 0) {
    const first = mappingDiagnostics[0] as FlowDiagnostic;
    return {
      diagnostic: { ...first, nodeId: irNode.id },
    };
  }

  if (options.capabilities !== undefined) {
    const capabilityDiagnostic = checkCapabilities(
      definition,
      irNode.id,
      options.capabilities,
    );
    if (capabilityDiagnostic !== null) {
      return { diagnostic: capabilityDiagnostic };
    }
  }

  const properties = mapping['properties'] as Record<string, string>;
  const props: Record<string, unknown> = {};
  for (const configKey of Object.keys(properties).sort()) {
    if (!Object.hasOwn(irNode.config, configKey)) {
      continue;
    }
    const value: unknown = irNode.config[configKey];
    if (value === undefined) {
      continue;
    }
    if (typeof value === 'function') {
      return {
        diagnostic: {
          code: FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
          severity: 'error',
          message:
            `Flow node "${irNode.id}" config key "${configKey}" holds an ` +
            `unsupported executable value. Extension config is data only and is never executed.`,
          nodeId: irNode.id,
          propertyPath: configKey,
        },
      };
    }
    props[properties[configKey] as string] = structuredClone(value);
  }

  const kind = mapping['kind'] as ExtensionIrKind;
  const nodeType = mapping['nodeType'] as string;
  if (
    !(EXTENSION_IR_KINDS as readonly string[]).includes(kind) ||
    typeof nodeType !== 'string' ||
    nodeType.length === 0
  ) {
    return {
      diagnostic: {
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message:
          `Flow node "${irNode.id}" carries an eKuiper runtime mapping this ` +
          `compiler version cannot map to a graph node.`,
        nodeId: irNode.id,
      },
    };
  }

  return {
    node: {
      type: kind,
      nodeType,
      props,
    },
  };
}
