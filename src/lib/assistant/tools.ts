import 'server-only';

import type { AuthenticatedUser } from '@/lib/auth/session';
import { ApiError } from '@/lib/api';
import { redactAssistantData, redactAssistantText } from '@/lib/assistant/redaction';
import { query } from '@/lib/db';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization, listNodes } from '@/lib/nodes';
import packageJson from '../../../package.json';

export interface AssistantToolContext {
  user: AuthenticatedUser;
  selectedNodeId?: string;
  fetcher?: typeof fetch;
}

export interface AssistantToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AssistantToolResult {
  label: string;
  content: string;
}

const MAX_TOOL_ARGUMENT_CHARS = 8_000;
const MAX_TOOL_RESULT_CHARS = 24_000;
const MAX_EKUIPER_RESPONSE_BYTES = 256 * 1024;
const SEGMENT = '[A-Za-z0-9_.~-]{1,128}';

const noArguments = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const boundedLimit = {
  type: 'integer',
  minimum: 1,
  maximum: 100,
  description: 'Maximum rows to return. Defaults to 25.',
} as const;

const commonTools: AssistantToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'manager_overview',
      description:
        'Read a sanitized live overview of eKuiper Manager, its PostgreSQL storage, migrations, managed node health, and operational record counts allowed for the signed-in user. Never returns secrets.',
      parameters: noArguments,
    },
  },
  {
    type: 'function',
    function: {
      name: 'manager_nodes',
      description:
        'List Manager eKuiper nodes with URL, selected/default state, health, version, capabilities, and last check/error. Stored authorization values are never returned.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['UNKNOWN', 'ONLINE', 'OFFLINE', 'INCOMPATIBLE'],
          },
          limit: boundedLimit,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ekuiper_read',
      description:
        'Perform one allowlisted HTTP GET against the currently selected eKuiper node. Use it iteratively to inspect actual streams, tables, rules and status, topologies, schemas, traces, connections, plugins, metadata, services, JavaScript UDFs, uploads, import tasks, or metrics-dump availability. Paths resemble /rules, /rules/{id}/status, /streams/{name}, /connections, /plugins/portables/{name}/status, /metadata/sources/{name}, /services/{name}, /udf/javascript/{id}, /async/task/{id}, and /metrics/dump/check. Mutation and binary-export paths are rejected; secret-like response fields are redacted.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            minLength: 1,
            maxLength: 240,
            description: 'An allowlisted eKuiper REST path, beginning with /.',
          },
          query: {
            type: 'object',
            description: 'Optional allowlisted query filters for this GET path.',
            additionalProperties: {
              anyOf: [{ type: 'string' }, { type: 'integer' }, { type: 'boolean' }],
            },
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
];

const ownerTools: AssistantToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'manager_users',
      description:
        'Owner-only read of Manager user lifecycle state: username, role, password-change requirement, disabled state, last login, and creation time. Password hashes are never queried.',
      parameters: {
        type: 'object',
        properties: {
          includeDisabled: { type: 'boolean', description: 'Include disabled users. Defaults to true.' },
          limit: boundedLimit,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manager_sessions',
      description:
        'Owner-only read of sanitized Manager session lifecycle state and counts. Returns users and timestamps/status but never session token hashes or cookies.',
      parameters: {
        type: 'object',
        properties: {
          state: { type: 'string', enum: ['active', 'expired', 'revoked', 'all'] },
          limit: boundedLimit,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manager_audit_events',
      description:
        'Owner-only search of the bounded Manager audit trail. Filter by action, resource type, success, node, or actor. Metadata is recursively secret-redacted.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', maxLength: 120 },
          resourceType: { type: 'string', maxLength: 120 },
          actorId: { type: 'string', maxLength: 128 },
          nodeId: { type: 'string', maxLength: 128 },
          success: { type: 'boolean' },
          limit: boundedLimit,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manager_migrations',
      description:
        'Owner-only read of applied Manager database migrations and application times. Migration checksums are deliberately omitted.',
      parameters: noArguments,
    },
  },
];

export function assistantToolDefinitions(user: AuthenticatedUser): AssistantToolDefinition[] {
  return user.role === 'OWNER' ? [...commonTools, ...ownerTools] : commonTools;
}

function plainObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, `${field} must be an object`, 'INVALID_TOOL_ARGUMENTS');
  }
  return value as Record<string, unknown>;
}

export function parseAssistantToolArguments(raw: string): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length > MAX_TOOL_ARGUMENT_CHARS) {
    throw new ApiError(400, 'Tool arguments are invalid', 'INVALID_TOOL_ARGUMENTS');
  }
  try {
    return plainObject(JSON.parse(raw || '{}'), 'Tool arguments');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Tool arguments are invalid JSON', 'INVALID_TOOL_ARGUMENTS');
  }
}

function limitArgument(args: Record<string, unknown>): number {
  if (args.limit === undefined) return 25;
  if (!Number.isInteger(args.limit) || Number(args.limit) < 1 || Number(args.limit) > 100) {
    throw new ApiError(400, 'limit must be an integer from 1 to 100', 'INVALID_TOOL_ARGUMENTS');
  }
  return Number(args.limit);
}

function optionalString(args: Record<string, unknown>, key: string, max = 128): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new ApiError(400, `${key} is invalid`, 'INVALID_TOOL_ARGUMENTS');
  }
  return value.trim();
}

function boundedToolContent(source: string, data: unknown): string {
  const safe = redactAssistantData({ ok: true, source, data });
  const serialized = JSON.stringify(safe);
  if (serialized.length <= MAX_TOOL_RESULT_CHARS) return serialized;
  return JSON.stringify({
    ok: true,
    source,
    truncated: true,
    preview: redactAssistantText(serialized.slice(0, MAX_TOOL_RESULT_CHARS - 500)),
    note: 'The response exceeded the per-tool context budget. Narrow the next read to a specific resource.',
  });
}

function requireOwner(context: AssistantToolContext): void {
  if (context.user.role !== 'OWNER') {
    throw new ApiError(403, 'Owner access is required for that read', 'OWNER_REQUIRED');
  }
}

async function managerOverview(context: AssistantToolContext): Promise<AssistantToolResult> {
  const result = await query<{
    database_name: string;
    postgres_version: string;
    database_bytes: string;
    migrations: string;
    nodes: string;
    online_nodes: string;
    offline_nodes: string;
  }>(`SELECT
    current_database() AS database_name,
    current_setting('server_version') AS postgres_version,
    pg_database_size(current_database())::text AS database_bytes,
    (SELECT count(*)::text FROM schema_migrations) AS migrations,
    (SELECT count(*)::text FROM managed_nodes) AS nodes,
    (SELECT count(*)::text FROM managed_nodes WHERE status = 'ONLINE') AS online_nodes,
    (SELECT count(*)::text FROM managed_nodes WHERE status IN ('OFFLINE', 'INCOMPATIBLE')) AS offline_nodes`);
  const row = result.rows[0];
  let ownerCounts: { users: number; activeSessions: number; auditEvents: number } | undefined;
  if (context.user.role === 'OWNER') {
    const counts = await query<{ users: string; active_sessions: string; audit_events: string }>(
      `SELECT
        (SELECT count(*)::text FROM users) AS users,
        (SELECT count(*)::text FROM sessions WHERE revoked_at IS NULL AND expires_at > now()) AS active_sessions,
        (SELECT count(*)::text FROM audit_events) AS audit_events`,
    );
    ownerCounts = {
      users: Number(counts.rows[0].users),
      activeSessions: Number(counts.rows[0].active_sessions),
      auditEvents: Number(counts.rows[0].audit_events),
    };
  }
  return {
    label: 'Manager and PostgreSQL overview',
    content: boundedToolContent('Manager overview', {
      manager: {
        version: packageJson.version,
        runtime: process.version,
        uptimeSeconds: Math.round(process.uptime()),
      },
      database: {
        name: row.database_name,
        postgresVersion: row.postgres_version,
        sizeBytes: Number(row.database_bytes),
        appliedMigrations: Number(row.migrations),
      },
      nodes: {
        total: Number(row.nodes),
        online: Number(row.online_nodes),
        unhealthy: Number(row.offline_nodes),
      },
      ...(ownerCounts ? { ownerVisibleRecords: ownerCounts } : {}),
    }),
  };
}

