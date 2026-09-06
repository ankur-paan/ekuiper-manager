import { hashFlowSemantic } from '../../hashing/flow-hash';
import { buildFlowIr } from '../../ir/build-flow-ir';
import type { FlowIrEdge, FlowIrNode } from '../../ir/flow-ir';
import type { FlowDocument } from '../../model/flow-document';
import {
  FLOW_NO_SINK,
  FLOW_NO_SOURCE,
  FLOW_REQUIRED_PROPERTY_MISSING,
  FLOW_UNKNOWN_NODE_TYPE,
  type FlowDiagnostic,
} from '../../model/diagnostic';
import { createBuiltinNodeRegistry } from '../../registry/builtin-registry';
import { createRuntimeId } from '../runtime-id';
import {
  FLOW_COMPILER_VERSION,
  type CompileFlowResult,
} from '../types';
import type { EkuiperGraphNode, EkuiperGraphRule } from './graph-types';

/**
 * Minimal eKuiper graph-rule compiler (FS-0074).
 *
 * Scope: compiles a validated two-node Flow (memory source -> memory sink)
 * into one eKuiper graph rule definition. Any other shape yields structured
 * `FlowDiagnostic` failures; nodes are never silently dropped.
 *
 * Audited contract sources:
 * - Envelope (`nodes`/`topo`, node `type`/`nodeType`/`props`, topology
 *   `sources`/`edges`, graph rule carried under `graph` with a required
 *   rule `id`) is proven by `public/ekuiper-openapi.json` (eKuiper 2.4.1)
 *   schemas `RuleGraph`, `RuleTopology`, `Rule`, `RuleCreateRequest`
 *   (see `graph-types.ts`).
 * - Catalog values: official eKuiper graph_rule doc maps source-node
 *   `nodeType` to the connector name with stream-definition properties in
 *   `props`, and sink-node `nodeType` to the sink name with sink properties
 *   in `props`. The official memory source doc defines streams as
 *   `WITH (DATASOURCE="<topic>", ... TYPE="memory")`, so the Flow
 *   `topic` config compiles to the `datasource` prop. The official memory
 *   sink doc shows `{"memory": {"topic": "<topic>"}}`, so the Flow
 *   `topic` config compiles to the `topic` prop.
 *
 * Determinism: same Flow document always yields the same artifact
 * (deterministic runtime IDs, sorted IR input, canonical semantic hash).
 * Layout is never read and secrets are never touched: only `metadata.id`
 * and semantic `spec` nodes/edges are consumed, and only `topic` strings
 * are copied into `props`.
 */

const MEMORY_OPERATION = 'memory';

const SOURCE_KIND_PREFIX = 'source';
const SINK_KIND_PREFIX = 'sink';

/**
 * Derive a deterministic eKuiper-safe rule ID from a Flow metadata ID.
 *
 * Centralized here so later Flow-ID constraints only change this helper:
 * disallowed characters become `_`, and IDs that do not start with a
 * letter gain a `rule_` prefix. No randomness, clock, or process state.
 *
 * @throws An internal error when the Flow ID is empty: validated
 *   documents always carry a metadata ID, so this is an invariant
 *   violation, not a user-correctable failure.
 */
export function toSafeRuleId(flowId: string): string {
  const normalized = flowId.trim().replace(/[^A-Za-z0-9_-]/g, '_');
  if (normalized.length === 0) {
    throw new Error('toSafeRuleId: flow id must not be empty');
  }
  if (!/^[A-Za-z]/.test(normalized)) {
    return `rule_${normalized}`;
  }
  return normalized;
}

function readTopic(
  config: Record<string, unknown>,
  nodeId: string,
): { topic: string } | { diagnostic: FlowDiagnostic } {
  const topic: unknown = config.topic;
  if (typeof topic === 'string' && topic.length > 0) {
    return { topic };
  }
  return {
    diagnostic: {
      code: FLOW_REQUIRED_PROPERTY_MISSING,
      severity: 'error',
      message: `Memory node "${nodeId}" requires a non-empty "topic" property.`,
      nodeId,
      propertyPath: 'topic',
    },
  };
}

function toMemorySourceNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const topic = readTopic(irNode.config, irNode.id);
  if ('diagnostic' in topic) {
    return topic;
  }
  return {
    node: {
      type: 'source',
      nodeType: MEMORY_OPERATION,
      props: { datasource: topic.topic },
    },
  };
}

function toMemorySinkNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const topic = readTopic(irNode.config, irNode.id);
  if ('diagnostic' in topic) {
    return topic;
  }
  return {
    node: {
      type: 'sink',
      nodeType: MEMORY_OPERATION,
      props: { topic: topic.topic },
    },
  };
}

/**
 * Compile a semantic Flow document into an eKuiper graph-rule deployment
 * artifact. Currently supports exactly one shape: a single memory-source
 * node wired to a single memory-sink node.
 *
 * Every user-correctable failure is returned as a structured diagnostic
 * (never a thrown string); only an empty Flow metadata ID throws, as an
 * internal invariant violation.
 */
export function compileFlowToEkuiperGraph(
  document: FlowDocument,
): CompileFlowResult {
  const semanticHash = hashFlowSemantic(document.spec);
  const ruleId = toSafeRuleId(document.metadata.id);

  const irResult = buildFlowIr(document, createBuiltinNodeRegistry());
  if (!irResult.ok) {
    return { ok: false, artifact: undefined, diagnostics: irResult.diagnostics };
  }

  const irNodes = irResult.ir.nodes;
  const source = irNodes.find((node) => node.kind === 'source');
  if (source === undefined) {
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_NO_SOURCE,
          severity: 'error',
          message: 'Flow has no source node; a memory source is required.',
        },
      ],
    };
  }
  const sink = irNodes.find((node) => node.kind === 'sink');
  if (sink === undefined) {
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_NO_SINK,
          severity: 'error',
          message: 'Flow has no sink node; a memory sink is required.',
        },
      ],
    };
  }

  const unsupported = irNodes.find(
    (node) => node.operation !== MEMORY_OPERATION,
  );
  if (unsupported !== undefined) {
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_UNKNOWN_NODE_TYPE,
          severity: 'error',
          message:
            `Flow node "${unsupported.id}" uses operation ` +
            `"${unsupported.operation}", which this compiler version cannot map to an eKuiper graph node.`,
          nodeId: unsupported.id,
        },
      ],
    };
  }
  if (irNodes.length !== 2) {
    const extra = irNodes.find((node) => node.id !== source.id && node.id !== sink.id);
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_UNKNOWN_NODE_TYPE,
          severity: 'error',
          message:
            `Flow node "${extra?.id ?? source.id}" is outside the supported ` +
            `two-node memory source -> memory sink shape.`,
          nodeId: extra?.id ?? source.id,
        },
      ],
    };
  }

  const edge: FlowIrEdge | undefined = irResult.ir.edges.find(
    (candidate) =>
      candidate.sourceNodeId === source.id &&
      candidate.targetNodeId === sink.id,
  );
  if (edge === undefined) {
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_NO_SINK,
          severity: 'error',
          message:
            `Memory sink "${sink.id}" is not connected to memory source ` +
            `"${source.id}"; a direct source -> sink edge is required.`,
          nodeId: sink.id,
        },
      ],
    };
  }

  const sourceRuntimeId = createRuntimeId(SOURCE_KIND_PREFIX, source.id);
  const sinkRuntimeId = createRuntimeId(SINK_KIND_PREFIX, sink.id);

  const sourceNode = toMemorySourceNode(source);
  if ('diagnostic' in sourceNode) {
    return { ok: false, artifact: undefined, diagnostics: [sourceNode.diagnostic] };
  }
  const sinkNode = toMemorySinkNode(sink);
  if ('diagnostic' in sinkNode) {
    return { ok: false, artifact: undefined, diagnostics: [sinkNode.diagnostic] };
  }

  const graph: EkuiperGraphRule = {
    nodes: {
      [sourceRuntimeId]: sourceNode.node,
      [sinkRuntimeId]: sinkNode.node,
    },
    topo: {
      sources: [sourceRuntimeId],
      edges: {
        [sourceRuntimeId]: [sinkRuntimeId],
        [sinkRuntimeId]: [],
      },
    },
  };

  return {
    ok: true,
    artifact: {
      compilerVersion: FLOW_COMPILER_VERSION,
      semanticHash,
      ruleId,
      ruleDefinition: { graph },
      runtimeNodeMap: {
        [source.id]: sourceRuntimeId,
        [sink.id]: sinkRuntimeId,
      },
    },
    diagnostics: [],
  };
}
