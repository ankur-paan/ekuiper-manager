'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { diffFlowSpecs } from '@/lib/flows/model/flow-diff';
import type { FlowSpec } from '@/lib/flows/model/flow-document';
import { RevisionDiff } from './revision-diff';

/**
 * FS-0096: revision history + semantic diff panel.
 *
 * Read-only view over `GET /api/flows/:id/revisions` (FS-0094) plus one
 * snapshot fetch per compared side. The caller picks base (a revision) and
 * target (a revision or the current draft spec); the semantic diff comes
 * from the single `diffFlowSpecs` pipeline (FS-0095), so layout-only
 * revisions render as an empty semantic diff. Raw JSON diff is out of
 * scope. No restore/deploy actions here (FS-0097/FS-0098 own those).
 */

interface RevisionListEntry {
  revisionNumber: number;
  semanticHash: string;
  layoutHash: string;
  createdAt: string;
  message: string | null;
}

interface RevisionSnapshot {
  revisionNumber: number;
  semanticDocument: FlowSpec;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFlowSpec(value: unknown): value is FlowSpec {
  if (!isRecord(value)) return false;
  return Array.isArray(value['nodes']) && Array.isArray(value['edges']);
}

function readRevisionList(payload: unknown): RevisionListEntry[] {
  if (!isRecord(payload)) throw new Error('Unexpected revision response.');
  const revisions: unknown = payload['revisions'];
  if (!Array.isArray(revisions)) throw new Error('Unexpected revision response.');
  return revisions.map((entry) => {
    if (!isRecord(entry)) throw new Error('Unexpected revision response.');
    const revisionNumber = entry['revisionNumber'];
    if (typeof revisionNumber !== 'number') {
      throw new Error('Unexpected revision response.');
    }
    const createdAt = entry['createdAt'];
    return {
      revisionNumber,
      semanticHash:
        typeof entry['semanticHash'] === 'string' ? entry['semanticHash'] : '',
      layoutHash:
        typeof entry['layoutHash'] === 'string' ? entry['layoutHash'] : '',
      createdAt: typeof createdAt === 'string' ? createdAt : '',
      message:
        entry['message'] === null ||
        entry['message'] === undefined
          ? null
          : typeof entry['message'] === 'string'
            ? entry['message']
            : null,
    };
  });
}

function readRevisionSnapshot(payload: unknown): RevisionSnapshot {
  if (!isRecord(payload)) throw new Error('Unexpected revision response.');
  const revision: unknown = payload['revision'];
  if (!isRecord(revision)) throw new Error('Unexpected revision response.');
  const revisionNumber = revision['revisionNumber'];
  if (typeof revisionNumber !== 'number') {
    throw new Error('Unexpected revision response.');
  }
  const semanticDocument: unknown = revision['semanticDocument'];
  if (!isFlowSpec(semanticDocument)) {
    throw new Error('Unexpected revision response.');
  }
  return { revisionNumber, semanticDocument };
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

async function fetchRevisionList(flowId: string): Promise<RevisionListEntry[]> {
  const response = await fetch(
    `/api/flows/${encodeURIComponent(flowId)}/revisions`,
    { cache: 'no-store' },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readErrorMessage(payload, response.status));
  return readRevisionList(payload);
}

async function fetchRevisionSnapshot(
  flowId: string,
  revisionNumber: number,
): Promise<RevisionSnapshot> {
  const response = await fetch(
    `/api/flows/${encodeURIComponent(flowId)}/revisions/${encodeURIComponent(String(revisionNumber))}`,
    { cache: 'no-store' },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readErrorMessage(payload, response.status));
  return readRevisionSnapshot(payload);
}

function formatRevisionLabel(entry: RevisionListEntry): string {
  const date = entry.createdAt ? entry.createdAt : 'unknown time';
  const suffix = entry.message ? ` — ${entry.message}` : '';
  return `Revision ${entry.revisionNumber} (${date})${suffix}`;
}

export interface RevisionHistoryProps {
  flowId: string;
  /** Current editor draft spec; enables the "Current draft" compare target. */
  currentSpec: FlowSpec | null;
  className?: string;
}

export function RevisionHistory({
  flowId,
  currentSpec,
  className,
}: RevisionHistoryProps) {
  const [entries, setEntries] = React.useState<RevisionListEntry[] | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);
  const [listLoading, setListLoading] = React.useState(true);

  const [baseNumber, setBaseNumber] = React.useState<number | null>(null);
  const [target, setTarget] = React.useState<number | 'draft'>('draft');

  const [baseSnapshot, setBaseSnapshot] = React.useState<RevisionSnapshot | null>(null);
  const [targetSnapshot, setTargetSnapshot] =
    React.useState<RevisionSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = React.useState<string | null>(null);
  const [snapshotsLoading, setSnapshotsLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setListError(null);
    setListLoading(true);
    setBaseNumber(null);
    setBaseSnapshot(null);
    setTargetSnapshot(null);
    setSnapshotError(null);
    setTarget('draft');
    void fetchRevisionList(flowId)
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        // Default base to the newest revision so a diff against the
        // current draft renders immediately once snapshots load.
        setBaseNumber(rows.length > 0 ? rows[0].revisionNumber : null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListError(
          error instanceof Error ? error.message : 'Failed to load revisions',
        );
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  // Load the snapshot documents for the selected base/target pair.
  // The 'draft' target needs no fetch: it diffs against currentSpec.
  React.useEffect(() => {
    if (baseNumber === null) return;
    if (target === 'draft' && !currentSpec) {
      setBaseSnapshot(null);
      setTargetSnapshot(null);
      return;
    }
    let cancelled = false;
    setSnapshotsLoading(true);
    setSnapshotError(null);
    const wanted: Array<Promise<RevisionSnapshot | null>> = [
      fetchRevisionSnapshot(flowId, baseNumber),
      typeof target === 'number'
        ? fetchRevisionSnapshot(flowId, target)
        : Promise.resolve(null),
    ];
    void Promise.all(wanted)
      .then(([base, other]) => {
        if (cancelled) return;
        setBaseSnapshot(base);
        setTargetSnapshot(other);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBaseSnapshot(null);
        setTargetSnapshot(null);
        setSnapshotError(
          error instanceof Error ? error.message : 'Failed to load revision',
        );
      })
      .finally(() => {
        if (!cancelled) setSnapshotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [flowId, baseNumber, target, currentSpec === null]);

  const diff = React.useMemo(() => {
    if (baseNumber === null || !baseSnapshot) return null;
    const before = baseSnapshot.semanticDocument;
    if (typeof target === 'number') {
      if (!targetSnapshot) return null;
      return diffFlowSpecs(before, targetSnapshot.semanticDocument);
    }
    if (!currentSpec) return null;
    return diffFlowSpecs(before, currentSpec);
  }, [baseNumber, baseSnapshot, target, targetSnapshot, currentSpec]);

  // Human node-name lookup merged from every loaded spec so diff entries
  // prefer display names over bare ids wherever a name is known.
  const nodeNames = React.useMemo(() => {
    const names = new Map<string, string>();
    const collect = (spec: FlowSpec | null | undefined) => {
      if (!spec) return;
      for (const node of spec.nodes) {
        if (!names.has(node.id) && node.name.length > 0) {
          names.set(node.id, node.name);
        }
      }
    };
    collect(baseSnapshot?.semanticDocument);
    collect(targetSnapshot?.semanticDocument);
    collect(currentSpec);
    return names;
  }, [baseSnapshot, targetSnapshot, currentSpec]);

  const handleRetry = React.useCallback(() => {
    setListLoading(true);
    setListError(null);
    void fetchRevisionList(flowId)
      .then((rows) => {
        setEntries(rows);
        setBaseNumber(rows.length > 0 ? rows[0].revisionNumber : null);
      })
      .catch((error: unknown) => {
        setListError(
          error instanceof Error ? error.message : 'Failed to load revisions',
        );
      })
      .finally(() => {
        setListLoading(false);
      });
  }, [flowId]);

  let body: React.ReactNode;
  if (listLoading) {
    body = (
      <p
        className="text-xs text-muted-foreground"
        data-testid="revision-history-loading"
      >
        Loading revisions…
      </p>
    );
  } else if (listError) {
    body = (
      <div className="flex flex-col gap-2">
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
          data-testid="revision-history-error"
        >
          {listError}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
          Retry
        </Button>
      </div>
    );
  } else if (!entries || entries.length === 0) {
    body = (
      <p
        className="text-xs text-muted-foreground"
        data-testid="revision-history-empty"
      >
        No revisions yet. Revisions are created automatically on successful
        deployment.
      </p>
    );
  } else {
    const targetLabel =
      target === 'draft'
        ? 'Current draft'
        : `Revision ${target}`;
    const baseLabel =
      baseNumber === null ? 'Select a revision' : `Revision ${baseNumber}`;
    body = (
      <div className="flex flex-col gap-3">
        <ol
          aria-label="Revisions"
          className="flex max-h-44 flex-col gap-1 overflow-y-auto"
          data-testid="revision-history-list"
        >
          {entries.map((entry) => {
            const selected = entry.revisionNumber === baseNumber;
            return (
              <li key={entry.revisionNumber}>
                <button
                  type="button"
                  onClick={() => setBaseNumber(entry.revisionNumber)}
                  aria-pressed={selected}
                  data-testid={`revision-history-item-${entry.revisionNumber}`}
                  data-selected={selected ? 'true' : 'false'}
                  className={cn(
                    'w-full truncate rounded-md border px-2.5 py-1.5 text-left text-xs',
                    selected
                      ? 'border-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  title={formatRevisionLabel(entry)}
                >
                  {formatRevisionLabel(entry)}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Compare from</span>
            <select
              aria-label="Compare from revision"
              data-testid="revision-history-base"
              value={baseNumber ?? ''}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next > 0) setBaseNumber(next);
              }}
              className="rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              {entries.map((entry) => (
                <option
                  key={entry.revisionNumber}
                  value={entry.revisionNumber}
                >
                  Revision {entry.revisionNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Compare to</span>
            <select
              aria-label="Compare to revision or draft"
              data-testid="revision-history-target"
              value={target === 'draft' ? 'draft' : String(target)}
              onChange={(event) => {
                if (event.target.value === 'draft') {
                  setTarget('draft');
                  return;
                }
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next > 0) setTarget(next);
              }}
              className="rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              <option value="draft" disabled={!currentSpec}>
                Current draft
              </option>
              {entries.map((entry) => (
                <option
                  key={entry.revisionNumber}
                  value={entry.revisionNumber}
                >
                  Revision {entry.revisionNumber}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          aria-live="polite"
          data-testid="revision-history-diff-status"
          className="text-xs text-muted-foreground"
        >
          {snapshotsLoading
            ? 'Loading snapshots…'
            : snapshotError
              ? `Could not load snapshots: ${snapshotError}`
              : diff !== null
                ? `Showing semantic changes from ${baseLabel} to ${targetLabel}.`
                : target === 'draft' && !currentSpec
                  ? 'Current draft is not loaded yet.'
                  : 'Select revisions to compare.'}
        </div>
        {snapshotError ? null : diff !== null ? (
          <RevisionDiff changes={diff} nodeNames={nodeNames} />
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-label="Revision history"
      className={cn('flex flex-col gap-2', className)}
      data-testid="revision-history"
    >
      <h3 className="text-xs font-semibold">History</h3>
      {body}
    </section>
  );
}
