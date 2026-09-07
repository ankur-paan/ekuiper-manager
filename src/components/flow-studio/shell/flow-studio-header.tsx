import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FlowStudioSaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export type FlowDeploymentStatus = 'deployed' | 'undeployed' | 'never-deployed';

export type FlowRuntimeHeaderState = 'running' | 'stopped' | 'error' | 'unknown';

export interface FlowStudioHeaderProps {
  flowName: string;
  saveState: string;
  saveStatus?: FlowStudioSaveStatus;
  targetName?: string;
  deployDisabled: boolean;
  onDeploy?: () => void;
  deploymentLabel?: string;
  deploymentStatus?: FlowDeploymentStatus;
  runtimeLabel?: string;
  runtimeState?: FlowRuntimeHeaderState;
  className?: string;
}

export function FlowStudioHeader({
  flowName,
  saveState,
  saveStatus,
  targetName,
  deployDisabled,
  onDeploy,
  deploymentLabel,
  deploymentStatus,
  runtimeLabel,
  runtimeState,
  className,
}: FlowStudioHeaderProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 items-center gap-3", className)}
      data-testid="flow-studio-header"
    >
      <div className="min-w-0 flex-1">
        <h1
          className="truncate text-sm font-semibold leading-tight"
          title={flowName}
        >
          {flowName}
        </h1>
        <p
          aria-live="polite"
          data-save-status={saveStatus}
          title={saveState}
          className={cn(
            'truncate text-xs',
            saveStatus === 'error' ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {saveState}
        </p>
          {deploymentLabel ? (
          <p
            aria-live="polite"
            data-testid="flow-deployment-status"
            data-deployment-status={deploymentStatus}
            title={deploymentLabel}
            className={cn(
              'truncate text-xs',
              deploymentStatus === 'deployed' && 'font-medium text-green-700',
              deploymentStatus === 'undeployed' && 'font-medium text-amber-700',
              deploymentStatus === 'never-deployed' && 'text-muted-foreground',
            )}
          >
            {deploymentLabel}
          </p>
        ) : null}
        {runtimeLabel ? (
          <p
            aria-live="polite"
            data-testid="flow-runtime-status"
            data-runtime-state={runtimeState}
            title={runtimeLabel}
            className={cn(
              'truncate text-xs',
              runtimeState === 'running' && 'font-medium text-green-700',
              runtimeState === 'error' && 'font-medium text-destructive',
              runtimeState === 'stopped' && 'font-medium text-amber-700',
              runtimeState === 'unknown' && 'text-muted-foreground',
            )}
          >
            {runtimeLabel}
          </p>
        ) : null}
      </div>

      {targetName ? (
        <span
          aria-label={`Deployment target ${targetName}`}
          className="hidden max-w-48 shrink-0 truncate text-xs text-muted-foreground sm:block"
          title={targetName}
        >
          {targetName}
        </span>
      ) : null}

      <Button
        type="button"
        aria-label="Deploy flow"
        disabled={deployDisabled}
        onClick={onDeploy}
        size="sm"
      >
        Deploy
      </Button>
    </div>
  );
}
