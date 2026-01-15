"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ArrowRightFromLine, Cloud, Database, FileText, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SinkNodeData {
  name: string;
  sinkType: "mqtt" | "influx" | "log" | "rest" | "kafka" | "file" | "memory";
  config?: Record<string, any>;
}

export const SinkNode = memo(({ data, selected }: NodeProps<SinkNodeData>) => {
  const sinkIcon = {
    mqtt: <Cloud className="h-4 w-4 text-red-500" />,
    influx: <Database className="h-4 w-4 text-red-500" />,
    log: <FileText className="h-4 w-4 text-red-500" />,
    rest: <Send className="h-4 w-4 text-red-500" />,
    kafka: <ArrowRightFromLine className="h-4 w-4 text-red-500" />,
    file: <FileText className="h-4 w-4 text-red-500" />,
    memory: <Database className="h-4 w-4 text-red-500" />,
  };

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-background shadow-lg min-w-[140px] ${
        selected ? "border-sota-blue ring-2 ring-sota-blue/30" : "border-red-500/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-red-500 !w-3 !h-3"
      />

      <div className="flex items-center gap-2 mb-1">
        {sinkIcon[data.sinkType] || <ArrowRightFromLine className="h-4 w-4 text-red-500" />}
        <span className="font-medium text-sm">{data.name}</span>
      </div>

      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-500/10">
        {data.sinkType}
      </Badge>

      {data.config && Object.keys(data.config).length > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          {Object.entries(data.config)
            .slice(0, 2)
            .map(([k, v]) => (
              <div key={k} className="truncate">
                <span className="text-red-400">{k}:</span> {String(v)}
              </div>
            ))}
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-1 bg-red-500 rounded-t" />
    </div>
  );
});

SinkNode.displayName = "SinkNode";
