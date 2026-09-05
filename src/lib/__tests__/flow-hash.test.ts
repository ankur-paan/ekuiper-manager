import type { FlowLayout, FlowSpec } from '@/lib/flows/model/flow-document';
import { hashFlowLayout, hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';

function buildSpec(overrides?: Partial<FlowSpec>): FlowSpec {
  return {
    nodes: [
      {
        id: 'node-source-1',
        type: 'mqtt-source',
        typeVersion: 1,
        name: 'Source',
        config: { topic: 'sensors/temperature', threshold: 10 },
      },
      {
        id: 'node-sink-1',
        type: 'mqtt-sink',
        typeVersion: 1,
        name: 'Sink',
        config: { topic: 'alerts/output' },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        sourceNodeId: 'node-source-1',
        sourcePortId: 'out',
        targetNodeId: 'node-sink-1',
        targetPortId: 'in',
      },
    ],
    ...overrides,
  };
}

function buildLayout(): FlowLayout {
  return {
    nodes: {
      'node-source-1': { x: 0, y: 0 },
      'node-sink-1': { x: 320, y: 120 },
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe('flow hashes', () => {
  it('produces stable lowercase hex SHA-256 output', () => {
    const spec = buildSpec();
    const layout = buildLayout();

    expect(hashFlowSemantic(spec)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashFlowLayout(layout)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashFlowSemantic(spec)).toBe(hashFlowSemantic(buildSpec()));
    expect(hashFlowLayout(layout)).toBe(hashFlowLayout(buildLayout()));
  });

  it('moving node coordinates changes only the layout hash', () => {
    const spec = buildSpec();
    const semanticBefore = hashFlowSemantic(spec);

    const before = buildLayout();
    const moved: FlowLayout = {
      ...before,
      nodes: {
        ...before.nodes,
        'node-source-1': { x: 240, y: 180 },
      },
    };

    expect(hashFlowLayout(moved)).not.toBe(hashFlowLayout(before));
    expect(hashFlowSemantic(spec)).toBe(semanticBefore);
  });

  it('changing node config changes the semantic hash but not the layout hash', () => {
    const layout = buildLayout();
    const layoutBefore = hashFlowLayout(layout);

    const before = buildSpec();
    const updated = buildSpec({
      nodes: [
        {
          id: 'node-source-1',
          type: 'mqtt-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 'sensors/temperature', threshold: 20 },
        },
        before.nodes[1],
      ],
      edges: before.edges,
    });

    expect(hashFlowSemantic(updated)).not.toBe(hashFlowSemantic(before));
    expect(hashFlowLayout(layout)).toBe(layoutBefore);
  });
});
