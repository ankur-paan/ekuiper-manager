import type { FlowDocument, FlowEdge, FlowNode } from './flow-document';

function compareById(a: { id: string }, b: { id: string }): number {
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  return 0;
}

function normalizeNode(node: FlowNode): FlowNode {
  return {
    ...node,
    name: node.name.trim(),
    config: { ...node.config },
  };
}

function normalizeEdge(edge: FlowEdge): FlowEdge {
  return { ...edge };
}

/**
 * Deterministic normalization for v1alpha1 Flow documents.
 *
 * - Trims metadata name and node names only; config values stay verbatim.
 * - Sorts semantic nodes/edges by id for stable persistence/compiler input.
 * - Preserves layout map insertion order and coordinates unchanged.
 * - Always returns a new document and never mutates its input.
 */
export function normalizeFlowDocument(document: FlowDocument): FlowDocument {
  const nodes = document.spec.nodes
    .map(normalizeNode)
    .sort(compareById);
  const edges = document.spec.edges
    .map(normalizeEdge)
    .sort(compareById);

  const layoutNodes: FlowDocument['layout']['nodes'] = {};
  for (const [key, entry] of Object.entries(document.layout.nodes)) {
    layoutNodes[key] = { ...entry };
  }

  return {
    apiVersion: document.apiVersion,
    metadata: {
      ...document.metadata,
      name: document.metadata.name.trim(),
    },
    spec: {
      nodes,
      edges,
    },
    layout: {
      nodes: layoutNodes,
      ...(document.layout.viewport === undefined
        ? {}
        : { viewport: { ...document.layout.viewport } }),
    },
  };
}
