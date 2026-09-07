import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  requireUser,
} from '@/lib/api';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import { listRevisions } from '@/lib/flows/persistence/flow-revision-repository';
import { toRevisionMetadata } from '@/lib/flows/revisions';

export const dynamic = 'force-dynamic';

/**
 * List revision history metadata for one flow (FS-0094).
 *
 * Authenticated read-only: returns revision metadata newest-first without
 * the (potentially large) semantic/layout snapshot documents. Callers fetch
 * one snapshot via `GET .../revisions/:number` when needed. No mutation
 * route is provided; revisions are immutable.
 */
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
    const records = await listRevisions(id);
    return NextResponse.json({
      revisions: records.map(toRevisionMetadata),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
