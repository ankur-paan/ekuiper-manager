import {
  buildFlowDirtyBaseline,
  computeFlowDirtyState,
} from '@/lib/flows/model/flow-dirty-state';
import { normalizeFlowDocument } from '@/lib/flows/model/normalize-flow-document';
import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';

describe('flow dirty state', () => {
  it('reports clean for an unchanged normalized flow, ignoring object identity', () => {
    const doc = normalizeFlowDocument(createMinimalFlowDocument());
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);

    const clone = JSON.parse(JSON.stringify(doc)) as typeof doc;
    expect(clone).not.toBe(doc);
    expect(clone.spec).not.toBe(doc.spec);

    expect(computeFlowDirtyState(clone.spec, clone.layout, baseline)).toEqual({
      semanticDirty: false,
      layoutDirty: false,
    });
  });

  it('reports layout-only dirtiness after a node move', () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);

    const movedLayout = {
      ...doc.layout,
      nodes: {
        ...doc.layout.nodes,
        'node-source-1': { x: 240, y: 180 },
      },
    };

    expect(computeFlowDirtyState(doc.spec, movedLayout, baseline)).toEqual({
      semanticDirty: false,
      layoutDirty: true,
    });
  });

  it('reports semantic dirtiness after a config change without layout dirtiness', () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);

    const updatedSpec = {
      ...doc.spec,
      nodes: doc.spec.nodes.map((node) =>
        node.id === 'node-source-1'
          ? { ...node, config: { ...node.config, topic: 'devices/+/data' } }
          : node,
      ),
    };

    expect(computeFlowDirtyState(updatedSpec, doc.layout, baseline)).toEqual({
      semanticDirty: true,
      layoutDirty: false,
    });
  });

  it('reports semantic dirtiness after an edge change without layout dirtiness', () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);

    const withoutEdges = { ...doc.spec, edges: [] };

    expect(computeFlowDirtyState(withoutEdges, doc.layout, baseline)).toEqual({
      semanticDirty: true,
      layoutDirty: false,
    });
  });

  it('ignores key insertion order because comparison is canonical-snapshot based', () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);

    const reorderedSpec = {
      nodes: doc.spec.nodes.map((node) => ({
        name: node.name,
        config: { ...node.config },
        typeVersion: node.typeVersion,
        type: node.type,
        id: node.id,
      })),
      edges: [...doc.spec.edges],
    };

    expect(computeFlowDirtyState(reorderedSpec, doc.layout, baseline)).toEqual({
      semanticDirty: false,
      layoutDirty: false,
    });
  });

  it('reports clean when no server baseline or current document is available', () => {
    const doc = createMinimalFlowDocument();
    const baseline = buildFlowDirtyBaseline(doc.spec, doc.layout);

    expect(computeFlowDirtyState(doc.spec, doc.layout, null)).toEqual({
      semanticDirty: false,
      layoutDirty: false,
    });
    expect(computeFlowDirtyState(null, doc.layout, baseline)).toEqual({
      semanticDirty: false,
      layoutDirty: false,
    });
    expect(computeFlowDirtyState(doc.spec, undefined, baseline)).toEqual({
      semanticDirty: false,
      layoutDirty: false,
    });
  });
});
