'use client';

import * as React from 'react';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import { computeFlowDirtyState, type FlowDirtyBaseline } from '@/lib/flows/model/flow-dirty-state';

/**
 * Debounce between the last committed editor change and the draft PUT
 * (FS-0047). Committed changes already exclude high-frequency drag pointer
 * events: the canvas commits one layout move per drag stop (FS-0042), so
 * debouncing here only coalesces discrete store commits such as rapid
 * inspector edits.
 */
export const FLOW_AUTOSAVE_DEBOUNCE_MS = 750;

export type FlowAutosaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface FlowAutosaveSaved {
  spec: FlowSpec;
  layout: FlowLayout;
  semanticHash: string;
  layoutHash: string;
}

export interface FlowAutosaveBaselineHashes {
  semanticHash: string;
  layoutHash: string;
}

export interface UseFlowAutosaveOptions {
  flowId: string;
  spec: FlowSpec | null;
  layout: FlowLayout | null;
  /**
   * Canonical snapshots of the last server-persisted draft. A null baseline
   * means no draft has been loaded or saved yet, in which case the current
   * document is treated as needing its first save; FS-0046 owns the
   * null-baseline dirty convention and this hook owns the save decision.
   */
  baseline: FlowDirtyBaseline | null;
  /**
   * Server hashes of the baseline draft, used as the optimistic-concurrency
   * predicate for the next PUT. Null/undefined preserves unconditional
   * saves (e.g. first save with no baseline). After each successful save
   * the hook chains the server-returned hashes, so callers only need to
   * provide the initially loaded draft hashes.
   */
  baselineHashes?: FlowAutosaveBaselineHashes | null;
  /** While true no timer is scheduled and status stays idle. */
  disabled?: boolean;
  /** Override for tests; defaults to FLOW_AUTOSAVE_DEBOUNCE_MS. */
  debounceMs?: number;
  /**
   * Called with the successfully persisted payload plus the server-computed
   * hashes. The caller rebuilds its baseline via buildFlowDirtyBaseline so
   * dirty state clears without reloading the document.
   */
  onSaved?: (saved: FlowAutosaveSaved) => void;
}

export interface UseFlowAutosaveResult {
  status: FlowAutosaveStatus;
  /** Last save failure message, or null when the last attempt succeeded. */
  error: string | null;
}

export interface FlowAutosaveRequestError extends Error {
  status: number;
  code: string;
}

function readAutosaveFailure(response: Response, payload: unknown): FlowAutosaveRequestError {
  let message = `Request failed (${response.status})`;
  let code = 'REQUEST_FAILED';
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const nested = record['error'];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const nestedRecord = nested as Record<string, unknown>;
      if (typeof nestedRecord['message'] === 'string' && nestedRecord['message'].length > 0) {
        message = nestedRecord['message'];
      }
      if (typeof nestedRecord['code'] === 'string' && nestedRecord['code'].length > 0) {
        code = nestedRecord['code'];
      }
    }
  }
  const error = new Error(message) as FlowAutosaveRequestError;
  error.status = response.status;
  error.code = code;
  return error;
}

interface DraftSaveResponse {
  semanticHash: string;
  layoutHash: string;
}

function readDraftSaveResponse(payload: unknown): DraftSaveResponse | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const draft = (payload as Record<string, unknown>)['draft'];
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const record = draft as Record<string, unknown>;
  if (typeof record['semanticHash'] !== 'string') return null;
  if (typeof record['layoutHash'] !== 'string') return null;
  return {
    semanticHash: record['semanticHash'],
    layoutHash: record['layoutHash'],
  };
}

async function putFlowDraft(
  flowId: string,
  spec: FlowSpec,
  layout: FlowLayout,
  expectedHashes: FlowAutosaveBaselineHashes | null,
): Promise<FlowAutosaveSaved> {
  // Manager draft API only. Never an eKuiper URL: draft persistence must not
  // contact eKuiper (FS-0029 contract, re-asserted by FS-0047 acceptance).
  const body: Record<string, unknown> = { spec, layout };
  if (expectedHashes) {
    body['expectedSemanticHash'] = expectedHashes.semanticHash;
    body['expectedLayoutHash'] = expectedHashes.layoutHash;
  }
  const response = await fetch(`/api/flows/${encodeURIComponent(flowId)}/draft`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw readAutosaveFailure(response, payload);
  }
  const payload: unknown = await response.json().catch(() => null);
  const draft = readDraftSaveResponse(payload);
  if (!draft) {
    throw new Error('Invalid draft save response');
  }
  return { spec, layout, ...draft };
}

interface PendingSnapshot {
  spec: FlowSpec;
  layout: FlowLayout;
}

/**
 * Debounced draft autosave (FS-0047, R3 serialization).
 *
 * Saves are serialized per flow: while one PUT is in flight no second PUT
 * starts. A debounced edit that fires mid-flight is kept as the single
 * newest pending snapshot and sent when the in-flight save settles, so an
 * older request can never commit after (and overwrite) a newer one. Response
 * handling is flow-scoped: callbacks are ignored after unmount or a flow
 * switch. A 409 conflict surfaces as an error without touching the baseline,
 * so local edits are never discarded.
 */
