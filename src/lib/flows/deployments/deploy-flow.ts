import { ApiError } from '@/lib/api';
import { parseEKuiperJson, redactEKuiperSecrets } from '@/lib/ekuiper/wire';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNode, getNodeWithAuthorization, type ManagedNode } from '@/lib/nodes';
import type { TargetCapabilityProfile } from '../capabilities/types';
import { resolveTargetCapabilities } from '../capabilities/resolve-capabilities';
import { compileFlowToEkuiperGraph, toSafeRuleId } from '../compiler/ekuiper/compile-graph';
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
 *    eKuiper requests below and is never persisted); FS-0093: the attempt
 *    call also carries the current draft layout hash so the repository can
 *    reuse-or-create the exact-current-draft revision (identical
 *    semantic+layout latest revision is reused, otherwise one new revision)
 *    and store its id on the deployment row in the same transaction; the
 *    draft itself is never mutated and a later runtime failure keeps the
 *    failed deployment while the revision remains as history;
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

/**
 * Bounded settle window for post-upsert connection health (FS-0155).
 *
 * A freshly upserted MQTT rule can report `status: running` while its
 * source/sink is still dialling. Sample the typed status
 * (`GET /v2/rules/{name}/status`, `RuleStatus` in
 * `public/ekuiper-openapi.json` v2.4.1 — `additionalProperties: true`
 * carries the per-node `*_connection_status` / `*_last_exception`
 * metrics) a bounded number of times before judging. The window is
 * `MAX_ATTEMPTS * POLL_INTERVAL_MS`; a healthy first read returns
 * immediately with no delay.
 */
export const FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS = 5;
export const FLOW_DEPLOY_CONNECTION_POLL_INTERVAL_MS = 500;
export const FLOW_DEPLOY_CONNECTION_SETTLE_MS =
  FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS * FLOW_DEPLOY_CONNECTION_POLL_INTERVAL_MS;

/** Server-safe code for a deployed rule whose connection never became healthy. */
export const FLOW_DEPLOY_CONNECTION_UNHEALTHY_CODE = 'EKRULE_CONNECTION_UNHEALTHY';

/**
 * Inspect a parsed rule-status body for failed source/sink connections.
 *
 * Returns the raw (unsanitized) engine detail when a `*_connection_status`
 * metric equals -1 (number or "-1" string, covering both the typed v2 and
 * the legacy string serialization) or when a `source_*`/`sink_*`
 * `*_last_exception` metric is a non-empty string. Returns null when no
 * connection metric reports failure. Non-object bodies carry no metrics
 * and are treated as healthy so pre-existing `{status:'running'}` flows
 * keep succeeding. Callers must pass the result through
 * `sanitizeDeploymentError` before persistence or user display.
 */
export function getUnhealthyConnectionDetail(status: unknown): string | null {
  if (typeof status !== 'object' || status === null || Array.isArray(status)) {
    return null;
  }
  const record = status as Record<string, unknown>;
  const problems: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    const normalized = key.toLowerCase();
    if (normalized.endsWith('connection_status')) {
      const failed =
        (typeof value === 'number' && value === -1) ||
        (typeof value === 'string' && value.trim() === '-1');
      if (failed) {
        problems.push(`${key}=-1`);
      }
      continue;
    }
    if (
      normalized.endsWith('last_exception') ||
      normalized.endsWith('lastexception')
    ) {
      const isConnectionMetric =
        normalized.startsWith('source_') || normalized.startsWith('sink_');
      if (!isConnectionMetric) continue;
      if (typeof value === 'string' && value.trim().length > 0) {
        problems.push(`${key}: ${value.trim()}`);
      }
    }
  }
  if (problems.length === 0) return null;
  return `eKuiper reports an unhealthy connection: ${problems.join('; ')}`;
}

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
  /**
   * Injectable settle delay between connection-health polls (FS-0155).
   * Defaults to a real timer; tests inject a no-op and count calls to
   * prove the window is bounded.
   */
  delay?: (ms: number) => Promise<void>;
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

export interface DeleteRuleArgs {
  targetNodeId: string;
  ruleId: string;
}

export interface UndeployFlowInput {
  flowId: unknown;
}

