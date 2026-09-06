import { resolveTargetCapabilities } from '@/lib/flows/capabilities/resolve-capabilities';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import { validateFlowForEditor } from '@/lib/flows/validation/editor-validation';
import { canConnect } from '@/lib/flows/validation/port-compatibility';
import { validateFlowEdgePorts } from '@/lib/flows/validation/registry-validation';

const editorProfile = resolveTargetCapabilities({
  version: '2.4.1',
  reachable: true,
});

function joinConfig() {
  return {
    from: 'left-events',
    joinName: 'right-events',
    condition: 'left.deviceId = right.deviceId',
  };
}

function buildDirectStreamJoinDocument() {
  return createMinimalFlowDocument({
    nodes: [
      createFlowNode({
        id: 'node-source-1',
        type: 'memory-source',
        typeVersion: 1,
        name: 'Source',
        config: { topic: 'raw-events' },
      }),
      createFlowNode({
        id: 'node-join-1',
        type: 'join',
        typeVersion: 1,
        name: 'Join',
        config: joinConfig(),
      }),
      createFlowNode({
        id: 'node-log-1',
        type: 'log-sink',
        typeVersion: 1,
        name: 'Log',
        config: {},
      }),
    ],
    edges: [
      createFlowEdge({
        id: 'edge-source-join',
        sourceNodeId: 'node-source-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'in',
      }),
      createFlowEdge({
        id: 'edge-join-log',
        sourceNodeId: 'node-join-1',
        sourcePortId: 'out',
        targetNodeId: 'node-log-1',
        targetPortId: 'in',
      }),
    ],
  });
}

function buildSharedWindowJoinDocument() {
  return createMinimalFlowDocument({
    nodes: [
      createFlowNode({
        id: 'node-left-1',
        type: 'memory-source',
        typeVersion: 1,
        name: 'Left Stream',
        config: { topic: 'left-events' },
      }),
      createFlowNode({
        id: 'node-right-1',
        type: 'memory-source',
        typeVersion: 1,
        name: 'Right Stream',
        config: { topic: 'right-events' },
      }),
      createFlowNode({
        id: 'node-window-1',
        type: 'window',
        typeVersion: 1,
        name: 'Window',
        config: { length: 10, timeUnit: 's' },
      }),
      createFlowNode({
        id: 'node-join-1',
        type: 'join',
        typeVersion: 1,
        name: 'Join',
        config: joinConfig(),
      }),
      createFlowNode({
        id: 'node-log-1',
        type: 'log-sink',
        typeVersion: 1,
        name: 'Log',
        config: {},
      }),
    ],
    edges: [
      createFlowEdge({
        id: 'edge-left-window',
        sourceNodeId: 'node-left-1',
        sourcePortId: 'out',
        targetNodeId: 'node-window-1',
        targetPortId: 'in',
      }),
      createFlowEdge({
        id: 'edge-right-window',
        sourceNodeId: 'node-right-1',
        sourcePortId: 'out',
        targetNodeId: 'node-window-1',
        targetPortId: 'in',
      }),
      createFlowEdge({
        id: 'edge-window-join',
        sourceNodeId: 'node-window-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'in',
      }),
      createFlowEdge({
        id: 'edge-join-log',
        sourceNodeId: 'node-join-1',
        sourcePortId: 'out',
        targetNodeId: 'node-log-1',
        targetPortId: 'in',
      }),
    ],
  });
}

