import type {
  FlowOptionItem,
  FlowOptionProviderId,
} from '@/lib/flows/registry/node-definition';

/**
 * Dynamic option providers for Flow Studio select properties (FS-0147).
 *
 * A select property may declare `optionsProvider` (a NAMED provider id from
 * the fixed allowlist in `node-definition.ts`, never a URL). The inspector
 * calls `GET /api/flows/options/[provider]` and the server resolves the id
 * against that allowlist, then fetches live names/ids from the selected
 * registered eKuiper node over the existing node-scoped transport
 * (`getNodeWithAuthorization` + `assertSafeNodeDestination`, the same
 * transport as the eKuiper proxy and the FS-0086 validation adapter).
 *
 * There is no URL/baseUrl/endpoint parameter anywhere in this module: the
 * only inputs are the path provider id and an optional registered
 * `targetNodeId`. The browser never receives credentials; responses carry
 * names/ids only (for `mqtt-confkeys` only the confKey names — the stored
 * broker entries, which may contain secrets, are never returned).
 */

/** Server-safe code for a provider id outside the fixed allowlist. */
export const UNKNOWN_OPTION_PROVIDER_CODE = 'UNKNOWN_OPTION_PROVIDER' as const;

/** Upper bound on options returned per provider so the response stays small. */
export const MAX_FLOW_OPTION_ITEMS = 1000 as const;

/**
 * Upstream eKuiper path for one provider; never caller-supplied.
 *
 * - `streams` -> `GET /streams` (audited OpenAPI array of names).
 * - `tables` -> `GET /tables` (audited OpenAPI array of names).
 * - `mqtt-confkeys` -> `GET /metadata/sources/yaml/mqtt` (`ConfigKeyMap`
 *   in the audited OpenAPI; keys are the confKey names).
 */
export function resolveFlowOptionsUpstreamPath(
  provider: FlowOptionProviderId,
): string {
  switch (provider) {
    case 'streams':
      return '/streams';
    case 'tables':
      return '/tables';
    case 'mqtt-confkeys':
      return '/metadata/sources/yaml/mqtt';
  }
}

function toName(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const name = (value as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }
  }
  return null;
}

/**
 * Reduce an upstream payload to names/ids-only option rows.
 *
 * - `streams`/`tables`: array entries as names (plain strings or
 *   `{name}` objects, mirroring `EKuiperClient.listStreams/listTables`).
 * - `mqtt-confkeys`: object keys only; the confKey bodies (which may
 *   carry broker credentials) are discarded and never leave the server.
 *
 * Returns at most {@link MAX_FLOW_OPTION_ITEMS} rows in upstream order.
 * Never throws for well-typed input; unrecognised payloads yield [].
 */
export function toFlowOptionItems(
  provider: FlowOptionProviderId,
  payload: unknown,
): FlowOptionItem[] {
  if (provider === 'mqtt-confkeys') {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return [];
    }
    const names = Object.keys(payload).filter((key) => key.trim().length > 0);
    return names.slice(0, MAX_FLOW_OPTION_ITEMS).map((name) => ({
      label: name,
      value: name,
    }));
  }
  if (!Array.isArray(payload)) {
    return [];
  }
  const options: FlowOptionItem[] = [];
  for (const entry of payload) {
    const name = toName(entry);
    if (name === null) continue;
    options.push({ label: name, value: name });
    if (options.length >= MAX_FLOW_OPTION_ITEMS) break;
  }
  return options;
}
