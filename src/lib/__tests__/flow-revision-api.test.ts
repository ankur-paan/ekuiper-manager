import { NextRequest } from 'next/server';
import { GET as listRevisionsRoute } from '@/app/api/flows/[id]/revisions/route';
import { GET as getRevisionRoute } from '@/app/api/flows/[id]/revisions/[number]/route';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import {
  getRevision,
  listRevisions,
  type FlowRevisionRecord,
} from '@/lib/flows/persistence/flow-revision-repository';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';

jest.mock('@/lib/auth/session', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/flows/persistence/flow-repository', () => ({ getFlow: jest.fn() }));
jest.mock('@/lib/flows/persistence/flow-revision-repository', () => ({
  getRevision: jest.fn(),
  listRevisions: jest.fn(),
}));

const mockedGetUser = jest.mocked(getAuthenticatedUser);
const mockedGetFlow = jest.mocked(getFlow);
const mockedListRevisions = jest.mocked(listRevisions);
const mockedGetRevision = jest.mocked(getRevision);

const actor = {
  id: 'user-1',
  username: 'operator',
  role: 'USER' as const,
  mustChangePassword: false,
};

const flowRecord = {
  id: 'flow-1',
  name: 'Line monitor',
  description: null,
  targetNodeId: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

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

function buildRevisionRecord(revisionNumber: number): FlowRevisionRecord {
  return {
    id: `revision-${revisionNumber}`,
    flowId: 'flow-1',
    revisionNumber,
    semanticDocument: buildSpec(),
    layoutDocument: buildLayout(),
    semanticHash: `semantic-hash-${revisionNumber}`,
    layoutHash: `layout-hash-${revisionNumber}`,
    compilerVersion: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    message: null,
  };
}

function listRequest(id = 'flow-1') {
  return new NextRequest(`http://localhost/api/flows/${id}/revisions`);
}

function detailRequest(id = 'flow-1', revisionNumber = '2') {
  return new NextRequest(
    `http://localhost/api/flows/${id}/revisions/${revisionNumber}`,
  );
}

function listParams(id = 'flow-1') {
  return { params: Promise.resolve({ id }) };
}

function detailParams(id = 'flow-1', number = '2') {
  return { params: Promise.resolve({ id, number }) };
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedGetFlow.mockReset();
  mockedListRevisions.mockReset();
  mockedGetRevision.mockReset();
});

describe('GET /api/flows/:id/revisions', () => {
  it('returns 401 for unauthenticated requests without querying', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await listRevisionsRoute(listRequest(), listParams());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockedGetFlow).not.toHaveBeenCalled();
    expect(mockedListRevisions).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing flow without listing revisions', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(null);

    const response = await listRevisionsRoute(
      listRequest('missing'),
      listParams('missing'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(mockedListRevisions).not.toHaveBeenCalled();
  });

  it('lists revision metadata newest-first without snapshot documents', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(flowRecord);
    mockedListRevisions.mockResolvedValueOnce([
      buildRevisionRecord(2),
      buildRevisionRecord(1),
    ]);

    const response = await listRevisionsRoute(listRequest(), listParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.revisions.map((entry: { revisionNumber: number }) => entry.revisionNumber)).toEqual([
      2, 1,
    ]);
    for (const entry of payload.revisions) {
      expect(entry).toMatchObject({
        flowId: 'flow-1',
        semanticHash: `semantic-hash-${entry.revisionNumber}`,
        layoutHash: `layout-hash-${entry.revisionNumber}`,
        compilerVersion: null,
        createdBy: 'user-1',
        message: null,
      });
      expect(entry.id).toBe(`revision-${entry.revisionNumber}`);
      // Huge snapshot documents stay out of the list payload by default.
      expect(entry).not.toHaveProperty('semanticDocument');
      expect(entry).not.toHaveProperty('layoutDocument');
    }
    expect(mockedListRevisions).toHaveBeenCalledWith('flow-1');
    // No secret material is introduced beyond the stored Flow documents
    // (which hold config references only, by design).
    expect(JSON.stringify(payload)).not.toContain('semanticDocument');
    expect(JSON.stringify(payload)).not.toContain('authorization');
  });
});

describe('GET /api/flows/:id/revisions/:number', () => {
  it('returns 401 for unauthenticated requests without querying', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await getRevisionRoute(detailRequest(), detailParams());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockedGetFlow).not.toHaveBeenCalled();
    expect(mockedGetRevision).not.toHaveBeenCalled();
  });

  it.each([['0'], ['-1'], ['1.5'], ['abc'], [''], ['01']])(
    'rejects invalid revision number %p with 400',
    async (number) => {
      mockedGetUser.mockResolvedValueOnce(actor);

      const response = await getRevisionRoute(
        detailRequest('flow-1', number),
        detailParams('flow-1', number),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'INVALID_REVISION_NUMBER',
          message: 'Revision number must be a positive integer',
        },
      });
      expect(mockedGetFlow).not.toHaveBeenCalled();
      expect(mockedGetRevision).not.toHaveBeenCalled();
    },
  );

  it('returns 404 for a missing flow', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(null);

    const response = await getRevisionRoute(
      detailRequest('missing', '1'),
      detailParams('missing', '1'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(mockedGetRevision).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing revision', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(flowRecord);
    mockedGetRevision.mockResolvedValueOnce(null);

    const response = await getRevisionRoute(
      detailRequest('flow-1', '9'),
      detailParams('flow-1', '9'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_REVISION_NOT_FOUND', message: 'Flow revision not found' },
    });
    expect(mockedGetRevision).toHaveBeenCalledWith('flow-1', 9);
  });

  it('returns the semantic/layout snapshot for a known revision', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(flowRecord);
    mockedGetRevision.mockResolvedValueOnce(buildRevisionRecord(2));

    const response = await getRevisionRoute(detailRequest(), detailParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.revision).toMatchObject({
      id: 'revision-2',
      flowId: 'flow-1',
      revisionNumber: 2,
      semanticHash: 'semantic-hash-2',
      layoutHash: 'layout-hash-2',
      compilerVersion: null,
      createdBy: 'user-1',
      message: null,
    });
    expect(payload.revision.semanticDocument).toEqual(buildSpec());
    expect(payload.revision.layoutDocument).toEqual(buildLayout());
    expect(mockedGetRevision).toHaveBeenCalledWith('flow-1', 2);
    // Snapshots carry the stored Flow documents only; the route adds no
    // credential fields or secret values.
    expect(payload.revision).not.toHaveProperty('authorization');
    expect(JSON.stringify(payload)).not.toContain('authorization');
  });
});
