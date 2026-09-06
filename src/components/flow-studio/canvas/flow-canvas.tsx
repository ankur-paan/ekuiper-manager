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
  type OnNodeDrag,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";

import { FlowNode } from "../nodes/flow-node";
import { FLOW_CANVAS_NODE_TYPE } from "./to-react-flow";

export const flowNodeTypes: NodeTypes = {
  [FLOW_CANVAS_NODE_TYPE]: FlowNode,
};

export interface FlowCanvasNodeDragStopMove {
  nodeId: string;
  position: { x: number; y: number };
}

export interface FlowCanvasProps {
  nodes?: Node[];
  edges?: Edge[];
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  onNodeDragStop?: (moves: FlowCanvasNodeDragStopMove[]) => void;
  nodeTypes?: NodeTypes;
  className?: string;
}

export function FlowCanvas({
  nodes = [],
  edges = [],
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDragStop,
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

  return (
    <div
      aria-label="Flow canvas"
      className={cn("h-full min-h-0 w-full", className)}
      data-testid="flow-canvas"
    >
      <ReactFlow
        nodes={viewNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
