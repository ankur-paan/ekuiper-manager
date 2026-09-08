import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
  requireUser,
} from '@/lib/api';
import { getFlow, deleteFlow, updateFlowMetadata } from '@/lib/flows/persistence/flow-repository';
import { undeployFlow } from '@/lib/flows/deployments/deploy-flow';
import { recordAuditSafely } from '@/lib/audit';
import { getNode } from '@/lib/nodes';

export const dynamic = 'force-dynamic';

function resolveTargetNodeId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Target node id must be a string', 'INVALID_TARGET_NODE');
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

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
    return NextResponse.json({ flow });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request);
    const { id } = await params;
    const body = await readJsonObject(request);

    for (const key of Object.keys(body)) {
      if (key !== 'name' && key !== 'description' && key !== 'targetNodeId') {
        throw new ApiError(400, `Field "${key}" cannot be updated`, 'INVALID_FLOW_UPDATE');
      }
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    const hasTargetNodeId = Object.prototype.hasOwnProperty.call(body, 'targetNodeId');
    if (!hasName && !hasDescription && !hasTargetNodeId) {
      throw new ApiError(400, 'No updatable fields provided', 'INVALID_FLOW_UPDATE');
    }

    if (hasName && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
      throw new ApiError(400, 'Flow name is required', 'INVALID_FLOW_NAME');
    }
    if (
      hasDescription &&
      body.description !== null &&
      typeof body.description !== 'string'
    ) {
      throw new ApiError(400, 'Flow description must be a string', 'INVALID_FLOW_DESCRIPTION');
    }
    const targetNodeId = hasTargetNodeId ? resolveTargetNodeId(body.targetNodeId) : undefined;

    const existing = await getFlow(id);
    if (!existing) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }

    if (targetNodeId) {
      const node = await getNode(targetNodeId);
      if (!node) {
        throw new ApiError(404, 'Target node not found', 'NODE_NOT_FOUND');
      }
    }

    const flow = await updateFlowMetadata(id, {
      ...(hasName ? { name: body.name } : {}),
      ...(hasDescription ? { description: body.description } : {}),
      ...(hasTargetNodeId ? { targetNodeId: body.targetNodeId } : {}),
    });
    if (!flow) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }
    // FS-0030: audit metadata updates with the flow id and safe metadata
    // only (updated field names, not values). Never store raw config/draft
    // JSON or secrets in audit metadata.
    const updatedFields = [
      ...(hasName ? ['name'] : []),
      ...(hasDescription ? ['description'] : []),
      ...(hasTargetNodeId ? ['targetNodeId'] : []),
    ];
    recordAuditSafely({
      actorId: actor.id,
      action: 'flow.update',
      resourceType: 'flow',
      resourceId: flow.id,
      success: true,
      metadata: { updatedFields },
    });
    return NextResponse.json({ flow });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Delete one flow (AC-D008).
 *
 * Follows the DELETE shape in `src/app/api/nodes/[id]/route.ts`:
 * same-origin mutation guard (`assertSameOrigin`), repository auth
 * (`requireUser`), awaited params, repository call, safe audit. The
 * permission level matches PATCH in this file (any signed-in user), not
 * the owner-only level of the nodes route.
 *
 * Undeploys first via the same engine-side removal as
 * `DELETE /api/flows/{id}/deploy` so no rule is orphaned on the engine;
 * that step is idempotent (an already-undeployed flow, or a rule the
 * engine no longer has, still succeeds). A missing managed-node row
 * likewise never blocks the delete: there is no reachable engine left to
 * clean, so the flow row is still removed. Only then is the flow row
 * deleted (drafts, deployments and revisions cascade in the schema).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request);
    const { id } = await params;

    try {
      await undeployFlow({ flowId: id });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NODE_NOT_FOUND') {
        // The registered target row is gone, so no engine is reachable to
        // clean; the flow row below must still be removed.
      } else {
        throw error;
      }
    }

    const deleted = await deleteFlow(id);
    if (!deleted) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }
    recordAuditSafely({
      actorId: actor.id,
      action: 'flow.delete',
      resourceType: 'flow',
      resourceId: id,
      success: true,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
