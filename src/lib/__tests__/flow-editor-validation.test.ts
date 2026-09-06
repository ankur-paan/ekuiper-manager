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

function buildValidJoinDocument() {
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
        id: 'node-join-1',
        type: 'join',
        typeVersion: 1,
        name: 'Join',
        config: { condition: 'left.deviceId = right.deviceId' },
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
        id: 'edge-left-join',
        sourceNodeId: 'node-left-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'left',
      }),
      createFlowEdge({
        id: 'edge-right-join',
        sourceNodeId: 'node-right-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'right',
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

function buildWindowedJoinDocument() {
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
        id: 'node-window-source-1',
        type: 'memory-source',
        typeVersion: 1,
        name: 'Windowed Stream',
        config: { topic: 'windowed-events' },
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
        config: { condition: 'left.deviceId = right.deviceId' },
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
        id: 'edge-left-join',
        sourceNodeId: 'node-left-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'left',
      }),
      createFlowEdge({
        id: 'edge-source-window',
        sourceNodeId: 'node-window-source-1',
        sourcePortId: 'out',
        targetNodeId: 'node-window-1',
        targetPortId: 'in',
      }),
      createFlowEdge({
        id: 'edge-window-join',
        sourceNodeId: 'node-window-1',
        sourcePortId: 'out',
        targetNodeId: 'node-join-1',
        targetPortId: 'right',
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
    const document = buildValidJoinDocument();
    document.spec.edges = document.spec.edges.filter(
      (edge) => edge.targetPortId !== 'right',
    );

    const diagnostics = validateFlowForEditor(
      document,
      registry,
      editorProfile,
    ).filter((item) => item.code === 'FLOW_PORT_TARGET_MISSING');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('"right"');
  });

  it('rejects a stream+stream join via join topology validation', () => {
    const registry = createBuiltinNodeRegistry();
    // Both join inputs are plain streams. The generic port-compatibility
    // check permits this (stream->stream on `left`, stream->any on `right`),
    // so only the join topology validator can reject it. Live eKuiper 2.4.1
    // rejects two plain stream inputs
    // ('join node does not allow multiple stream inputs') and requires a
    // windowed collection or lookup table on at least one side.
    expect(canConnect('stream', 'stream')).toBe(true);
    expect(canConnect('stream', 'any')).toBe(true);

    const document = buildValidJoinDocument();

    // The generic edge-port validator sees nothing wrong here.
    expect(validateFlowEdgePorts(document, registry)).toEqual([]);

    const diagnostics = validateFlowForEditor(
      document,
      registry,
      editorProfile,
    ).filter((item) => item.code === 'FLOW_PORT_INCOMPATIBLE');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-join-1');
    expect(diagnostics[0]?.edgeId).toBeUndefined();
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('two plain streams');
  });

  it('accepts a window collection output connected into the join right port', () => {
    const registry = createBuiltinNodeRegistry();
    // Join's right port is kind `any`, so the generic port-compatibility
    // check permits a Window `collection` output into it. Live eKuiper 2.4.1
    // requires a windowed collection (or lookup table) on at least one
    // join side, so the editor pipeline must accept this topology.
    expect(canConnect('collection', 'any')).toBe(true);

    const document = buildWindowedJoinDocument();

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
    // Live eKuiper 2.4.1 rejects two plain stream inputs, so the
    // stream+stream topology starts invalid.
    const invalid = buildValidJoinDocument();

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

    // Introducing a window on the right input satisfies the engine rule
    // (at least one side windowed or a table), so the diagnostic clears.
    const corrected = buildWindowedJoinDocument();
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
