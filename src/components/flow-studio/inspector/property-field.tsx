"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowOptionItem, FlowPropertyDefinition } from "@/lib/flows/registry/node-definition";
import { mergeFlowPropertyOptions } from "@/lib/flows/registry/node-definition";
import type { ExpressionEditorProps } from "./expression-editor";

/**
 * FS-0128: expression editing is lazy. The Monaco-backed editor lives in
 * `./expression-editor` and is split into its own client chunk so flows
 * without expression fields never load or instantiate Monaco.
 */
const ExpressionEditor = dynamic<ExpressionEditorProps>(
  () => import("./expression-editor").then((mod) => mod.ExpressionEditor),
  {
    ssr: false,
    loading: () => (
      <p className="text-xs text-muted-foreground">
        Loading expression editor…
      </p>
    ),
  },
);

export interface PropertyFieldProps {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  className?: string;
  /**
   * FS-0147: optional registered eKuiper node id used when a select
   * property declares `optionsProvider`. Carried as a query id only,
   * never a URL. When omitted the server uses the selected/default node.
   */
  optionsTargetNodeId?: string;
}

/**
 * FS-0061: generic property control renderer.
 * FS-0062: adds json (plain textarea with local parse error) and
 * expression (plain textarea, opaque text) controls.
 * FS-0128: expression rendering is delegated to the lazily-loaded
 * `./expression-editor` (Monaco on focus, textarea fallback); no custom
 * expression parser/autocomplete here.
 *
 * Renders string/number/boolean/select/json/expression controls from a
 * FlowPropertyDefinition. Other definition types (secret-ref or future
 * types) render a non-destructive placeholder and never write into node
 * config; dedicated tickets own those controls. No node-specific React
 * editor lives here.
 *
 * FS-0146: honours `typeOptions` display hints. `multiline` renders a
 * string as a textarea, `password` masks a string input (display only;
 * storage semantics unchanged), and `placeholder`/`min`/`max`/`step`
 * are passed through to the underlying control.
 *
 * FS-0147: a `select` property may declare `optionsProvider` (a named
 * provider id, never a URL). The select then merges its static `options`
 * with the live names/ids served by `GET /api/flows/options/[provider]`.
 */
export function PropertyField({ definition, value, onChange, className, optionsTargetNodeId }: PropertyFieldProps) {
  const fieldId = React.useId();
  const descriptionId = definition.description ? `${fieldId}-description` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-testid={`property-field-${definition.key}`}>
      {definition.type === "boolean" ? (
        <BooleanField
          definition={definition}
          value={value}
          onChange={onChange}
          fieldId={fieldId}
          descriptionId={descriptionId}
        />
      ) : (
        <React.Fragment>
          <Label htmlFor={fieldId}>
            {definition.label}
            {definition.required === true ? (
              <span aria-hidden="true" className="ml-1 text-destructive">
                *
              </span>
            ) : null}
          </Label>
          {definition.type === "string" ? (
            <StringField
              definition={definition}
              value={value}
              onChange={onChange}
              fieldId={fieldId}
              descriptionId={descriptionId}
            />
          ) : definition.type === "number" ? (
            <NumberField
              definition={definition}
              value={value}
              onChange={onChange}
              fieldId={fieldId}
              descriptionId={descriptionId}
            />
          ) : definition.type === "select" ? (
            <SelectField
              definition={definition}
              value={value}
              onChange={onChange}
              fieldId={fieldId}
              descriptionId={descriptionId}
              targetNodeId={optionsTargetNodeId}
            />
          ) : definition.type === "json" ? (
            <JsonField
              definition={definition}
              value={value}
              onChange={onChange}
              fieldId={fieldId}
              descriptionId={descriptionId}
            />
          ) : definition.type === "expression" ? (
            <ExpressionField
              definition={definition}
              value={value}
              onChange={onChange}
              fieldId={fieldId}
              descriptionId={descriptionId}
            />
          ) : (
            <p className="text-xs text-muted-foreground" data-testid={`property-field-unsupported-${definition.key}`}>
              {`Property type "${definition.type}" is not editable yet. Saved value is preserved.`}
            </p>
          )}
          {definition.description ? (
            <p id={descriptionId} className="text-xs text-muted-foreground">
              {definition.description}
            </p>
          ) : null}
        </React.Fragment>
      )}
    </div>
  );
}

