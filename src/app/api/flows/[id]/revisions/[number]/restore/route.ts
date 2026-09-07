import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import { getRevision } from '@/lib/flows/persistence/flow-revision-repository';
import { upsertFlowDraft } from '@/lib/flows/persistence/flow-draft-repository';

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
 * Restore a revision snapshot into the current draft (FS-0097).
 *
 * Copies the selected immutable revision's semantic/layout documents into
 * the flow's current draft via the draft repository (which recomputes the
 * server-side hashes). Never deploys: runtime/deployment state is untouched,
 * so the header keeps showing undeployed changes when the restored semantic
 * hash differs from the latest deployment. The caller reloads the draft
 * afterwards so the autosave baseline refreshes from the restored hashes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; number: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request);
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
    const draft = await upsertFlowDraft({
      flowId: id,
      semanticDocument: revision.semanticDocument,
      layoutDocument: revision.layoutDocument,
      updatedBy: actor.id,
    });
    // Audit the restore with identifiers only: flow id + revision number.
    // Draft/revision documents and hashes are never embedded here.
    recordAuditSafely({
      actorId: actor.id,
      action: 'flow.revision.restore',
      resourceType: 'flow',
      resourceId: id,
      success: true,
      metadata: { revisionNumber },
    });
    return NextResponse.json({
      draft,
      restoredRevisionNumber: revision.revisionNumber,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
