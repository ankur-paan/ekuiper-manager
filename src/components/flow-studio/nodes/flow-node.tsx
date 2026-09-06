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
  const category = data.definition?.category ?? data.category;
  const inputs = resolvePorts(data.inputs, data.definition?.inputs);
  const outputs = resolvePorts(data.outputs, data.definition?.outputs);
  const title = data.name || "Unnamed node";
  const subtitle =
    data.definition?.displayName ??
    (typeof data.displayName === "string" ? data.displayName : undefined);
  const showSubtitle = subtitle !== undefined && subtitle !== title;

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
