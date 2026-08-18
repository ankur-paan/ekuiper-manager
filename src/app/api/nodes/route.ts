import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { useSecureCookies } from '@/lib/cookies';
import { createNode, listNodes, NODE_COOKIE, probeNode } from '@/lib/nodes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const nodes = await listNodes();
    const requestedId = request.cookies.get(NODE_COOKIE)?.value;
    const selectedNode =
      nodes.find((node) => node.id === requestedId) ??
      nodes.find((node) => node.isDefault) ??
      nodes[0] ??
      null;
    const response = NextResponse.json({
      nodes,
      selectedNodeId: selectedNode?.id ?? null,
    });
    if (selectedNode && requestedId !== selectedNode.id) {
      response.cookies.set(NODE_COOKIE, selectedNode.id, {
        httpOnly: true,
        secure: useSecureCookies(),
        sameSite: 'strict',
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
      });
    }
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request, { owner: true });
    const body = await readJsonObject(request);
    const created = await createNode({
      name: body.name,
      baseUrl: body.baseUrl,
      description: body.description,
      authorization: body.authorization,
    });
    const node = await probeNode(created.id);
    recordAuditSafely({
      actorId: actor.id,
      nodeId: node.id,
      action: 'node.create',
      resourceType: 'node',
      resourceId: node.id,
      success: true,
    });
    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
