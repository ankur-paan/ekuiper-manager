import {
  BASELINE_CAPABILITY_OPERATORS,
  BASELINE_CAPABILITY_SINKS,
  BASELINE_CAPABILITY_SOURCES,
  type TargetCapabilityProfile,
} from './types';

/**
 * Input for {@link resolveTargetCapabilities}.
 *
 * - `version`: raw `SystemInfo.version` string from the target probe
 *   (`src/lib/nodes.ts` `probeNode`), or null/undefined when the probe
 *   did not report one.
 * - `reachable`: whether the probe reached the target. Defaults to false
 *   (conservative) when omitted.
 * - `sourceNames`/`operatorNames`/`sinkNames`: optional plain identifier
 *   lists derived from the audited metadata endpoints
 *   (`GET /metadata/sources`, `GET /metadata/operators`,
 *   `GET /metadata/sinks` via `src/lib/ekuiper/client.ts`). Callers map
 *   `MetadataItem[]` to `item.name` strings before passing them in, so this
 *   module never imports the eKuiper HTTP client. When a list is provided,
 *   the baseline is intersected with it (unlisted entries become
 *   unavailable); when omitted, the version-gated baseline applies.
 */
export interface ResolveCapabilitiesInput {
  version?: string | null;
  reachable?: boolean;
  sourceNames?: readonly string[] | null;
  operatorNames?: readonly string[] | null;
  sinkNames?: readonly string[] | null;
}

/**
 * Minimum version proving the audited graph-rule baseline. This is the ONLY
 * place that may compare eKuiper versions: keep every semver condition
 * here so UI/compiler code consumes the normalized profile instead.
 */
const MIN_BASELINE_VERSION: readonly [number, number, number] = [2, 4, 1];

/**
 * Parse the leading `major.minor.patch` of a raw version string.
 * Returns null when no parseable triple exists (conservative: unproven).
 */
function parseVersionTriple(value: string): [number, number, number] | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(value);
  if (match === null) return null;
  const [, major, minor, patch] = match;
  if (major === undefined || minor === undefined || patch === undefined) {
    return null;
  }
  return [Number(major), Number(minor), Number(patch)];
}

function versionAtLeast(value: string, expected: readonly [number, number, number]): boolean {
  const current = parseVersionTriple(value);
  if (current === null) return false;
  for (let index = 0; index < 3; index += 1) {
    const have = current[index];
    const want = expected[index];
    if (have === undefined || want === undefined) return false;
    if (have > want) return true;
    if (have < want) return false;
  }
  return true;
}

/**
 * Intersect a frozen baseline with caller-supplied metadata names.
 * Comparison is case-insensitive; output keeps baseline casing and
 * baseline order (already sorted ascending) for determinism.
 */
function narrowByMetadata(
  baseline: readonly string[],
  names: readonly string[] | null | undefined,
): string[] {
  if (names === undefined || names === null) return [...baseline];
  const proven = new Set(names.map((entry) => entry.toLowerCase()));
  return baseline.filter((entry) => proven.has(entry.toLowerCase()));
}

function unavailable(version: string | null, reachable: boolean): TargetCapabilityProfile {
  return {
    ekuiperVersion: version,
    reachable,
    graphRules: false,
    sources: [],
    operators: [],
    sinks: [],
    ruleTest: false,
    ruleTestSse: false,
  };
}

/**
 * Resolve a normalized capability profile for one eKuiper target.
 *
 * Conservative by design: unknown, unparsable, below-baseline, or
 * unreachable versions yield `graphRules: false` with empty identifier
 * sets rather than optimistically enabling capabilities. Deterministic:
 * same input always yields the same profile (sorted identifier arrays, no
 * randomness/clock).
 */
export function resolveTargetCapabilities(
  input: ResolveCapabilitiesInput,
): TargetCapabilityProfile {
  const reachable = input.reachable === true;
  const raw = typeof input.version === 'string' ? input.version.trim() : '';
  const version = raw.length > 0 ? raw : null;

  if (!reachable || version === null) {
    return unavailable(version, reachable);
  }
  if (!versionAtLeast(version, MIN_BASELINE_VERSION)) {
    return unavailable(version, reachable);
  }

  return {
    ekuiperVersion: version,
    reachable: true,
    graphRules: true,
    sources: narrowByMetadata(
      [...BASELINE_CAPABILITY_SOURCES],
      input.sourceNames,
    ),
    operators: narrowByMetadata(
      [...BASELINE_CAPABILITY_OPERATORS],
      input.operatorNames,
    ),
    sinks: narrowByMetadata([...BASELINE_CAPABILITY_SINKS], input.sinkNames),
    // FS-0106: rule-test transport verified but not safely reachable under
    // the current registered-node policy (separate per-test SSE port, no
    // audited graph-rule test envelope). Conservative: always false until a
    // later ticket proves a safe relay. See
    // docs/FLOW_STUDIO_RULE_TEST_NOTES.md. No allowlist weakening here.
    ruleTest: false,
    ruleTestSse: false,
  };
}
