import {
  FLOW_DOCUMENT_VERSION,
  type FlowDocument,
} from '../../../model/flow-document';

/**
 * Live-engine node conformance helpers (FS-0141).
 *
 * This module builds one minimal valid Flow document per built-in node
 * type and POSTs compiled artifacts to a running eKuiper engine. It
 * contains no compiler logic: compilation always goes through the real
 * `compileFlowToEkuiperGraph`, and engine validation stays authoritative.
 * Nothing here is executed in production; it only runs under Jest when
 * `EKUIPER_CONFORMANCE_URL` points at a reachable engine.
 */

const SOURCE_ID = 'node-conformance-source';
const OPERATOR_ID = 'node-conformance-op';
const SINK_ID = 'node-conformance-sink';

const MEMORY_TOPIC_IN = 'devices/conformance-in';
const MEMORY_TOPIC_OUT = 'devices/conformance-out';
const MQTT_TOPIC_IN = 'devices/conformance-mqtt-in';
const MQTT_TOPIC_OUT = 'devices/conformance-mqtt-out';
const MQTT_CONNECTION = 'conn-shared-1';
const REST_URL = 'https://example.test/events';

function baseLayout(ids: string[]): FlowDocument['layout'] {
  const nodes: Record<string, { x: number; y: number }> = {};
  ids.forEach((id, index) => {
    nodes[id] = { x: index * 320, y: 0 };
  });
  return { nodes, viewport: { x: 0, y: 0, zoom: 1 } };
}

function memorySourceNode(id: string): FlowDocument['spec']['nodes'][number] {
  return {
    id,
    type: 'memory-source',
    typeVersion: 1,
    name: 'Conformance Source',
    config: { topic: MEMORY_TOPIC_IN },
  };
}

function memorySinkNode(
  id: string,
  topic = MEMORY_TOPIC_OUT,
): FlowDocument['spec']['nodes'][number] {
  return {
    id,
    type: 'memory-sink',
    typeVersion: 1,
    name: 'Conformance Sink',
    config: { topic },
  };
}

function linearFlow(
  ruleId: string,
  operator: FlowDocument['spec']['nodes'][number] | undefined,
): FlowDocument {
  const nodes: FlowDocument['spec']['nodes'] = [memorySourceNode(SOURCE_ID)];
  const edges: FlowDocument['spec']['edges'] = [];
  if (operator === undefined) {
    nodes.push(memorySinkNode(SINK_ID));
    edges.push({
      id: 'edge-1',
      sourceNodeId: SOURCE_ID,
      sourcePortId: 'out',
      targetNodeId: SINK_ID,
      targetPortId: 'in',
    });
  } else {
    nodes.push(operator, memorySinkNode(SINK_ID));
    edges.push(
      {
        id: 'edge-1',
        sourceNodeId: SOURCE_ID,
        sourcePortId: 'out',
        targetNodeId: OPERATOR_ID,
        targetPortId: 'in',
      },
      {
        id: 'edge-2',
        sourceNodeId: OPERATOR_ID,
        sourcePortId: 'out',
        targetNodeId: SINK_ID,
        targetPortId: 'in',
      },
    );
  }
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: { id: ruleId, name: ruleId },
    spec: { nodes, edges },
    layout: baseLayout(nodes.map((node) => node.id)),
  };
}

function operatorNode(
  type: string,
  config: Record<string, unknown>,
): FlowDocument['spec']['nodes'][number] {
  return {
    id: OPERATOR_ID,
    type,
    typeVersion: 1,
    name: `Conformance ${type}`,
    config,
  };
}

function buildSwitchFlow(): FlowDocument {
  const sinkA = 'node-conformance-sink-a';
  const sinkB = 'node-conformance-sink-b';
  const nodes: FlowDocument['spec']['nodes'] = [
    memorySourceNode(SOURCE_ID),
    operatorNode('switch', {
      cases: 'temperature > 20, temperature <= 20',
    }),
    memorySinkNode(sinkA, 'devices/conformance-high'),
    memorySinkNode(sinkB, 'devices/conformance-low'),
  ];
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: { id: 'flow-conformance-switch', name: 'Conformance switch' },
    spec: {
      nodes,
      edges: [
        {
          id: 'edge-1',
          sourceNodeId: SOURCE_ID,
          sourcePortId: 'out',
          targetNodeId: OPERATOR_ID,
          targetPortId: 'in',
        },
        {
          id: 'edge-2',
          sourceNodeId: OPERATOR_ID,
          sourcePortId: 'branch-1',
          targetNodeId: sinkA,
          targetPortId: 'in',
        },
        {
          id: 'edge-3',
          sourceNodeId: OPERATOR_ID,
          sourcePortId: 'branch-2',
          targetNodeId: sinkB,
          targetPortId: 'in',
        },
      ],
    },
    layout: baseLayout(nodes.map((node) => node.id)),
  };
}

