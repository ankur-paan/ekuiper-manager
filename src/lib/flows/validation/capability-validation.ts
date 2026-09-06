import type { TargetCapabilityProfile } from '../capabilities/types';
import { FLOW_CAPABILITY_UNAVAILABLE, type FlowDiagnostic } from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';
import type { FlowNodeDefinition } from '../registry/node-definition';
import type { NodeRegistry } from '../registry/node-registry';

/**
 * Optional capability requirement carried by a Flow node definition
 * (FS-0080).
 *
 * NOTE on placement: FS-0080 lists its allowed paths without
 * `src/lib/flows/registry/node-definition.ts`, so this module declares the
 * optional shape here instead of editing that file. `NodeRegistry` clones
 * definitions with `structuredClone`, which preserves extra runtime fields,
 * so a definition registered with `requiresCapability` keeps it at runtime.
 * This validator reads it structurally (see
 * `resolveDefinitionCapabilityRequirement`); definitions without the field
 * fall back to the Flow-type table below. No target version comparison
 * lives here or in any UI consumer: callers pass a normalized
 * `TargetCapabilityProfile` produced only by `resolveTargetCapabilities`.
 */
export interface FlowNodeCapabilityRequirement {
  kind: 'source' | 'operator' | 'sink';
  /** eKuiper `nodeType` identifier (for example `mqtt`, `filter`). */
  name: string;
}

/**
 * A Flow node definition optionally carrying capability metadata.
 * Structurally compatible with `FlowNodeDefinition`: the field is optional
 * and never required for validation to run.
 */
export type CapabilityAwareFlowNodeDefinition = FlowNodeDefinition & {
  requiresCapability?: FlowNodeCapabilityRequirement;
};

export interface DefinitionCapabilityStatus {
  supported: boolean;
  reason?: string;
}

/**
 * Fallback Flow-type to eKuiper `nodeType` capability mapping for the v1
 * built-ins. Values mirror the exact `nodeType` strings the compiler emits
 * in `src/lib/flows/compiler/ekuiper/compile-graph.ts` and the audited
 * baseline sets in `src/lib/flows/capabilities/types.ts`.
 *
 * The `func` script Flow type has no confirmed graph mapping (FS-0078) and
 * is intentionally absent from the baseline operator set (FS-0079), so it
 * maps to operator `func` here and is therefore always reported unavailable
 * until a later ticket confirms support. This keeps the node
 * viewable/editable while failing validation before deployment.
 */
const FLOW_TYPE_CAPABILITY_REQUIREMENTS: Readonly<
  Record<string, FlowNodeCapabilityRequirement>
> = {
  'memory-source': { kind: 'source', name: 'memory' },
  'memory-sink': { kind: 'sink', name: 'memory' },
  'mqtt-source': { kind: 'source', name: 'mqtt' },
  'mqtt-sink': { kind: 'sink', name: 'mqtt' },
  'rest-sink': { kind: 'sink', name: 'rest' },
  'log-sink': { kind: 'sink', name: 'log' },
  filter: { kind: 'operator', name: 'filter' },
  pick: { kind: 'operator', name: 'pick' },
  window: { kind: 'operator', name: 'window' },
  aggregate: { kind: 'operator', name: 'aggfunc' },
  'group-by': { kind: 'operator', name: 'groupby' },
  switch: { kind: 'operator', name: 'switch' },
  sort: { kind: 'operator', name: 'orderby' },
  join: { kind: 'operator', name: 'join' },
  func: { kind: 'operator', name: 'func' },
};

function readExplicitRequirement(
  definition: FlowNodeDefinition,
): FlowNodeCapabilityRequirement | null {
  const candidate = (definition as CapabilityAwareFlowNodeDefinition)
    .requiresCapability;
  if (
    candidate !== undefined &&
    candidate !== null &&
    typeof candidate === 'object' &&
    (candidate.kind === 'source' ||
      candidate.kind === 'operator' ||
      candidate.kind === 'sink') &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0
  ) {
    return { kind: candidate.kind, name: candidate.name };
  }
  return null;
}

