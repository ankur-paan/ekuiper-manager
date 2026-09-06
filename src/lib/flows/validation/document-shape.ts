import type { FlowDiagnostic } from '../model/diagnostic';
import { FLOW_REQUIRED_PROPERTY_MISSING } from '../model/diagnostic';
import { FLOW_DOCUMENT_VERSION } from '../model/flow-document';
import { FLOW_INVALID_PROPERTY_VALUE } from './property-validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function push(
  diagnostics: FlowDiagnostic[],
  message: string,
  propertyPath?: string,
): void {
  diagnostics.push({
    code: FLOW_REQUIRED_PROPERTY_MISSING,
    severity: 'error',
    message,
    ...(propertyPath === undefined ? {} : { propertyPath }),
  });
}

function requireNonEmptyString(
  obj: Record<string, unknown>,
  key: string,
  prefix: string,
  label: string,
  diagnostics: FlowDiagnostic[],
): void {
  const value = obj[key];
  if (typeof value !== 'string' || value.length === 0) {
    push(diagnostics, `${label} must be a non-empty string.`, `${prefix}.${key}`);
  }
}

function requireFiniteNumber(
  obj: Record<string, unknown>,
  key: string,
  prefix: string,
  label: string,
  diagnostics: FlowDiagnostic[],
): void {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    push(diagnostics, `${label} must be a finite number.`, `${prefix}.${key}`);
  }
}

/**
 * Narrow runtime shape guard for v1alpha1 Flow documents.
 *
 * Checks only the top-level envelope (apiVersion, metadata, spec arrays,
 * layout object) and the required primitive fields of nodes, edges, and
 * layout entries. Returns structured diagnostics and never throws for
 * user-supplied JSON-compatible input. Never mutates its input.
 */
export function validateFlowDocumentShape(value: unknown): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];

  if (!isRecord(value)) {
    push(diagnostics, 'Flow document must be an object.');
    return diagnostics;
  }

  if (value['apiVersion'] !== FLOW_DOCUMENT_VERSION) {
    push(
      diagnostics,
      `Flow document apiVersion must be "${FLOW_DOCUMENT_VERSION}".`,
      'apiVersion',
    );
  }

  const metadata = value['metadata'];
  if (!isRecord(metadata)) {
    push(diagnostics, 'Flow document metadata is required.', 'metadata');
  } else {
    requireNonEmptyString(metadata, 'id', 'metadata', 'Flow document metadata.id', diagnostics);
    requireNonEmptyString(metadata, 'name', 'metadata', 'Flow document metadata.name', diagnostics);
  }

  const spec = value['spec'];
  if (!isRecord(spec)) {
    push(diagnostics, 'Flow document spec is required.', 'spec');
  } else {
    const nodes = spec['nodes'];
    if (!Array.isArray(nodes)) {
      push(diagnostics, 'Flow document spec.nodes must be an array.', 'spec.nodes');
    } else {
      nodes.forEach((node, index) => validateNodeShape(node, index, diagnostics));
    }
    const edges = spec['edges'];
    if (!Array.isArray(edges)) {
      push(diagnostics, 'Flow document spec.edges must be an array.', 'spec.edges');
    } else {
      edges.forEach((edge, index) => validateEdgeShape(edge, index, diagnostics));
    }
    if (spec['options'] !== undefined) {
      diagnostics.push(...validateRuleOptionsShape(spec['options']));
    }
  }

  const layout = value['layout'];
  if (!isRecord(layout)) {
    push(diagnostics, 'Flow document layout is required.', 'layout');
  } else {
    const layoutNodes = layout['nodes'];
    if (!isRecord(layoutNodes)) {
      push(diagnostics, 'Flow document layout.nodes must be an object.', 'layout.nodes');
    } else {
      for (const key of Object.keys(layoutNodes)) {
        validateNodeLayoutShape(layoutNodes[key], key, diagnostics);
      }
    }
    if (layout['viewport'] !== undefined) {
      const viewport = layout['viewport'];
      if (!isRecord(viewport)) {
        push(diagnostics, 'Flow document layout.viewport must be an object.', 'layout.viewport');
      } else {
        requireFiniteNumber(viewport, 'x', 'layout.viewport', 'Flow document layout.viewport.x', diagnostics);
        requireFiniteNumber(viewport, 'y', 'layout.viewport', 'Flow document layout.viewport.y', diagnostics);
        requireFiniteNumber(viewport, 'zoom', 'layout.viewport', 'Flow document layout.viewport.zoom', diagnostics);
      }
    }
  }

  return diagnostics;
}

function validateNodeShape(node: unknown, index: number, diagnostics: FlowDiagnostic[]): void {
  const prefix = `spec.nodes[${index}]`;
  if (!isRecord(node)) {
    push(diagnostics, 'Flow node must be an object.', prefix);
    return;
  }
  requireNonEmptyString(node, 'id', prefix, 'Flow node id', diagnostics);
  requireNonEmptyString(node, 'type', prefix, 'Flow node type', diagnostics);
  requireFiniteNumber(node, 'typeVersion', prefix, 'Flow node typeVersion', diagnostics);
  requireNonEmptyString(node, 'name', prefix, 'Flow node name', diagnostics);
  if (!isRecord(node['config'])) {
    push(diagnostics, 'Flow node config must be an object.', `${prefix}.config`);
  }
}

