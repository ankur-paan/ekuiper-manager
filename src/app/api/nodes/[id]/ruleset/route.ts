import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiErrorResponse, assertSameOrigin, requireUser } from '@/lib/api';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization } from '@/lib/nodes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request);
    const { id } = await params;
    const { node, authorization } = await getNodeWithAuthorization(id);
    const target = new URL('/data/export', node.baseUrl);
    await assertSafeNodeDestination(target);

    const headers = new Headers({ Accept: 'application/json' });
    if (authorization) headers.set('Authorization', authorization);

    const response = await fetch(target, {
      headers,
      signal: AbortSignal.timeout(Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000)),
    });

    if (!response.ok) {
      throw new ApiError(response.status, `eKuiper export failed (${response.status})`, 'EXPORT_FAILED');
    }

    const data = await response.text();
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(node.name)}-ruleset.json"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireUser(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === 'string' ? body.content : JSON.stringify(body.content ?? body);

    if (!content || content === '{}') {
      throw new ApiError(400, 'Ruleset content is required', 'MISSING_CONTENT');
    }

    const { node, authorization } = await getNodeWithAuthorization(id);
    const target = new URL('/data/import?partial=1', node.baseUrl);
    await assertSafeNodeDestination(target);

    const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json' });
    if (authorization) headers.set('Authorization', authorization);

    const response = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000)),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new ApiError(response.status, errText || `Import failed (${response.status})`, 'IMPORT_FAILED');
    }

    return NextResponse.json({ success: true, message: 'Ruleset imported successfully' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
