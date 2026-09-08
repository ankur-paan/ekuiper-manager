import { NextRequest } from 'next/server';
import { DELETE as DELETE_DEPLOY } from '@/app/api/flows/[id]/deploy/route';
import { DELETE as DELETE_FLOW } from '@/app/api/flows/[id]/route';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { recordAuditSafely } from '@/lib/audit';
import { query } from '@/lib/db';
import { assertSafeNodeDestination } from '@/lib/network';
import type { FlowRow } from '@/lib/flows/persistence/types';

jest.mock('@/lib/auth/session', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/audit', () => ({ recordAuditSafely: jest.fn() }));
jest.mock('@/lib/db', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('@/lib/network', () => ({ assertSafeNodeDestination: jest.fn() }));

const mockedGetUser = jest.mocked(getAuthenticatedUser);
const mockedAudit = jest.mocked(recordAuditSafely);
const mockedQuery = jest.mocked(query);
const mockedAssertDestination = jest.mocked(assertSafeNodeDestination);

const actor = {
  id: 'user-1',
  username: 'operator',
  role: 'USER' as const,
  mustChangePassword: false,
};

const FIXED_DATE = new Date('2026-01-03T00:00:00.000Z');
const BASE_URL = 'http://edge-node:9081';
const RULE_ID = 'flow-1';

let flowFixture: FlowRow | null;
let nodeFixture: Record<string, unknown> | null;
let engineStatuses: number[];
const callOrder: string[] = [];

function buildFlowRow(overrides?: Partial<FlowRow>): FlowRow {
  return {
    id: 'flow-1',
    name: 'Line monitor',
    description: null,
    target_node_id: 'node-1',
    created_by: 'user-1',
    created_at: FIXED_DATE,
    updated_at: FIXED_DATE,
    ...overrides,
  };
}

function buildNodeRow() {
  return {
    id: 'node-1',
    name: 'edge-node',
    base_url: BASE_URL,
    description: null,
    authorization_encrypted: null,
    is_default: true,
    status: 'ONLINE',
    version: '2.4.1',
    capabilities: {},
    last_checked_at: null,
    last_error: null,
    created_at: FIXED_DATE,
    updated_at: FIXED_DATE,
  };
}

function engineResponse(status: number): Response {
  return new Response(status === 404 ? 'not found' : 'ok', { status });
}

const mockFetch = jest.fn();

function deleteDeployRequest(id = 'flow-1', origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/flows/${id}/deploy`, {
    method: 'DELETE',
    headers: { origin },
  });
}

function deleteFlowRequest(id = 'flow-1', origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/flows/${id}`, {
    method: 'DELETE',
    headers: { origin },
  });
}

function routeParams(id = 'flow-1') {
  return { params: Promise.resolve({ id }) };
}

function engineCalls() {
  return mockFetch.mock.calls.map((call) => ({
    url: String(call[0]),
    method: (call[1] as RequestInit | undefined)?.method,
  }));
}

function auditActions() {
  return mockedAudit.mock.calls.map((call) => call[0]);
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedAudit.mockReset();
  mockedQuery.mockReset();
  mockedAssertDestination.mockReset();
  mockedAssertDestination.mockResolvedValue(undefined);
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  callOrder.length = 0;

  flowFixture = buildFlowRow();
  nodeFixture = buildNodeRow();
  engineStatuses = [200, 200];

  mockFetch.mockImplementation(async () => {
    callOrder.push('engine');
    const status = engineStatuses.length > 0 ? engineStatuses.shift()! : 200;
    return engineResponse(status);
  });

  mockedQuery.mockImplementation(async (text, values) => {
    const sql = String(text);
    if (sql.startsWith('DELETE FROM flows')) {
      callOrder.push('delete-row');
      expect(values).toEqual(['flow-1']);
      return { rows: [], rowCount: flowFixture ? 1 : 0 } as unknown as Awaited<
        ReturnType<typeof query>
      >;
    }
    if (sql.includes('FROM flows')) {
      return { rows: flowFixture ? [flowFixture] : [] } as unknown as Awaited<
        ReturnType<typeof query>
      >;
    }
    if (sql.includes('FROM managed_nodes')) {
      return { rows: nodeFixture ? [nodeFixture] : [] } as unknown as Awaited<
        ReturnType<typeof query>
      >;
    }
    return { rows: [] } as unknown as Awaited<ReturnType<typeof query>>;
  });
});