function StringField({
  definition,
  value,
  onChange,
  fieldId,
  descriptionId,
}: {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
}) {
  // Preserve explicit values; only null/undefined render as empty text.
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
  const typeOptions = definition.typeOptions;
  const placeholder = typeof typeOptions?.placeholder === "string" ? typeOptions.placeholder : undefined;
  // FS-0146: multiline renders a textarea; password masks display only
  // (type="password") without changing storage semantics.
  if (typeOptions?.multiline === true) {
    return (
      <Textarea
        id={fieldId}
        aria-describedby={descriptionId}
        value={text}
        rows={4}
        spellCheck={false}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }
  return (
    <Input
      id={fieldId}
      aria-describedby={descriptionId}
      type={typeOptions?.password === true ? "password" : "text"}
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

function NumberField({
  definition,
  value,
  onChange,
  fieldId,
  descriptionId,
}: {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
}) {
  // false/0 must be preserved: only null/undefined/empty render blank.
  const text =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : value === undefined || value === null || value === ""
        ? ""
        : String(value);
  // FS-0146: pass min/max/step/placeholder through to the control.
  // Range enforcement lives in validation, not here; the control only
  // hints. Non-finite option values are ignored (fail-open).
  const typeOptions = definition.typeOptions;
  const min = typeof typeOptions?.min === "number" && Number.isFinite(typeOptions.min) ? typeOptions.min : undefined;
  const max = typeof typeOptions?.max === "number" && Number.isFinite(typeOptions.max) ? typeOptions.max : undefined;
  const step =
    typeof typeOptions?.step === "number" && Number.isFinite(typeOptions.step) ? typeOptions.step : undefined;
  const placeholder =
    typeof typeOptions?.placeholder === "string" ? typeOptions.placeholder : undefined;
  return (
    <Input
      id={fieldId}
      aria-describedby={descriptionId}
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") {
          onChange(undefined);
          return;
        }
        const parsed = Number(raw);
        onChange(Number.isNaN(parsed) ? raw : parsed);
      }}
    />
  );
}

function BooleanField({
  definition,
  value,
  onChange,
  fieldId,
  descriptionId,
}: {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
}) {
  // Strict comparison so false is never coerced into an uncontrolled state.
  const checked = value === true;
  return (
    <React.Fragment>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>
          {definition.label}
          {definition.required === true ? (
            <span aria-hidden="true" className="ml-1 text-destructive">
              *
            </span>
          ) : null}
        </Label>
        <Switch
          id={fieldId}
          aria-describedby={descriptionId}
          checked={checked}
          onCheckedChange={(next) => {
            onChange(next);
          }}
        />
      </div>
      {definition.description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {definition.description}
        </p>
      ) : null}
    </React.Fragment>
  );
}

