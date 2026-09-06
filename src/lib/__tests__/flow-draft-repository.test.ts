import { query } from '@/lib/db';
import { hashFlowLayout, hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import type { FlowDraftRow } from '@/lib/flows/persistence/types';
import { getFlowDraft, upsertFlowDraft } from '@/lib/flows/persistence/flow-draft-repository';

jest.mock('@/lib/db', () => ({ query: jest.fn() }));
const mockedQuery = jest.mocked(query);

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

function buildRow(overrides?: Partial<FlowDraftRow>): FlowDraftRow {
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

function queryResult(rows: FlowDraftRow[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<FlowDraftRow>>>;
}

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('flow draft repository', () => {
  it('upserts with parameterized SQL and server-computed hashes', async () => {
    const spec = buildSpec();
    const layout = buildLayout();
    mockedQuery.mockResolvedValueOnce(queryResult([buildRow()]));

    const draft = await upsertFlowDraft({
      flowId: 'flow-1',
      semanticDocument: spec,
      layoutDocument: layout,
      updatedBy: 'user-1',
    });

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('INSERT INTO flow_drafts');
    expect(text).toContain('ON CONFLICT (flow_id)');
    expect(text).toContain('RETURNING');
    expect(text).not.toContain('${');
    // All dynamic values are bound parameters, none interpolated.
    expect(values).toHaveLength(6);
    expect(values?.[0]).toBe('flow-1');
    // Persisted documents are spec-only and layout-only payloads.
    expect(JSON.parse(values?.[1] as string)).toEqual(spec);
    expect(JSON.parse(values?.[2] as string)).toEqual(layout);
    expect(JSON.parse(values?.[1] as string)).not.toHaveProperty('layout');
    expect(JSON.parse(values?.[1] as string)).not.toHaveProperty('viewport');
    expect(JSON.parse(values?.[2] as string)).not.toHaveProperty('edges');
    expect(JSON.parse(values?.[2] as string)).not.toHaveProperty('spec');
    // Server recomputes hashes; caller supplies none.
    expect(values?.[3]).toBe(hashFlowSemantic(spec));
    expect(values?.[4]).toBe(hashFlowLayout(layout));
    expect(values?.[5]).toBe('user-1');

    expect(draft).toEqual({
      flowId: 'flow-1',
      semanticDocument: spec,
      layoutDocument: layout,
      semanticHash: hashFlowSemantic(spec),
      layoutHash: hashFlowLayout(layout),
      updatedBy: 'user-1',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
  });

  it('ignores caller-supplied hashes and recomputes them server-side', async () => {
    const spec = buildSpec();
    const layout = buildLayout();
    mockedQuery.mockResolvedValueOnce(queryResult([buildRow()]));

    await upsertFlowDraft({
      flowId: 'flow-1',
      semanticDocument: spec,
      layoutDocument: layout,
      ...{ semanticHash: 'forged', layoutHash: 'forged' },
    });

    const [, values] = mockedQuery.mock.calls[0];
    expect(values?.[3]).toBe(hashFlowSemantic(spec));
    expect(values?.[4]).toBe(hashFlowLayout(layout));
    expect(values?.[3]).not.toBe('forged');
    expect(values?.[4]).not.toBe('forged');
  });

  it('changing only layout preserves the semantic hash', async () => {
    const spec = buildSpec();
    const before = buildLayout();
    const moved: FlowLayout = {
      ...before,
      nodes: {
        ...before.nodes,
        'node-source-1': { x: 240, y: 180 },
      },
    };
    mockedQuery
      .mockResolvedValueOnce(queryResult([buildRow({ layout_document: moved, layout_hash: hashFlowLayout(moved) })]))
      .mockResolvedValueOnce(
        queryResult([buildRow({ layout_document: moved, layout_hash: hashFlowLayout(moved) })]),
      );

    const upserted = await upsertFlowDraft({
      flowId: 'flow-1',
      semanticDocument: spec,
      layoutDocument: moved,
    });
    const fetched = await getFlowDraft('flow-1');

    expect(upserted.semanticHash).toBe(hashFlowSemantic(spec));
    expect(fetched?.semanticHash).toBe(hashFlowSemantic(spec));
    expect(upserted.layoutHash).toBe(hashFlowLayout(moved));
    expect(upserted.layoutHash).not.toBe(hashFlowLayout(before));

    const getCall = mockedQuery.mock.calls[1];
    expect(getCall[0]).toContain('FROM flow_drafts');
    expect(getCall[0]).toContain('WHERE flow_id = $1');
    expect(getCall[1]).toEqual(['flow-1']);
  });

  it('returns null for a missing draft', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    await expect(getFlowDraft('missing')).resolves.toBeNull();
  });

  it('rejects invalid input without querying', async () => {
    await expect(
      upsertFlowDraft({ flowId: '   ', semanticDocument: buildSpec(), layoutDocument: buildLayout() }),
    ).rejects.toThrow('Flow id is required');
    await expect(
      upsertFlowDraft({ flowId: 'flow-1', semanticDocument: null, layoutDocument: buildLayout() }),
    ).rejects.toThrow('Semantic document must be an object');
    await expect(
      upsertFlowDraft({ flowId: 'flow-1', semanticDocument: buildSpec(), layoutDocument: [] }),
    ).rejects.toThrow('Layout document must be an object');
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
