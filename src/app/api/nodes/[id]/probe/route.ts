import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, assertSameOrigin, requireUser } from '@/lib/api';
import { probeNode } from '@/lib/nodes';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireUser(request);
    const { id } = await params;
    return NextResponse.json({ node: await probeNode(id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
