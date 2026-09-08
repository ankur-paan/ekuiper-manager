"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FlowStudioShellProps {
  header?: React.ReactNode;
  palette?: React.ReactNode;
  canvas?: React.ReactNode;
  inspector?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Collapse state, remembered per browser.
 *
 * Flow Studio's chrome is fixed-width: a 256px palette plus a 320px inspector, on top of the
 * application sidebar. At a 1280px viewport that leaves the canvas around 400px wide - narrower
 * than two 208px nodes side by side - which is why nodes overlap, why panels sit on top of
 * them, and why a node placed near an edge cannot be reached. Node-RED solves this by letting
 * every panel get out of the way; so does this.
 */
const STORAGE_KEY = "flow-studio:panels";

interface PanelState {
  palette: boolean;
  inspector: boolean;
}

function readStoredState(): PanelState {
  if (typeof window === "undefined") return { palette: false, inspector: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { palette: false, inspector: false };
    const parsed = JSON.parse(raw) as Partial<PanelState>;
    return {
      palette: parsed.palette === true,
      inspector: parsed.inspector === true,
    };
  } catch {
    // A blocked or corrupt store must never stop the editor from rendering.
    return { palette: false, inspector: false };
  }
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

  // Start expanded on the server and on first paint, then adopt the stored preference, so the
  // markup does not depend on browser state and hydration stays stable.
  const [collapsed, setCollapsed] = React.useState<PanelState>({
    palette: false,
    inspector: false,
  });
  React.useEffect(() => {
    setCollapsed(readStoredState());
  }, []);

  const toggle = React.useCallback((panel: keyof PanelState) => {
    setCollapsed((current) => {
      const next = { ...current, [panel]: !current[panel] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Preference is a convenience; failing to persist it must not break the toggle.
      }
      return next;
    });
  }, []);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col flow-studio-shell",
        className,
      )}
      data-testid="flow-studio-shell"
    >
      <header
        aria-label="Flow Studio header"
        className="flex h-14 shrink-0 items-center border-b flow-studio-panel px-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {collapsed.palette ? (
          <div className="hidden w-10 shrink-0 flex-col items-center border-r flow-studio-panel py-2 md:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => toggle("palette")}
              aria-expanded={false}
              aria-controls="flow-studio-palette"
              aria-label="Show node palette"
              title="Show node palette"
              data-testid="flow-studio-palette-toggle"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <aside
            id="flow-studio-palette"
            aria-label="Node palette"
            className="hidden w-64 shrink-0 flex-col overflow-hidden border-r flow-studio-panel md:flex"
          >
            <div className="flex shrink-0 items-center justify-end px-1 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggle("palette")}
                aria-expanded
                aria-controls="flow-studio-palette"
                aria-label="Hide node palette"
                title="Hide node palette"
                data-testid="flow-studio-palette-toggle"
              >
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{palette}</div>
          </aside>
        )}

        <main
          aria-label="Flow canvas"
          className="relative min-w-0 flex-1 overflow-hidden flow-studio-canvas"
        >
          {canvasContent}
        </main>

        {collapsed.inspector ? (
          <div className="hidden w-10 shrink-0 flex-col items-center border-l flow-studio-panel py-2 lg:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => toggle("inspector")}
              aria-expanded={false}
              aria-controls="flow-studio-inspector"
              aria-label="Show node inspector"
              title="Show node inspector"
              data-testid="flow-studio-inspector-toggle"
            >
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <aside
            id="flow-studio-inspector"
            aria-label="Node inspector"
            className="hidden w-80 shrink-0 flex-col overflow-hidden border-l flow-studio-panel lg:flex"
          >
            <div className="flex shrink-0 items-center px-1 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggle("inspector")}
                aria-expanded
                aria-controls="flow-studio-inspector"
                aria-label="Hide node inspector"
                title="Hide node inspector"
                data-testid="flow-studio-inspector-toggle"
              >
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{inspector}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
