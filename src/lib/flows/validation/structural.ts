import type { FlowDiagnostic } from '../model/diagnostic';
import {
  FLOW_CYCLE_UNSUPPORTED,
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
 * self-edges, and unsupported cycles. Returns every diagnostic in one pass. Never throws for
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

  if (hasUnsupportedCycle(seenNodeIds, edges)) {
    diagnostics.push({
      code: FLOW_CYCLE_UNSUPPORTED,
      severity: 'error',
      message: 'Flow contains a cycle, which is not supported.',
    });
  }

  return diagnostics;
}

/**
 * Deterministic O(V+E) cycle check (Kahn's algorithm).
 *
 * Edges referencing unknown nodes are skipped so missing-endpoint edges
 * never crash cycle detection; they are already reported above. Traversal
 * order is lexicographic so the boolean outcome is stable for the same
 * graph regardless of node/edge insertion order.
 */
function hasUnsupportedCycle(
  nodeIds: Set<string>,
  edges: FlowDocument['spec']['edges'],
): boolean {
  if (nodeIds.size === 0 || edges.length === 0) {
    return false;
  }

  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
    indegree.set(nodeId, 0);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    indegree.set(
      edge.targetNodeId,
      (indegree.get(edge.targetNodeId) ?? 0) + 1,
    );
  }

  for (const neighbors of adjacency.values()) {
    neighbors.sort();
  }

  const queue = [...nodeIds].filter((id) => indegree.get(id) === 0).sort();
  let visited = 0;

  while (queue.length > 0) {
    const current = queue.shift() as string;
    visited += 1;
    for (const neighbor of adjacency.get(current) ?? []) {
      const remaining = (indegree.get(neighbor) ?? 0) - 1;
      indegree.set(neighbor, remaining);
      if (remaining === 0) {
        queue.push(neighbor);
        queue.sort();
      }
    }
  }

  return visited !== nodeIds.size;
}
