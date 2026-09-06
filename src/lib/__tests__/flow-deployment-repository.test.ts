import { query } from '@/lib/db';
import {
  createDeploymentAttempt,
  getLatestSuccessfulDeployment,
  markDeploymentFailed,
  markDeploymentSucceeded,
  MAX_DEPLOYMENT_ERROR_CHARS,
  sanitizeDeploymentError,
} from '@/lib/flows/deployments/deployment-repository';
import type { FlowDeploymentRow } from '@/lib/flows/deployments/types';

jest.mock('@/lib/db', () => ({ query: jest.fn() }));
const mockedQuery = jest.mocked(query);

function buildRow(overrides?: Partial<FlowDeploymentRow>): FlowDeploymentRow {
  return {
    id: 'deploy-1',
    flow_id: 'flow-1',
    target_node_id: 'node-1',
    semantic_hash: 'sem-hash-1',
    compiler_version: 1,
    rule_id: 'flow_flow_1',
    redacted_compiled_definition: { id: 'flow_flow_1' },
    runtime_node_map: { 'node-source-1': 'n_mqtt_source_abc123' },
    status: 'pending',
    error: null,
    created_by: 'user-1',
    created_at: new Date('2026-01-03T00:00:00.000Z'),
    ...overrides,
  };
}

function queryResult(rows: FlowDeploymentRow[]) {
  return { rows } as unknown as Awaited<ReturnType<typeof query<FlowDeploymentRow>>>;
}

function validAttemptInput() {
  return {
    flowId: 'flow-1',
    targetNodeId: 'node-1',
    semanticHash: 'sem-hash-1',
    compilerVersion: 1,
    ruleId: 'flow_flow_1',
    redactedCompiledDefinition: { id: 'flow_flow_1' },
    runtimeNodeMap: { 'node-source-1': 'n_mqtt_source_abc123' },
    createdBy: 'user-1',
  };
}

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('flow deployment repository', () => {
  it('creates a pending attempt with parameterized SQL and mapped record', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([buildRow()]));

    const record = await createDeploymentAttempt(validAttemptInput());

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('INSERT INTO flow_deployments');
    expect(text).toContain("'pending'");
    expect(text).toContain('RETURNING');
    expect(text).not.toContain('${');
    expect(values).toHaveLength(9);
    expect(typeof values?.[0]).toBe('string');
    expect(values?.slice(1)).toEqual([
      'flow-1',
      'node-1',
      'sem-hash-1',
      1,
      'flow_flow_1',
      JSON.stringify({ id: 'flow_flow_1' }),
      JSON.stringify({ 'node-source-1': 'n_mqtt_source_abc123' }),
      'user-1',
    ]);
    expect(record.status).toBe('pending');
    expect(record.flowId).toBe('flow-1');
    expect(record.targetNodeId).toBe('node-1');
    expect(record.semanticHash).toBe('sem-hash-1');
    expect(record.compilerVersion).toBe(1);
    expect(record.runtimeNodeMap).toEqual({ 'node-source-1': 'n_mqtt_source_abc123' });
    expect(record.error).toBeNull();
  });

  it('marks a pending attempt succeeded without overwriting other rows', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([buildRow({ status: 'succeeded' })]));

    const record = await markDeploymentSucceeded('deploy-1');

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('UPDATE flow_deployments');
    expect(text).toContain("status = 'succeeded'");
    expect(text).toContain("status = 'pending'");
    expect(values).toEqual(['deploy-1']);
    expect(record?.status).toBe('succeeded');
    expect(record?.semanticHash).toBe('sem-hash-1');
    expect(record?.compilerVersion).toBe(1);
    expect(record?.runtimeNodeMap).toEqual({ 'node-source-1': 'n_mqtt_source_abc123' });
  });

  it('returns null when marking a non-pending attempt', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([])).mockResolvedValueOnce(queryResult([]));

    await expect(markDeploymentSucceeded('deploy-1')).resolves.toBeNull();
    await expect(markDeploymentFailed('deploy-1', 'boom')).resolves.toBeNull();
  });

  it('marks failure with a bounded sanitized error', async () => {
    const raw = `upstream 500: {"password":"hunter2"} Authorization: Bearer abc.def ${'x'.repeat(5000)}`;
    mockedQuery.mockResolvedValueOnce(queryResult([buildRow({ status: 'failed', error: 'stub' })]));

    await markDeploymentFailed('deploy-1', raw);

    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain("status = 'failed'");
    expect(text).toContain("status = 'pending'");
    const stored = values?.[1] as string;
    expect(stored.length).toBeLessThanOrEqual(MAX_DEPLOYMENT_ERROR_CHARS);
    expect(stored).not.toContain('hunter2');
    expect(stored).not.toContain('Bearer abc.def');
    expect(stored).toContain('[redacted]');
  });

  it('sanitizes Error instances and non-string failures', () => {
    expect(sanitizeDeploymentError(new Error('boom'))).toBe('boom');
    expect(sanitizeDeploymentError(undefined)).toBe('Deployment failed');
    expect(sanitizeDeploymentError('   ')).toBe('Deployment failed');
    const long = 'y'.repeat(MAX_DEPLOYMENT_ERROR_CHARS + 100);
    expect(sanitizeDeploymentError(long)).toHaveLength(MAX_DEPLOYMENT_ERROR_CHARS);
  });

  it('loads the latest successful deployment and ignores failed attempts', async () => {
    mockedQuery.mockResolvedValueOnce(
      queryResult([buildRow({ id: 'deploy-9', status: 'succeeded' })]),
    );

    const record = await getLatestSuccessfulDeployment('flow-1', 'node-1');

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [text, values] = mockedQuery.mock.calls[0];
    expect(text).toContain('FROM flow_deployments');
    expect(text).toContain("status = 'succeeded'");
    expect(text).toContain('ORDER BY created_at DESC');
    expect(text).toContain('LIMIT 1');
    expect(values).toEqual(['flow-1', 'node-1']);
    // Success record retains the deploy-critical fields.
    expect(record?.id).toBe('deploy-9');
    expect(record?.semanticHash).toBe('sem-hash-1');
    expect(record?.compilerVersion).toBe(1);
    expect(record?.runtimeNodeMap).toEqual({ 'node-source-1': 'n_mqtt_source_abc123' });
  });

  it('returns null when no successful deployment exists', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    await expect(getLatestSuccessfulDeployment('flow-1', 'node-1')).resolves.toBeNull();
  });

  it('rejects invalid input without querying', async () => {
    await expect(
      createDeploymentAttempt({ ...validAttemptInput(), flowId: '   ' }),
    ).rejects.toThrow('flowId is required');
    await expect(
      createDeploymentAttempt({ ...validAttemptInput(), compilerVersion: 1.5 }),
    ).rejects.toThrow('compilerVersion must be a non-negative integer');
    await expect(
      createDeploymentAttempt({ ...validAttemptInput(), redactedCompiledDefinition: [] }),
    ).rejects.toThrow('redactedCompiledDefinition must be an object');
    await expect(
      createDeploymentAttempt({ ...validAttemptInput(), runtimeNodeMap: { a: 1 } }),
    ).rejects.toThrow('runtimeNodeMap must map non-empty string node IDs');
    await expect(markDeploymentSucceeded('   ')).rejects.toThrow('deployment id is required');
    await expect(getLatestSuccessfulDeployment('   ', 'node-1')).rejects.toThrow(
      'flowId is required',
    );
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
