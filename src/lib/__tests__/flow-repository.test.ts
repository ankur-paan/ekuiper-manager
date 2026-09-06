import { query } from '@/lib/db';
import type { FlowRow } from '@/lib/flows/persistence/types';
import { createFlow, getFlow, listFlows, updateFlowMetadata } from '@/lib/flows/persistence/flow-repository';

jest.mock('@/lib/db', () => ({ query: jest.fn() }));
const mockedQuery = jest.mocked(query);

function buildRow(overrides?: Partial<FlowRow>): FlowRow {
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

function queryResult(rows: FlowRow[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<FlowRow>>>;
}

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('flow repository', () => {
  it('lists flows mapped from snake_case rows to domain records', async () => {
    mockedQuery.mockResolvedValueOnce(
      queryResult([buildRow(), buildRow({ id: 'flow-2', name: 'Second' })]),
    );

    const flows = await listFlows();

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0][0]).toContain('FROM flows');
    expect(flows).toHaveLength(2);
    expect(flows[0]).toEqual({
      id: 'flow-1',
      name: 'Line monitor',
      description: null,
      targetNodeId: null,
      createdBy: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
  });

  it('gets one flow with a parameterized id lookup', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([buildRow()]));

    const flow = await getFlow('flow-1');

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0][0]).toContain('WHERE id = $1');
    expect(mockedQuery.mock.calls[0][1]).toEqual(['flow-1']);
    expect(flow?.id).toBe('flow-1');
  });

  it('returns null for a missing flow', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    await expect(getFlow('missing')).resolves.toBeNull();
  });

  it('creates a flow with parameterized SQL and returns the DB row', async () => {
    const returned = buildRow({ name: 'Trimmed name', description: 'desc' });
    mockedQuery.mockResolvedValueOnce(queryResult([returned]));

    const flow = await createFlow({
      name: '  Trimmed name  ',
      description: 'desc',
      createdBy: 'user-1',
    });

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('INSERT INTO flows');
    expect(text).toContain('VALUES ($1, $2, $3, $4, $5)');
    expect(text).toContain('RETURNING');
    expect(text).not.toContain('flow_drafts');
    expect(values?.slice(1)).toEqual(['Trimmed name', 'desc', null, 'user-1']);
    expect(typeof values?.[0]).toBe('string');
    expect(flow).toEqual({
      id: 'flow-1',
      name: 'Trimmed name',
      description: 'desc',
      targetNodeId: null,
      createdBy: 'user-1',
      createdAt: returned.created_at,
      updatedAt: returned.updated_at,
    });
  });

  it('rejects a blank name without querying', async () => {
    await expect(createFlow({ name: '   ' })).rejects.toThrow('Flow name is required');
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('updates metadata with parameterized SQL and returns the mapped row', async () => {
    const returned = buildRow({ name: 'Renamed', description: 'new desc' });
    mockedQuery.mockResolvedValueOnce(queryResult([returned]));

    const flow = await updateFlowMetadata('flow-1', {
      name: '  Renamed  ',
      description: 'new desc',
    });

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('UPDATE flows SET');
    expect(text).toContain('updated_at = now()');
    expect(text).toContain('WHERE id = $');
    expect(text).toContain('RETURNING');
    expect(text).not.toContain('created_by =');
    expect(text).not.toContain('createdBy');
    expect(values).toEqual(['Renamed', 'new desc', 'flow-1']);
    expect(flow?.name).toBe('Renamed');
  });

  it('returns null when updating a missing flow', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    await expect(
      updateFlowMetadata('missing', { name: 'Renamed' }),
    ).resolves.toBeNull();
  });

  it('rejects an empty metadata update without querying', async () => {
    await expect(updateFlowMetadata('flow-1', {})).rejects.toThrow(
      'No metadata fields to update',
    );
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