async function managerNodes(
  context: AssistantToolContext,
  args: Record<string, unknown>,
): Promise<AssistantToolResult> {
  const allowedStatuses = new Set(['UNKNOWN', 'ONLINE', 'OFFLINE', 'INCOMPATIBLE']);
  const status = optionalString(args, 'status');
  if (status && !allowedStatuses.has(status)) {
    throw new ApiError(400, 'status is invalid', 'INVALID_TOOL_ARGUMENTS');
  }
  const nodes = (await listNodes())
    .filter((node) => !status || node.status === status)
    .slice(0, limitArgument(args))
    .map((node) => ({
      id: node.id,
      name: node.name,
      baseUrl: node.baseUrl,
      description: node.description,
      selected: node.id === context.selectedNodeId || (!context.selectedNodeId && node.isDefault),
      isDefault: node.isDefault,
      status: node.status,
      version: node.version,
      capabilities: node.capabilities,
      privateAuthenticationConfigured: node.hasAuthorization,
      lastCheckedAt: node.lastCheckedAt,
      lastError: node.lastError,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    }));
  return {
    label: `Manager nodes (${nodes.length})`,
    content: boundedToolContent('Manager nodes', nodes),
  };
}

async function managerUsers(args: Record<string, unknown>): Promise<AssistantToolResult> {
  const includeDisabled = args.includeDisabled !== false;
  if (args.includeDisabled !== undefined && typeof args.includeDisabled !== 'boolean') {
    throw new ApiError(400, 'includeDisabled must be boolean', 'INVALID_TOOL_ARGUMENTS');
  }
  const result = await query(
    `SELECT id, username, role, must_change_password AS "mustChangePassword",
            disabled_at AS "disabledAt", last_login_at AS "lastLoginAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users
      WHERE ($1::boolean OR disabled_at IS NULL)
      ORDER BY created_at ASC
      LIMIT $2`,
    [includeDisabled, limitArgument(args)],
  );
  return {
    label: `Manager users (${result.rows.length})`,
    content: boundedToolContent('Manager users', result.rows),
  };
}

async function managerSessions(args: Record<string, unknown>): Promise<AssistantToolResult> {
  const state = optionalString(args, 'state') ?? 'active';
  if (!['active', 'expired', 'revoked', 'all'].includes(state)) {
    throw new ApiError(400, 'state is invalid', 'INVALID_TOOL_ARGUMENTS');
  }
  const result = await query(
    `SELECT u.username,
            CASE
              WHEN s.revoked_at IS NOT NULL THEN 'revoked'
              WHEN s.expires_at <= now() THEN 'expired'
              ELSE 'active'
            END AS state,
            s.expires_at AS "expiresAt", s.last_seen_at AS "lastSeenAt",
            s.revoked_at AS "revokedAt", s.created_at AS "createdAt"
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE ($1 = 'all') OR
            ($1 = 'active' AND s.revoked_at IS NULL AND s.expires_at > now()) OR
            ($1 = 'expired' AND s.revoked_at IS NULL AND s.expires_at <= now()) OR
            ($1 = 'revoked' AND s.revoked_at IS NOT NULL)
      ORDER BY s.created_at DESC
      LIMIT $2`,
    [state, limitArgument(args)],
  );
  return {
    label: `Manager sessions: ${state} (${result.rows.length})`,
    content: boundedToolContent('Manager sessions', result.rows),
  };
}

async function managerAuditEvents(args: Record<string, unknown>): Promise<AssistantToolResult> {
  if (args.success !== undefined && typeof args.success !== 'boolean') {
    throw new ApiError(400, 'success must be boolean', 'INVALID_TOOL_ARGUMENTS');
  }
  const filters = {
    action: optionalString(args, 'action', 120),
    resourceType: optionalString(args, 'resourceType', 120),
    actorId: optionalString(args, 'actorId'),
    nodeId: optionalString(args, 'nodeId'),
    success: args.success as boolean | undefined,
  };
  const result = await query(
    `SELECT a.id, a.action, a.resource_type AS "resourceType",
            a.resource_id AS "resourceId", a.success, a.metadata,
            a.created_at AS "createdAt", u.username AS actor, n.name AS node
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_id
       LEFT JOIN managed_nodes n ON n.id = a.node_id
      WHERE ($1::text IS NULL OR a.action = $1)
        AND ($2::text IS NULL OR a.resource_type = $2)
        AND ($3::text IS NULL OR a.actor_id = $3)
        AND ($4::text IS NULL OR a.node_id = $4)
        AND ($5::boolean IS NULL OR a.success = $5)
      ORDER BY a.created_at DESC
      LIMIT $6`,
    [
      filters.action ?? null,
      filters.resourceType ?? null,
      filters.actorId ?? null,
      filters.nodeId ?? null,
      filters.success ?? null,
      limitArgument(args),
    ],
  );
  return {
    label: `Manager audit events (${result.rows.length})`,
    content: boundedToolContent('Manager audit events', result.rows),
  };
}

