"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FlowDiagnostic } from "@/lib/flows/model/diagnostic";

export interface FlowDeploySuccessSummary {
  deploymentId: string;
  ruleId: string;
  targetNodeId: string;
  semanticHash: string;
}

export interface FlowDeployDialogProps {
  open: boolean;
  flowId: string;
  flowName: string;
  targetName?: string;
  targetNodeId?: string | null;
  semanticHash?: string | null;
  semanticDirty: boolean;
  layoutDirty: boolean;
  onClose: () => void;
  onDeployed?: (summary: FlowDeploySuccessSummary) => void;
}

type ServerValidationPhase = "idle" | "loading" | "valid" | "invalid" | "error";

interface ServerValidationState {
  phase: ServerValidationPhase;
  diagnostics: FlowDiagnostic[];
  error: string | null;
}

type DeployPhase = "idle" | "deploying" | "succeeded" | "failed";

interface DeployRecordSummary {
  deploymentId: string;
  ruleId: string;
  targetNodeId: string;
  semanticHash: string;
}

interface DeployState {
  phase: DeployPhase;
  error: string | null;
  diagnostics: FlowDiagnostic[];
  stage: string | null;
  deployment: DeployRecordSummary | null;
}

const INITIAL_VALIDATION: ServerValidationState = {
  phase: "idle",
  diagnostics: [],
  error: null,
};

const INITIAL_DEPLOY: DeployState = {
  phase: "idle",
  error: null,
  diagnostics: [],
  stage: null,
  deployment: null,
};

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

