import {
  createFlowEdge,
  createFlowNode,
  createMinimalFlowDocument,
} from '@/lib/flows/testing/flow-fixtures';
import { validateFlowAggregateGrouping } from '@/lib/flows/validation/aggregate-validation';
import { FLOW_AGGREGATE_REQUIRES_GROUP_BY } from '@/lib/flows/model/diagnostic';

function windowNode(id: string) {
  return createFlowNode({
    id,
    type: 'window',
    typeVersion: 1,
    name: 'Window',
    config: { length: 3, timeUnit: 's' },
  });
}

function aggregateNode(id: string, name = 'Aggregate') {
  return createFlowNode({
    id,
    type: 'aggregate',
    typeVersion: 1,
    name,
    config: { fields: 'avg(temperature) AS avg_t' },
  });
}

function groupByNode(id: string) {
  return createFlowNode({
    id,
    type: 'group-by',
    typeVersion: 1,
    name: 'Group By',
    config: { keys: 'device' },
  });
}

function filterNode(id: string) {
  return createFlowNode({
    id,
    type: 'filter',
    typeVersion: 1,
    name: 'Filter',
    config: { expression: 'temperature > 0' },
  });
}

describe('validateFlowAggregateGrouping (AC-D001)', () => {
  it('emits an error when a window feeds an aggregate directly', () => {
    const document = createMinimalFlowDocument({
      nodes: [windowNode('node-window-1'), aggregateNode('node-agg-1')],
      edges: [
        createFlowEdge({
          id: 'edge-window-agg',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-agg-1',
          targetPortId: 'in',
        }),
      ],
    });

    const diagnostics = validateFlowAggregateGrouping(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe(FLOW_AGGREGATE_REQUIRES_GROUP_BY);
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.nodeId).toBe('node-agg-1');
  });

  it('emits nothing when a group-by sits between the window and the aggregate', () => {
    const document = createMinimalFlowDocument({
      nodes: [
        windowNode('node-window-1'),
        groupByNode('node-group-1'),
        aggregateNode('node-agg-1'),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-window-group',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-group-1',
          targetPortId: 'in',
        }),
        createFlowEdge({
          id: 'edge-group-agg',
          sourceNodeId: 'node-group-1',
          sourcePortId: 'out',
          targetNodeId: 'node-agg-1',
          targetPortId: 'in',
        }),
      ],
    });

    expect(validateFlowAggregateGrouping(document)).toEqual([]);
  });

  it('emits an error when only a filter sits between the window and the aggregate', () => {
    const document = createMinimalFlowDocument({
      nodes: [
        windowNode('node-window-1'),
        filterNode('node-filter-1'),
        aggregateNode('node-agg-1'),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-window-filter',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-filter-1',
          targetPortId: 'in',
        }),
        createFlowEdge({
          id: 'edge-filter-agg',
          sourceNodeId: 'node-filter-1',
          sourcePortId: 'out',
          targetNodeId: 'node-agg-1',
          targetPortId: 'in',
        }),
      ],
    });

    const diagnostics = validateFlowAggregateGrouping(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe(FLOW_AGGREGATE_REQUIRES_GROUP_BY);
    expect(diagnostics[0]?.nodeId).toBe('node-agg-1');
  });

  it('reports exactly the ungrouped aggregate when two aggregates exist', () => {
    const document = createMinimalFlowDocument({
      nodes: [
        windowNode('node-window-1'),
        windowNode('node-window-2'),
        groupByNode('node-group-1'),
        aggregateNode('node-agg-grouped', 'Grouped'),
        aggregateNode('node-agg-plain', 'Plain'),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-w1-group',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-group-1',
          targetPortId: 'in',
        }),
        createFlowEdge({
          id: 'edge-group-agg',
          sourceNodeId: 'node-group-1',
          sourcePortId: 'out',
          targetNodeId: 'node-agg-grouped',
          targetPortId: 'in',
        }),
        createFlowEdge({
          id: 'edge-w2-agg',
          sourceNodeId: 'node-window-2',
          sourcePortId: 'out',
          targetNodeId: 'node-agg-plain',
          targetPortId: 'in',
        }),
      ],
    });

    const diagnostics = validateFlowAggregateGrouping(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe(FLOW_AGGREGATE_REQUIRES_GROUP_BY);
    expect(diagnostics[0]?.nodeId).toBe('node-agg-plain');
  });

  it('terminates on a cyclic document without hanging', () => {
    const document = createMinimalFlowDocument({
      nodes: [
        windowNode('node-window-1'),
        filterNode('node-filter-1'),
        aggregateNode('node-agg-1'),
      ],
      edges: [
        createFlowEdge({
          id: 'edge-window-filter',
          sourceNodeId: 'node-window-1',
          sourcePortId: 'out',
          targetNodeId: 'node-filter-1',
          targetPortId: 'in',
        }),
        createFlowEdge({
          id: 'edge-filter-agg',
          sourceNodeId: 'node-filter-1',
          sourcePortId: 'out',
          targetNodeId: 'node-agg-1',
          targetPortId: 'in',
        }),
        createFlowEdge({
          id: 'edge-agg-window',
          sourceNodeId: 'node-agg-1',
          sourcePortId: 'out',
          targetNodeId: 'node-window-1',
          targetPortId: 'in',
        }),
      ],
    });

    const diagnostics = validateFlowAggregateGrouping(document);

    expect(
      diagnostics.filter(
        (item) => item.code === FLOW_AGGREGATE_REQUIRES_GROUP_BY,
      ),
    ).toHaveLength(1);
    expect(diagnostics[0]?.nodeId).toBe('node-agg-1');
  });
});
