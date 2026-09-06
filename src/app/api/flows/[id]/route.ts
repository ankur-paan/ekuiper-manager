import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
  requireUser,
} from '@/lib/api';
import { getFlow, updateFlowMetadata } from '@/lib/flows/persistence/flow-repository';
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
    await requireUser(request);
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
    return NextResponse.json({ flow });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
