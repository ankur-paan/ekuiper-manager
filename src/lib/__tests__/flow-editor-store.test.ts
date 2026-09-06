import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';
import { hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
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
});
