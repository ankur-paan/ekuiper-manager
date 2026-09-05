import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import { validateFlowStructure } from '@/lib/flows/validation/structural';

describe('validateFlowStructure', () => {
  it('returns no diagnostics for a valid simple graph', () => {
    expect(validateFlowStructure(createMinimalFlowDocument())).toEqual([]);
  });

  it('reports FLOW_DUPLICATE_NODE_ID with nodeId', () => {
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({ id: 'node-a', type: 'test-source', name: 'A' }),
        createFlowNode({ id: 'node-a', type: 'test-sink', name: 'A copy' }),
      ],
      edges: [],
    });

    const diagnostics = validateFlowStructure(doc);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_DUPLICATE_NODE_ID',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.nodeId).toBe('node-a');
  });

  it('reports FLOW_DUPLICATE_EDGE_ID with edgeId', () => {
    const doc = createMinimalFlowDocument({
      edges: [
        createFlowEdge({
          id: 'edge-dup',
          sourceNodeId: 'node-source-1',
          targetNodeId: 'node-sink-1',
        }),
        createFlowEdge({
          id: 'edge-dup',
          sourceNodeId: 'node-source-1',
          targetNodeId: 'node-sink-1',
        }),
      ],
    });

    const diagnostics = validateFlowStructure(doc);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_DUPLICATE_EDGE_ID',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.edgeId).toBe('edge-dup');
  });

  it('reports FLOW_EDGE_SOURCE_MISSING with edgeId and nodeId', () => {
    const doc = createMinimalFlowDocument({
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-does-not-exist',
          targetNodeId: 'node-sink-1',
        }),
      ],
    });

    const diagnostics = validateFlowStructure(doc);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_EDGE_SOURCE_MISSING',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.edgeId).toBe('edge-1');
    expect(matches[0]?.nodeId).toBe('node-does-not-exist');
  });

  it('reports FLOW_EDGE_TARGET_MISSING with edgeId and nodeId', () => {
    const doc = createMinimalFlowDocument({
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-source-1',
          targetNodeId: 'node-does-not-exist',
        }),
      ],
    });

    const diagnostics = validateFlowStructure(doc);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_EDGE_TARGET_MISSING',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.edgeId).toBe('edge-1');
    expect(matches[0]?.nodeId).toBe('node-does-not-exist');
  });

  it('reports FLOW_SELF_EDGE_UNSUPPORTED with edgeId and nodeId', () => {
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({ id: 'node-a', type: 'test-source', name: 'A' }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-self',
          sourceNodeId: 'node-a',
          targetNodeId: 'node-a',
        }),
      ],
    });

    const diagnostics = validateFlowStructure(doc);
    const matches = diagnostics.filter(
      (item) => item.code === 'FLOW_SELF_EDGE_UNSUPPORTED',
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.edgeId).toBe('edge-self');
    expect(matches[0]?.nodeId).toBe('node-a');
  });

  it('returns all diagnostics in one pass', () => {
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({ id: 'node-a', type: 'test-source', name: 'A' }),
        createFlowNode({ id: 'node-a', type: 'test-sink', name: 'A copy' }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-dup',
          sourceNodeId: 'node-a',
          targetNodeId: 'node-a',
        }),
        createFlowEdge({
          id: 'edge-dup',
          sourceNodeId: 'node-missing',
          targetNodeId: 'node-a',
        }),
      ],
    });

    const diagnostics = validateFlowStructure(doc);
    const codes = diagnostics.map((item) => item.code);

    expect(codes).toContain('FLOW_DUPLICATE_NODE_ID');
    expect(codes).toContain('FLOW_DUPLICATE_EDGE_ID');
    expect(codes).toContain('FLOW_EDGE_SOURCE_MISSING');
    expect(codes).toContain('FLOW_SELF_EDGE_UNSUPPORTED');
  });

  it('does not apply registry or port checks to unknown node types', () => {
    const doc = createMinimalFlowDocument({
      nodes: [
        createFlowNode({ id: 'node-a', type: 'unknown-type', name: 'A' }),
        createFlowNode({ id: 'node-b', type: 'unknown-type', name: 'B' }),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-1',
          sourceNodeId: 'node-a',
          sourcePortId: 'unknown-out',
          targetNodeId: 'node-b',
          targetPortId: 'unknown-in',
        }),
      ],
    });

    expect(validateFlowStructure(doc)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const doc = createMinimalFlowDocument();
    const snapshot = JSON.stringify(doc);

    validateFlowStructure(doc);

    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
