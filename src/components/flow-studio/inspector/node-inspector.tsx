import * as React from "react";

import { cn } from "@/lib/utils";

export interface NodeInspectorProps {
  selectedNodeId?: string | null;
  children?: React.ReactNode;
  className?: string;
}

export function NodeInspector({
  selectedNodeId,
  children,
  className,
}: NodeInspectorProps) {
  return (
    <section
      aria-label="Node inspector panel"
      className={cn("flex h-full min-h-0 flex-col", className)}
      data-testid="node-inspector"
    >
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="text-sm font-semibold leading-tight">Inspector</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {children ??
          (selectedNodeId ? (
            <p className="text-xs text-muted-foreground">
              No inspector available for this node yet.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Select a node to inspect.
            </p>
          ))}
      </div>
    </section>
  );
}