export interface UndeployFlowResult {
  ok: true;
  /**
   * True when the engine removal was attempted (the flow had a target).
   * False when there was nothing to remove (the flow has no target):
   * still success, no engine call is made.
   */
  undeployed: boolean;
  targetNodeId: string | null;
  /** Deterministic rule id, identical to the deploy path (`toSafeRuleId`). */
  ruleId: string;
}

export interface UndeployFlowDependencies {
  loadFlow?: (flowId: string) => Promise<FlowRecord | null>;
  loadTarget?: (targetNodeId: string) => Promise<ManagedNode | null>;
  deleteRule?: (args: DeleteRuleArgs) => Promise<void>;
  /** Transport for the default delete implementation. */
  fetcher?: DeployFetcher;
}

/**
 * Default engine-side rule removal over the registered-node transport
 * (AC-D008).
 *
 * Audited behavior (`public/ekuiper-openapi.json`, eKuiper 2.4.1):
 * `POST /rules/{name}/stop` is "Stop a rule" (operationId `stopRule`)
 * and `DELETE /rules/{name}` is "Delete a rule" (operationId
 * `deleteRule`). The caller supplies only a registered node id; the
 * destination and credential always come from the managed-node row behind
 * the same SSRF boundary as the upsert and status helpers above.
 *
 * Idempotent: a 404 from either call means the rule is already gone and
 * is swallowed, so undeploying a never-deployed flow or an already
 * removed rule succeeds. Any other non-2xx becomes a server-safe
 * `ApiError`; transport failures map through `toTransportApiError`.
 */
/**
 * Is this engine response telling us the rule is already gone?
 *
 * eKuiper 2.4.1 does NOT answer 404 for a missing rule on stop or delete. It answers
 * HTTP 400 with `{"error":1000,"message":"Delete rule error: rule <id> not found"}`.
 * Treating only 404 as "already gone" made undeploy non-idempotent, so the delete path -
 * which undeploys first by design - failed with EKRULE_DELETE_FAILED on any flow that was
 * already undeployed. Measured against a live engine.
 */
function isRuleAlreadyGone(status: number, bodyText: string): boolean {
  if (status === 404) return true;
  return status === 400 && /not found/i.test(bodyText);
}

export async function defaultDeleteRule(
  args: DeleteRuleArgs,
  fetcher?: DeployFetcher,
): Promise<void> {
  const { node, authorization } = await getNodeWithAuthorization(args.targetNodeId);
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain;q=0.9',
    ...(authorization ? { Authorization: authorization } : {}),
  };
  const doFetch = fetcher ?? globalThis.fetch.bind(globalThis);

  const stopTarget = new URL(`/rules/${encodeURIComponent(args.ruleId)}/stop`, node.baseUrl);
  await assertSafeNodeDestination(stopTarget);
  let stopResponse: Response;
  try {
    stopResponse = await doFetch(stopTarget, {
      method: 'POST',
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(ekuiperTimeoutMs()),
    });
  } catch (error) {
    throw toTransportApiError(error, 'EKRULE_STOP_FAILED');
  }
  if (!stopResponse.ok) {
    const bodyText = await stopResponse.text().catch(() => '');
    const detail = bodyText.trim();
    if (!isRuleAlreadyGone(stopResponse.status, bodyText)) {
      throw new ApiError(
        502,
        sanitizeDeploymentError(
          detail.length > 0
            ? `eKuiper rule stop returned HTTP ${stopResponse.status}: ${detail}`
            : `eKuiper rule stop returned HTTP ${stopResponse.status}`,
        ),
        'EKRULE_STOP_FAILED',
      );
    }
  }

  const deleteTarget = new URL(`/rules/${encodeURIComponent(args.ruleId)}`, node.baseUrl);
  await assertSafeNodeDestination(deleteTarget);
  let deleteResponse: Response;
  try {
    deleteResponse = await doFetch(deleteTarget, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(ekuiperTimeoutMs()),
    });
  } catch (error) {
    throw toTransportApiError(error, 'EKRULE_DELETE_FAILED');
  }
  if (!deleteResponse.ok) {
    const bodyText = await deleteResponse.text().catch(() => '');
    const detail = bodyText.trim();
    if (!isRuleAlreadyGone(deleteResponse.status, bodyText)) {
      throw new ApiError(
        502,
        sanitizeDeploymentError(
          detail.length > 0
            ? `eKuiper rule delete returned HTTP ${deleteResponse.status}: ${detail}`
            : `eKuiper rule delete returned HTTP ${deleteResponse.status}`,
        ),
        'EKRULE_DELETE_FAILED',
      );
    }
  }
}

