import type { FlowDiagnostic } from '../model/diagnostic';
import { FLOW_AGGREGATE_REQUIRES_GROUP_BY } from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';

/**
 * Aggregate-specific semantic validation for v1alpha1 Flow documents.
 *
 * Covers only what live acceptance testing against eKuiper 2.4.1 confirms
 * without inventing engine rules (AC-D001):
 * - A flow of `MQTT source -> Window -> Aggregate(avg(temperature))`
 *   deploys cleanly, reports `status: running`, emits output on schedule,
 *   and every aggregated value is `null`.
 * - Inserting a `group-by` node between the window and the aggregate makes
 *   the identical flow produce the correct value (`{"avg_t": 20}` for inputs
 *   10 and 30), so the Manager must require that placement.
 * - An implicit empty grouping was tested directly against the engine and
 *   is rejected (`POST /rules/validate -> HTTP 422, "groupby must have at
 *   least one dimension"`), and grouping by a constant does NOT behave as a
 *   single group, so the compiler must NOT synthesise an implicit group-by;
 *   this module only reports the missing placement.
 * - The engine validates the broken topology as `{"valid":true}`, so a
 *   compile-time or validate-endpoint check against eKuiper cannot catch
 *   this; the Manager must catch it here.
 *
 * Rule: for every `aggregate` node, walk upstream through incoming edges.
 * If any upstream path reaches a `window` node without passing through a
 * `group-by` node first, emit one ERROR diagnostic for that aggregate node.
 * An aggregate whose upstream includes `group-by` before the `window` is
 * fine. An aggregate with no upstream window at all is out of scope and is
 * not reported. The walk is defensive: graphs may contain cycles from a
 * malformed document, so visited node ids are tracked and never revisited.
 *
 * Returns every diagnostic in one pass. Never throws for well-typed input
 * and never mutates its input.
 */
export function validateFlowAggregateGrouping(
  document: FlowDocument,
): FlowDiagnostic[] {
  const diagnostics: FlowDiagnostic[] = [];

  const nodes = Array.isArray(document?.spec?.nodes)
    ? document.spec.nodes
    : [];
  const edges = Array.isArray(document?.spec?.edges)
    ? document.spec.edges
    : [];

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, typeof edges>();
  for (const edge of edges) {
    const list = incomingByTarget.get(edge.targetNodeId);
    if (list === undefined) {
      incomingByTarget.set(edge.targetNodeId, [edge]);
    } else {
      list.push(edge);
    }
  }

  for (const node of nodes) {
    if (node.type !== 'aggregate') {
      continue;
    }
    if (reachesWindowWithoutGroupBy(node.id, nodesById, incomingByTarget)) {
      diagnostics.push({
        code: FLOW_AGGREGATE_REQUIRES_GROUP_BY,
        severity: 'error',
        message: `Aggregate "${node.name}" needs a Group By between it and the Window. Without one eKuiper returns null for every field reference (avg, sum, min, max, count(col)) instead of failing.`,
        nodeId: node.id,
      });
    }
  }

  return diagnostics;
}

function reachesWindowWithoutGroupBy(
  aggregateId: string,
  nodesById: Map<string, { id: string; type: string }>,
  incomingByTarget: Map<
    string,
    Array<{ sourceNodeId: string; targetNodeId: string }>
  >,
): boolean {
  const visited = new Set<string>([aggregateId]);
  const stack: string[] = [];
  for (const edge of incomingByTarget.get(aggregateId) ?? []) {
    stack.push(edge.sourceNodeId);
  }

  while (stack.length > 0) {
    const currentId = stack.pop() as string;
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    const current = nodesById.get(currentId);
    if (current === undefined) {
      continue;
    }
    if (current.type === 'group-by') {
      continue;
    }
    if (current.type === 'window') {
      return true;
    }
    for (const edge of incomingByTarget.get(currentId) ?? []) {
      if (!visited.has(edge.sourceNodeId)) {
        stack.push(edge.sourceNodeId);
      }
    }
  }

  return false;
}