function formatDiagnosticReference(diagnostic: FlowDiagnostic): string | null {
  const parts: string[] = [];
  if (diagnostic.nodeId) parts.push(`node ${diagnostic.nodeId}`);
  if (diagnostic.edgeId) parts.push(`edge ${diagnostic.edgeId}`);
  if (diagnostic.propertyPath) parts.push(diagnostic.propertyPath);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * FS-0089 deploy preflight dialog.
 *
 * - Shows the registered target name, the saved semantic hash, and the
 *   semantic/layout dirty status. Semantic and layout state stay separate:
 *   layout-only changes are labelled visual-only and never imply a runtime
 *   change.
 * - Runs authoritative server validation when opened; a validation failure
 *   blocks the confirm button.
 * - Confirm explicitly calls POST /api/flows/:id/deploy (no compiled JSON,
 *   no target URL; the server deploys the saved draft to the registered
 *   node). Double-submit is guarded by a ref plus a disabled confirm.
 * - Deploy failures stay visible in the dialog; the editor draft is never
 *   mutated here.
 */
export function FlowDeployDialog({
  open,
  flowId,
  flowName,
  targetName,
  targetNodeId,
  semanticHash,
  semanticDirty,
  layoutDirty,
  onClose,
  onDeployed,
}: FlowDeployDialogProps) {
  const [validation, setValidation] =
    React.useState<ServerValidationState>(INITIAL_VALIDATION);
  const [deploy, setDeploy] = React.useState<DeployState>(INITIAL_DEPLOY);

  // Guards the confirm against double-submit between click and state commit.
  const deployingRef = React.useRef(false);
  // Invalidates late validation/deploy responses after close or flow switch.
  const epochRef = React.useRef(0);
  const onDeployedRef = React.useRef(onDeployed);
  onDeployedRef.current = onDeployed;

  // Server validation runs on demand when the dialog opens, never on mount
  // while closed and never as a runtime mutation. Closing the dialog marks
  // in-flight responses stale so a late response cannot update a reopened
  // dialog for a different validation run.
  React.useEffect(() => {
    if (!open) return;
    epochRef.current += 1;
    const epoch = epochRef.current;
    deployingRef.current = false;
    setValidation({ phase: "loading", diagnostics: [], error: null });
    setDeploy({ ...INITIAL_DEPLOY });
    void (async () => {
      try {
        const response = await fetch(
          `/api/flows/${encodeURIComponent(flowId)}/validate`,
          { method: "POST", cache: "no-store" },
        );
        const payload: unknown = await response.json().catch(() => null);
        if (epoch !== epochRef.current) return;
        if (!response.ok) {
          setValidation({
            phase: "error",
            diagnostics: [],
            error: readErrorMessage(payload, response.status),
          });
          return;
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setValidation({
            phase: "error",
            diagnostics: [],
            error: "Unexpected validation response.",
          });
          return;
        }
        const record = payload as Record<string, unknown>;
        const valid = record["valid"];
        const diagnostics = record["diagnostics"];
        if (typeof valid !== "boolean" || !Array.isArray(diagnostics)) {
          setValidation({
            phase: "error",
            diagnostics: [],
            error: "Unexpected validation response.",
          });
          return;
        }
        setValidation({
          phase: valid ? "valid" : "invalid",
          diagnostics: diagnostics.filter(isFlowDiagnostic),
          error: null,
        });
      } catch (requestError) {
        if (epoch !== epochRef.current) return;
        setValidation({
          phase: "error",
          diagnostics: [],
          error:
            requestError instanceof Error
              ? requestError.message
              : "Validation request failed.",
        });
      }
    })();
    return () => {
      epochRef.current += 1;
      deployingRef.current = false;
    };
  }, [open, flowId]);

  const validationErrorCount = validation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  const handleDeploy = React.useCallback(() => {
    if (deployingRef.current) return;
    if (validation.phase !== "valid") return;
    if (deploy.phase === "deploying" || deploy.phase === "succeeded") return;
    deployingRef.current = true;
    const epoch = epochRef.current;
    setDeploy({
      phase: "deploying",
      error: null,
      diagnostics: [],
      stage: null,
      deployment: null,
    });
    void (async () => {
      try {
        // No request body: the server deploys the current saved draft to
        // the flow's registered target. No compiled JSON and no target URL
        // are ever sent from this dialog.
        const response = await fetch(
          `/api/flows/${encodeURIComponent(flowId)}/deploy`,
          { method: "POST", cache: "no-store" },
        );
        const payload: unknown = await response.json().catch(() => null);
        if (epoch !== epochRef.current) return;
        if (!response.ok) {
          setDeploy({
            phase: "failed",
            error: readErrorMessage(payload, response.status),
            diagnostics: [],
            stage: null,
            deployment: null,
          });
          return;
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setDeploy({
            phase: "failed",
            error: "Unexpected deploy response.",
            diagnostics: [],
            stage: null,
            deployment: null,
          });
          return;
        }
        const record = payload as Record<string, unknown>;
        if (record["ok"] === true) {
          const deploymentRecord = record["deployment"];
          const deploymentTarget = readStringField(record, "targetNodeId");
          if (
            !deploymentRecord ||
            typeof deploymentRecord !== "object" ||
            Array.isArray(deploymentRecord) ||
            !deploymentTarget
          ) {
            setDeploy({
              phase: "failed",
              error: "Unexpected deploy response.",
              diagnostics: [],
              stage: null,
              deployment: null,
            });
            return;
          }
          const deploymentFields = deploymentRecord as Record<string, unknown>;
          const deploymentId = readStringField(deploymentFields, "id");
          const ruleId = readStringField(deploymentFields, "ruleId");
          const deployedSemanticHash = readStringField(
            deploymentFields,
            "semanticHash",
          );
          if (!deploymentId || !ruleId || !deployedSemanticHash) {
            setDeploy({
              phase: "failed",
              error: "Unexpected deploy response.",
              diagnostics: [],
              stage: null,
              deployment: null,
            });
            return;
          }
          const summary: DeployRecordSummary = {
            deploymentId,
            ruleId,
            targetNodeId: deploymentTarget,
            semanticHash: deployedSemanticHash,
          };
          setDeploy({
            phase: "succeeded",
            error: null,
            diagnostics: [],
            stage: null,
            deployment: summary,
          });
          onDeployedRef.current?.(summary);
          return;
        }
        if (record["ok"] === false && record["valid"] === false) {
          const diagnostics = Array.isArray(record["diagnostics"])
            ? record["diagnostics"].filter(isFlowDiagnostic)
            : [];
          const stage = readStringField(record, "stage");
          setDeploy({
            phase: "failed",
            error: null,
            diagnostics,
            stage,
            deployment: null,
          });
          return;
        }
        setDeploy({
          phase: "failed",
          error: "Unexpected deploy response.",
          diagnostics: [],
          stage: null,
          deployment: null,
        });
      } catch (requestError) {
        if (epoch !== epochRef.current) return;
        setDeploy({
          phase: "failed",
          error:
            requestError instanceof Error
              ? requestError.message
              : "Deploy request failed.",
          diagnostics: [],
          stage: null,
          deployment: null,
        });
      } finally {
        if (epoch === epochRef.current) deployingRef.current = false;
      }
    })();
  }, [deploy.phase, flowId, validation.phase]);

  // Validation failure blocks confirm; a finished or in-flight deploy also
  // keeps the confirm disabled so the endpoint is called at most once per
  // validation run.
  const confirmDisabled =
    validation.phase !== "valid" ||
    deploy.phase === "deploying" ||
    deploy.phase === "succeeded";
  const deploying = deploy.phase === "deploying";

  const targetLabel = targetName ?? targetNodeId ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent data-testid="flow-deploy-dialog">
        <DialogHeader>
          <DialogTitle>Deploy flow</DialogTitle>
          <DialogDescription>
            Deploy the saved draft of &ldquo;{flowName}&rdquo; to its
            registered eKuiper target. The draft is left untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="font-medium text-muted-foreground">Target</dt>
            <dd data-testid="flow-deploy-target">
              {targetLabel ?? "No target configured"}
            </dd>
            <dt className="font-medium text-muted-foreground">Semantic hash</dt>
            <dd>
              {semanticHash ? (
                <code
                  data-testid="flow-deploy-semantic-hash"
                  title={semanticHash}
                >
                  {semanticHash.length > 12
                    ? `${semanticHash.slice(0, 12)}…`
                    : semanticHash}
                </code>
              ) : (
                <span data-testid="flow-deploy-semantic-hash">unknown</span>
              )}
            </dd>
            <dt className="font-medium text-muted-foreground">Semantic</dt>
            <dd data-testid="flow-deploy-semantic-status">
              {semanticDirty
                ? "Unsaved semantic changes"
                : "No unsaved semantic changes"}
            </dd>
            <dt className="font-medium text-muted-foreground">Layout</dt>
            <dd data-testid="flow-deploy-layout-status">
              {layoutDirty
                ? "Unsaved layout changes (visual only)"
                : "No unsaved layout changes"}
            </dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Layout-only changes never affect the deployed runtime.
          </p>

          <section aria-label="Server validation">
            <h4 className="mb-1.5 text-xs font-semibold">Server validation</h4>
            {validation.phase === "loading" || validation.phase === "idle" ? (
              <p
                className="text-xs text-muted-foreground"
                data-testid="flow-deploy-validation-loading"
              >
                Validating the saved draft…
              </p>
            ) : null}
            {validation.phase === "valid" ? (
              <p
                className="text-xs font-medium text-green-700"
                data-testid="flow-deploy-validation-summary"
              >
                Server: valid — the saved draft can be deployed.
              </p>
            ) : null}
            {validation.phase === "invalid" ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
                data-testid="flow-deploy-validation-summary"
              >
                Server: invalid — fix the{" "}
                {validationErrorCount} error(s) before deploying.
              </div>
            ) : null}
            {validation.phase === "error" ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
                data-testid="flow-deploy-validation-error"
              >
                {validation.error ?? "Validation request failed."}
              </div>
            ) : null}
            {validation.diagnostics.length > 0 ? (
              <ul className="mt-1.5 flex max-h-32 flex-col gap-1.5 overflow-y-auto">
                {validation.diagnostics.map((diagnostic) => {
                  const reference = formatDiagnosticReference(diagnostic);
                  return (
                    <li
                      key={`${diagnostic.code}|${diagnostic.nodeId ?? ""}|${diagnostic.edgeId ?? ""}|${diagnostic.propertyPath ?? ""}|${diagnostic.message}`}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs",
                        diagnostic.severity === "error"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-muted bg-muted/40 text-muted-foreground",
                      )}
                      data-testid="flow-deploy-validation-diagnostic"
                      data-severity={diagnostic.severity}
                      role={
                        diagnostic.severity === "error" ? "alert" : "status"
                      }
                    >
                      <span className="font-medium">{diagnostic.code}</span>
                      {": "}
                      {diagnostic.message}
                      {reference ? (
                        <span
                          className="mt-0.5 block truncate opacity-80"
                          title={reference}
                        >
                          {reference}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          {deploy.phase === "failed" ? (
            <section aria-label="Deploy result">
              <h4 className="mb-1.5 text-xs font-semibold">Deploy failed</h4>
              {deploy.error ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
                  data-testid="flow-deploy-error"
                >
                  {deploy.error}
                </div>
              ) : null}
              {!deploy.error && deploy.diagnostics.length === 0 ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
                  data-testid="flow-deploy-error"
                >
                  Deploy was rejected
                  {deploy.stage ? ` at stage ${deploy.stage}` : ""}. The draft
                  was left untouched.
                </div>
              ) : null}
              {deploy.diagnostics.length > 0 ? (
                <ul className="mt-1.5 flex max-h-32 flex-col gap-1.5 overflow-y-auto">
                  {deploy.diagnostics.map((diagnostic) => {
                    const reference = formatDiagnosticReference(diagnostic);
                    return (
                      <li
                        key={`${diagnostic.code}|${diagnostic.nodeId ?? ""}|${diagnostic.edgeId ?? ""}|${diagnostic.propertyPath ?? ""}|${diagnostic.message}`}
                        className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
                        data-testid="flow-deploy-diagnostic"
                        data-severity={diagnostic.severity}
                        role={
                          diagnostic.severity === "error" ? "alert" : "status"
                        }
                      >
                        <span className="font-medium">{diagnostic.code}</span>
                        {": "}
                        {diagnostic.message}
                        {reference ? (
                          <span
                            className="mt-0.5 block truncate opacity-80"
                            title={reference}
                          >
                            {reference}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          ) : null}

          {deploy.phase === "succeeded" && deploy.deployment ? (
            <div
              role="status"
              className="rounded-md border border-green-700/30 bg-green-700/10 px-2.5 py-1.5 text-xs text-green-700"
              data-testid="flow-deploy-success"
            >
              Deployed rule {deploy.deployment.ruleId} to{" "}
              {deploy.deployment.targetNodeId}.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="flow-deploy-cancel"
          >
            {deploy.phase === "succeeded" ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={handleDeploy}
            disabled={confirmDisabled}
            data-testid="flow-deploy-confirm"
          >
            {deploying ? "Deploying…" : "Deploy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
