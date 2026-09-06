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
import { compileFlowToEkuiperGraph } from '@/lib/flows/compiler/ekuiper/compile-graph';
import {
  FLOW_DOCUMENT_VERSION,
  type FlowDocument,
} from '@/lib/flows/model/flow-document';
import { getFlowDraft } from '@/lib/flows/persistence/flow-draft-repository';
import { getFlow } from '@/lib/flows/persistence/flow-repository';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import { validateFlowServerSide } from '@/lib/flows/validation/validate-flow';

export const dynamic = 'force-dynamic';

/**
 * Resolve the normalized capability profile for one flow's target (FS-0082).
 *
 * Same normalization as the FS-0081 validation endpoint:
 * - Flow with a registered target: profile derives from the stored managed
 *   node row (`version`, `status`); no live eKuiper call is made here.
 * - Flow with no target: audited baseline profile (`BASELINE_EKUIPER_VERSION`,
 *   reachable), so compilation is not blocked before a target is chosen.
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

/**
 * Compile the current server-side draft into an inspectable eKuiper
 * graph-rule artifact without mutating any runtime (FS-0082).
 *
 * - Loads flow metadata + draft server-side; no client-supplied document
 *   is accepted or trusted.
 * - Runs authoritative server validation first (stages 1-5); a flow with
 *   error diagnostics returns HTTP 200 with `{ valid: false, diagnostics }`
 *   and no artifact.
 * - On a valid document, builds IR and compiles the eKuiper artifact
 *   (stages 6-7) via `compileFlowToEkuiperGraph`, which reads only
 *   `metadata.id` plus semantic `spec` nodes/edges and copies only
 *   whitelisted non-secret config into `props`. The returned
 *   `ruleDefinition` therefore carries no layout and no plaintext secret.
 * - Target compile failures return HTTP 200 with `{ valid: false,
 *   diagnostics }` and no artifact.
 * - Never persists a deployment and never calls eKuiper create/update rule
 *   APIs (no `fetch` to eKuiper from this route, directly or indirectly).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
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

    const validation = validateFlowServerSide({
      document,
      registry,
      capabilityProfile,
    });
    if (!validation.valid) {
      return NextResponse.json(validation);
    }

    const compiled = compileFlowToEkuiperGraph(document as FlowDocument);
    if (!compiled.ok) {
      return NextResponse.json({
        valid: false,
        diagnostics: compiled.diagnostics,
      });
    }

    return NextResponse.json({
      valid: true,
      diagnostics: [],
      artifact: compiled.artifact,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
