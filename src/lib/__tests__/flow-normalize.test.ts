import type { FlowDocument } from '@/lib/flows/model/flow-document';
import { normalizeFlowDocument } from '@/lib/flows/model/normalize-flow-document';
import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';

function buildDocumentWithOrder(nodeIds: string[], edgeIds: string[]): FlowDocument {
  const edgesById: Record<string, { sourceNodeId: string; targetNodeId: string }> = {
    'edge-1': { sourceNodeId: 'node-a', targetNodeId: 'node-b' },
    'edge-2': { sourceNodeId: 'node-b', targetNodeId: 'node-c' },
  };
  const base = createMinimalFlowDocument({
    nodes: nodeIds.map((id) => ({
      id,
      type: 'test-node',
      typeVersion: 1,
      name: `  ${id}  `,
      config: {},
    })),
    edges: edgeIds.map((id) => ({
      id,
      sourceNodeId: edgesById[id]?.sourceNodeId ?? 'node-a',
      sourcePortId: 'out',
      targetNodeId: edgesById[id]?.targetNodeId ?? 'node-b',
      targetPortId: 'in',
    })),
  });
  return {
    ...base,
    metadata: { ...base.metadata, name: '  Test Flow  ' },
  };
}

describe('normalizeFlowDocument', () => {
  it('normalizes insertion-order differences identically', () => {
    const first = buildDocumentWithOrder(
      ['node-b', 'node-a', 'node-c'],
      ['edge-2', 'edge-1'],
    );
    const second = buildDocumentWithOrder(
      ['node-c', 'node-a', 'node-b'],
      ['edge-1', 'edge-2'],
    );

    const normalizedFirst = normalizeFlowDocument(first);
    const normalizedSecond = normalizeFlowDocument(second);

    expect(normalizedFirst).toEqual(normalizedSecond);
    expect(normalizedFirst.spec.nodes.map((node) => node.id)).toEqual([
      'node-a',
      'node-b',
      'node-c',
    ]);
    expect(normalizedFirst.spec.edges.map((edge) => edge.id)).toEqual([
      'edge-1',
      'edge-2',
    ]);
  });

  it('trims metadata and node names while preserving config values verbatim', () => {
    const doc = createMinimalFlowDocument({
      metadata: { id: 'flow-test-1', name: '  Test Flow  ' },
      nodes: [
        {
          id: 'node-source-1',
          type: 'test-source',
          typeVersion: 1,
          name: '  Source  ',
          config: { label: '  padded value  ', note: '  keep me  ' },
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

    const normalized = normalizeFlowDocument(doc);

    expect(normalized.metadata.name).toBe('Test Flow');
    expect(
      normalized.spec.nodes.find((node) => node.id === 'node-source-1')?.name,
    ).toBe('Source');
    expect(
      normalized.spec.nodes.find((node) => node.id === 'node-sink-1')?.name,
    ).toBe('Sink');
    expect(
      normalized.spec.nodes.find((node) => node.id === 'node-source-1')?.config,
    ).toEqual({ label: '  padded value  ', note: '  keep me  ' });
  });

  it('does not sort the layout map or change coordinates', () => {
    const doc = createMinimalFlowDocument({
      layout: {
        nodes: {
          'node-b': { x: 320, y: 120 },
          'node-a': { x: 0, y: 0 },
        },
        viewport: { x: 5, y: 6, zoom: 2 },
      },
    });

    const normalized = normalizeFlowDocument(doc);

    expect(Object.keys(normalized.layout.nodes)).toEqual(['node-b', 'node-a']);
    expect(normalized.layout.nodes['node-a']).toEqual({ x: 0, y: 0 });
    expect(normalized.layout.nodes['node-b']).toEqual({ x: 320, y: 120 });
    expect(normalized.layout.viewport).toEqual({ x: 5, y: 6, zoom: 2 });
  });

  it('does not mutate its input', () => {
    const doc = buildDocumentWithOrder(['node-b', 'node-a'], ['edge-2', 'edge-1']);
    const snapshot = JSON.stringify(doc);

    const normalized = normalizeFlowDocument(doc);

    expect(JSON.stringify(doc)).toBe(snapshot);
    expect(normalized).not.toBe(doc);
    expect(normalized.spec.nodes).not.toBe(doc.spec.nodes);
    expect(normalized.spec.edges).not.toBe(doc.spec.edges);
  });
});
