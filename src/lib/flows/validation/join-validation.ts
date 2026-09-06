import type { FlowDiagnostic } from '../model/diagnostic';
import {
  FLOW_PORT_INCOMPATIBLE,
  FLOW_PORT_TARGET_MISSING,
} from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';
import type { FlowPortKind } from '../registry/node-definition';
import type { NodeRegistry } from '../registry/node-registry';

/**
 * Join-specific semantic validation for v1alpha1 Flow documents.
 *
 * Covers only what the audited eKuiper baseline confirms without inventing
 * engine rules:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms a two-input `join`
 *   graph operator, so every v1 `join` node requires one incoming edge on
 *   each stable input port (`left` and `right`).
 * - `src/lib/ekuiper/types.ts` (`scan` | `lookup` table kinds) confirms
 *   lookup tables as a joinable right-side concept, so the `right` input
 *   admits `stream`, `table`, or `any` upstreams while the driving `left`
 *   input admits only `stream` or `any`.
 * - Windowed collections feed aggregation (see the aggregate builtin), not
 *   joins, so `collection` upstreams are rejected on both sides.
 *
 * The `right` definition port is kind `any`, which the generic port
 * compatibility check always accepts; this module owns the semantic
 * rejection of `collection` (and, on the `left`, `table`) upstreams that
 * the generic check cannot see. No new diagnostic codes are introduced:
 * a missing required input reuses FLOW_PORT_TARGET_MISSING (node-scoped,
 * no edgeId) and a semantically invalid upstream reuses
 * FLOW_PORT_INCOMPATIBLE (node- and edge-scoped). No SQL is generated and
 * no expression is parsed here.
 *
 * Returns every diagnostic in one pass. Never throws for well-typed input
 * and never mutates its input or the registry.
 */
export function validateFlowJoinTopology(
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

  for (const node of nodes) {
    const definition = registry.get(node.type, node.typeVersion);
    if (definition === undefined) {
      continue;
    }
    if (definition.type !== 'join' || definition.version !== 1) {
      continue;
    }

    const leftEdges = edges.filter(
      (edge) => edge.targetNodeId === node.id && edge.targetPortId === 'left',
    );
    const rightEdges = edges.filter(
      (edge) => edge.targetNodeId === node.id && edge.targetPortId === 'right',
    );

    if (leftEdges.length === 0) {
      diagnostics.push({
        code: FLOW_PORT_TARGET_MISSING,
        severity: 'error',
        message: `Flow join node "${node.id}" has no edge targeting required input port "left".`,
        nodeId: node.id,
      });
    }
    if (rightEdges.length === 0) {
      diagnostics.push({
        code: FLOW_PORT_TARGET_MISSING,
        severity: 'error',
        message: `Flow join node "${node.id}" has no edge targeting required input port "right".`,
        nodeId: node.id,
      });
    }

    for (const edge of [...leftEdges, ...rightEdges]) {
      const sourceNode = nodesById.get(edge.sourceNodeId);
      if (sourceNode === undefined) {
        continue;
      }
      const sourceDefinition = registry.get(
        sourceNode.type,
        sourceNode.typeVersion,
      );
      if (sourceDefinition === undefined) {
        continue;
      }
      const sourcePort = sourceDefinition.outputs.find(
        (port) => port.id === edge.sourcePortId,
      );
      if (sourcePort === undefined) {
        continue;
      }
      if (!isAllowedJoinUpstream(edge.targetPortId, sourcePort.kind)) {
        const expected =
          edge.targetPortId === 'left'
            ? 'a stream'
            : 'a stream or lookup table';
        diagnostics.push({
          code: FLOW_PORT_INCOMPATIBLE,
          severity: 'error',
          message: `Flow edge "${edge.id}" feeds join node "${node.id}" input "${edge.targetPortId}" from source port "${sourcePort.id}" kind "${sourcePort.kind}", which a v1 join cannot consume; expected ${expected}.`,
          nodeId: node.id,
          edgeId: edge.id,
        });
      }
    }
  }

  return diagnostics;
}

function isAllowedJoinUpstream(
  targetPortId: string,
  sourceKind: FlowPortKind,
): boolean {
  if (targetPortId === 'left') {
    return sourceKind === 'stream' || sourceKind === 'any';
  }
  return (
    sourceKind === 'stream' || sourceKind === 'table' || sourceKind === 'any'
  );
}
