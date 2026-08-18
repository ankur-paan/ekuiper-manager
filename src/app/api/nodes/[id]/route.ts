import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { deleteNode, updateNode } from '@/lib/nodes';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request, { owner: true });
    const { id } = await params;
    const node = await updateNode(id, await readJsonObject(request));
    recordAuditSafely({
      actorId: actor.id,
      nodeId: id,
      action: 'node.update',
      resourceType: 'node',
      resourceId: id,
      success: true,
    });
    return NextResponse.json({ node });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request, { owner: true });
    const { id } = await params;
    await deleteNode(id);
    recordAuditSafely({
      actorId: actor.id,
      action: 'node.delete',
      resourceType: 'node',
      resourceId: id,
      success: true,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
