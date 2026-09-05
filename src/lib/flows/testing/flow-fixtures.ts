import {
  FLOW_DOCUMENT_VERSION,
  type FlowDocument,
  type FlowEdge,
  type FlowLayout,
  type FlowNode,
} from '../model/flow-document';

/**
 * Test support only. Do not import from production modules.
 *
 * Deterministic builders for FlowDocument fixtures. All defaults use fixed
 * IDs so output is stable across runs; no random IDs are generated.
 */

export function createFlowNode(overrides: Partial<FlowNode> = {}): FlowNode {
  return {
    id: 'test-node-1',
    type: 'test-source',
    typeVersion: 1,
    name: 'Test Node',
    ...overrides,
    config: { ...(overrides.config ?? {}) },
  };
}

export function createFlowEdge(overrides: Partial<FlowEdge> = {}): FlowEdge {
  return {
    id: 'test-edge-1',
    sourceNodeId: 'node-source-1',
    sourcePortId: 'out',
    targetNodeId: 'node-sink-1',
    targetPortId: 'in',
    ...overrides,
  };
}

export interface MinimalFlowDocumentOverrides {
  metadata?: Partial<FlowDocument['metadata']>;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  layout?: FlowLayout;
}

export function createMinimalFlowDocument(
  overrides: MinimalFlowDocumentOverrides = {},
): FlowDocument {
  const nodes =
    overrides.nodes ??
    [
      createFlowNode({
        id: 'node-source-1',
        type: 'test-source',
        name: 'Source',
        config: {},
      }),
      createFlowNode({
        id: 'node-sink-1',
        type: 'test-sink',
        name: 'Sink',
        config: {},
      }),
    ];

  const edges =
    overrides.edges ??
    [
      createFlowEdge({
        id: 'edge-1',
        sourceNodeId: 'node-source-1',
        sourcePortId: 'out',
        targetNodeId: 'node-sink-1',
        targetPortId: 'in',
      }),
    ];

  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: {
      id: 'flow-test-1',
      name: 'Test Flow',
      ...overrides.metadata,
    },
    spec: { nodes, edges },
    layout: overrides.layout ?? {
      nodes: {
        'node-source-1': { x: 0, y: 0 },
        'node-sink-1': { x: 320, y: 120 },
      },
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}
