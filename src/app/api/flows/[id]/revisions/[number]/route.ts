import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  requireUser,
} from '@/lib/api';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import { getRevision } from '@/lib/flows/persistence/flow-revision-repository';
import { toRevisionDetail } from '@/lib/flows/revisions';

export const dynamic = 'force-dynamic';

function parseRevisionNumber(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new ApiError(
      400,
      'Revision number must be a positive integer',
      'INVALID_REVISION_NUMBER',
    );
  }
  return Number(value);
}

/**
 * Read one immutable revision snapshot for a flow (FS-0094).
 *
 * Authenticated read-only: returns the stored semantic/layout snapshot
 * plus its hashes. Flow documents store node config references only (no
 * secret values by design), and this route adds no credential material.
 * Unknown revisions resolve to 404, never 500.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; number: string }> },
) {
  try {
    await requireUser(request);
    const { id, number } = await params;
    const revisionNumber = parseRevisionNumber(number);
    const flow = await getFlow(id);
    if (!flow) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }
    const revision = await getRevision(id, revisionNumber);
    if (!revision) {
      throw new ApiError(404, 'Flow revision not found', 'FLOW_REVISION_NOT_FOUND');
    }
    return NextResponse.json({ revision: toRevisionDetail(revision) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
