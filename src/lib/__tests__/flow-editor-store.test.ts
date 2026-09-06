import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';
import { hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
import {
  createFlowNodeForDefinition,
  generateFlowNodeId,
} from '@/lib/flows/model/create-flow-node';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';
import {
  DEFAULT_FLOW_VIEWPORT,
  useFlowEditorStore,
} from '@/stores/flow-editor-store';

beforeEach(() => {
  useFlowEditorStore.getState().clearDocument();
});

describe('flow editor store', () => {
  it('starts empty with a default viewport', () => {
    const state = useFlowEditorStore.getState();

    expect(state.document).toBeNull();
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.selectedEdgeIds).toEqual([]);
    expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('loads a document and adopts its layout viewport', () => {
    const doc = createMinimalFlowDocument({
      layout: {
        nodes: { 'node-source-1': { x: 10, y: 20 } },
        viewport: { x: 5, y: 6, zoom: 2 },
      },
    });

    useFlowEditorStore.getState().loadDocument(doc);

    const state = useFlowEditorStore.getState();
    expect(state.document).toEqual(doc);
    expect(state.viewport).toEqual({ x: 5, y: 6, zoom: 2 });
  });

  it('falls back to the default viewport when the document has none', () => {
    const doc = createMinimalFlowDocument({
      layout: { nodes: { 'node-source-1': { x: 1, y: 2 } } },
    });

    useFlowEditorStore.getState().loadDocument(doc);

    expect(useFlowEditorStore.getState().viewport).toEqual(DEFAULT_FLOW_VIEWPORT);
  });

  it('clones the loaded document without mutating the supplied input', () => {
    const doc = createMinimalFlowDocument();

    useFlowEditorStore.getState().loadDocument(doc);

    const stored = useFlowEditorStore.getState().document;
    expect(stored).toEqual(doc);
    expect(stored).not.toBe(doc);

    doc.metadata.name = 'Mutated after load';
    doc.spec.nodes[0].config = { injected: true };
    expect(useFlowEditorStore.getState().document?.metadata.name).toBe('Test Flow');
    expect(useFlowEditorStore.getState().document?.spec.nodes[0].config).toEqual({});
  });

  it('resets selection when a new document is loaded', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    useFlowEditorStore
      .getState()
      .setSelection({ nodeIds: ['node-source-1'], edgeIds: ['edge-1'] });

    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());

    const state = useFlowEditorStore.getState();
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.selectedEdgeIds).toEqual([]);
  });

  it('sets node and edge selection', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());

    useFlowEditorStore
      .getState()
      .setSelection({ nodeIds: ['node-source-1'], edgeIds: ['edge-1'] });

    const state = useFlowEditorStore.getState();
    expect(state.selectedNodeIds).toEqual(['node-source-1']);
    expect(state.selectedEdgeIds).toEqual(['edge-1']);
  });

  it('copies selection arrays instead of holding caller references', () => {
    const nodeIds = ['node-source-1'];
    const edgeIds = ['edge-1'];

    useFlowEditorStore.getState().setSelection({ nodeIds, edgeIds });
    nodeIds.push('node-sink-1');

    expect(useFlowEditorStore.getState().selectedNodeIds).toEqual(['node-source-1']);
  });

  it('sets the viewport without holding caller references', () => {
    const viewport = { x: 11, y: 22, zoom: 1.5 };

    useFlowEditorStore.getState().setViewport(viewport);
    viewport.x = 999;

    expect(useFlowEditorStore.getState().viewport).toEqual({ x: 11, y: 22, zoom: 1.5 });
  });

  it('clears the document, selection, and viewport', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    useFlowEditorStore
      .getState()
      .setSelection({ nodeIds: ['node-source-1'], edgeIds: ['edge-1'] });
    useFlowEditorStore.getState().setViewport({ x: 3, y: 4, zoom: 2 });

    useFlowEditorStore.getState().clearDocument();

    const state = useFlowEditorStore.getState();
    expect(state.document).toBeNull();
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.selectedEdgeIds).toEqual([]);
    expect(state.viewport).toEqual(DEFAULT_FLOW_VIEWPORT);
  });

  it('holds no runtime metrics fields', () => {
    const state = useFlowEditorStore.getState();

    expect(state).not.toHaveProperty('metrics');
    expect(state).not.toHaveProperty('runtime');
    expect(state).not.toHaveProperty('debugState');
    expect(state).not.toHaveProperty('nodeMetrics');
  });

  it('moveNode changes layout coordinates only and keeps the semantic hash stable', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const before = useFlowEditorStore.getState().document;
    expect(before).not.toBeNull();
    const semanticBefore = hashFlowSemantic(before!.spec);
    const specRef = before!.spec;

    useFlowEditorStore.getState().moveNode('node-source-1', { x: 240, y: 180 });

    const after = useFlowEditorStore.getState().document;
    expect(after?.layout.nodes['node-source-1']).toEqual({ x: 240, y: 180 });
    expect(after?.layout.nodes['node-sink-1']).toEqual({ x: 320, y: 120 });
    expect(after?.spec).toBe(specRef);
    expect(hashFlowSemantic(after!.spec)).toBe(semanticBefore);
  });

  it('moveNode copies the supplied position instead of holding the caller reference', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const position = { x: 50, y: 60 };

    useFlowEditorStore.getState().moveNode('node-source-1', position);
    position.x = 999;

    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 50, y: 60 });
  });

  it('moveNodes updates multiple layout entries in one batch without touching spec', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const specRef = useFlowEditorStore.getState().document!.spec;
    const semanticBefore = hashFlowSemantic(specRef);

    useFlowEditorStore.getState().moveNodes([
      { nodeId: 'node-source-1', position: { x: 11, y: 22 } },
      { nodeId: 'node-sink-1', position: { x: 33, y: 44 } },
    ]);

    const after = useFlowEditorStore.getState().document;
    expect(after?.layout.nodes['node-source-1']).toEqual({ x: 11, y: 22 });
    expect(after?.layout.nodes['node-sink-1']).toEqual({ x: 33, y: 44 });
    expect(after?.spec).toBe(specRef);
    expect(hashFlowSemantic(after!.spec)).toBe(semanticBefore);
  });

  it('move actions are a no-op without a loaded document', () => {
    useFlowEditorStore.getState().moveNode('node-source-1', { x: 1, y: 1 });
    expect(useFlowEditorStore.getState().document).toBeNull();

    useFlowEditorStore.getState().moveNodes([
      { nodeId: 'node-source-1', position: { x: 1, y: 1 } },
    ]);
    expect(useFlowEditorStore.getState().document).toBeNull();
  });

  it('updateNodeConfig shallow-merges config into spec only', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const before = useFlowEditorStore.getState().document;
    expect(before).not.toBeNull();
    const layoutRef = before!.layout;
    const edgesRef = before!.spec.edges;

    useFlowEditorStore
      .getState()
      .updateNodeConfig('node-source-1', { topic: 'devices/+/data', qos: 1 });

    const after = useFlowEditorStore.getState().document;
    expect(after?.spec.nodes[0].config).toEqual({
      topic: 'devices/+/data',
      qos: 1,
    });
    expect(after?.spec.nodes[1].config).toEqual({});
    expect(after?.layout).toBe(layoutRef);
    expect(after?.spec.edges).toBe(edgesRef);
    expect(hashFlowSemantic(after!.spec)).not.toBe(
      hashFlowSemantic(before!.spec),
    );
  });

  it('updateNodeConfig merges over existing keys and cannot change id/type/typeVersion', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    useFlowEditorStore
      .getState()
      .updateNodeConfig('node-source-1', { topic: 'a', retained: false });
    useFlowEditorStore
      .getState()
      .updateNodeConfig('node-source-1', {
        topic: 'b',
        id: 'hacked',
        type: 'hacked',
        typeVersion: 999,
      });

    const node = useFlowEditorStore
      .getState()
      .document?.spec.nodes.find((entry) => entry.id === 'node-source-1');
    expect(node?.id).toBe('node-source-1');
    expect(node?.type).toBe('test-source');
    expect(node?.typeVersion).toBe(1);
    expect(node?.config).toEqual({
      topic: 'b',
      retained: false,
      id: 'hacked',
      type: 'hacked',
      typeVersion: 999,
    });
  });

  it('renameNode changes only the node name in spec', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const before = useFlowEditorStore.getState().document;
    expect(before).not.toBeNull();
    const layoutRef = before!.layout;
    const edgesRef = before!.spec.edges;

    useFlowEditorStore.getState().renameNode('node-source-1', 'Renamed Source');

    const after = useFlowEditorStore.getState().document;
    const renamed = after?.spec.nodes.find(
      (entry) => entry.id === 'node-source-1',
    );
    expect(renamed?.name).toBe('Renamed Source');
    expect(renamed?.type).toBe('test-source');
    expect(renamed?.typeVersion).toBe(1);
    expect(renamed?.config).toEqual({});
    expect(after?.spec.nodes[1].name).toBe('Sink');
    expect(after?.layout).toBe(layoutRef);
    expect(after?.spec.edges).toBe(edgesRef);
  });

  it('addEdge appends to spec.edges only without touching layout', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const before = useFlowEditorStore.getState().document;
    expect(before).not.toBeNull();
    const layoutRef = before!.layout;
    const nodesRef = before!.spec.nodes;

    useFlowEditorStore.getState().addEdge({
      id: 'edge-2',
      sourceNodeId: 'node-source-1',
      sourcePortId: 'out',
      targetNodeId: 'node-sink-1',
      targetPortId: 'in',
    });

    const after = useFlowEditorStore.getState().document;
    expect(after?.spec.edges).toHaveLength(2);
    expect(after?.spec.edges[1]).toEqual({
      id: 'edge-2',
      sourceNodeId: 'node-source-1',
      sourcePortId: 'out',
      targetNodeId: 'node-sink-1',
      targetPortId: 'in',
    });
    expect(after?.layout).toBe(layoutRef);
    expect(after?.spec.nodes).toBe(nodesRef);
  });

  it('addEdge copies the supplied edge instead of holding the caller reference', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const edge = {
      id: 'edge-2',
      sourceNodeId: 'node-source-1',
      sourcePortId: 'out',
      targetNodeId: 'node-sink-1',
      targetPortId: 'in',
    };

    useFlowEditorStore.getState().addEdge(edge);
    edge.id = 'mutated';

    expect(
      useFlowEditorStore.getState().document?.spec.edges[1]?.id,
    ).toBe('edge-2');
  });

  it('addEdge rejects a duplicate edge ID with an internal error', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const before = useFlowEditorStore.getState().document;
    expect(before).not.toBeNull();

    expect(() =>
      useFlowEditorStore.getState().addEdge({
        id: 'edge-1',
        sourceNodeId: 'node-source-1',
        sourcePortId: 'out',
        targetNodeId: 'node-sink-1',
        targetPortId: 'in',
      }),
    ).toThrow('Duplicate flow edge id "edge-1".');
    expect(useFlowEditorStore.getState().document?.spec.edges).toHaveLength(1);
  });

  it('removeEdges removes only matching edges without touching layout', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    useFlowEditorStore.getState().addEdge({
      id: 'edge-2',
      sourceNodeId: 'node-source-1',
      sourcePortId: 'out',
      targetNodeId: 'node-sink-1',
      targetPortId: 'in',
    });
    const before = useFlowEditorStore.getState().document;
    expect(before).not.toBeNull();
    const layoutRef = before!.layout;
    const nodesRef = before!.spec.nodes;

    useFlowEditorStore.getState().removeEdges(['edge-1']);

    const after = useFlowEditorStore.getState().document;
    expect(after?.spec.edges.map((entry) => entry.id)).toEqual(['edge-2']);
    expect(after?.layout).toBe(layoutRef);
    expect(after?.spec.nodes).toBe(nodesRef);
  });

  it('removeEdges is a no-op for unknown IDs, empty input, and without a document', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const before = useFlowEditorStore.getState().document;
    expect(before).not.toBeNull();

    useFlowEditorStore.getState().removeEdges(['edge-unknown']);
    expect(useFlowEditorStore.getState().document).toBe(before);

    useFlowEditorStore.getState().removeEdges([]);
    expect(useFlowEditorStore.getState().document).toBe(before);

    useFlowEditorStore.getState().clearDocument();
    useFlowEditorStore.getState().removeEdges(['edge-1']);
    expect(useFlowEditorStore.getState().document).toBeNull();

    useFlowEditorStore.getState().addEdge({
      id: 'edge-1',
      sourceNodeId: 'node-source-1',
      sourcePortId: 'out',
      targetNodeId: 'node-sink-1',
      targetPortId: 'in',
    });
    expect(useFlowEditorStore.getState().document).toBeNull();
  });

  it('semantic node actions are a no-op for unknown node IDs and without a document', () => {
    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    const before = useFlowEditorStore.getState().document;
    expect(before).not.toBeNull();

    useFlowEditorStore
      .getState()
      .updateNodeConfig('node-unknown', { topic: 'x' });
    expect(useFlowEditorStore.getState().document).toBe(before);

    useFlowEditorStore.getState().renameNode('node-unknown', 'Ghost');
    expect(useFlowEditorStore.getState().document).toBe(before);

    useFlowEditorStore.getState().clearDocument();
    useFlowEditorStore
      .getState()
      .updateNodeConfig('node-source-1', { topic: 'x' });
    expect(useFlowEditorStore.getState().document).toBeNull();
    useFlowEditorStore.getState().renameNode('node-source-1', 'Ghost');
    expect(useFlowEditorStore.getState().document).toBeNull();
  });

  describe('addNode', () => {
    const definitionWithDefaults: FlowNodeDefinition = {
      type: 'test-transform',
      version: 2,
      displayName: 'Test Transform',
      description: 'Transform fixture with property defaults.',
      category: 'transform',
      inputs: [{ id: 'in', kind: 'stream' }],
      outputs: [{ id: 'out', kind: 'stream' }],
      properties: [
        { key: 'label', label: 'Label', type: 'string', defaultValue: 'hello' },
        { key: 'count', label: 'Count', type: 'number', defaultValue: 3 },
        {
          key: 'enabled',
          label: 'Enabled',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'options',
          label: 'Options',
          type: 'json',
          defaultValue: { nested: [1, 2] },
        },
        { key: 'topic', label: 'Topic', type: 'string' },
      ],
    };

    it('appends a semantic node and layout entry with definition defaults', () => {
      useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
      const before = useFlowEditorStore.getState().document;
      expect(before).not.toBeNull();
      const edgesRef = before!.spec.edges;

      const createdId = useFlowEditorStore.getState().addNode({
        id: 'node-transform-1',
        definition: definitionWithDefaults,
        position: { x: 120, y: 80 },
      });

      expect(createdId).toBe('node-transform-1');
      const after = useFlowEditorStore.getState().document;
      expect(after?.spec.nodes).toHaveLength(3);
      const node = after?.spec.nodes.find(
        (entry) => entry.id === 'node-transform-1',
      );
      // Exact shape: no compiler/runtime IDs or other extra fields.
      expect(node).toEqual({
        id: 'node-transform-1',
        type: 'test-transform',
        typeVersion: 2,
        name: 'Test Transform',
        config: {
          label: 'hello',
          count: 3,
          enabled: true,
          options: { nested: [1, 2] },
        },
      });
      expect(after?.layout.nodes['node-transform-1']).toEqual({
        x: 120,
        y: 80,
      });
      expect(after?.spec.edges).toBe(edgesRef);
      expect(after?.spec.edges).toHaveLength(1);
    });

    it('supports a name override and copies the position', () => {
      useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
      const position = { x: 7, y: 9 };

      useFlowEditorStore.getState().addNode({
        id: 'node-transform-1',
        definition: definitionWithDefaults,
        position,
        name: 'Custom Name',
      });
      position.x = 999;

      const state = useFlowEditorStore.getState();
      const node = state.document?.spec.nodes.find(
        (entry) => entry.id === 'node-transform-1',
      );
      expect(node?.name).toBe('Custom Name');
      expect(state.document?.layout.nodes['node-transform-1']).toEqual({
        x: 7,
        y: 9,
      });
    });

    it('copies mutable defaults without sharing objects between nodes', () => {
      useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());

      useFlowEditorStore.getState().addNode({
        id: 'node-a',
        definition: definitionWithDefaults,
        position: { x: 0, y: 0 },
      });
      useFlowEditorStore.getState().addNode({
        id: 'node-b',
        definition: definitionWithDefaults,
        position: { x: 10, y: 10 },
      });

      const doc = useFlowEditorStore.getState().document;
      const nodeA = doc?.spec.nodes.find((entry) => entry.id === 'node-a');
      const nodeB = doc?.spec.nodes.find((entry) => entry.id === 'node-b');
      expect(nodeA?.config['options']).toEqual({ nested: [1, 2] });
      expect(nodeB?.config['options']).toEqual({ nested: [1, 2] });
      expect(nodeA?.config['options']).not.toBe(nodeB?.config['options']);

      ((nodeA?.config['options'] as { nested: number[] }).nested).push(3);
      expect(nodeB?.config['options']).toEqual({ nested: [1, 2] });
      expect(definitionWithDefaults.properties[3]?.defaultValue).toEqual({
        nested: [1, 2],
      });
    });

    it('undo removes the added node and its layout entry', () => {
      useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());

      useFlowEditorStore.getState().addNode({
        id: 'node-transform-1',
        definition: definitionWithDefaults,
        position: { x: 120, y: 80 },
      });
      expect(
        useFlowEditorStore.getState().document?.spec.nodes,
      ).toHaveLength(3);

      useFlowEditorStore.getState().undo();

      const after = useFlowEditorStore.getState().document;
      expect(after?.spec.nodes.map((entry) => entry.id)).toEqual([
        'node-source-1',
        'node-sink-1',
      ]);
      expect(after?.layout.nodes['node-transform-1']).toBeUndefined();
      expect(after?.spec.edges).toHaveLength(1);

      useFlowEditorStore.getState().redo();
      expect(
        useFlowEditorStore.getState().document?.spec.nodes,
      ).toHaveLength(3);
      expect(
        useFlowEditorStore.getState().document?.layout.nodes[
          'node-transform-1'
        ],
      ).toEqual({ x: 120, y: 80 });
    });

    it('rejects a duplicate node ID with an internal error', () => {
      useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());

      expect(() =>
        useFlowEditorStore.getState().addNode({
          id: 'node-source-1',
          definition: definitionWithDefaults,
          position: { x: 1, y: 1 },
        }),
      ).toThrow('Duplicate flow node id "node-source-1".');
      expect(
        useFlowEditorStore.getState().document?.spec.nodes,
      ).toHaveLength(2);
    });

    it('is a no-op without a loaded document', () => {
      const createdId = useFlowEditorStore.getState().addNode({
        id: 'node-transform-1',
        definition: definitionWithDefaults,
        position: { x: 1, y: 1 },
      });

      expect(createdId).toBeNull();
      expect(useFlowEditorStore.getState().document).toBeNull();
    });
  });

  describe('createFlowNodeForDefinition', () => {
    const definition: FlowNodeDefinition = {
      type: 'test-source',
      version: 1,
      displayName: 'Test Source',
      description: 'Source fixture.',
      category: 'source',
      inputs: [],
      outputs: [{ id: 'out', kind: 'stream' }],
      properties: [
        { key: 'topic', label: 'Topic', type: 'string' },
        { key: 'qos', label: 'QoS', type: 'number', defaultValue: 0 },
      ],
    };

    it('omits properties without defaults and preserves false/0 values', () => {
      const created = createFlowNodeForDefinition({
        id: 'node-1',
        definition,
        position: { x: 3, y: 4 },
      });

      expect(created.node.config).toEqual({ qos: 0 });
      expect(created.node.name).toBe('Test Source');
      expect(created.position).toEqual({ x: 3, y: 4 });
    });

    it('generates unique non-empty authoring IDs', () => {
      const first = generateFlowNodeId();
      const second = generateFlowNodeId();

      expect(typeof first).toBe('string');
      expect(first.length).toBeGreaterThan(0);
      expect(second).not.toBe(first);
    });
  });
});
