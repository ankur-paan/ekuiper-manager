import {
  buildFlowDirtyBaseline,
  computeFlowDirtyState,
} from '@/lib/flows/model/flow-dirty-state';
import { canonicalJson } from '@/lib/flows/hashing/canonical-json';
import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';
import { useFlowEditorStore } from '@/stores/flow-editor-store';

beforeEach(() => {
  useFlowEditorStore.getState().clearDocument();
});

/**
 * R2 regression: clearing a property must delete the config key (the single
 * clear-value representation) so the document stays JSON-compatible and
 * computeFlowDirtyState never throws.
 *
 * Simulates exactly what number/select/JSON controls emit when emptied
 * (property-field.tsx `onChange(undefined)` -> `updateNodeConfig(id, {key:
 * undefined})`), starting from a saved config {length: 10}.
 */
describe('R2: clearing a property deletes the key instead of storing undefined', () => {
  function loadSavedDoc() {
    const doc = createMinimalFlowDocument({
      nodes: [
        {
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: 'Source',
          config: {
            length: 10,
            mode: 'auto',
            payload: { threshold: 5 },
          },
        },
        {
          id: 'node-sink-1',
          type: 'test-sink',
          typeVersion: 1,
          name: 'Sink',
          config: {},
        },
      ],
    });
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);
    useFlowEditorStore.getState().loadDocument(doc);
    return baseline;
  }

  function configOf(nodeId: string): Record<string, unknown> {
    const doc = useFlowEditorStore.getState().document;
    expect(doc).not.toBeNull();
    const node = doc!.spec.nodes.find((entry) => entry.id === nodeId);
    expect(node).toBeDefined();
    return node!.config;
  }

  it('clearing Length (number) from {length: 10} stays serializable and reports semanticDirty', () => {
    const baseline = loadSavedDoc();

    // NumberField emits undefined when the input is emptied.
    useFlowEditorStore.getState().updateNodeConfig('node-source-1', {
      length: undefined,
    });

    const config = configOf('node-source-1');
    expect(Object.prototype.hasOwnProperty.call(config, 'length')).toBe(false);
    expect(config).toEqual({ mode: 'auto', payload: { threshold: 5 } });

    const doc = useFlowEditorStore.getState().document!;
    let dirty: ReturnType<typeof computeFlowDirtyState>;
    expect(() => {
      dirty = computeFlowDirtyState(doc.spec, doc.layout, baseline);
    }).not.toThrow();
    expect(dirty!.semanticDirty).toBe(true);
    expect(dirty!.layoutDirty).toBe(false);
    // Document must remain canonical-serializable (autosave/PUT invariant).
    expect(() => canonicalJson(doc.spec)).not.toThrow();
    expect(JSON.parse(JSON.stringify(doc.spec))).toEqual(
      JSON.parse(canonicalJson(doc.spec)),
    );
  });

  it('clearing number, select and JSON values then undo/redo round-trips the config', () => {
    const baseline = loadSavedDoc();
    const store = () => useFlowEditorStore.getState();

    // Clear number (NumberField empty -> undefined).
    store().updateNodeConfig('node-source-1', { length: undefined });
    expect(configOf('node-source-1')).toEqual({
      mode: 'auto',
      payload: { threshold: 5 },
    });

    // Clear select (SelectField placeholder -> undefined).
    store().updateNodeConfig('node-source-1', { mode: undefined });
    expect(configOf('node-source-1')).toEqual({
      payload: { threshold: 5 },
    });

    // Clear JSON (JsonField empty text -> undefined).
    store().updateNodeConfig('node-source-1', { payload: undefined });
    const cleared = configOf('node-source-1');
    expect(cleared).toEqual({});
    expect(Object.keys(cleared)).toEqual([]);

    // Dirty calculation (page render + autosave hook path) must not throw
    // and must report a semantic change versus the saved baseline.
    const clearedDoc = store().document!;
    let dirty: ReturnType<typeof computeFlowDirtyState>;
    expect(() => {
      dirty = computeFlowDirtyState(
        clearedDoc.spec,
        clearedDoc.layout,
        baseline,
      );
    }).not.toThrow();
    expect(dirty!).toEqual({ semanticDirty: true, layoutDirty: false });
    expect(() => canonicalJson(clearedDoc.spec)).not.toThrow();
    // undefined must not be serialized (DATA_API_DEPLOYMENT_SPEC).
    expect(JSON.stringify(clearedDoc.spec)).not.toContain('length');
    expect(JSON.parse(JSON.stringify(clearedDoc.spec)).nodes[0].config).toEqual(
      {},
    );

    // Undo restores each cleared key in reverse order.
    store().undo();
    expect(configOf('node-source-1')).toEqual({
      payload: { threshold: 5 },
    });
    expect(() =>
      computeFlowDirtyState(store().document!.spec, store().document!.layout, baseline),
    ).not.toThrow();

    store().undo();
    expect(configOf('node-source-1')).toEqual({
      mode: 'auto',
      payload: { threshold: 5 },
    });

    store().undo();
    const restored = configOf('node-source-1');
    expect(restored).toEqual({
      length: 10,
      mode: 'auto',
      payload: { threshold: 5 },
    });
    // Fully undone == saved baseline again.
    expect(
      computeFlowDirtyState(
        store().document!.spec,
        store().document!.layout,
        baseline,
      ),
    ).toEqual({ semanticDirty: false, layoutDirty: false });

    // Redo re-applies each clear, round-tripping back to {}.
    store().redo();
    expect(configOf('node-source-1')).toEqual({
      mode: 'auto',
      payload: { threshold: 5 },
    });

    store().redo();
    expect(configOf('node-source-1')).toEqual({
      payload: { threshold: 5 },
    });

    store().redo();
    expect(configOf('node-source-1')).toEqual({});
    const redone = store().document!;
    expect(() =>
      computeFlowDirtyState(redone.spec, redone.layout, baseline),
    ).not.toThrow();
    expect(
      computeFlowDirtyState(redone.spec, redone.layout, baseline),
    ).toEqual({ semanticDirty: true, layoutDirty: false });
    expect(() => canonicalJson(redone.spec)).not.toThrow();
  });
});
