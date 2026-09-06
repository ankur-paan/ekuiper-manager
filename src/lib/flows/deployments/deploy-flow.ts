import { ApiError } from '@/lib/api';
import { parseEKuiperJson, redactEKuiperSecrets } from '@/lib/ekuiper/wire';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNode, getNodeWithAuthorization, type ManagedNode } from '@/lib/nodes';
import type { TargetCapabilityProfile } from '../capabilities/types';
import { resolveTargetCapabilities } from '../capabilities/resolve-capabilities';
import { compileFlowToEkuiperGraph } from '../compiler/ekuiper/compile-graph';
import type { CompileFlowResult } from '../compiler/types';
import { FLOW_DOCUMENT_VERSION, type FlowDocument } from '../model/flow-document';
import type { FlowDiagnostic } from '../model/diagnostic';
import { getFlowDraft } from '../persistence/flow-draft-repository';
import { getFlow } from '../persistence/flow-repository';
import type { FlowDraftRecord, FlowRecord } from '../persistence/types';
import { createBuiltinNodeRegistry } from '../registry/builtin-registry';
import type { NodeRegistry } from '../registry/node-registry';
import {
  validateFlowServerSide,
  type FlowValidationResult,
  type ValidateFlowServerSideInput,
} from '../validation/validate-flow';
import {
  createDeploymentAttempt,
  markDeploymentFailed,
  markDeploymentSucceeded,
  sanitizeDeploymentError,
  type CreateDeploymentAttemptInput,
} from './deployment-repository';
import type { FlowDeploymentRecord } from './types';
import {
  validateCompiledArtifactWithEkuiper,
  type EkuiperValidationResult,
  type ValidateCompiledArtifactInput,
} from './ekuiper-validation';

/**
 * Flow deployment service: compile -> validate -> upsert -> confirm (FS-0087).
 *
 * Deployment sequence (DATA_API_DEPLOYMENT_SPEC section 8):
 * 1. load the flow row and current draft server-side (never trusts a
 *    client-supplied document);
 * 2. resolve the registered target node's capability profile from its
 *    stored row (`version`, `status`); no live eKuiper call is made here;
 * 3. run authoritative server validation (stages 1-5); user-correctable
 *    failures return `{ ok: false, valid: false }` with structured
 *    diagnostics and create NO deployment attempt and NO runtime mutation;
 * 4. compile deterministically (stages 6-7); compile failures behave the
 *    same way;
 * 5. create one `pending` deployment attempt carrying ONLY the redacted
 *    compiled definition (the full payload exists transiently for the
 *    eKuiper requests below and is never persisted);
 * 6. submit the compiled artifact to official eKuiper validation
 *    (`POST /rules/validate` on the registered node); a rejection marks
 *    the attempt failed and never mutates the runtime;
 * 7. upsert the runtime rule with the audited create-or-update behavior
 *    (`PUT /rules/{name}`, operationId `upsertRule` in
 *    `public/ekuiper-openapi.json` v2.4.1, mirroring the
 *    `EKuiperClient.updateRule` PUT convention); the audited contract notes
 *    a failed update keeps the original rule running, so the previous
 *    successful deployment row stays active;
 * 8. read back rule status (`GET /v2/rules/{name}/status`, the
 *    `EKuiperClient.getRuleStatus` path) before marking success;
 * 9. only then mark the attempt succeeded. Failure at any post-attempt
 *    stage marks the attempt failed and never marks success early.
 *
 * The table is append-only: prior rows are never overwritten or deleted,
 * so a failed attempt never replaces the latest successful deployment.
 * Only a registered managed-node id is accepted; there is no URL/baseUrl
 * parameter anywhere in this module.
 */

export type DeployFlowStage =
  | 'validation'
  | 'compile'
  | 'ekuiper-validation';

export interface DeployFlowSuccess {
  ok: true;
  valid: true;
  diagnostics: [];
  /** The succeeded deployment attempt (terminal row, never rewritten). */
  deployment: FlowDeploymentRecord;
  /** Parsed `GET /v2/rules/{name}/status` body confirming the runtime. */
  ruleStatus: unknown;
  targetNodeId: string;
}

