import { diffFlowDocuments, diffFlowSpecs } from '@/lib/flows/model/flow-diff';
import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';

describe('flow semantic diff', () => {
  it('returns an empty diff for identical documents', () => {
    const doc = createMinimalFlowDocument();
    const clone = JSON.parse(JSON.stringify(doc)) as typeof doc;

    expect(diffFlowDocuments(doc, clone)).toEqual([]);
  });

  it('ignores layout-only differences entirely', () => {
    const before = createMinimalFlowDocument();
    const after = createMinimalFlowDocument({
      layout: {
        nodes: {
          'node-source-1': { x: 999, y: 888 },
          'node-sink-1': { x: -12, y: 500 },
        },
        viewport: { x: 10, y: 20, zoom: 2 },
      },
    });

    expect(diffFlowDocuments(before, after)).toEqual([]);
  });

  it('ignores metadata-only differences', () => {
    const before = createMinimalFlowDocument();
    const after = createMinimalFlowDocument({
      metadata: { name: 'Renamed Flow', description: 'new description' },
    });

    expect(diffFlowDocuments(before, after)).toEqual([]);
  });

  it('reports node added and removed by id', () => {
    const before = createMinimalFlowDocument();
    const after = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          name: 'Source',
          config: {},
        }),
        createFlowNode({
          id: 'node-filter-9',
          type: 'test-filter',
          name: 'Filter',
          config: {},
        }),
      ],
      edges: [],
    });

    expect(diffFlowDocuments(before, after)).toEqual([
      { kind: 'node-added', nodeId: 'node-filter-9' },
      { kind: 'node-removed', nodeId: 'node-sink-1' },
      {
        kind: 'edge-removed',
        edgeId: 'edge-1',
      },
    ]);
  });

  it('keeps node rename distinct from config changes', () => {
    const before = createMinimalFlowDocument();
    const renamed = createMinimalFlowDocument({
      nodes: before.spec.nodes.map((node) =>
        node.id === 'node-source-1'
          ? { ...node, name: 'Source (renamed)' }
          : node,
      ),
    });

    expect(diffFlowDocuments(before, renamed)).toEqual([
      {
        kind: 'node-renamed',
        nodeId: 'node-source-1',
        before: 'Source',
        after: 'Source (renamed)',
      },
    ]);

    const configChanged = createMinimalFlowDocument({
      nodes: before.spec.nodes.map((node) =>
        node.id === 'node-source-1'
          ? { ...node, config: { topic: 'devices/+/data' } }
          : node,
      ),
    });

    expect(diffFlowDocuments(before, configChanged)).toEqual([
      {
        kind: 'node-config-changed',
        nodeId: 'node-source-1',
        changes: [
          { path: 'topic', before: undefined, after: 'devices/+/data' },
        ],
      },
    ]);
  });

  it('diffs nested config objects recursively with sorted paths', () => {
    const before = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          name: 'Source',
          config: {
            topic: 'devices/data',
            filter: { threshold: 10, mode: 'strict' },
            keep: true,
          },
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          name: 'Sink',
          config: {},
        }),
      ],
    });
    const after = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          name: 'Source',
          config: {
            topic: 'devices/other',
            filter: { threshold: 25, extra: 'added' },
          },
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          name: 'Sink',
          config: {},
        }),
      ],
    });

    expect(diffFlowDocuments(before, after)).toEqual([
      {
        kind: 'node-config-changed',
        nodeId: 'node-source-1',
        changes: [
          { path: 'filter.extra', before: undefined, after: 'added' },
          { path: 'filter.mode', before: 'strict', after: undefined },
          { path: 'filter.threshold', before: 10, after: 25 },
          { path: 'keep', before: true, after: undefined },
          { path: 'topic', before: 'devices/data', after: 'devices/other' },
        ],
      },
    ]);
  });

  it('treats arrays as replaced atomically', () => {
    const before = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          name: 'Source',
          config: { fields: ['a', 'b'] },
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          name: 'Sink',
          config: {},
        }),
      ],
    });
    const after = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'test-source',
          name: 'Source',
          config: { fields: ['a', 'c'] },
        }),
        createFlowNode({
          id: 'node-sink-1',
          type: 'test-sink',
          name: 'Sink',
          config: {},
        }),
      ],
    });

    expect(diffFlowDocuments(before, after)).toEqual([
      {
        kind: 'node-config-changed',
        nodeId: 'node-source-1',
        changes: [{ path: 'fields', before: ['a', 'b'], after: ['a', 'c'] }],
      },
    ]);
  });

  it('reports node type and typeVersion changes separately from rename/config', () => {
    const before = createMinimalFlowDocument();
    const after = createMinimalFlowDocument({
      nodes: before.spec.nodes.map((node) =>
        node.id === 'node-source-1'
          ? { ...node, type: 'test-source-v2', typeVersion: 2 }
          : node,
      ),
    });

    expect(diffFlowDocuments(before, after)).toEqual([
      {
        kind: 'node-type-changed',
        nodeId: 'node-source-1',
        beforeType: 'test-source',
        afterType: 'test-source-v2',
        beforeTypeVersion: 1,
        afterTypeVersion: 2,
      },
    ]);
  });

  it('reports spec options changes', () => {
    const before = createMinimalFlowDocument();
    const after = createMinimalFlowDocument();
    after.spec.options = { qos: 1, sendError: true };

    expect(diffFlowDocuments(before, after)).toEqual([
      {
        kind: 'options-changed',
        changes: [
          { path: 'qos', before: undefined, after: 1 },
          { path: 'sendError', before: undefined, after: true },
        ],
      },
    ]);
  });

  it('reports edge added and removed', () => {
    const before = createMinimalFlowDocument();
    const after = createMinimalFlowDocument({
      edges: [
        createFlowEdge({
          id: 'edge-2',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sink-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(diffFlowDocuments(before, after)).toEqual([
      { kind: 'edge-added', edgeId: 'edge-2' },
      { kind: 'edge-removed', edgeId: 'edge-1' },
    ]);
  });

  it('reports a rewired edge under the same id as removed plus added', () => {
    const before = createMinimalFlowDocument();
    const after = createMinimalFlowDocument({
      nodes: [
        ...before.spec.nodes,
        createFlowNode({
          id: 'node-sink-2',
          type: 'test-sink',
          name: 'Sink 2',
          config: {},
        }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          sourcePortId: 'out',
          targetNodeId: 'node-sink-2',
          targetPortId: 'in',
        }),
      ],
    });

    expect(diffFlowDocuments(before, after)).toEqual([
      { kind: 'node-added', nodeId: 'node-sink-2' },
      { kind: 'edge-added', edgeId: 'edge-1' },
      { kind: 'edge-removed', edgeId: 'edge-1' },
    ]);
  });

  it('orders output deterministically regardless of input array order', () => {
    const before = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-b',
          type: 't',
          name: 'B',
          config: { z: 1 },
        }),
        createFlowNode({
          id: 'node-a',
          type: 't',
          name: 'A',
          config: {},
        }),
      ],
      edges: [],
    });
    const after = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-c',
          type: 't',
          name: 'C',
          config: {},
        }),
        createFlowNode({
          id: 'node-b',
          type: 't',
          name: 'B renamed',
          config: { z: 2 },
        }),
      ],
      edges: [],
    });

    const forward = diffFlowSpecs(before.spec, after.spec);
    const reversed = diffFlowSpecs(
      { ...before.spec, nodes: [...before.spec.nodes].reverse() },
      { ...after.spec, nodes: [...after.spec.nodes].reverse() },
    );

    expect(forward).toEqual(reversed);
    expect(forward).toEqual([
      { kind: 'node-added', nodeId: 'node-c' },
      { kind: 'node-removed', nodeId: 'node-a' },
      {
        kind: 'node-renamed',
        nodeId: 'node-b',
        before: 'B',
        after: 'B renamed',
      },
      {
        kind: 'node-config-changed',
        nodeId: 'node-b',
        changes: [{ path: 'z', before: 1, after: 2 }],
      },
    ]);
  });
});
