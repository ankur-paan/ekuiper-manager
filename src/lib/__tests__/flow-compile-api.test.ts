import { NextRequest } from 'next/server';
import { POST } from '@/app/api/flows/[id]/compile/route';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { query } from '@/lib/db';
import { createRuntimeId } from '@/lib/flows/compiler/runtime-id';
import { FLOW_COMPILER_VERSION } from '@/lib/flows/compiler/types';
import { canonicalJson } from '@/lib/flows/hashing/canonical-json';
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

function buildDraftRow(spec?: FlowSpec, layout?: FlowLayout): FlowDraftRow {
  const finalSpec = spec ?? buildValidSpec();
  const finalLayout = layout ?? buildLayout();
  return {
    flow_id: 'flow-1',
    semantic_document: finalSpec,
    layout_document: finalLayout,
    semantic_hash: 'semantic-hash',
    layout_hash: 'layout-hash',
    updated_by: 'user-1',
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
  };
}

function queryResult<T extends QueryResultRow>(rows: T[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<T>>>;
}

function postRequest(id = 'flow-1', origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/flows/${id}/compile`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
  });
}

function routeParams(id = 'flow-1') {
  return { params: Promise.resolve({ id }) };
}

function mockValidFlow() {
  mockedQuery.mockResolvedValueOnce(queryResult([buildFlowRow()]));
  mockedQuery.mockResolvedValueOnce(queryResult([buildDraftRow()]));
  mockedQuery.mockResolvedValueOnce(queryResult([buildNodeRow()]));
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedQuery.mockReset();
  jest.restoreAllMocks();
});

describe('POST /api/flows/:id/compile', () => {
  it('rejects cross-origin requests before authentication', async () => {
    const response = await POST(
      postRequest('flow-1', 'https://evil.test'),
      routeParams(),
    );

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
    expect(mockedQuery.mock.calls[0]?.[0]).toContain('FROM flows');
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
    expect(mockedQuery.mock.calls[1]?.[0]).toContain('FROM flow_drafts');
  });

  it('compiles the stored draft without touching eKuiper or writing rows', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    mockedGetUser.mockResolvedValueOnce(actor);
    mockValidFlow();

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.valid).toBe(true);
    expect(payload.diagnostics).toEqual([]);
    expect(payload.artifact.compilerVersion).toBe(FLOW_COMPILER_VERSION);
    expect(payload.artifact.ruleId).toBe('flow-1');

    const sourceRuntimeId = createRuntimeId('source', 'node-source-1');
    const sinkRuntimeId = createRuntimeId('sink', 'node-sink-1');
    expect(payload.artifact.runtimeNodeMap).toEqual({
      'node-source-1': sourceRuntimeId,
      'node-sink-1': sinkRuntimeId,
    });

    // Never contacts eKuiper: compile is side-effect free with respect to
    // the runtime (no create/update rule call).
    expect(fetchSpy).not.toHaveBeenCalled();
    // Only reads: flow row, draft row, managed-node row. No deployment
    // persistence (no INSERT/UPDATE/DELETE of any kind).
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    for (const call of mockedQuery.mock.calls) {
      expect(String(call[0]).trimStart().toUpperCase().startsWith('SELECT')).toBe(true);
    }
  });

  it('excludes layout from the returned ruleDefinition', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockValidFlow();

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.valid).toBe(true);
    expect('layout' in payload.artifact.ruleDefinition).toBe(false);
    expect('layout' in payload.artifact).toBe(false);
    const definitionJson = JSON.stringify(payload.artifact.ruleDefinition);
    expect(definitionJson).not.toContain('viewport');
    expect(definitionJson).not.toContain('"x"');
    // Graph envelope only: audited RuleGraph nodes + topo.
    expect(Object.keys(payload.artifact.ruleDefinition)).toEqual(['graph']);
    expect(Object.keys(payload.artifact.ruleDefinition.graph).sort()).toEqual([
      'nodes',
      'topo',
    ]);
  });

  it('returns byte-identical canonical rule definitions for the same fixture', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockValidFlow();
    const first = await POST(postRequest(), routeParams());
    const firstPayload = await first.json();

    mockedGetUser.mockResolvedValueOnce(actor);
    mockValidFlow();
    const second = await POST(postRequest(), routeParams());
    const secondPayload = await second.json();

    expect(firstPayload.valid).toBe(true);
    expect(secondPayload.valid).toBe(true);
    const normalize = (value: unknown) =>
      JSON.parse(JSON.stringify(value)) as unknown;
    expect(canonicalJson(normalize(secondPayload.artifact.ruleDefinition))).toBe(
      canonicalJson(normalize(firstPayload.artifact.ruleDefinition)),
    );
    expect(canonicalJson(normalize(secondPayload.artifact))).toBe(
      canonicalJson(normalize(firstPayload.artifact)),
    );
  });

  it('returns structured diagnostics with HTTP success for an invalid draft', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
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
    expect(payload.artifact).toBeUndefined();
    // Validation failure also makes no runtime mutation.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
