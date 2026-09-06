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

async function readAutosaveErrorMessage(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const nested = record['error'];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const message = (nested as Record<string, unknown>)['message'];
      if (typeof message === 'string' && message.length > 0) return message;
    }
  }
  return `Request failed (${response.status})`;
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
): Promise<FlowAutosaveSaved> {
  // Manager draft API only. Never an eKuiper URL: draft persistence must not
  // contact eKuiper (FS-0029 contract, re-asserted by FS-0047 acceptance).
  const response = await fetch(`/api/flows/${encodeURIComponent(flowId)}/draft`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ spec, layout }),
  });
  if (!response.ok) {
    throw new Error(await readAutosaveErrorMessage(response));
  }
  const payload: unknown = await response.json().catch(() => null);
  const draft = readDraftSaveResponse(payload);
  if (!draft) {
    throw new Error('Invalid draft save response');
  }
  return { spec, layout, ...draft };
}

/**
 * Debounced draft autosave (FS-0047).
 *
 * Schedules one PUT of {spec, layout} once the committed document stays
 * dirty for the debounce window. On success the caller advances its baseline
 * through onSaved; on failure the baseline is untouched so local dirty state
 * is preserved and the error is exposed via status/error.
 */
export function useFlowAutosave(options: UseFlowAutosaveOptions): UseFlowAutosaveResult {
  const { flowId, spec, layout, baseline, disabled = false, debounceMs = FLOW_AUTOSAVE_DEBOUNCE_MS, onSaved } = options;

  const [phase, setPhase] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const onSavedRef = React.useRef(onSaved);
  onSavedRef.current = onSaved;

  // Exact payload of the last successful PUT. Prevents a save loop when the
  // caller does not advance its baseline (e.g. a test harness without
  // onSaved): identical object references are never re-sent.
  const sentRef = React.useRef<{ spec: FlowSpec; layout: FlowLayout } | null>(null);
  // Monotonic save sequence so a superseded in-flight PUT cannot overwrite
  // the result of a newer one.
  const saveSeqRef = React.useRef(0);

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

  React.useEffect(() => {
    if (!needsSave || spec === null || layout === null) return;
    const capturedSpec = spec;
    const capturedLayout = layout;
    const capturedFlowId = flowId;
    const delay = debounceMs;
    saveSeqRef.current += 1;
    const seq = saveSeqRef.current;
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      void (async () => {
        setPhase('saving');
        setError(null);
        try {
          const saved = await putFlowDraft(capturedFlowId, capturedSpec, capturedLayout);
          if (saveSeqRef.current !== seq) return;
          sentRef.current = { spec: capturedSpec, layout: capturedLayout };
          onSavedRef.current?.(saved);
          if (saveSeqRef.current !== seq) return;
          setPhase('idle');
        } catch (err) {
          if (saveSeqRef.current !== seq) return;
          setPhase('error');
          setError(err instanceof Error ? err.message : 'Failed to save draft');
        }
      })();
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [needsSave, spec, layout, baseline, flowId, debounceMs, disabled]);

  return { status, error };
}
