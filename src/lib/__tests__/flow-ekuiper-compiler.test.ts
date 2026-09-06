import { canonicalJson } from '@/lib/flows/hashing/canonical-json';
import {
  compileFlowToEkuiperGraph,
  toSafeRuleId,
} from '@/lib/flows/compiler/ekuiper/compile-graph';
import { isEkuiperGraphRule } from '@/lib/flows/compiler/ekuiper/graph-types';
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
            [sinkRuntimeId]: [],
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
            [sinkRuntimeId]: [],
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
