import type {
  FlowDocument,
  FlowEdge,
  FlowNode,
  FlowSpec,
} from './flow-document';

/**
 * One changed config/options property (FS-0095).
 *
 * `path` is the dot-joined property path from the config root
 * (for example `"topic"` or `"filter.threshold"`). `before` is the value in
 * the older document (`undefined` when the property was added) and `after`
 * is the value in the newer document (`undefined` when removed). Both hold
 * JSON-compatible values by Flow model contract.
 */
export interface FlowConfigPropertyChange {
  path: string;
  before: unknown;
  after: unknown;
}

/**
 * Structured semantic Flow changes (FS-0095).
 *
 * Covers node added/removed/renamed/type-changed/config-changed, spec
 * options changes, and edge added/removed. Layout, viewport, and document
 * metadata are never represented here; see {@link diffFlowDocuments}.
 */
export type FlowSemanticChange =
  | { kind: 'node-added'; nodeId: string }
  | { kind: 'node-removed'; nodeId: string }
  | { kind: 'node-renamed'; nodeId: string; before: string; after: string }
  | {
      kind: 'node-type-changed';
      nodeId: string;
      beforeType: string;
      afterType: string;
      beforeTypeVersion: number;
      afterTypeVersion: number;
    }
  | {
      kind: 'node-config-changed';
      nodeId: string;
      changes: FlowConfigPropertyChange[];
    }
  | { kind: 'options-changed'; changes: FlowConfigPropertyChange[] }
  | { kind: 'edge-added'; edgeId: string }
  | { kind: 'edge-removed'; edgeId: string };

function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Tolerant deep equality for JSON-compatible values.
 *
 * Plain objects compare by key/value recursively (key order ignored);
 * arrays compare element-wise in order; everything else compares with
 * `Object.is`. `undefined` only equals `undefined` so added/removed
 * properties are always reported by the caller.
 */
function jsonValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let index = 0; index < a.length; index += 1) {
      if (!jsonValuesEqual(a[index], b[index])) {
        return false;
      }
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    for (const key of aKeys) {
      if (!Object.hasOwn(b, key) || !jsonValuesEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * Recursively collects property changes between two JSON-compatible values.
 *
 * Plain objects are diffed key-by-key (union of keys, visited in sorted
 * order); arrays are treated as replaced atomically, so any element
 * difference yields a single change at the array path holding the whole
 * before/after arrays. Primitive (or type-shape) differences yield one
 * change at the current path. `path` is empty only for the root call, which
 * always receives two objects and therefore never emits an empty path.
 */
function diffJsonValues(
  before: unknown,
  after: unknown,
  path: string,
  out: FlowConfigPropertyChange[],
): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    ).sort();
    for (const key of keys) {
      const childPath = path === '' ? key : `${path}.${key}`;
      const beforeHas = Object.hasOwn(before, key);
      const afterHas = Object.hasOwn(after, key);
      if (!beforeHas) {
        out.push({ path: childPath, before: undefined, after: after[key] });
      } else if (!afterHas) {
        out.push({ path: childPath, before: before[key], after: undefined });
      } else {
        diffJsonValues(before[key], after[key], childPath, out);
      }
    }
    return;
  }
  if (!jsonValuesEqual(before, after)) {
    out.push({ path, before, after });
  }
}

function diffConfigs(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FlowConfigPropertyChange[] {
  const changes: FlowConfigPropertyChange[] = [];
  diffJsonValues(before, after, '', changes);
  return changes;
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    index.set(item.id, item);
  }
  return index;
}

function edgesEqual(a: FlowEdge, b: FlowEdge): boolean {
  return (
    a.sourceNodeId === b.sourceNodeId &&
    a.sourcePortId === b.sourcePortId &&
    a.targetNodeId === b.targetNodeId &&
    a.targetPortId === b.targetPortId
  );
}

/**
 * Computes the semantic diff between two Flow specs (FS-0095).
 *
 * Only `spec` (nodes, edges, options) participates; layout is ignored by
 * construction. An edge kept under the same id with different endpoints is
 * reported as an `edge-removed` + `edge-added` pair because edges have no
 * mutable semantic fields in v1alpha1.
 *
 * Output ordering is deterministic regardless of input array order:
 * node-added, node-removed, node-renamed, node-type-changed,
 * node-config-changed, options-changed, edge-added, edge-removed; each
 * group sorted by node/edge id, and property changes sorted by path.
 * An empty array means no semantic difference.
 */
