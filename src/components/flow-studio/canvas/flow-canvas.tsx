"use client";

import * as React from "react";
import {
  Background,
  ReactFlow,
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

  // Adopt committed document positions (flow load or drag-stop commit).
  // The prop reference only changes when the parent derives a new view
  // model, so in-progress drags are not clobbered per pointer event.
  React.useEffect(() => {
    setViewNodes(nodes);
  }, [nodes]);

  const handleNodesChange = React.useCallback(
    (changes: NodeChange[]) => {
      setViewNodes((current) => applyNodeChanges(changes, current));
      onNodesChange?.(changes);
    },
    [onNodesChange],
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
  const handleSelectionChange: OnSelectionChangeFunc = React.useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      onSelectionChange?.({
        nodeIds: selectedNodes.map((selectedNode) => selectedNode.id),
        edgeIds: selectedEdges.map((selectedEdge) => selectedEdge.id),
      });
    },
    [onSelectionChange],
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
        ? edges.map((edge) => ({
            ...edge,
            selected: selectedEdgeSet.has(edge.id),
          }))
        : edges,
    [edges, selectedEdgeSet],
  );

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
        onEdgesChange={onEdgesChange}
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
