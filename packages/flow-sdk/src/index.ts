/**
 * Public-safe declarative Flow node definition subset (FS-0119, FS-0120).
 *
 * This module is the canonical source for the data shapes an extension
 * author needs to write a declarative node descriptor (identity, display
 * metadata, category, ports, properties, canvas tokens, and the declarative
 * eKuiper runtime mapping). The Manager app re-exports these names from
 * `src/lib/flows/registry/node-definition.ts`, so there is exactly one
 * `FlowNodeDefinition` contract and no divergent duplicate.
 *
 * Types and data constants only: no validation, no compiler, no editor
 * implementation, no React, no filesystem access, no network access, and no
 * validation CLI. A `validate` command for extension packages is a future
 * roadmap idea only (see `packages/flow-sdk/README.md` and
 * `docs/FLOW_EXTENSIONS.md`); it is not implemented and must not be treated
 * as available. The internal-only app fields (`runtimeKind`/`operation`)
 * live on the app's extended `FlowNodeDefinition` and are intentionally
 * absent here.
 *
 * Author guide: `docs/FLOW_EXTENSIONS.md`. Package overview:
 * `packages/flow-sdk/README.md`.
 *
 * This package is not published (FS-0119); it is consumed via npm
 * workspaces by the Manager app in this repository.
 */

export type FlowNodeCategory =
  | 'source'
  | 'transform'
  | 'streaming'
  | 'routing'
  | 'sink';

export type FlowPortKind = 'stream' | 'collection' | 'table' | 'any';

export type FlowIrNodeKind = 'source' | 'operator' | 'sink';

export interface FlowPortDefinition {
  id: string;
  label?: string;
  kind: FlowPortKind;
  required?: boolean;
  multiple?: boolean;
}

export interface FlowPropertyDefinition {
  key: string;
  label: string;
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'json'
    | 'expression'
    | 'secret-ref';
  required?: boolean;
  description?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
  defaultValue?: unknown;
  /**
   * Optional dynamic option provider for `select` properties (FS-0147).
   *
   * A NAMED provider id resolved server-side against a fixed allowlist
   * (`FLOW_OPTION_PROVIDER_IDS`); never a URL and never caller-supplied.
   * The inspector merges the provider's live names/ids with the static
   * `options` above. Plain string so definitions stay JSON-serialisable.
   */
  optionsProvider?: string;
  /**
   * Optional display/range hints for the property control (FS-0146).
   *
   * Declarative only: plain JSON data, never a function or expression.
   * `multiline`, `password` and `placeholder` are display-only. `min`,
   * `max` and `step` are honoured by number controls; `min`/`max` are
   * additionally enforced by range validation. `password` masks the
   * input only and never changes storage semantics; secrets remain a
   * separate concern (`secret-ref` type).
   */
  typeOptions?: FlowPropertyTypeOptions;
  /**
   * Optional conditional visibility predicate over sibling property values
   * (FS-0145).
   *
   * Declarative only: plain JSON data (equality / one-of), never a
   * function or expression, so definitions stay JSON-serialisable for
   * future declarative extensions. When absent the property is always
   * visible.
   */
  showWhen?: FlowPropertyShowWhen;
}

/**
 * Declarative display/range hints for a single property (FS-0146).
 *
 * All fields are optional and JSON-serialisable. `password` masks the
 * input control only; it does not make the value a secret and never
 * changes how the value is stored.
 */
export interface FlowPropertyTypeOptions {
  multiline?: boolean;
  min?: number;
  max?: number;
  step?: number;
  password?: boolean;
  placeholder?: string;
}

/**
 * Declarative conditional-visibility predicate for a single property
 * (FS-0145, n8n/Node-RED `displayOptions` equivalent).
 *
 * Evaluated against the same node's config: `property` names the sibling
 * key, and the predicate passes when the sibling value matches `equals`
 * (when present) and is a member of `oneOf` (when present). Both present
 * means both must match. Neither present imposes no constraint, so the
 * property stays visible (fail-open, never hides on malformed data).
 */
export interface FlowPropertyShowWhen {
  property: string;
  equals?: string | number | boolean | null;
  oneOf?: Array<string | number | boolean | null>;
}

/**
 * Fixed set of canvas icon tokens for FS-0148 node presentation.
 *
 * A named token only: never a URL, never an inline SVG payload, and never
 * a remote asset reference. The canvas renderer maps a known token to a
 * local mark; unknown tokens fall back to the category mark without
 * throwing. Plain strings so definitions stay JSON-serialisable.
 */
export const FLOW_NODE_ICON_TOKENS = [
  'mqtt',
  'memory',
  'rest',
  'log',
  'filter',
  'pick',
  'function',
  'window',
  'aggregate',
  'join',
  'switch',
  'sort',
] as const;

