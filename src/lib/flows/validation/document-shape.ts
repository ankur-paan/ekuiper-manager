import type { FlowDiagnostic } from '../model/diagnostic';
import { FLOW_REQUIRED_PROPERTY_MISSING } from '../model/diagnostic';
import { FLOW_DOCUMENT_VERSION } from '../model/flow-document';

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
