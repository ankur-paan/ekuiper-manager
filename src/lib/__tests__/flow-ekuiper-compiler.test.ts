import { canonicalJson } from '@/lib/flows/hashing/canonical-json';
import {
  compileFlowToEkuiperGraph,
  toSafeRuleId,
} from '@/lib/flows/compiler/ekuiper/compile-graph';
import {
  isEkuiperGraphNode,
  isEkuiperGraphRule,
} from '@/lib/flows/compiler/ekuiper/graph-types';
import { createRuntimeId } from '@/lib/flows/compiler/runtime-id';
import { FLOW_COMPILER_VERSION } from '@/lib/flows/compiler/types';
import { hashFlowSemantic } from '@/lib/flows/hashing/flow-hash';
import {
  FLOW_DOCUMENT_VERSION,
  type FlowDocument,
} from '@/lib/flows/model/flow-document';

const SOURCE_FLOW_ID = 'node-source-1';
const SINK_FLOW_ID = 'node-sink-1';
const SOURCE_TOPIC = 'devices/result';
const SINK_TOPIC = 'analysis/result';

function buildMemoryFlow(): FlowDocument {
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: { id: 'flow-memory-demo', name: 'Memory Demo' },
    spec: {
      nodes: [
        {
          id: SOURCE_FLOW_ID,
          type: 'memory-source',
          typeVersion: 1,
          name: 'Source',
          config: { topic: SOURCE_TOPIC },
        },
        {
          id: SINK_FLOW_ID,
          type: 'memory-sink',
          typeVersion: 1,
          name: 'Sink',
          config: { topic: SINK_TOPIC },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          sourceNodeId: SOURCE_FLOW_ID,
          sourcePortId: 'out',
          targetNodeId: SINK_FLOW_ID,
          targetPortId: 'in',
        },
      ],
    },
    layout: {
      nodes: {
        [SOURCE_FLOW_ID]: { x: 0, y: 0 },
        [SINK_FLOW_ID]: { x: 320, y: 120 },
      },
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

describe('flow eKuiper compiler (memory source -> memory sink)', () => {
  it('produces the exact expected graph JSON for the fixed fixture', () => {
    const result = compileFlowToEkuiperGraph(buildMemoryFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(result.artifact.compilerVersion).toBe(FLOW_COMPILER_VERSION);
    expect(result.artifact.ruleId).toBe('flow-memory-demo');
    expect(result.artifact.semanticHash).toBe(
      hashFlowSemantic(buildMemoryFlow().spec),
    );
    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_TOPIC },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('emits no edges entry for sinks (the engine rejects any sink entry)', () => {
    const result = compileFlowToEkuiperGraph(buildMemoryFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);
    const graph = result.artifact.ruleDefinition.graph as unknown as {
      topo: { edges: Record<string, unknown> };
    };

    expect(sinkRuntimeId in graph.topo.edges).toBe(false);
  });

  it('maps the Flow topic config to datasource/topic props', () => {
    const result = compileFlowToEkuiperGraph(buildMemoryFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };
    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(graph.nodes[sourceRuntimeId]?.props).toEqual({
      datasource: SOURCE_TOPIC,
    });
    expect(graph.nodes[sinkRuntimeId]?.props).toEqual({ topic: SINK_TOPIC });
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildMemoryFlow());
    const second = compileFlowToEkuiperGraph(buildMemoryFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
    expect(canonicalJson(first.artifact.ruleDefinition)).toBe(
      canonicalJson(second.artifact.ruleDefinition),
    );
  });

  it('produces a graph that satisfies the audited eKuiper envelope', () => {
    const result = compileFlowToEkuiperGraph(buildMemoryFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      isEkuiperGraphRule(result.artifact.ruleDefinition.graph),
    ).toBe(true);
  });

  it('ignores renames and layout moves in the compiled definition', () => {
    const baseline = compileFlowToEkuiperGraph(buildMemoryFlow());
    const edited = buildMemoryFlow();
    edited.spec.nodes[0]!.name = 'Renamed source';
    edited.spec.nodes[1]!.name = 'Renamed sink';
    edited.layout = {
      nodes: {
        [SOURCE_FLOW_ID]: { x: 999, y: 888 },
        [SINK_FLOW_ID]: { x: -12, y: 34 },
      },
      viewport: { x: 5, y: 5, zoom: 2 },
    };
    const recompiled = compileFlowToEkuiperGraph(edited);

    expect(baseline.ok).toBe(true);
    expect(recompiled.ok).toBe(true);
    if (!baseline.ok || !recompiled.ok) return;

    expect(canonicalJson(recompiled.artifact.ruleDefinition)).toBe(
      canonicalJson(baseline.artifact.ruleDefinition),
    );
    expect(recompiled.artifact.runtimeNodeMap).toEqual(
      baseline.artifact.runtimeNodeMap,
    );
  });

  it('keeps the semantic hash stable across layout-only moves', () => {
    const baseline = compileFlowToEkuiperGraph(buildMemoryFlow());
    const moved = buildMemoryFlow();
    moved.layout = {
      nodes: {
        [SOURCE_FLOW_ID]: { x: 999, y: 888 },
        [SINK_FLOW_ID]: { x: -12, y: 34 },
      },
      viewport: { x: 5, y: 5, zoom: 2 },
    };
    const recompiled = compileFlowToEkuiperGraph(moved);

    expect(baseline.ok).toBe(true);
    expect(recompiled.ok).toBe(true);
    if (!baseline.ok || !recompiled.ok) return;

    expect(recompiled.artifact.semanticHash).toBe(
      baseline.artifact.semanticHash,
    );
  });

  it('carries no layout or display state into the artifact', () => {
    const result = compileFlowToEkuiperGraph(buildMemoryFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect('layout' in result.artifact.ruleDefinition).toBe(false);
    expect(canonicalJson(result.artifact)).not.toContain('viewport');
    expect(canonicalJson(result.artifact)).not.toContain('Renamed');
  });

  it('fails with a structured diagnostic when a topic is missing', () => {
    const document = buildMemoryFlow();
    document.spec.nodes[1]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(SINK_FLOW_ID);
    expect(result.diagnostics[0]?.severity).toBe('error');
  });

  it('fails with a structured diagnostic for an unsupported operation', () => {
    const document = buildMemoryFlow();
    document.spec.nodes.push({
      id: 'node-func-1',
      type: 'func',
      typeVersion: 1,
      name: 'Function',
      config: { expression: 'log(temperature) as log_temperature' },
    });
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === 'FLOW_UNKNOWN_NODE_TYPE',
      ),
    ).toBe(true);
  });

  it('fails with a structured diagnostic when the sink is disconnected', () => {
    const document = buildMemoryFlow();
    document.spec.edges = [];
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe('flow eKuiper compiler (filter and pick operators)', () => {
  const FILTER_FLOW_ID = 'node-filter-1';
  const PICK_FLOW_ID = 'node-pick-1';
  const FILTER_EXPRESSION = 'temperature > 20';
  const PICK_FIELDS = 'temperature, humidity';

  function buildFilterPickFlow(): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-filter-pick-demo', name: 'Filter Pick Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: FILTER_FLOW_ID,
            type: 'filter',
            typeVersion: 1,
            name: 'Filter',
            config: { expression: FILTER_EXPRESSION },
          },
          {
            id: PICK_FLOW_ID,
            type: 'pick',
            typeVersion: 1,
            name: 'Pick',
            config: { fields: PICK_FIELDS },
          },
          {
            id: SINK_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Sink',
            config: { topic: SINK_TOPIC },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: FILTER_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-2',
            sourceNodeId: FILTER_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: PICK_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-3',
            sourceNodeId: PICK_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [FILTER_FLOW_ID]: { x: 160, y: 0 },
          [PICK_FLOW_ID]: { x: 320, y: 0 },
          [SINK_FLOW_ID]: { x: 480, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected nodeType/props for source->filter->pick->sink', () => {
    const result = compileFlowToEkuiperGraph(buildFilterPickFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const filterRuntimeId = createRuntimeId('filter', FILTER_FLOW_ID);
    const pickRuntimeId = createRuntimeId('pick', PICK_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [filterRuntimeId]: {
            type: 'operator',
            nodeType: 'filter',
            props: { expr: FILTER_EXPRESSION },
          },
          [pickRuntimeId]: {
            type: 'operator',
            nodeType: 'pick',
            props: { fields: ['temperature', 'humidity'] },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_TOPIC },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [filterRuntimeId],
            [filterRuntimeId]: [pickRuntimeId],
            [pickRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [FILTER_FLOW_ID]: filterRuntimeId,
      [PICK_FLOW_ID]: pickRuntimeId,
      [SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildFilterPickFlow());
    const second = compileFlowToEkuiperGraph(buildFilterPickFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('produces a graph that satisfies the audited eKuiper envelope', () => {
    const result = compileFlowToEkuiperGraph(buildFilterPickFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      isEkuiperGraphRule(result.artifact.ruleDefinition.graph),
    ).toBe(true);
  });

  it('fails with a structured diagnostic when the filter expression is missing', () => {
    const document = buildFilterPickFlow();
    document.spec.nodes[1]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(FILTER_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('expression');
  });

  it('fails with a structured diagnostic when the pick fields are missing', () => {
    const document = buildFilterPickFlow();
    document.spec.nodes[2]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(PICK_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('fields');
  });

  it('fails with a structured diagnostic for an unsupported built-in operation', () => {
    const document = buildFilterPickFlow();
    document.spec.nodes.push({
      id: 'node-func-1',
      type: 'func',
      typeVersion: 1,
      name: 'Function',
      config: { expression: 'log(temperature) as log_temperature' },
    });
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === 'FLOW_UNKNOWN_NODE_TYPE',
      ),
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.nodeId === 'node-func-1',
      ),
    ).toBe(true);
  });
});

describe('flow eKuiper compiler (window and aggregate operators)', () => {
  const WINDOW_FLOW_ID = 'node-window-1';
  const AGGREGATE_FLOW_ID = 'node-aggregate-1';
  const WINDOW_LENGTH = 10;
  const WINDOW_TIME_UNIT = 'ss';
  const AGGREGATE_FIELDS = 'avg(temperature) AS avg_temp';

  function buildWindowAggregateFlow(): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-window-aggregate-demo', name: 'Window Aggregate Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: WINDOW_FLOW_ID,
            type: 'window',
            typeVersion: 1,
            name: 'Window',
            config: { length: WINDOW_LENGTH, timeUnit: WINDOW_TIME_UNIT },
          },
          {
            id: AGGREGATE_FLOW_ID,
            type: 'aggregate',
            typeVersion: 1,
            name: 'Aggregate',
            config: { fields: AGGREGATE_FIELDS },
          },
          {
            id: SINK_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Sink',
            config: { topic: SINK_TOPIC },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: WINDOW_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-2',
            sourceNodeId: WINDOW_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: AGGREGATE_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-3',
            sourceNodeId: AGGREGATE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [WINDOW_FLOW_ID]: { x: 160, y: 0 },
          [AGGREGATE_FLOW_ID]: { x: 320, y: 0 },
          [SINK_FLOW_ID]: { x: 480, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected nodeType/props for source->window->aggregate->sink', () => {
    const result = compileFlowToEkuiperGraph(buildWindowAggregateFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const windowRuntimeId = createRuntimeId('window', WINDOW_FLOW_ID);
    const aggregateRuntimeId = createRuntimeId('aggfunc', AGGREGATE_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [windowRuntimeId]: {
            type: 'operator',
            nodeType: 'window',
            props: {
              type: 'tumblingwindow',
              unit: WINDOW_TIME_UNIT,
              size: WINDOW_LENGTH,
            },
          },
          [aggregateRuntimeId]: {
            type: 'operator',
            nodeType: 'aggfunc',
            props: { expr: AGGREGATE_FIELDS },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_TOPIC },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [windowRuntimeId],
            [windowRuntimeId]: [aggregateRuntimeId],
            [aggregateRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [WINDOW_FLOW_ID]: windowRuntimeId,
      [AGGREGATE_FLOW_ID]: aggregateRuntimeId,
      [SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildWindowAggregateFlow());
    const second = compileFlowToEkuiperGraph(buildWindowAggregateFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('produces a graph that satisfies the audited eKuiper envelope', () => {
    const result = compileFlowToEkuiperGraph(buildWindowAggregateFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      isEkuiperGraphRule(result.artifact.ruleDefinition.graph),
    ).toBe(true);
  });

  it('fails with a structured diagnostic when the window length is missing', () => {
    const document = buildWindowAggregateFlow();
    document.spec.nodes[1]!.config = { timeUnit: WINDOW_TIME_UNIT };
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(WINDOW_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('length');
  });

  it('fails with a structured diagnostic when the window timeUnit is missing', () => {
    const document = buildWindowAggregateFlow();
    document.spec.nodes[1]!.config = { length: WINDOW_LENGTH };
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(WINDOW_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('timeUnit');
  });

  it('fails with a structured diagnostic when the window length is not a positive integer', () => {
    const document = buildWindowAggregateFlow();
    document.spec.nodes[1]!.config = { length: 0, timeUnit: WINDOW_TIME_UNIT };
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(WINDOW_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('length');
  });

  it('fails with a structured diagnostic when the aggregate fields are missing', () => {
    const document = buildWindowAggregateFlow();
    document.spec.nodes[2]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(AGGREGATE_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('fields');
  });
});

describe('flow eKuiper compiler (group-by operator)', () => {
  const WINDOW_FLOW_ID = 'node-window-1';
  const GROUP_BY_FLOW_ID = 'node-group-by-1';
  const AGGREGATE_FLOW_ID = 'node-aggregate-1';
  const GROUP_BY_KEYS = 'deviceId, location';

  function buildGroupByFlow(): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-group-by-demo', name: 'Group By Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: WINDOW_FLOW_ID,
            type: 'window',
            typeVersion: 1,
            name: 'Window',
            config: { length: 10, timeUnit: 'ss' },
          },
          {
            id: GROUP_BY_FLOW_ID,
            type: 'group-by',
            typeVersion: 1,
            name: 'Group By',
            config: { keys: GROUP_BY_KEYS },
          },
          {
            id: AGGREGATE_FLOW_ID,
            type: 'aggregate',
            typeVersion: 1,
            name: 'Aggregate',
            config: { fields: 'avg(temperature) AS avg_temp' },
          },
          {
            id: SINK_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Sink',
            config: { topic: SINK_TOPIC },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: WINDOW_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-2',
            sourceNodeId: WINDOW_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: GROUP_BY_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-3',
            sourceNodeId: GROUP_BY_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: AGGREGATE_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-4',
            sourceNodeId: AGGREGATE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [WINDOW_FLOW_ID]: { x: 160, y: 0 },
          [GROUP_BY_FLOW_ID]: { x: 320, y: 0 },
          [AGGREGATE_FLOW_ID]: { x: 480, y: 0 },
          [SINK_FLOW_ID]: { x: 640, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected nodeType/props for source->window->group-by->aggregate->sink', () => {
    const result = compileFlowToEkuiperGraph(buildGroupByFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const windowRuntimeId = createRuntimeId('window', WINDOW_FLOW_ID);
    const groupByRuntimeId = createRuntimeId('groupby', GROUP_BY_FLOW_ID);
    const aggregateRuntimeId = createRuntimeId('aggfunc', AGGREGATE_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [windowRuntimeId]: {
            type: 'operator',
            nodeType: 'window',
            props: { type: 'tumblingwindow', unit: 'ss', size: 10 },
          },
          [groupByRuntimeId]: {
            type: 'operator',
            nodeType: 'groupby',
            props: { dimensions: ['deviceId', 'location'] },
          },
          [aggregateRuntimeId]: {
            type: 'operator',
            nodeType: 'aggfunc',
            props: { expr: 'avg(temperature) AS avg_temp' },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_TOPIC },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [windowRuntimeId],
            [windowRuntimeId]: [groupByRuntimeId],
            [groupByRuntimeId]: [aggregateRuntimeId],
            [aggregateRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [WINDOW_FLOW_ID]: windowRuntimeId,
      [GROUP_BY_FLOW_ID]: groupByRuntimeId,
      [AGGREGATE_FLOW_ID]: aggregateRuntimeId,
      [SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildGroupByFlow());
    const second = compileFlowToEkuiperGraph(buildGroupByFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('produces a graph that satisfies the audited eKuiper envelope', () => {
    const result = compileFlowToEkuiperGraph(buildGroupByFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      isEkuiperGraphRule(result.artifact.ruleDefinition.graph),
    ).toBe(true);
  });

  it('fails with a structured diagnostic when the group-by keys are missing', () => {
    const document = buildGroupByFlow();
    document.spec.nodes[2]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(GROUP_BY_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('keys');
  });

  it('fails with a structured diagnostic when the group-by keys have no usable entry', () => {
    const document = buildGroupByFlow();
    document.spec.nodes[2]!.config = { keys: '  ,  ' };
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(GROUP_BY_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('keys');
  });
});

describe('flow eKuiper compiler (switch operator)', () => {
  const SWITCH_FLOW_ID = 'node-switch-1';
  const SINK_A_FLOW_ID = 'node-sink-a';
  const SINK_B_FLOW_ID = 'node-sink-b';
  const SINK_A_TOPIC = 'alerts/high';
  const SINK_B_TOPIC = 'alerts/low';
  const SWITCH_CASES = 'temperature > 20, temperature <= 20';

  function buildSwitchFlow(): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-switch-demo', name: 'Switch Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: SWITCH_FLOW_ID,
            type: 'switch',
            typeVersion: 1,
            name: 'Switch',
            config: { cases: SWITCH_CASES },
          },
          {
            id: SINK_A_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'High Sink',
            config: { topic: SINK_A_TOPIC },
          },
          {
            id: SINK_B_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Low Sink',
            config: { topic: SINK_B_TOPIC },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SWITCH_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-2',
            sourceNodeId: SWITCH_FLOW_ID,
            sourcePortId: 'branch-1',
            targetNodeId: SINK_A_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-3',
            sourceNodeId: SWITCH_FLOW_ID,
            sourcePortId: 'branch-2',
            targetNodeId: SINK_B_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [SWITCH_FLOW_ID]: { x: 160, y: 0 },
          [SINK_A_FLOW_ID]: { x: 320, y: -60 },
          [SINK_B_FLOW_ID]: { x: 320, y: 60 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected switch nodeType/props and two-dimensional branch edges', () => {
    const result = compileFlowToEkuiperGraph(buildSwitchFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const switchRuntimeId = createRuntimeId('switch', SWITCH_FLOW_ID);
    const sinkARuntimeId = createRuntimeId('sink', SINK_A_FLOW_ID);
    const sinkBRuntimeId = createRuntimeId('sink', SINK_B_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [switchRuntimeId]: {
            type: 'operator',
            nodeType: 'switch',
            props: {
              cases: ['temperature > 20', 'temperature <= 20'],
              stopAtFirstMatch: true,
            },
          },
          [sinkARuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_A_TOPIC },
          },
          [sinkBRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_B_TOPIC },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [switchRuntimeId],
            [switchRuntimeId]: [[sinkARuntimeId], [sinkBRuntimeId]],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [SWITCH_FLOW_ID]: switchRuntimeId,
      [SINK_A_FLOW_ID]: sinkARuntimeId,
      [SINK_B_FLOW_ID]: sinkBRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('maps branches by stable port ID independent of edge insertion order', () => {
    const baseline = compileFlowToEkuiperGraph(buildSwitchFlow());
    const reordered = buildSwitchFlow();
    reordered.spec.edges.reverse();
    const recompiled = compileFlowToEkuiperGraph(reordered);

    expect(baseline.ok).toBe(true);
    expect(recompiled.ok).toBe(true);
    if (!baseline.ok || !recompiled.ok) return;

    // Only the compiled definition is compared: the semantic hash
    // intentionally covers the raw spec (including array order), while the
    // compiled graph must not depend on edge insertion order.
    expect(canonicalJson(recompiled.artifact.ruleDefinition)).toBe(
      canonicalJson(baseline.artifact.ruleDefinition),
    );
    const graph = recompiled.artifact.ruleDefinition.graph as {
      nodes: Record<string, unknown>;
      topo: { edges: Record<string, unknown> };
    };
    const switchRuntimeId = createRuntimeId('switch', SWITCH_FLOW_ID);
    const sinkARuntimeId = createRuntimeId('sink', SINK_A_FLOW_ID);
    const sinkBRuntimeId = createRuntimeId('sink', SINK_B_FLOW_ID);
    expect(graph.topo.edges[switchRuntimeId]).toEqual([
      [sinkARuntimeId],
      [sinkBRuntimeId],
    ]);
  });

  it('emits node entries that satisfy the audited graph node envelope', () => {
    const result = compileFlowToEkuiperGraph(buildSwitchFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, unknown>;
    };

    // The FS-0073 `isEkuiperGraphRule` helper predates switch
    // two-dimensional edges, so the switch graph asserts the node envelope
    // per entry plus exact topology instead of the whole-rule check.
    expect(Object.values(graph.nodes).every(isEkuiperGraphNode)).toBe(true);
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildSwitchFlow());
    const second = compileFlowToEkuiperGraph(buildSwitchFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('fails with a structured diagnostic when the switch cases are missing', () => {
    const document = buildSwitchFlow();
    document.spec.nodes[1]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(SWITCH_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('cases');
  });

  it('fails with a structured diagnostic when cases do not hold two branch conditions', () => {
    const document = buildSwitchFlow();
    document.spec.nodes[1]!.config = { cases: 'temperature > 20' };
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(SWITCH_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('cases');
  });

  it('fails with a structured diagnostic when the default output is connected', () => {
    const document = buildSwitchFlow();
    document.spec.nodes.push({
      id: 'node-sink-default',
      type: 'memory-sink',
      typeVersion: 1,
      name: 'Default Sink',
      config: { topic: 'alerts/default' },
    });
    document.spec.edges.push({
      id: 'edge-default',
      sourceNodeId: SWITCH_FLOW_ID,
      sourcePortId: 'default',
      targetNodeId: 'node-sink-default',
      targetPortId: 'in',
    });
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('FLOW_UNKNOWN_NODE_TYPE');
    expect(result.diagnostics[0]?.nodeId).toBe(SWITCH_FLOW_ID);
  });
});

describe('flow eKuiper compiler (sort operator)', () => {
  const WINDOW_FLOW_ID = 'node-window-1';
  const SORT_FLOW_ID = 'node-sort-1';
  const ORDER_BY = 'avg_temp DESC';

  function buildSortFlow(orderBy: string): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-sort-demo', name: 'Sort Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: WINDOW_FLOW_ID,
            type: 'window',
            typeVersion: 1,
            name: 'Window',
            config: { length: 10, timeUnit: 'ss' },
          },
          {
            id: SORT_FLOW_ID,
            type: 'sort',
            typeVersion: 1,
            name: 'Sort',
            config: { orderBy },
          },
          {
            id: SINK_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Sink',
            config: { topic: SINK_TOPIC },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: WINDOW_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-2',
            sourceNodeId: WINDOW_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SORT_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-3',
            sourceNodeId: SORT_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [WINDOW_FLOW_ID]: { x: 160, y: 0 },
          [SORT_FLOW_ID]: { x: 320, y: 0 },
          [SINK_FLOW_ID]: { x: 480, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected orderby nodeType/props for source->window->sort->sink', () => {
    const result = compileFlowToEkuiperGraph(buildSortFlow(ORDER_BY));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const windowRuntimeId = createRuntimeId('window', WINDOW_FLOW_ID);
    const sortRuntimeId = createRuntimeId('orderby', SORT_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [windowRuntimeId]: {
            type: 'operator',
            nodeType: 'window',
            props: { type: 'tumblingwindow', unit: 'ss', size: 10 },
          },
          [sortRuntimeId]: {
            type: 'operator',
            nodeType: 'orderby',
            props: { sorts: [{ field: 'avg_temp', desc: true }] },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_TOPIC },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [windowRuntimeId],
            [windowRuntimeId]: [sortRuntimeId],
            [sortRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [WINDOW_FLOW_ID]: windowRuntimeId,
      [SORT_FLOW_ID]: sortRuntimeId,
      [SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('parses sort direction per key defaulting to ascending', () => {
    const result = compileFlowToEkuiperGraph(
      buildSortFlow('temperature, humidity DESC'),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sortRuntimeId = createRuntimeId('orderby', SORT_FLOW_ID);
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };

    expect(graph.nodes[sortRuntimeId]?.props).toEqual({
      sorts: [
        { field: 'temperature', desc: false },
        { field: 'humidity', desc: true },
      ],
    });
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildSortFlow(ORDER_BY));
    const second = compileFlowToEkuiperGraph(buildSortFlow(ORDER_BY));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('produces a graph that satisfies the audited eKuiper envelope', () => {
    const result = compileFlowToEkuiperGraph(buildSortFlow(ORDER_BY));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      isEkuiperGraphRule(result.artifact.ruleDefinition.graph),
    ).toBe(true);
  });

  it('fails with a structured diagnostic when the orderBy is missing', () => {
    const document = buildSortFlow(ORDER_BY);
    document.spec.nodes[2]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(SORT_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('orderBy');
  });
});

describe('flow eKuiper compiler (join operator)', () => {
  const LEFT_SOURCE_FLOW_ID = 'node-source-left';
  const RIGHT_SOURCE_FLOW_ID = 'node-source-right';
  const WINDOW_FLOW_ID = 'node-window-1';
  const JOIN_FLOW_ID = 'node-join-1';
  const LEFT_TOPIC = 'devices/left';
  const RIGHT_TOPIC = 'devices/right';
  const JOIN_CONDITION = 'leftStream.id = rightStream.id';

  function buildJoinFlow(options?: {
    from?: string;
    joinName?: string;
    condition?: string;
  }): FlowDocument {
    const from =
      options?.from ?? createRuntimeId('source', LEFT_SOURCE_FLOW_ID);
    const joinName =
      options?.joinName ?? createRuntimeId('source', RIGHT_SOURCE_FLOW_ID);
    const condition = options?.condition ?? JOIN_CONDITION;
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-join-demo', name: 'Join Demo' },
      spec: {
        nodes: [
          {
            id: LEFT_SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Left Source',
            config: { topic: LEFT_TOPIC },
          },
          {
            id: RIGHT_SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Right Source',
            config: { topic: RIGHT_TOPIC },
          },
          {
            id: WINDOW_FLOW_ID,
            type: 'window',
            typeVersion: 1,
            name: 'Window',
            config: { length: 10, timeUnit: 'ss' },
          },
          {
            id: JOIN_FLOW_ID,
            type: 'join',
            typeVersion: 1,
            name: 'Join',
            config: { from, joinName, condition },
          },
          {
            id: SINK_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Sink',
            config: { topic: SINK_TOPIC },
          },
        ],
        edges: [
          {
            id: 'edge-left-window',
            sourceNodeId: LEFT_SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: WINDOW_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-right-window',
            sourceNodeId: RIGHT_SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: WINDOW_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-window-join',
            sourceNodeId: WINDOW_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: JOIN_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-out',
            sourceNodeId: JOIN_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [LEFT_SOURCE_FLOW_ID]: { x: 0, y: -60 },
          [RIGHT_SOURCE_FLOW_ID]: { x: 0, y: 60 },
          [WINDOW_FLOW_ID]: { x: 200, y: 0 },
          [JOIN_FLOW_ID]: { x: 400, y: 0 },
          [SINK_FLOW_ID]: { x: 600, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected join nodeType/props with from/joins taken from config', () => {
    const result = compileFlowToEkuiperGraph(buildJoinFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const leftRuntimeId = createRuntimeId('source', LEFT_SOURCE_FLOW_ID);
    const rightRuntimeId = createRuntimeId('source', RIGHT_SOURCE_FLOW_ID);
    const windowRuntimeId = createRuntimeId('window', WINDOW_FLOW_ID);
    const joinRuntimeId = createRuntimeId('join', JOIN_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [leftRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: LEFT_TOPIC },
          },
          [rightRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: RIGHT_TOPIC },
          },
          [windowRuntimeId]: {
            type: 'operator',
            nodeType: 'window',
            props: { type: 'tumblingwindow', unit: 'ss', size: 10 },
          },
          [joinRuntimeId]: {
            type: 'operator',
            nodeType: 'join',
            props: {
              from: leftRuntimeId,
              joins: [
                { name: rightRuntimeId, type: 'inner', on: JOIN_CONDITION },
              ],
            },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_TOPIC },
          },
        },
        topo: {
          sources: [leftRuntimeId, rightRuntimeId].sort(),
          edges: {
            [leftRuntimeId]: [windowRuntimeId],
            [rightRuntimeId]: [windowRuntimeId],
            [windowRuntimeId]: [joinRuntimeId],
            [joinRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [LEFT_SOURCE_FLOW_ID]: leftRuntimeId,
      [RIGHT_SOURCE_FLOW_ID]: rightRuntimeId,
      [WINDOW_FLOW_ID]: windowRuntimeId,
      [JOIN_FLOW_ID]: joinRuntimeId,
      [SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('derives the join identities from config rather than edge identity', () => {
    const leftRuntimeId = createRuntimeId('source', LEFT_SOURCE_FLOW_ID);
    const rightRuntimeId = createRuntimeId('source', RIGHT_SOURCE_FLOW_ID);
    const result = compileFlowToEkuiperGraph(
      buildJoinFlow({ from: rightRuntimeId, joinName: leftRuntimeId }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const joinRuntimeId = createRuntimeId('join', JOIN_FLOW_ID);
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };

    expect(graph.nodes[joinRuntimeId]?.props).toEqual({
      from: rightRuntimeId,
      joins: [{ name: leftRuntimeId, type: 'inner', on: JOIN_CONDITION }],
    });
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildJoinFlow());
    const second = compileFlowToEkuiperGraph(buildJoinFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('produces a graph that satisfies the audited eKuiper envelope', () => {
    const result = compileFlowToEkuiperGraph(buildJoinFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      isEkuiperGraphRule(result.artifact.ruleDefinition.graph),
    ).toBe(true);
  });

  it('fails with a structured diagnostic when the join from identity is missing', () => {
    const document = buildJoinFlow();
    document.spec.nodes[3]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(JOIN_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('from');
  });

  it('fails with a structured diagnostic when the join condition text is missing', () => {
    const leftRuntimeId = createRuntimeId('source', LEFT_SOURCE_FLOW_ID);
    const rightRuntimeId = createRuntimeId('source', RIGHT_SOURCE_FLOW_ID);
    const document = buildJoinFlow();
    document.spec.nodes[3]!.config = {
      from: leftRuntimeId,
      joinName: rightRuntimeId,
    };
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(JOIN_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('condition');
  });

  it('fails with a structured diagnostic when the join input is missing', () => {
    const document = buildJoinFlow();
    document.spec.edges = document.spec.edges.filter(
      (edge) => edge.targetNodeId !== JOIN_FLOW_ID,
    );
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.nodeId === JOIN_FLOW_ID,
      ),
    ).toBe(true);
  });
});

describe('flow eKuiper compiler (mqtt source and sink)', () => {
  const MQTT_SOURCE_FLOW_ID = 'node-mqtt-source-1';
  const MQTT_SINK_FLOW_ID = 'node-mqtt-sink-1';
  const MQTT_TOPIC_IN = 'devices/mqtt-in';
  const MQTT_TOPIC_OUT = 'devices/mqtt-out';
  const MQTT_CONF_KEY = 'test-mqtt-confkey';
  const MQTT_SERVER = 'tcp://test.mosquitto.org:1883';

  function buildMqttSourceFlow(
    sourceConfig: Record<string, unknown> = {
      topic: MQTT_TOPIC_IN,
      confKey: MQTT_CONF_KEY,
    },
  ): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-mqtt-source-demo', name: 'MQTT Source Demo' },
      spec: {
        nodes: [
          {
            id: MQTT_SOURCE_FLOW_ID,
            type: 'mqtt-source',
            typeVersion: 1,
            name: 'MQTT Source',
            config: sourceConfig,
          },
          {
            id: SINK_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Sink',
            config: { topic: SINK_TOPIC },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: MQTT_SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [MQTT_SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [SINK_FLOW_ID]: { x: 320, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  function buildMqttSinkFlow(
    sinkConfig: Record<string, unknown> = {
      topic: MQTT_TOPIC_OUT,
      server: MQTT_SERVER,
    },
  ): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-mqtt-sink-demo', name: 'MQTT Sink Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: MQTT_SINK_FLOW_ID,
            type: 'mqtt-sink',
            typeVersion: 1,
            name: 'MQTT Sink',
            config: sinkConfig,
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: MQTT_SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [MQTT_SINK_FLOW_ID]: { x: 320, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected mqtt source nodeType/props with datasource and confKey', () => {
    const result = compileFlowToEkuiperGraph(buildMqttSourceFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', MQTT_SOURCE_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'mqtt',
            props: {
              datasource: MQTT_TOPIC_IN,
              confKey: MQTT_CONF_KEY,
            },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_TOPIC },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [MQTT_SOURCE_FLOW_ID]: sourceRuntimeId,
      [SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('never emits server or connectionSelector on mqtt sources', () => {
    const result = compileFlowToEkuiperGraph(buildMqttSourceFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sourceRuntimeId = createRuntimeId('source', MQTT_SOURCE_FLOW_ID);
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };
    const props = graph.nodes[sourceRuntimeId]?.props ?? {};

    expect('server' in props).toBe(false);
    expect('connectionSelector' in props).toBe(false);
    expect(props).toEqual({
      datasource: MQTT_TOPIC_IN,
      confKey: MQTT_CONF_KEY,
    });
  });

  it('maps a legacy connectionSelector source binding to confKey without emitting it', () => {
    const result = compileFlowToEkuiperGraph(
      buildMqttSourceFlow({
        topic: MQTT_TOPIC_IN,
        connectionSelector: 'conn-shared-1',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sourceRuntimeId = createRuntimeId('source', MQTT_SOURCE_FLOW_ID);
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };
    const props = graph.nodes[sourceRuntimeId]?.props ?? {};

    expect(props).toEqual({
      datasource: MQTT_TOPIC_IN,
      confKey: 'conn-shared-1',
    });
    expect('server' in props).toBe(false);
    expect('connectionSelector' in props).toBe(false);
  });

  it('fails with a structured diagnostic when the mqtt source confKey is missing instead of silently omitting it', () => {
    const result = compileFlowToEkuiperGraph(
      buildMqttSourceFlow({ topic: MQTT_TOPIC_IN }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(MQTT_SOURCE_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('confKey');
  });

  it('produces the exact expected mqtt sink nodeType/props with topic and server', () => {
    const result = compileFlowToEkuiperGraph(buildMqttSinkFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', MQTT_SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'mqtt',
            props: {
              topic: MQTT_TOPIC_OUT,
              server: MQTT_SERVER,
            },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [MQTT_SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('never emits connectionSelector on mqtt sinks', () => {
    const result = compileFlowToEkuiperGraph(buildMqttSinkFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sinkRuntimeId = createRuntimeId('sink', MQTT_SINK_FLOW_ID);
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };
    const props = graph.nodes[sinkRuntimeId]?.props ?? {};

    expect('connectionSelector' in props).toBe(false);
    expect(props).toEqual({
      topic: MQTT_TOPIC_OUT,
      server: MQTT_SERVER,
    });
  });

  it('emits no secret fields in mqtt props', () => {
    const result = compileFlowToEkuiperGraph(buildMqttSinkFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(canonicalJson(result.artifact)).not.toContain('password');
    expect(canonicalJson(result.artifact)).not.toContain('privateKey');
    expect(canonicalJson(result.artifact)).not.toContain('secret');
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildMqttSinkFlow());
    const second = compileFlowToEkuiperGraph(buildMqttSinkFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('produces graphs that satisfy the audited eKuiper envelope', () => {
    const fromMqtt = compileFlowToEkuiperGraph(buildMqttSourceFlow());
    const toMqtt = compileFlowToEkuiperGraph(buildMqttSinkFlow());

    expect(fromMqtt.ok).toBe(true);
    expect(toMqtt.ok).toBe(true);
    if (!fromMqtt.ok || !toMqtt.ok) return;

    expect(isEkuiperGraphRule(fromMqtt.artifact.ruleDefinition.graph)).toBe(
      true,
    );
    expect(isEkuiperGraphRule(toMqtt.artifact.ruleDefinition.graph)).toBe(
      true,
    );
  });

  it('fails with a structured diagnostic when the mqtt source topic is missing', () => {
    const result = compileFlowToEkuiperGraph(buildMqttSourceFlow({}));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(MQTT_SOURCE_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('topic');
  });

  it('fails with a structured diagnostic when the mqtt sink topic is missing', () => {
    const result = compileFlowToEkuiperGraph(buildMqttSinkFlow({}));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(MQTT_SINK_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('topic');
  });

  it('maps a legacy connectionSelector sink binding to server without emitting it', () => {
    const result = compileFlowToEkuiperGraph(
      buildMqttSinkFlow({
        topic: MQTT_TOPIC_OUT,
        connectionSelector: 'conn-shared-1',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sinkRuntimeId = createRuntimeId('sink', MQTT_SINK_FLOW_ID);
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };
    const props = graph.nodes[sinkRuntimeId]?.props ?? {};

    expect(props).toEqual({
      topic: MQTT_TOPIC_OUT,
      server: 'conn-shared-1',
    });
    expect('connectionSelector' in props).toBe(false);
  });

  it('fails with a structured diagnostic when the mqtt sink server is missing instead of silently omitting it', () => {
    const result = compileFlowToEkuiperGraph(
      buildMqttSinkFlow({ topic: MQTT_TOPIC_OUT }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(MQTT_SINK_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('server');
  });

  it('fails with a structured diagnostic for a malformed broker reference instead of deploying against an unintended broker', () => {
    const result = compileFlowToEkuiperGraph(
      buildMqttSinkFlow({ topic: MQTT_TOPIC_OUT, server: 42 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(MQTT_SINK_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('server');
  });

  it('fails with a structured diagnostic for a malformed legacy shared-connection binding', () => {
    const result = compileFlowToEkuiperGraph(
      buildMqttSinkFlow({ topic: MQTT_TOPIC_OUT, connectionSelector: 42 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(MQTT_SINK_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('server');
  });
});

describe('flow eKuiper compiler (rest and log sinks)', () => {
  const REST_SINK_FLOW_ID = 'node-rest-sink-1';
  const LOG_SINK_FLOW_ID = 'node-log-sink-1';
  const REST_URL = 'https://example.test/events';
  const REST_HEADERS = {
    Authorization: 'Bearer abc',
    'X-Tenant': 't1',
  };

  function buildRestSinkFlow(
    sinkConfig: Record<string, unknown> = {
      url: REST_URL,
      method: 'POST',
      bodyType: 'json',
      headers: REST_HEADERS,
    },
  ): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-rest-sink-demo', name: 'REST Sink Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: REST_SINK_FLOW_ID,
            type: 'rest-sink',
            typeVersion: 1,
            name: 'REST Sink',
            config: sinkConfig,
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: REST_SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [REST_SINK_FLOW_ID]: { x: 320, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  function buildLogSinkFlow(): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-log-sink-demo', name: 'Log Sink Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: LOG_SINK_FLOW_ID,
            type: 'log-sink',
            typeVersion: 1,
            name: 'Log Sink',
            config: {},
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: LOG_SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [LOG_SINK_FLOW_ID]: { x: 320, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected rest sink nodeType/props', () => {
    const result = compileFlowToEkuiperGraph(buildRestSinkFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', REST_SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'rest',
            props: {
              url: REST_URL,
              method: 'POST',
              bodyType: 'json',
              headers: REST_HEADERS,
            },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [REST_SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('compiles a url-only rest sink to url-only props without fabricating advanced fields', () => {
    const result = compileFlowToEkuiperGraph(
      buildRestSinkFlow({ url: REST_URL }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sinkRuntimeId = createRuntimeId('sink', REST_SINK_FLOW_ID);
    const graph = result.artifact.ruleDefinition.graph as {
      nodes: Record<string, { props: Record<string, unknown> }>;
    };

    expect(graph.nodes[sinkRuntimeId]?.props).toEqual({ url: REST_URL });
  });

  it('produces the exact expected log sink nodeType/props', () => {
    const result = compileFlowToEkuiperGraph(buildLogSinkFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', LOG_SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'log',
            props: {},
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [LOG_SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildRestSinkFlow());
    const second = compileFlowToEkuiperGraph(buildRestSinkFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('produces graphs that satisfy the audited eKuiper envelope', () => {
    const rest = compileFlowToEkuiperGraph(buildRestSinkFlow());
    const log = compileFlowToEkuiperGraph(buildLogSinkFlow());

    expect(rest.ok).toBe(true);
    expect(log.ok).toBe(true);
    if (!rest.ok || !log.ok) return;

    expect(isEkuiperGraphRule(rest.artifact.ruleDefinition.graph)).toBe(true);
    expect(isEkuiperGraphRule(log.artifact.ruleDefinition.graph)).toBe(true);
  });

  it('fails with a structured diagnostic when the rest url is missing', () => {
    const result = compileFlowToEkuiperGraph(buildRestSinkFlow({}));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(REST_SINK_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('url');
  });

  it('fails with a structured diagnostic for an unconfirmed rest method', () => {
    const result = compileFlowToEkuiperGraph(
      buildRestSinkFlow({ url: REST_URL, method: 'HEAD' }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(REST_SINK_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('method');
  });

  it('fails with a structured diagnostic for non-object rest headers', () => {
    const result = compileFlowToEkuiperGraph(
      buildRestSinkFlow({ url: REST_URL, headers: 'Authorization: Bearer abc' }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(REST_SINK_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('headers');
  });
});

describe('flow eKuiper compiler (function operator)', () => {
  const FUNC_FLOW_ID = 'node-func-1';
  const FUNC_EXPRESSION = 'temperature * 1.8 + 32 as temp_f';

  function buildFuncFlow(): FlowDocument {
    return {
      apiVersion: FLOW_DOCUMENT_VERSION,
      metadata: { id: 'flow-func-demo', name: 'Func Demo' },
      spec: {
        nodes: [
          {
            id: SOURCE_FLOW_ID,
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source',
            config: { topic: SOURCE_TOPIC },
          },
          {
            id: FUNC_FLOW_ID,
            type: 'func',
            typeVersion: 1,
            name: 'Function',
            config: { expression: FUNC_EXPRESSION },
          },
          {
            id: SINK_FLOW_ID,
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Sink',
            config: { topic: SINK_TOPIC },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: SOURCE_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: FUNC_FLOW_ID,
            targetPortId: 'in',
          },
          {
            id: 'edge-2',
            sourceNodeId: FUNC_FLOW_ID,
            sourcePortId: 'out',
            targetNodeId: SINK_FLOW_ID,
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          [SOURCE_FLOW_ID]: { x: 0, y: 0 },
          [FUNC_FLOW_ID]: { x: 160, y: 0 },
          [SINK_FLOW_ID]: { x: 320, y: 0 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
  }

  it('produces the exact expected nodeType/props for source->func->sink', () => {
    const result = compileFlowToEkuiperGraph(buildFuncFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceRuntimeId = createRuntimeId('source', SOURCE_FLOW_ID);
    const funcRuntimeId = createRuntimeId('function', FUNC_FLOW_ID);
    const sinkRuntimeId = createRuntimeId('sink', SINK_FLOW_ID);

    expect(result.artifact.ruleDefinition).toEqual({
      graph: {
        nodes: {
          [sourceRuntimeId]: {
            type: 'source',
            nodeType: 'memory',
            props: { datasource: SOURCE_TOPIC },
          },
          [funcRuntimeId]: {
            type: 'operator',
            nodeType: 'function',
            props: { expr: FUNC_EXPRESSION },
          },
          [sinkRuntimeId]: {
            type: 'sink',
            nodeType: 'memory',
            props: { topic: SINK_TOPIC },
          },
        },
        topo: {
          sources: [sourceRuntimeId],
          edges: {
            [sourceRuntimeId]: [funcRuntimeId],
            [funcRuntimeId]: [sinkRuntimeId],
          },
        },
      },
    });
    expect(result.artifact.runtimeNodeMap).toEqual({
      [SOURCE_FLOW_ID]: sourceRuntimeId,
      [FUNC_FLOW_ID]: funcRuntimeId,
      [SINK_FLOW_ID]: sinkRuntimeId,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('yields byte-equivalent canonical JSON on recompilation', () => {
    const first = compileFlowToEkuiperGraph(buildFuncFlow());
    const second = compileFlowToEkuiperGraph(buildFuncFlow());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalJson(first.artifact)).toBe(canonicalJson(second.artifact));
  });

  it('produces a graph that satisfies the audited eKuiper envelope', () => {
    const result = compileFlowToEkuiperGraph(buildFuncFlow());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      isEkuiperGraphRule(result.artifact.ruleDefinition.graph),
    ).toBe(true);
  });

  it('fails with a structured diagnostic when the function expression is missing', () => {
    const document = buildFuncFlow();
    document.spec.nodes[1]!.config = {};
    const result = compileFlowToEkuiperGraph(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.artifact).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(
      'FLOW_REQUIRED_PROPERTY_MISSING',
    );
    expect(result.diagnostics[0]?.nodeId).toBe(FUNC_FLOW_ID);
    expect(result.diagnostics[0]?.propertyPath).toBe('expression');
  });
});

describe('toSafeRuleId', () => {
  it('keeps an already-safe flow id unchanged', () => {
    expect(toSafeRuleId('flow-memory-demo')).toBe('flow-memory-demo');
  });

  it('is deterministic and replaces unsafe characters', () => {
    expect(toSafeRuleId('flow demo/01')).toBe(toSafeRuleId('flow demo/01'));
    expect(toSafeRuleId('flow demo/01')).toBe('flow_demo_01');
  });

  it('prefixes ids that do not start with a letter', () => {
    expect(toSafeRuleId('42-flow')).toBe('rule_42-flow');
  });

  it('throws an internal error for an empty flow id', () => {
    expect(() => toSafeRuleId('   ')).toThrow();
  });
});
