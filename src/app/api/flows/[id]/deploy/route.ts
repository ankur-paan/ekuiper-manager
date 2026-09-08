import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { deployFlow, undeployFlow } from '@/lib/flows/deployments/deploy-flow';

export const dynamic = 'force-dynamic';

/**
 * Keys that must never be accepted by the deploy endpoint (FS-0088).
 *
 * The endpoint takes no arbitrary compiled JSON and no target URL: the
 * server always loads the current draft server-side and only talks to a
 * registered managed node. Any body carrying a rule payload or a URL is
 * rejected before the deployment service runs.
 */
const FORBIDDEN_DEPLOY_BODY_KEYS = new Set([
  'ruledefinition',
  'rule_definition',
  'compileddefinition',
  'compiled_definition',
  'rule',
  'graph',
  'definition',
  'targeturl',
  'target_url',
  'baseurl',
  'base_url',
  'url',
  'nodeurl',
  'node_url',
  'endpoint',
]);

/**
 * Read the optional deploy request body (FS-0088).
 *
 * The body may be absent entirely (deploy to the flow's stored target).
 * When present it must be a JSON object containing only `targetNodeId`.
 * Raw text is read first so an empty body resolves to `{}` instead of a
 * JSON parse error; a non-empty body must parse as a JSON object.
 */
async function readOptionalDeployBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.trim().length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError(400, 'Request body must be a JSON object', 'INVALID_JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, 'Request body must be a JSON object', 'INVALID_JSON');
  }
  return parsed as Record<string, unknown>;
}

/**
 * Resolve the optional explicit registered-node id (FS-0088).
 *
 * Returns `undefined` when the caller sent no override so the deployment
 * service defaults to the flow's stored target. Any value that looks like
 * a URL is rejected: only a registered managed-node id is accepted, never
 * a caller-supplied URL.
 */
function resolveExplicitTargetNodeId(body: Record<string, unknown>): string | undefined {
  for (const key of Object.keys(body)) {
    if (key !== 'targetNodeId' && FORBIDDEN_DEPLOY_BODY_KEYS.has(key.toLowerCase())) {
      throw new ApiError(
        400,
        'Deploy does not accept compiled rule JSON or target URLs',
        'INVALID_DEPLOY_REQUEST',
      );
    }
    if (key !== 'targetNodeId') {
      throw new ApiError(
        400,
        `Field "${key}" cannot be used for deploy`,
        'INVALID_DEPLOY_REQUEST',
      );
    }
  }
  const value = body.targetNodeId;
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, 'Target node id must be a string', 'INVALID_TARGET_NODE');
  }
  const trimmed = value.trim();
  if (trimmed.includes('://')) {
    throw new ApiError(
      400,
      'Target must be a registered node id, not a URL',
      'INVALID_TARGET_NODE',
    );
  }
  return trimmed;
}

/**
 * Deploy the flow's current server-side draft to its registered eKuiper
 * target (FS-0088).
 *
 * - Reuses the repository auth (`requireUser`) and same-origin mutation
 *   (`assertSameOrigin`) boundaries; unauthenticated and cross-origin
 *   requests are rejected before the service runs.
 * - Accepts no compiled rule JSON and no target URL; the only optional
 *   input is an explicit registered `targetNodeId`, otherwise the flow's
 *   stored target is used by the deployment service.
 * - Delegates to `deployFlow` (FS-0087: server validate -> compile ->
 *   attempt -> official eKuiper validate -> upsert -> confirm status).
 * - User-correctable failures (model, compile, eKuiper validation) resolve
 *   to HTTP 200 with `{ valid: false, diagnostics, stage }`; transport /
 *   runtime failures propagate as server-safe HTTP errors via
 *   `apiErrorResponse` after the attempt has been marked failed.
 * - Audits the attempt outcome with safe identifiers only (flow id,
 *   target node id, stage, deployment id, rule id, semantic hash); the
 *   compiled config is never embedded in audit metadata.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let requestedTargetNodeId: string | undefined;
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request);
    const { id } = await params;

    const body = await readOptionalDeployBody(request);
    requestedTargetNodeId = resolveExplicitTargetNodeId(body);

    let result;
    try {
      result = await deployFlow({
        flowId: id,
        ...(requestedTargetNodeId === undefined
          ? {}
          : { targetNodeId: requestedTargetNodeId }),
        createdBy: actor.id,
      });
    } catch (serviceError) {
      // Runtime/upsert/status failures: audit the failed outcome with safe
      // identifiers only, then surface the server-safe error response.
      // The compiled config is never embedded in audit metadata.
      recordAuditSafely({
        actorId: actor.id,
        action: 'flow.deploy',
        resourceType: 'flow',
        resourceId: id,
        success: false,
        ...(requestedTargetNodeId === undefined
          ? {}
          : { nodeId: requestedTargetNodeId }),
        metadata: {
          ...(requestedTargetNodeId === undefined
            ? {}
            : { targetNodeId: requestedTargetNodeId }),
          errorCode:
            serviceError instanceof ApiError ? serviceError.code : 'DEPLOY_FAILED',
        },
      });
      throw serviceError;
    }

    // Audit the attempt outcome with safe identifiers only. The deployment
    // record itself carries the redacted compiled definition for the API
    // response, but audit metadata keeps ids/hashes/stage only.
    recordAuditSafely({
      actorId: actor.id,
      action: 'flow.deploy',
      resourceType: 'flow',
      resourceId: id,
      success: result.ok,
      nodeId: result.targetNodeId,
      metadata: {
        targetNodeId: result.targetNodeId,
        ...(result.ok
          ? {
              deploymentId: result.deployment.id,
              ruleId: result.deployment.ruleId,
              semanticHash: result.deployment.semanticHash,
              compilerVersion: result.deployment.compilerVersion,
            }
          : {
              stage: result.stage,
              ...(result.deployment === null
                ? {}
                : {
                    deploymentId: result.deployment.id,
                    ruleId: result.deployment.ruleId,
                  }),
            }),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    // Auth/origin/request-shape failures have no deployment outcome to
    // audit; service failures were already audited above. Never embed
    // request bodies or compiled config here.
    return apiErrorResponse(error);
  }
}

/**
 * Undeploy the flow's rule from its registered eKuiper target (AC-D008).
 *
 * - Follows the POST opening sequence exactly: same-origin mutation guard
 *   (`assertSameOrigin`) then repository auth (`requireUser`); no compiled
 *   rule JSON or target URL is accepted (there is no body at all).
 * - Delegates to `undeployFlow`, which resolves the flow and its target
 *   like the deploy path, derives the same deterministic rule id, and
 *   stops + removes the rule on the engine (`POST /rules/{id}/stop` then
 *   `DELETE /rules/{id}`).
 * - Idempotent: a flow with no target, or a rule the engine no longer
 *   has, resolves to success, not an error.
 * - Leaves the flow row, its draft and its revisions intact: undeploy is
 *   not delete. Transport failures propagate as server-safe HTTP errors
 *   via `apiErrorResponse`.
 * - Audits the outcome with safe identifiers only (flow id, target node
 *   id, rule id, whether engine removal ran).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request);
    const { id } = await params;

    const result = await undeployFlow({ flowId: id });

    recordAuditSafely({
      actorId: actor.id,
      action: 'flow.undeploy',
      resourceType: 'flow',
      resourceId: id,
      success: true,
      ...(result.targetNodeId === null ? {} : { nodeId: result.targetNodeId }),
      metadata: {
        targetNodeId: result.targetNodeId,
        ruleId: result.ruleId,
        undeployed: result.undeployed,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
