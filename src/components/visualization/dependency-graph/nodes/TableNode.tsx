"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Table2, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TableNodeData {
  name: string;
  type: "lookup" | "scan";
  keys?: string[];
}

export const TableNode = memo(({ data, selected }: NodeProps<TableNodeData>) => {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-background shadow-lg min-w-[140px] ${
        selected ? "border-sota-blue ring-2 ring-sota-blue/30" : "border-amber-500/50"
      }`}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-amber-500 !w-3 !h-3"
      />

      <div className="flex items-center gap-2 mb-2">
        <Table2 className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm">{data.name}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/10">
          {data.type}
        </Badge>
      </div>

      {data.keys && data.keys.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Key className="h-3 w-3 text-amber-400" />
          <span>{data.keys.join(", ")}</span>
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 rounded-t" />
    </div>
  );
});

TableNode.displayName = "TableNode";
