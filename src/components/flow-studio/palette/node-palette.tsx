import * as React from "react";

import { cn } from "@/lib/utils";

export interface NodePaletteProps {
  children?: React.ReactNode;
  className?: string;
}

export function NodePalette({ children, className }: NodePaletteProps) {
  return (
    <section
      aria-label="Node palette panel"
      className={cn("flex h-full min-h-0 flex-col", className)}
      data-testid="node-palette"
    >
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="text-sm font-semibold leading-tight">Palette</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {children ?? (
          <p className="text-xs text-muted-foreground">
            No nodes available yet.
          </p>
        )}
      </div>
    </section>
  );
}
