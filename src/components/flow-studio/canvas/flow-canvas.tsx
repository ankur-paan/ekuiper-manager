"use client";

import * as React from "react";
import {
  Background,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";

import { FlowNode } from "../nodes/flow-node";
import { FLOW_CANVAS_NODE_TYPE } from "./to-react-flow";

export const flowNodeTypes: NodeTypes = {
  [FLOW_CANVAS_NODE_TYPE]: FlowNode,
};

export interface FlowCanvasProps {
  nodes?: Node[];
  edges?: Edge[];
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  nodeTypes?: NodeTypes;
  className?: string;
}

export function FlowCanvas({
  nodes = [],
  edges = [],
  onNodesChange,
  onEdgesChange,
  onConnect,
  nodeTypes = flowNodeTypes,
  className,
}: FlowCanvasProps) {
  return (
    <div
      aria-label="Flow canvas"
      className={cn("h-full min-h-0 w-full", className)}
      data-testid="flow-canvas"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
