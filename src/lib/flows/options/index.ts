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
 * broker entries, which may contain secrets, are never returned; for
 * `connections` only the `id` values from `GET /connections` — `props`,
 * which carry credentials, are never returned, see
 * `public/ekuiper-openapi.json` `listConnections` / `ConnectionResponse`).
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
 * - `source-connectors` -> `GET /metadata/sources` (audited OpenAPI
 *   `MetadataPluginSummary` array; names only, same shape as streams/tables).
 * - `connections` -> `GET /connections` (audited OpenAPI `listConnections`
 *   in `public/ekuiper-openapi.json` eKuiper 2.4.1; `ConnectionResponse[]`
 *   with `id` per entry — GR-0001 returns the `id` values only, never
 *   `props`, which carry credentials).
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
    case 'source-connectors':
      return '/metadata/sources';
    case 'connections':
      // GR-0001: reads `GET /connections` (`listConnections` in
      // `public/ekuiper-openapi.json` eKuiper 2.4.1).
      return '/connections';
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
 * Read a unified connection registry `id` (GR-0001).
 *
 * Authoritative shape: `ConnectionResponse` in `public/ekuiper-openapi.json`
 * eKuiper 2.4.1 (`GET /connections` `listConnections`) — `{id, typ, props,
 * isNamed, status, ...}`. Only `id` is read; `props` (which may expose
 * plaintext credentials) is never touched or returned.
 */
function toConnectionId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const id = (value as Record<string, unknown>).id;
    if (typeof id === 'string' && id.trim().length > 0) {
      return id.trim();
    }
  }
  return null;
}

/**
 * Reduce an upstream payload to names/ids-only option rows.
 *
 * - `streams`/`tables`/`source-connectors`: array entries as names (plain strings or
 *   `{name}` objects, mirroring `EKuiperClient.listStreams/listTables` and
 *   `listSourceMetadata` which returns `MetadataPluginSummary[]` with a
 *   `name` per entry — see `public/ekuiper-openapi.json` eKuiper 2.4.1
 *   `listSourceMetadata`).
 * - `mqtt-confkeys`: object keys only; the confKey bodies (which may
 *   carry broker credentials) are discarded and never leave the server.
 * - `connections`: `GET /connections` (`listConnections` in
 *   `public/ekuiper-openapi.json` eKuiper 2.4.1) returns
 *   `ConnectionResponse[]`; the `id` values only are returned — `props`,
 *   which carry credentials, are never returned (GR-0001).
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
  if (provider === 'connections') {
    // GR-0001: reads `GET /connections` (`listConnections` in
    // `public/ekuiper-openapi.json` eKuiper 2.4.1); `ConnectionResponse.id`
    // values only — `props` (credentials) are never read or returned.
    if (!Array.isArray(payload)) {
      return [];
    }
    const options: FlowOptionItem[] = [];
    for (const entry of payload) {
      const id = toConnectionId(entry);
      if (id === null) continue;
      options.push({ label: id, value: id });
      if (options.length >= MAX_FLOW_OPTION_ITEMS) break;
    }
    return options;
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
