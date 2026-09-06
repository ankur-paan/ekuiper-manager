"use client";

import * as React from "react";
import {
  Background,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnInit,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";

import { FlowNode } from "../nodes/flow-node";
import { FLOW_CANVAS_NODE_TYPE } from "./to-react-flow";
import { FLOW_PALETTE_DRAG_MIME } from "../palette/node-palette";

export const flowNodeTypes: NodeTypes = {
  [FLOW_CANVAS_NODE_TYPE]: FlowNode,
};

export interface FlowCanvasNodeDragStopMove {
  nodeId: string;
  position: { x: number; y: number };
}

export interface FlowCanvasSelection {
  nodeIds: string[];
  edgeIds: string[];
}

/**
 * External palette drop resolved to flow coordinates (FS-0066).
 *
 * `type`/`version` is the registry identity from the palette drag payload;
 * the caller resolves the definition and creates the node via the editor
 * store. Unknown types are ignored by the caller without mutation.
 */
export interface FlowPaletteDrop {
  type: string;
  version: number;
  position: { x: number; y: number };
}

/**
 * Double-click on empty canvas resolved to flow coordinates (FS-0070).
 *
 * `position` is the flow coordinate where the node should be created;
 * `screenPosition` is the viewport client coordinate where the compact
 * picker should open at/near the cursor.
 */
export interface FlowCanvasEmptyDoubleClick {
  position: { x: number; y: number };
  screenPosition: { x: number; y: number };
}

export interface FlowCanvasProps {
  nodes?: Node[];
  edges?: Edge[];
  selectedNodeIds?: string[];
  selectedEdgeIds?: string[];
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  isValidConnection?: (connection: Edge | Connection) => boolean;
  onNodeDragStop?: (moves: FlowCanvasNodeDragStopMove[]) => void;
  onSelectionChange?: (selection: FlowCanvasSelection) => void;
  onPaletteDrop?: (drop: FlowPaletteDrop) => void;
  onEmptyDoubleClick?: (event: FlowCanvasEmptyDoubleClick) => void;
  nodeTypes?: NodeTypes;
  className?: string;
}

/**
 * Order-insensitive id-set equality for selection dedup. ReactFlow may
 * report the same selection in a different order; treating that as equal
 * keeps a redundant update from re-triggering itself (no render loop).
 */
function sameIdSet(current: readonly string[], next: readonly string[]): boolean {
  if (current.length !== next.length) return false;
  const members = new Set(current);
  for (const id of next) {
    if (!members.has(id)) return false;
  }
  return true;
}

export function FlowCanvas({
  nodes = [],
  edges = [],
  selectedNodeIds,
  selectedEdgeIds,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onNodeDragStop,
  onSelectionChange,
  onPaletteDrop,
  onEmptyDoubleClick,
  nodeTypes = flowNodeTypes,
  className,
}: FlowCanvasProps) {
  // High-frequency drag/position updates stay in local XYFlow view state.
  // The editor store is only notified once per drag stop (FS-0042), so no
  // semantic hash, autosave, or history work runs per pointer event.
  const [viewNodes, setViewNodes] = React.useState<Node[]>(nodes);
  const [viewEdges, setViewEdges] = React.useState<Edge[]>(edges);

  // Adopt committed document positions (flow load or drag-stop commit).
  // The prop reference only changes when the parent derives a new view
  // model, so in-progress drags are not clobbered per pointer event.
  React.useEffect(() => {
    setViewNodes(nodes);
  }, [nodes]);
  React.useEffect(() => {
    setViewEdges(edges);
  }, [edges]);

  // Latest committed selection (store-driven props) plus optimistic
  // updates emitted from click-driven changes below. The ref is updated
  // synchronously on emit so a node-select and an edge-select arriving in
  // the same tick each see the other's update instead of clobbering it
  // with a stale prop closure. Prop sync happens in an effect (after
  // render), never between the two synchronous emits.
  const selectionRef = React.useRef<{ nodeIds: string[]; edgeIds: string[] }>({
    nodeIds: [...(selectedNodeIds ?? [])],
    edgeIds: [...(selectedEdgeIds ?? [])],
  });
  React.useEffect(() => {
    selectionRef.current = {
      nodeIds: [...(selectedNodeIds ?? [])],
      edgeIds: [...(selectedEdgeIds ?? [])],
    };
  }, [selectedNodeIds, selectedEdgeIds]);

  // Single deduped emit path. A redundant update (same id sets, possibly in
  // a different order) never reaches the parent, so the controlled
  // displayNodes/displayEdges props cannot fight the store in a loop.
  const emitSelection = React.useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      const previous = selectionRef.current;
      if (
        sameIdSet(previous.nodeIds, nodeIds) &&
        sameIdSet(previous.edgeIds, edgeIds)
      ) {
        return;
      }
      selectionRef.current = { nodeIds: [...nodeIds], edgeIds: [...edgeIds] };
      onSelectionChange?.({ nodeIds: [...nodeIds], edgeIds: [...edgeIds] });
    },
    [onSelectionChange],
  );

  const displayNodesRef = React.useRef<Node[]>([]);
  const displayEdgesRef = React.useRef<Edge[]>([]);

  // Close the selection round trip (P1): ReactFlow is fully controlled by
  // displayNodes/displayEdges below (selected is force-overwritten from the
  // store on every render), so a click-driven 'select' change applied only
  // to view state would be immediately clobbered back to false and
  // onSelectionChange would never report the node. Forwarding the applied
  // selection here lets the store latch it; the next render then reflects
  // it via displayNodes. Only 'select' changes emit; position/drag updates
  // stay local until onNodeDragStop. Chosen over leaving ReactFlow
  // uncontrolled because the store must stay the source of truth for
  // undo/redo/delete-driven selection (FS-0045 intent kept).
  const handleNodesChange = React.useCallback(
    (changes: NodeChange[]) => {
      const nextNodes = applyNodeChanges(changes, displayNodesRef.current);
      setViewNodes(nextNodes);
      if (changes.some((change) => change.type === 'select')) {
        emitSelection(
          nextNodes.filter((node) => node.selected).map((node) => node.id),
          selectionRef.current.edgeIds,
        );
      }
      onNodesChange?.(changes);
    },
    [emitSelection, onNodesChange],
  );

  const handleEdgesChange = React.useCallback(
    (changes: EdgeChange[]) => {
      const nextEdges = applyEdgeChanges(changes, displayEdgesRef.current);
      setViewEdges(nextEdges);
      if (changes.some((change) => change.type === 'select')) {
        emitSelection(
          selectionRef.current.nodeIds,
          nextEdges.filter((edge) => edge.selected).map((edge) => edge.id),
        );
      }
      onEdgesChange?.(changes);
    },
    [emitSelection, onEdgesChange],
  );

  const handleNodeDragStop: OnNodeDrag = React.useCallback(
    (_event, node, draggedNodes) => {
      if (!onNodeDragStop) return;
      const finished = draggedNodes && draggedNodes.length > 0 ? draggedNodes : [node];
      onNodeDragStop(
        finished.map((canvasNode) => ({
          nodeId: canvasNode.id,
          position: { x: canvasNode.position.x, y: canvasNode.position.y },
        })),
      );
    },
    [onNodeDragStop],
  );

  // Selection lives outside the FlowDocument: XYFlow reports selection
  // changes and the caller mirrors them into ephemeral editor state (FS-0045).
  // Blank-canvas clicks arrive here as empty arrays, clearing the selection.
  // Routed through the deduped emit so the post-round-trip echo of our own
  // handleNodesChange/handleEdgesChange forward does not re-trigger the parent.
  const handleSelectionChange: OnSelectionChangeFunc = React.useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      emitSelection(
        selectedNodes.map((selectedNode) => selectedNode.id),
        selectedEdges.map((selectedEdge) => selectedEdge.id),
      );
    },
    [emitSelection],
  );

  // XYFlow instance for external palette drops (FS-0066). Screen/client
  // coordinates are converted via screenToFlowPosition so the created node
  // lands where released under the current pan/zoom transform.
  const flowInstanceRef = React.useRef<ReactFlowInstance | null>(null);

  const handleInit: OnInit = React.useCallback((instance) => {
    flowInstanceRef.current = instance;
  }, []);

  // Allow external palette drags over the canvas. Required for drop to fire.
  const handleDragOver = React.useCallback(
    (event: React.DragEvent) => {
      if (!onPaletteDrop) return;
      if (!event.dataTransfer.types.includes(FLOW_PALETTE_DRAG_MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [onPaletteDrop],
  );

  // Resolve a palette payload to flow coordinates and forward it. Unknown
  // or malformed drag types are ignored without mutation.
  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      if (!onPaletteDrop) return;
      const raw = event.dataTransfer.getData(FLOW_PALETTE_DRAG_MIME);
      if (!raw) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      const record = parsed as Record<string, unknown>;
      if (typeof record["type"] !== "string" || record["type"].length === 0) return;
      if (typeof record["version"] !== "number" || !Number.isInteger(record["version"])) {
        return;
      }
      const instance = flowInstanceRef.current;
      if (!instance) return;
      event.preventDefault();
      const position = instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onPaletteDrop({
        type: record["type"] as string,
        version: record["version"] as number,
        position: { x: position.x, y: position.y },
      });
    },
    [onPaletteDrop],
  );

  // FS-0070: double-click on empty canvas opens the quick node picker.
  // React Flow exposes no onPaneDoubleClick prop, so listen on the wrapper
  // and ignore double-clicks landing inside nodes/edges/controls/panels.
  // Coordinates convert via the XYFlow instance so the created node lands
  // where released under the current pan/zoom transform.
  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (!onEmptyDoubleClick) return;
      if (event.target instanceof Element) {
        if (
          event.target.closest(
            ".react-flow__node, .react-flow__edge, .react-flow__controls, .react-flow__panel",
          )
        ) {
          return;
        }
      }
      const instance = flowInstanceRef.current;
      if (!instance) return;
      const position = instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onEmptyDoubleClick({
        position: { x: position.x, y: position.y },
        screenPosition: { x: event.clientX, y: event.clientY },
      });
    },
    [onEmptyDoubleClick],
  );

  const selectedNodeSet = React.useMemo(
    () => (selectedNodeIds ? new Set(selectedNodeIds) : null),
    [selectedNodeIds],
  );
  const selectedEdgeSet = React.useMemo(
    () => (selectedEdgeIds ? new Set(selectedEdgeIds) : null),
    [selectedEdgeIds],
  );

  const displayNodes = React.useMemo(
    () =>
      selectedNodeSet
        ? viewNodes.map((viewNode) => ({
            ...viewNode,
            selected: selectedNodeSet.has(viewNode.id),
          }))
        : viewNodes,
    [viewNodes, selectedNodeSet],
  );

  const displayEdges = React.useMemo(
    () =>
      selectedEdgeSet
        ? viewEdges.map((viewEdge) => ({
            ...viewEdge,
            selected: selectedEdgeSet.has(viewEdge.id),
          }))
        : viewEdges,
    [viewEdges, selectedEdgeSet],
  );

  displayNodesRef.current = displayNodes;
  displayEdgesRef.current = displayEdges;

  return (
    <div
      aria-label="Flow canvas"
      className={cn("h-full min-h-0 w-full", className)}
      data-testid="flow-canvas"
      onDoubleClick={handleDoubleClick}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onInit={handleInit}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDragStop={handleNodeDragStop}
        onSelectionChange={handleSelectionChange}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        zoomOnDoubleClick={onEmptyDoubleClick ? false : undefined}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
