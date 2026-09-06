import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requireUser,
} from '@/lib/api';
import { getNode } from '@/lib/nodes';
import {
  BASELINE_EKUIPER_VERSION,
  type TargetCapabilityProfile,
} from '@/lib/flows/capabilities/types';
import { resolveTargetCapabilities } from '@/lib/flows/capabilities/resolve-capabilities';
import { FLOW_DOCUMENT_VERSION } from '@/lib/flows/model/flow-document';
import { getFlowDraft } from '@/lib/flows/persistence/flow-draft-repository';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import { validateFlowServerSide } from '@/lib/flows/validation/validate-flow';

export const dynamic = 'force-dynamic';

/**
 * Resolve the normalized capability profile for one flow's target (FS-0081).
 *
 * - Flow with a registered target: profile derives from the stored managed
 *   node row (`version`, `status`), the same normalization the client
 *   consumes; no live eKuiper call is made here.
 * - Flow with no target: audited baseline profile (`BASELINE_EKUIPER_VERSION`,
 *   reachable), matching the current client fallback, so semantic
 *   validation is not blocked before a target is chosen.
 * - Flow whose target row no longer exists: conservative unavailable
 *   profile (capability diagnostics, still HTTP 200 with valid=false).
 */
async function resolveProfileForFlow(
  targetNodeId: string | null,
): Promise<TargetCapabilityProfile> {
  if (targetNodeId === null) {
    return resolveTargetCapabilities({
      version: BASELINE_EKUIPER_VERSION,
      reachable: true,
    });
  }
  const target = await getNode(targetNodeId);
  if (target === null) {
    return resolveTargetCapabilities({ version: null, reachable: false });
  }
  return resolveTargetCapabilities({
    version: target.version,
    reachable: target.status === 'ONLINE',
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireUser(request);
    const { id } = await params;

    // Authoritative deploy validation loads the current draft server-side;
    // no client-supplied document is accepted or trusted here.
    const flow = await getFlow(id);
    if (!flow) {
      throw new ApiError(404, 'Flow not found', 'FLOW_NOT_FOUND');
    }
    const draft = await getFlowDraft(id);
    if (!draft) {
      throw new ApiError(404, 'Flow draft not found', 'FLOW_DRAFT_NOT_FOUND');
    }

    const capabilityProfile = await resolveProfileForFlow(flow.targetNodeId);
    const registry = createBuiltinNodeRegistry();
    const document = {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: {
        id: flow.id,
        name: flow.name,
        ...(flow.description === null
          ? {}
          : { description: flow.description }),
      },
      spec: draft.semanticDocument,
      layout: draft.layoutDocument,
    };
    // Official eKuiper rule validation is intentionally not called here;
    // a later deployment ticket owns that stage.
    const result = validateFlowServerSide({
      document,
      registry,
      capabilityProfile,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
