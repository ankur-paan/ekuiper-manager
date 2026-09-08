import { NextRequest } from 'next/server';
import { GET as runtimeRoute } from '@/app/api/flows/[id]/runtime/route';
import { ApiError } from '@/lib/api';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization } from '@/lib/nodes';
import { getLatestSuccessfulDeployment } from '@/lib/flows/deployments/deployment-repository';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import type { FlowDeploymentRecord } from '@/lib/flows/deployments/types';
import type { FlowRecord } from '@/lib/flows/persistence/types';
import {
  detectUnhealthyRuntime,
  FLOW_RUNTIME_NEVER_DEPLOYED_MESSAGE,
  FLOW_RUNTIME_READ_FAILED_MESSAGE,
  FLOW_RUNTIME_SINK_FAILING_MESSAGE,
  FLOW_RUNTIME_SINK_UNREACHABLE_MESSAGE,
  getFlowRuntimeStatus,
  normalizeActualState,
  readStatusMessage,
  toSafeStatusReason,
} from '@/lib/flows/deployments/runtime-status';

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

const FIXED_DATE = new Date('2026-01-03T00:00:00.000Z');

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
    runtimeNodeMap: {},
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

function ruleStatusBody(status: string, message = '') {
  // Audited `RuleStatus` shape (public/ekuiper-openapi.json v2.4.1).
  return {
    status,
    message,
    lastStartTimestamp: 0,
    lastStopTimestamp: 0,
    nextStartTimestamp: 0,
  };
}

