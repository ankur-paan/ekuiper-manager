"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Database, Cpu, Send, MoreVertical, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usePipelineStore } from "@/stores/pipeline-store";

interface NodeData {
  label: string;
  ruleId?: string;
  sql?: string;
  streamName?: string;
  memoryTopic?: string;
  config?: Record<string, any>;
  status?: "running" | "stopped" | "error";
}

// Source Node - Data input (MQTT, Memory, etc.)
export const SourceNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
  const { removeNode, selectNode } = usePipelineStore();

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-card min-w-[180px]",
        "transition-all duration-200",
        selected
          ? "border-green-500 shadow-lg shadow-green-500/20"
          : "border-green-500/50 hover:border-green-500"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-green-500" />
          <span className="font-medium text-sm">Source</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => selectNode(id)}>
              <Edit2 className="mr-2 h-3 w-3" />
              Configure
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => removeNode(id)}
              className="text-red-500"
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="text-xs text-muted-foreground mb-1">
        {data.streamName || "Unnamed Stream"}
      </div>
      
      {data.memoryTopic && (
        <Badge variant="outline" className="text-xs">
          {data.memoryTopic}
        </Badge>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"
      />
    </div>
  );
});

SourceNode.displayName = "SourceNode";

// Processor Node - Rule processing
export const ProcessorNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
  const { removeNode, selectNode } = usePipelineStore();

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-card min-w-[200px]",
        "transition-all duration-200",
        selected
          ? "border-blue-500 shadow-lg shadow-blue-500/20"
          : "border-blue-500/50 hover:border-blue-500"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background"
      />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-sm">Processor</span>
        </div>
        <div className="flex items-center gap-1">
          {data.status && (
            <Badge
              variant={
                data.status === "running"
                  ? "success"
                  : data.status === "error"
                  ? "destructive"
                  : "secondary"
              }
              className="text-xs"
            >
              {data.status}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => selectNode(id)}>
                <Edit2 className="mr-2 h-3 w-3" />
                Edit SQL
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => removeNode(id)}
                className="text-red-500"
              >
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="text-xs font-medium mb-1">
        {data.label || data.ruleId || "Unnamed Rule"}
      </div>
      
      {data.sql && (
        <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded max-h-16 overflow-hidden">
          {data.sql.length > 60 ? data.sql.substring(0, 60) + "..." : data.sql}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background"
      />
    </div>
  );
});

ProcessorNode.displayName = "ProcessorNode";

// Sink Node - Data output (MQTT, REST, Log, etc.)
export const SinkNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
  const { removeNode, selectNode } = usePipelineStore();
  
  const getSinkType = () => {
    if (!data.config) return "log";
    const keys = Object.keys(data.config);
    return keys[0] || "log";
  };

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-card min-w-[160px]",
        "transition-all duration-200",
        selected
          ? "border-purple-500 shadow-lg shadow-purple-500/20"
          : "border-purple-500/50 hover:border-purple-500"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background"
      />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-purple-500" />
          <span className="font-medium text-sm">Sink</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => selectNode(id)}>
              <Edit2 className="mr-2 h-3 w-3" />
              Configure
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => removeNode(id)}
              className="text-red-500"
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="text-xs text-muted-foreground mb-1">
        {data.label || getSinkType()}
      </div>
      
      <Badge variant="outline" className="text-xs capitalize">
        {getSinkType()}
      </Badge>
    </div>
  );
});

SinkNode.displayName = "SinkNode";

// Export node types for React Flow
export const nodeTypes = {
  source: SourceNode,
  processor: ProcessorNode,
  sink: SinkNode,
};
