import type { FlowNode, FlowNodeLayout } from './flow-document';
import type { FlowNodeDefinition } from '../registry/node-definition';

/**
 * Input for creating one authoring FlowNode from a registry definition.
 */
export interface CreateFlowNodeInput {
  /**
   * Pre-allocated stable authoring ID.
   *
   * Callers mint this via {@link generateFlowNodeId} in UI code or inject a
   * fixed ID in tests. This is unrelated to compiler/runtime operator IDs,
   * which remain deterministic compiler output.
   */
  id: string;
  definition: FlowNodeDefinition;
  /** Initial canvas coordinate; copied, never held by reference. */
  position: FlowNodeLayout;
  /** Display-name override; defaults to the definition displayName. */
  name?: string;
}

export interface CreatedFlowNode {
  node: FlowNode;
  position: FlowNodeLayout;
}

/**
 * Tiny ID-provider boundary for authoring node IDs.
 *
 * UI code calls this to mint a stable authoring Flow node ID; tests inject
 * fixed IDs instead so output stays deterministic.
 */
export function generateFlowNodeId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Build one FlowNode plus its initial layout entry from a node definition.
 *
 * Copies definition `defaultValue` entries into config without sharing
 * mutable objects between nodes. Properties without a default are omitted.
 * Never generates compiler/runtime IDs.
 */
export function createFlowNodeForDefinition(
  input: CreateFlowNodeInput,
): CreatedFlowNode {
  const config: Record<string, unknown> = {};
  for (const property of input.definition.properties) {
    if (property.defaultValue !== undefined) {
      config[property.key] = structuredClone(property.defaultValue);
    }
  }
  return {
    node: {
      id: input.id,
      type: input.definition.type,
      typeVersion: input.definition.version,
      name: input.name ?? input.definition.displayName,
      config,
    },
    position: { x: input.position.x, y: input.position.y },
  };
}
