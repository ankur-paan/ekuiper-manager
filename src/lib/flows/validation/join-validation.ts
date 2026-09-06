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
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms a `join` graph
 *   operator, and live-engine measurement (FS-0151, eKuiper 2.4.1) shows it
 *   takes ONE collection input: both streams converge through a shared
 *   window (`leftSource -> window`, `rightSource -> SAME window`,
 *   `window -> join` validates, while any two-input join is rejected with
 *   `join node does not allow multiple stream inputs`). The v1 `join`
 *   definition therefore exposes a single `in` input of kind `collection`,
 *   and every v1 `join` node requires one incoming edge on it.
 * - The joined stream identities are carried by node config (`from`,
 *   `joinName`, `condition`), not by port identity, so this module owns no
 *   cross-port rule: the only topology question is whether the single
 *   upstream is a windowed `collection`.
 *
 * The generic port compatibility check (`canConnect`) accepts `any` on
 * either side, so `any`-kinded upstreams are treated as unknown and never
 * rejected here; only definitively non-collection upstreams (`stream`,
 * `table`) are reported. No new diagnostic codes are introduced:
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

    const incoming = edges.filter(
      (edge) => edge.targetNodeId === node.id && edge.targetPortId === 'in',
    );

    if (incoming.length === 0) {
      diagnostics.push({
        code: FLOW_PORT_TARGET_MISSING,
        severity: 'error',
        message: `Flow join node "${node.id}" has no edge targeting required input port "in".`,
        nodeId: node.id,
      });
      continue;
    }

    for (const edge of incoming) {
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
      if (!isAllowedJoinUpstream(sourcePort.kind)) {
        diagnostics.push({
          code: FLOW_PORT_INCOMPATIBLE,
          severity: 'error',
          message: `Flow edge "${edge.id}" feeds join node "${node.id}" input "in" from source port "${sourcePort.id}" kind "${sourcePort.kind}", which a v1 join cannot consume; expected a windowed collection.`,
          nodeId: node.id,
          edgeId: edge.id,
        });
      }
    }
  }

  return diagnostics;
}

function isAllowedJoinUpstream(sourceKind: FlowPortKind): boolean {
  return sourceKind === 'collection' || sourceKind === 'any';
}