/**
 * Resolve the capability a definition requires, if any.
 *
 * Precedence: explicit `requiresCapability` metadata first, then the
 * definition's own `runtimeKind`/`operation` pair (authoritative when both
 * are present), then the v1 Flow-type fallback table. Returns null when no
 * requirement can be determined; callers treat that as supported so unknown
 * future definitions are not blocked by this validator.
 */
export function resolveDefinitionCapabilityRequirement(
  definition: FlowNodeDefinition,
): FlowNodeCapabilityRequirement | null {
  const explicit = readExplicitRequirement(definition);
  if (explicit !== null) return explicit;
  if (
    definition.runtimeKind !== undefined &&
    definition.operation !== undefined &&
    definition.operation.length > 0
  ) {
    if (definition.runtimeKind === 'source') {
      return { kind: 'source', name: definition.operation };
    }
    if (definition.runtimeKind === 'sink') {
      return { kind: 'sink', name: definition.operation };
    }
    return { kind: 'operator', name: definition.operation };
  }
  return FLOW_TYPE_CAPABILITY_REQUIREMENTS[definition.type] ?? null;
}

function profileSetFor(
  profile: TargetCapabilityProfile,
  kind: FlowNodeCapabilityRequirement['kind'],
): readonly string[] {
  if (kind === 'source') return profile.sources;
  if (kind === 'sink') return profile.sinks;
  return profile.operators;
}

/**
 * Report whether one node definition may be used with a normalized target
 * capability profile. Consumes only the profile (booleans/identifier sets);
 * never compares eKuiper versions. Case-insensitive on identifier names so
 * metadata casing differences cannot falsely disable a node.
 */
export function isDefinitionSupportedByCapabilities(
  definition: FlowNodeDefinition,
  profile: TargetCapabilityProfile,
): DefinitionCapabilityStatus {
  const requirement = resolveDefinitionCapabilityRequirement(definition);
  if (requirement === null) return { supported: true };
  if (!profile.graphRules) {
    return {
      supported: false,
      reason: `Requires ${requirement.kind} "${requirement.name}" but this target does not support graph rules.`,
    };
  }
  const supported = profileSetFor(profile, requirement.kind).some(
    (entry) => entry.toLowerCase() === requirement.name.toLowerCase(),
  );
  if (supported) return { supported: true };
  return {
    supported: false,
    reason: `Requires ${requirement.kind} "${requirement.name}" unavailable on this target.`,
  };
}

/**
 * Capability validation for v1alpha1 Flow documents (FS-0080, validation
 * stage 5 of ARCHITECTURE_CONTRACT).
 *
 * For each node whose exact (type, typeVersion) resolves in the registry,
 * checks the definition against the normalized capability profile and emits
 * one FLOW_CAPABILITY_UNAVAILABLE error diagnostic per unsupported node.
 * Unknown node types are skipped here (owned by unknown-type validation).
 * Nodes with no determinable requirement are treated as supported.
 * Existing flows containing unavailable nodes therefore stay
 * viewable/editable while surfacing a diagnostic. Pure read: never throws
 * for well-typed input and never mutates its inputs or the registry.
 */
export function validateFlowCapabilities(
  document: FlowDocument,
  registry: NodeRegistry,
  profile: TargetCapabilityProfile,
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];
  const nodes = Array.isArray(document?.spec?.nodes)
    ? document.spec.nodes
    : [];
  for (const node of nodes) {
    const definition = registry.get(node.type, node.typeVersion);
    if (definition === undefined) continue;
    const status = isDefinitionSupportedByCapabilities(definition, profile);
    if (!status.supported) {
      diagnostics.push({
        code: FLOW_CAPABILITY_UNAVAILABLE,
        severity: 'error',
        message:
          `Flow node "${node.id}" ("${node.type}") is unavailable on this target: ` +
          (status.reason ?? 'required capability is not supported.'),
        nodeId: node.id,
      });
    }
  }
  return diagnostics;
}