export interface DeployFlowValidationFailure {
  ok: false;
  valid: false;
  diagnostics: FlowDiagnostic[];
  stage: DeployFlowStage;
  /**
   * The failed attempt for `ekuiper-validation` rejections, otherwise null:
   * model/compile failures create no attempt at all.
   */
  deployment: FlowDeploymentRecord | null;
  targetNodeId: string;
}

export type DeployFlowResult = DeployFlowSuccess | DeployFlowValidationFailure;

export interface DeployFlowInput {
  flowId: unknown;
  /**
   * Optional explicit registered-node id. When omitted the flow's stored
   * target is used. Either way the value must reference a registered
   * managed node; raw URLs are never accepted.
   */
  targetNodeId?: unknown;
  createdBy?: unknown;
}

export type DeployFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface UpsertRuleArgs {
  targetNodeId: string;
  ruleId: string;
  ruleDefinition: Record<string, unknown>;
}

export interface FetchRuleStatusArgs {
  targetNodeId: string;
  ruleId: string;
}

export interface DeployFlowDependencies {
  loadFlow?: (flowId: string) => Promise<FlowRecord | null>;
  loadDraft?: (flowId: string) => Promise<FlowDraftRecord | null>;
  loadTarget?: (targetNodeId: string) => Promise<ManagedNode | null>;
  resolveProfile?: (target: ManagedNode) => TargetCapabilityProfile;
  buildRegistry?: () => NodeRegistry;
  runServerValidation?: (input: ValidateFlowServerSideInput) => FlowValidationResult;
  runCompile?: (document: FlowDocument) => CompileFlowResult;
  redactCompiledDefinition?: (
    definition: Record<string, unknown>,
  ) => Record<string, unknown>;
  recordAttempt?: (
    input: CreateDeploymentAttemptInput,
  ) => Promise<FlowDeploymentRecord>;
  recordSuccess?: (id: string) => Promise<FlowDeploymentRecord | null>;
  recordFailure?: (id: string, error?: unknown) => Promise<FlowDeploymentRecord | null>;
  runEkuiperValidation?: (
    input: ValidateCompiledArtifactInput,
  ) => Promise<EkuiperValidationResult>;
  upsertRule?: (args: UpsertRuleArgs) => Promise<void>;
  fetchRuleStatus?: (args: FetchRuleStatusArgs) => Promise<unknown>;
  /** Transport for the default upsert/status implementations. */
  fetcher?: DeployFetcher;
}

function normalizeRequiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('targetNodeId must be a non-empty string');
  }
  return value.trim();
}

function ekuiperTimeoutMs(): number {
  return Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000);
}

function toTransportApiError(error: unknown, fallbackCode: string): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return new ApiError(504, 'eKuiper did not respond in time', 'NODE_TIMEOUT');
  }
  if (error instanceof TypeError) {
    return new ApiError(502, 'eKuiper could not be reached', 'NODE_UNREACHABLE');
  }
  return new ApiError(
    502,
    sanitizeDeploymentError(error instanceof Error ? error.message : 'eKuiper request failed'),
    fallbackCode,
  );
}

function defaultResolveProfile(target: ManagedNode): TargetCapabilityProfile {
  return resolveTargetCapabilities({
    version: target.version,
    reachable: target.status === 'ONLINE',
  });
}

function defaultRedactCompiledDefinition(
  definition: Record<string, unknown>,
): Record<string, unknown> {
  // The REST sink `headers` object is compiled verbatim and can carry
  // bearer tokens/API keys, so only this redacted copy is persisted.
  // The full definition is still sent to eKuiper at deploy time.
  const redacted: unknown = redactEKuiperSecrets(definition);
  if (typeof redacted !== 'object' || redacted === null || Array.isArray(redacted)) {
    throw new Error('redacted compiled definition must be an object');
  }
  return redacted as Record<string, unknown>;
}

/**
 * Default runtime upsert over the registered-node transport.
 *
 * Audited behavior (`public/ekuiper-openapi.json`, eKuiper 2.4.1):
 * `PUT /rules/{name}` is "Create or update a rule" (operationId
 * `upsertRule`); the body id, when supplied, must equal the path name.
 * Any 2xx is success. The caller supplies only a registered node id; the
 * destination and credential always come from the managed-node row behind
 * the same SSRF boundary as the proxy and the FS-0086 validation adapter.
 */
