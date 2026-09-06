import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requireUser,
} from '@/lib/api';
import {
  isFlowOptionProviderId,
} from '@/lib/flows/registry/node-definition';
import {
  UNKNOWN_OPTION_PROVIDER_CODE,
  resolveFlowOptionsUpstreamPath,
  toFlowOptionItems,
} from '@/lib/flows/options';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization, NODE_COOKIE } from '@/lib/nodes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Resolve the registered node id for the fetch.
 *
 * Only a registered managed-node id is accepted (query `targetNodeId`,
 * else the selected-node cookie, else the default node). Raw URLs are
 * never accepted — the value only ever reaches
 * `getNodeWithAuthorization`, which looks up the stored row.
 */
function resolveTargetNodeId(request: NextRequest): string | undefined {
  const query = request.nextUrl.searchParams.get('targetNodeId');
  if (query !== null && query.trim().length > 0) {
    return query.trim();
  }
  const cookie = request.cookies.get(NODE_COOKIE)?.value;
  if (cookie !== undefined && cookie.trim().length > 0) {
    return cookie.trim();
  }
  return undefined;
}

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireUser(request);
    // Read-only GET follows the existing flow-route convention (auth is
    // mandatory). When the caller sends an Origin header, enforce the
    // same same-origin boundary as mutating flow routes.
    if (request.headers.get('origin') !== null) {
      assertSameOrigin(request);
    }
    const { provider } = await context.params;
    if (!isFlowOptionProviderId(provider)) {
      throw new ApiError(
        404,
        `Unknown option provider "${provider}"`,
        UNKNOWN_OPTION_PROVIDER_CODE,
      );
    }
    const targetNodeId = resolveTargetNodeId(request);
    const { node, authorization } =
      await getNodeWithAuthorization(targetNodeId);
    const target = new URL(resolveFlowOptionsUpstreamPath(provider), node.baseUrl);
    await assertSafeNodeDestination(target);

    let response: Response;
    try {
      response = await fetch(target, {
        headers: {
          Accept: 'application/json',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(
          Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000),
        ),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new ApiError(504, 'eKuiper did not respond in time', 'NODE_TIMEOUT');
      }
      if (error instanceof TypeError) {
        throw new ApiError(502, 'eKuiper could not be reached', 'NODE_UNREACHABLE');
      }
      throw error;
    }
    if (!response.ok) {
      throw new ApiError(
        502,
        `eKuiper returned HTTP ${response.status}`,
        'NODE_UPSTREAM_ERROR',
      );
    }
    const bodyText = await response.text().catch(() => '');
    let payload: unknown = null;
    try {
      payload = bodyText.trim().length > 0 ? (JSON.parse(bodyText) as unknown) : null;
    } catch {
      payload = null;
    }
    const options = toFlowOptionItems(provider, payload);
    return NextResponse.json({ provider, options });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
