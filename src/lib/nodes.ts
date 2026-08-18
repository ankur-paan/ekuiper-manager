import { randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { assertSafeNodeDestination, normalizeNodeUrl } from '@/lib/network';
import { decryptSecret, encryptSecret } from '@/lib/secrets';
import { parseEKuiperJsonObject } from '@/lib/ekuiper/wire';

export const NODE_COOKIE = 'ekuiper_manager_node';

export interface ManagedNode {
  id: string;
  name: string;
  baseUrl: string;
  description: string | null;
  hasAuthorization: boolean;
  isDefault: boolean;
  status: 'UNKNOWN' | 'ONLINE' | 'OFFLINE' | 'INCOMPATIBLE';
  version: string | null;
  capabilities: Record<string, boolean>;
  lastCheckedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NodeRow {
  id: string;
  name: string;
  base_url: string;
  description: string | null;
  authorization_encrypted: string | null;
  is_default: boolean;
  status: ManagedNode['status'];
  version: string | null;
  capabilities: Record<string, boolean>;
  last_checked_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

const nodeColumns = `id, name, base_url, description, authorization_encrypted, is_default,
  status, version, capabilities, last_checked_at, last_error, created_at, updated_at`;

function mapNode(row: NodeRow): ManagedNode {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    description: row.description,
    hasAuthorization: Boolean(row.authorization_encrypted),
    isDefault: row.is_default,
    status: row.status,
    version: row.version,
    capabilities: row.capabilities ?? {},
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 80) {
    throw new ApiError(400, 'Node name must be 2-80 characters', 'INVALID_NODE_NAME');
  }
  return value.trim();
}

function normalizeAuthorization(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Authorization must be a string', 'INVALID_AUTHORIZATION');
  }
  const authorization = value.trim();
  if (!authorization) return null;
  if (authorization.length > 8_192 || /[\r\n]/.test(authorization)) {
    throw new ApiError(400, 'Authorization value is invalid', 'INVALID_AUTHORIZATION');
  }
  return authorization;
}

export async function listNodes(): Promise<ManagedNode[]> {
  const result = await query<NodeRow>(
    `SELECT ${nodeColumns} FROM managed_nodes ORDER BY is_default DESC, name ASC`,
  );
  return result.rows.map(mapNode);
}

export async function getNode(id: string): Promise<ManagedNode | null> {
  const result = await query<NodeRow>(
    `SELECT ${nodeColumns} FROM managed_nodes WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? mapNode(result.rows[0]) : null;
}

export async function getNodeWithAuthorization(
  id: string | undefined,
): Promise<{ node: ManagedNode; authorization: string | null }> {
  const result = await query<NodeRow>(
    id
      ? `SELECT ${nodeColumns} FROM managed_nodes WHERE id = $1`
      : `SELECT ${nodeColumns} FROM managed_nodes ORDER BY is_default DESC, created_at ASC LIMIT 1`,
    id ? [id] : [],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(409, 'Add an eKuiper node first', 'NODE_REQUIRED');
  return { node: mapNode(row), authorization: decryptSecret(row.authorization_encrypted) };
}

export async function createNode(input: {
  name: unknown;
  baseUrl: unknown;
  description?: unknown;
  authorization?: unknown;
}): Promise<ManagedNode> {
  const name = validateName(input.name);
  const baseUrl = normalizeNodeUrl(input.baseUrl);
  await assertSafeNodeDestination(new URL(baseUrl));
  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim().slice(0, 500)
      : null;
  const rawAuthorization = normalizeAuthorization(input.authorization ?? null);
  const authorization = rawAuthorization ? encryptSecret(rawAuthorization) : null;
  const id = randomUUID();

  try {
    await withTransaction(async (client) => {
      await client.query('LOCK TABLE managed_nodes IN SHARE ROW EXCLUSIVE MODE');
      const count = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM managed_nodes',
      );
      await client.query(
        `INSERT INTO managed_nodes
           (id, name, base_url, description, authorization_encrypted, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, name, baseUrl, description, authorization, Number(count.rows[0].count) === 0],
      );
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new ApiError(409, 'A node with that name or URL already exists', 'NODE_EXISTS');
    }
    throw error;
  }
  return (await getNode(id))!;
}