function buildJoinFlow(): FlowDocument {
  const leftSource = 'node-conformance-left';
  const rightSource = 'node-conformance-right';
  const nodes: FlowDocument['spec']['nodes'] = [
    {
      id: leftSource,
      type: 'memory-source',
      typeVersion: 1,
      name: 'Conformance Left',
      config: { topic: 'devices/conformance-left' },
    },
    {
      id: rightSource,
      type: 'memory-source',
      typeVersion: 1,
      name: 'Conformance Right',
      config: { topic: 'devices/conformance-right' },
    },
    operatorNode('join', {
      condition: 'leftStream.id = rightStream.id',
    }),
    memorySinkNode(SINK_ID),
  ];
  return {
    apiVersion: FLOW_DOCUMENT_VERSION,
    metadata: { id: 'flow-conformance-join', name: 'Conformance join' },
    spec: {
      nodes,
      edges: [
        {
          id: 'edge-1',
          sourceNodeId: leftSource,
          sourcePortId: 'out',
          targetNodeId: OPERATOR_ID,
          targetPortId: 'left',
        },
        {
          id: 'edge-2',
          sourceNodeId: rightSource,
          sourcePortId: 'out',
          targetNodeId: OPERATOR_ID,
          targetPortId: 'right',
        },
        {
          id: 'edge-3',
          sourceNodeId: OPERATOR_ID,
          sourcePortId: 'out',
          targetNodeId: SINK_ID,
          targetPortId: 'in',
        },
      ],
    },
    layout: baseLayout(nodes.map((node) => node.id)),
  };
}

export interface ConformanceCase {
  /** Built-in registry node type under test; names the test output. */
  nodeType: string;
  /** Fresh minimal valid Flow document exercising that node type. */
  buildDocument: () => FlowDocument;
}

/**
 * One minimal valid flow per built-in node type currently in the
 * registry (15 types): sources/sinks pair with a memory counterpart and
 * each operator sits alone between a memory source and a memory sink,
 * except switch (two branch sinks) and join (two sources).
 */
export function listConformanceCases(): ConformanceCase[] {
  return [
    {
      nodeType: 'memory-source',
      buildDocument: () => linearFlow('flow-conformance-memory-source', undefined),
    },
    {
      nodeType: 'memory-sink',
      buildDocument: () => linearFlow('flow-conformance-memory-sink', undefined),
    },
    {
      nodeType: 'mqtt-source',
      buildDocument: () => {
        const document = linearFlow('flow-conformance-mqtt-source', undefined);
        document.spec.nodes[0] = {
          id: SOURCE_ID,
          type: 'mqtt-source',
          typeVersion: 1,
          name: 'Conformance MQTT Source',
          config: { topic: MQTT_TOPIC_IN, connectionSelector: MQTT_CONNECTION },
        };
        return document;
      },
    },
    {
      nodeType: 'mqtt-sink',
      buildDocument: () => {
        const document = linearFlow('flow-conformance-mqtt-sink', undefined);
        document.spec.nodes[1] = {
          id: SINK_ID,
          type: 'mqtt-sink',
          typeVersion: 1,
          name: 'Conformance MQTT Sink',
          config: { topic: MQTT_TOPIC_OUT, connectionSelector: MQTT_CONNECTION },
        };
        return document;
      },
    },
    {
      nodeType: 'rest-sink',
      buildDocument: () => {
        const document = linearFlow('flow-conformance-rest-sink', undefined);
        document.spec.nodes[1] = {
          id: SINK_ID,
          type: 'rest-sink',
          typeVersion: 1,
          name: 'Conformance REST Sink',
          config: { url: REST_URL, method: 'POST', bodyType: 'json' },
        };
        return document;
      },
    },
    {
      nodeType: 'log-sink',
      buildDocument: () => {
        const document = linearFlow('flow-conformance-log-sink', undefined);
        document.spec.nodes[1] = {
          id: SINK_ID,
          type: 'log-sink',
          typeVersion: 1,
          name: 'Conformance Log Sink',
          config: {},
        };
        return document;
      },
    },
    {
      nodeType: 'filter',
      buildDocument: () =>
        linearFlow(
          'flow-conformance-filter',
          operatorNode('filter', { expression: 'temperature > 20' }),
        ),
    },
    {
      nodeType: 'pick',
      buildDocument: () =>
        linearFlow(
          'flow-conformance-pick',
          operatorNode('pick', { fields: 'temperature, humidity' }),
        ),
    },
    {
      nodeType: 'func',
      buildDocument: () =>
        linearFlow(
          'flow-conformance-func',
          operatorNode('func', { expression: 'temperature * 2' }),
        ),
    },
    {
      nodeType: 'window',
      buildDocument: () =>
        linearFlow(
          'flow-conformance-window',
          operatorNode('window', { length: 10, timeUnit: 'ss' }),
        ),
    },
    {
      nodeType: 'aggregate',
      buildDocument: () =>
        linearFlow(
          'flow-conformance-aggregate',
          operatorNode('aggregate', { fields: 'avg(temperature) AS avg_temp' }),
        ),
    },
    {
      nodeType: 'group-by',
      buildDocument: () =>
        linearFlow(
          'flow-conformance-group-by',
          operatorNode('group-by', { keys: 'deviceId' }),
        ),
    },
    {
      nodeType: 'switch',
      buildDocument: buildSwitchFlow,
    },
    {
      nodeType: 'sort',
      buildDocument: () =>
        linearFlow(
          'flow-conformance-sort',
          operatorNode('sort', { orderBy: 'avg_temp DESC' }),
        ),
    },
    {
      nodeType: 'join',
      buildDocument: buildJoinFlow,
    },
  ];
}