async function managerMigrations(): Promise<AssistantToolResult> {
  const result = await query(
    `SELECT name, applied_at AS "appliedAt"
       FROM schema_migrations ORDER BY applied_at ASC, name ASC`,
  );
  return {
    label: `Manager migrations (${result.rows.length})`,
    content: boundedToolContent('Manager migrations', result.rows),
  };
}

interface AllowedEKuiperPath {
  pattern: RegExp;
  query?: ReadonlySet<string>;
}

const tableQueries = new Set(['kind']);
const sourceQueries = new Set(['kind']);
const traceQueries = new Set(['limit']);
const connectionQueries = new Set(['forceAll']);
const resourceQueries = new Set(['sourceType']);

const allowedEKuiperPaths: AllowedEKuiperPath[] = [
  { pattern: /^$/ },
  { pattern: /^ping$/ },
  { pattern: /^streams$/ },
  { pattern: /^streamdetails$/ },
  { pattern: new RegExp(`^streams/${SEGMENT}(?:/schema)?$`) },
  { pattern: /^tables$/, query: tableQueries },
  { pattern: /^tabledetails$/, query: tableQueries },
  { pattern: new RegExp(`^tables/${SEGMENT}(?:/schema)?$`) },
  { pattern: /^rules$/ },
  { pattern: /^rules\/status\/all$/ },
  { pattern: /^rules\/usage\/cpu$/ },
  { pattern: new RegExp(`^rules/${SEGMENT}$`) },
  { pattern: new RegExp(`^rules/${SEGMENT}/(?:status|topo|schema|explain)$`) },
  { pattern: new RegExp(`^v2/rules/${SEGMENT}/status$`) },
  { pattern: new RegExp(`^trace/${SEGMENT}$`) },
  { pattern: new RegExp(`^trace/rule/${SEGMENT}$`), query: traceQueries },
  { pattern: /^connections$/, query: connectionQueries },
  { pattern: new RegExp(`^connections/${SEGMENT}$`) },
  { pattern: /^schemas\/(?:protobuf|custom)$/ },
  { pattern: new RegExp(`^schemas/(?:protobuf|custom)/${SEGMENT}$`) },
  { pattern: /^plugins\/(?:sources|sinks|functions|portables|udfs)$/ },
  { pattern: /^plugins\/(?:sources|sinks|functions)\/prebuild$/ },
  { pattern: new RegExp(`^plugins/(?:sources|sinks|functions|portables|udfs)/${SEGMENT}$`) },
  { pattern: new RegExp(`^plugins/portables/${SEGMENT}/status$`) },
  { pattern: /^metadata\/(?:functions|operators|sinks|sources|connections|resources)$/ },
  { pattern: /^metadata\/resource$/, query: resourceQueries },
  { pattern: new RegExp(`^metadata/(?:sinks|sources|connections)/${SEGMENT}$`) },
  { pattern: new RegExp(`^metadata/(?:sinks|sources|connections)/yaml/${SEGMENT}$`) },
  { pattern: /^services$/ },
  { pattern: /^services\/functions$/ },
  { pattern: new RegExp(`^services/${SEGMENT}$`) },
  { pattern: new RegExp(`^services/functions/${SEGMENT}$`) },
  { pattern: /^udf\/javascript$/ },
  { pattern: new RegExp(`^udf/javascript/${SEGMENT}$`) },
  { pattern: /^config\/uploads$/ },
  { pattern: /^data\/import\/status$/ },
  { pattern: new RegExp(`^async/task/${SEGMENT}$`) },
  { pattern: /^metrics\/dump\/check$/ },
];