function jsonResponse(status: number, payload: unknown): Response {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function runtimeRequest(id = 'flow-1') {
  return new NextRequest(`http://localhost/api/flows/${id}/runtime`);
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

describe('normalizeActualState', () => {
  it.each([
    ['running', 'running'],
    ['running: all good', 'running'],
    ['stopped', 'stopped'],
    ['stopped: canceled manually', 'stopped'],
    ['stopped: sink failed to connect', 'error'],
    ['error', 'error'],
    ['error: out of memory', 'error'],
    ['failed', 'error'],
    ['no such rule', 'unknown'],
    ['', 'unknown'],
  ])('maps %p to %p', (input, expected) => {
    expect(normalizeActualState(input)).toBe(expected);
  });

  it('maps non-string bodies to unknown', () => {
    expect(normalizeActualState(undefined)).toBe('unknown');
    expect(normalizeActualState({ status: 'running' })).toBe('unknown');
  });
});

describe('detectUnhealthyRuntime', () => {
  // These metric shapes are copied from real eKuiper 2.4.1 RuleStatus bodies captured during
  // live acceptance testing, not invented: a rule reporting `running` while delivering nothing
  // is the failure mode this guards (AC-D009, AC-D010).
  it('reports nothing for a healthy rule that is delivering', () => {
    expect(
      detectUnhealthyRuntime({
        status: 'running',
        source_src_0_records_in_total: 3,
        sink_snk_0_records_in_total: 3,
        sink_snk_0_records_out_total: 3,
        sink_snk_0_exceptions_total: 0,
        sink_snk_0_connection_status: 1,
      }),
    ).toBeNull();
  });

  it('detects a sink whose connection is down', () => {
    expect(
      detectUnhealthyRuntime({
        status: 'running',
        sink_sink_36e8072cf8b4_0_connection_status: -1,
      }),
    ).toBe(FLOW_RUNTIME_SINK_UNREACHABLE_MESSAGE);
  });

  it('detects a sink consuming rows and emitting none', () => {
    expect(
      detectUnhealthyRuntime({
        status: 'running',
        sink_snk_0_records_in_total: 1,
        sink_snk_0_records_out_total: 0,
        sink_snk_0_exceptions_total: 1,
        sink_snk_0_last_exception: 'rest sink fails to send out the data',
      }),
    ).toBe(FLOW_RUNTIME_SINK_FAILING_MESSAGE);
  });

  it('does not flag a sink that simply has not received anything yet', () => {
    expect(
      detectUnhealthyRuntime({
        status: 'running',
        sink_snk_0_records_in_total: 0,
        sink_snk_0_records_out_total: 0,
        sink_snk_0_exceptions_total: 0,
      }),
    ).toBeNull();
  });

  it('compares each sink against its own counters, not another one', () => {
    // One healthy sink and one failing sink in the same rule: the failing one must still win.
    expect(
      detectUnhealthyRuntime({
        status: 'running',
        sink_good_0_records_in_total: 5,
        sink_good_0_records_out_total: 5,
        sink_good_0_exceptions_total: 0,
        sink_bad_0_records_in_total: 5,
        sink_bad_0_records_out_total: 0,
        sink_bad_0_exceptions_total: 5,
      }),
    ).toBe(FLOW_RUNTIME_SINK_FAILING_MESSAGE);
  });

  it('never reflects the engine exception text back to the caller', () => {
    const reason = detectUnhealthyRuntime({
      status: 'running',
      sink_snk_0_connection_status: -1,
      sink_snk_0_last_exception:
        'dial tcp 10.1.2.3:1883: connect failed user=admin password=hunter2',
    });
    expect(reason).toBe(FLOW_RUNTIME_SINK_UNREACHABLE_MESSAGE);
    expect(reason).not.toContain('hunter2');
    expect(reason).not.toContain('10.1.2.3');
  });

  it('ignores non-numeric and malformed bodies', () => {
    expect(detectUnhealthyRuntime(null)).toBeNull();
    expect(detectUnhealthyRuntime('running')).toBeNull();
    expect(detectUnhealthyRuntime([])).toBeNull();
    expect(detectUnhealthyRuntime({ sink_snk_0_connection_status: 'down' })).toBeNull();
  });
});

describe('readStatusMessage / toSafeStatusReason', () => {
  it('returns null for empty messages and non-objects', () => {
    expect(readStatusMessage(ruleStatusBody('running', ''))).toBeNull();
    expect(readStatusMessage(ruleStatusBody('running', '   '))).toBeNull();
    expect(readStatusMessage(null)).toBeNull();
    expect(readStatusMessage('running')).toBeNull();
  });

  it('redacts secret-bearing eKuiper messages', () => {
    const message = readStatusMessage(
      ruleStatusBody('error', 'dial failed: password=super-secret-token'),
    );
    expect(message).toContain('[redacted]');
    expect(message).not.toContain('super-secret-token');
  });

  it('keeps server-safe protocol errors and hides unexpected failures', () => {
    expect(toSafeStatusReason(new ApiError(502, 'eKuiper could not be reached', 'NODE_UNREACHABLE'))).toBe(
      'eKuiper could not be reached',
    );
    expect(toSafeStatusReason(new TypeError('fetch failed'))).toBe(
      FLOW_RUNTIME_READ_FAILED_MESSAGE,
    );
  });
});

describe('getFlowRuntimeStatus', () => {
  it('throws 404 for a missing flow without reading status', async () => {
    const fetchRuleStatus = jest.fn();

    await expect(
      getFlowRuntimeStatus('missing', {
        loadFlow: async () => null,
        loadLatestDeployment: async () => buildDeploymentRecord(),
        fetchRuleStatus,
      }),
    ).rejects.toMatchObject({ code: 'FLOW_NOT_FOUND' });
    expect(fetchRuleStatus).not.toHaveBeenCalled();
  });

  it('returns the never-deployed model without touching eKuiper', async () => {
    const fetchRuleStatus = jest.fn();

    const status = await getFlowRuntimeStatus('flow-1', {
      loadFlow: async () => buildFlowRecord(),
      loadLatestDeployment: async () => null,
      fetchRuleStatus,
    });

    expect(status).toMatchObject({
      flowId: 'flow-1',
      targetNodeId: 'node-1',
      ruleId: null,
      deploymentId: null,
      deployed: false,
      desiredState: 'unknown',
      actualState: 'unknown',
      message: FLOW_RUNTIME_NEVER_DEPLOYED_MESSAGE,
    });
    expect(typeof status.checkedAt).toBe('string');
    expect(fetchRuleStatus).not.toHaveBeenCalled();
  });

  it('normalizes a running rule with the latest deployment id', async () => {
    const status = await getFlowRuntimeStatus('flow-1', {
      loadFlow: async () => buildFlowRecord(),
      loadLatestDeployment: async () => buildDeploymentRecord(),
      fetchRuleStatus: async () => ruleStatusBody('running'),
    });

    expect(status).toMatchObject({
      flowId: 'flow-1',
      targetNodeId: 'node-1',
      ruleId: 'flow-1',
      deploymentId: 'deploy-1',
      deployed: true,
      desiredState: 'running',
      actualState: 'running',
      message: null,
    });
  });

  it('carries a bounded safe summary for stopped and error states', async () => {
    const stopped = await getFlowRuntimeStatus('flow-1', {
      loadFlow: async () => buildFlowRecord(),
      loadLatestDeployment: async () => buildDeploymentRecord(),
      fetchRuleStatus: async () => ruleStatusBody('stopped', 'canceled manually'),
    });
    expect(stopped.actualState).toBe('stopped');
    expect(stopped.message).toBe('canceled manually');

    const errored = await getFlowRuntimeStatus('flow-1', {
      loadFlow: async () => buildFlowRecord(),
      loadLatestDeployment: async () => buildDeploymentRecord(),
      fetchRuleStatus: async () =>
        ruleStatusBody('stopped: sink error', 'sink error: password=hunter2 broke the pipe'),
    });
    expect(errored.actualState).toBe('error');
    expect(errored.message).toContain('[redacted]');
    expect(errored.message).not.toContain('hunter2');
  });

  it('maps a rule missing on eKuiper to unknown with a safe reason', async () => {
    const status = await getFlowRuntimeStatus('flow-1', {
      loadFlow: async () => buildFlowRecord(),
      loadLatestDeployment: async () => buildDeploymentRecord(),
      fetchRuleStatus: async () => {
        throw new ApiError(502, 'eKuiper did not report the deployed rule', 'EKRULE_STATUS_MISSING');
      },
    });

    expect(status).toMatchObject({
      deployed: true,
      deploymentId: 'deploy-1',
      desiredState: 'running',
      actualState: 'unknown',
      message: 'eKuiper did not report the deployed rule',
    });
  });

  it('maps an unreachable target to unknown with a safe reason', async () => {
    const status = await getFlowRuntimeStatus('flow-1', {
      loadFlow: async () => buildFlowRecord(),
      loadLatestDeployment: async () => buildDeploymentRecord(),
      fetchRuleStatus: async () => {
        throw new ApiError(502, 'eKuiper could not be reached', 'NODE_UNREACHABLE');
      },
    });

    expect(status.actualState).toBe('unknown');
    expect(status.message).toBe('eKuiper could not be reached');
    expect(JSON.stringify(status)).not.toContain('edge-node:9081');
  });

  it('hides unexpected failures behind a static message', async () => {
    const status = await getFlowRuntimeStatus('flow-1', {
      loadFlow: async () => buildFlowRecord(),
      loadLatestDeployment: async () => buildDeploymentRecord(),
      fetchRuleStatus: async () => {
        throw new Error('squirrel exploded in datacenter 7');
      },
    });

    expect(status.actualState).toBe('unknown');
    expect(status.message).toBe(FLOW_RUNTIME_READ_FAILED_MESSAGE);
    expect(JSON.stringify(status)).not.toContain('squirrel');
  });

  it('reports unknown without fetching when the deployment has no target', async () => {
    const fetchRuleStatus = jest.fn();

    const status = await getFlowRuntimeStatus('flow-1', {
      loadFlow: async () => buildFlowRecord({ targetNodeId: null }),
      loadLatestDeployment: async () => buildDeploymentRecord({ targetNodeId: null }),
      fetchRuleStatus,
    });

    expect(status).toMatchObject({
      deployed: true,
      desiredState: 'running',
      actualState: 'unknown',
    });
    expect(fetchRuleStatus).not.toHaveBeenCalled();
  });
});

describe('GET /api/flows/:id/runtime', () => {
  it('returns 401 for unauthenticated requests without querying', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await runtimeRoute(runtimeRequest(), routeParams());

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

    const response = await runtimeRoute(runtimeRequest('missing'), routeParams('missing'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(mockedLatestDeployment).not.toHaveBeenCalled();
  });

  it('returns the never-deployed model without contacting eKuiper', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(buildFlowRecord());
    mockedLatestDeployment.mockResolvedValueOnce(null);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const response = await runtimeRoute(runtimeRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.runtime).toMatchObject({
      flowId: 'flow-1',
      deployed: false,
      desiredState: 'unknown',
      actualState: 'unknown',
      message: FLOW_RUNTIME_NEVER_DEPLOYED_MESSAGE,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns normalized running status from one eKuiper read', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(buildFlowRecord());
    mockedLatestDeployment.mockResolvedValueOnce(buildDeploymentRecord());
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, ruleStatusBody('running')));

    const response = await runtimeRoute(runtimeRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.runtime).toMatchObject({
      flowId: 'flow-1',
      targetNodeId: 'node-1',
      ruleId: 'flow-1',
      deploymentId: 'deploy-1',
      deployed: true,
      desiredState: 'running',
      actualState: 'running',
      message: null,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [target] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(String(target)).toBe('http://edge-node:9081/v2/rules/flow-1/status');
    // No raw credentials or arbitrary URLs escape into the payload.
    expect(JSON.stringify(payload)).not.toContain('stored-token');
    expect(JSON.stringify(payload)).not.toContain('edge-node:9081');
  });

  it('returns unknown with a safe reason when eKuiper is unreachable', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedGetFlow.mockResolvedValueOnce(buildFlowRecord());
    mockedLatestDeployment.mockResolvedValueOnce(buildDeploymentRecord());
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));

    const response = await runtimeRoute(runtimeRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.runtime).toMatchObject({
      deployed: true,
      actualState: 'unknown',
      message: 'eKuiper could not be reached',
    });
  });
});
