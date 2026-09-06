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
 *   admits `stream`, `collection` (windowed), `table`, or `any` upstreams
 *   while the driving `left` input admits only `stream` or `any`.
 * - Live-engine correction (FS-0149, eKuiper 2.4.1): the engine rejects
 *   multiple non-lookup inputs (`join node does not allow multiple stream
 *   inputs`), so at least one side must be windowed (`collection`) or a
 *   lookup `table`. No static per-port kind can express this cross-port
 *   constraint (the `right` definition port is kind `any`, which the
 *   generic `canConnect` check always accepts), so it is enforced below
 *   as a cross-port check over the join node's resolved inputs: when both
 *   resolved inputs are plain `stream`, one structured diagnostic is
 *   emitted. `FlowPortKind` is not widened and `canConnect` is unchanged.
 *
 * The `right` definition port is kind `any`, which the generic port
 * compatibility check always accepts; this module owns the semantic
 * rejection of `collection` (on the `left`) and `table` (on the `left`)
 * upstreams that the generic check cannot see, plus the cross-port
 * stream+stream rejection. No new diagnostic codes are introduced:
 * a missing required input reuses FLOW_PORT_TARGET_MISSING (node-scoped,
 * no edgeId) and a semantically invalid upstream reuses
 * FLOW_PORT_INCOMPATIBLE (node- and edge-scoped for per-edge rejections,
 * node-scoped for the cross-port stream+stream rejection). No SQL is
 * generated and no expression is parsed here.
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
            : 'a stream, windowed collection, or lookup table';
        diagnostics.push({
          code: FLOW_PORT_INCOMPATIBLE,
          severity: 'error',
          message: `Flow edge "${edge.id}" feeds join node "${node.id}" input "${edge.targetPortId}" from source port "${sourcePort.id}" kind "${sourcePort.kind}", which a v1 join cannot consume; expected ${expected}.`,
          nodeId: node.id,
          edgeId: edge.id,
        });
      }
    }

    if (isPlainStreamJoin(leftEdges, rightEdges, nodesById, registry)) {
      diagnostics.push({
        code: FLOW_PORT_INCOMPATIBLE,
        severity: 'error',
        message:
          `Flow join node "${node.id}" joins two plain streams; eKuiper requires ` +
          `a windowed (collection) or table input on at least one side.`,
        nodeId: node.id,
      });
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
    sourceKind === 'stream' ||
    sourceKind === 'collection' ||
    sourceKind === 'table' ||
    sourceKind === 'any'
  );
}

/**
 * Cross-port join topology rule (FS-0149): at least one input must be
 * windowed (`collection`) or a lookup `table`.
 *
 * Resolves both inputs' source port kinds and reports true only when both
 * sides resolve to at least one upstream AND every resolved upstream on
 * both sides is definitively `stream`. `any`-kinded or unresolvable
 * upstreams are treated as unknown and never trigger the rejection, so
 * future generic nodes and missing definitions fail (or pass) elsewhere,
 * never here. Missing inputs are owned by the FLOW_PORT_TARGET_MISSING
 * check above and likewise never trigger this rule.
 */
function isPlainStreamJoin(
  leftEdges: FlowDocument['spec']['edges'],
  rightEdges: FlowDocument['spec']['edges'],
  nodesById: Map<string, FlowDocument['spec']['nodes'][number]>,
  registry: NodeRegistry,
): boolean {
  if (leftEdges.length === 0 || rightEdges.length === 0) {
    return false;
  }
  const resolveKinds = (
    edges: FlowDocument['spec']['edges'],
  ): FlowPortKind[] => {
    const kinds: FlowPortKind[] = [];
    for (const edge of edges) {
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
      kinds.push(sourcePort.kind);
    }
    return kinds;
  };
  const leftKinds = resolveKinds(leftEdges);
  const rightKinds = resolveKinds(rightEdges);
  if (leftKinds.length === 0 || rightKinds.length === 0) {
    return false;
  }
  return (
    leftKinds.every((kind) => kind === 'stream') &&
    rightKinds.every((kind) => kind === 'stream')
  );
}
