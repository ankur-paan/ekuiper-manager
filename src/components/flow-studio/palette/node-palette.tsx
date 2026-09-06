import * as React from "react";

import { cn } from "@/lib/utils";
import type {
  FlowNodeCategory,
  FlowNodeDefinition,
} from "@/lib/flows/registry/node-definition";

export interface NodePaletteProps {
  definitions?: FlowNodeDefinition[];
  children?: React.ReactNode;
  className?: string;
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

export function NodePalette({ definitions, children, className }: NodePaletteProps) {
  const groups = React.useMemo(
    () => (definitions ? groupPaletteDefinitions(definitions) : null),
    [definitions],
  );

  let body: React.ReactNode;
  if (children !== undefined) {
    body = children;
  } else if (!groups || groups.length === 0) {
    body = (
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
              {group.items.map((definition) => (
                <li
                  key={`${definition.type}@${definition.version}`}
                  data-testid={`node-palette-item-${definition.type}`}
                  className="rounded-md border px-3 py-2"
                >
                  <p className="text-xs font-medium leading-tight">
                    {definition.displayName}
                  </p>
                  {definition.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {definition.description}
                    </p>
                  ) : null}
                </li>
              ))}
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
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="text-sm font-semibold leading-tight">Palette</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {body}
      </div>
    </section>
  );
}
