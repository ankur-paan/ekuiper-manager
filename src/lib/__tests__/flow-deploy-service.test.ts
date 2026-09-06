import { ApiError } from '@/lib/api';
import { getNodeWithAuthorization } from '@/lib/nodes';
import { assertSafeNodeDestination } from '@/lib/network';
import type { TargetCapabilityProfile } from '@/lib/flows/capabilities/types';
import type { CompileFlowResult, FlowDeploymentArtifact } from '@/lib/flows/compiler/types';
import {
  defaultFetchRuleStatus,
  defaultUpsertRule,
  deployFlow,
  FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS,
  FLOW_DEPLOY_CONNECTION_POLL_INTERVAL_MS,
  FLOW_DEPLOY_CONNECTION_SETTLE_MS,
  getUnhealthyConnectionDetail,
  type DeployFlowDependencies,
} from '@/lib/flows/deployments/deploy-flow';
import type { FlowDeploymentRecord } from '@/lib/flows/deployments/types';
import type { EkuiperValidationResult } from '@/lib/flows/deployments/ekuiper-validation';
import type { FlowDiagnostic } from '@/lib/flows/model/diagnostic';
import type { FlowDraftRecord, FlowRecord } from '@/lib/flows/persistence/types';
import type { ManagedNode } from '@/lib/nodes';
import { NodeRegistry } from '@/lib/flows/registry/node-registry';
import type { FlowValidationResult } from '@/lib/flows/validation/validate-flow';

jest.mock('@/lib/nodes', () => ({ getNodeWithAuthorization: jest.fn() }));
jest.mock('@/lib/network', () => ({ assertSafeNodeDestination: jest.fn() }));

const mockedGetNodeWithAuthorization = jest.mocked(getNodeWithAuthorization);
const mockedAssertDestination = jest.mocked(assertSafeNodeDestination);

const FIXED_DATE = new Date('2026-01-03T00:00:00.000Z');

function buildFlowRecord(): FlowRecord {
  return {
    id: 'flow-1',
    name: 'Line monitor',
    description: null,
    targetNodeId: 'node-1',
    createdBy: 'user-1',
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  };
}

function buildDraftRecord(): FlowDraftRecord {
  return {
    flowId: 'flow-1',
    semanticDocument: {
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
    },
    layoutDocument: {
      nodes: {
        'node-source-1': { x: 0, y: 0 },
        'node-sink-1': { x: 320, y: 0 },
      },
    },
    semanticHash: 'sem-hash-1',
    layoutHash: 'layout-hash-1',
    updatedBy: 'user-1',
    updatedAt: FIXED_DATE,
  };
}

function buildTargetNode(): ManagedNode {
  return {
    id: 'node-1',
    name: 'edge-node',
    baseUrl: 'http://edge-node:9081',
    description: null,
    hasAuthorization: true,
    isDefault: true,
    status: 'ONLINE',
    version: '2.4.1',
    capabilities: {},
    lastCheckedAt: null,
    lastError: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  };
}

function buildArtifact(): FlowDeploymentArtifact {
  return {
    compilerVersion: 1,
    semanticHash: 'sem-hash-1',
    ruleId: 'flow-1',
    ruleDefinition: {
      graph: {
        nodes: {
          source_abc: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: 'raw-events' },
          },
          sink_def: {
            type: 'sink',
            nodeType: 'rest',
            props: {
              url: 'https://example.test/events',
              headers: { Authorization: 'Bearer live-token' },
            },
          },
        },
        topo: { sources: ['source_abc'], edges: { source_abc: ['sink_def'] } },
      },
    },
    runtimeNodeMap: { 'node-source-1': 'source_abc', 'node-sink-1': 'sink_def' },
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
    redactedCompiledDefinition: { graph: {} },
    runtimeNodeMap: { 'node-source-1': 'source_abc', 'node-sink-1': 'sink_def' },
    status: 'pending',
    error: null,
    createdBy: 'user-1',
    createdAt: FIXED_DATE,
    ...overrides,
  };
}

interface HarnessOverrides {
  flow?: FlowRecord | null;
  draft?: FlowDraftRecord | null;
  target?: ManagedNode | null;
  validation?: FlowValidationResult;
  compile?: CompileFlowResult;
  ekuiperValidation?: EkuiperValidationResult;
  upsertError?: unknown;
  statusError?: unknown;
  statusValue?: unknown;
}

