import type { FlowDiagnostic } from '../model/diagnostic';
import { FLOW_REQUIRED_PROPERTY_MISSING } from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';
import type { NodeRegistry } from '../registry/node-registry';

/**
 * Structured diagnostic code for property values whose runtime type does
 * not match the node definition (FS-0062).
 *
 * Declared here (rather than in model/diagnostic.ts) because FS-0062's
 * allowed files do not include the diagnostic module; the code string is
 * stable and follows the existing FLOW_* naming convention.
 */
export const FLOW_INVALID_PROPERTY_VALUE = 'FLOW_INVALID_PROPERTY_VALUE' as const;

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

function isAbsentValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.length === 0)
  );
}

/**
 * Basic property type validation for v1alpha1 Flow documents (FS-0062).
 *
 * For each node whose exact (type, typeVersion) resolves in the supplied
 * registry, checks every present (non-absent) config value against its
 * definition type for `number`, `boolean`, `select`, and `json`:
 *
 * - number: value must be a finite JS number (no string coercion);
 * - boolean: value must be a boolean;
 * - select: value must strictly match (Object.is) one declared option
 *   value; an unknown loaded value yields a diagnostic instead of being
 *   silently coerced;
 * - json: value must be a JSON object or array (the config contract holds
 *   parsed values, never raw text; primitives are rejected).
 *
 * Absent values (undefined, null, empty string) are skipped here; they are
 * owned by required-property validation. Unknown node definitions,
 * `string`/`expression`/`secret-ref` properties, and properties of unknown
 * type are skipped. Each mismatch produces one FLOW_INVALID_PROPERTY_VALUE
 * diagnostic carrying nodeId and propertyPath. Returns every diagnostic in
 * one pass. Never throws for well-typed input and never mutates its input
 * or the registry.
 */
export function validateFlowPropertyTypes(
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
      const value = config[property.key];
      if (isAbsentValue(value)) {
        continue;
      }

      if (property.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          diagnostics.push({
            code: FLOW_INVALID_PROPERTY_VALUE,
            severity: 'error',
            message: `Flow node "${node.id}" property "${property.key}" must be a number.`,
            nodeId: node.id,
            propertyPath: `config.${property.key}`,
          });
        }
      } else if (property.type === 'boolean') {
        if (typeof value !== 'boolean') {
          diagnostics.push({
            code: FLOW_INVALID_PROPERTY_VALUE,
            severity: 'error',
            message: `Flow node "${node.id}" property "${property.key}" must be a boolean.`,
            nodeId: node.id,
            propertyPath: `config.${property.key}`,
          });
        }
      } else if (property.type === 'select') {
        const options = Array.isArray(property.options)
          ? property.options
          : [];
        if (options.length === 0) {
          continue;
        }
        const matched = options.some((option) =>
          Object.is(option.value, value),
        );
        if (!matched) {
          diagnostics.push({
            code: FLOW_INVALID_PROPERTY_VALUE,
            severity: 'error',
            message: `Flow node "${node.id}" property "${property.key}" has a value that is not a known option.`,
            nodeId: node.id,
            propertyPath: `config.${property.key}`,
          });
        }
      } else if (property.type === 'json') {
        if (
          typeof value !== 'object' ||
          value === null
        ) {
          diagnostics.push({
            code: FLOW_INVALID_PROPERTY_VALUE,
            severity: 'error',
            message: `Flow node "${node.id}" property "${property.key}" must be a JSON object or array.`,
            nodeId: node.id,
            propertyPath: `config.${property.key}`,
          });
        }
      }
    }
  }

  return diagnostics;
}
