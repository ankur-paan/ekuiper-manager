import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiErrorResponse, assertSameOrigin, requireUser } from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization, NODE_COOKIE } from '@/lib/nodes';
import {
  isSensitiveEKuiperPath,
  parseEKuiperJson,
  redactEKuiperSecrets,
} from '@/lib/ekuiper/wire';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const allowedRoots = new Set([
  '',
  'async',
  'batch',
  'config',
  'configs',
  'connections',
  'data',
  'metadata',
  'metrics',
  'ping',
  'plugins',
  'rules',
  'ruleset',
  'ruletest',
  'schemas',
  'scripts',
  'services',
  'stop',
  'streamdetails',
  'streams',
  'tabledetails',
  'tables',
  'trace',
  'tracer',
  'udf',
  'v2',
]);

const requestHeaders = ['accept', 'content-type', 'content-language', 'range'];
const responseHeaders = [
  'accept-ranges',
  'cache-control',
  'content-disposition',
  'content-language',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
  'location',
];
function validatesPath(parts: string[]): string {
  if (parts.some((part) => !part || part === '.' || part === '..' || part.includes('/'))) {
    throw new ApiError(400, 'Invalid eKuiper API path', 'INVALID_PROXY_PATH');
  }
  const root = parts[0] ?? '';
  if (!allowedRoots.has(root)) {
    throw new ApiError(404, 'That eKuiper API path is not exposed', 'PROXY_PATH_NOT_ALLOWED');
  }
  return parts.map(encodeURIComponent).join('/');
}

async function proxy(
  request: NextRequest,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  parts: string[],
): Promise<Response> {
  try {
    const user = await requireUser(request);
    if (method !== 'GET') assertSameOrigin(request);
    const path = validatesPath(parts);
    const selectedNodeId = request.cookies.get(NODE_COOKIE)?.value;
    const { node, authorization } = await getNodeWithAuthorization(selectedNodeId);
    const target = new URL(path ? `/${path}` : '/', node.baseUrl);
    target.search = request.nextUrl.search;
    await assertSafeNodeDestination(target);

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 100 * 1024 * 1024) {
      throw new ApiError(413, 'Request body exceeds 100 MB', 'BODY_TOO_LARGE');
    }

    const headers = new Headers();
    for (const name of requestHeaders) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (authorization) headers.set('authorization', authorization);

    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000)),
      ]),
    };
    if (method !== 'GET' && request.body) {
      init.body = request.body;
      init.duplex = 'half';
    }

    const upstream = await fetch(target, init);
    if (upstream.status >= 300 && upstream.status < 400) {
      throw new ApiError(502, 'Unexpected redirect from eKuiper', 'UPSTREAM_REDIRECT');
    }

    const outgoingHeaders = new Headers();
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value) outgoingHeaders.set(name, value);
    }
    if (method !== 'GET') {
      recordAuditSafely({
        actorId: user.id,
        nodeId: node.id,
        action: `ekuiper.${method.toLowerCase()}`,
        resourceType: 'ekuiper_api',
        resourceId: `/${path}`,
        success: upstream.ok,
        metadata: { status: upstream.status },
      });
    }

    if (isSensitiveEKuiperPath(path)) {
      const payload = redactEKuiperSecrets(parseEKuiperJson(await upstream.text()));
      outgoingHeaders.delete('content-length');
      outgoingHeaders.set('content-type', 'application/json');
      return new Response(JSON.stringify(payload), {
        status: upstream.status,
        headers: outgoingHeaders,
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outgoingHeaders,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: { code: 'NODE_TIMEOUT', message: 'eKuiper did not respond in time' } },
        { status: 504 },
      );
    }
    // Next.js uses ResponseAborted as the request signal reason when a browser
    // navigates away. It is normal cancellation, not a proxy or upstream fault.
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'ResponseAborted')
    ) {
      return new Response(null, { status: 499 });
    }
    if (error instanceof TypeError) {
      return NextResponse.json(
        { error: { code: 'NODE_UNREACHABLE', message: 'eKuiper could not be reached' } },
        { status: 502 },
      );
    }
    return apiErrorResponse(error);
  }
}

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, 'GET', (await context.params).path ?? []);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, 'POST', (await context.params).path ?? []);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, 'PUT', (await context.params).path ?? []);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, 'PATCH', (await context.params).path ?? []);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, 'DELETE', (await context.params).path ?? []);
}
