import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiErrorResponse, requireUser } from '@/lib/api';
import { defaultFetchRuleStatus } from '@/lib/flows/deployments/deploy-flow';
import { getLatestSuccessfulDeployment } from '@/lib/flows/deployments/deployment-repository';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import { mapRuleStatusToSnapshot } from '@/lib/flows/runtime/map-metrics';

export const dynamic = 'force-dynamic';

/**
 * Read-only bounded runtime metrics snapshot for one flow (FS-0103).
 *
 * - Reuses the repository auth (`requireUser`) boundary; unauthenticated
 *   requests are rejected before any lookup. Read-only GET, so no
 *   same-origin mutation guard and no audit row (matching the sibling
 *   flow/deployment/runtime GET routes).
 * - Loads the flow row server-side and resolves the latest `succeeded`
 *   deployment for the flow's current target. No database writes occur.
 * - A flow with no successful deployment (or a deployment with no target
 *   node) resolves to HTTP 200 with an empty `nodes` map, never fabricated
 *   metrics.
 * - Otherwise performs a single rule-status read over the registered-node
 *   transport (`GET /v2/rules/{name}/status`, the `defaultFetchRuleStatus`
 *   path) and maps it through the persisted `runtimeNodeMap` to one
 *   bounded `FlowRuntimeSnapshot`. Transport failures propagate as
 *   server-safe HTTP errors via `apiErrorResponse`; no credentials, base
 *   URLs, or arbitrary URLs escape into the payload.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request);
    const { id } = await params;
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new ApiError(400, 'Flow id is required', 'INVALID_FLOW_ID');
    }
    const normalizedFlowId = id.trim();

    const flow = await getFlow(normalizedFlowId);
    if (!flow) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }

    const deployment = await getLatestSuccessfulDeployment(flow.id, flow.targetNodeId);
    if (!deployment) {
      return NextResponse.json({
        snapshot: {
          flowId: flow.id,
          capturedAt: new Date().toISOString(),
          nodes: {},
        },
        deployed: false,
        deploymentId: null,
        ruleId: null,
      });
    }

    if (deployment.targetNodeId === null) {
      return NextResponse.json({
        snapshot: {
          flowId: flow.id,
          capturedAt: new Date().toISOString(),
          nodes: {},
        },
        deployed: true,
        deploymentId: deployment.id,
        ruleId: deployment.ruleId,
      });
    }

    const ruleStatus = await defaultFetchRuleStatus({
      targetNodeId: deployment.targetNodeId,
      ruleId: deployment.ruleId,
    });
    const snapshot = mapRuleStatusToSnapshot({
      flowId: flow.id,
      runtimeNodeMap: deployment.runtimeNodeMap,
      ruleStatus,
    });
    return NextResponse.json({
      snapshot,
      deployed: true,
      deploymentId: deployment.id,
      ruleId: deployment.ruleId,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
