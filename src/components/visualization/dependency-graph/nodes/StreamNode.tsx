"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Database, Play, Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StreamNodeData {
  name: string;
  status: "active" | "inactive";
  schema?: string[];
}

export const StreamNode = memo(({ data, selected }: NodeProps<StreamNodeData>) => {
  return (
    <div className={`relative px-4 py-3 rounded-lg border bg-background/95 backdrop-blur shadow-lg min-w-[180px] transition-all duration-300 ${selected
        ? "border-sota-blue ring-2 ring-sota-blue/30 scale-105 z-10"
        : "border-border hover:border-sota-blue/50"
      }`}>
      {/* Decorative Gradient Top Line */}
      <div className={`absolute top-0 left-0 w-full h-1 rounded-t bg-gradient-to-r ${data.status === 'active' ? 'from-blue-500 to-cyan-300' : 'from-gray-400 to-gray-300'
        }`} />

      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-4 !rounded-sm" />

      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-md ${data.status === 'active' ? 'bg-blue-500/10' : 'bg-gray-500/10'}`}>
          <Database className={`h-4 w-4 ${data.status === 'active' ? 'text-blue-500' : 'text-gray-500'}`} />
        </div>
        <span className="font-semibold text-sm">{data.name}</span>

        <Badge
          variant={data.status === "active" ? "default" : "secondary"}
          className={`ml-auto text-[10px] px-1.5 py-0 h-5 border-0 ${data.status === 'active' ? 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30' : ''
            }`}
        >
          {data.status === "active" ? (
            <Play className="h-2 w-2 mr-1 fill-current" />
          ) : (
            <Pause className="h-2 w-2 mr-1" />
          )}
          {data.status}
        </Badge>
      </div>

      {data.schema && data.schema.length > 0 && (
        <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded border border-border/50">
          <div className="font-medium text-blue-500 mb-1">Fields</div>
          <div className="flex flex-wrap gap-1">
            {data.schema.slice(0, 3).map((field) => (
              <span key={field} className="px-1 py-0.5 rounded bg-background border text-muted-foreground">{field}</span>
            ))}
            {data.schema.length > 3 && (
              <span className="px-1 py-0.5 rounded bg-background border text-muted-foreground">+{data.schema.length - 3}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

StreamNode.displayName = "StreamNode";
