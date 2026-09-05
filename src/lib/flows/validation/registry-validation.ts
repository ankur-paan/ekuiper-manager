import type { FlowDiagnostic } from '../model/diagnostic';
import { FLOW_UNKNOWN_NODE_TYPE } from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';
import type { NodeRegistry } from '../registry/node-registry';

/**
 * Registry-aware unknown node type validation for v1alpha1 Flow documents.
 *
 * Resolves each node's exact (type, typeVersion) pair in the supplied
 * registry. Nodes with no exact match produce one FLOW_UNKNOWN_NODE_TYPE
 * diagnostic each. There is no fallback to another version of the same
 * type. Returns every diagnostic in one pass. Never throws for well-typed
 * input and never mutates its input or the registry.
 */
export function validateFlowUnknownNodeTypes(
  document: FlowDocument,
  registry: NodeRegistry,
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];

  const nodes = Array.isArray(document?.spec?.nodes)
    ? document.spec.nodes
    : [];

  for (const node of nodes) {
    if (!registry.has(node.type, node.typeVersion)) {
      diagnostics.push({
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message: `Unknown flow node type "${node.type}" version ${node.typeVersion} for node "${node.id}".`,
        nodeId: node.id,
      });
    }
  }

  return diagnostics;
}