export function useFlowAutosave(options: UseFlowAutosaveOptions): UseFlowAutosaveResult {
  const {
    flowId,
    spec,
    layout,
    baseline,
    baselineHashes = null,
    disabled = false,
    debounceMs = FLOW_AUTOSAVE_DEBOUNCE_MS,
    onSaved,
  } = options;

  const [phase, setPhase] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const onSavedRef = React.useRef(onSaved);
  onSavedRef.current = onSaved;

  // Exact payload of the last successful PUT. Prevents a save loop when the
  // caller does not advance its baseline (e.g. a test harness without
  // onSaved): identical object references are never re-sent.
  const sentRef = React.useRef<{ spec: FlowSpec; layout: FlowLayout } | null>(null);
  // True while one draft PUT is in flight for the current flow epoch.
  const inFlightRef = React.useRef(false);
  // Newest snapshot whose debounce fired while a save was in flight.
  // Only ever holds one entry: newer edits overwrite older ones.
  const pendingRef = React.useRef<PendingSnapshot | null>(null);
  // Predicate for the next PUT: initial baseline hashes, then chained from
  // each successful save response.
  const expectedHashesRef = React.useRef<FlowAutosaveBaselineHashes | null>(baselineHashes ?? null);
  // Flow-scoping: incremented on every flow switch so late responses from a
  // previous flow (or after unmount) are ignored.
  const epochRef = React.useRef(0);
  const flowIdRef = React.useRef(flowId);
  flowIdRef.current = flowId;
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset per-flow save state on flow switch. Late responses from the
  // previous flow are invalidated via the epoch bump; the previous PUT is
  // not aborted because its server write may already be committing.
  const baselineHashesRef = React.useRef(baselineHashes ?? null);
  baselineHashesRef.current = baselineHashes ?? null;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    epochRef.current += 1;
    pendingRef.current = null;
    sentRef.current = null;
    expectedHashesRef.current = baselineHashesRef.current;
    inFlightRef.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase('idle');
    setError(null);
    // Intentionally keyed only on flowId: baseline hash updates within one
    // flow are chained from save responses, not re-adopted from props, so a
    // successful save is never regressed to an older predicate.
  }, [flowId]);

  const ready = !disabled && spec !== null && layout !== null;
  const dirtyState =
    ready && spec !== null && layout !== null && baseline !== null
      ? computeFlowDirtyState(spec, layout, baseline)
      : null;
  // Null baseline means no draft has been loaded or saved yet, so the
  // current document needs its first save (FS-0046 leaves this decision to
  // the autosave ticket).
  const dirty =
    ready && (baseline === null || dirtyState?.semanticDirty === true || dirtyState?.layoutDirty === true);
  const alreadySent =
    sentRef.current !== null && spec === sentRef.current.spec && layout === sentRef.current.layout;
  const needsSave = ready && dirty && !alreadySent;

  const status: FlowAutosaveStatus =
    phase === 'idle' ? (needsSave ? 'pending' : 'idle') : phase;

  const startSave = React.useCallback(
    (snapshot: PendingSnapshot, snapshotFlowId: string, snapshotEpoch: number) => {
      inFlightRef.current = true;
      pendingRef.current = null;
      setPhase('saving');
      setError(null);
      // Resolve the predicate at send time so a queued snapshot always
      // predicates on the latest known server state, not on hashes that
      // were current when its debounce fired.
      const predicate = expectedHashesRef.current;
      void (async () => {
        try {
          const saved = await putFlowDraft(snapshotFlowId, snapshot.spec, snapshot.layout, predicate);
          if (!mountedRef.current) return;
          if (snapshotEpoch !== epochRef.current) return;
          if (flowIdRef.current !== snapshotFlowId) return;
          sentRef.current = { spec: snapshot.spec, layout: snapshot.layout };
          expectedHashesRef.current = {
            semanticHash: saved.semanticHash,
            layoutHash: saved.layoutHash,
          };
          onSavedRef.current?.(saved);
          if (!mountedRef.current) return;
          if (snapshotEpoch !== epochRef.current) return;
          if (flowIdRef.current !== snapshotFlowId) return;
          const next = pendingRef.current;
          if (next) {
            startSave(next, snapshotFlowId, snapshotEpoch);
            return;
          }
          inFlightRef.current = false;
          setPhase('idle');
        } catch (err) {
          if (!mountedRef.current) return;
          if (snapshotEpoch !== epochRef.current) return;
          if (flowIdRef.current !== snapshotFlowId) return;
          const next = pendingRef.current;
          if (next) {
            // Never drop the newest edits, even when the in-flight save
            // failed (including 409): chain the pending snapshot so it is
            // still sent, and surface the latest outcome below.
            startSave(next, snapshotFlowId, snapshotEpoch);
            return;
          }
          inFlightRef.current = false;
          setPhase('error');
          setError(err instanceof Error ? err.message : 'Failed to save draft');
        }
      })();
    },
    [],
  );

  React.useEffect(() => {
    if (!needsSave || spec === null || layout === null) return;
    const capturedSpec = spec;
    const capturedLayout = layout;
    const capturedFlowId = flowId;
    const capturedEpoch = epochRef.current;
    const delay = debounceMs;
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      timerRef.current = null;
      if (!mountedRef.current) return;
      if (capturedEpoch !== epochRef.current) return;
      if (flowIdRef.current !== capturedFlowId) return;
      if (inFlightRef.current) {
        // Serialize: keep only the newest pending snapshot; it is sent
        // when the in-flight save settles.
        pendingRef.current = { spec: capturedSpec, layout: capturedLayout };
        return;
      }
      startSave({ spec: capturedSpec, layout: capturedLayout }, capturedFlowId, capturedEpoch);
    }, delay);
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [needsSave, spec, layout, baseline, flowId, debounceMs, disabled, startSave]);

  return { status, error };
}
