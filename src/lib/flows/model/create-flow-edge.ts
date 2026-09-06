import type { FlowEdge } from './flow-document';

/**
 * Input for creating one authoring FlowEdge from an XYFlow connection.
 */
export interface CreateFlowEdgeInput {
  /**
   * Pre-allocated stable authoring ID.
   *
   * Callers mint this via {@link generateFlowEdgeId} in UI code or inject a
   * fixed ID in tests. This is unrelated to compiler/runtime operator IDs,
   * which remain deterministic compiler output.
   */
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

/**
 * Tiny ID-provider boundary for authoring edge IDs.
 *
 * UI code calls this to mint a stable authoring Flow edge ID; tests inject
 * fixed IDs instead so output stays deterministic.
 */
export function generateFlowEdgeId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Build one FlowEdge with stable semantic port IDs from a validated
 * connection. Performs no registry lookup or compatibility check; the caller
 * verifies source/target node/port definitions and port compatibility before
 * calling. Never generates compiler/runtime IDs.
 */
export function createFlowEdgeForConnection(
  input: CreateFlowEdgeInput,
): FlowEdge {
  return {
    id: input.id,
    sourceNodeId: input.sourceNodeId,
    sourcePortId: input.sourcePortId,
    targetNodeId: input.targetNodeId,
    targetPortId: input.targetPortId,
  };
}