interface Harness {
  order: string[];
  persistedRedacted: Array<Record<string, unknown>>;
  upsertCalls: Array<{ targetNodeId: string; ruleId: string; ruleDefinition: Record<string, unknown> }>;
  failureInputs: unknown[];
  deps: DeployFlowDependencies;
}

function buildHarness(overrides: HarnessOverrides = {}): Harness {
  const order: string[] = [];
  const persistedRedacted: Array<Record<string, unknown>> = [];
  const upsertCalls: Harness['upsertCalls'] = [];
  const failureInputs: unknown[] = [];
  const artifact = buildArtifact();
  const profile: TargetCapabilityProfile = {
    ekuiperVersion: '2.4.1',
    reachable: true,
    graphRules: true,
    sources: [],
    operators: [],
    sinks: [],
  };

  const deps: DeployFlowDependencies = {
    loadFlow: async () => {
      order.push('loadFlow');
      return 'flow' in overrides ? (overrides.flow ?? null) : buildFlowRecord();
    },
    loadDraft: async () => {
      order.push('loadDraft');
      return 'draft' in overrides ? (overrides.draft ?? null) : buildDraftRecord();
    },
    loadTarget: async () => {
      order.push('loadTarget');
      return 'target' in overrides ? (overrides.target ?? null) : buildTargetNode();
    },
    resolveProfile: () => {
      order.push('resolveProfile');
      return profile;
    },
    buildRegistry: () => {
      order.push('buildRegistry');
      return new NodeRegistry();
    },
    runServerValidation: () => {
      order.push('validate');
      return overrides.validation ?? { valid: true, diagnostics: [] };
    },
    runCompile: () => {
      order.push('compile');
      return overrides.compile ?? { ok: true, artifact, diagnostics: [] };
    },
    // Default redaction intentionally NOT overridden: the success test
    // proves the persisted copy carries no plaintext secret.
    recordAttempt: async (input) => {
      order.push('createAttempt');
      persistedRedacted.push(input.redactedCompiledDefinition as Record<string, unknown>);
      return buildDeploymentRecord({
        semanticHash: input.semanticHash as string,
        compilerVersion: input.compilerVersion as number,
        ruleId: input.ruleId as string,
        redactedCompiledDefinition: input.redactedCompiledDefinition as Record<string, unknown>,
        runtimeNodeMap: input.runtimeNodeMap as Record<string, string>,
      });
    },
    recordSuccess: async () => {
      order.push('markSucceeded');
      return buildDeploymentRecord({ status: 'succeeded' });
    },
    recordFailure: async (_id, error) => {
      order.push('markFailed');
      failureInputs.push(error);
      return buildDeploymentRecord({ status: 'failed', error: 'sanitized' });
    },
    runEkuiperValidation: async () => {
      order.push('ekuiperValidate');
      return (
        overrides.ekuiperValidation ?? { valid: true, diagnostics: [], sources: ['raw-events'] }
      );
    },
    upsertRule: async (args) => {
      order.push('upsert');
      upsertCalls.push(args);
      if (overrides.upsertError !== undefined) throw overrides.upsertError;
    },
    fetchRuleStatus: async () => {
      order.push('readStatus');
      if (overrides.statusError !== undefined) throw overrides.statusError;
      return overrides.statusValue ?? { status: 'running' };
    },
  };

  return { order, persistedRedacted, upsertCalls, failureInputs, deps };
}

function validationFailure(): FlowValidationResult {
  const diagnostic: FlowDiagnostic = {
    code: 'FLOW_UNKNOWN_NODE_TYPE',
    severity: 'error',
    message: 'Flow node "node-ghost-1" uses an unknown node type.',
    nodeId: 'node-ghost-1',
  };
  return { valid: false, diagnostics: [diagnostic] };
}

function compileFailure(): CompileFlowResult {
  const diagnostic: FlowDiagnostic = {
    code: 'FLOW_NO_SINK',
    severity: 'error',
    message: 'Flow must have at least one sink node.',
  };
  return { ok: false, artifact: undefined, diagnostics: [diagnostic] };
}

function ekuiperRejection(): EkuiperValidationResult {
  const diagnostic: FlowDiagnostic = {
    code: 'FLOW_EKUIPER_VALIDATION_FAILED',
    severity: 'error',
    message: 'eKuiper rejected the compiled rule: missing server property',
  };
  return { valid: false, diagnostics: [diagnostic] };
}

beforeEach(() => {
  mockedGetNodeWithAuthorization.mockReset();
  mockedAssertDestination.mockReset();
  mockedAssertDestination.mockResolvedValue(undefined);
  jest.restoreAllMocks();
});

