import {
  FLOW_DOCUMENT_VERSION,
  type FlowDocument,
  type FlowEdge,
  type FlowNode,
} from '../model/flow-document';

/**
 * Deterministic large-flow fixture generator (FS-0121).
 *
 * Builds an acyclic chain Flow document with exactly the requested node
 * count, using only known built-in definitions with fixed config:
 *
 * - index 0 is a `memory-source` (required `topic` set);
 * - the last index is a `memory-sink` (required `topic` set);
 * - every middle index is a `filter` transform (required `expression` set).
 *
 * All IDs are derived from the node index (`perf-node-0001`, ...), all
 * edges chain `out -> in` from one node to the next, and layout is a
 * deterministic grid. No randomness, clock reads, or giant checked-in
 * fixture files are involved: any supported size (50, 250, 500, 1000)
 * is generated on demand and the same size always yields the same
 * document (and therefore the same canonical semantic hash).
 *
 * Test support only. Do not import from production modules.
 */

const SOURCE_TYPE = 'memory-source';
const MIDDLE_TYPE = 'filter';
const SINK_TYPE = 'memory-sink';
const NODE_TYPE_VERSION = 1;

const SOURCE_TOPIC = 'perf-source';
const MIDDLE_EXPRESSION = 'temperature > 0';
const SINK_TOPIC = 'perf-sink';

const LAYOUT_COLUMN_GAP = 300;
const LAYOUT_ROW_GAP = 160;

function paddedIndex(value: number): string {
  return String(value).padStart(4, '0');
}

function nodeIdForIndex(index: number): string {
  return `perf-node-${paddedIndex(index + 1)}`;
}

function edgeIdForIndex(index: number): string {
  return `perf-edge-${paddedIndex(index + 1)}`;
}

function nodeForIndex(index: number, nodeCount: number): FlowNode {
  const id = nodeIdForIndex(index);
  if (index === 0) {
    return {
      id,
      type: SOURCE_TYPE,
      typeVersion: NODE_TYPE_VERSION,
      name: `Perf Source 1`,
      config: { topic: SOURCE_TOPIC },
    };
  }
  if (index === nodeCount - 1) {
    return {
      id,
      type: SINK_TYPE,
      typeVersion: NODE_TYPE_VERSION,
      name: `Perf Sink ${nodeCount}`,
      config: { topic: SINK_TOPIC },
    };
  }
  return {
    id,
    type: MIDDLE_TYPE,
    typeVersion: NODE_TYPE_VERSION,
    name: `Perf Filter ${index + 1}`,
    config: { expression: MIDDLE_EXPRESSION },
  };
}

/**
 * Generate a deterministic acyclic chain Flow document with exactly
 * `nodeCount` nodes (`nodeCount` edges minus one).
 *
 * @throws when `nodeCount` is not an integer >= 2. A single node cannot
 * carry both the required source and the required sink, so sizes below 2
 * are a caller programming error, not a user-correctable diagnostic.
 */
export function generateLargeFlow(nodeCount: number): FlowDocument {
  if (!Number.isInteger(nodeCount) || nodeCount < 2) {
    throw new Error(
      `generateLargeFlow: nodeCount must be an integer >= 2 (received ${String(nodeCount)})`,
    );
  }

  const nodes: FlowNode[] = [];
  for (let index = 0; index < nodeCount; index += 1) {
    nodes.push(nodeForIndex(index, nodeCount));
  }

  const edges: FlowEdge[] = [];
  for (let index = 0; index < nodeCount - 1; index += 1) {
    edges.push({
      id: edgeIdForIndex(index),
      sourceNodeId: nodeIdForIndex(index),
      sourcePortId: 'out',
      targetNodeId: nodeIdForIndex(index + 1),
      targetPortId: 'in',
    });
  }

  const columns = Math.max(1, Math.ceil(Math.sqrt(nodeCount)));
  const layoutNodes: FlowDocument['layout']['nodes'] = {};
  for (let index = 0; index < nodeCount; index += 1) {
    layoutNodes[nodeIdForIndex(index)] = {
      x: (index % columns) * LAYOUT_COLUMN_GAP,
      y: Math.floor(index / columns) * LAYOUT_ROW_GAP,
    };
  }

  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: {
      id: `perf-flow-${nodeCount}`,
      name: `Large Flow Fixture (${nodeCount} nodes)`,
    },
    spec: { nodes, edges },
    layout: {
      nodes: layoutNodes,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}
