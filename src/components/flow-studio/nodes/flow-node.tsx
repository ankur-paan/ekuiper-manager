"use client";

import * as React from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Check } from "lucide-react";

import { useShallow } from "zustand/shallow";
import { cn } from "@/lib/utils";
import {
  isFlowNodeAccentToken,
  isFlowNodeIconToken,
  resolveFlowNodeSubtitle,
  type FlowNodeAccentToken,
  type FlowNodeCategory,
  type FlowNodeIconToken,
  type FlowPortDefinition,
} from "@/lib/flows/registry/node-definition";
import type { FlowNodeRuntimeMetrics } from "@/lib/flows/runtime/metrics-types";
import {
  selectFlowNodeMetrics,
  useFlowRuntimeStore,
} from "@/stores/flow-runtime-store";
import { useFlowEditorStore } from "@/stores/flow-editor-store";

/**
 * Subset of FlowNodeDefinition metadata the canvas chrome may render.
 *
 * Only display/ports/presentation metadata is carried; property forms,
 * docs, Monaco, metrics, and runtime state are never rendered here
 * (see UI_PERFORMANCE_SPEC canvas rendering rules).
 */
export interface FlowNodeDefinitionSummary {
  displayName?: string;
  category?: FlowNodeCategory;
  inputs?: FlowPortDefinition[];
  outputs?: FlowPortDefinition[];
  /**
   * FS-0148: optional canvas icon token. A named token from the fixed
   * set only (never a URL/SVG payload); unknown tokens fall back to the
   * category mark.
   */
  icon?: string;
  /**
   * FS-0148: optional canvas accent token. A named token only (never a
   * raw colour); unknown tokens fall back to the neutral style.
   */
  accent?: string;
  /**
   * FS-0148: optional canvas subtitle key naming one property whose
   * scalar value renders as the truncated canvas subtitle.
   */
  subtitleKey?: string;
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
  /**
   * FS-0148: Flow node config carried for subtitle resolution
   * (`definition.subtitleKey`). Display-only read; never mutated here.
   */
  config?: Record<string, unknown>;
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

/**
 * FS-0148: bounded local accent styles keyed by accent token.
 *
 * Tokens only; the definition never carries a raw colour and this map is
 * the only place a token becomes a style. Unknown tokens use neutral.
 */
const FLOW_NODE_ACCENT_BAR_CLASS: Record<FlowNodeAccentToken, string> = {
  source: "bg-sky-500",
  transform: "bg-violet-500",
  streaming: "bg-emerald-500",
  routing: "bg-amber-500",
  sink: "bg-slate-500",
  neutral: "bg-transparent",
};

/**
 * FS-0148: local glyph for a known icon token.
 *
 * Text mark only; no remote asset, no URL, no SVG payload is ever
 * loaded. Unknown tokens return undefined so the caller falls back to
 * the category mark.
 */
export function resolveFlowNodeIconMark(icon: unknown): string | undefined {
  if (!isFlowNodeIconToken(icon)) {
    return undefined;
  }
  const token: FlowNodeIconToken = icon;
  return token.slice(0, 1).toUpperCase();
}

function formatMetricNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * FS-0105: tiny bounded one-line summary of a node's current runtime
 * metrics. Returns undefined when nothing was reported (absent means
 * unknown, never fabricated). Counters render when present; dropped/error
 * counts only when nonzero; source-reported rates and latency render when
 * present. Never touches the Flow document.
 */
function formatFlowNodeMetricSummary(
  metrics: FlowNodeRuntimeMetrics | undefined,
): string | undefined {
  if (!metrics) return undefined;
  const parts: string[] = [];
  if (metrics.inputTotal !== undefined) {
    parts.push(`in ${formatMetricNumber(metrics.inputTotal)}`);
  }
  if (metrics.outputTotal !== undefined) {
    parts.push(`out ${formatMetricNumber(metrics.outputTotal)}`);
  }
  if (metrics.droppedTotal !== undefined && metrics.droppedTotal > 0) {
    parts.push(`drop ${formatMetricNumber(metrics.droppedTotal)}`);
  }
  if (metrics.errorTotal !== undefined && metrics.errorTotal > 0) {
    parts.push(`err ${formatMetricNumber(metrics.errorTotal)}`);
  }
  if (metrics.inputRatePerSec !== undefined) {
    parts.push(`${formatMetricNumber(metrics.inputRatePerSec)}/s in`);
  }
  if (metrics.outputRatePerSec !== undefined) {
    parts.push(`${formatMetricNumber(metrics.outputRatePerSec)}/s out`);
  }
  if (metrics.latencyMsAvg !== undefined) {
    parts.push(`~${formatMetricNumber(metrics.latencyMsAvg)}ms`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * FS-0124: memoized canvas node renderer.
 *
 * The function below stays a plain component so hooks and the fine-grained
 * FS-0105 runtime subscription read naturally; the memo wrapper skips
 * re-rendering when XYFlow parent props (`data`, `selected`) are
 * referentially unchanged. This only pays off because the page memoizes the
 * `toReactFlow` adapter on document slices and the canvas preserves
 * node-object identity for untouched selection flags — otherwise every
 * parent render would hand this component fresh props and memo would be
 * dead weight. No behavior change: same props still render the same chrome.
 */
function FlowNodeView({ data, selected }: FlowNodeProps) {
  // FS-0105: fine-grained runtime subscription. The node reads only its own
  // metrics entry (keyed by the editor document id + its own node id) with a
  // shallow comparison, so a metrics update for an unrelated node with
  // unchanged values for this node does not rerender this component. The
  // full snapshot is never passed through canvas node props.
  const runtimeFlowId = useFlowEditorStore(
    (state) => state.document?.metadata.id,
  );
  const nodeIdForMetrics = typeof data.id === "string" ? data.id : "";
  const nodeMetrics = useFlowRuntimeStore(
    useShallow((state) =>
      runtimeFlowId !== undefined && nodeIdForMetrics !== ""
        ? selectFlowNodeMetrics(state, runtimeFlowId, nodeIdForMetrics)
        : undefined,
    ),
  );
  const metricSummary = formatFlowNodeMetricSummary(nodeMetrics);
  const unsupported = data.unsupported === true;
  const category = data.definition?.category ?? data.category;
  const inputs = resolvePorts(data.inputs, data.definition?.inputs);
  const outputs = resolvePorts(data.outputs, data.definition?.outputs);
  const title = data.name || "Unnamed node";
  // FS-0148: presentation metadata. Guards fail open to the legacy chrome
  // (category mark, neutral style, displayName subtitle) without throwing.
  const iconMark = resolveFlowNodeIconMark(data.definition?.icon);
  const rawAccent = data.definition?.accent;
  const accentToken: FlowNodeAccentToken = isFlowNodeAccentToken(rawAccent)
    ? rawAccent
    : "neutral";
  const config =
    typeof data.config === "object" && data.config !== null
      ? (data.config as Record<string, unknown>)
      : undefined;
  const subtitleKey = data.definition?.subtitleKey;
  const legacySubtitle =
    data.definition?.displayName ??
    (typeof data.displayName === "string" ? data.displayName : undefined);
  // When a subtitleKey is declared the subtitle is the referenced
  // property value only; otherwise the legacy displayName applies.
  const subtitle =
    subtitleKey !== undefined
      ? resolveFlowNodeSubtitle(config, subtitleKey)
      : legacySubtitle;
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
        "relative w-52 border shadow-sm flow-studio-node",
        selected ? "border-2 flow-studio-node-selected" : undefined,
      )}
      data-accent={accentToken}
      data-selected={selected === true ? "true" : undefined}
      data-testid="flow-node"
    >
      {inputs.map((port, index) => (
        <Handle
          key={`in-${port.id}`}
          aria-label={`Input ${port.label ?? port.id}`}
          className="!border flow-studio-port !h-[var(--flow-port-size)] !w-[var(--flow-port-size)]"
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
          className="!border flow-studio-port !h-[var(--flow-port-size)] !w-[var(--flow-port-size)]"
          data-testid={`flow-node-output-${port.id}`}
          id={port.id}
          position={Position.Right}
          style={{ top: handleTop(index, outputs.length) }}
          title={port.label ?? port.id}
          type="source"
        />
      ))}

      <div className="flex items-center gap-2 pt-2 flow-studio-node-body">
        {selected === true ? (
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full flow-studio-selected-mark"
            data-testid="flow-node-selected-mark"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : null}
        <span
          aria-label={
            iconMark !== undefined
              ? `Icon: ${data.definition?.icon}`
              : category !== undefined
                ? `Category: ${category}`
                : "Category: uncategorized"
          }
          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-semibold uppercase leading-none text-muted-foreground"
          data-icon={iconMark !== undefined ? data.definition?.icon : undefined}
          data-testid="flow-node-category"
          title={
            iconMark !== undefined
              ? String(data.definition?.icon)
              : (category ?? "uncategorized")
          }
        >
          {iconMark ?? (category ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium" data-testid="flow-node-title" title={title}>
          {title}
        </span>
        {hasValidationError ? (
          <span
            aria-label={`${validationErrorCount} validation error${validationErrorCount === 1 ? "" : "s"}`}
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border flow-studio-error-badge px-1 text-[11px] font-bold leading-none"
            data-testid="flow-node-validation-badge"
            data-validation="error"
            title={`${validationErrorCount} validation error${validationErrorCount === 1 ? "" : "s"}. See inspector for details.`}
          >
            {validationErrorCount}
          </span>
        ) : hasValidationWarning ? (
          <span
            aria-label={`${validationWarningCount} validation warning${validationWarningCount === 1 ? "" : "s"}`}
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border flow-studio-warning-badge px-1 text-[11px] font-bold leading-none"
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
          className="truncate pb-1 text-xs text-muted-foreground flow-studio-node-body"
          data-testid="flow-node-subtitle"
          title={subtitle}
        >
          {subtitle}
        </div>
      ) : null}

      {metricSummary !== undefined ? (
        <div
          className="truncate pb-1 text-[10px] tabular-nums text-muted-foreground flow-studio-node-body"
          data-testid="flow-node-metrics"
          title={metricSummary}
        >
          {metricSummary}
        </div>
      ) : null}

      {unsupported === true ? (
        <div className="pb-2 flow-studio-node-body">
          <span
            className="inline-flex items-center rounded border flow-studio-unsupported-badge px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
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
          "mb-2 mt-1 h-0.5 rounded mx-[var(--flow-spacing)]",
          selected === true
            ? "flow-studio-node-accent-selected"
            : FLOW_NODE_ACCENT_BAR_CLASS[accentToken],
        )}
      />
    </div>
  );
}

export const FlowNode = React.memo(FlowNodeView);
