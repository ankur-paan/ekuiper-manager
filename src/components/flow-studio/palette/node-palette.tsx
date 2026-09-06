import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type {
  FlowNodeCategory,
  FlowNodeDefinition,
} from "@/lib/flows/registry/node-definition";
import type { TargetCapabilityProfile } from "@/lib/flows/capabilities/types";
import { isDefinitionSupportedByCapabilities } from "@/lib/flows/validation/capability-validation";

export interface NodePaletteProps {
  definitions?: FlowNodeDefinition[];
  /**
   * Normalized target capability profile (FS-0080).
   *
   * Consumed only through `isDefinitionSupportedByCapabilities`: no version
   * comparison lives in this component. When omitted, every definition is
   * treated as available (existing behavior). When provided, unsupported
   * definitions render disabled with a reason instead of being hidden, and
   * cannot start a drag.
   */
  capabilities?: TargetCapabilityProfile;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Browser drag/drop MIME for palette node creation (FS-0066).
 *
 * The payload contains only `{ type, version }`, never a full executable
 * object. The canvas drop target resolves the definition from the built-in
 * registry and creates the node via the editor store.
 */
export const FLOW_PALETTE_DRAG_MIME = "application/x-ekuiper-flow-node";

export interface FlowPaletteDragPayload {
  type: string;
  version: number;
}

/**
 * Deterministic palette section order.
 *
 * This is a category order only, not a node catalog: every rendered node
 * comes from the `definitions` prop (sourced from the built-in registry),
 * so a registry addition appears without editing this file.
 */
const PALETTE_CATEGORY_ORDER: readonly FlowNodeCategory[] = [
  "source",
  "transform",
  "streaming",
  "routing",
  "sink",
];

const PALETTE_CATEGORY_LABELS: Record<FlowNodeCategory, string> = {
  source: "Sources",
  transform: "Transforms",
  streaming: "Streaming",
  routing: "Routing",
  sink: "Sinks",
};

function groupPaletteDefinitions(
  definitions: FlowNodeDefinition[],
): Array<{ category: FlowNodeCategory; items: FlowNodeDefinition[] }> {
  const byCategory = new Map<FlowNodeCategory, FlowNodeDefinition[]>();
  for (const definition of definitions) {
    const items = byCategory.get(definition.category);
    if (items) {
      items.push(definition);
    } else {
      byCategory.set(definition.category, [definition]);
    }
  }
  const groups: Array<{ category: FlowNodeCategory; items: FlowNodeDefinition[] }> = [];
  for (const category of PALETTE_CATEGORY_ORDER) {
    const items = byCategory.get(category);
    if (!items || items.length === 0) continue;
    // Deterministic within-category order independent of registry
    // insertion order: sort by type, then version, then display name.
    const ordered = [...items].sort((a, b) => {
      if (a.type !== b.type) return a.type < b.type ? -1 : 1;
      if (a.version !== b.version) return a.version - b.version;
      if (a.displayName !== b.displayName) {
        return a.displayName < b.displayName ? -1 : 1;
      }
      return 0;
    });
    groups.push({ category, items: ordered });
  }
  return groups;
}

/**
 * Case-insensitive substring match across display name, type, and
 * description. Synchronous: the built-in set is small enough that no
 * debounce or fuzzy-search dependency is needed (FS-0064).
 */
function matchesPaletteSearch(
  definition: FlowNodeDefinition,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return true;
  if (definition.displayName.toLowerCase().includes(normalized)) return true;
  if (definition.type.toLowerCase().includes(normalized)) return true;
  if ((definition.description ?? "").toLowerCase().includes(normalized)) {
    return true;
  }
  return false;
}

export function NodePalette({ definitions, capabilities, children, className }: NodePaletteProps) {
  const [search, setSearch] = React.useState("");
  const filteredDefinitions = React.useMemo(
    () =>
      definitions
        ? definitions.filter((definition) => matchesPaletteSearch(definition, search))
        : undefined,
    [definitions, search],
  );
  const groups = React.useMemo(
    () => (filteredDefinitions ? groupPaletteDefinitions(filteredDefinitions) : null),
    [filteredDefinitions],
  );
  const hasQuery = search.trim().length > 0;

  let body: React.ReactNode;
  if (children !== undefined) {
    body = children;
  } else if (!groups || groups.length === 0) {
    body = hasQuery ? (
      <p role="status" className="text-xs text-muted-foreground">
        No nodes match your search.
      </p>
    ) : (
      <p className="text-xs text-muted-foreground">
        No nodes available yet.
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.category} aria-label={PALETTE_CATEGORY_LABELS[group.category]}>
            <h3 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {PALETTE_CATEGORY_LABELS[group.category]}
            </h3>
            <ul className="flex flex-col gap-1">
              {group.items.map((definition) => {
                // FS-0080: capability-aware availability without version
                // checks. Unsupported definitions stay visible but disabled
                // so existing flows remain understandable; only the drag
                // affordance is removed.
                const status = capabilities
                  ? isDefinitionSupportedByCapabilities(definition, capabilities)
                  : { supported: true as const };
                const unavailable = !status.supported;
                const reason =
                  !status.supported && 'reason' in status && typeof status.reason === 'string'
                    ? status.reason
                    : null;
                return (
                <li
                  key={`${definition.type}@${definition.version}`}
                  data-testid={`node-palette-item-${definition.type}`}
                  data-capability-unavailable={unavailable ? 'true' : undefined}
                  aria-disabled={unavailable ? 'true' : undefined}
                  title={reason ?? undefined}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    unavailable
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-grab active:cursor-grabbing",
                  )}
                  draggable={!unavailable}
                  onDragStart={(event) => {
                    if (unavailable) {
                      event.preventDefault();
                      return;
                    }
                    const payload: FlowPaletteDragPayload = {
                      type: definition.type,
                      version: definition.version,
                    };
                    event.dataTransfer.setData(
                      FLOW_PALETTE_DRAG_MIME,
                      JSON.stringify(payload),
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <p className="text-xs font-medium leading-tight">
                    {definition.displayName}
                  </p>
                  {definition.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {definition.description}
                    </p>
                  ) : null}
                  {reason ? (
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      Unavailable: {reason}
                    </p>
                  ) : null}
                </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <section
      aria-label="Node palette panel"
      className={cn("flex h-full min-h-0 flex-col", className)}
      data-testid="node-palette"
    >
      <div className="shrink-0 space-y-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold leading-tight">Palette</h2>
        {children === undefined ? (
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search nodes"
            aria-label="Search nodes"
            data-testid="node-palette-search"
            className="h-8"
          />
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {body}
      </div>
    </section>
  );
}
