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
 * Narrow an unknown value to a known icon token (FS-0148).
 *
 * Pure read; returns false for unknown tokens (including URLs, paths,
 * SVG payloads and empty strings) so the renderer falls back to the
 * category mark instead of loading anything.
 */
export function isFlowNodeIconToken(
  value: unknown,
): value is FlowNodeIconToken {
  return (
    typeof value === 'string' &&
    (FLOW_NODE_ICON_TOKENS as readonly string[]).includes(value)
  );
}

/**
 * Narrow an unknown value to a known accent token (FS-0148).
 *
 * Pure read; returns false for unknown tokens (including raw colours)
 * so the renderer falls back to the neutral style.
 */
export function isFlowNodeAccentToken(
  value: unknown,
): value is FlowNodeAccentToken {
  return (
    typeof value === 'string' &&
    (FLOW_NODE_ACCENT_TOKENS as readonly string[]).includes(value)
  );
}

/**
 * Resolve the canvas subtitle for a node (FS-0148).
 *
 * Reads `config[subtitleKey]` and returns a short display string for
 * scalar values (string as-is, finite numbers and booleans via
 * `String(value)`). Returns undefined when the key is absent, the config
 * is missing, or the value is not a displayable scalar (objects, arrays,
 * null, undefined, empty/blank strings, non-finite numbers). Truncation
 * itself is a canvas CSS concern (`truncate`); this helper never throws
 * for well-typed input and never mutates its inputs.
 */
