import * as React from "react";
import { cn } from "@/lib/utils";

export interface FlowStudioShellProps {
  header?: React.ReactNode;
  palette?: React.ReactNode;
  canvas?: React.ReactNode;
  inspector?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function FlowStudioShell({
  header,
  palette,
  canvas,
  inspector,
  children,
  className,
}: FlowStudioShellProps) {
  const canvasContent = canvas ?? children;

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col bg-background", className)}
      data-testid="flow-studio-shell"
    >
      <header
        aria-label="Flow Studio header"
        className="flex h-14 shrink-0 items-center border-b bg-background px-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          aria-label="Node palette"
          className="hidden w-64 shrink-0 overflow-y-auto border-r bg-background md:block"
        >
          {palette}
        </aside>

        <main
          aria-label="Flow canvas"
          className="relative min-w-0 flex-1 overflow-hidden bg-muted/20"
        >
          {canvasContent}
        </main>

        <aside
          aria-label="Node inspector"
          className="hidden w-80 shrink-0 overflow-y-auto border-l bg-background lg:block"
        >
          {inspector}
        </aside>
      </div>
    </div>
  );
}
