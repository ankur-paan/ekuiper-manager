"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlowDeploymentArtifact } from "@/lib/flows/compiler/types";
import type { FlowDiagnostic } from "@/lib/flows/model/diagnostic";

export interface DefinitionPanelProps {
  flowId: string;
  className?: string;
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

function isDeploymentArtifact(value: unknown): value is FlowDeploymentArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["compilerVersion"] === "number" &&
    typeof record["semanticHash"] === "string" &&
    typeof record["ruleId"] === "string" &&
    !!record["ruleDefinition"] &&
    typeof record["ruleDefinition"] === "object" &&
    !!record["runtimeNodeMap"] &&
    typeof record["runtimeNodeMap"] === "object"
  );
}

/**
 * FS-0083 definition tab: fetches the side-effect-free compile endpoint
 * on demand (button click only, never on mount/tab open) and displays the
 * compiled artifact as formatted JSON in a lightweight scrollable
 * pre/code block. Monaco is intentionally not loaded here.
 */
export function DefinitionPanel({ flowId, className }: DefinitionPanelProps) {
  const [artifact, setArtifact] = React.useState<FlowDeploymentArtifact | null>(
    null,
  );
  const [diagnostics, setDiagnostics] = React.useState<FlowDiagnostic[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  const handleLoad = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        // Read-only inspection: the compile endpoint validates and
        // compiles the saved server draft without persisting a
        // deployment and without calling eKuiper create/update rule.
        const response = await fetch(
          `/api/flows/${encodeURIComponent(flowId)}/compile`,
          { method: "POST", cache: "no-store" },
        );
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(readErrorMessage(payload, response.status));
          setLoaded(true);
          return;
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setError("Unexpected compile response.");
          setLoaded(true);
          return;
        }
        const record = payload as Record<string, unknown>;
        const nextDiagnostics = Array.isArray(record["diagnostics"])
          ? record["diagnostics"].filter(isFlowDiagnostic)
          : [];
        setDiagnostics(nextDiagnostics);
        if (
          record["valid"] === true &&
          isDeploymentArtifact(record["artifact"])
        ) {
          setArtifact(record["artifact"]);
        } else {
          setArtifact(null);
        }
        setLoaded(true);
      } catch (requestError) {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Compile request failed.",
        );
        setLoaded(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  const formatted = React.useMemo(() => {
    if (!artifact) return null;
    try {
      return JSON.stringify(artifact, null, 2);
    } catch {
      return null;
    }
  }, [artifact]);

  return (
    <div
      className={cn("flex min-h-0 flex-col gap-2", className)}
      data-testid="flow-definition-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLoad}
          disabled={loading}
          data-testid="flow-definition-load-button"
        >
          {loading
            ? "Loading…"
            : artifact
              ? "Refresh definition"
              : "Load definition"}
        </Button>
        {loaded && !loading && !error ? (
          <span
            className="text-xs text-muted-foreground"
            data-testid="flow-definition-summary"
          >
            {artifact
              ? `rule ${artifact.ruleId} · compiler v${artifact.compilerVersion}`
              : "Flow is invalid; fix diagnostics and reload."}
          </span>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
          data-testid="flow-definition-error"
        >
          {error}
        </div>
      ) : null}

      {diagnostics.length > 0 && !artifact ? (
        <ul className="flex max-h-28 flex-col gap-1.5 overflow-y-auto">
          {diagnostics.map((diagnostic) => (
            <li
              key={`${diagnostic.code}|${diagnostic.nodeId ?? ""}|${diagnostic.edgeId ?? ""}|${diagnostic.message}`}
              className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
              data-testid="flow-definition-diagnostic"
              data-severity={diagnostic.severity}
              role={diagnostic.severity === "error" ? "alert" : "status"}
            >
              <span className="font-medium">{diagnostic.code}</span>
              {": "}
              {diagnostic.message}
              {diagnostic.nodeId ? (
                <span className="mt-0.5 block truncate opacity-80">
                  node {diagnostic.nodeId}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {formatted !== null ? (
        // Lightweight scrollable viewer: the JSON area scrolls internally
        // rather than expanding the page, and Monaco stays unloaded.
        <div
          className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30"
          data-testid="flow-definition-scroll"
        >
          <pre className="max-h-56 min-h-24 p-3 text-xs leading-relaxed">
            <code data-testid="flow-definition-json">{formatted}</code>
          </pre>
        </div>
      ) : !loaded && !loading ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="flow-definition-empty"
        >
          Not loaded yet. Loading the definition is read-only and does not
          deploy.
        </p>
      ) : null}
    </div>
  );
}