export function resolveFlowNodeSubtitle(
  config: Record<string, unknown> | undefined,
  subtitleKey: string | undefined,
): string | undefined {
  if (
    config === undefined ||
    subtitleKey === undefined ||
    subtitleKey.length === 0
  ) {
    return undefined;
  }
  const value: unknown = config[subtitleKey];
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value : undefined;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

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

/** Diagnostic code for a structurally invalid runtime mapping. */
export const FLOW_EXTENSION_INVALID_RUNTIME_MAPPING =
  'FLOW_EXTENSION_INVALID_RUNTIME_MAPPING' as const;

/**
 * Diagnostic code reused for function-valued mapping content.
 *
 * Kept string-identical to the extension validator's
 * `FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED` so mapping violations and
 * manifest/descriptor violations share one code without importing the
 * extension validator (which would create a registry <-> extensions
 * import cycle).
 */
export const FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED =
  'FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED' as const;

/** eKuiper graph `type` values permitted in a mapping `kind`. */
const FLOW_EKUIPER_RUNTIME_KINDS: readonly FlowIrNodeKind[] = [
  'source',
  'operator',
  'sink',
];

/** Safe `nodeType`/props-key shape: leading letter, then alphanumerics/`_`/`-`/`.`. */
const FLOW_EKUIPER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;

function isMappingRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pushMappingDiagnostic(
  diagnostics: FlowDiagnostic[],
  code: string,
  message: string,
  propertyPath?: string,
): void {
  diagnostics.push({
    code,
    severity: 'error',
    message,
    ...(propertyPath === undefined ? {} : { propertyPath }),
  });
}

/**
 * Find the first function value nested in mapping data.
 *
 * Returns the dotted key path of the offending value, or undefined when
 * no function value is present. Reported instead of ever being called:
 * mappings are plain JSON data and must never carry functions/eval.
 */
function findMappingFunctionPath(
  value: unknown,
  path: string,
): string | undefined {
  if (typeof value === 'function') {
    return path;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findMappingFunctionPath(value[index], `${path}[${index}]`);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (isMappingRecord(value)) {
    for (const key of Object.keys(value)) {
      const found = findMappingFunctionPath(
        value[key],
        path.length === 0 ? key : `${path}.${key}`,
      );
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Validate one declarative eKuiper runtime mapping (FS-0116).
 *
 * Rules:
 * - must be a plain object with exactly the known keys (`kind`,
 *   `nodeType`, `properties`); unknown keys fail;
 * - `kind` must be `source`/`operator`/`sink`;
 * - `nodeType` must be a safe non-empty name (never empty, never code);
 * - `properties` must be a `configKey -> propKey` record of non-empty
 *   safe strings; function values fail as executable content and are
 *   never called;
 * - when `declaredProperties` is provided, every mapped `configKey` must
 *   name a declared property key, and `secret-ref` properties must not be
 *   mapped (secret binding lands in a later design; blind inclusion
 *   would leak secret references into compiled props).
 *
 * Returns structured `FlowDiagnostic[]` (empty means valid). Never throws
 * for JSON-compatible input and never mutates its input.
 */
export function validateFlowEkuiperRuntimeMapping(
  value: unknown,
  declaredProperties?: readonly FlowPropertyDefinition[] | undefined,
  prefix = '',
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];
  const at = (path: string): string =>
    prefix.length === 0 ? path : `${prefix}.${path}`;
  if (!isMappingRecord(value)) {
    pushMappingDiagnostic(
      diagnostics,
      FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
      'Extension runtime mapping must be an object.',
      prefix.length === 0 ? undefined : prefix,
    );
    return diagnostics;
  }

  for (const key of Object.keys(value)) {
    if (
      !(FLOW_EKUIPER_RUNTIME_MAPPING_KEYS as readonly string[]).includes(key)
    ) {
      pushMappingDiagnostic(
        diagnostics,
        FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
        `Extension runtime mapping has an unknown key "${key}". ` +
          `Allowed keys are ${FLOW_EKUIPER_RUNTIME_MAPPING_KEYS.join(', ')}.`,
        at(key),
      );
    }
  }

  const functionPath = findMappingFunctionPath(
    value,
    prefix.length === 0 ? '' : prefix,
  );
  if (functionPath !== undefined && functionPath.length > 0) {
    pushMappingDiagnostic(
      diagnostics,
      FLOW_EXTENSION_EXECUTABLE_UNSUPPORTED,
      `Extension runtime mapping declares unsupported executable function at "${functionPath}". ` +
        `Mappings are plain config-key -> props-key strings and are never executed.`,
      functionPath,
    );
  }

  const kind: unknown = value['kind'];
  if (
    typeof kind !== 'string' ||
    !(FLOW_EKUIPER_RUNTIME_KINDS as readonly string[]).includes(kind)
  ) {
    pushMappingDiagnostic(
      diagnostics,
      FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
      'Extension runtime mapping kind must be one of source, operator, sink.',
      at('kind'),
    );
  }

  const nodeType: unknown = value['nodeType'];
  if (
    typeof nodeType !== 'string' ||
    nodeType.length === 0 ||
    !FLOW_EKUIPER_NAME_PATTERN.test(nodeType)
  ) {
    pushMappingDiagnostic(
      diagnostics,
      FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
      'Extension runtime mapping nodeType must be a non-empty safe name ' +
        '(leading letter, then letters, digits, "_", "-", ".").',
      at('nodeType'),
    );
  }

  const properties: unknown = value['properties'];
  if (!isMappingRecord(properties)) {
    pushMappingDiagnostic(
      diagnostics,
      FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
      'Extension runtime mapping properties must be an object mapping config keys to eKuiper props keys.',
      at('properties'),
    );
    return diagnostics;
  }

  const declaredByKey =
    declaredProperties === undefined
      ? undefined
      : new Map(declaredProperties.map((property) => [property.key, property]));
  for (const configKey of Object.keys(properties)) {
    const entryPath = at(`properties.${configKey}`);
    const propKey: unknown = properties[configKey];
    if (configKey.length === 0) {
      pushMappingDiagnostic(
        diagnostics,
        FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
        'Extension runtime mapping config key must be a non-empty string.',
        entryPath,
      );
      continue;
    }
    if (
      typeof propKey !== 'string' ||
      propKey.length === 0 ||
      !FLOW_EKUIPER_NAME_PATTERN.test(propKey)
    ) {
      pushMappingDiagnostic(
        diagnostics,
        FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
        `Extension runtime mapping for config key "${configKey}" must name a non-empty safe eKuiper props key.`,
        entryPath,
      );
      continue;
    }
    if (declaredByKey !== undefined && !declaredByKey.has(configKey)) {
      pushMappingDiagnostic(
        diagnostics,
        FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
        `Extension runtime mapping config key "${configKey}" does not match any declared node property.`,
        entryPath,
      );
      continue;
    }
    const declared = declaredByKey?.get(configKey);
    if (declared !== undefined && declared.type === 'secret-ref') {
      pushMappingDiagnostic(
        diagnostics,
        FLOW_EXTENSION_INVALID_RUNTIME_MAPPING,
        `Extension runtime mapping config key "${configKey}" is a secret-ref property and must not be mapped into eKuiper props until the secret-binding design allows it.`,
        entryPath,
      );
    }
  }

  return diagnostics;
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