describe('deployFlow service (FS-0087)', () => {
  it('returns model validation failure with no runtime mutation and no attempt', async () => {
    const harness = buildHarness({ validation: validationFailure() });

    const result = await deployFlow({ flowId: 'flow-1' }, harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a validation failure');
    expect(result.valid).toBe(false);
    expect(result.stage).toBe('validation');
    expect(result.deployment).toBeNull();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.nodeId).toBe('node-ghost-1');
    // Validation failure stops before compile/attempt/ekuiper/upsert/status.
    expect(harness.order).toEqual([
      'loadFlow',
      'loadDraft',
      'loadTarget',
      'resolveProfile',
      'buildRegistry',
      'validate',
    ]);
    expect(harness.upsertCalls).toHaveLength(0);
    expect(harness.persistedRedacted).toHaveLength(0);
  });

  it('returns compile failure with no runtime mutation and no attempt', async () => {
    const harness = buildHarness({ compile: compileFailure() });

    const result = await deployFlow({ flowId: 'flow-1' }, harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a compile failure');
    expect(result.stage).toBe('compile');
    expect(result.deployment).toBeNull();
    expect(result.diagnostics[0]?.code).toBe('FLOW_NO_SINK');
    expect(harness.order).toEqual([
      'loadFlow',
      'loadDraft',
      'loadTarget',
      'resolveProfile',
      'buildRegistry',
      'validate',
      'compile',
    ]);
    expect(harness.upsertCalls).toHaveLength(0);
  });

  it('marks the attempt failed on eKuiper validation rejection without upserting', async () => {
    const harness = buildHarness({ ekuiperValidation: ekuiperRejection() });

    const result = await deployFlow({ flowId: 'flow-1' }, harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected an eKuiper validation failure');
    expect(result.stage).toBe('ekuiper-validation');
    expect(result.diagnostics[0]?.code).toBe('FLOW_EKUIPER_VALIDATION_FAILED');
    expect(result.deployment?.status).toBe('failed');
    // Official validation runs after the attempt exists but before any
    // runtime mutation; the rejection path never reaches upsert/status.
    expect(harness.order).toEqual([
      'loadFlow',
      'loadDraft',
      'loadTarget',
      'resolveProfile',
      'buildRegistry',
      'validate',
      'compile',
      'createAttempt',
      'ekuiperValidate',
      'markFailed',
    ]);
    expect(harness.upsertCalls).toHaveLength(0);
  });

  it('records a failed attempt on upsert failure and never marks success', async () => {
    const harness = buildHarness({ upsertError: new Error('connection reset') });

    await expect(deployFlow({ flowId: 'flow-1' }, harness.deps)).rejects.toMatchObject({
      status: 502,
    });

    expect(harness.order).toEqual([
      'loadFlow',
      'loadDraft',
      'loadTarget',
      'resolveProfile',
      'buildRegistry',
      'validate',
      'compile',
      'createAttempt',
      'ekuiperValidate',
      'upsert',
      'markFailed',
    ]);
    expect(harness.failureInputs).toHaveLength(1);
    // The previous successful deployment row is untouched: success is
    // never recorded on this path and no delete ever runs.
    expect(harness.order).not.toContain('markSucceeded');
    expect(harness.order).not.toContain('readStatus');
  });

  it('upserts the full definition, confirms status, and records runtime map and hash', async () => {
    const harness = buildHarness();

    const result = await deployFlow(
      { flowId: 'flow-1', createdBy: 'user-1' },
      harness.deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a successful deployment');
    expect(result.valid).toBe(true);
    expect(result.targetNodeId).toBe('node-1');
    expect(result.ruleStatus).toEqual({ status: 'running' });
    // Success record retains the deploy-critical fields.
    expect(result.deployment.status).toBe('succeeded');
    expect(result.deployment.semanticHash).toBe('sem-hash-1');
    expect(result.deployment.compilerVersion).toBe(1);
    expect(result.deployment.runtimeNodeMap).toEqual({
      'node-source-1': 'source_abc',
      'node-sink-1': 'sink_def',
    });
    // Full compile -> validate -> upsert -> confirm ordering.
    expect(harness.order).toEqual([
      'loadFlow',
      'loadDraft',
      'loadTarget',
      'resolveProfile',
      'buildRegistry',
      'validate',
      'compile',
      'createAttempt',
      'ekuiperValidate',
      'upsert',
      'readStatus',
      'markSucceeded',
    ]);
    // The runtime receives the complete compiled definition, while the
    // persisted attempt carries only the redacted copy.
    expect(harness.upsertCalls).toHaveLength(1);
    expect(harness.upsertCalls[0]?.targetNodeId).toBe('node-1');
    expect(harness.upsertCalls[0]?.ruleId).toBe('flow-1');
    const sent = JSON.stringify(harness.upsertCalls[0]?.ruleDefinition);
    expect(sent).toContain('live-token');
    expect(harness.persistedRedacted).toHaveLength(1);
    const stored = JSON.stringify(harness.persistedRedacted[0]);
    expect(stored).not.toContain('live-token');
  });

  it('rejects missing flow and invalid input without side effects', async () => {
    const missingFlow = buildHarness({ flow: null });
    await expect(deployFlow({ flowId: 'missing' }, missingFlow.deps)).rejects.toMatchObject({
      status: 404,
      code: 'FLOW_NOT_FOUND',
    });
    expect(missingFlow.order).toEqual(['loadFlow']);

    const harness = buildHarness();
    await expect(deployFlow({ flowId: '   ' }, harness.deps)).rejects.toThrow(
      'flowId is required',
    );
    expect(harness.order).toEqual([]);

    const missingTarget = buildHarness({ target: null });
    await expect(
      deployFlow({ flowId: 'flow-1' }, missingTarget.deps),
    ).rejects.toMatchObject({ status: 404, code: 'NODE_NOT_FOUND' });
    expect(missingTarget.order).toEqual(['loadFlow', 'loadDraft', 'loadTarget']);
  });
});

describe('default rule transport (registered-node boundary)', () => {
  function registeredNode(authorization: string | null = 'Bearer stored-token') {
    return {
      node: {
        ...buildTargetNode(),
        hasAuthorization: authorization !== null,
      },
      authorization,
    };
  }

  it('upserts with PUT /rules/{id} on the registered node, never a caller URL', async () => {
    mockedGetNodeWithAuthorization.mockResolvedValue(registeredNode());
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const stubFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), init: init ?? {} });
      return new Response('Rule flow-1 was created successfully.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    };

    await defaultUpsertRule(
      { targetNodeId: 'node-1', ruleId: 'flow-1', ruleDefinition: { graph: { nodes: {} } } },
      stubFetch,
    );

    expect(mockedGetNodeWithAuthorization).toHaveBeenCalledWith('node-1');
    expect(mockedAssertDestination).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('http://edge-node:9081/rules/flow-1');
    expect(seen[0]?.init.method).toBe('PUT');
    expect((seen[0]?.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer stored-token',
    );
    const body = JSON.parse(String(seen[0]?.init.body)) as Record<string, unknown>;
    expect(body.id).toBe('flow-1');
    expect(body.graph).toEqual({ nodes: {} });
  });

  it('throws a server-safe error when the upsert is rejected', async () => {
    mockedGetNodeWithAuthorization.mockResolvedValue(registeredNode());
    const stubFetch = async () =>
      new Response('bad rule', { status: 400, headers: { 'Content-Type': 'text/plain' } });

    const error = await defaultUpsertRule(
      { targetNodeId: 'node-1', ruleId: 'flow-1', ruleDefinition: { graph: {} } },
      stubFetch,
    ).catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
  });

  it('confirms status with GET /v2/rules/{id}/status like the existing client', async () => {
    mockedGetNodeWithAuthorization.mockResolvedValue(registeredNode());
    const seen: string[] = [];
    const stubFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String(input));
      expect(init?.method).toBe('GET');
      return new Response('{"status":"running","message":""}', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    };

    const status = await defaultFetchRuleStatus(
      { targetNodeId: 'node-1', ruleId: 'flow-1' },
      stubFetch,
    );

    expect(seen).toEqual(['http://edge-node:9081/v2/rules/flow-1/status']);
    expect(status).toEqual({ status: 'running', message: '' });
  });
});

describe('deployFlow connection health gate (FS-0155)', () => {
  function unhealthyStatus() {
    return {
      status: 'running',
      message: '',
      source_mqtt_0_connection_status: -1,
      source_mqtt_0_exceptions_total: 16,
      source_mqtt_0_last_exception:
        'found error when connecting for tcp://127.0.0.1:1883 with password=supersecret123',
      source_mqtt_0_records_in_total: 0,
    };
  }

  it('marks the attempt FAILED when running status reports connection_status -1', async () => {
    const harness = buildHarness();
    const delayCalls: number[] = [];
    harness.deps.delay = async (ms: number) => {
      delayCalls.push(ms);
    };
    harness.deps.fetchRuleStatus = async () => {
      harness.order.push('readStatus');
      return unhealthyStatus();
    };

    const error = await deployFlow({ flowId: 'flow-1' }, harness.deps).catch(
      (failure: unknown) => failure,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).code).toBe('EKRULE_CONNECTION_UNHEALTHY');
    // The engine exception is surfaced but credential material is redacted.
    expect((error as ApiError).message).toContain('found error when connecting');
    expect((error as ApiError).message).toContain('[redacted]');
    expect((error as ApiError).message).not.toContain('supersecret123');
    // Failed health check marks the attempt failed and never succeeds:
    // the append-only table keeps the previous successful row active.
    expect(harness.order).toContain('markFailed');
    expect(harness.order).not.toContain('markSucceeded');
    expect(harness.failureInputs).toHaveLength(1);
    expect(String(harness.failureInputs[0])).not.toContain('supersecret123');
  });

  it('treats a "-1" string connection_status and sink last_exception as unhealthy', () => {
    expect(
      getUnhealthyConnectionDetail({
        status: 'running',
        sink_rest_0_connection_status: '-1',
      }),
    ).not.toBeNull();
    expect(
      getUnhealthyConnectionDetail({
        status: 'running',
        sink_mqtt_0_last_exception: 'dial tcp: connection refused',
      }),
    ).not.toBeNull();
    expect(
      getUnhealthyConnectionDetail({
        status: 'running',
        source_mqtt_0_connection_status: 0,
        source_mqtt_0_last_exception: '',
      }),
    ).toBeNull();
    expect(getUnhealthyConnectionDetail({ status: 'running' })).toBeNull();
  });

  it('still succeeds for a healthy deployment within the settle window', async () => {
    const harness = buildHarness();
    let reads = 0;
    harness.deps.delay = async () => {};
    harness.deps.fetchRuleStatus = async () => {
      reads += 1;
      harness.order.push('readStatus');
      return {
        status: 'running',
        source_mqtt_0_connection_status: 0,
        source_mqtt_0_last_exception: '',
      };
    };

    const result = await deployFlow({ flowId: 'flow-1' }, harness.deps);

    expect(result.ok).toBe(true);
    expect(reads).toBe(1);
    expect(harness.order).toContain('markSucceeded');
  });

  it('recovers when a connection becomes healthy inside the window instead of sampling once', async () => {
    const harness = buildHarness();
    const delayCalls: number[] = [];
    harness.deps.delay = async (ms: number) => {
      delayCalls.push(ms);
    };
    const bodies = [unhealthyStatus(), { status: 'running' }];
    harness.deps.fetchRuleStatus = async () => {
      harness.order.push('readStatus');
      return bodies.shift() ?? { status: 'running' };
    };

    const result = await deployFlow({ flowId: 'flow-1' }, harness.deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success after settle');
    expect(harness.order.filter((entry) => entry === 'readStatus')).toHaveLength(2);
    expect(delayCalls).toHaveLength(1);
    expect(harness.order).toContain('markSucceeded');
    expect(harness.order).not.toContain('markFailed');
  });

  it('keeps the polling window bounded, not unbounded', async () => {
    expect(FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS).toBeGreaterThan(1);
    expect(FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS).toBeLessThanOrEqual(10);
    expect(FLOW_DEPLOY_CONNECTION_POLL_INTERVAL_MS).toBeGreaterThan(0);
    expect(FLOW_DEPLOY_CONNECTION_SETTLE_MS).toBe(
      FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS * FLOW_DEPLOY_CONNECTION_POLL_INTERVAL_MS,
    );

    const harness = buildHarness();
    const delayCalls: number[] = [];
    harness.deps.delay = async (ms: number) => {
      delayCalls.push(ms);
    };
    harness.deps.fetchRuleStatus = async () => {
      harness.order.push('readStatus');
      return unhealthyStatus();
    };

    await deployFlow({ flowId: 'flow-1' }, harness.deps).catch(() => undefined);

    // Persistently unhealthy: exactly MAX_ATTEMPTS reads and MAX_ATTEMPTS-1
    // settles — proof the loop terminates instead of polling forever.
    expect(harness.order.filter((entry) => entry === 'readStatus')).toHaveLength(
      FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS,
    );
    expect(delayCalls).toHaveLength(FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS - 1);
  });
});
