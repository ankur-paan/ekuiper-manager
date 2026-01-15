"use client";

import { useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

import { usePipelineStore } from "@/stores/pipeline-store";
import { nodeTypes } from "./nodes";
import { PipelineToolbar } from "./toolbar";
import { NodeConfigPanel } from "./node-config-panel";
import { Button } from "@/components/ui/button";
import { Plus, Database, Cpu, Send } from "lucide-react";
import { generateId } from "@/lib/utils";
import { DecisionTreeNode } from "@/lib/ekuiper/types";

function PipelineCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
    selectedNodeId,
  } = usePipelineStore();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: event.clientX - bounds.left - 100,
        y: event.clientY - bounds.top - 40,
      };

      const newNode: DecisionTreeNode = {
        id: `${type}_${generateId()}`,
        type: type as "source" | "processor" | "sink",
        position,
        data: {
          label: type === "source" ? "New Source" : type === "processor" ? "New Processor" : "New Sink",
          ...(type === "source" && { streamName: "my_stream", memoryTopic: "topic/data" }),
          ...(type === "processor" && { sql: "SELECT * FROM stream", ruleId: `rule_${generateId()}` }),
          ...(type === "sink" && { config: { log: {} } }),
        },
      };

      addNode(newNode);
    },
    [addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full">
      <div ref={reactFlowWrapper} className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "#58a6ff", strokeWidth: 2 },
          }}
        >
          <Background color="#30363d" gap={20} />
          <Controls className="!bg-card !border-border" />
          <MiniMap
            className="!bg-card !border-border"
            nodeColor={(node) => {
              switch (node.type) {
                case "source":
                  return "#22c55e";
                case "processor":
                  return "#3b82f6";
                case "sink":
                  return "#a855f7";
                default:
                  return "#6b7280";
              }
            }}
          />
          
          <Panel position="top-left" className="!m-2">
            <PipelineToolbar />
          </Panel>

          <Panel position="top-right" className="!m-2">
            <div className="flex flex-col gap-2 bg-card p-3 rounded-lg border border-border">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Drag to add nodes
              </div>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 cursor-grab"
                draggable
                onDragStart={(e) => onDragStart(e, "source")}
              >
                <Database className="h-4 w-4 text-green-500" />
                Source
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 cursor-grab"
                draggable
                onDragStart={(e) => onDragStart(e, "processor")}
              >
                <Cpu className="h-4 w-4 text-blue-500" />
                Processor
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 cursor-grab"
                draggable
                onDragStart={(e) => onDragStart(e, "sink")}
              >
                <Send className="h-4 w-4 text-purple-500" />
                Sink
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>
      
      {/* Configuration Panel */}
      {selectedNodeId && (
        <div className="w-80 border-l border-border bg-card overflow-y-auto">
          <NodeConfigPanel nodeId={selectedNodeId} />
        </div>
      )}
    </div>
  );
}

export function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner />
    </ReactFlowProvider>
  );
}
