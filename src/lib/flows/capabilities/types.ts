/**
 * Normalized eKuiper target capability profile (FS-0079).
 *
 * Single normalization point for "what can this eKuiper target execute".
 * UI and compiler consume this profile; they must not scatter eKuiper
 * version comparisons (see `resolve-capabilities.ts`, the only module that
 * may compare versions).
 *
 * Audited baseline sources:
 * - Graph-rule envelope (`nodes`/`topo`, node `type`/`nodeType`/`props`) is
 *   proven by `public/ekuiper-openapi.json` (eKuiper 2.4.1) schema
 *   `RuleGraph`; target version comes from `SystemInfo.version` (audited
 *   example `"2.4.1"`).
 * - Source/sink/operator metadata endpoints (`/metadata/sources`,
 *   `/metadata/sinks`, `/metadata/operators`) are proven by the same
 *   audited OpenAPI paths.
 * - Identifier values below mirror the exact eKuiper `nodeType` strings the
 *   compiler emits in `src/lib/flows/compiler/ekuiper/compile-graph.ts`
 *   (memory/mqtt sources and sinks, rest/log sinks, filter/pick/window/
 *   aggfunc/groupby/switch/orderby/join operators). The `func` script Flow
 *   type has no confirmed graph mapping (FS-0078) and is intentionally
 *   absent here.
 */

/** Minimum eKuiper version that proves the audited graph-rule baseline. */
export const BASELINE_EKUIPER_VERSION = '2.4.1' as const;

/** eKuiper source `nodeType` names in the audited v1 baseline. */
export const BASELINE_CAPABILITY_SOURCES = Object.freeze([
  'memory',
  'mqtt',
] as const);

/** eKuiper operator `nodeType` names in the audited v1 baseline. */
export const BASELINE_CAPABILITY_OPERATORS = Object.freeze([
  'aggfunc',
  'filter',
  'groupby',
  'join',
  'orderby',
  'pick',
  'switch',
  'window',
] as const);

/** eKuiper sink `nodeType` names in the audited v1 baseline. */
export const BASELINE_CAPABILITY_SINKS = Object.freeze([
  'log',
  'memory',
  'mqtt',
  'rest',
] as const);

/**
 * Normalized set of runtime features supported by one eKuiper target.
 *
 * - `ekuiperVersion`: raw version string reported by the target
 *   (`SystemInfo.version`), or `null` when unknown/unreachable.
 * - `reachable`: whether the target answered a probe at all.
 * - `graphRules`: whether Flow Studio may compile graph rules for this
 *   target in this profile.
 * - `sources`/`operators`/`sinks`: eKuiper `nodeType` identifiers the
 *   target is known to support. Sorted ascending for determinism.
 *   Empty means "no proven support" (conservative), never "everything".
 */
export interface TargetCapabilityProfile {
  ekuiperVersion: string | null;
  reachable: boolean;
  graphRules: boolean;
  sources: readonly string[];
  operators: readonly string[];
  sinks: readonly string[];
}