export function normalizeEKuiperReadRequest(args: Record<string, unknown>): {
  path: string;
  query: URLSearchParams;
} {
  if (typeof args.path !== 'string' || !args.path.trim() || args.path.length > 240) {
    throw new ApiError(400, 'path is invalid', 'INVALID_TOOL_ARGUMENTS');
  }
  const original = args.path.trim();
  if (!original.startsWith('/') || original.startsWith('//') || original.includes('?') || original.includes('#') || original.includes('\\')) {
    throw new ApiError(400, 'path must be an application-relative eKuiper path', 'INVALID_TOOL_ARGUMENTS');
  }
  const path = original.replace(/^\/+/, '').replace(/\/$/, '');
  const match = allowedEKuiperPaths.find((candidate) => candidate.pattern.test(path));
  if (!match) {
    throw new ApiError(403, 'That eKuiper read path is not available to the assistant', 'TOOL_PATH_NOT_ALLOWED');
  }

  const rawQuery = args.query === undefined ? {} : plainObject(args.query, 'query');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(rawQuery)) {
    if (!match.query?.has(key)) {
      throw new ApiError(400, `query.${key} is not allowed for this path`, 'INVALID_TOOL_ARGUMENTS');
    }
    if (!['string', 'number', 'boolean'].includes(typeof value) || String(value).length > 160) {
      throw new ApiError(400, `query.${key} is invalid`, 'INVALID_TOOL_ARGUMENTS');
    }
    if (key === 'limit' && (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 100)) {
      throw new ApiError(400, 'query.limit must be an integer from 1 to 100', 'INVALID_TOOL_ARGUMENTS');
    }
    query.set(key, String(value));
  }
  return { path, query };
}

async function readBoundedText(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_EKUIPER_RESPONSE_BYTES) {
    throw new ApiError(413, 'The eKuiper response is too large for assistant context', 'TOOL_RESULT_TOO_LARGE');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_EKUIPER_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ApiError(413, 'The eKuiper response is too large for assistant context', 'TOOL_RESULT_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

async function eKuiperRead(
  context: AssistantToolContext,
  args: Record<string, unknown>,
): Promise<AssistantToolResult> {
  const request = normalizeEKuiperReadRequest(args);
  const { node, authorization } = await getNodeWithAuthorization(context.selectedNodeId);
  const encodedPath = request.path.split('/').map(encodeURIComponent).join('/');
  const target = new URL(encodedPath ? `/${encodedPath}` : '/', node.baseUrl);
  target.search = request.query.toString();
  await assertSafeNodeDestination(target);

  const response = await (context.fetcher ?? fetch)(target, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain;q=0.9',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000)),
  });
  const text = await readBoundedText(response);
  if (!response.ok) {
    throw new ApiError(
      502,
      `eKuiper ${request.path || '/'} returned HTTP ${response.status}${text ? `: ${redactAssistantText(text).slice(0, 500)}` : ''}`,
      'EKUIPER_READ_FAILED',
    );
  }
  let data: unknown = text;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = redactAssistantText(text);
    }
  }
  const label = `${node.name}: ${request.path || '/'}${request.query.size ? `?${request.query}` : ''}`;
  return {
    label,
    content: boundedToolContent(label, data),
  };
}

export async function executeAssistantTool(
  name: string,
  rawArguments: string,
  context: AssistantToolContext,
): Promise<AssistantToolResult> {
  const args = parseAssistantToolArguments(rawArguments);
  switch (name) {
    case 'manager_overview':
      return managerOverview(context);
    case 'manager_nodes':
      return managerNodes(context, args);
    case 'ekuiper_read':
      return eKuiperRead(context, args);
    case 'manager_users':
      requireOwner(context);
      return managerUsers(args);
    case 'manager_sessions':
      requireOwner(context);
      return managerSessions(args);
    case 'manager_audit_events':
      requireOwner(context);
      return managerAuditEvents(args);
    case 'manager_migrations':
      requireOwner(context);
      return managerMigrations();
    default:
      throw new ApiError(400, 'The requested read-only tool does not exist', 'TOOL_NOT_FOUND');
  }
}
