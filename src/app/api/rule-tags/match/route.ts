import http from 'node:http';
import https from 'node:https';
import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
  requireUser,
} from '@/lib/api';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization, NODE_COOKIE } from '@/lib/nodes';

export const runtime = 'nodejs';

function requestWithGetBody(
  target: URL,
  body: string,
  authorization: string | null,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const transport = target.protocol === 'https:' ? https : http;
    const headers: Record<string, string | number> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (authorization) headers.Authorization = authorization;
    const upstream = transport.request(
      target,
      { method: 'GET', headers, timeout: Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000) },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1024 * 1024) {
            upstream.destroy(new Error('eKuiper response exceeded 1 MB'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve({
          status: response.statusCode ?? 502,
          body: Buffer.concat(chunks).toString('utf8'),
        }));
      },
    );
    upstream.on('timeout', () => upstream.destroy(new Error('eKuiper request timed out')));
    upstream.on('error', reject);
    upstream.end(body);
  });
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireUser(request);
    const payload = await readJsonObject(request);
    if (
      !Array.isArray(payload.tags) ||
      payload.tags.length === 0 ||
      payload.tags.length > 50 ||
      payload.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.length > 100)
    ) {
      throw new ApiError(400, 'tags must contain 1-50 non-empty strings', 'INVALID_TAGS');
    }
    const { node, authorization } = await getNodeWithAuthorization(
      request.cookies.get(NODE_COOKIE)?.value,
    );
    const target = new URL('/rules/tags/match', node.baseUrl);
    await assertSafeNodeDestination(target);
    const upstream = await requestWithGetBody(
      target,
      JSON.stringify({ tags: payload.tags }),
      authorization,
    );
    let body: unknown;
    try {
      body = JSON.parse(upstream.body);
    } catch {
      body = { error: { code: 'UPSTREAM_ERROR', message: upstream.body || 'Invalid eKuiper response' } };
    }
    return NextResponse.json(body, { status: upstream.status });
  } catch (error) {
    if (error instanceof Error && !(error instanceof ApiError)) {
      return NextResponse.json(
        { error: { code: 'NODE_UNREACHABLE', message: 'eKuiper could not be reached' } },
        { status: 502 },
      );
    }
    return apiErrorResponse(error);
  }
}
