/**
 * Audited eKuiper Graph Rule TypeScript shape (FS-0073).
 *
 * Source of truth: `public/ekuiper-openapi.json` (LF Edge eKuiper REST
 * Management API, version 2.4.1), schemas:
 * - `components.schemas.RuleGraph`: required `nodes` + `topo`; each node
 *   entry requires `type`, `nodeType`, `props`, `ui`.
 * - `components.schemas.RuleTopology`: required `sources: string[]` and
 *   `edges` (object whose values are arrays).
 * - `components.schemas.Rule`: `oneOf` requires either `sql` + `actions`
 *   or `graph`, so a graph rule carries its definition under `graph`.
 *
 * Scope discipline for this ticket:
 * - Only the graph-rule subset proven above is codified: node map entries
 *   (`type` / `nodeType` / `props`), topology (`sources` / `edges`), and the
 *   `nodes` + `topo` envelope. Engine node catalog semantics (which
 *   `nodeType` string means "memory source", exact operator `props`, ...)
 *   are NOT asserted here; FS-0074 confirms those before compiling.
 * - `ui` is eKuiper's own editor-metadata field, not Flow layout. The
 *   compiler must never copy Flow layout/display state into it, so it stays
 *   optional here even though the audited schema lists it as required: an
 *   absent `ui` carries no display state, and a present one is validated as
 *   an opaque record. No Flow-specific display field (layout, x/y,
 *   viewport, selection, metrics) exists in these types.
 * - `edges` values are typed `string[]` (node name -> downstream node
 *   names): the audited schema declares array values alongside
 *   `sources: string[]`, and runtime status/topology mapping in this
 *   repository (`RuleTopology.edges: Record<string, string[]>`) agrees.
 */

export interface EkuiperGraphNode {
  type: string;
  nodeType: string;
  props: Record<string, unknown>;
  ui?: Record<string, unknown>;
}

export interface EkuiperGraphTopo {
  sources: string[];
  edges: Record<string, string[]>;
}

export interface EkuiperGraphRule {
  nodes: Record<string, EkuiperGraphNode>;
  topo: EkuiperGraphTopo;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string')
  );
}

/**
 * Runtime shape check for one audited graph node entry.
 * Narrows from `unknown`; never throws.
 */
export function isEkuiperGraphNode(value: unknown): value is EkuiperGraphNode {
  if (!isRecord(value)) return false;
  if (typeof value.type !== 'string') return false;
  if (typeof value.nodeType !== 'string') return false;
  if (!isRecord(value.props)) return false;
  if (value.ui !== undefined && !isRecord(value.ui)) return false;
  return true;
}

/**
 * Runtime shape check for the audited topology envelope.
 * Narrows from `unknown`; never throws.
 */
export function isEkuiperGraphTopo(value: unknown): value is EkuiperGraphTopo {
  if (!isRecord(value)) return false;
  if (!isStringArray(value.sources)) return false;
  if (!isRecord(value.edges)) return false;
  return Object.values(value.edges).every(isStringArray);
}

/**
 * Runtime shape check for the audited graph rule envelope.
 * Narrows from `unknown`; never throws.
 */
export function isEkuiperGraphRule(value: unknown): value is EkuiperGraphRule {
  if (!isRecord(value)) return false;
  if (!isRecord(value.nodes)) return false;
  if (!Object.values(value.nodes).every(isEkuiperGraphNode)) return false;
  return isEkuiperGraphTopo(value.topo);
}
