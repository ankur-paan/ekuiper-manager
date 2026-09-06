import { NextRequest } from 'next/server';
import { POST } from '@/app/api/flows/[id]/deploy/route';
import { ApiError } from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { deployFlow } from '@/lib/flows/deployments/deploy-flow';
import type { FlowDeploymentRecord } from '@/lib/flows/deployments/types';
import type { FlowDiagnostic } from '@/lib/flows/model/diagnostic';

jest.mock('@/lib/auth/session', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/flows/deployments/deploy-flow', () => ({ deployFlow: jest.fn() }));
jest.mock('@/lib/audit', () => ({ recordAuditSafely: jest.fn() }));

const mockedGetUser = jest.mocked(getAuthenticatedUser);
const mockedDeployFlow = jest.mocked(deployFlow);
const mockedAudit = jest.mocked(recordAuditSafely);

const actor = {
  id: 'user-1',
  username: 'operator',
  role: 'USER' as const,
  mustChangePassword: false,
};

const FIXED_DATE = new Date('2026-01-03T00:00:00.000Z');

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
    runtimeNodeMap: { 'node-source-1': 'source_abc', 'node-sink-1': 'sink_def' },
    status: 'succeeded',
    error: null,
    createdBy: 'user-1',
    createdAt: FIXED_DATE,
    ...overrides,
  };
}

function validationDiagnostic(): FlowDiagnostic {
  return {
    code: 'FLOW_UNKNOWN_NODE_TYPE',
    severity: 'error',
    message: 'Flow node "node-ghost-1" uses an unknown node type.',
    nodeId: 'node-ghost-1',
  };
}

function postRequest(id = 'flow-1', body?: unknown, origin = 'http://localhost') {
  const hasBody = body !== undefined;
  return new NextRequest(`http://localhost/api/flows/${id}/deploy`, {
    method: 'POST',
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      origin,
    },
    body: hasBody ? JSON.stringify(body) : null,
  });
}