export async function defaultUpsertRule(
  args: UpsertRuleArgs,
  fetcher?: DeployFetcher,
): Promise<void> {
  const { node, authorization } = await getNodeWithAuthorization(args.targetNodeId);
  const target = new URL(`/rules/${encodeURIComponent(args.ruleId)}`, node.baseUrl);
  await assertSafeNodeDestination(target);
  // Fresh envelope; the compiled artifact object is only spread, never mutated.
  const requestBody = { id: args.ruleId, ...args.ruleDefinition };
  const doFetch = fetcher ?? globalThis.fetch.bind(globalThis);
  let response: Response;
  try {
    response = await doFetch(target, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain;q=0.9',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(ekuiperTimeoutMs()),
    });
  } catch (error) {
    throw toTransportApiError(error, 'EKRULE_UPSERT_FAILED');
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const detail = bodyText.trim();
    throw new ApiError(
      502,
      sanitizeDeploymentError(
        detail.length > 0
          ? `eKuiper rule upsert returned HTTP ${response.status}: ${detail}`
          : `eKuiper rule upsert returned HTTP ${response.status}`,
      ),
      'EKRULE_UPSERT_FAILED',
    );
  }
}

/**
 * Default post-mutation confirmation read over the registered-node
 * transport. Uses `GET /v2/rules/{name}/status`, the same typed-status
 * path as `EKuiperClient.getRuleStatus`. The v2.4.1 handler answers
 * text/plain JSON, so the body is parsed as JSON explicitly.
 */
export async function defaultFetchRuleStatus(
  args: FetchRuleStatusArgs,
  fetcher?: DeployFetcher,
): Promise<unknown> {
  const { node, authorization } = await getNodeWithAuthorization(args.targetNodeId);
  const target = new URL(`/v2/rules/${encodeURIComponent(args.ruleId)}/status`, node.baseUrl);
  await assertSafeNodeDestination(target);
  const doFetch = fetcher ?? globalThis.fetch.bind(globalThis);
  let response: Response;
  try {
    response = await doFetch(target, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(ekuiperTimeoutMs()),
    });
  } catch (error) {
    throw toTransportApiError(error, 'EKRULE_STATUS_FAILED');
  }
  if (response.status === 404) {
    throw new ApiError(
      502,
      'eKuiper did not report the deployed rule',
      'EKRULE_STATUS_MISSING',
    );
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const detail = bodyText.trim();
    throw new ApiError(
      502,
      sanitizeDeploymentError(
        detail.length > 0
          ? `eKuiper rule status returned HTTP ${response.status}: ${detail}`
          : `eKuiper rule status returned HTTP ${response.status}`,
      ),
      'EKRULE_STATUS_FAILED',
    );
  }
  const bodyText = await response.text().catch(() => '');
  return parseEKuiperJson(bodyText);
}

/**
 * Deploy one flow's current server-side draft to its registered eKuiper
 * target: server validate -> compile -> attempt -> official eKuiper
 * validate -> upsert -> confirm status -> mark success.
 *
 * User-correctable failures (model, compile, eKuiper validation) resolve
 * to `{ ok: false, valid: false }` with structured diagnostics, never an
 * HTTP-style throw. Transport/upsert/status failures throw a server-safe
 * `ApiError` only AFTER the pending attempt has been marked failed, so a
 * failed deploy never reads as successful and never disturbs the latest
 * successful deployment row.
 */