/**
 * Engine base URL from the environment, with trailing slashes removed.
 * Returns undefined when unset or blank so the suite can skip cleanly.
 */
export function getConformanceUrl(): string | undefined {
  const raw = process.env.EKUIPER_CONFORMANCE_URL?.trim();
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  return raw.replace(/\/+$/, '');
}

export interface ValidationOutcome {
  httpStatus: number;
  bodyText: string;
  parsed: unknown;
}

/**
 * POST one compiled artifact to the audited `POST /rules/validate`
 * endpoint (`public/ekuiper-openapi.json`, eKuiper 2.4.1: request body is
 * a `RuleCreateRequest`, i.e. `{id, graph}` for graph rules; success is
 * HTTP 200 with a text/plain JSON body `{sources, valid: true}`).
 */
export async function postRuleForValidation(
  baseUrl: string,
  artifact: { ruleId: string; ruleDefinition: Record<string, unknown> },
  timeoutMs = 15000,
): Promise<ValidationOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rules/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: artifact.ruleId, ...artifact.ruleDefinition }),
        signal: controller.signal,
      });
    } catch (error) {
      const detail =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      throw new Error(
        `[conformance] validation request to "${baseUrl}/rules/validate" failed: ${detail}. ` +
          `The engine at "${baseUrl}" is unreachable or timed out.`,
      );
    }
    const bodyText = await response.text();
    let parsed: unknown = bodyText;
    try {
      parsed = JSON.parse(bodyText) as unknown;
    } catch {
      // Keep the raw text; the caller reports it in the failure message.
    }
    return { httpStatus: response.status, bodyText, parsed };
  } finally {
    clearTimeout(timer);
  }
}

/** Narrow the audited `RuleValidationResponse` success flag. */
export function readValidFlag(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) {
    return false;
  }
  return (parsed as Record<string, unknown>).valid === true;
}

/**
 * Fail when the engine cannot be reached. Any HTTP response (even an error
 * status) proves the engine is there; only a network failure or timeout
 * throws, naming the base URL and the underlying error so a run against a
 * configured-but-dead engine fails instead of silently passing.
 */
export async function assertEngineReachable(
  baseUrl: string,
  timeoutMs = 5000,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${baseUrl}/rules`, {
      method: 'GET',
      signal: controller.signal,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new Error(
      `[conformance] eKuiper engine at "${baseUrl}" is unreachable: ${detail}. ` +
        `Set EKUIPER_CONFORMANCE_URL to a reachable engine URL or unset it to skip conformance.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Side-effect-free reachability probe. Any HTTP response (even an error
 * status) proves the engine is there; only a network failure or timeout
 * reports unreachable. Prefer `assertEngineReachable` in the conformance
 * suite so a configured-but-dead engine fails loudly instead of passing.
 */
export async function isEngineReachable(
  baseUrl: string,
  timeoutMs = 5000,
): Promise<boolean> {
  try {
    await assertEngineReachable(baseUrl, timeoutMs);
    return true;
  } catch {
    return false;
  }
}
