import type { FlowDiagnostic } from '../model/diagnostic';

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
 * Range validation for FS-0146 `typeOptions.min`/`max`.
 *
 * Applies to `number` properties only; all other types return null
 * (multiline/password/placeholder/step are display-only). Absent values
 * (undefined, null, empty string) return null and stay owned by
 * required-property validation; non-finite or non-number values return
 * null and stay owned by type validation. A finite number below `min`
 * or above `max` yields one `FLOW_INVALID_PROPERTY_VALUE` error
 * diagnostic carrying nodeId and propertyPath. Never throws for
 * well-typed input and never mutates its inputs.
 */
export function validateFlowPropertyBounds(
  nodeId: string,
  property: FlowPropertyDefinition,
  value: unknown,
): FlowDiagnostic | null {
  if (property.type !== 'number') {
    return null;
  }
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string' && value.length === 0) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const options = property.typeOptions;
  if (options === undefined) {
    return null;
  }
  const min = options.min;
  if (typeof min === 'number' && Number.isFinite(min) && value < min) {
    return {
      code: 'FLOW_INVALID_PROPERTY_VALUE',
      severity: 'error',
      message: `Flow node "${nodeId}" property "${property.key}" must be >= ${min}.`,
      nodeId,
      propertyPath: `config.${property.key}`,
    };
  }
  const max = options.max;
  if (typeof max === 'number' && Number.isFinite(max) && value > max) {
    return {
      code: 'FLOW_INVALID_PROPERTY_VALUE',
      severity: 'error',
      message: `Flow node "${nodeId}" property "${property.key}" must be <= ${max}.`,
      nodeId,
      propertyPath: `config.${property.key}`,
    };
  }
  return null;
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
 * Visibility evaluation for FS-0145 `showWhen`.
 *
 * Pure read: compares the sibling config value with strict (Object.is)
 * semantics so `false` and `0` never collapse into "absent". A property
 * without `showWhen` is always visible. Never throws for well-typed
 * input and never mutates its inputs.
 */
export function isFlowPropertyVisible(
  property: FlowPropertyDefinition,
  config: Record<string, unknown>,
): boolean {
  const showWhen = property.showWhen;
  if (showWhen === undefined) {
    return true;
  }
  const sibling: unknown = config[showWhen.property];
  if (
    showWhen.equals !== undefined &&
    !Object.is(sibling, showWhen.equals)
  ) {
    return false;
  }
  if (
    showWhen.oneOf !== undefined &&
    !showWhen.oneOf.some((candidate) => Object.is(sibling, candidate))
  ) {
    return false;
  }
  return true;
}

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
   * Internal-only runtime metadata consumed by the Flow-to-IR builder.
   *
   * Not part of the authoring contract: no target-specific property
   * mapping belongs here. `runtimeKind` is the IR node kind
   * (source/operator/sink) and `operation` names the runtime operation.
   * Optional so definitions that only participate in validation can omit
   * them; the IR builder reports a diagnostic instead of emitting a
   * partial unknown operation when they are absent.
   */
  runtimeKind?: FlowIrNodeKind;
  operation?: string;
}

/**
 * Fixed allowlist of dynamic option provider ids (FS-0147).
 *
 * The server route (`src/app/api/flows/options/[provider]/route.ts`)
 * resolves a provider id against exactly this list and fetches from the
 * selected registered eKuiper node. No other value is valid and no
 * caller-supplied URL is ever accepted.
 */
export const FLOW_OPTION_PROVIDER_IDS = [
  'streams',
  'tables',
  'mqtt-confkeys',
] as const;

/** A provider id from {@link FLOW_OPTION_PROVIDER_IDS}. */
export type FlowOptionProviderId = (typeof FLOW_OPTION_PROVIDER_IDS)[number];

/**
 * Narrow an unknown value to a known provider id.
 *
 * Pure read; returns false for unknown ids (including URLs, paths and
 * empty strings) so the server rejects them instead of fetching.
 */
export function isFlowOptionProviderId(
  value: unknown,
): value is FlowOptionProviderId {
  return (
    typeof value === 'string' &&
    (FLOW_OPTION_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

/** One option row served by a provider: a name/id carried as label+value. */
export interface FlowOptionItem {
  label: string;
  value: string;
}

/**
 * Build the Manager API URL serving one provider's options (FS-0147).
 *
 * The provider id is path-encoded; the optional target is a registered
 * node id carried as a query parameter, never a URL. There is no
 * baseUrl/url/endpoint parameter by design.
 */
export function buildFlowOptionsUrl(
  provider: FlowOptionProviderId,
  targetNodeId?: string,
): string {
  const path = `/api/flows/options/${encodeURIComponent(provider)}`;
  if (targetNodeId === undefined || targetNodeId.trim().length === 0) {
    return path;
  }
  return `${path}?targetNodeId=${encodeURIComponent(targetNodeId.trim())}`;
}

/**
 * Merge static select options with live provider results (FS-0147).
 *
 * Static options come first, then provider items whose string form does
 * not duplicate a static value. Matching is by `String(value)` so a
 * provider name never creates a visually duplicate row. Never mutates
 * its inputs; returns a fresh array.
 */
export function mergeFlowPropertyOptions(
  staticOptions:
    | Array<{ label: string; value: string | number | boolean }>
    | undefined,
  providerOptions: readonly FlowOptionItem[],
): Array<{ label: string; value: string | number | boolean }> {
  const base = Array.isArray(staticOptions) ? [...staticOptions] : [];
  const seen = new Set(base.map((option) => String(option.value)));
  for (const item of providerOptions) {
    if (typeof item?.label !== 'string' || typeof item?.value !== 'string') {
      continue;
    }
    if (item.label.length === 0 || item.value.length === 0) {
      continue;
    }
    if (seen.has(item.value)) {
      continue;
    }
    seen.add(item.value);
    base.push({ label: item.label, value: item.value });
  }
  return base;
}