function SelectField({
  definition,
  value,
  onChange,
  fieldId,
  descriptionId,
  targetNodeId,
}: {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
  targetNodeId?: string;
}) {
  // FS-0147: a named provider id (never a URL) whose live options are
  // merged with the static options below. The provider id comes from the
  // registry-authored definition and is path-encoded; the server resolves
  // it against a fixed allowlist and rejects anything unknown.
  const provider =
    typeof definition.optionsProvider === "string" && definition.optionsProvider.length > 0
      ? definition.optionsProvider
      : null;
  const [providerOptions, setProviderOptions] = React.useState<FlowOptionItem[] | null>(null);
  const [providerFailed, setProviderFailed] = React.useState(false);

  React.useEffect(() => {
    if (provider === null) {
      setProviderOptions(null);
      setProviderFailed(false);
      return;
    }
    let cancelled = false;
    setProviderOptions(null);
    setProviderFailed(false);
    const trimmedTarget = typeof targetNodeId === "string" ? targetNodeId.trim() : "";
    const url =
      trimmedTarget.length > 0
        ? `/api/flows/options/${encodeURIComponent(provider)}?targetNodeId=${encodeURIComponent(trimmedTarget)}`
        : `/api/flows/options/${encodeURIComponent(provider)}`;
    fetch(url, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) {
          return;
        }
        setProviderOptions(readFlowOptionItems(payload));
      })
      .catch(() => {
        if (!cancelled) {
          setProviderFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provider, targetNodeId]);

  // Static options stay available while the provider loads (and when it
  // fails); provider rows that duplicate a static value are skipped.
  const options = React.useMemo(
    () =>
      mergeFlowPropertyOptions(
        Array.isArray(definition.options) ? definition.options : [],
        providerOptions ?? [],
      ),
    [definition.options, providerOptions],
  );
  // Match by strict option value so false/0 select the correct option.
  const matched = options.find((option) => Object.is(option.value, value));
  const domValue = matched ? String(matched.value) : value === undefined || value === null ? "" : String(value);
  const showUnmatchedNote = matched === undefined && domValue !== "";
  const showLoadingNote = provider !== null && providerOptions === null && !providerFailed;

  // UX-0001: searchable combobox state. `search` filters the merged option
  // list; `activeIndex` tracks keyboard navigation within the filtered
  // rows. Opening resets the filter; Escape closes without writing into
  // node config (selection only commits on click/Enter).
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listboxId = `${fieldId}-listbox`;
  const searchId = `${fieldId}-search`;
  const manualId = `${fieldId}-manual`;

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) {
      return options;
    }
    return options.filter((option) => {
      const haystack = `${option.label} ${String(option.value)}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, search]);

  // Focus moves into the filter field whenever the popup opens.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    setSearch("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open ]);

  // Pointer outside the control closes the popup without committing.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => {
      document.removeEventListener("pointerdown", handler);
    };
  }, [open ]);

  // Keep the keyboard cursor inside the filtered rows.
  React.useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const commitOption = (next: string | number | boolean) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const clearSelection = () => {
    onChange(undefined);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const current = filtered[activeIndex];
      if (current) {
        commitOption(current.value);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      if (!open) {
        event.preventDefault();
        setOpen(true);
      }
    }
  };

  const triggerLabel = matched ? matched.label : domValue !== "" ? domValue : "Select…";
  // Manual fallback mirrors the current value as editable text so a failed
  // provider lookup never blocks authoring; empty text clears the key.
  const manualText = matched ? String(matched.value) : domValue;

  return (
    <React.Fragment>
      <div ref={containerRef} className="relative">
        <Button
          ref={triggerRef}
          type="button"
          id={fieldId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-describedby={descriptionId}
          aria-label={definition.label}
          variant="outline"
          data-testid={`property-field-select-${definition.key}`}
          className="w-full justify-between font-normal"
          onClick={() => {
            setOpen((next) => !next);
          }}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
        {open ? (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="p-1">
              <Input
                ref={searchRef}
                id={searchId}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Type to filter…"
                aria-label={`${definition.label} filter`}
                aria-controls={listboxId}
                aria-activedescendant={filtered.length > 0 ? `${listboxId}-option-${activeIndex}` : undefined}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                data-testid={`property-field-search-${definition.key}`}
              />
            </div>
            <div
              id={listboxId}
              role="listbox"
              aria-label={definition.label}
              className="max-h-60 overflow-y-auto p-1"
            >
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches found.</p>
              ) : (
                filtered.map((option, index) => {
                  const selected = matched !== undefined && Object.is(option.value, matched.value);
                  const active = index === activeIndex;
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      role="option"
                      id={`${listboxId}-option-${index}`}
                      aria-selected={selected}
                      data-testid={`property-field-option-${definition.key}-${String(option.value)}`}
                      className={cn(
                        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                        active ? "bg-accent text-accent-foreground" : "text-foreground",
                      )}
                      onClick={() => {
                        commitOption(option.value);
                      }}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                      }}
                    >
                      <span className="truncate">{option.label}</span>
                      {selected ? (
                        <span className="ml-auto flex h-3.5 w-3.5 items-center justify-center">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
              {domValue !== "" ? (
                <button
                  type="button"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={clearSelection}
                  data-testid={`property-field-clear-${definition.key}`}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {showLoadingNote ? (
        <p className="text-xs text-muted-foreground">Loading options…</p>
      ) : null}
      {providerFailed ? (
        <React.Fragment>
          <p className="text-xs text-muted-foreground" role="status">
            Live options could not be loaded. You can still type a value manually below.
          </p>
          <Input
            id={manualId}
            type="text"
            autoComplete="off"
            spellCheck={false}
            aria-label={`${definition.label} manual entry`}
            placeholder="Type a value manually…"
            value={manualText}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") {
                onChange(undefined);
                return;
              }
              onChange(raw);
            }}
            data-testid={`property-field-manual-${definition.key}`}
          />
        </React.Fragment>
      ) : null}
      {showUnmatchedNote ? (
        <p className="text-xs text-muted-foreground">Saved value is preserved but is not a known option.</p>
      ) : null}
    </React.Fragment>
  );
}

/**
 * Read `{ options: [{ label, value }] }` rows from a provider response.
 *
 * Client-side mirror of the server's names/ids-only contract: only rows
 * with non-empty string label/value survive; anything else is dropped so
 * a malformed payload can never corrupt the select or the saved config.
 */
function readFlowOptionItems(payload: unknown): FlowOptionItem[] {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return [];
  }
  const raw = (payload as Record<string, unknown>).options;
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: FlowOptionItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (
      typeof record.label !== "string" ||
      typeof record.value !== "string" ||
      record.label.length === 0 ||
      record.value.length === 0
    ) {
      continue;
    }
    items.push({ label: record.label, value: record.value });
  }
  return items;
}

function toJsonText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    const serialized = JSON.stringify(value, null, 2);
    return typeof serialized === "string" ? serialized : String(value);
  } catch {
    return String(value);
  }
}

function stableJson(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized : String(value);
  } catch {
    return String(value);
  }
}

function JsonField({
  definition,
  value,
  onChange,
  fieldId,
  descriptionId,
}: {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
}) {
  // Interaction (FS-0062): plain textarea; parse on every change and
  // re-validate on blur. Invalid text (unparseable JSON, or parsed JSON
  // that is not an object/array since the config contract expects an
  // object) stays local as a visible error and is never written into
  // node config, so saved config cannot be corrupted by a typo. Empty
  // text clears the value. External value changes (e.g. undo) resync
  // the local text; locally committed values never trigger a resync so
  // typing is never reformatted or clobbered.
  const [text, setText] = React.useState(() => toJsonText(value));
  const [parseError, setParseError] = React.useState<string | null>(null);
  const committedValueRef = React.useRef<unknown>(value);

  React.useEffect(() => {
    if (stableJson(value) !== stableJson(committedValueRef.current)) {
      committedValueRef.current = value;
      setText(toJsonText(value));
      setParseError(null);
    }
  }, [value]);

  const attemptCommit = (raw: string) => {
    if (raw.trim() === "") {
      committedValueRef.current = undefined;
      setParseError(null);
      onChange(undefined);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid JSON.");
      return;
    }
    if (typeof parsed !== "object" || parsed === null) {
      setParseError("JSON must be an object or array.");
      return;
    }
    committedValueRef.current = parsed;
    setParseError(null);
    onChange(parsed);
  };

  return (
    <React.Fragment>
      <Textarea
        id={fieldId}
        aria-describedby={descriptionId}
        aria-invalid={parseError !== null}
        value={text}
        rows={4}
        spellCheck={false}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          attemptCommit(raw);
        }}
        onBlur={(event) => {
          attemptCommit(event.target.value);
        }}
        data-testid={`property-field-json-${definition.key}`}
      />
      {parseError ? (
        <p
          className="text-xs text-destructive"
          role="alert"
          data-testid={`property-field-error-${definition.key}`}
        >
          {`Invalid JSON: ${parseError} Saved value is unchanged.`}
        </p>
      ) : null}
    </React.Fragment>
  );
}

function ExpressionField({
  definition,
  value,
  onChange,
  fieldId,
  descriptionId,
}: {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
}) {
  // FS-0062: expression is opaque text; no parsing here.
  // FS-0128: Monaco is lazy (./expression-editor): initial render is a
  // textarea fallback and the enhanced editor mounts only on focus, so
  // non-expression flows never instantiate Monaco. The string value
  // round-trips unchanged through either mode.
  // FS-0146: honour placeholder as a display-only hint.
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
  const placeholder =
    typeof definition.typeOptions?.placeholder === "string" ? definition.typeOptions.placeholder : undefined;
  return (
    <ExpressionEditor
      value={text}
      placeholder={placeholder}
      fieldId={fieldId}
      descriptionId={descriptionId}
      onChange={(next) => {
        onChange(next);
      }}
    />
  );
}