export async function updateNode(
  id: string,
  input: Record<string, unknown>,
): Promise<ManagedNode> {
  const current = await getNodeWithAuthorization(id);
  const name = input.name === undefined ? current.node.name : validateName(input.name);
  const baseUrl =
    input.baseUrl === undefined ? current.node.baseUrl : normalizeNodeUrl(input.baseUrl);
  await assertSafeNodeDestination(new URL(baseUrl));
  const description =
    input.description === undefined
      ? current.node.description
      : typeof input.description === 'string' && input.description.trim()
        ? input.description.trim().slice(0, 500)
        : null;
  const changesAuthorization = Object.prototype.hasOwnProperty.call(input, 'authorization');
  const rawAuthorization = changesAuthorization ? normalizeAuthorization(input.authorization) : null;
  const authorization = rawAuthorization ? encryptSecret(rawAuthorization) : null;

  let result;
  try {
    result = await query(
      `UPDATE managed_nodes
          SET name = $1, base_url = $2, description = $3,
              authorization_encrypted = CASE WHEN $4::boolean THEN $5 ELSE authorization_encrypted END,
              updated_at = now()
        WHERE id = $6`,
      [name, baseUrl, description, changesAuthorization, authorization, id],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new ApiError(409, 'A node with that name or URL already exists', 'NODE_EXISTS');
    }
    throw error;
  }
  if (!result.rowCount) throw new ApiError(404, 'Node not found', 'NODE_NOT_FOUND');
  return (await getNode(id))!;
}

export async function deleteNode(id: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('LOCK TABLE managed_nodes IN SHARE ROW EXCLUSIVE MODE');
    const target = await client.query<{ is_default: boolean }>(
      'SELECT is_default FROM managed_nodes WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!target.rows[0]) throw new ApiError(404, 'Node not found', 'NODE_NOT_FOUND');
    await client.query('DELETE FROM managed_nodes WHERE id = $1', [id]);
    if (target.rows[0].is_default) {
      await client.query(
        `UPDATE managed_nodes SET is_default = true, updated_at = now()
          WHERE id = (SELECT id FROM managed_nodes ORDER BY created_at ASC LIMIT 1)`,
      );
    }
  });
}

export async function makeDefaultNode(id: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('LOCK TABLE managed_nodes IN SHARE ROW EXCLUSIVE MODE');
    const target = await client.query('SELECT 1 FROM managed_nodes WHERE id = $1 FOR UPDATE', [id]);
    if (!target.rowCount) throw new ApiError(404, 'Node not found', 'NODE_NOT_FOUND');
    await client.query('UPDATE managed_nodes SET is_default = false WHERE is_default = true');
    await client.query(
      'UPDATE managed_nodes SET is_default = true, updated_at = now() WHERE id = $1',
      [id],
    );
  });
}

function versionAtLeast(version: string, expected: [number, number, number]): boolean {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const current = match.slice(1, 4).map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > expected[index]) return true;
    if (current[index] < expected[index]) return false;
  }
  return true;
}

export async function probeNode(id: string): Promise<ManagedNode> {
  const { node, authorization } = await getNodeWithAuthorization(id);
  const target = new URL('/', node.baseUrl);
  await assertSafeNodeDestination(target);
  try {
    const headers = new Headers({ Accept: 'application/json' });
    if (authorization) headers.set('Authorization', authorization);
    const response = await fetch(target, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(Number(process.env.EKUIPER_API_TIMEOUT ?? 10_000)),
    });
    if (!response.ok) throw new Error(`eKuiper returned HTTP ${response.status}`);
    const payload = parseEKuiperJsonObject(await response.text());
    const version = typeof payload.version === 'string' ? payload.version : null;
    const compatible = Boolean(version && versionAtLeast(version, [2, 4, 1]));
    const capabilities = {
      core: true,
      bulkRuleControl: Boolean(version && versionAtLeast(version, [2, 4, 0])),
      schemaUpload: Boolean(version && versionAtLeast(version, [2, 4, 1])),
    };
    await query(
      `UPDATE managed_nodes
          SET status = $1, version = $2, capabilities = $3::jsonb,
              last_checked_at = now(), last_error = $4, updated_at = now()
        WHERE id = $5`,
      [
        compatible ? 'ONLINE' : 'INCOMPATIBLE',
        version,
        JSON.stringify(capabilities),
        compatible ? null : version ? `Unsupported eKuiper version ${version}` : 'Version was not reported',
        id,
      ],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    await query(
      `UPDATE managed_nodes
          SET status = 'OFFLINE', last_checked_at = now(), last_error = $1, updated_at = now()
        WHERE id = $2`,
      [message.slice(0, 300), id],
    );
  }
  return (await getNode(id))!;
}
