import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';
import {
  FLOW_EDITOR_HISTORY_LIMIT,
  useFlowEditorStore,
} from '@/stores/flow-editor-store';

beforeEach(() => {
  useFlowEditorStore.getState().clearDocument();
});

function loadMinimal() {
  useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
}

describe('flow editor history', () => {
  it('starts with empty history and no-op undo/redo', () => {
    loadMinimal();

    const before = useFlowEditorStore.getState();
    expect(before.canUndo).toBe(false);
    expect(before.canRedo).toBe(false);
    expect(before.past).toEqual([]);
    expect(before.future).toEqual([]);

    useFlowEditorStore.getState().undo();
    useFlowEditorStore.getState().redo();

    const after = useFlowEditorStore.getState();
    expect(after.document).toBe(before.document);
    expect(after.canUndo).toBe(false);
    expect(after.canRedo).toBe(false);
  });

  it('undoes and redoes a layout-only move', () => {
    loadMinimal();

    useFlowEditorStore.getState().moveNode('node-source-1', { x: 240, y: 180 });
    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 240, y: 180 });
    expect(useFlowEditorStore.getState().canUndo).toBe(true);

    useFlowEditorStore.getState().undo();
    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 0, y: 0 });
    expect(useFlowEditorStore.getState().canUndo).toBe(false);
    expect(useFlowEditorStore.getState().canRedo).toBe(true);

    useFlowEditorStore.getState().redo();
    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 240, y: 180 });
    expect(useFlowEditorStore.getState().canRedo).toBe(false);
  });

  it('treats a batched moveNodes commit as a single history entry', () => {
    loadMinimal();

    useFlowEditorStore.getState().moveNodes([
      { nodeId: 'node-source-1', position: { x: 11, y: 22 } },
      { nodeId: 'node-sink-1', position: { x: 33, y: 44 } },
    ]);
    expect(useFlowEditorStore.getState().past).toHaveLength(1);

    useFlowEditorStore.getState().undo();
    expect(
      useFlowEditorStore.getState().document?.layout.nodes,
    ).toEqual({
      'node-source-1': { x: 0, y: 0 },
      'node-sink-1': { x: 320, y: 120 },
    });

    useFlowEditorStore.getState().redo();
    expect(
      useFlowEditorStore.getState().document?.layout.nodes,
    ).toEqual({
      'node-source-1': { x: 11, y: 22 },
      'node-sink-1': { x: 33, y: 44 },
    });
  });

  it('undoes and redoes a semantic config change', () => {
    loadMinimal();

    useFlowEditorStore
      .getState()
      .updateNodeConfig('node-source-1', { topic: 'devices/+/data' });
    expect(
      useFlowEditorStore
        .getState()
        .document?.spec.nodes.find((entry) => entry.id === 'node-source-1')
        ?.config,
    ).toEqual({ topic: 'devices/+/data' });

    useFlowEditorStore.getState().undo();
    expect(
      useFlowEditorStore
        .getState()
        .document?.spec.nodes.find((entry) => entry.id === 'node-source-1')
        ?.config,
    ).toEqual({});

    useFlowEditorStore.getState().redo();
    expect(
      useFlowEditorStore
        .getState()
        .document?.spec.nodes.find((entry) => entry.id === 'node-source-1')
        ?.config,
    ).toEqual({ topic: 'devices/+/data' });
  });

  it('undoes and redoes a rename', () => {
    loadMinimal();

    useFlowEditorStore.getState().renameNode('node-source-1', 'Renamed');
    expect(
      useFlowEditorStore
        .getState()
        .document?.spec.nodes.find((entry) => entry.id === 'node-source-1')
        ?.name,
    ).toBe('Renamed');

    useFlowEditorStore.getState().undo();
    expect(
      useFlowEditorStore
        .getState()
        .document?.spec.nodes.find((entry) => entry.id === 'node-source-1')
        ?.name,
    ).toBe('Source');

    useFlowEditorStore.getState().redo();
    expect(
      useFlowEditorStore
        .getState()
        .document?.spec.nodes.find((entry) => entry.id === 'node-source-1')
        ?.name,
    ).toBe('Renamed');
  });

  it('undoes and redoes edge add and remove', () => {
    loadMinimal();

    useFlowEditorStore.getState().addEdge({
      id: 'edge-2',
      sourceNodeId: 'node-source-1',
      sourcePortId: 'out',
      targetNodeId: 'node-sink-1',
      targetPortId: 'in',
    });
    expect(
      useFlowEditorStore.getState().document?.spec.edges.map((e) => e.id),
    ).toEqual(['edge-1', 'edge-2']);

    useFlowEditorStore.getState().undo();
    expect(
      useFlowEditorStore.getState().document?.spec.edges.map((e) => e.id),
    ).toEqual(['edge-1']);

    useFlowEditorStore.getState().redo();
    expect(
      useFlowEditorStore.getState().document?.spec.edges.map((e) => e.id),
    ).toEqual(['edge-1', 'edge-2']);

    useFlowEditorStore.getState().removeEdges(['edge-1']);
    expect(
      useFlowEditorStore.getState().document?.spec.edges.map((e) => e.id),
    ).toEqual(['edge-2']);

    useFlowEditorStore.getState().undo();
    expect(
      useFlowEditorStore.getState().document?.spec.edges.map((e) => e.id),
    ).toEqual(['edge-1', 'edge-2']);

    useFlowEditorStore.getState().redo();
    expect(
      useFlowEditorStore.getState().document?.spec.edges.map((e) => e.id),
    ).toEqual(['edge-2']);
  });

  it('clears redo after a new change following undo', () => {
    loadMinimal();

    useFlowEditorStore.getState().moveNode('node-source-1', { x: 10, y: 10 });
    useFlowEditorStore.getState().undo();
    expect(useFlowEditorStore.getState().canRedo).toBe(true);

    useFlowEditorStore.getState().moveNode('node-source-1', { x: 20, y: 20 });
    expect(useFlowEditorStore.getState().canRedo).toBe(false);
    expect(useFlowEditorStore.getState().future).toEqual([]);
    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 20, y: 20 });

    // Redo is now a no-op and must not restore the branched-away position.
    useFlowEditorStore.getState().redo();
    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 20, y: 20 });
  });

  it('caps history at 100 commands without a huge fixture', () => {
    loadMinimal();
    expect(FLOW_EDITOR_HISTORY_LIMIT).toBe(100);

    for (let i = 1; i <= FLOW_EDITOR_HISTORY_LIMIT + 5; i += 1) {
      useFlowEditorStore
        .getState()
        .updateNodeConfig('node-source-1', { revision: i });
    }

    expect(useFlowEditorStore.getState().past).toHaveLength(
      FLOW_EDITOR_HISTORY_LIMIT,
    );

    // The oldest retained snapshot holds revision 5; revisions 1-5 snapshots
    // were evicted except that revision 5 remains reachable via undo depth.
    for (let i = 0; i < FLOW_EDITOR_HISTORY_LIMIT; i += 1) {
      useFlowEditorStore.getState().undo();
    }
    expect(
      useFlowEditorStore
        .getState()
        .document?.spec.nodes.find((entry) => entry.id === 'node-source-1')
        ?.config,
    ).toEqual({ revision: 5 });
    expect(useFlowEditorStore.getState().canUndo).toBe(false);

    // One more undo is a no-op once the capped history is exhausted.
    useFlowEditorStore.getState().undo();
    expect(
      useFlowEditorStore
        .getState()
        .document?.spec.nodes.find((entry) => entry.id === 'node-source-1')
        ?.config,
    ).toEqual({ revision: 5 });
  });

  it('resets history when a document is loaded', () => {
    loadMinimal();
    useFlowEditorStore.getState().moveNode('node-source-1', { x: 9, y: 9 });
    expect(useFlowEditorStore.getState().canUndo).toBe(true);

    useFlowEditorStore.getState().loadDocument(createMinimalFlowDocument());
    expect(useFlowEditorStore.getState().past).toEqual([]);
    expect(useFlowEditorStore.getState().future).toEqual([]);
    expect(useFlowEditorStore.getState().canUndo).toBe(false);
    expect(useFlowEditorStore.getState().canRedo).toBe(false);

    useFlowEditorStore.getState().undo();
    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 0, y: 0 });
  });

  it('does not include selection or viewport in undo history', () => {
    loadMinimal();
    useFlowEditorStore.getState().moveNode('node-source-1', { x: 42, y: 43 });

    useFlowEditorStore
      .getState()
      .setSelection({ nodeIds: ['node-source-1'], edgeIds: [] });
    useFlowEditorStore.getState().setViewport({ x: 7, y: 8, zoom: 2 });

    useFlowEditorStore.getState().undo();

    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 0, y: 0 });
    expect(useFlowEditorStore.getState().selectedNodeIds).toEqual([
      'node-source-1',
    ]);
    expect(useFlowEditorStore.getState().viewport).toEqual({ x: 7, y: 8, zoom: 2 });

    useFlowEditorStore.getState().redo();
    expect(
      useFlowEditorStore.getState().document?.layout.nodes['node-source-1'],
    ).toEqual({ x: 42, y: 43 });
    expect(useFlowEditorStore.getState().selectedNodeIds).toEqual([
      'node-source-1',
    ]);
    expect(useFlowEditorStore.getState().viewport).toEqual({ x: 7, y: 8, zoom: 2 });
  });

  it('does not record no-op edits in history', () => {
    loadMinimal();

    useFlowEditorStore.getState().moveNode('node-source-1', { x: 0, y: 0 });
    useFlowEditorStore
      .getState()
      .updateNodeConfig('node-unknown', { topic: 'x' });
    useFlowEditorStore.getState().renameNode('node-source-1', 'Source');
    useFlowEditorStore.getState().removeEdges(['edge-unknown']);

    expect(useFlowEditorStore.getState().past).toEqual([]);
    expect(useFlowEditorStore.getState().canUndo).toBe(false);
  });
});
