import { NextRequest } from 'next/server';
import { GET as metricsRoute } from '@/app/api/flows/[id]/runtime/metrics/route';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getLatestSuccessfulDeployment } from '@/lib/flows/deployments/deployment-repository';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import type { FlowDeploymentRecord } from '@/lib/flows/deployments/types';
import type { FlowRecord } from '@/lib/flows/persistence/types';
import { getNodeWithAuthorization } from '@/lib/nodes';
import { assertSafeNodeDestination } from '@/lib/network';

jest.mock('@/lib/auth/session', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/flows/persistence/flow-repository', () => ({ getFlow: jest.fn() }));
jest.mock('@/lib/flows/deployments/deployment-repository', () => ({
  ...jest.requireActual('@/lib/flows/deployments/deployment-repository'),
  getLatestSuccessfulDeployment: jest.fn(),
}));
jest.mock('@/lib/nodes', () => ({ getNodeWithAuthorization: jest.fn() }));
jest.mock('@/lib/network', () => ({ assertSafeNodeDestination: jest.fn() }));

const mockedGetUser = jest.mocked(getAuthenticatedUser);
const mockedGetFlow = jest.mocked(getFlow);
const mockedLatestDeployment = jest.mocked(getLatestSuccessfulDeployment);
const mockedGetNodeWithAuthorization = jest.mocked(getNodeWithAuthorization);
const mockedAssertDestination = jest.mocked(assertSafeNodeDestination);

const actor = {
  id: 'user-1',
  username: 'operator',
  role: 'USER' as const,
  mustChangePassword: false,
};

const FIXED_DATE = new Date('2026-02-01T00:00:00.000Z');

function buildFlowRecord(overrides?: Partial<FlowRecord>): FlowRecord {
  return {
    id: 'flow-1',
    name: 'Line monitor',
    description: null,
    targetNodeId: 'node-1',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function buildDeploymentRecord(
  overrides?: Partial<FlowDeploymentRecord>,
): FlowDeploymentRecord {
  return {
    id: 'deploy-1',
    flowId: 'flow-1',
    targetNodeId: 'node-1',
    semanticHash: 'sem-hash-1',
    compilerVersion: 1,
    ruleId: 'flow-1',
    redactedCompiledDefinition: { graph: { nodes: {}, topo: {} } },
    runtimeNodeMap: {
      'node-source-1': 'source_mqtt_abc123',
      'node-sink-1': 'sink_log_def456',
    },
    status: 'succeeded',
    error: null,
    createdBy: 'user-1',
    createdAt: FIXED_DATE,
    ...overrides,
  };
}

function registeredNode() {
  return {
    node: {
      id: 'node-1',
      name: 'edge-node',
      baseUrl: 'http://edge-node:9081',
      description: null,
      hasAuthorization: true,
      isDefault: true,
      status: 'ONLINE' as const,
      version: '2.4.1',
      capabilities: {},
      lastCheckedAt: null,
      lastError: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    authorization: 'Bearer stored-token',
  };
}

function jsonResponse(status: number, payload: unknown): Response {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function metricsRequest(id = 'flow-1') {
  return new NextRequest(`http://localhost/api/flows/${id}/runtime/metrics`);
}

function routeParams(id = 'flow-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedGetFlow.mockReset();
  mockedLatestDeployment.mockReset();
  mockedGetNodeWithAuthorization.mockReset();
  mockedAssertDestination.mockReset();
  mockedAssertDestination.mockResolvedValue(undefined);
  mockedGetNodeWithAuthorization.mockResolvedValue(registeredNode());
  jest.restoreAllMocks();
});

describe('GET /api/flows/:id/runtime/metrics', () => {
  it('returns 401 for unauthenticated requests without querying', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await metricsRoute(metricsRequest(), routeParams());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockedGetFlow).not.toHaveBeenCalled();
    expect(mockedLatestDeployment).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing flow', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(null);

    const response = await metricsRoute(metricsRequest('missing'), routeParams('missing'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(mockedLatestDeployment).not.toHaveBeenCalled();
  });

  it('returns an empty snapshot when never deployed without contacting eKuiper', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(buildFlowRecord());
    mockedLatestDeployment.mockResolvedValueOnce(null);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const response = await metricsRoute(metricsRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deployed).toBe(false);
    expect(payload.deploymentId).toBeNull();
    expect(payload.ruleId).toBeNull();
    expect(payload.snapshot.flowId).toBe('flow-1');
    expect(typeof payload.snapshot.capturedAt).toBe('string');
    expect(payload.snapshot.nodes).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns an empty snapshot without fetching when the deployment has no target', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(buildFlowRecord({ targetNodeId: null }));
    mockedLatestDeployment.mockResolvedValueOnce(
      buildDeploymentRecord({ targetNodeId: null }),
    );
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const response = await metricsRoute(metricsRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deployed).toBe(true);
    expect(payload.snapshot.nodes).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps one eKuiper status read through the persisted runtimeNodeMap', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(buildFlowRecord());
    mockedLatestDeployment.mockResolvedValueOnce(buildDeploymentRecord());
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(200, {
        status: 'running',
        message: '',
        lastStartTimestamp: 0,
        lastStopTimestamp: 0,
        nextStartTimestamp: 0,
        source_mqtt_abc123_records_in_total: 120,
        source_mqtt_abc123_records_out_total: 118,
        source_mqtt_abc123_exceptions_total: 2,
        sink_log_def456_records_in_total: 118,
        sink_log_def456_records_out_total: 118,
        unknown_op_9_records_in_total: 999,
      }),
    );

    const response = await metricsRoute(metricsRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deployed).toBe(true);
    expect(payload.deploymentId).toBe('deploy-1');
    expect(payload.ruleId).toBe('flow-1');
    expect(payload.snapshot.flowId).toBe('flow-1');
    expect(typeof payload.snapshot.capturedAt).toBe('string');
    expect(payload.snapshot.nodes['node-source-1']).toEqual({
      inputTotal: 120,
      outputTotal: 118,
      errorTotal: 2,
    });
    expect(payload.snapshot.nodes['node-sink-1']).toEqual({
      inputTotal: 118,
      outputTotal: 118,
    });
    expect(payload.snapshot.nodes).not.toHaveProperty('unknown_op_9');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [target] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(String(target)).toBe('http://edge-node:9081/v2/rules/flow-1/status');
    // No raw credentials or node URLs escape into the payload.
    expect(JSON.stringify(payload)).not.toContain('stored-token');
    expect(JSON.stringify(payload)).not.toContain('edge-node:9081');
  });

  it('returns a safe error when eKuiper is unreachable', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(buildFlowRecord());
    mockedLatestDeployment.mockResolvedValueOnce(buildDeploymentRecord());
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));

    const response = await metricsRoute(metricsRequest(), routeParams());

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('NODE_UNREACHABLE');
    expect(JSON.stringify(payload)).not.toContain('stored-token');
    expect(JSON.stringify(payload)).not.toContain('edge-node:9081');
  });

  it('returns a safe error when the rule is missing on eKuiper', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(buildFlowRecord());
    mockedLatestDeployment.mockResolvedValueOnce(buildDeploymentRecord());
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(404, { error: 'no such rule' }));

    const response = await metricsRoute(metricsRequest(), routeParams());

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('EKRULE_STATUS_MISSING');
  });
});
