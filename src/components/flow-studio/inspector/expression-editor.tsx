"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { Textarea } from "@/components/ui/textarea";

/**
 * FS-0128: lazily-loaded Monaco input for `expression` properties.
 *
 * The `@monaco-editor/react` default export is resolved through
 * `next/dynamic` (ssr: false) so the Monaco chunk is never part of the
 * Flow Studio initial bundle; it is fetched only when this component
 * actually renders the enhanced editor. There is no custom expression
 * parser or autocomplete in this ticket: stock `javascript` highlighting
 * with suggestions disabled.
 */
const MonacoExpressionInput = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <p className="text-xs text-muted-foreground">
        Loading expression editor…
      </p>
    ),
  },
);

export interface ExpressionEditorProps {
  value: string;
  onChange: (next: string) => void;
  fieldId: string;
  descriptionId?: string;
  placeholder?: string;
}

/**
 * Focus-gated expression editor.
 *
 * Renders a plain textarea until focused/expanded, so merely mounting an
 * expression field (or opening a flow without expression fields at all)
 * never instantiates Monaco. The string value round-trips unchanged in
 * both modes; the enhanced editor is height-bounded.
 */
export function ExpressionEditor({
  value,
  onChange,
  fieldId,
  descriptionId,
  placeholder,
}: ExpressionEditorProps) {
  const [enhanced, setEnhanced] = React.useState(false);

  if (!enhanced) {
    return (
      <Textarea
        id={fieldId}
        aria-describedby={descriptionId}
        value={value}
        rows={3}
        spellCheck={false}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onFocus={() => {
          setEnhanced(true);
        }}
        data-testid="flow-expression-fallback"
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-48 max-h-64 w-full overflow-hidden rounded-md border"
        data-testid="flow-expression-monaco"
      >
        <MonacoExpressionInput
          height="192px"
          language="javascript"
          value={value}
          onChange={(next) => {
            onChange(next ?? "");
          }}
          loading={
            <p className="text-xs text-muted-foreground">
              Loading expression editor…
            </p>
          }
          options={{
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: "off",
            folding: false,
            wordWrap: "on",
            renderValidationDecorations: "off",
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            wordBasedSuggestions: "off",
            hover: { enabled: false },
          }}
        />
      </div>
      <button
        type="button"
        className="self-start text-xs text-muted-foreground underline underline-offset-2"
        aria-describedby={descriptionId}
        onClick={() => {
          setEnhanced(false);
        }}
      >
        Use plain text
      </button>
    </div>
  );
}
