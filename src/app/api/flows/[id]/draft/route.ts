import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
  requireUser,
} from '@/lib/api';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import {
  getFlowDraft,
  upsertFlowDraft,
} from '@/lib/flows/persistence/flow-draft-repository';
import { FLOW_DOCUMENT_VERSION } from '@/lib/flows/model/flow-document';
import { validateFlowDocumentShape } from '@/lib/flows/validation/document-shape';

export const dynamic = 'force-dynamic';

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
    const draft = await getFlowDraft(id);
    if (!draft) {
      throw new ApiError(404, 'Flow draft not found', 'FLOW_DRAFT_NOT_FOUND');
    }
    return NextResponse.json({ draft });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request);
    const { id } = await params;
    const body = await readJsonObject(request);

    const flow = await getFlow(id);
    if (!flow) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }

    if (body['spec'] === undefined) {
      throw new ApiError(400, 'Flow draft spec is required', 'INVALID_FLOW_DRAFT');
    }
    if (body['layout'] === undefined) {
      throw new ApiError(400, 'Flow draft layout is required', 'INVALID_FLOW_DRAFT');
    }

    // Re-materialize the JSON payload into plain objects owned by this
    // realm. Bodies parsed from a Request can carry a foreign Object
    // prototype (e.g. Edge/jsdom realms), which the server-side canonical
    // JSON hasher intentionally rejects. The body is JSON by construction,
    // so this round-trip is lossless and also guarantees JSON-compatibility.
    const spec: unknown = JSON.parse(JSON.stringify(body['spec']));
    const layout: unknown = JSON.parse(JSON.stringify(body['layout']));

    // Reconstruct enough FlowDocument context for shape validation using
    // the parent flow metadata and the v1alpha1 apiVersion. Hashes are never
    // accepted from the caller; the repository recomputes them server-side.
    const candidate = {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: {
        id: flow.id,
        name: flow.name,
        ...(flow.description === null ? {} : { description: flow.description }),
      },
      spec,
      layout,
    };
    const diagnostics = validateFlowDocumentShape(candidate);
    if (diagnostics.length > 0) {
      const first = diagnostics[0];
      throw new ApiError(
        400,
        `Flow draft is invalid: ${first.message}`,
        'INVALID_FLOW_DRAFT',
      );
    }

    const draft = await upsertFlowDraft({
      flowId: id,
      semanticDocument: spec,
      layoutDocument: layout,
      updatedBy: actor.id,
    });
    // FS-0030: draft autosave PUTs are intentionally not audited. This
    // endpoint fires on every editor autosave (high frequency), so one audit
    // row per save would flood audit_events, unlike the discrete flow
    // create/update actions audited in the sibling flow routes. Draft
    // content itself must never enter audit metadata unredacted.
    return NextResponse.json({ draft });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
