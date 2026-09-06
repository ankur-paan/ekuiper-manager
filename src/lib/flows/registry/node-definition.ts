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
