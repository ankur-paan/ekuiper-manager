import type { FlowDiagnostic } from '../model/diagnostic';
import {
  FLOW_DUPLICATE_EDGE_ID,
  FLOW_DUPLICATE_NODE_ID,
  FLOW_EDGE_SOURCE_MISSING,
  FLOW_EDGE_TARGET_MISSING,
  FLOW_SELF_EDGE_UNSUPPORTED,
} from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';

/**
 * Structural validation for v1alpha1 Flow documents.
 *
 * Checks duplicate node IDs, duplicate edge IDs, missing edge endpoints,
 * and self-edges. Returns every diagnostic in one pass. Never throws for
 * well-typed input and never mutates its input.
 */
export function validateFlowStructure(
  document: FlowDocument,
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];

  const nodes = Array.isArray(document?.spec?.nodes)
    ? document.spec.nodes
    : [];
  const edges = Array.isArray(document?.spec?.edges)
    ? document.spec.edges
    : [];

  const seenNodeIds = new Set<string>();
  for (const node of nodes) {
    if (seenNodeIds.has(node.id)) {
      diagnostics.push({
        code: FLOW_DUPLICATE_NODE_ID,
        severity: 'error',
        message: `Duplicate flow node id "${node.id}".`,
        nodeId: node.id,
      });
    } else {
      seenNodeIds.add(node.id);
    }
  }

  const seenEdgeIds = new Set<string>();
  for (const edge of edges) {
    if (seenEdgeIds.has(edge.id)) {
      diagnostics.push({
        code: FLOW_DUPLICATE_EDGE_ID,
        severity: 'error',
        message: `Duplicate flow edge id "${edge.id}".`,
        edgeId: edge.id,
      });
    } else {
      seenEdgeIds.add(edge.id);
    }
  }

  for (const edge of edges) {
    if (!seenNodeIds.has(edge.sourceNodeId)) {
      diagnostics.push({
        code: FLOW_EDGE_SOURCE_MISSING,
        severity: 'error',
        message: `Flow edge "${edge.id}" references missing source node "${edge.sourceNodeId}".`,
        nodeId: edge.sourceNodeId,
        edgeId: edge.id,
      });
    }
    if (!seenNodeIds.has(edge.targetNodeId)) {
      diagnostics.push({
        code: FLOW_EDGE_TARGET_MISSING,
        severity: 'error',
        message: `Flow edge "${edge.id}" references missing target node "${edge.targetNodeId}".`,
        nodeId: edge.targetNodeId,
        edgeId: edge.id,
      });
    }
    if (edge.sourceNodeId === edge.targetNodeId) {
      diagnostics.push({
        code: FLOW_SELF_EDGE_UNSUPPORTED,
        severity: 'error',
        message: `Flow edge "${edge.id}" is a self-edge on node "${edge.sourceNodeId}", which is not supported.`,
        nodeId: edge.sourceNodeId,
        edgeId: edge.id,
      });
    }
  }

  return diagnostics;
}