describe('validateFlowForEditor (defect R4 regression)', () => {
  it('reports a join missing a required input', () => {
    const registry = createBuiltinNodeRegistry();
    const document = buildSharedWindowJoinDocument();
    document.spec.edges = document.spec.edges.filter(
      (edge) => edge.targetNodeId !== 'node-join-1',
    );

    // The generic edge-port validator only checks existing edges, so a
    // missing join input is reported solely by the join topology validator:
    // a single diagnostic, not a duplicate pair, with no pipeline dedupe.
    expect(validateFlowEdgePorts(document, registry)).toEqual([]);

    const diagnostics = validateFlowForEditor(
      document,
      registry,
      editorProfile,
    ).filter((item) => item.code === 'FLOW_PORT_TARGET_MISSING');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('"in"');
  });

  it('rejects a join fed directly by a stream via join topology validation', () => {
    const registry = createBuiltinNodeRegistry();
    // The join takes a single `in` input of kind `collection`: both sources
    // must converge through a shared window first. Live eKuiper 2.4.1
    // rejects multiple stream inputs
    // ('join node does not allow multiple stream inputs'), so a stream fed
    // directly into the join (no window) is invalid. The generic
    // port-compatibility check rejects stream->collection, so the pipeline
    // carries both the generic and the join-topology diagnostics; only the
    // join topology validator produces the windowed-collection message,
    // which proves the pipeline actually invokes it.
    expect(canConnect('stream', 'collection')).toBe(false);

    const document = buildDirectStreamJoinDocument();

    // The generic edge-port validator rejects the direct stream edge.
    expect(
      validateFlowEdgePorts(document, registry).filter(
        (item) => item.code === 'FLOW_PORT_INCOMPATIBLE',
      ),
    ).toHaveLength(1);

    const diagnostics = validateFlowForEditor(
      document,
      registry,
      editorProfile,
    ).filter(
      (item) =>
        item.code === 'FLOW_PORT_INCOMPATIBLE' &&
        item.nodeId === 'node-join-1',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.edgeId).toBe('edge-source-join');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('windowed collection');
  });

  it('accepts a shared window collection output connected into the join input', () => {
    const registry = createBuiltinNodeRegistry();
    // Both sources converge through one shared window whose `collection`
    // output feeds the join's single `in` input. The joined stream
    // identities are carried by the join config (from / joins), not by
    // ports. Live eKuiper 2.4.1 accepts this topology (200 valid:true).
    expect(canConnect('collection', 'collection')).toBe(true);

    const document = buildSharedWindowJoinDocument();

    // The generic edge-port validator sees nothing wrong here.
    expect(validateFlowEdgePorts(document, registry)).toEqual([]);

    const diagnostics = validateFlowForEditor(
      document,
      registry,
      editorProfile,
    ).filter(
      (item) =>
        (item.code === 'FLOW_PORT_TARGET_MISSING' ||
          item.code === 'FLOW_PORT_INCOMPATIBLE') &&
        item.nodeId === 'node-join-1',
    );

    expect(diagnostics).toEqual([]);
  });

  it('clears the join diagnostic once the topology is corrected', () => {
    const registry = createBuiltinNodeRegistry();
    // Live eKuiper 2.4.1 rejects a stream fed directly into the join, so
    // the direct-stream topology starts invalid.
    const invalid = buildDirectStreamJoinDocument();

    const before = validateFlowForEditor(
      invalid,
      registry,
      editorProfile,
    ).filter(
      (item) =>
        (item.code === 'FLOW_PORT_TARGET_MISSING' ||
          item.code === 'FLOW_PORT_INCOMPATIBLE') &&
        item.nodeId === 'node-join-1',
    );
    expect(before.length).toBeGreaterThan(0);

    // Converging both sources through a shared window satisfies the engine
    // rule (one windowed collection input), so the diagnostic clears.
    const corrected = buildSharedWindowJoinDocument();
    const after = validateFlowForEditor(
      corrected,
      registry,
      editorProfile,
    ).filter(
      (item) =>
        (item.code === 'FLOW_PORT_TARGET_MISSING' ||
          item.code === 'FLOW_PORT_INCOMPATIBLE') &&
        item.nodeId === 'node-join-1',
    );
    expect(after).toEqual([]);
  });

  it('keeps document-level diagnostics (no sink) in the pipeline output', () => {
    const registry = createBuiltinNodeRegistry();
    const document = createMinimalFlowDocument({
      nodes: [
        createFlowNode({
          id: 'node-source-1',
          type: 'memory-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: 'events' },
        }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowForEditor(
      document,
      registry,
      editorProfile,
    ).filter((item) => item.code === 'FLOW_NO_SINK');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.nodeId).toBeUndefined();
    expect(diagnostics[0]?.edgeId).toBeUndefined();
  });
});