/** A canvas icon token from {@link FLOW_NODE_ICON_TOKENS}. */
export type FlowNodeIconToken = (typeof FLOW_NODE_ICON_TOKENS)[number];

/**
 * Fixed set of canvas accent tokens for FS-0148 node presentation.
 *
 * A named token only: never a raw colour (no hex/rgb/hsl literal). The
 * canvas renderer maps a known token to a bounded local style; unknown
 * tokens fall back to the neutral style without throwing. Plain strings
 * so definitions stay JSON-serialisable.
 */
export const FLOW_NODE_ACCENT_TOKENS = [
  'source',
  'transform',
  'streaming',
  'routing',
  'sink',
  'neutral',
] as const;

/** A canvas accent token from {@link FLOW_NODE_ACCENT_TOKENS}. */
export type FlowNodeAccentToken = (typeof FLOW_NODE_ACCENT_TOKENS)[number];

/**
 * Declarative eKuiper runtime mapping for one node definition (FS-0116).
 *
 * Audited contract source: `public/ekuiper-openapi.json` (eKuiper 2.4.1)
 * schema `RuleGraph` requires every graph node entry to carry `type`
 * (`source`/`operator`/`sink`), `nodeType`, and free-form `props`. This
 * mapping supplies exactly that: `kind` becomes the graph `type`,
 * `nodeType` becomes the graph `nodeType`, and `properties` allowlists
 * which Flow config keys copy verbatim into `props` under a renamed key.
 *
 * Initial strategy is direct allowlisted `configKey -> propKey` mapping
 * only: plain JSON strings, never expressions, templates, or code. The
 * FS-0117 compiler copies listed config values verbatim and ignores
 * unlisted config; nothing here is executed in Manager.
 */
export interface FlowEkuiperRuntimeMapping {
  /** Graph node `type`: eKuiper source, operator, or sink. */
  kind: FlowIrNodeKind;
  /** Graph node `nodeType`, e.g. `mqtt`, `memory`, `filter`. */
  nodeType: string;
  /**
   * Direct config-key -> props-key allowlist, e.g.
   * `{ topic: "datasource" }` copies Flow `config.topic` verbatim into
   * eKuiper `props.datasource`. Both sides are plain non-empty strings;
   * never a function, expression, or template. May be empty for nodes
   * with no mapped props (e.g. a log sink).
   */
  properties: Record<string, string>;
}

/**
 * Top-level keys permitted on a {@link FlowEkuiperRuntimeMapping}.
 * Anything else (e.g. `template`, `expression`, `code`, `eval`) is an
 * unknown mapping key and fails validation.
 */
export const FLOW_EKUIPER_RUNTIME_MAPPING_KEYS = [
  'kind',
  'nodeType',
  'properties',
] as const;

export interface FlowNodeDefinition {
  type: string;
  version: number;
  displayName: string;
  description: string;
  category: FlowNodeCategory;
  inputs: FlowPortDefinition[];
  outputs: FlowPortDefinition[];
  properties: FlowPropertyDefinition[];
  /**
   * Optional canvas icon token (FS-0148).
   *
   * Must be a member of {@link FLOW_NODE_ICON_TOKENS}; never a URL or
   * SVG payload and never a remote asset. The renderer falls back to the
   * category mark for unknown tokens. Plain string so definitions stay
   * JSON-serialisable.
   */
  icon?: FlowNodeIconToken;
  /**
   * Optional canvas accent token (FS-0148).
   *
   * Must be a member of {@link FLOW_NODE_ACCENT_TOKENS}; never a raw
   * colour. The renderer falls back to the neutral style for unknown
   * tokens. Plain string so definitions stay JSON-serialisable.
   */
  accent?: FlowNodeAccentToken;
  /**
   * Optional canvas subtitle key (FS-0148).
   *
   * Names exactly one property key whose scalar value renders as the
   * canvas subtitle (truncated, never wrapped). Must reference an
   * existing property key when present; nodes without a suitable scalar
   * property omit it. Plain string so definitions stay
   * JSON-serialisable.
   */
  subtitleKey?: string;
  /**
   * Optional declarative eKuiper runtime mapping (FS-0116).
   *
   * Extension (and future built-in) nodes declare how they compile to an
   * eKuiper graph node: `kind`/`nodeType` plus a direct allowlisted
   * `configKey -> propsKey` property map. Plain JSON data only; never a
   * function, expression, or template. Optional so built-ins without a
   * migrated mapping keep compiling through their existing compiler
   * path; the FS-0117 compiler uses this mapping only when present and
   * validated.
   */
  runtimeMapping?: FlowEkuiperRuntimeMapping;
}