/**
 * Undeploy one flow: stop and remove its rule on the registered eKuiper
 * target (AC-D008).
 *
 * - Loads the flow row server-side and resolves the registered target
 *   exactly as the deploy path does (404 `FLOW_NOT_FOUND` / 409
 *   `NODE_REQUIRED` / 404 `NODE_NOT_FOUND`).
 * - Derives the same deterministic rule id the deploy path uses
 *   (`toSafeRuleId(flow.id)`), so the rule created by any deploy of this
 *   flow is the rule removed here.
 * - A flow with no target has nothing running anywhere: success with
 *   `undeployed: false` and no engine call. An engine 404 is likewise
 *   success (already gone), handled inside `defaultDeleteRule`.
 * - Never touches the flow row, its draft, its revisions, or its
 *   deployment history: this is undeploy, not delete.
 */
export async function undeployFlow(
  input: UndeployFlowInput,
  dependencies: UndeployFlowDependencies = {},
): Promise<UndeployFlowResult> {
  const flowId = normalizeRequiredText(input.flowId, 'flowId');

  const loadFlow = dependencies.loadFlow ?? getFlow;
  const flow = await loadFlow(flowId);
  if (!flow) {
    throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
  }

  const ruleId = toSafeRuleId(flow.id);
  const targetNodeId = flow.targetNodeId;
  if (targetNodeId === null) {
    return { ok: true, undeployed: false, targetNodeId: null, ruleId };
  }

  const loadTarget = dependencies.loadTarget ?? getNode;
  const target = await loadTarget(targetNodeId);
  if (!target) {
    throw new ApiError(404, 'eKuiper node not found', 'NODE_NOT_FOUND');
  }

  const fetcher = dependencies.fetcher;
  const deleteRule =
    dependencies.deleteRule ?? ((args: DeleteRuleArgs) => defaultDeleteRule(args, fetcher));
  await deleteRule({ targetNodeId, ruleId });

  return { ok: true, undeployed: true, targetNodeId, ruleId };
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
    // FS-0093: exact-current-draft revision link. The repository reuses the
    // latest revision when its semantic+layout hashes match this draft and
    // otherwise creates one revision for this deploy request. No draft
    // mutation happens here; the documents are re-read server-side inside
    // the attempt transaction.
    layoutHash: draft.layoutHash,
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
  const delay =
    dependencies.delay ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  // FS-0155: gate success on runtime connection health. `status: running`
  // alone is not evidence the flow works — poll the typed status briefly
  // and fail the attempt when a source/sink reports `connection_status`
  // -1 or a non-empty connection `last_exception`. A healthy first read
  // succeeds immediately; only an unhealthy read pays for the settle
  // window, which stays bounded by FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS.
  let ruleStatus: unknown;
  let unhealthyDetail: string | null = null;
  try {
    for (
      let attemptNumber = 1;
      attemptNumber <= FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS;
      attemptNumber += 1
    ) {
      ruleStatus = await fetchRuleStatus({ targetNodeId, ruleId: artifact.ruleId });
      unhealthyDetail = getUnhealthyConnectionDetail(ruleStatus);
      if (unhealthyDetail === null) break;
      if (attemptNumber < FLOW_DEPLOY_CONNECTION_MAX_ATTEMPTS) {
        await delay(FLOW_DEPLOY_CONNECTION_POLL_INTERVAL_MS);
      }
    }
  } catch (error) {
    await recordFailure(attempt.id, error);
    throw toTransportApiError(error, 'EKRULE_STATUS_FAILED');
  }
  if (unhealthyDetail !== null) {
    const sanitized = sanitizeDeploymentError(unhealthyDetail);
    await recordFailure(attempt.id, sanitized);
    throw new ApiError(502, sanitized, FLOW_DEPLOY_CONNECTION_UNHEALTHY_CODE);
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
