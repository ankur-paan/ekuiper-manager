"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TestPanelProps {
  flowId: string;
  /**
   * FS-0109: capability gate from the normalized target profile
   * (`TargetCapabilityProfile.ruleTest`, always false since FS-0106 until
   * a later ticket proves a safe SSE relay and graph-rule test envelope;
   * see docs/FLOW_STUDIO_RULE_TEST_NOTES.md). While false no test request
   * is ever issued; the FS-0108 test-run route is also not present yet, so
   * a request on a hypothetically supported target that 404s surfaces as
   * an ordinary request error instead of fabricated output.
   */
  ruleTestSupported: boolean;
  className?: string;
}

/** Hard client-side bound: the panel never retains more than this. */
export const MAX_TEST_EVENTS = 100;

/** Per-entry display bound: longer payloads render truncated. */
const MAX_EVENT_CHARS = 2000;

interface TestOutputEntry {
  kind: "event" | "error";
  /** Display string, already truncated to MAX_EVENT_CHARS. */
  text: string;
  truncated: boolean;
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

/**
 * Coerce one unknown test output entry to a bounded display string.
 * The FS-0108 response contract does not exist yet, so nothing here
 * assumes an entry shape: strings render as-is, everything else renders
 * via a guarded JSON stringify with an object fallback.
 */
function toDisplayEntry(value: unknown, kind: "event" | "error"): TestOutputEntry {
  let text: string;
  if (typeof value === "string") {
    text = value;
  } else {
    try {
      const serialized = JSON.stringify(value);
      text = serialized ?? String(value);
    } catch {
      text = String(value);
    }
  }
  if (text.length > MAX_EVENT_CHARS) {
    return { kind, text: text.slice(0, MAX_EVENT_CHARS), truncated: true };
  }
  return { kind, text, truncated: false };
}

/**
 * FS-0109 Test Output panel: capability-gated Run/Cancel controls plus a
 * bounded list of test output entries rendered with lightweight pre/code
 * (no JSON tree dependency). Test output is display-only here and is never
 * fed into node components (deferred to FS-0110).
 */
export function TestPanel({ flowId, ruleTestSupported, className }: TestPanelProps) {
  const [running, setRunning] = React.useState(false);
  const [entries, setEntries] = React.useState<TestOutputEntry[]>([]);
  const [droppedCount, setDroppedCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [hasRun, setHasRun] = React.useState(false);
  const controllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [flowId]);

  const handleCancel = React.useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const handleRun = React.useCallback(() => {
    // Capability gate: unsupported targets never issue a request.
    if (!ruleTestSupported) return;
    // Single-flight guard: a second test cannot start while one is active.
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setError(null);
    setHasRun(true);
    void (async () => {
      try {
        const response = await fetch(
          `/api/flows/${encodeURIComponent(flowId)}/test`,
          { method: "POST", cache: "no-store", signal: controller.signal },
        );
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(readErrorMessage(payload, response.status));
          return;
        }
        const collected: TestOutputEntry[] = [];
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const record = payload as Record<string, unknown>;
          for (const key of ["events", "errors"] as const) {
            const list = record[key];
            if (!Array.isArray(list)) continue;
            for (const item of list) {
              collected.push(
                toDisplayEntry(item, key === "errors" ? "error" : "event"),
              );
            }
          }
        }
        // Enforce the client-side bound even if the server sends more.
        const kept = collected.slice(0, MAX_TEST_EVENTS);
        setEntries(kept);
        setDroppedCount(collected.length - kept.length);
        if (collected.length === 0) {
          setError(null);
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error ? requestError.message : "Test request failed.",
        );
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setRunning(false);
      }
    })();
  }, [flowId, ruleTestSupported]);

  const shownCount = entries.length;
  const totalCount = shownCount + droppedCount;

  return (
    <div
      className={cn("flex min-h-0 flex-col gap-2", className)}
      data-testid="flow-test-panel"
      data-test-running={running ? "true" : "false"}
      data-test-supported={ruleTestSupported ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRun}
          disabled={!ruleTestSupported || running}
          data-testid="flow-test-run-button"
        >
          {running ? "Running…" : "Run Test"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={!running}
          data-testid="flow-test-cancel-button"
        >
          Cancel
        </Button>
        <span
          className="text-xs text-muted-foreground"
          data-testid="flow-test-summary"
        >
          {!ruleTestSupported
            ? "Rule test is not supported by this target."
            : running
              ? "Test running…"
              : hasRun
                ? `Showing ${shownCount} of ${totalCount} test output(s).`
                : "Not run yet."}
        </span>
      </div>

      {!ruleTestSupported ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="flow-test-unsupported"
        >
          The connected eKuiper target cannot run bounded trial tests from
          Flow Studio (rule-test transport unreachable under the current
          registered-node policy; see docs/FLOW_STUDIO_RULE_TEST_NOTES.md).
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
          data-testid="flow-test-error"
        >
          {error}
        </div>
      ) : null}

      {ruleTestSupported ? (
        entries.length === 0 ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid="flow-test-empty"
          >
            {hasRun && !running
              ? "Test completed with no output."
              : "Test output will appear here."}
          </p>
        ) : (
          <div
            className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30"
            data-testid="flow-test-scroll"
          >
            <ul className="flex flex-col gap-1.5 p-2">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.kind}-${index}`}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs",
                    entry.kind === "error"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-muted bg-background text-muted-foreground",
                  )}
                  data-testid="flow-test-entry"
                  data-entry-kind={entry.kind}
                  data-entry-truncated={entry.truncated ? "true" : "false"}
                >
                  <pre className="whitespace-pre-wrap break-words">
                    <code>{entry.text}</code>
                  </pre>
                  {entry.truncated ? (
                    <span
                      className="mt-0.5 block opacity-80"
                      data-testid="flow-test-entry-truncated"
                    >
                      Truncated: payload exceeds {MAX_EVENT_CHARS} characters.
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {droppedCount > 0 ? (
              <p
                className="px-2 pb-2 text-xs text-muted-foreground"
                data-testid="flow-test-dropped"
              >
                {droppedCount} additional output(s) omitted: panel holds at
                most {MAX_TEST_EVENTS} entries.
              </p>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