function validateEdgeShape(edge: unknown, index: number, diagnostics: FlowDiagnostic[]): void {
  const prefix = `spec.edges[${index}]`;
  if (!isRecord(edge)) {
    push(diagnostics, 'Flow edge must be an object.', prefix);
    return;
  }
  requireNonEmptyString(edge, 'id', prefix, 'Flow edge id', diagnostics);
  requireNonEmptyString(edge, 'sourceNodeId', prefix, 'Flow edge sourceNodeId', diagnostics);
  requireNonEmptyString(edge, 'sourcePortId', prefix, 'Flow edge sourcePortId', diagnostics);
  requireNonEmptyString(edge, 'targetNodeId', prefix, 'Flow edge targetNodeId', diagnostics);
  requireNonEmptyString(edge, 'targetPortId', prefix, 'Flow edge targetPortId', diagnostics);
}

function validateNodeLayoutShape(entry: unknown, key: string, diagnostics: FlowDiagnostic[]): void {
  const prefix = `layout.nodes.${key}`;
  if (!isRecord(entry)) {
    push(diagnostics, 'Flow layout entry must be an object.', prefix);
    return;
  }
  requireFiniteNumber(entry, 'x', prefix, 'Flow layout entry x', diagnostics);
  requireFiniteNumber(entry, 'y', prefix, 'Flow layout entry y', diagnostics);
}

/**
 * Narrow shape guard for the v1alpha1 `spec.options` subset (FS-0152).
 *
 * The owner-approved subset only: `concurrency`, `bufferLength`, `qos`,
 * `checkpointInterval`, `isEventTime`, `lateTolerance`, `sendMetaToSink`,
 * `sendError`. Unknown keys are rejected (fail-closed on the closed
 * subset) rather than silently dropped, so a typo can never reach the
 * engine as an unvalidated name. Out-of-range values yield structured
 * `FLOW_INVALID_PROPERTY_VALUE` diagnostics (reusing the existing
 * invalid-value code; `diagnostic.ts` is outside this ticket's paths),
 * never thrown strings. An absent or empty object is valid and compiles
 * to a rule with NO `options` key. Shared by document-shape validation
 * and the eKuiper compiler so the editor and the compiler agree. Never
 * mutates its input and never throws for JSON-compatible input.
 */
const FLOW_RULE_OPTION_KEYS = [
  'concurrency',
  'bufferLength',
  'qos',
  'checkpointInterval',
  'isEventTime',
  'lateTolerance',
  'sendMetaToSink',
  'sendError',
] as const;

function pushOption(
  diagnostics: FlowDiagnostic[],
  message: string,
  key?: string,
): void {
  diagnostics.push({
    code: FLOW_INVALID_PROPERTY_VALUE,
    severity: 'error',
    message,
    propertyPath: key === undefined ? 'spec.options' : `spec.options.${key}`,
  });
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 1
  );
}

function isDurationValue(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0;
  }
  return typeof value === 'string' && value.length > 0;
}

export function validateRuleOptionsShape(value: unknown): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];
  if (!isRecord(value)) {
    pushOption(diagnostics, 'Flow document spec.options must be an object when present.');
    return diagnostics;
  }
  for (const key of Object.keys(value)) {
    if (!(FLOW_RULE_OPTION_KEYS as readonly string[]).includes(key)) {
      pushOption(
        diagnostics,
        `Flow document spec.options has an unsupported option "${key}". ` +
          `Only ${FLOW_RULE_OPTION_KEYS.join(', ')} are supported in v1alpha1.`,
        key,
      );
    }
  }
  if (value['concurrency'] !== undefined && !isPositiveInteger(value['concurrency'])) {
    pushOption(
      diagnostics,
      'Flow document spec.options.concurrency must be an integer of at least 1.',
      'concurrency',
    );
  }
  if (value['bufferLength'] !== undefined && !isPositiveInteger(value['bufferLength'])) {
    pushOption(
      diagnostics,
      'Flow document spec.options.bufferLength must be an integer of at least 1.',
      'bufferLength',
    );
  }
  if (
    value['qos'] !== undefined &&
    !(value['qos'] === 0 || value['qos'] === 1 || value['qos'] === 2)
  ) {
    pushOption(
      diagnostics,
      'Flow document spec.options.qos must be one of 0, 1, 2.',
      'qos',
    );
  }
  if (value['checkpointInterval'] !== undefined && !isDurationValue(value['checkpointInterval'])) {
    pushOption(
      diagnostics,
      'Flow document spec.options.checkpointInterval must be a non-negative integer or a non-empty duration string.',
      'checkpointInterval',
    );
  }
  if (value['isEventTime'] !== undefined && typeof value['isEventTime'] !== 'boolean') {
    pushOption(
      diagnostics,
      'Flow document spec.options.isEventTime must be a boolean.',
      'isEventTime',
    );
  }
  if (value['lateTolerance'] !== undefined && !isDurationValue(value['lateTolerance'])) {
    pushOption(
      diagnostics,
      'Flow document spec.options.lateTolerance must be a non-negative integer or a non-empty duration string.',
      'lateTolerance',
    );
  }
  if (value['sendMetaToSink'] !== undefined && typeof value['sendMetaToSink'] !== 'boolean') {
    pushOption(
      diagnostics,
      'Flow document spec.options.sendMetaToSink must be a boolean.',
      'sendMetaToSink',
    );
  }
  if (value['sendError'] !== undefined && typeof value['sendError'] !== 'boolean') {
    pushOption(
      diagnostics,
      'Flow document spec.options.sendError must be a boolean.',
      'sendError',
    );
  }
  return diagnostics;
}
