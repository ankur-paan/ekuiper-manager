"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Workflow, Play, Pause, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RuleNodeData {
  name: string;
  status: "running" | "stopped" | "error";
  sql?: string;
  metrics?: {
    throughput: number;
    latency: number;
  };
}

export const RuleNode = memo(({ data, selected }: NodeProps<RuleNodeData>) => {
  const statusIcon = {
    running: <Play className="h-2 w-2 fill-current" />,
    stopped: <Square className="h-2 w-2" />,
    error: <Pause className="h-2 w-2" />,
  };

  const statusColor = {
    running: "bg-green-500/20 text-green-500",
    stopped: "bg-gray-500/20 text-gray-500",
    error: "bg-red-500/20 text-red-500",
  };

  return (
    <div className={`relative px-4 py-3 rounded-lg border bg-background/95 backdrop-blur shadow-lg min-w-[200px] transition-all duration-300 ${selected
        ? "border-sota-blue ring-2 ring-sota-blue/30 scale-105 z-10"
        : "border-border hover:border-sota-blue/50"
      }`}>
      {/* Decorative Gradient Top Line */}
      <div className={`absolute top-0 left-0 w-full h-1 rounded-t bg-gradient-to-r ${data.status === 'running' ? 'from-green-500 to-emerald-300' :
          data.status === 'error' ? 'from-red-500 to-pink-500' :
            'from-gray-400 to-gray-300'
        }`} />

      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-4 !rounded-sm" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-4 !rounded-sm" />

      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-md ${statusColor[data.status].replace('text-', 'bg-').replace('/20', '/10')}`}>
          <Workflow className={`h-4 w-4 ${statusColor[data.status].split(' ')[1]}`} />
        </div>
        <span className="font-semibold text-sm">{data.name}</span>

        {data.status === 'running' && (
          <span className="absolute top-3 right-3 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        )}
      </div>

      {data.sql && (
        <div className="text-[10px] text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border/50 truncate mb-2">
          {data.sql}
        </div>
      )}

      {data.metrics && data.status === "running" && (
        <div className="grid grid-cols-2 gap-2 text-[10px] bg-secondary/30 p-2 rounded">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Throughput</span>
            <span className="font-mono text-green-500 font-medium">{data.metrics.throughput} /s</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-muted-foreground">Latency</span>
            <span className="font-mono text-amber-500 font-medium">{data.metrics.latency}ms</span>
          </div>
        </div>
      )}
    </div>
  );
});

RuleNode.displayName = "RuleNode";
