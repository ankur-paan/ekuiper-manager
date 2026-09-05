import type { FlowDiagnostic } from '../model/diagnostic';
import { FLOW_REQUIRED_PROPERTY_MISSING } from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';
import type { NodeRegistry } from '../registry/node-registry';

function isMissingValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string' && value.length === 0) {
    return true;
  }
  return false;
}

/**
 * Required property validation for v1alpha1 Flow documents.
 *
 * For each node whose exact (type, typeVersion) resolves in the supplied
 * registry, verifies every property marked required is present in
 * node.config. A value counts as missing when the key is absent, or the
 * value is null, undefined, or an empty string. False and 0 are valid
 * values. Each missing property produces one FLOW_REQUIRED_PROPERTY_MISSING
 * diagnostic carrying nodeId and propertyPath. Nodes with unknown
 * definitions are skipped; they are owned by unknown-type validation. No
 * type coercion or select-option validation is performed. Returns every
 * diagnostic in one pass. Never throws for well-typed input and never
 * mutates its input or the registry.
 */
export function validateFlowRequiredProperties(
  document: FlowDocument,
  registry: NodeRegistry,
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];

  const nodes = Array.isArray(document?.spec?.nodes)
    ? document.spec.nodes
    : [];

  for (const node of nodes) {
    const definition = registry.get(node.type, node.typeVersion);
    if (definition === undefined) {
      continue;
    }

    const properties = Array.isArray(definition.properties)
      ? definition.properties
      : [];
    const config: Record<string, unknown> =
      typeof node.config === 'object' &&
      node.config !== null &&
      !Array.isArray(node.config)
        ? (node.config as Record<string, unknown>)
        : {};

    for (const property of properties) {
      if (property.required !== true) {
        continue;
      }
      const value = config[property.key];
      if (isMissingValue(value)) {
        diagnostics.push({
          code: FLOW_REQUIRED_PROPERTY_MISSING,
          severity: 'error',
          message: `Flow node "${node.id}" is missing required property "${property.key}".`,
          nodeId: node.id,
          propertyPath: `config.${property.key}`,
        });
      }
    }
  }

  return diagnostics;
}
