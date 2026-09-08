import type { FlowDiagnostic } from '../model/diagnostic';
import {
  FLOW_EKUIPER_RUNTIME_MAPPING_KEYS,
  FLOW_NODE_ACCENT_TOKENS,
  FLOW_NODE_ICON_TOKENS,
} from '@ekuiper-manager/flow-sdk';
import type {
  FlowNodeAccentToken,
  FlowNodeDefinition as SdkFlowNodeDefinition,
  FlowNodeIconToken,
  FlowPropertyDefinition,
} from '@ekuiper-manager/flow-sdk';
import type {
  FlowEkuiperRuntimeMapping,
  FlowIrNodeKind,
} from '@ekuiper-manager/flow-sdk';

/**
 * Public-safe declarative node definition subset (FS-0119).
 *
 * The authoring shapes (`FlowNodeCategory`, `FlowPortKind`,
 * `FlowPortDefinition`, `FlowPropertyDefinition`,
 * `FlowPropertyTypeOptions`, `FlowPropertyShowWhen`,
 * `FlowEkuiperRuntimeMapping`, the icon/accent token lists, and the base
 * `FlowNodeDefinition`) are canonical in `@ekuiper-manager/flow-sdk`
 * (`packages/flow-sdk/src/index.ts`) and re-exported here, so there is
 * exactly one contract and no divergent duplicate. The app's
 * `FlowNodeDefinition` below extends the SDK type with the internal-only
 * `runtimeKind`/`operation` fields.
 */
export type {
  FlowEkuiperRuntimeMapping,
  FlowIrNodeKind,
  FlowNodeAccentToken,
  FlowNodeCategory,
  FlowNodeDefinition as SdkFlowNodeDefinition,
  FlowNodeIconToken,
  FlowPortDefinition,
  FlowPortKind,
  FlowPropertyDefinition,
  FlowPropertyShowWhen,
  FlowPropertyTypeOptions,
} from '@ekuiper-manager/flow-sdk';
export {
  FLOW_EKUIPER_RUNTIME_MAPPING_KEYS,
  FLOW_NODE_ACCENT_TOKENS,
  FLOW_NODE_ICON_TOKENS,
} from '@ekuiper-manager/flow-sdk';

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
 * Top-level keys permitted on a {@link FlowEkuiperRuntimeMapping}.
 *
 * Canonical list lives in `@ekuiper-manager/flow-sdk` and is re-exported
 * above. Anything else (e.g. `template`, `expression`, `code`, `eval`) is
 * an unknown mapping key and fails validation.
 */

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

/**
 * App-internal Flow node definition (FS-0119).
 *
 * Extends the public-safe SDK contract (`SdkFlowNodeDefinition`,
 * canonical in `@ekuiper-manager/flow-sdk`) with the internal-only
 * runtime fields below. All authoring fields (identity, display metadata,
 * category, ports, properties, canvas tokens, `runtimeMapping`) are
 * inherited unchanged, so extension descriptors and built-ins share one
 * contract with no divergent duplicate.
 */
export interface FlowNodeDefinition extends SdkFlowNodeDefinition {
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
