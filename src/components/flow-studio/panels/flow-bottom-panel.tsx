"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { FlowDiagnostic } from "@/lib/flows/model/diagnostic";
import { DefinitionPanel } from "./definition-panel";
import { ValidationPanel } from "./validation-panel";
import { TestPanel } from "./test-panel";

export type FlowBottomPanelTab = "validation" | "definition" | "test";

export interface FlowBottomPanelProps {
  flowId: string;
  clientDiagnostics: FlowDiagnostic[];
  /**
   * FS-0109: capability gate for the Test Output tab, sourced from the
   * normalized target profile (`TargetCapabilityProfile.ruleTest`).
   * Defaults to false (conservative: unproven means unsupported).
   */
  ruleTestSupported?: boolean;
  className?: string;
}

/**
 * FS-0083 bottom dock: collapsible Validation/Definition tabs pinned
 * beneath the canvas. Both tabs fetch on demand only; nothing here
 * mutates runtime or deployment state.
 */
export function FlowBottomPanel({
  flowId,
  clientDiagnostics,
  ruleTestSupported = false,
  className,
}: FlowBottomPanelProps) {
  const [open, setOpen] = React.useState(true);
  const [tab, setTab] = React.useState<FlowBottomPanelTab>("validation");

  const clientErrorCount = clientDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  if (!open) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-t bg-background px-3 py-1.5",
          className,
        )}
        data-testid="flow-bottom-panel-collapsed"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="flow-bottom-panel"
          data-testid="flow-bottom-panel-expand"
        >
          Show panel
        </Button>
        <span className="text-xs text-muted-foreground">
          {clientErrorCount === 0
            ? "Validation: no client errors"
            : `Validation: ${clientErrorCount} client error(s)`}
        </span>
      </div>
    );
  }

  return (
    <section
      id="flow-bottom-panel"
      aria-label="Flow bottom panel"
      className={cn(
        "flex h-64 shrink-0 flex-col border-t bg-background",
        className,
      )}
      data-testid="flow-bottom-panel"
    >
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (next === "validation" || next === "definition" || next === "test")
            setTab(next);
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pt-1.5">
          <TabsList aria-label="Flow bottom panel tabs">
            <TabsTrigger value="validation" data-testid="flow-bottom-panel-tab-validation">
              Validation
              {clientErrorCount > 0 ? ` (${clientErrorCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="definition" data-testid="flow-bottom-panel-tab-definition">
              Definition
            </TabsTrigger>
            <TabsTrigger value="test" data-testid="flow-bottom-panel-tab-test">
              Test Output
            </TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            aria-expanded={true}
            aria-controls="flow-bottom-panel"
            data-testid="flow-bottom-panel-collapse"
          >
            Hide
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
          <TabsContent
            value="validation"
            className="h-full min-h-0 overflow-y-auto data-[state=inactive]:hidden"
            data-testid="flow-bottom-panel-content-validation"
          >
            <ValidationPanel flowId={flowId} clientDiagnostics={clientDiagnostics} />
          </TabsContent>
          <TabsContent
            value="definition"
            className="h-full min-h-0 overflow-hidden data-[state=inactive]:hidden"
            data-testid="flow-bottom-panel-content-definition"
          >
            <DefinitionPanel flowId={flowId} />
          </TabsContent>
          <TabsContent
            value="test"
            className="h-full min-h-0 overflow-y-auto data-[state=inactive]:hidden"
            data-testid="flow-bottom-panel-content-test"
          >
            <TestPanel flowId={flowId} ruleTestSupported={ruleTestSupported} />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
