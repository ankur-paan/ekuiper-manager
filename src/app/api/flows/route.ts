import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
  requireUser,
} from '@/lib/api';
import { createFlow, listFlows } from '@/lib/flows/persistence/flow-repository';
import { getNode } from '@/lib/nodes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const flows = await listFlows();
    return NextResponse.json({ flows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function resolveTargetNodeId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Target node id must be a string', 'INVALID_TARGET_NODE');
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request);
    const body = await readJsonObject(request);

    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new ApiError(400, 'Flow name is required', 'INVALID_FLOW_NAME');
    }
    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== 'string'
    ) {
      throw new ApiError(400, 'Flow description must be a string', 'INVALID_FLOW_DESCRIPTION');
    }

    const targetNodeId = resolveTargetNodeId(body.targetNodeId);
    if (targetNodeId) {
      const node = await getNode(targetNodeId);
      if (!node) {
        throw new ApiError(404, 'Target node not found', 'NODE_NOT_FOUND');
      }
    }

    // created_by always comes from the authenticated session; any
    // browser-supplied createdBy/created_by value is ignored.
    const flow = await createFlow({
      name: body.name,
      description: body.description ?? undefined,
      targetNodeId: targetNodeId ?? undefined,
      createdBy: actor.id,
    });
    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