export async function deployFlow(
  input: DeployFlowInput,
  dependencies: DeployFlowDependencies = {},
): Promise<DeployFlowResult> {
  const flowId = normalizeRequiredText(input.flowId, 'flowId');
  const explicitTarget =
    input.targetNodeId === undefined ? null : normalizeOptionalText(input.targetNodeId);
  const createdBy =
    input.createdBy === undefined || input.createdBy === null
      ? undefined
      : normalizeRequiredText(input.createdBy, 'createdBy');

  const loadFlow = dependencies.loadFlow ?? getFlow;
  const flow = await loadFlow(flowId);
  if (!flow) {
    throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
  }

  const loadDraft = dependencies.loadDraft ?? getFlowDraft;
  const draft = await loadDraft(flowId);
  if (!draft) {
    throw new ApiError(404, 'Flow draft not found', 'FLOW_DRAFT_NOT_FOUND');
  }

  const targetNodeId = explicitTarget ?? flow.targetNodeId;
  if (targetNodeId === null) {
    throw new ApiError(409, 'Add an eKuiper node first', 'NODE_REQUIRED');
  }
  const loadTarget = dependencies.loadTarget ?? getNode;
  const target = await loadTarget(targetNodeId);
  if (!target) {
    throw new ApiError(404, 'eKuiper node not found', 'NODE_NOT_FOUND');
  }

  const capabilityProfile = (dependencies.resolveProfile ?? defaultResolveProfile)(target);
  const registry = (dependencies.buildRegistry ?? createBuiltinNodeRegistry)();
  const document = {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: {
      id: flow.id,
      name: flow.name,
      ...(flow.description === null ? {} : { description: flow.description }),
    },
    spec: draft.semanticDocument,
    layout: draft.layoutDocument,
  };

  const validation = (dependencies.runServerValidation ?? validateFlowServerSide)({
    document,
    registry,
    capabilityProfile,
  });
  if (!validation.valid) {
    return {
      ok: false,
      valid: false,
      diagnostics: validation.diagnostics,
      stage: 'validation',
      deployment: null,
      targetNodeId,
    };
  }

  const compiled = (dependencies.runCompile ?? compileFlowToEkuiperGraph)(
    document as FlowDocument,
  );
  if (!compiled.ok) {
    return {
      ok: false,
      valid: false,
      diagnostics: compiled.diagnostics,
      stage: 'compile',
      deployment: null,
      targetNodeId,
    };
  }
  const artifact = compiled.artifact;

  const redactedCompiledDefinition = (
    dependencies.redactCompiledDefinition ?? defaultRedactCompiledDefinition
  )(artifact.ruleDefinition);

  const recordAttempt = dependencies.recordAttempt ?? createDeploymentAttempt;
  const attempt = await recordAttempt({
    flowId: flow.id,
    targetNodeId,
    semanticHash: artifact.semanticHash,
    compilerVersion: artifact.compilerVersion,
    ruleId: artifact.ruleId,
    redactedCompiledDefinition,
    runtimeNodeMap: artifact.runtimeNodeMap,
    ...(createdBy === undefined ? {} : { createdBy }),
  });

  const recordFailure = dependencies.recordFailure ?? markDeploymentFailed;
  const recordSuccess = dependencies.recordSuccess ?? markDeploymentSucceeded;

  const ekuiperValidation = await (
    dependencies.runEkuiperValidation ?? validateCompiledArtifactWithEkuiper
  )({
    targetNodeId,
    ruleId: artifact.ruleId,
    ruleDefinition: artifact.ruleDefinition,
  });
  if (!ekuiperValidation.valid) {
    const failed = await recordFailure(
      attempt.id,
      ekuiperValidation.diagnostics[0]?.message ?? 'eKuiper rejected the compiled rule',
    );
    return {
      ok: false,
      valid: false,
      diagnostics: ekuiperValidation.diagnostics,
      stage: 'ekuiper-validation',
      deployment: failed,
      targetNodeId,
    };
  }

  const fetcher = dependencies.fetcher;
  const upsertRule =
    dependencies.upsertRule ?? ((args: UpsertRuleArgs) => defaultUpsertRule(args, fetcher));
  try {
    await upsertRule({
      targetNodeId,
      ruleId: artifact.ruleId,
      ruleDefinition: artifact.ruleDefinition,
    });
  } catch (error) {
    await recordFailure(attempt.id, error);
    throw toTransportApiError(error, 'EKRULE_UPSERT_FAILED');
  }

  const fetchRuleStatus =
    dependencies.fetchRuleStatus ??
    ((args: FetchRuleStatusArgs) => defaultFetchRuleStatus(args, fetcher));
  let ruleStatus: unknown;
  try {
    ruleStatus = await fetchRuleStatus({ targetNodeId, ruleId: artifact.ruleId });
  } catch (error) {
    await recordFailure(attempt.id, error);
    throw toTransportApiError(error, 'EKRULE_STATUS_FAILED');
  }

  const succeeded = await recordSuccess(attempt.id);
  if (!succeeded) {
    throw new ApiError(
      500,
      'Deployment could not be confirmed',
      'DEPLOYMENT_CONFIRM_FAILED',
    );
  }

  return {
    ok: true,
    valid: true,
    diagnostics: [],
    deployment: succeeded,
    ruleStatus,
    targetNodeId,
  };
}
