import type { FlowDiagnostic } from '../model/diagnostic';
import type { FlowIr, FlowIrEdge, FlowIrNode } from './flow-ir';
import type { FlowDocument } from '../model/flow-document';
import { FLOW_UNKNOWN_NODE_TYPE } from '../model/diagnostic';
import type { NodeRegistry } from '../registry/node-registry';

export interface BuildFlowIrSuccess {
  ok: true;
  ir: FlowIr;
  diagnostics: FlowDiagnostic[];
}

export interface BuildFlowIrFailure {
  ok: false;
  ir: undefined;
  diagnostics: FlowDiagnostic[];
}

export type BuildFlowIrResult = BuildFlowIrSuccess | BuildFlowIrFailure;

function compareIrNodes(a: FlowIrNode, b: FlowIrNode): number {
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  return 0;
}

function compareIrEdges(a: FlowIrEdge, b: FlowIrEdge): number {
  const keysA = [
    a.sourceNodeId,
    a.targetNodeId,
    a.sourcePortId,
    a.targetPortId,
  ];
  const keysB = [
    b.sourceNodeId,
    b.targetNodeId,
    b.sourcePortId,
    b.targetPortId,
  ];
  for (let index = 0; index < keysA.length; index += 1) {
    if (keysA[index]! < keysB[index]!) {
      return -1;
    }
    if (keysA[index]! > keysB[index]!) {
      return 1;
    }
  }
  return 0;
}

/**
 * Minimal registry-driven Flow-to-IR builder for v1alpha1 Flow documents.
 *
 * Resolves each flow node definition by exact (type, typeVersion) and
 * copies node config verbatim into IR nodes keyed by the definition's
 * internal runtime metadata (runtimeKind/operation). Copies semantic
 * edges only; layout, viewport, and node display names are excluded.
 *
 * When a node definition is missing — or a resolved definition lacks its
 * internal runtime metadata — no partial IR is produced: the result is a
 * failure carrying one FLOW_UNKNOWN_NODE_TYPE diagnostic per affected
 * node. Output is sorted by node/edge identity so it is deterministic
 * for normalized input. Never mutates its input or the registry.
 */
export function buildFlowIr(
  document: FlowDocument,
  registry: NodeRegistry,
): BuildFlowIrResult {
  const nodes = Array.isArray(document?.spec?.nodes)
    ? document.spec.nodes
    : [];
  const edges = Array.isArray(document?.spec?.edges)
    ? document.spec.edges
    : [];

  const diagnostics: FlowDiagnostic[] = [];
  const irNodes: FlowIrNode[] = [];

  for (const node of nodes) {
    const definition = registry.get(node.type, node.typeVersion);
    if (definition === undefined) {
      diagnostics.push({
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message: `Unknown flow node type "${node.type}" version ${node.typeVersion} for node "${node.id}".`,
        nodeId: node.id,
      });
      continue;
    }
    if (definition.runtimeKind === undefined || definition.operation === undefined) {
      diagnostics.push({
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message: `Flow node "${node.id}" has no runtime metadata for type "${node.type}" version ${node.typeVersion}.`,
        nodeId: node.id,
      });
      continue;
    }
    irNodes.push({
      id: node.id,
      kind: definition.runtimeKind,
      operation: definition.operation,
      config: structuredClone(node.config),
    });
  }

  if (diagnostics.length > 0) {
    return { ok: false, ir: undefined, diagnostics };
  }

  const irEdges: FlowIrEdge[] = edges.map((edge) => ({
    sourceNodeId: edge.sourceNodeId,
    sourcePortId: edge.sourcePortId,
    targetNodeId: edge.targetNodeId,
    targetPortId: edge.targetPortId,
  }));

  irNodes.sort(compareIrNodes);
  irEdges.sort(compareIrEdges);

  return { ok: true, ir: { nodes: irNodes, edges: irEdges }, diagnostics: [] };
}

export type { FlowDiagnostic, FlowIr, FlowIrEdge, FlowIrNode };
