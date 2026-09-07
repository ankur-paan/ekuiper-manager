'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import type { FlowSemanticChange } from '@/lib/flows/model/flow-diff';

/**
 * FS-0096: presentational semantic diff between two Flow specs/revisions.
 *
 * Pure view over `diffFlowSpecs` output: no fetching, no raw JSON dump.
 * Node display names come from the caller-supplied lookup so entries read
 * as human labels where possible, falling back to stable node ids.
 *
 * Large config values never render unbounded: values whose serialized form
 * exceeds `TRUNCATE_AT` characters render truncated inline with the full
 * value behind a native collapsible disclosure.
 */

export const REVISION_DIFF_TRUNCATE_AT = 120;

export type RevisionNodeNameLookup =
  | ReadonlyMap<string, string>
  | Record<string, string | undefined>;

export interface RevisionDiffProps {
  changes: readonly FlowSemanticChange[];
  nodeNames?: RevisionNodeNameLookup;
  className?: string;
}

function lookupNodeName(
  nodeId: string,
  nodeNames?: RevisionNodeNameLookup,
): string | undefined {
  if (!nodeNames) return undefined;
  const asMap = nodeNames as Partial<ReadonlyMap<string, string>>;
  if (typeof asMap.get === 'function') {
    return asMap.get.call(nodeNames, nodeId) ?? undefined;
  }
  const record = nodeNames as Record<string, string | undefined>;
  const value = record[nodeId];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function formatNodeLabel(
  nodeId: string,
  nodeNames?: RevisionNodeNameLookup,
): string {
  const name = lookupNodeName(nodeId, nodeNames);
  return name ? `${name} (${nodeId})` : nodeId;
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return '—';
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
}

function TruncatedValue({ value }: { value: unknown }) {
  const full = stringifyValue(value);
  if (full.length <= REVISION_DIFF_TRUNCATE_AT) {
    return (
      <code
        className="max-w-full break-all rounded bg-muted px-1 py-0.5 font-mono text-[11px]"
        title={full}
      >
        {full}
      </code>
    );
  }
  const truncated = `${full.slice(0, REVISION_DIFF_TRUNCATE_AT)}…`;
  return (
    <span className="inline max-w-full">
      <code
        className="max-w-full break-all rounded bg-muted px-1 py-0.5 font-mono text-[11px]"
        title={full}
      >
        {truncated}
      </code>{' '}
      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-muted-foreground">
          Show full value
        </summary>
        <pre className="mt-1 max-h-32 max-w-full overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[11px]">
          {full}
        </pre>
      </details>
    </span>
  );
}

function describeChange(
  change: FlowSemanticChange,
  nodeNames?: RevisionNodeNameLookup,
): React.ReactNode {
  switch (change.kind) {
    case 'node-added':
      return (
        <span>
          Added node{' '}
          <strong className="font-medium">
            {formatNodeLabel(change.nodeId, nodeNames)}
          </strong>
        </span>
      );
    case 'node-removed':
      return (
        <span>
          Removed node{' '}
          <strong className="font-medium">
            {formatNodeLabel(change.nodeId, nodeNames)}
          </strong>
        </span>
      );
    case 'node-renamed':
      return (
        <span>
          Renamed{' '}
          <strong className="font-medium">
            {formatNodeLabel(change.nodeId, nodeNames)}
          </strong>{' '}
          from <q>{change.before}</q> to <q>{change.after}</q>
        </span>
      );
    case 'node-type-changed':
      return (
        <span>
          Changed type of{' '}
          <strong className="font-medium">
            {formatNodeLabel(change.nodeId, nodeNames)}
          </strong>{' '}
          from{' '}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">
            {change.beforeType}@{change.beforeTypeVersion}
          </code>{' '}
          to{' '}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">
            {change.afterType}@{change.afterTypeVersion}
          </code>
        </span>
      );
    case 'node-config-changed':
      return (
        <span>
          Changed configuration of{' '}
          <strong className="font-medium">
            {formatNodeLabel(change.nodeId, nodeNames)}
          </strong>
        </span>
      );
    case 'options-changed':
      return <span>Changed flow rule options</span>;
    case 'edge-added':
      return (
        <span>
          Added connection{' '}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">
            {change.edgeId}
          </code>
        </span>
      );
    case 'edge-removed':
      return (
        <span>
          Removed connection{' '}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">
            {change.edgeId}
          </code>
        </span>
      );
    default:
      return null;
  }
}

export function RevisionDiff({
  changes,
  nodeNames,
  className,
}: RevisionDiffProps) {
  if (changes.length === 0) {
    return (
      <p
        className={cn('text-xs text-muted-foreground', className)}
        data-testid="revision-diff-empty"
      >
        No semantic changes — this revision differs by layout only and needs
        no deployment.
      </p>
    );
  }

  return (
    <ul
      aria-label="Semantic changes"
      className={cn('flex flex-col gap-2', className)}
      data-testid="revision-diff-list"
    >
      {changes.map((change, index) => {
        const key =
          change.kind === 'node-config-changed' ||
          change.kind === 'node-added' ||
          change.kind === 'node-removed' ||
          change.kind === 'node-renamed' ||
          change.kind === 'node-type-changed'
            ? `${change.kind}:${change.nodeId}`
            : change.kind === 'options-changed'
              ? `options-changed`
              : `${change.kind}:${change.kind === 'edge-added' || change.kind === 'edge-removed' ? change.edgeId : index}`;
        return (
          <li
            key={`${key}:${index}`}
            className="rounded-md border px-2.5 py-2 text-xs"
            data-testid="revision-diff-change"
            data-change-kind={change.kind}
          >
            <div>{describeChange(change, nodeNames)}</div>
            {change.kind === 'node-config-changed' ? (
              <ul
                className="mt-1.5 flex flex-col gap-1.5"
                aria-label={`Changed properties of ${formatNodeLabel(change.nodeId, nodeNames)}`}
              >
                {change.changes.map((property) => (
                  <li
                    key={property.path}
                    className="flex flex-col gap-1"
                    data-testid="revision-diff-property"
                  >
                    <code className="font-mono text-[11px] text-muted-foreground">
                      {property.path}
                    </code>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <TruncatedValue value={property.before} />
                      <span aria-hidden="true">→</span>
                      <TruncatedValue value={property.after} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {change.kind === 'options-changed' ? (
              <ul
                className="mt-1.5 flex flex-col gap-1.5"
                aria-label="Changed flow options"
              >
                {change.changes.map((property) => (
                  <li
                    key={property.path}
                    className="flex flex-col gap-1"
                    data-testid="revision-diff-property"
                  >
                    <code className="font-mono text-[11px] text-muted-foreground">
                      {property.path}
                    </code>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <TruncatedValue value={property.before} />
                      <span aria-hidden="true">→</span>
                      <TruncatedValue value={property.after} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
