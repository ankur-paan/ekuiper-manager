import type { Edge, Node } from '@xyflow/react';

import type { FlowDocument } from '@/lib/flows/model/flow-document';
import type {
  FlowNodeCategory,
  FlowNodeDefinition,
  FlowPortDefinition,
} from '@/lib/flows/registry/node-definition';

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
  /**
   * Presentation-only definition summary resolved at the page/view
   * boundary. Carries exactly category, display name, and port lists;
   * never runtime/compiler metadata (runtimeKind, operation, properties)
   * and never metrics.
   */
  definition?: FlowCanvasPresentation;
  /**
   * Set when the (type, typeVersion) definition could not be resolved.
   * The renderer must still render safely with zero handles.
   */
  unsupported?: boolean;
}

/**
 * Presentation-relevant node definition fields the canvas may render.
 *
 * Only category, display name, and port lists. Property forms, docs,
 * runtime/compiler metadata, and metrics are never carried here
 * (see UI_PERFORMANCE_SPEC canvas rendering rules).
 */
export interface FlowCanvasPresentation {
  displayName?: string;
  category?: FlowNodeCategory;
  inputs?: FlowPortDefinition[];
  outputs?: FlowPortDefinition[];
}

/**
 * Registry lookup injected at the page/view boundary.
 *
 * The adapter stays pure and never imports the registry itself; the
 * caller resolves the exact (type, typeVersion) definition and returns
 * only presentation fields (or undefined when unknown).
 */
export type FlowCanvasDefinitionResolver = (
  type: string,
  version: number,
) => FlowCanvasPresentation | undefined;

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
 * Project a full node definition down to canvas presentation fields.
 *
 * Pure helper for the page/view boundary: picks only displayName,
 * category, inputs, and outputs (cloned so canvas data can never mutate
 * registry state). Never carries properties, docs, runtimeKind,
 * operation, or metrics.
 */
export function toFlowCanvasPresentation(
  definition: FlowNodeDefinition,
): FlowCanvasPresentation {
  return {
    displayName: definition.displayName,
    category: definition.category,
    inputs: definition.inputs.map((port) => ({ ...port })),
    outputs: definition.outputs.map((port) => ({ ...port })),
  };
}

function toPresentationCopy(
  presentation: FlowCanvasPresentation,
): FlowCanvasPresentation {
  return {
    displayName: presentation.displayName,
    category: presentation.category,
    inputs: (presentation.inputs ?? []).map((port) => ({ ...port })),
    outputs: (presentation.outputs ?? []).map((port) => ({ ...port })),
  };
}

/**
 * Pure, deterministic adapter from a FlowDocument to XYFlow nodes.
 *
 * - Preserves `spec.nodes` order.
 * - Position comes from `layout.nodes[id]`, defaulting to `{x: 0, y: 0}`
 *   only when no layout entry exists.
 * - Never mutates the input document.
 * - `resolveDefinition` is required (page/view boundary): each node's
 *   exact (type, typeVersion) presentation is attached as
 *   `data.definition`; unknown types get `data.unsupported: true` and
 *   still render safely with zero handles. There is no resolver-less
 *   call path.
 */
export function toReactFlowNodes(
  document: FlowDocument,
  resolveDefinition: FlowCanvasDefinitionResolver,
): FlowCanvasNode[] {
  return document.spec.nodes.map((node) => {
    const presentation = resolveDefinition(node.type, node.typeVersion);
    if (!presentation) {
      return {
        id: node.id,
        type: FLOW_CANVAS_NODE_TYPE,
        position: toPosition(document.layout.nodes[node.id]),
        data: {
          id: node.id,
          type: node.type,
          typeVersion: node.typeVersion,
          name: node.name,
          config: node.config,
          unsupported: true,
        },
      };
    }
    return {
      id: node.id,
      type: FLOW_CANVAS_NODE_TYPE,
      position: toPosition(document.layout.nodes[node.id]),
      data: {
        id: node.id,
        type: node.type,
        typeVersion: node.typeVersion,
        name: node.name,
        config: node.config,
        definition: toPresentationCopy(presentation),
      },
    };
  });
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
 *
 * `resolveDefinition` is required so no call path can silently yield
 * handle-less nodes.
 */
export function toReactFlow(
  document: FlowDocument,
  resolveDefinition: FlowCanvasDefinitionResolver,
): FlowReactFlowView {
  return {
    nodes: toReactFlowNodes(document, resolveDefinition),
    edges: toReactFlowEdges(document),
  };
}
