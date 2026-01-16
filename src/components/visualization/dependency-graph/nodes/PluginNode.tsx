"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Puzzle, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PluginNodeData {
  name: string;
  pluginType: "source" | "sink" | "function";
  status: "loaded" | "error" | "unloaded";
}

export const PluginNode = memo(({ data, selected }: NodeProps<PluginNodeData>) => {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-background shadow-lg min-w-[130px] ${
        selected ? "border-sota-blue ring-2 ring-sota-blue/30" : "border-violet-500/50"
      }`}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-violet-500 !w-3 !h-3"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-violet-500 !w-3 !h-3"
      />

      <div className="flex items-center gap-2 mb-1">
        <Puzzle className="h-4 w-4 text-violet-500" />
        <span className="font-medium text-sm">{data.name}</span>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-violet-500/10">
          {data.pluginType}
        </Badge>
        <Badge
          variant={data.status === "loaded" ? "default" : "secondary"}
          className="text-[10px] px-1 py-0"
        >
          {data.status === "loaded" ? (
            <Check className="h-2 w-2 mr-0.5" />
          ) : (
            <X className="h-2 w-2 mr-0.5" />
          )}
          {data.status}
        </Badge>
      </div>

      <div className="absolute top-0 left-0 w-full h-1 bg-violet-500 rounded-t" />
    </div>
  );
});

PluginNode.displayName = "PluginNode";
