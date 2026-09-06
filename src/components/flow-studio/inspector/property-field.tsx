"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FlowPropertyDefinition } from "@/lib/flows/registry/node-definition";

export interface PropertyFieldProps {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  className?: string;
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
 */
export function PropertyField({ definition, value, onChange, className }: PropertyFieldProps) {
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
            <StringField value={value} onChange={onChange} fieldId={fieldId} descriptionId={descriptionId} />
          ) : definition.type === "number" ? (
            <NumberField value={value} onChange={onChange} fieldId={fieldId} descriptionId={descriptionId} />
          ) : definition.type === "select" ? (
            <SelectField
              definition={definition}
              value={value}
              onChange={onChange}
              fieldId={fieldId}
              descriptionId={descriptionId}
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
            <ExpressionField value={value} onChange={onChange} fieldId={fieldId} descriptionId={descriptionId} />
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
  value,
  onChange,
  fieldId,
  descriptionId,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
}) {
  // Preserve explicit values; only null/undefined render as empty text.
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
  return (
    <Input
      id={fieldId}
      aria-describedby={descriptionId}
      type="text"
      value={text}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

function NumberField({
  value,
  onChange,
  fieldId,
  descriptionId,
}: {
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
  return (
    <Input
      id={fieldId}
      aria-describedby={descriptionId}
      type="number"
      value={text}
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
}: {
  definition: FlowPropertyDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
}) {
  const options = Array.isArray(definition.options) ? definition.options : [];
  // Match by strict option value so false/0 select the correct option.
  const matched = options.find((option) => Object.is(option.value, value));
  const domValue = matched ? String(matched.value) : value === undefined || value === null ? "" : String(value);
  const showUnmatchedNote = matched === undefined && domValue !== "";

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
      {showUnmatchedNote ? (
        <p className="text-xs text-muted-foreground">Saved value is preserved but is not a known option.</p>
      ) : null}
    </React.Fragment>
  );
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
  value,
  onChange,
  fieldId,
  descriptionId,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  fieldId: string;
  descriptionId: string | undefined;
}) {
  // FS-0062: expression is opaque text; no parsing or Monaco here.
  // Preserve explicit values; only null/undefined render as empty text.
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
  return (
    <Textarea
      id={fieldId}
      aria-describedby={descriptionId}
      value={text}
      rows={3}
      spellCheck={false}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
