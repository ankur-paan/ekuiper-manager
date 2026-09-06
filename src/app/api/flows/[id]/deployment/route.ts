import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiErrorResponse, requireUser } from '@/lib/api';
import { getLatestSuccessfulDeployment } from '@/lib/flows/deployments/deployment-repository';
import { getFlowDraft } from '@/lib/flows/persistence/flow-draft-repository';
import { getFlow } from '@/lib/flows/persistence/flow-repository';

export const dynamic = 'force-dynamic';

/**
 * Read-only latest successful deployment summary for one flow (FS-0090).
 *
 * - Reuses the repository auth (`requireUser`) boundary; unauthenticated
 *   requests are rejected before any lookup. Read-only GET, so no
 *   same-origin mutation guard and no audit row (matching the sibling
 *   flow/draft GET routes).
 * - Loads the flow row server-side and resolves the latest `succeeded`
 *   deployment for the flow's current target via
 *   `getLatestSuccessfulDeployment`. Failed/pending attempts never match,
 *   so a later failure does not replace the active deployment.
 * - Returns only a safe summary (ids, semantic hash, compiler version,
 *   timestamps); the compiled rule definition and runtime node map are
 *   never exposed here.
 * - Includes the current saved draft `semanticHash` (when a draft exists)
 *   so the client can compare saved vs deployed hashes directly. The
 *   layout hash is intentionally omitted: layout-only edits never affect
 *   this runtime label.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request);
    const { id } = await params;

    const flow = await getFlow(id);
    if (!flow) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }
    const [draft, deployment] = await Promise.all([
      getFlowDraft(flow.id),
      getLatestSuccessfulDeployment(flow.id, flow.targetNodeId),
    ]);

    return NextResponse.json({
      deployment: deployment
        ? {
            id: deployment.id,
            flowId: deployment.flowId,
            targetNodeId: deployment.targetNodeId,
            semanticHash: deployment.semanticHash,
            compilerVersion: deployment.compilerVersion,
            ruleId: deployment.ruleId,
            createdAt: deployment.createdAt,
          }
        : null,
      draft: draft ? { semanticHash: draft.semanticHash } : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
