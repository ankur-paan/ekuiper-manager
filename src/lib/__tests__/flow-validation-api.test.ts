import { NextRequest } from 'next/server';
import { POST } from '@/app/api/flows/[id]/validate/route';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { query } from '@/lib/db';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import type { FlowDraftRow, FlowRow } from '@/lib/flows/persistence/types';
import type { QueryResultRow } from 'pg';

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
    target_node_id: 'node-1',
    created_by: 'user-1',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function buildNodeRow(overrides?: Record<string, unknown>) {
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
    ...overrides,
  };
}

function buildValidSpec(): FlowSpec {
  return {
    nodes: [
      {
        id: 'node-source-1',
        type: 'memory-source',
        typeVersion: 1,
        name: 'Source',
        config: { topic: 'raw-events' },
      },
      {
        id: 'node-sink-1',
        type: 'memory-sink',
        typeVersion: 1,
        name: 'Sink',
        config: { topic: 'processed-events' },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        sourceNodeId: 'node-source-1',
        sourcePortId: 'out',
        targetNodeId: 'node-sink-1',
        targetPortId: 'in',
      },
    ],
  };
}

function buildLayout(): FlowLayout {
  return {
    nodes: {
      'node-source-1': { x: 0, y: 0 },
      'node-sink-1': { x: 320, y: 120 },
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function buildDraftRow(spec?: FlowSpec): FlowDraftRow {
  const finalSpec = spec ?? buildValidSpec();
  const layout = buildLayout();
  return {
    flow_id: 'flow-1',
    semantic_document: finalSpec,
    layout_document: layout,
    semantic_hash: 'semantic-hash',
    layout_hash: 'layout-hash',
    updated_by: 'user-1',
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
  };
}

function queryResult<T extends QueryResultRow>(rows: T[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<T>>>;
}

function postRequest(id = 'flow-1', body?: unknown, origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/flows/${id}/validate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

function routeParams(id = 'flow-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedQuery.mockReset();
  jest.restoreAllMocks();
});

describe('POST /api/flows/:id/validate', () => {
  it('rejects cross-origin requests before authentication', async () => {
    const response = await POST(postRequest('flow-1', undefined, 'https://evil.test'), routeParams());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed' },
    });
    expect(mockedGetUser).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated requests without querying', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing flow', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    const response = await POST(postRequest('missing'), routeParams('missing'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0][0]).toContain('FROM flows');
  });

  it('returns 404 when the flow exists but has no draft', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_DRAFT_NOT_FOUND', message: 'Flow draft not found' },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[1][0]).toContain('FROM flow_drafts');
  });

  it('returns valid=true for a valid current draft without calling eKuiper', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildNodeRow()]));

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ valid: true, diagnostics: [] });
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    expect(mockedQuery.mock.calls[2][0]).toContain('FROM managed_nodes');
    // Server-side draft validation only; never contacts eKuiper.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns valid=true against the audited baseline when the flow has no target', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(
      queryResult([buildFlowRow({ target_node_id: null })]),
    );
    mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow()]));

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ valid: true, diagnostics: [] });
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    for (const call of mockedQuery.mock.calls) {
      expect(String(call[0])).not.toContain('managed_nodes');
    }
  });

  it('returns structured diagnostics for an invalid draft with HTTP success', async () => {
    const invalidSpec: FlowSpec = {
      nodes: [
        {
          id: 'node-ghost-1',
          type: 'no-such-node',
          typeVersion: 1,
          name: 'Ghost',
          config: {},
        },
      ],
      edges: [],
    };
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow(invalidSpec)]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildNodeRow()]));

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.valid).toBe(false);
    expect(payload.diagnostics.length).toBeGreaterThan(0);
    expect(payload.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'FLOW_UNKNOWN_NODE_TYPE',
        severity: 'error',
        nodeId: 'node-ghost-1',
      }),
    );
  });

  it('reports capability diagnostics for a target below the audited baseline', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow()]));
    mockedQuery.mockResolvedValueOnce(
      queryResult([buildNodeRow({ version: '2.0.0' })]),
    );

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.valid).toBe(false);
    expect(payload.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'FLOW_CAPABILITY_UNAVAILABLE', severity: 'error' }),
    );
  });

  it('validates the stored draft and ignores a client-supplied document', async () => {
    const invalidSpec: FlowSpec = {
      nodes: [
        {
          id: 'node-source-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Source',
          config: {},
        },
        {
          id: 'node-sink-1',
          type: 'memory-sink',
          typeVersion: 1,
          name: 'Sink',
          config: { topic: 'processed-events' },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sink-1',
          targetPortId: 'in',
        },
      ],
    };
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow(invalidSpec)]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildNodeRow()]));

    // The stored draft is missing a required property; the client body
    // claims a fully valid document. The authoritative verdict must reflect
    // the stored draft, not the body.
    const response = await POST(
      postRequest('flow-1', {
        spec: buildValidSpec(),
        layout: buildLayout(),
      }),
      routeParams(),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.valid).toBe(false);
    expect(payload.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'FLOW_REQUIRED_PROPERTY_MISSING',
        severity: 'error',
        nodeId: 'node-source-1',
      }),
    );
  });
});
