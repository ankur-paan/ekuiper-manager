import type { FlowDiagnostic } from '../model/diagnostic';
import {
  FLOW_NO_SINK,
  FLOW_NO_SOURCE,
  FLOW_PORT_INCOMPATIBLE,
  FLOW_PORT_SOURCE_MISSING,
  FLOW_PORT_TARGET_MISSING,
  FLOW_UNKNOWN_NODE_TYPE,
} from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';
import type { NodeRegistry } from '../registry/node-registry';
import { canConnect } from './port-compatibility';

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

/**
 * Registry-aware edge port existence and kind compatibility validation for
 * v1alpha1 Flow documents.
 *
 * For each edge whose source and target nodes exist in the document and
 * whose node definitions resolve in the supplied registry, validates
 * sourcePortId against the source definition outputs and targetPortId
 * against the target definition inputs. Missing ports produce one
 * FLOW_PORT_SOURCE_MISSING or FLOW_PORT_TARGET_MISSING diagnostic each.
 * When both ports resolve, their kinds are checked with canConnect; an
 * incompatible pair produces one FLOW_PORT_INCOMPATIBLE diagnostic.
 * Edges referencing missing nodes or unknown node definitions are skipped
 * for that side; they are owned by structural or unknown-type validation.
 * Returns every diagnostic in one pass. Never throws for well-typed input
 * and never mutates its input or the registry.
 */
export function validateFlowEdgePorts(
  document: FlowDocument,
  registry: NodeRegistry,
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];

  const nodes = Array.isArray(document?.spec?.nodes)
    ? document.spec.nodes
    : [];
  const edges = Array.isArray(document?.spec?.edges)
    ? document.spec.edges
    : [];

  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  for (const edge of edges) {
    const sourceNode = nodesById.get(edge.sourceNodeId);
    const targetNode = nodesById.get(edge.targetNodeId);

    let sourcePortKind: string | undefined;
    let targetPortKind: string | undefined;
    let sourcePortId: string | undefined;
    let targetPortId: string | undefined;

    if (sourceNode !== undefined) {
      const sourceDefinition = registry.get(
        sourceNode.type,
        sourceNode.typeVersion,
      );
      if (sourceDefinition !== undefined) {
        const sourcePort = sourceDefinition.outputs.find(
          (port) => port.id === edge.sourcePortId,
        );
        if (sourcePort === undefined) {
          diagnostics.push({
            code: FLOW_PORT_SOURCE_MISSING,
            severity: 'error',
            message: `Flow edge "${edge.id}" references missing source port "${edge.sourcePortId}" on node "${sourceNode.id}".`,
            nodeId: sourceNode.id,
            edgeId: edge.id,
          });
        } else {
          sourcePortKind = sourcePort.kind;
          sourcePortId = sourcePort.id;
        }
      }
    }

    if (targetNode !== undefined) {
      const targetDefinition = registry.get(
        targetNode.type,
        targetNode.typeVersion,
      );
      if (targetDefinition !== undefined) {
        const targetPort = targetDefinition.inputs.find(
          (port) => port.id === edge.targetPortId,
        );
        if (targetPort === undefined) {
          diagnostics.push({
            code: FLOW_PORT_TARGET_MISSING,
            severity: 'error',
            message: `Flow edge "${edge.id}" references missing target port "${edge.targetPortId}" on node "${targetNode.id}".`,
            nodeId: targetNode.id,
            edgeId: edge.id,
          });
        } else {
          targetPortKind = targetPort.kind;
          targetPortId = targetPort.id;
        }
      }
    }

    if (
      sourcePortKind !== undefined &&
      targetPortKind !== undefined &&
      sourcePortId !== undefined &&
      targetPortId !== undefined &&
      !canConnect(
        sourcePortKind as Parameters<typeof canConnect>[0],
        targetPortKind as Parameters<typeof canConnect>[1],
      )
    ) {
      diagnostics.push({
        code: FLOW_PORT_INCOMPATIBLE,
        severity: 'error',
        message: `Flow edge "${edge.id}" connects incompatible ports: source port "${sourcePortId}" kind "${sourcePortKind}" cannot connect to target port "${targetPortId}" kind "${targetPortKind}".`,
        edgeId: edge.id,
      });
    }
  }

  return diagnostics;
}

/**
 * Registry-aware source/sink presence validation for v1alpha1 Flow
 * documents.
 *
 * Counts known node definitions (exact type + typeVersion resolution) by
 * registry category. At least one known `source` and at least one known
 * `sink` are required. Missing sources produce one FLOW_NO_SOURCE
 * diagnostic; missing sinks produce one FLOW_NO_SINK diagnostic;
 * independently, so a flow with neither produces both. Unknown node types
 * satisfy neither requirement. Returns every diagnostic in one pass. Never
 * throws for well-typed input and never mutates its input or the registry.
 */
export function validateFlowSourceSinkPresence(
  document: FlowDocument,
  registry: NodeRegistry,
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];

  const nodes = Array.isArray(document?.spec?.nodes)
    ? document.spec.nodes
    : [];

  let hasSource = false;
  let hasSink = false;

  for (const node of nodes) {
    const definition = registry.get(node.type, node.typeVersion);
    if (definition === undefined) {
      continue;
    }
    if (definition.category === 'source') {
      hasSource = true;
    }
    if (definition.category === 'sink') {
      hasSink = true;
    }
  }

  if (!hasSource) {
    diagnostics.push({
      code: FLOW_NO_SOURCE,
      severity: 'error',
      message: 'Flow has no source node.',
    });
  }

  if (!hasSink) {
    diagnostics.push({
      code: FLOW_NO_SINK,
      severity: 'error',
      message: 'Flow has no sink node.',
    });
  }

  return diagnostics;
}
