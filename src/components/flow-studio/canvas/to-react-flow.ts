import type { Edge, Node } from '@xyflow/react';

import type { FlowDocument } from '@/lib/flows/model/flow-document';

/**
 * Generic XYFlow node type used for Flow nodes.
 *
 * The custom renderer for this type arrives in FS-0038; this adapter only
 * tags view nodes so FS-0040 can map `nodeTypes` without extra translation.
 */
export const FLOW_CANVAS_NODE_TYPE = 'flowNode' as const;

/**
 * Minimal display data carried on each canvas node.
 *
 * Only semantic identity/display fields plus a reference to the Flow node
 * config. Never add runtime metrics, selection, or panel state here
 * (LOCKED_DECISIONS: runtime state stays separate from the Flow document).
 */
export interface FlowCanvasNodeData extends Record<string, unknown> {
  id: string;
  type: string;
  typeVersion: number;
  name: string;
  config: Record<string, unknown>;
}

export type FlowCanvasNode = Node<FlowCanvasNodeData, typeof FLOW_CANVAS_NODE_TYPE>;
export type FlowCanvasEdge = Edge;

export interface FlowReactFlowView {
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
}

function toPosition(
  layout: { x: number; y: number } | undefined,
): { x: number; y: number } {
  if (!layout) {
    return { x: 0, y: 0 };
  }
  return { x: layout.x, y: layout.y };
}

/**
 * Pure, deterministic adapter from a FlowDocument to XYFlow nodes.
 *
 * - Preserves `spec.nodes` order.
 * - Position comes from `layout.nodes[id]`, defaulting to `{x: 0, y: 0}`
 *   only when no layout entry exists.
 * - Never mutates the input document.
 */
export function toReactFlowNodes(document: FlowDocument): FlowCanvasNode[] {
  return document.spec.nodes.map((node) => ({
    id: node.id,
    type: FLOW_CANVAS_NODE_TYPE,
    position: toPosition(document.layout.nodes[node.id]),
    data: {
      id: node.id,
      type: node.type,
      typeVersion: node.typeVersion,
      name: node.name,
      config: node.config,
    },
  }));
}

/**
 * Pure, deterministic adapter from a FlowDocument to XYFlow edges.
 *
 * Semantic port IDs are preserved verbatim as XYFlow handle IDs:
 * `sourcePortId -> sourceHandle`, `targetPortId -> targetHandle`.
 */
export function toReactFlowEdges(document: FlowDocument): FlowCanvasEdge[] {
  return document.spec.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourcePortId,
    targetHandle: edge.targetPortId,
  }));
}

/**
 * Pure, deterministic adapter from a FlowDocument to an XYFlow view model.
 */
export function toReactFlow(document: FlowDocument): FlowReactFlowView {
  return {
    nodes: toReactFlowNodes(document),
    edges: toReactFlowEdges(document),
  };
}
