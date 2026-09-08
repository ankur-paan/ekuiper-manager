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
  // The `func` node compiles to this operator (compile-graph.ts FUNCTION_OPERATION).
  // Omitting it made every flow containing a `func` node undeployable on every target
  // with FLOW_CAPABILITY_UNAVAILABLE. eKuiper 2.4.1 reports `function` in
  // GET /metadata/operators, and POST /rules/validate parses the operator (rejecting
  // only a non-call expression), so the capability is real.
  'function',
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
 * - `ruleTest`/`ruleTestSse`: whether Flow Studio may use the eKuiper
 *   rule-test trial-run transport on this target (FS-0106). Optional so
 *   pre-FS-0106 profile literals still type-check; absent means
 *   "unproven", never "supported". The audited eKuiper 2.4.1 contract
 *   (`POST /ruletest`, `POST /ruletest/{name}/start`,
 *   `DELETE /ruletest/{name}` plus `GET /test/{id}` SSE on a separate
 *   per-test port, see `docs/FLOW_STUDIO_RULE_TEST_NOTES.md`) cannot be
 *   reached safely under the current registered-node policy, so the
 *   resolver reports both as `false` on every profile until a later
 *   ticket proves a safe SSE relay and graph-rule test envelope.
 */
export interface TargetCapabilityProfile {
  ekuiperVersion: string | null;
  reachable: boolean;
  graphRules: boolean;
  sources: readonly string[];
  operators: readonly string[];
  sinks: readonly string[];
  ruleTest?: boolean;
  ruleTestSse?: boolean;
}
