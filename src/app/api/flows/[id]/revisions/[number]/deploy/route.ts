import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { deployFlow } from '@/lib/flows/deployments/deploy-flow';
import { createDeploymentAttempt } from '@/lib/flows/deployments/deployment-repository';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import { getRevision } from '@/lib/flows/persistence/flow-revision-repository';

export const dynamic = 'force-dynamic';

function parseRevisionNumber(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new ApiError(
      400,
      'Revision number must be a positive integer',
      'INVALID_REVISION_NUMBER',
    );
  }
  return Number(value);
}

/**
 * Keys that must never be accepted by the revision redeploy endpoint.
 *
 * Mirrors the deploy endpoint (FS-0088): no compiled rule JSON and no
 * target URL. The only optional input is an explicit registered
 * `targetNodeId`; the flow documents always come from the stored revision
 * snapshot server-side, never from the request body.
 */
const FORBIDDEN_REDEPLOY_BODY_KEYS = new Set([
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

async function readOptionalRedeployBody(
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

function resolveExplicitTargetNodeId(body: Record<string, unknown>): string | undefined {
  for (const key of Object.keys(body)) {
    if (key !== 'targetNodeId' && FORBIDDEN_REDEPLOY_BODY_KEYS.has(key.toLowerCase())) {
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
 * Redeploy a revision snapshot without touching the current draft (FS-0098).
 *
 * Loads the immutable revision server-side and delegates to `deployFlow`
 * with a snapshot input abstraction: `loadDraft` is overridden to serve
 * the revision's semantic/layout documents (so server validation, compile,
 * capability checks, official eKuiper validation, upsert, and status
 * confirmation all run against the snapshot through the single deployment
 * pipeline — no duplicated eKuiper logic), while `recordAttempt` forces
 * the explicit `revisionId` link so the deployment row references the
 * selected revision instead of reusing/creating a current-draft revision.
 * The current draft is never mutated here.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; number: string }> },
) {
  let requestedTargetNodeId: string | undefined;
  let revisionNumber: number | null = null;
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request);
    const { id, number } = await params;
    revisionNumber = parseRevisionNumber(number);

    const body = await readOptionalRedeployBody(request);
    requestedTargetNodeId = resolveExplicitTargetNodeId(body);

    const flow = await getFlow(id);
    if (!flow) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }
    const revision = await getRevision(id, revisionNumber);
    if (!revision) {
      throw new ApiError(404, 'Flow revision not found', 'FLOW_REVISION_NOT_FOUND');
    }

    let result;
    try {
      result = await deployFlow(
        {
          flowId: id,
          ...(requestedTargetNodeId === undefined
            ? {}
            : { targetNodeId: requestedTargetNodeId }),
          createdBy: actor.id,
        },
        {
          loadDraft: async () => ({
            flowId: id,
            semanticDocument: revision.semanticDocument,
            layoutDocument: revision.layoutDocument,
            semanticHash: revision.semanticHash,
            layoutHash: revision.layoutHash,
            updatedBy: revision.createdBy,
            updatedAt: revision.createdAt,
          }),
          recordAttempt: async (attemptInput) =>
            createDeploymentAttempt({ ...attemptInput, revisionId: revision.id }),
        },
      );
    } catch (serviceError) {
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
          revisionNumber,
          revisionId: revision.id,
          errorCode:
            serviceError instanceof ApiError ? serviceError.code : 'DEPLOY_FAILED',
        },
      });
      throw serviceError;
    }

    recordAuditSafely({
      actorId: actor.id,
      action: 'flow.deploy',
      resourceType: 'flow',
      resourceId: id,
      success: result.ok,
      nodeId: result.targetNodeId,
      metadata: {
        targetNodeId: result.targetNodeId,
        revisionNumber,
        revisionId: revision.id,
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
    return apiErrorResponse(error);
  }
}