export function diffFlowSpecs(
  before: FlowSpec,
  after: FlowSpec,
): FlowSemanticChange[] {
  const changes: FlowSemanticChange[] = [];

  const beforeNodes = indexById(before.nodes);
  const afterNodes = indexById(after.nodes);
  const nodeIds = Array.from(
    new Set([...beforeNodes.keys(), ...afterNodes.keys()]),
  ).sort();

  const addedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];
  const renamed: Array<FlowSemanticChange & { kind: 'node-renamed' }> = [];
  const retyped: Array<FlowSemanticChange & { kind: 'node-type-changed' }> =
    [];
  const configChanged: Array<
    FlowSemanticChange & { kind: 'node-config-changed' }
  > = [];

  for (const nodeId of nodeIds) {
    const beforeNode = beforeNodes.get(nodeId) as FlowNode | undefined;
    const afterNode = afterNodes.get(nodeId) as FlowNode | undefined;
    if (!beforeNode) {
      addedNodeIds.push(nodeId);
      continue;
    }
    if (!afterNode) {
      removedNodeIds.push(nodeId);
      continue;
    }
    if (beforeNode.name !== afterNode.name) {
      renamed.push({
        kind: 'node-renamed',
        nodeId,
        before: beforeNode.name,
        after: afterNode.name,
      });
    }
    if (
      beforeNode.type !== afterNode.type ||
      beforeNode.typeVersion !== afterNode.typeVersion
    ) {
      retyped.push({
        kind: 'node-type-changed',
        nodeId,
        beforeType: beforeNode.type,
        afterType: afterNode.type,
        beforeTypeVersion: beforeNode.typeVersion,
        afterTypeVersion: afterNode.typeVersion,
      });
    }
    const configChanges = diffConfigs(beforeNode.config, afterNode.config);
    if (configChanges.length > 0) {
      configChanged.push({
        kind: 'node-config-changed',
        nodeId,
        changes: configChanges,
      });
    }
  }

  for (const nodeId of addedNodeIds) {
    changes.push({ kind: 'node-added', nodeId });
  }
  for (const nodeId of removedNodeIds) {
    changes.push({ kind: 'node-removed', nodeId });
  }
  changes.push(...renamed, ...retyped, ...configChanged);

  const beforeOptions: Record<string, unknown> = { ...before.options };
  const afterOptions: Record<string, unknown> = { ...after.options };
  const optionChanges = diffConfigs(beforeOptions, afterOptions);
  if (optionChanges.length > 0) {
    changes.push({ kind: 'options-changed', changes: optionChanges });
  }

  const beforeEdges = indexById(before.edges);
  const afterEdges = indexById(after.edges);
  const edgeIds = Array.from(
    new Set([...beforeEdges.keys(), ...afterEdges.keys()]),
  ).sort();

  const addedEdgeIds: string[] = [];
  const removedEdgeIds: string[] = [];
  for (const edgeId of edgeIds) {
    const beforeEdge = beforeEdges.get(edgeId);
    const afterEdge = afterEdges.get(edgeId);
    if (!beforeEdge || !afterEdge || !edgesEqual(beforeEdge, afterEdge)) {
      if (beforeEdge) {
        removedEdgeIds.push(edgeId);
      }
      if (afterEdge) {
        addedEdgeIds.push(edgeId);
      }
    }
  }
  for (const edgeId of addedEdgeIds) {
    changes.push({ kind: 'edge-added', edgeId });
  }
  for (const edgeId of removedEdgeIds) {
    changes.push({ kind: 'edge-removed', edgeId });
  }

  return changes;
}

/**
 * Computes the semantic diff between two Flow documents (FS-0095).
 *
 * Compares `spec` only. Layout (node coordinates, viewport), metadata
 * (id, name, description), and apiVersion are entirely ignored, so a
 * layout-only or metadata-only edit yields an empty diff.
 */
export function diffFlowDocuments(
  before: FlowDocument,
  after: FlowDocument,
): FlowSemanticChange[] {
  return diffFlowSpecs(before.spec, after.spec);
}
