import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, requireUser } from '@/lib/api';
import { getFlowRuntimeStatus } from '@/lib/flows/deployments/runtime-status';

export const dynamic = 'force-dynamic';

/**
 * Read-only runtime desired/actual status for one flow (FS-0099).
 *
 * - Reuses the repository auth (`requireUser`) boundary; unauthenticated
 *   requests are rejected before any lookup. Read-only GET, so no
 *   same-origin mutation guard and no audit row (matching the sibling
 *   flow/deployment GET routes).
 * - Delegates to `getFlowRuntimeStatus`: one deployment lookup plus one
 *   eKuiper rule-status read per request; no streaming or poll scheduler.
 * - A flow with no successful deployment resolves to the
 *   never-deployed/unknown model (HTTP 200), and an unreachable target
 *   resolves to `unknown` with a safe reason; only a missing flow (or an
 *   auth/server failure) becomes an HTTP error.
 * - The payload carries identifiers and normalized states only: no raw
 *   credentials, base URLs, or arbitrary URLs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request);
    const { id } = await params;
    const runtime = await getFlowRuntimeStatus(id);
    return NextResponse.json({ runtime });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