function rawPostRequest(id = 'flow-1', rawBody = '', origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/flows/${id}/deploy`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: rawBody.length === 0 ? null : rawBody,
  });
}

function routeParams(id = 'flow-1') {
  return { params: Promise.resolve({ id }) };
}

function auditCalls() {
  return mockedAudit.mock.calls.map((call) => call[0]);
}

beforeEach(() => {
  mockedGetUser.mockReset();
  mockedDeployFlow.mockReset();
  mockedAudit.mockReset();
});

describe('POST /api/flows/:id/deploy', () => {
  it('rejects cross-origin requests before authentication', async () => {
    const response = await POST(
      postRequest('flow-1', undefined, 'https://evil.test'),
      routeParams(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed' },
    });
    expect(mockedGetUser).not.toHaveBeenCalled();
    expect(mockedDeployFlow).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated requests without calling the service', async () => {
    mockedGetUser.mockResolvedValueOnce(null);

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Sign in required' },
    });
    expect(mockedDeployFlow).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('rejects an arbitrary compiled rule payload without calling the service', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(
      postRequest('flow-1', {
        ruleDefinition: { graph: { nodes: {}, topo: {} } },
      }),
      routeParams(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INVALID_DEPLOY_REQUEST',
        message: 'Deploy does not accept compiled rule JSON or target URLs',
      },
    });
    expect(mockedDeployFlow).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('rejects a caller-supplied target URL without calling the service', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(
      postRequest('flow-1', { targetUrl: 'http://evil-node:9081' }),
      routeParams(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INVALID_DEPLOY_REQUEST',
        message: 'Deploy does not accept compiled rule JSON or target URLs',
      },
    });
    expect(mockedDeployFlow).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('rejects a targetNodeId that looks like a URL', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(
      postRequest('flow-1', { targetNodeId: 'http://evil-node:9081' }),
      routeParams(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INVALID_TARGET_NODE',
        message: 'Target must be a registered node id, not a URL',
      },
    });
    expect(mockedDeployFlow).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it.each([42, '', '   '])('rejects a non-id targetNodeId %p with 400', async (value) => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(
      postRequest('flow-1', { targetNodeId: value }),
      routeParams(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_TARGET_NODE', message: 'Target node id must be a string' },
    });
    expect(mockedDeployFlow).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('rejects unknown deploy fields and ignores no browser-supplied author', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(
      postRequest('flow-1', { targetNodeId: 'node-9', createdBy: 'attacker-id' }),
      routeParams(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INVALID_DEPLOY_REQUEST',
        message: 'Field "createdBy" cannot be used for deploy',
      },
    });
    expect(mockedDeployFlow).not.toHaveBeenCalled();
  });

  it('rejects a malformed JSON body with 400', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);

    const response = await POST(rawPostRequest('flow-1', '{not-json'), routeParams());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_JSON', message: 'Request body must be a JSON object' },
    });
    expect(mockedDeployFlow).not.toHaveBeenCalled();
  });

  it('returns 404 when the deployment service reports a missing flow and audits the failure', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedDeployFlow.mockRejectedValueOnce(
      new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND'),
    );

    const response = await POST(postRequest('missing'), routeParams('missing'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FLOW_NOT_FOUND', message: 'Flow not found' },
    });
    expect(mockedDeployFlow).toHaveBeenCalledWith({
      flowId: 'missing',
      createdBy: 'user-1',
    });
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(auditCalls()[0]).toMatchObject({
      actorId: 'user-1',
      action: 'flow.deploy',
      resourceType: 'flow',
      resourceId: 'missing',
      success: false,
    });
  });

  it('returns 404 for an unknown registered target without embedding config in audit', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedDeployFlow.mockRejectedValueOnce(
      new ApiError(404, 'eKuiper node not found', 'NODE_NOT_FOUND'),
    );

    const response = await POST(
      postRequest('flow-1', { targetNodeId: 'missing-node' }),
      routeParams(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'NODE_NOT_FOUND', message: 'eKuiper node not found' },
    });
    expect(mockedDeployFlow).toHaveBeenCalledWith({
      flowId: 'flow-1',
      targetNodeId: 'missing-node',
      createdBy: 'user-1',
    });
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const audit = auditCalls()[0];
    expect(audit).toMatchObject({ success: false, nodeId: 'missing-node' });
    // Audit metadata carries identifiers only, never compiled config.
    expect(audit?.metadata).toEqual({
      targetNodeId: 'missing-node',
      errorCode: 'NODE_NOT_FOUND',
    });
  });

  it('returns HTTP 200 with structured diagnostics for a validation failure', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedDeployFlow.mockResolvedValueOnce({
      ok: false,
      valid: false,
      diagnostics: [validationDiagnostic()],
      stage: 'validation',
      deployment: null,
      targetNodeId: 'node-1',
    });

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      valid: false,
      diagnostics: [validationDiagnostic()],
      stage: 'validation',
      deployment: null,
      targetNodeId: 'node-1',
    });
    // Empty body defaults to the flow's stored target: no explicit override.
    expect(mockedDeployFlow).toHaveBeenCalledWith({
      flowId: 'flow-1',
      createdBy: 'user-1',
    });
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(auditCalls()[0]).toMatchObject({
      actorId: 'user-1',
      action: 'flow.deploy',
      resourceType: 'flow',
      resourceId: 'flow-1',
      success: false,
      nodeId: 'node-1',
    });
    expect(auditCalls()[0]?.metadata).toEqual({
      targetNodeId: 'node-1',
      stage: 'validation',
    });
  });

  it('returns the failed eKuiper-validation attempt without mutating the audit config boundary', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    const failed = buildDeploymentRecord({ status: 'failed', error: 'sanitized' });
    mockedDeployFlow.mockResolvedValueOnce({
      ok: false,
      valid: false,
      diagnostics: [
        {
          code: 'FLOW_EKUIPER_VALIDATION_FAILED',
          severity: 'error',
          message: 'eKuiper rejected the compiled rule',
        },
      ],
      stage: 'ekuiper-validation',
      deployment: failed,
      targetNodeId: 'node-1',
    });

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.valid).toBe(false);
    expect(payload.stage).toBe('ekuiper-validation');
    expect(payload.deployment).toMatchObject({ id: 'deploy-1', status: 'failed' });
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const audit = auditCalls()[0];
    expect(audit).toMatchObject({ success: false });
    // Safe identifiers only: deployment id + rule id, never the compiled
    // definition (redacted or otherwise).
    expect(audit?.metadata).toEqual({
      targetNodeId: 'node-1',
      stage: 'ekuiper-validation',
      deploymentId: 'deploy-1',
      ruleId: 'flow-1',
    });
    expect(JSON.stringify(audit)).not.toContain('redactedCompiledDefinition');
    expect(JSON.stringify(audit)).not.toContain('runtimeNodeMap');
  });

  it('returns the deployment summary and rule status on success and audits identifiers only', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    const succeeded = buildDeploymentRecord({ status: 'succeeded' });
    mockedDeployFlow.mockResolvedValueOnce({
      ok: true,
      valid: true,
      diagnostics: [],
      deployment: succeeded,
      ruleStatus: { status: 'running' },
      targetNodeId: 'node-1',
    });

    const response = await POST(
      postRequest('flow-1', { targetNodeId: 'node-1' }),
      routeParams(),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.valid).toBe(true);
    expect(payload.deployment).toMatchObject({
      id: 'deploy-1',
      status: 'succeeded',
      ruleId: 'flow-1',
      semanticHash: 'sem-hash-1',
      compilerVersion: 1,
    });
    expect(payload.ruleStatus).toEqual({ status: 'running' });
    expect(payload.targetNodeId).toBe('node-1');
    expect(mockedDeployFlow).toHaveBeenCalledWith({
      flowId: 'flow-1',
      targetNodeId: 'node-1',
      createdBy: 'user-1',
    });
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const audit = auditCalls()[0];
    expect(audit).toMatchObject({
      actorId: 'user-1',
      action: 'flow.deploy',
      resourceType: 'flow',
      resourceId: 'flow-1',
      success: true,
      nodeId: 'node-1',
    });
    expect(audit?.metadata).toEqual({
      targetNodeId: 'node-1',
      deploymentId: 'deploy-1',
      ruleId: 'flow-1',
      semanticHash: 'sem-hash-1',
      compilerVersion: 1,
    });
    // The compiled config travels in the API response deployment record
    // (redacted at rest by the service) but never in audit metadata.
    expect(JSON.stringify(audit)).not.toContain('redactedCompiledDefinition');
    expect(JSON.stringify(audit)).not.toContain('runtimeNodeMap');
  });

  it('returns a server-safe error and audits the failure when the runtime upsert fails', async () => {
    mockedGetUser.mockResolvedValueOnce(actor);
    mockedDeployFlow.mockRejectedValueOnce(
      new ApiError(502, 'eKuiper rule upsert returned HTTP 400', 'EKRULE_UPSERT_FAILED'),
    );

    const response = await POST(postRequest(), routeParams());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'EKRULE_UPSERT_FAILED',
        message: 'eKuiper rule upsert returned HTTP 400',
      },
    });
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(auditCalls()[0]).toMatchObject({
      actorId: 'user-1',
      action: 'flow.deploy',
      resourceType: 'flow',
      resourceId: 'flow-1',
      success: false,
    });
    expect(auditCalls()[0]?.metadata).toEqual({ errorCode: 'EKRULE_UPSERT_FAILED' });
  });
});
