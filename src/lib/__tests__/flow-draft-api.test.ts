import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/flows/[id]/draft/route';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { query } from '@/lib/db';
import { hashFlowLayout, hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import type { FlowRow, FlowDraftRow } from '@/lib/flows/persistence/types';
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
    target_node_id: null,
    created_by: 'user-1',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function buildSpec(): FlowSpec {
  return {
    nodes: [
      {
        id: 'node-source-1',
        type: 'mqtt-source',
        typeVersion: 1,
        name: 'Source',
        config: { topic: 'sensors/temperature' },
      },
      {
        id: 'node-sink-1',
        type: 'mqtt-sink',
        typeVersion: 1,
        name: 'Sink',
        config: { topic: 'alerts/output' },
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

function buildDraftRow(overrides?: Partial<FlowDraftRow>): FlowDraftRow {
  const spec = buildSpec();
  const layout = buildLayout();
  return {
    flow_id: 'flow-1',
    semantic_document: spec,
    layout_document: layout,
    semantic_hash: hashFlowSemantic(spec),
    layout_hash: hashFlowLayout(layout),
    updated_by: 'user-1',
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function queryResult<T extends QueryResultRow>(rows: T[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<T>>>;
}

function getRequest(id = 'flow-1') {
  return new NextRequest(`http://localhost/api/flows/${id}/draft`);
}

function putRequest(id: string, body: unknown, origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/flows/${id}/draft`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
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

describe('GET /api/flows/:id/draft', () => {
  it('returns 401 for unauthenticated requests without querying', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await GET(getRequest(), routeParams());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing parent flow', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    const response = await GET(getRequest('missing'), routeParams('missing'));

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

    const response = await GET(getRequest(), routeParams());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_DRAFT_NOT_FOUND', message: 'Flow draft not found' },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[1][0]).toContain('FROM flow_drafts');
  });

  it('returns the current draft with server-computed hashes', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow()]));

    const response = await GET(getRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.draft).toMatchObject({
      flowId: 'flow-1',
      semanticHash: hashFlowSemantic(buildSpec()),
      layoutHash: hashFlowLayout(buildLayout()),
    });
    expect(payload.draft.semanticDocument).toEqual(buildSpec());
    expect(payload.draft.layoutDocument).toEqual(buildLayout());
  });
});

describe('PUT /api/flows/:id/draft', () => {
  it('rejects cross-origin mutations before authentication', async () => {
    const response = await PUT(
      putRequest('flow-1', { spec: buildSpec(), layout: buildLayout() }, 'https://evil.test'),
      routeParams(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed' },
    });
    expect(mockedGetUser).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await PUT(
      putRequest('flow-1', { spec: buildSpec(), layout: buildLayout() }),
      routeParams(),
    );

    expect(response.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing parent flow without persisting', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    const response = await PUT(
      putRequest('missing', { spec: buildSpec(), layout: buildLayout() }),
      routeParams('missing'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    for (const call of mockedQuery.mock.calls) {
      expect(String(call[0])).not.toContain('flow_drafts');
    }
  });

  it('saves a valid draft and returns server-generated hashes', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const spec = buildSpec();
    const layout = buildLayout();
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow()]));

    const response = await PUT(
      putRequest('flow-1', { spec, layout }),
      routeParams(),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.draft).toMatchObject({
      flowId: 'flow-1',
      semanticHash: hashFlowSemantic(spec),
      layoutHash: hashFlowLayout(layout),
    });

    expect(mockedQuery).toHaveBeenCalledTimes(2);
    const [text, values] = mockedQuery.mock.calls[1];
    expect(text).toContain('INSERT INTO flow_drafts');
    expect(text).toContain('ON CONFLICT (flow_id)');
    expect(values?.[0]).toBe('flow-1');
    expect(JSON.parse(values?.[1] as string)).toEqual(spec);
    expect(JSON.parse(values?.[2] as string)).toEqual(layout);
    expect(values?.[3]).toBe(hashFlowSemantic(spec));
    expect(values?.[4]).toBe(hashFlowLayout(layout));
    expect(values?.[5]).toBe('user-1');

    // PUT persists via Manager Postgres only and never calls eKuiper.
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const call of mockedQuery.mock.calls) {
      expect(String(call[0]).toLowerCase()).not.toContain('ekuiper');
    }
  });

  it('ignores caller-supplied hashes and persists server-computed ones', async () => {
    const spec = buildSpec();
    const layout = buildLayout();
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow()]));

    const response = await PUT(
      putRequest('flow-1', {
        spec,
        layout,
        semanticHash: 'forged',
        layoutHash: 'forged',
      }),
      routeParams(),
    );

    expect(response.status).toBe(200);
    const [, values] = mockedQuery.mock.calls[1];
    expect(values?.[3]).toBe(hashFlowSemantic(spec));
    expect(values?.[4]).toBe(hashFlowLayout(layout));
  });

  it.each([
    ['missing spec', { layout: buildLayout() }, 'Flow draft spec is required'],
    ['missing layout', { spec: buildSpec() }, 'Flow draft layout is required'],
  ])('rejects %s with 400 without persisting', async (_label, body, message) => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));

    const response = await PUT(putRequest('flow-1', body), routeParams());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_FLOW_DRAFT', message },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(String(mockedQuery.mock.calls[0][0])).not.toContain('flow_drafts');
  });

  it('rejects a malformed spec shape with 400 without persisting', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));

    const response = await PUT(
      putRequest('flow-1', {
        spec: { nodes: {}, edges: 'edge-1' },
        layout: buildLayout(),
      }),
      routeParams(),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('INVALID_FLOW_DRAFT');
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(String(mockedQuery.mock.calls[0][0])).not.toContain('flow_drafts');
  });

  it('rejects a malformed layout shape with 400 without persisting', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));

    const response = await PUT(
      putRequest('flow-1', {
        spec: buildSpec(),
        layout: { nodes: { 'node-source-1': { x: 'far', y: 0 } } },
      }),
      routeParams(),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('INVALID_FLOW_DRAFT');
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(String(mockedQuery.mock.calls[0][0])).not.toContain('flow_drafts');
  });

  it('rejects malformed JSON with 400 without persisting', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
    const request = new NextRequest('http://localhost/api/flows/flow-1/draft', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost',
      },
      body: '{not-json',
    });

    const response = await PUT(request, routeParams());

    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
