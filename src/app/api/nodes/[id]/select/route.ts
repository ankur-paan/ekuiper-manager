import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiErrorResponse, assertSameOrigin, requireUser } from '@/lib/api';
import { useSecureCookies } from '@/lib/cookies';
import { getNode, NODE_COOKIE } from '@/lib/nodes';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireUser(request);
    const { id } = await params;
    if (!(await getNode(id))) throw new ApiError(404, 'Node not found', 'NODE_NOT_FOUND');
    const response = NextResponse.json({ selectedNodeId: id });
    response.cookies.set(NODE_COOKIE, id, {
      httpOnly: true,
      secure: useSecureCookies(),
      sameSite: 'strict',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
