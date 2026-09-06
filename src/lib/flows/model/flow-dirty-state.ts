import { canonicalJson } from '../hashing/canonical-json';
import type { FlowLayout, FlowSpec } from './flow-document';

/**
 * Last-known server draft snapshots (FS-0046).
 *
 * These are the canonical JSON strings for the most recently loaded or
 * saved draft's semantic spec and layout. They are built client-side from
 * the draft documents with the same pure serializer the dirty comparison
 * uses, so baseline construction and dirty comparison always agree.
 *
 * Deliberately browser-safe: no `node:crypto` import. Server-side `sha256`
 * hashing (`hashFlowSemantic` / `hashFlowLayout`) stays server-side only
 * and is never used for dirty-state comparison.
 */
export interface FlowDirtyBaseline {
  semanticSnapshot: string;
  layoutSnapshot: string;
}

/**
 * Independent dirty flags for the two snapshot domains.
 *
 * `semanticDirty` reflects behavior/configuration edits (spec nodes/edges);
 * `layoutDirty` reflects visual-only edits (node coordinates/viewport).
 * A layout-only move must set `layoutDirty` without setting
 * `semanticDirty`, per locked decision 27/28.
 */
export interface FlowDirtyState {
  semanticDirty: boolean;
  layoutDirty: boolean;
}

const CLEAN: FlowDirtyState = { semanticDirty: false, layoutDirty: false };

/**
 * Builds a dirty-state baseline from draft documents using the pure
 * canonical serializer, so baseline construction and dirty comparison
 * always agree without touching `node:crypto`.
 */
export function buildFlowDirtyBaseline(
  spec: FlowSpec,
  layout: FlowLayout,
): FlowDirtyBaseline {
  return {
    semanticSnapshot: canonicalJson(spec),
    layoutSnapshot: canonicalJson(layout),
  };
}

/**
 * Compares current canonical JSON snapshots against the last server draft
 * snapshots and returns each dirty flag independently.
 *
 * Comparison is canonical-string based, never object identity: cloned
 * documents with identical content are clean. A null/undefined baseline
 * (no saved draft loaded yet) or missing current documents means there
 * is nothing to compare, so both flags are false; the autosave ticket
 * owns the no-baseline save decision.
 */
export function computeFlowDirtyState(
  currentSpec: FlowSpec | null | undefined,
  currentLayout: FlowLayout | null | undefined,
  baseline: FlowDirtyBaseline | null | undefined,
): FlowDirtyState {
  if (!currentSpec || !currentLayout || !baseline) {
    return { ...CLEAN };
  }
  return {
    semanticDirty: canonicalJson(currentSpec) !== baseline.semanticSnapshot,
    layoutDirty: canonicalJson(currentLayout) !== baseline.layoutSnapshot,
  };
}
