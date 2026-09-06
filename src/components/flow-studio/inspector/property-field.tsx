"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FlowOptionItem, FlowPropertyDefinition } from "@/lib/flows/registry/node-definition";
import { mergeFlowPropertyOptions } from "@/lib/flows/registry/node-definition";

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
 * expression (plain textarea, opaque text; Monaco comes later) controls.
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

  return (
    <React.Fragment>
      <select
        id={fieldId}
        aria-describedby={descriptionId}
        aria-label={definition.label}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        )}
        value={options.some((option) => String(option.value) === domValue) ? domValue : ""}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const selected = options.find((option) => String(option.value) === raw);
          onChange(selected ? selected.value : raw);
        }}
        data-testid={`property-field-select-${definition.key}`}
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {showLoadingNote ? (
        <p className="text-xs text-muted-foreground">Loading options…</p>
      ) : null}
      {providerFailed ? (
        <p className="text-xs text-muted-foreground">
          Live options could not be loaded. Saved value is preserved.
        </p>
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
  // FS-0062: expression is opaque text; no parsing or Monaco here.
  // Preserve explicit values; only null/undefined render as empty text.
  // FS-0146: honour placeholder as a display-only hint.
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
  const placeholder =
    typeof definition.typeOptions?.placeholder === "string" ? definition.typeOptions.placeholder : undefined;
  return (
    <Textarea
      id={fieldId}
      aria-describedby={descriptionId}
      value={text}
      rows={3}
      spellCheck={false}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
