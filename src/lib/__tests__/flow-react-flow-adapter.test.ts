import {
  FLOW_CANVAS_NODE_TYPE,
  toReactFlow,
  toReactFlowEdges,
  toReactFlowNodes,
} from '@/components/flow-studio/canvas/to-react-flow';
import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';

describe('flow -> react flow adapter', () => {
  it('maps layout positions onto view nodes', () => {
    const doc = createMinimalFlowDocument({
      layout: {
        nodes: {
          'node-source-1': { x: 10, y: 20 },
          'node-sink-1': { x: 320, y: 120 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    const nodes = toReactFlowNodes(doc);

    expect(nodes).toHaveLength(2);
    expect(nodes.find((node) => node.id === 'node-source-1')?.position).toEqual({
      x: 10,
      y: 20,
    });
    expect(nodes.find((node) => node.id === 'node-sink-1')?.position).toEqual({
      x: 320,
      y: 120,
    });
  });

  it('defaults node position to {0,0} only when layout is missing', () => {
    const doc = createMinimalFlowDocument({
      layout: {
        nodes: {
          'node-source-1': { x: 42, y: 84 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    const nodes = toReactFlowNodes(doc);

    expect(nodes.find((node) => node.id === 'node-source-1')?.position).toEqual({
      x: 42,
      y: 84,
    });
    expect(nodes.find((node) => node.id === 'node-sink-1')?.position).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('carries only semantic display data and no metrics on nodes', () => {
    const doc = createMinimalFlowDocument();

    const nodes = toReactFlowNodes(doc);
    const source = nodes.find((node) => node.id === 'node-source-1');

    expect(source?.type).toBe(FLOW_CANVAS_NODE_TYPE);
    expect(source?.data).toEqual({
      id: 'node-source-1',
      type: 'test-source',
      typeVersion: 1,
      name: 'Source',
      config: {},
    });
    expect(Object.keys(source?.data ?? {}).sort()).toEqual([
      'config',
      'id',
      'name',
      'type',
      'typeVersion',
    ]);
    for (const node of nodes) {
      expect(node.data).not.toHaveProperty('metrics');
      expect(node.data).not.toHaveProperty('runtime');
      expect(node.data).not.toHaveProperty('nodeMetrics');
      expect(node.data).not.toHaveProperty('debugState');
      expect(node).not.toHaveProperty('metrics');
    }
  });

  it('references node config instead of cloning it', () => {
    const doc = createMinimalFlowDocument();

    const nodes = toReactFlowNodes(doc);

    expect(nodes.find((node) => node.id === 'node-source-1')?.data.config).toBe(
      doc.spec.nodes.find((node) => node.id === 'node-source-1')?.config,
    );
  });

  it('preserves semantic port IDs as edge handle IDs', () => {
    const doc = createMinimalFlowDocument({
      edges: [
        {
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out-main',
          targetNodeId: 'node-sink-1',
          targetPortId: 'in-primary',
        },
      ],
    });

    const edges = toReactFlowEdges(doc);

    expect(edges).toEqual([
      {
        id: 'edge-1',
        source: 'node-source-1',
        target: 'node-sink-1',
        sourceHandle: 'out-main',
        targetHandle: 'in-primary',
      },
    ]);
  });

  it('is deterministic across calls', () => {
    const doc = createMinimalFlowDocument();

    const first = toReactFlow(doc);
    const second = toReactFlow(doc);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.nodes).not.toBe(first.nodes);
    expect(second.edges).not.toBe(first.edges);
  });

  it('does not mutate the input document', () => {
    const doc = createMinimalFlowDocument();
    const snapshot = JSON.stringify(doc);

    toReactFlow(doc);

    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it('preserves document order for nodes and edges', () => {
    const doc = createMinimalFlowDocument({
      nodes: [
        {
          id: 'node-b',
          type: 'test-transform',
          typeVersion: 2,
          name: 'B',
          config: {},
        },
        {
          id: 'node-a',
          type: 'test-source',
          typeVersion: 1,
          name: 'A',
          config: {},
        },
      ],
      edges: [
        {
          id: 'edge-2',
          sourceNodeId: 'node-b',
          sourcePortId: 'out',
          targetNodeId: 'node-a',
          targetPortId: 'in',
        },
        {
          id: 'edge-1',
          sourceNodeId: 'node-a',
          sourcePortId: 'out',
          targetNodeId: 'node-b',
          targetPortId: 'in',
        },
      ],
    });

    const view = toReactFlow(doc);

    expect(view.nodes.map((node) => node.id)).toEqual(['node-b', 'node-a']);
    expect(view.edges.map((edge) => edge.id)).toEqual(['edge-2', 'edge-1']);
  });
});
