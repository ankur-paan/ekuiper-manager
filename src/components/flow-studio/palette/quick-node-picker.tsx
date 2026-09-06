"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { FlowNodeDefinition } from "@/lib/flows/registry/node-definition";

export interface QuickNodePickerPosition {
  x: number;
  y: number;
}

export interface QuickNodePickerProps {
  definitions: FlowNodeDefinition[];
  /** Viewport client coordinate where the picker opens at/near the cursor. */
  position: QuickNodePickerPosition;
  onSelect: (definition: FlowNodeDefinition) => void;
  onClose: () => void;
  className?: string;
}

/**
 * Case-insensitive substring match across display name, type, and
 * description. Mirrors the palette search/filter interaction (FS-0064)
 * without duplicating the registry catalog: the picker only renders the
 * `definitions` prop sourced from the built-in registry. Synchronous: the
 * built-in set is small enough that no debounce or fuzzy-search dependency
 * is needed.
 */
export function filterQuickNodeDefinitions(
  definitions: FlowNodeDefinition[],
  query: string,
): FlowNodeDefinition[] {
  const normalized = query.trim().toLowerCase();
  const matched =
    normalized.length === 0
      ? [...definitions]
      : definitions.filter((definition) => {
          if (definition.displayName.toLowerCase().includes(normalized)) {
            return true;
          }
          if (definition.type.toLowerCase().includes(normalized)) return true;
          if ((definition.description ?? "").toLowerCase().includes(normalized)) {
            return true;
          }
          return false;
        });
  // Deterministic order independent of registry insertion order.
  matched.sort((a, b) => {
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    if (a.version !== b.version) return a.version - b.version;
    if (a.displayName !== b.displayName) {
      return a.displayName < b.displayName ? -1 : 1;
    }
    return 0;
  });
  return matched;
}

/**
 * Compact searchable picker for quick node creation (FS-0070).
 *
 * Opened by double-clicking empty canvas; selecting a node creates it at
 * the clicked flow coordinate via the caller. Escape closes without
 * mutation. The list is keyboard navigable (ArrowUp/ArrowDown + Enter)
 * and the search input is focused on mount.
 */
export function QuickNodePicker({
  definitions,
  position,
  onSelect,
  onClose,
  className,
}: QuickNodePickerProps) {
  const [search, setSearch] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const filtered = React.useMemo(
    () => filterQuickNodeDefinitions(definitions, search),
    [definitions, search],
  );

  // Keep the highlight inside the filtered list as the query changes.
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [search, definitions]);

  // Focus the search input on mount so the picker is keyboard searchable
  // immediately without an extra click.
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clampedStyle = React.useMemo<React.CSSProperties>(() => {
    if (typeof window === "undefined") {
      return { left: position.x, top: position.y };
    }
    const width = 288;
    const maxHeight = 320;
    const left = Math.max(8, Math.min(position.x, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(position.y, window.innerHeight - maxHeight - 8));
    return { left, top, width, maxHeight };
  }, [position]);

  const highlighted = filtered[highlightedIndex] ?? null;

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((current) =>
          filtered.length === 0 ? 0 : (current + 1) % filtered.length,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((current) =>
          filtered.length === 0
            ? 0
            : (current - 1 + filtered.length) % filtered.length,
        );
        return;
      }
      if (event.key === "Enter") {
        if (highlighted) {
          event.preventDefault();
          onSelect(highlighted);
        }
      }
    },
    [filtered.length, highlighted, onClose, onSelect],
  );

  return (
    <div
      role="dialog"
      aria-label="Quick node picker"
      data-testid="quick-node-picker"
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-md border bg-background shadow-lg",
        className,
      )}
      style={clampedStyle}
      onKeyDown={handleKeyDown}
    >
      <div className="shrink-0 space-y-1 border-b px-3 py-2">
        <p className="text-xs font-semibold leading-tight">Add node</p>
        <Input
          ref={inputRef}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search nodes"
          aria-label="Search nodes"
          data-testid="quick-node-picker-search"
          className="h-8"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
            No nodes match your search.
          </p>
        ) : (
          <ul role="listbox" aria-label="Matching nodes" className="flex flex-col gap-0.5">
            {filtered.map((definition, index) => {
              const highlightedItem = index === highlightedIndex;
              return (
                <li key={`${definition.type}@${definition.version}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={highlightedItem}
                    data-testid={`quick-node-picker-item-${definition.type}`}
                    data-highlighted={highlightedItem ? "true" : "false"}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      highlightedItem && "bg-accent text-accent-foreground",
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onFocus={() => setHighlightedIndex(index)}
                    onClick={() => onSelect(definition)}
                  >
                    <span className="font-medium leading-tight">
                      {definition.displayName}
                    </span>
                    {definition.description ? (
                      <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        {definition.description}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="shrink-0 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        Enter to add, Esc to close
      </p>
    </div>
  );
}
