'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * FS-0100: node-neutral runtime status panel.
 *
 * Read-only view over `GET /api/flows/:id/runtime` (FS-0099). This module
 * owns the client-side fetch helper plus presentational rendering; polling
 * policy lives with the caller (`flow-studio-page.tsx`) so there is exactly
 * one 5s status poll per flow. Nothing here mutates draft, deployment, or
 * editor state, and no Start/Stop controls are offered in this ticket.
 */

export type FlowRuntimeActualState = 'running' | 'stopped' | 'error' | 'unknown';

export type FlowRuntimeDesiredState = 'running' | 'stopped' | 'unknown';

export interface FlowRuntimeSnapshot {
  flowId: string;
  targetNodeId: string | null;
  ruleId: string | null;
  deploymentId: string | null;
  deployed: boolean;
  desiredState: FlowRuntimeDesiredState;
  actualState: FlowRuntimeActualState;
  /** Safe, bounded summary from the server; null when nothing to report. */
  message: string | null;
  checkedAt: string | null;
}

const ACTUAL_STATES: ReadonlySet<string> = new Set([
  'running',
  'stopped',
  'error',
  'unknown',
]);

const DESIRED_STATES: ReadonlySet<string> = new Set(['running', 'stopped', 'unknown']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

/**
 * Narrow an unknown `GET /runtime` payload to a snapshot. Unknown shapes
 * throw so the caller surfaces a fetch error instead of rendering guesses.
 */
export function parseFlowRuntimeSnapshot(payload: unknown): FlowRuntimeSnapshot {
  if (!isRecord(payload)) throw new Error('Unexpected runtime response.');
  const runtime: unknown = payload['runtime'];
  if (!isRecord(runtime)) throw new Error('Unexpected runtime response.');
  const actualState = readString(runtime, 'actualState');
  if (!actualState || !ACTUAL_STATES.has(actualState)) {
    throw new Error('Unexpected runtime response.');
  }
  const desiredState = readString(runtime, 'desiredState');
  const deployed = runtime['deployed'];
  if (typeof deployed !== 'boolean') throw new Error('Unexpected runtime response.');
  const message = readNullableString(runtime, 'message');
  return {
    flowId: readString(runtime, 'flowId') ?? '',
    targetNodeId: readNullableString(runtime, 'targetNodeId'),
    ruleId: readNullableString(runtime, 'ruleId'),
    deploymentId: readNullableString(runtime, 'deploymentId'),
    deployed,
    desiredState:
      desiredState && DESIRED_STATES.has(desiredState)
        ? (desiredState as FlowRuntimeDesiredState)
        : 'unknown',
    actualState: actualState as FlowRuntimeActualState,
    message,
    checkedAt: readNullableString(runtime, 'checkedAt'),
  };
}

function readErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    const nested: unknown = payload['error'];
    if (isRecord(nested)) {
      const message = nested['message'];
      if (typeof message === 'string' && message.length > 0) return message;
    }
  }
  return `Request failed (${status})`;
}

export async function fetchFlowRuntime(flowId: string): Promise<FlowRuntimeSnapshot> {
  const response = await fetch(`/api/flows/${encodeURIComponent(flowId)}/runtime`, {
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readErrorMessage(payload, response.status));
  return parseFlowRuntimeSnapshot(payload);
}

/**
 * Header/panel label for a runtime snapshot. Distinct from the Saved /
 * Deployed draft labels: it describes live eKuiper state, not edit state.
 */
export function resolveRuntimeLabel(snapshot: FlowRuntimeSnapshot | null): string {
  if (!snapshot || !snapshot.deployed) return 'Runtime: not deployed';
  switch (snapshot.actualState) {
    case 'running':
      return 'Runtime: running';
    case 'stopped':
      return 'Runtime: stopped';
    case 'error':
      return 'Runtime: error';
    case 'unknown':
    default:
      return 'Runtime: unknown';
  }
}

export interface RuntimePanelProps {
  /** Null while the flow has no successful deployment or before first read. */
  runtime: FlowRuntimeSnapshot | null;
  hasDeployment: boolean;
  isLoading: boolean;
  isError: boolean;
  className?: string;
}

export function RuntimePanel({
  runtime,
  hasDeployment,
  isLoading,
  isError,
  className,
}: RuntimePanelProps) {
  const label = resolveRuntimeLabel(runtime);
  const state: FlowRuntimeActualState = runtime?.actualState ?? 'unknown';

  let detail: React.ReactNode;
  if (!hasDeployment) {
    detail = (
      <p className="text-xs text-muted-foreground" data-testid="flow-runtime-panel-empty">
        Deploy the flow to see live runtime status.
      </p>
    );
  } else if (isLoading && !runtime) {
    detail = (
      <p className="text-xs text-muted-foreground" data-testid="flow-runtime-panel-loading">
        Checking runtime…
      </p>
    );
  } else if (isError && !runtime) {
    detail = (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
        data-testid="flow-runtime-panel-error"
      >
        Runtime status could not be read.
      </div>
    );
  } else if (runtime) {
    detail = (
      <div className="flex flex-col gap-1.5">
        {runtime.message ? (
          <p
            className="truncate text-xs text-muted-foreground"
            title={runtime.message}
            data-testid="flow-runtime-panel-message"
          >
            {runtime.message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="flow-runtime-panel-message-empty">
            No runtime message.
          </p>
        )}
        {isError ? (
          <p className="text-xs text-muted-foreground" data-testid="flow-runtime-panel-stale">
            Showing last known status; latest refresh failed.
          </p>
        ) : null}
      </div>
    );
  } else {
    detail = (
      <p className="text-xs text-muted-foreground" data-testid="flow-runtime-panel-empty">
        Deploy the flow to see live runtime status.
      </p>
    );
  }

  return (
    <section
      aria-label="Flow runtime status"
      className={cn('border-b px-3 py-2.5', className)}
      data-testid="flow-runtime-panel"
      data-runtime-state={state}
    >
      <h3 className="text-xs font-semibold">Runtime</h3>
      <p
        aria-live="polite"
        data-testid="flow-runtime-panel-state"
        data-runtime-state={state}
        title={label}
        className={cn(
          'mt-1 truncate text-xs',
          state === 'running' && 'font-medium text-green-700',
          state === 'error' && 'font-medium text-destructive',
          state === 'stopped' && 'font-medium text-amber-700',
          state === 'unknown' && 'text-muted-foreground',
        )}
      >
        {label}
      </p>
      <div className="mt-1.5">{detail}</div>
    </section>
  );
}
