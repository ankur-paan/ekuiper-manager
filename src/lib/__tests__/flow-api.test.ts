import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/flows/route';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { query } from '@/lib/db';
import type { QueryResultRow } from 'pg';
import type { FlowRow } from '@/lib/flows/persistence/types';

jest.mock('@/lib/auth/session', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

const mockedGetUser = jest.mocked(getAuthenticatedUser);
const mockedQuery = jest.mocked(query);

const actor = {
  id: 'user-1',
  username: 'operator',
  role: 'USER' as const,
  mustChangePassword: false,
};

function buildFlowRow(overrides?: Partial<FlowRow>): FlowRow {
  return {
    id: 'flow-1',
    name: 'Line monitor',
    description: null,
    target_node_id: null,
    created_by: 'user-1',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function buildNodeRow() {
  return {
    id: 'node-1',
    name: 'edge-node',
    base_url: 'http://edge-node:9081',
    description: null,
    authorization_encrypted: null,
    is_default: true,
    status: 'ONLINE',
    version: '2.4.1',
    capabilities: {},
    last_checked_at: null,
    last_error: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function queryResult<T extends QueryResultRow>(rows: T[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<T>>>;
}

function getRequest(url = 'http://localhost/api/flows') {
  return new NextRequest(url);
}

function postRequest(body: unknown, origin = 'http://localhost') {
  return new NextRequest('http://localhost/api/flows', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedQuery.mockReset();
});

describe('GET /api/flows', () => {
  it('returns 401 for unauthenticated requests without querying', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('returns visible flows for an authenticated user', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(
      queryResult([buildFlowRow(), buildFlowRow({ id: 'flow-2', name: 'Second' })]),
    );

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.flows).toHaveLength(2);
    expect(payload.flows[0]).toMatchObject({ id: 'flow-1', name: 'Line monitor' });
  });
});

describe('POST /api/flows', () => {
  it('rejects cross-origin mutations before authentication', async () => {
    const response = await POST(postRequest({ name: 'Flow' }, 'https://evil.test'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed' },
    });
    expect(mockedGetUser).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await POST(postRequest({ name: 'Flow' }));

    expect(response.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '   ', 42])('rejects invalid name %s with 400', async (name) => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(postRequest({ name }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_FLOW_NAME', message: 'Flow name is required' },
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('rejects a non-string description with 400', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(postRequest({ name: 'Flow', description: 42 }));

    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('creates a flow with created_by from the session, ignoring browser values', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow({ name: 'Trimmed' })]));

    const response = await POST(
      postRequest({
        name: '  Trimmed  ',
        description: 'Line A',
        createdBy: 'attacker-id',
        created_by: 'attacker-id',
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.flow).toMatchObject({ id: 'flow-1', name: 'Trimmed' });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('INSERT INTO flows');
    expect(text).not.toContain('flow_drafts');
    expect(values?.slice(1)).toEqual(['Trimmed', 'Line A', null, 'user-1']);
  });

  it('validates a registered target node before creating', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildNodeRow()]));
    mockedQuery.mockResolvedValueOnce(
      queryResult([buildFlowRow({ name: 'With target', target_node_id: 'node-1' })]),
    );

    const response = await POST(postRequest({ name: 'With target', targetNodeId: 'node-1' }));

    expect(response.status).toBe(201);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[0][0]).toContain('FROM managed_nodes');
    expect(mockedQuery.mock.calls[0][1]).toEqual(['node-1']);
    const [, insertValues] = mockedQuery.mock.calls[1];
    expect(insertValues?.slice(1)).toEqual(['With target', null, 'node-1', 'user-1']);
  });

  it('returns 404 for an unknown target node without creating', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    const response = await POST(postRequest({ name: 'Flow', targetNodeId: 'missing-node' }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'NODE_NOT_FOUND', message: 'Target node not found' },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-string target node id with 400', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(postRequest({ name: 'Flow', targetNodeId: 42 }));

    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('treats a blank target node id as no target', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));

    const response = await POST(postRequest({ name: 'Flow', targetNodeId: '   ' }));

    expect(response.status).toBe(201);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text] = mockedQuery.mock.calls[0];
    expect(text).toContain('INSERT INTO flows');
  });
});
