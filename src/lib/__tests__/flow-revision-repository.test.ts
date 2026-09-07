import { query, withTransaction } from '@/lib/db';
import type { PoolClient, QueryResultRow } from 'pg';
import { hashFlowLayout, hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import {
  createRevisionFromCurrentDraft,
  getRevision,
  listRevisions,
  mapFlowRevisionRow,
  type FlowRevisionRow,
} from '@/lib/flows/persistence/flow-revision-repository';
import type { FlowDraftRow } from '@/lib/flows/persistence/types';

jest.mock('@/lib/db', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
const mockedQuery = jest.mocked(query);
const mockedWithTransaction = jest.mocked(withTransaction);

function buildSpec(topic: string): FlowSpec {
  return {
    nodes: [
      {
        id: 'node-source-1',
        type: 'mqtt-source',
        typeVersion: 1,
        name: 'Source',
        config: { topic },
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

function buildDraftRow(): FlowDraftRow {
  const spec = buildSpec('sensors/temperature');
  const layout = buildLayout();
  return {
    flow_id: 'flow-1',
    semantic_document: spec,
    layout_document: layout,
    semantic_hash: hashFlowSemantic(spec),
    layout_hash: hashFlowLayout(layout),
    updated_by: 'user-1',
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
  };
}

function buildRevisionRow(revisionNumber: number): FlowRevisionRow {
  const draft = buildDraftRow();
  return {
    id: `revision-${revisionNumber}`,
    flow_id: 'flow-1',
    revision_number: revisionNumber,
    semantic_document: draft.semantic_document,
    layout_document: draft.layout_document,
    semantic_hash: draft.semantic_hash,
    layout_hash: draft.layout_hash,
    compiler_version: null,
    created_by: 'user-1',
    created_at: new Date('2026-01-03T00:00:00.000Z'),
    message: null,
  };
}

function queryResult<T extends QueryResultRow>(rows: T[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<T>>>;
}

/** Minimal fake transaction client: only `query` is exercised by the repository. */
function fakeClient(queryMock: jest.Mock) {
  return { query: queryMock } as unknown as PoolClient;
}

function runInTransactionWith(clientQuery: jest.Mock) {
  mockedWithTransaction.mockImplementation(<T>(operation: (client: PoolClient) => Promise<T>) => {
    return operation(fakeClient(clientQuery));
  });
}

/**
 * Drives one `createRevisionFromCurrentDraft` call through a fake
 * transaction, answering the internal SELECTs with the given
 * `maxRevisionNumber` (null = no revisions yet) and echoing the INSERT
 * back as the stored row.
 */
async function createWithMaxRevision(maxRevisionNumber: number | null) {
  const draft = buildDraftRow();
  const clientQuery = jest.fn();
  clientQuery
    .mockResolvedValueOnce(queryResult([{ id: 'flow-1' }]))
    .mockResolvedValueOnce(queryResult<FlowDraftRow>([draft]))
    .mockResolvedValueOnce(queryResult([{ max_revision_number: maxRevisionNumber }]))
    .mockImplementation(async (text: string, values: unknown[]) =>
      queryResult<FlowRevisionRow>([
        {
          id: values[0] as string,
          flow_id: values[1] as string,
          revision_number: values[2] as number,
          semantic_document: JSON.parse(values[3] as string) as FlowSpec,
          layout_document: JSON.parse(values[4] as string) as FlowLayout,
          semantic_hash: values[5] as string,
          layout_hash: values[6] as string,
          compiler_version: null,
          created_by: values[7] as string | null,
          created_at: new Date('2026-01-03T00:00:00.000Z'),
          message: values[8] as string | null,
        },
      ]),
    );
  runInTransactionWith(clientQuery);
  const record = await createRevisionFromCurrentDraft('flow-1', 'user-1');
  return { record, clientQuery };
}

beforeEach(() => {
  mockedQuery.mockReset();
  mockedWithTransaction.mockReset();
});

describe('flow revision repository', () => {
  it('numbers consecutive revisions deterministically inside one transaction', async () => {
    const first = await createWithMaxRevision(null);
    const second = await createWithMaxRevision(1);

    expect(first.record.revisionNumber).toBe(1);
    expect(second.record.revisionNumber).toBe(2);

    // Every snapshot runs inside a transaction.
    expect(mockedWithTransaction).toHaveBeenCalledTimes(2);

    const { clientQuery } = first;
    // Four statements per snapshot: flow lock, draft read, max read, insert.
    expect(clientQuery).toHaveBeenCalledTimes(4);

    const [lockText, lockValues] = clientQuery.mock.calls[0];
    expect(lockText).toContain('FROM flows');
    expect(lockText).toMatch(/FOR UPDATE/);
    expect(lockValues).toEqual(['flow-1']);

    const [draftText, draftValues] = clientQuery.mock.calls[1];
    expect(draftText).toContain('FROM flow_drafts');
    expect(draftValues).toEqual(['flow-1']);

    const [maxText, maxValues] = clientQuery.mock.calls[2];
    expect(maxText).toContain('MAX(revision_number)');
    expect(maxText).toContain('FROM flow_revisions');
    expect(maxValues).toEqual(['flow-1']);

    const [insertText, insertValues] = clientQuery.mock.calls[3];
    expect(insertText).toContain('INSERT INTO flow_revisions');
    expect(insertText).toContain('RETURNING');
    expect(insertText).not.toContain('${');
    // Snapshot copies the server draft documents/hashes verbatim.
    const draft = buildDraftRow();
    expect(JSON.parse(insertValues[3] as string)).toEqual(draft.semantic_document);
    expect(JSON.parse(insertValues[4] as string)).toEqual(draft.layout_document);
    expect(insertValues[5]).toBe(draft.semantic_hash);
    expect(insertValues[6]).toBe(draft.layout_hash);
    expect(insertValues[2]).toBe(1);
    expect(insertValues[7]).toBe('user-1');
  });

  it('persists the optional snapshot message', async () => {
    const draft = buildDraftRow();
    const clientQuery = jest.fn();
    clientQuery
      .mockResolvedValueOnce(queryResult([{ id: 'flow-1' }]))
      .mockResolvedValueOnce(queryResult<FlowDraftRow>([draft]))
      .mockResolvedValueOnce(queryResult([{ max_revision_number: 2 }]))
      .mockResolvedValueOnce(queryResult<FlowRevisionRow>([{ ...buildRevisionRow(3), message: 'pre-deploy' }]));
    runInTransactionWith(clientQuery);

    const record = await createRevisionFromCurrentDraft('flow-1', 'user-1', 'pre-deploy');

    expect(record.revisionNumber).toBe(3);
    expect(record.message).toBe('pre-deploy');
    const [, insertValues] = clientQuery.mock.calls[3];
    expect(insertValues[2]).toBe(3);
    expect(insertValues[8]).toBe('pre-deploy');
  });

  it('lists revisions newest-first', async () => {
    mockedQuery.mockResolvedValueOnce(
      queryResult<FlowRevisionRow>([buildRevisionRow(3), buildRevisionRow(2), buildRevisionRow(1)]),
    );

    const records = await listRevisions('flow-1');

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('FROM flow_revisions');
    expect(text).toContain('ORDER BY revision_number DESC');
    expect(values).toEqual(['flow-1']);
    // Explicit newest-first ordering assertion.
    expect(records.map((record) => record.revisionNumber)).toEqual([3, 2, 1]);
  });

  it('reads one revision and returns null when missing', async () => {
    mockedQuery
      .mockResolvedValueOnce(queryResult<FlowRevisionRow>([buildRevisionRow(2)]))
      .mockResolvedValueOnce(queryResult<FlowRevisionRow>([]));

    const found = await getRevision('flow-1', 2);
    expect(found?.revisionNumber).toBe(2);
    expect(found?.flowId).toBe('flow-1');
    expect(found?.compilerVersion).toBeNull();

    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('revision_number = $2');
    expect(values).toEqual(['flow-1', 2]);

    await expect(getRevision('flow-1', 9)).resolves.toBeNull();
  });

  it('exposes no update method: revisions are immutable', async () => {
    const moduleExports = await import('@/lib/flows/persistence/flow-revision-repository');
    expect('updateRevision' in moduleExports).toBe(false);
    expect('deleteRevision' in moduleExports).toBe(false);
    expect(mapFlowRevisionRow(buildRevisionRow(1)).revisionNumber).toBe(1);
  });

  it('rejects a missing flow or draft without inserting', async () => {
    const missingFlowQuery = jest.fn().mockResolvedValueOnce(queryResult([]));
    runInTransactionWith(missingFlowQuery);
    await expect(createRevisionFromCurrentDraft('missing', 'user-1')).rejects.toThrow(
      'Flow not found',
    );
    expect(missingFlowQuery).toHaveBeenCalledTimes(1);

    mockedWithTransaction.mockReset();
    const missingDraftQuery = jest
      .fn()
      .mockResolvedValueOnce(queryResult([{ id: 'flow-1' }]))
      .mockResolvedValueOnce(queryResult<FlowDraftRow>([]));
    runInTransactionWith(missingDraftQuery);
    await expect(createRevisionFromCurrentDraft('flow-1', 'user-1')).rejects.toThrow(
      'No draft exists for this flow',
    );
    expect(missingDraftQuery).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid input without querying', async () => {
    await expect(createRevisionFromCurrentDraft('   ', 'user-1')).rejects.toThrow(
      'Flow id is required',
    );
    await expect(createRevisionFromCurrentDraft('flow-1', 'user-1', 42)).rejects.toThrow(
      'message must be a string',
    );
    await expect(listRevisions('')).rejects.toThrow('Flow id is required');
    await expect(getRevision('flow-1', 0)).rejects.toThrow(
      'Revision number must be a positive integer',
    );
    await expect(getRevision('flow-1', 1.5)).rejects.toThrow(
      'Revision number must be a positive integer',
    );
    await expect(getRevision('flow-1', '2')).rejects.toThrow(
      'Revision number must be a positive integer',
    );
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedWithTransaction).not.toHaveBeenCalled();
  });
});
