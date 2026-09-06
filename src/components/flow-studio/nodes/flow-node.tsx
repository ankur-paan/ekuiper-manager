"use client";

import * as React from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  FlowNodeCategory,
  FlowPortDefinition,
} from "@/lib/flows/registry/node-definition";

/**
 * Subset of FlowNodeDefinition metadata the canvas chrome may render.
 *
 * Only display/ports metadata is carried; property forms, docs, Monaco,
 * metrics, and runtime state are never rendered here
 * (see UI_PERFORMANCE_SPEC canvas rendering rules).
 */
export interface FlowNodeDefinitionSummary {
  displayName?: string;
  category?: FlowNodeCategory;
  inputs?: FlowPortDefinition[];
  outputs?: FlowPortDefinition[];
}

/**
 * View data accepted by the generic Flow node renderer.
 *
 * Compatible with the `to-react-flow` adapter node data
 * (`id/type/typeVersion/name/config`); definition metadata is optional so
 * nodes without a resolved definition still render with zero handles.
 */
export interface FlowNodeData extends Record<string, unknown> {
  name: string;
  displayName?: string;
  category?: FlowNodeCategory;
  inputs?: FlowPortDefinition[];
  outputs?: FlowPortDefinition[];
  definition?: FlowNodeDefinitionSummary;
  /**
   * Set by the page/view adapter when the (type, typeVersion) definition
   * could not be resolved. The node still renders safely with zero
   * handles plus an explicit unsupported mark.
   */
  unsupported?: boolean;
  /**
   * FS-0068: node-scoped validation counts computed by the page from
   * existing client validators. Counts/status only; detailed messages
   * live in the inspector. Never persisted into the Flow document.
   */
  validationErrorCount?: number;
  validationWarningCount?: number;
}

export type FlowNodeProps = NodeProps<Node<FlowNodeData>>;

function resolvePorts(
  direct: FlowPortDefinition[] | undefined,
  fromDefinition: FlowPortDefinition[] | undefined,
): FlowPortDefinition[] {
  if (fromDefinition !== undefined) {
    return fromDefinition;
  }
  return direct ?? [];
}

function handleTop(index: number, total: number): string {
  if (total <= 1) {
    return "50%";
  }
  return `${((index + 1) / (total + 1)) * 100}%`;
}

export function FlowNode({ data, selected }: FlowNodeProps) {
  const unsupported = data.unsupported === true;
  const category = data.definition?.category ?? data.category;
  const inputs = resolvePorts(data.inputs, data.definition?.inputs);
  const outputs = resolvePorts(data.outputs, data.definition?.outputs);
  const title = data.name || "Unnamed node";
  const subtitle =
    data.definition?.displayName ??
    (typeof data.displayName === "string" ? data.displayName : undefined);
  const showSubtitle = subtitle !== undefined && subtitle !== title;
  // FS-0068: badge chrome only. Counts arrive via node data; messages stay
  // in the inspector. Non-color cues: numeric count plus accessible label.
  const validationErrorCount =
    typeof data.validationErrorCount === "number" && Number.isFinite(data.validationErrorCount) && data.validationErrorCount > 0
      ? Math.floor(data.validationErrorCount)
      : 0;
  const validationWarningCount =
    typeof data.validationWarningCount === "number" && Number.isFinite(data.validationWarningCount) && data.validationWarningCount > 0
      ? Math.floor(data.validationWarningCount)
      : 0;
  const hasValidationError = validationErrorCount > 0;
  const hasValidationWarning = !hasValidationError && validationWarningCount > 0;

  return (
    <div
      aria-selected={selected === true}
      className={cn(
        "relative w-52 rounded-md border bg-card text-card-foreground shadow-sm",
        selected
          ? "border-2 border-primary ring-2 ring-primary ring-offset-2"
          : "border-border",
      )}
      data-selected={selected === true ? "true" : undefined}
      data-testid="flow-node"
    >
      {inputs.map((port, index) => (
        <Handle
          key={`in-${port.id}`}
          aria-label={`Input ${port.label ?? port.id}`}
          className="!h-2.5 !w-2.5 !border !border-primary !bg-background"
          data-testid={`flow-node-input-${port.id}`}
          id={port.id}
          position={Position.Left}
          style={{ top: handleTop(index, inputs.length) }}
          title={port.label ?? port.id}
          type="target"
        />
      ))}
      {outputs.map((port, index) => (
        <Handle
          key={`out-${port.id}`}
          aria-label={`Output ${port.label ?? port.id}`}
          className="!h-2.5 !w-2.5 !border !border-primary !bg-background"
          data-testid={`flow-node-output-${port.id}`}
          id={port.id}
          position={Position.Right}
          style={{ top: handleTop(index, outputs.length) }}
          title={port.label ?? port.id}
          type="source"
        />
      ))}

      <div className="flex items-center gap-2 px-3 pt-2">
        {selected === true ? (
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            data-testid="flow-node-selected-mark"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : null}
        <span
          aria-label={category !== undefined ? `Category: ${category}` : "Category: uncategorized"}
          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-semibold uppercase leading-none text-muted-foreground"
          data-testid="flow-node-category"
          title={category ?? "uncategorized"}
        >
          {(category ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium" data-testid="flow-node-title" title={title}>
          {title}
        </span>
        {hasValidationError ? (
          <span
            aria-label={`${validationErrorCount} validation error${validationErrorCount === 1 ? "" : "s"}`}
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-destructive bg-destructive px-1 text-[11px] font-bold leading-none text-destructive-foreground"
            data-testid="flow-node-validation-badge"
            data-validation="error"
            title={`${validationErrorCount} validation error${validationErrorCount === 1 ? "" : "s"}. See inspector for details.`}
          >
            {validationErrorCount}
          </span>
        ) : hasValidationWarning ? (
          <span
            aria-label={`${validationWarningCount} validation warning${validationWarningCount === 1 ? "" : "s"}`}
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-yellow-500 bg-yellow-400 px-1 text-[11px] font-bold leading-none text-yellow-950"
            data-testid="flow-node-validation-badge"
            data-validation="warning"
            title={`${validationWarningCount} validation warning${validationWarningCount === 1 ? "" : "s"}. See inspector for details.`}
          >
            {validationWarningCount}
          </span>
        ) : null}
      </div>

      {showSubtitle === true ? (
        <div
          className="truncate px-3 pb-1 text-xs text-muted-foreground"
          data-testid="flow-node-subtitle"
          title={subtitle}
        >
          {subtitle}
        </div>
      ) : null}

      {unsupported === true ? (
        <div className="px-3 pb-2">
          <span
            className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
            data-testid="flow-node-unsupported"
            title="Unknown node type. The saved node is preserved."
          >
            Unsupported
          </span>
        </div>
      ) : null}

      <span className="sr-only">
        {selected === true ? "Selected" : "Not selected"}
      </span>

      <div
        aria-hidden="true"
        className={cn(
          "mx-3 mb-2 mt-1 h-0.5 rounded",
          selected === true ? "bg-primary" : "bg-transparent",
        )}
      />
    </div>
  );
}