describe('DELETE /api/flows/:id/deploy', () => {
  it('rejects cross-origin requests before authentication', async () => {
    const response = await DELETE_DEPLOY(
      deleteDeployRequest('flow-1', 'https://evil.test'),
      routeParams(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed' },
    });
    expect(mockedGetUser).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated requests without touching the engine', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await DELETE_DEPLOY(deleteDeployRequest(), routeParams());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing flow without touching the engine', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    flowFixture = null;

    const response = await DELETE_DEPLOY(
      deleteDeployRequest('missing'),
      routeParams('missing'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('stops and removes the rule on the target', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await DELETE_DEPLOY(deleteDeployRequest(), routeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      undeployed: true,
      targetNodeId: 'node-1',
      ruleId: RULE_ID,
    });
    // Both engine calls were made, stop first then delete.
    expect(engineCalls()).toEqual([
      { url: `${BASE_URL}/rules/${RULE_ID}/stop`, method: 'POST' },
      { url: `${BASE_URL}/rules/${RULE_ID}`, method: 'DELETE' },
    ]);
    // Undeploy leaves the flow row, draft, revisions and deployments intact.
    for (const call of mockedQuery.mock.calls) {
      const sql = String(call[0]);
      expect(sql).not.toContain('DELETE');
      expect(sql).not.toContain('flow_drafts');
      expect(sql).not.toContain('flow_revisions');
      expect(sql).not.toContain('flow_deployments');
    }
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(auditActions()[0]).toMatchObject({
      actorId: 'user-1',
      action: 'flow.undeploy',
      resourceType: 'flow',
      resourceId: 'flow-1',
      success: true,
      nodeId: 'node-1',
    });
    expect(auditActions()[0]?.metadata).toEqual({
      targetNodeId: 'node-1',
      ruleId: RULE_ID,
      undeployed: true,
    });
  });

  it('succeeds on a flow that was never deployed without touching the engine', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    flowFixture = buildFlowRow({ target_node_id: null });

    const response = await DELETE_DEPLOY(deleteDeployRequest(), routeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      undeployed: false,
      targetNodeId: null,
      ruleId: RULE_ID,
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(auditActions()[0]).toMatchObject({
      action: 'flow.undeploy',
      resourceId: 'flow-1',
      success: true,
    });
  });

  it('succeeds when the engine no longer has the rule (idempotent)', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    engineStatuses = [404, 404];

    const response = await DELETE_DEPLOY(deleteDeployRequest(), routeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      undeployed: true,
      targetNodeId: 'node-1',
      ruleId: RULE_ID,
    });
    expect(engineCalls()).toHaveLength(2);
  });

  it('returns a server-safe error when the engine delete fails', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    engineStatuses = [200, 500];

    const response = await DELETE_DEPLOY(deleteDeployRequest(), routeParams());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'EKRULE_DELETE_FAILED',
        message: 'eKuiper rule delete returned HTTP 500: ok',
      },
    });
  });
});

describe('DELETE /api/flows/:id', () => {
  it('rejects cross-origin requests before authentication', async () => {
    const response = await DELETE_FLOW(
      deleteFlowRequest('flow-1', 'https://evil.test'),
      routeParams(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed' },
    });
    expect(mockedGetUser).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated requests without deleting', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await DELETE_FLOW(deleteFlowRequest(), routeParams());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing flow without deleting', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    flowFixture = null;

    const response = await DELETE_FLOW(
      deleteFlowRequest('missing'),
      routeParams('missing'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(callOrder).not.toContain('delete-row');
  });

  it('undeploys first and then removes the flow row', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await DELETE_FLOW(deleteFlowRequest(), routeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    // The engine stop + delete ran before the flow row delete.
    expect(engineCalls()).toEqual([
      { url: `${BASE_URL}/rules/${RULE_ID}/stop`, method: 'POST' },
      { url: `${BASE_URL}/rules/${RULE_ID}`, method: 'DELETE' },
    ]);
    expect(callOrder).toEqual(['engine', 'engine', 'delete-row']);
    const deleteCall = mockedQuery.mock.calls.find((call) =>
      String(call[0]).startsWith('DELETE FROM flows'),
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall?.[0]).toContain('DELETE FROM flows WHERE id = $1');
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(auditActions()[0]).toMatchObject({
      actorId: 'user-1',
      action: 'flow.delete',
      resourceType: 'flow',
      resourceId: 'flow-1',
      success: true,
    });
  });

  it('succeeds on an undeployed flow without touching the engine', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    flowFixture = buildFlowRow({ target_node_id: null });

    const response = await DELETE_FLOW(deleteFlowRequest(), routeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(callOrder).toEqual(['delete-row']);
  });

  it('succeeds when the engine rule is already gone and still deletes the row', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    engineStatuses = [404, 404];

    const response = await DELETE_FLOW(deleteFlowRequest(), routeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(engineCalls()).toHaveLength(2);
    expect(callOrder).toEqual(['engine', 'engine', 'delete-row']);
  });
});
