"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlowDiagnostic } from "@/lib/flows/model/diagnostic";

export interface ValidationPanelProps {
  flowId: string;
  clientDiagnostics: FlowDiagnostic[];
  className?: string;
}

interface ServerValidationState {
  valid: boolean | null;
  diagnostics: FlowDiagnostic[];
}

function isFlowDiagnostic(value: unknown): value is FlowDiagnostic {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["code"] === "string" &&
    (record["severity"] === "error" ||
      record["severity"] === "warning" ||
      record["severity"] === "info") &&
    typeof record["message"] === "string"
  );
}

function readErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const nested = record["error"];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const message = (nested as Record<string, unknown>)["message"];
      if (typeof message === "string" && message.length > 0) return message;
    }
  }
  return `Request failed (${status})`;
}

function formatNodeReference(diagnostic: FlowDiagnostic): string | null {
  const parts: string[] = [];
  if (diagnostic.nodeId) parts.push(`node ${diagnostic.nodeId}`);
  if (diagnostic.edgeId) parts.push(`edge ${diagnostic.edgeId}`);
  if (diagnostic.propertyPath) parts.push(diagnostic.propertyPath);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function DiagnosticList({
  diagnostics,
  testId,
}: {
  diagnostics: FlowDiagnostic[];
  testId: string;
}) {
  if (diagnostics.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={`${testId}-empty`}>
        No issues found.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {diagnostics.map((diagnostic) => {
        const reference = formatNodeReference(diagnostic);
        return (
          <li
            key={`${diagnostic.code}|${diagnostic.nodeId ?? ""}|${diagnostic.edgeId ?? ""}|${diagnostic.propertyPath ?? ""}|${diagnostic.message}`}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs",
              diagnostic.severity === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-muted bg-muted/40 text-muted-foreground",
            )}
            data-testid={testId}
            data-severity={diagnostic.severity}
            role={diagnostic.severity === "error" ? "alert" : "status"}
          >
            <span className="font-medium">{diagnostic.code}</span>
            {": "}
            {diagnostic.message}
            {reference ? (
              <span className="mt-0.5 block truncate opacity-80" title={reference}>
                {reference}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * FS-0083 validation tab: renders the current client diagnostics passed
 * from the page and triggers authoritative server validation manually.
 * Server validation is on demand only (button click), never on mount.
 */
export function ValidationPanel({
  flowId,
  clientDiagnostics,
  className,
}: ValidationPanelProps) {
  const [server, setServer] = React.useState<ServerValidationState>({
    valid: null,
    diagnostics: [],
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const errorCount = clientDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  const handleServerValidation = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/flows/${encodeURIComponent(flowId)}/validate`,
          { method: "POST", cache: "no-store" },
        );
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(readErrorMessage(payload, response.status));
          return;
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setError("Unexpected validation response.");
          return;
        }
        const record = payload as Record<string, unknown>;
        const valid = record["valid"];
        const diagnostics = record["diagnostics"];
        if (typeof valid !== "boolean" || !Array.isArray(diagnostics)) {
          setError("Unexpected validation response.");
          return;
        }
        setServer({
          valid,
          diagnostics: diagnostics.filter(isFlowDiagnostic),
        });
      } catch (requestError) {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Validation request failed.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  return (
    <div
      className={cn("flex min-h-0 flex-col gap-3", className)}
      data-testid="flow-validation-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground" data-testid="flow-validation-client-summary">
          {clientDiagnostics.length === 0
            ? "Client checks: no issues."
            : `Client checks: ${errorCount} error(s), ${clientDiagnostics.length} total finding(s).`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleServerValidation}
          disabled={loading}
          data-testid="flow-validation-server-button"
        >
          {loading ? "Validating…" : "Run server validation"}
        </Button>
        {server.valid !== null ? (
          <span
            className={cn(
              "text-xs font-medium",
              server.valid ? "text-green-700" : "text-destructive",
            )}
            data-testid="flow-validation-server-summary"
          >
            {server.valid ? "Server: valid" : "Server: invalid"}
          </span>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
          data-testid="flow-validation-server-error"
        >
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto md:grid-cols-2">
        <section aria-label="Client diagnostics">
          <h4 className="mb-1.5 text-xs font-semibold">Client checks</h4>
          <DiagnosticList
            diagnostics={clientDiagnostics}
            testId="flow-validation-client-diagnostic"
          />
        </section>
        <section aria-label="Server diagnostics">
          <h4 className="mb-1.5 text-xs font-semibold">Server validation</h4>
          {server.valid === null && !error ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="flow-validation-server-empty"
            >
              Not run yet. Use &ldquo;Run server validation&rdquo; to check the
              saved draft.
            </p>
          ) : (
            <DiagnosticList
              diagnostics={server.diagnostics}
              testId="flow-validation-server-diagnostic"
            />
          )}
        </section>
      </div>
    </div>
  );
}
