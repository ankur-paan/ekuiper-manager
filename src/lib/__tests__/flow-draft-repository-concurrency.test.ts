import { query } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { hashFlowLayout, hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import type { FlowDraftRow } from '@/lib/flows/persistence/types';
import { upsertFlowDraft } from '@/lib/flows/persistence/flow-draft-repository';

jest.mock('@/lib/db', () => ({ query: jest.fn() }));
const mockedQuery = jest.mocked(query);

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

function buildRow(spec: FlowSpec, layout: FlowLayout): FlowDraftRow {
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

function queryResult(rows: FlowDraftRow[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<FlowDraftRow>>>;
}

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('R3: draft optimistic concurrency', () => {
  it('rejects a stale expected-hash write instead of applying it', async () => {
    const newerSpec = buildSpec('devices/newer');
    const layout = buildLayout();
    const staleSemantic = 'stale-semantic-hash';
    const staleLayout = hashFlowLayout(layout);

    // Predicate mismatch: the conditional upsert returns no row.
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    const staleSpec = buildSpec('devices/stale');
    const failure = await upsertFlowDraft({
      flowId: 'flow-1',
      semanticDocument: staleSpec,
      layoutDocument: layout,
      updatedBy: 'user-1',
      expectedSemanticHash: staleSemantic,
      expectedLayoutHash: staleLayout,
    }).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(ApiError);
    const conflict = failure as ApiError;
    expect(conflict.status).toBe(409);
    expect(conflict.code).toBe('FLOW_DRAFT_CONFLICT');

    // The stale write predicated on stored hashes and applied nothing.
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('ON CONFLICT (flow_id) DO UPDATE');
    expect(text).toContain('semantic_hash');
    expect(text).toContain('layout_hash');
    expect(text).toMatch(/WHERE/i);
    expect(values).toContain(staleSemantic);
    expect(values).toContain(staleLayout);
    // New hashes are still server-computed, never caller-supplied.
    expect(values?.[3]).toBe(hashFlowSemantic(staleSpec));
    expect(values?.[4]).toBe(hashFlowLayout(layout));

    // Sanity: the newer draft hashes differ, so the stale predicate would
    // not have matched a row holding the newer edit.
    expect(hashFlowSemantic(newerSpec)).not.toBe(hashFlowSemantic(staleSpec));
  });

  it('applies the write when the expected hashes match', async () => {
    const spec = buildSpec('devices/current');
    const layout = buildLayout();
    const expectedSemanticHash = hashFlowSemantic(spec);
    const expectedLayoutHash = hashFlowLayout(layout);
    mockedQuery.mockResolvedValueOnce(queryResult([buildRow(spec, layout)]));

    const draft = await upsertFlowDraft({
      flowId: 'flow-1',
      semanticDocument: spec,
      layoutDocument: layout,
      updatedBy: 'user-1',
      expectedSemanticHash,
      expectedLayoutHash,
    });

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toMatch(/WHERE/i);
    expect(values).toContain(expectedSemanticHash);
    expect(values).toContain(expectedLayoutHash);
    expect(draft.semanticHash).toBe(expectedSemanticHash);
    expect(draft.layoutHash).toBe(expectedLayoutHash);
  });
});
