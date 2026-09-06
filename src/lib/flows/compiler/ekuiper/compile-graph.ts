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
import {
  filterDefinition,
  pickDefinition,
} from '../../registry/builtins/transforms';
import { NodeRegistry } from '../../registry/node-registry';
import { createRuntimeId } from '../runtime-id';
import {
  FLOW_COMPILER_VERSION,
  type CompileFlowResult,
} from '../types';
import type { EkuiperGraphNode, EkuiperGraphRule } from './graph-types';

/**
 * Minimal eKuiper graph-rule compiler (FS-0074, extended by FS-0075).
 *
 * Scope: compiles a validated linear Flow chain
 * (one memory source -> zero or more filter/pick operators -> one memory
 * sink) into one eKuiper graph rule definition. Any other shape yields
 * structured `FlowDiagnostic` failures; nodes are never silently dropped.
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
 * - Operator values (FS-0075): official eKuiper graph_rule doc
 *   (`guide/rules/graph_rule.html`, built-in operator node types) defines
 *   the filter operator as `{type: "operator", nodeType: "filter",
 *   props: {expr: "<bool expression>"}}` and the pick operator as
 *   `{type: "operator", nodeType: "pick", props: {fields: [...]}}`
 *   where `fields` is an array of field-expression strings.
 *
 * Determinism: same Flow document always yields the same artifact
 * (deterministic runtime IDs, sorted IR input, canonical semantic hash,
 * edge-following chain order). Layout is never read and secrets are never
 * touched: only `metadata.id` and semantic `spec` nodes/edges are
 * consumed, and only `topic`/`expression`/`fields` strings are copied
 * into `props`.
 */

const MEMORY_OPERATION = 'memory';
const FILTER_OPERATION = 'filter';
const PICK_OPERATION = 'pick';

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
 * Compiler-local registry overlay (FS-0075).
 *
 * `filter`/`pick` definitions intentionally carry no `runtimeKind` /
 * `operation` metadata (transforms.ts defers that mapping to "a later
 * compiler ticket"), so the shared `createBuiltinNodeRegistry()` cannot
 * build IR for them yet. This ticket's allowed paths exclude the builtins
 * file, so the compiler supplies the small operator mapping locally:
 * each definition is re-registered with `runtimeKind: 'operator'` plus
 * its eKuiper operator name, and every other definition is passed through
 * untouched. Definitions for later compiler tickets (window, join, ...)
 * therefore still fail IR building with a structured diagnostic instead
 * of being silently dropped.
 */
function createCompilerRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  for (const definition of createBuiltinNodeRegistry().list()) {
    if (
      definition.type === filterDefinition.type &&
      definition.version === filterDefinition.version
    ) {
      registry.register({
        ...definition,
        runtimeKind: 'operator',
        operation: FILTER_OPERATION,
      });
    } else if (
      definition.type === pickDefinition.type &&
      definition.version === pickDefinition.version
    ) {
      registry.register({
        ...definition,
        runtimeKind: 'operator',
        operation: PICK_OPERATION,
      });
    } else {
      registry.register(definition);
    }
  }
  return registry;
}

function readExpression(
  config: Record<string, unknown>,
  nodeId: string,
): { expression: string } | { diagnostic: FlowDiagnostic } {
  const expression: unknown = config.expression;
  if (typeof expression === 'string' && expression.length > 0) {
    return { expression };
  }
  return {
    diagnostic: {
      code: FLOW_REQUIRED_PROPERTY_MISSING,
      severity: 'error',
      message: `Filter node "${nodeId}" requires a non-empty "expression" property.`,
      nodeId,
      propertyPath: 'expression',
    },
  };
}

function toFilterNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const expression = readExpression(irNode.config, irNode.id);
  if ('diagnostic' in expression) {
    return expression;
  }
  return {
    node: {
      type: 'operator',
      nodeType: FILTER_OPERATION,
      props: { expr: expression.expression },
    },
  };
}

/**
 * Read the v1 pick `fields` expression text as an eKuiper `fields` array.
 *
 * The editor stores the projection as one opaque expression string (never
 * parsed by the registry), while eKuiper expects `fields: []string`. The
 * v1 mapping splits the text on commas and trims each entry, dropping
 * empties; a value with no usable field is reported as a missing required
 * property. Nested commas inside function calls are out of scope for v1
 * and must use one field per node or a later explicit mapping ticket.
 */
function readFieldList(
  config: Record<string, unknown>,
  nodeId: string,
): { fields: string[] } | { diagnostic: FlowDiagnostic } {
  const fields: unknown = config.fields;
  if (typeof fields === 'string') {
    const list = fields
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (list.length > 0) {
      return { fields: list };
    }
  }
  return {
    diagnostic: {
      code: FLOW_REQUIRED_PROPERTY_MISSING,
      severity: 'error',
      message: `Pick node "${nodeId}" requires a non-empty "fields" property.`,
      nodeId,
      propertyPath: 'fields',
    },
  };
}

function toPickNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const fields = readFieldList(irNode.config, irNode.id);
  if ('diagnostic' in fields) {
    return fields;
  }
  return {
    node: {
      type: 'operator',
      nodeType: PICK_OPERATION,
      props: { fields: fields.fields },
    },
  };
}

/**
 * Map one IR node to its eKuiper graph node. Any kind/operation pair
 * without an exact mapping yields a structured diagnostic; nodes are
 * never silently dropped.
 */
function toEkuiperNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  if (irNode.kind === 'source' && irNode.operation === MEMORY_OPERATION) {
    return toMemorySourceNode(irNode);
  }
  if (irNode.kind === 'sink' && irNode.operation === MEMORY_OPERATION) {
    return toMemorySinkNode(irNode);
  }
  if (irNode.kind === 'operator' && irNode.operation === FILTER_OPERATION) {
    return toFilterNode(irNode);
  }
  if (irNode.kind === 'operator' && irNode.operation === PICK_OPERATION) {
    return toPickNode(irNode);
  }
  return {
    diagnostic: {
      code: FLOW_UNKNOWN_NODE_TYPE,
      severity: 'error',
      message:
        `Flow node "${irNode.id}" uses operation ` +
        `"${irNode.operation}", which this compiler version cannot map to an eKuiper graph node.`,
      nodeId: irNode.id,
    },
  };
}

/**
 * Runtime ID prefix for one IR node: source/sink kinds keep their
 * established prefixes; operators use their eKuiper operator name so IDs
 * stay readable (`filter_<hash>`, `pick_<hash>`). Only the Flow node ID
 * is hashed, so renames never change the output.
 */
function runtimePrefixFor(irNode: FlowIrNode): string {
  if (irNode.kind === 'source') {
    return SOURCE_KIND_PREFIX;
  }
  if (irNode.kind === 'sink') {
    return SINK_KIND_PREFIX;
  }
  return irNode.operation;
}

/**
 * Order IR nodes by following semantic edges from the single source to
 * the single sink. The walk never consults edge array order for meaning:
 * every visited node except the sink must have exactly one outgoing edge,
 * and every IR node must appear on the resulting path, so branches,
 * merges, cycles, and disconnected nodes all fail with a diagnostic
 * instead of being silently dropped or reordered.
 */
function orderLinearChain(
  sourceId: string,
  sinkId: string,
  irNodes: FlowIrNode[],
  irEdges: FlowIrEdge[],
): { chain: FlowIrNode[] } | { diagnostic: FlowDiagnostic } {
  const byId = new Map(irNodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, FlowIrEdge[]>();
  for (const edge of irEdges) {
    const list = outgoing.get(edge.sourceNodeId) ?? [];
    list.push(edge);
    outgoing.set(edge.sourceNodeId, list);
  }

  const chain: FlowIrNode[] = [];
  const visited = new Set<string>();
  let currentId: string = sourceId;
  for (;;) {
    if (visited.has(currentId)) {
      return {
        diagnostic: {
          code: FLOW_UNKNOWN_NODE_TYPE,
          severity: 'error',
          message: `Flow node "${currentId}" creates a cycle; only a linear source -> sink chain can be compiled.`,
          nodeId: currentId,
        },
      };
    }
    const current = byId.get(currentId);
    if (current === undefined) {
      return {
        diagnostic: {
          code: FLOW_UNKNOWN_NODE_TYPE,
          severity: 'error',
          message: `Flow edge references unknown node "${currentId}".`,
          nodeId: currentId,
        },
      };
    }
    visited.add(currentId);
    chain.push(current);
    if (currentId === sinkId) {
      break;
    }
    const next = outgoing.get(currentId) ?? [];
    if (next.length !== 1 || next[0] === undefined) {
      return {
        diagnostic: {
          code: FLOW_UNKNOWN_NODE_TYPE,
          severity: 'error',
          message:
            `Flow node "${currentId}" is outside the supported linear ` +
            `source -> sink chain shape.`,
          nodeId: currentId,
        },
      };
    }
    currentId = next[0].targetNodeId;
  }

  const extra = irNodes.find((node) => !visited.has(node.id));
  if (extra !== undefined) {
    return {
      diagnostic: {
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message:
          `Flow node "${extra.id}" is outside the supported linear ` +
          `source -> sink chain shape.`,
        nodeId: extra.id,
      },
    };
  }
  return { chain };
}

/**
 * Compile a semantic Flow document into an eKuiper graph-rule deployment
 * artifact. Supported shape: exactly one source and one sink joined by a
 * linear chain of memory/filter/pick nodes in edge order.
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

  const irResult = buildFlowIr(document, createCompilerRegistry());
  if (!irResult.ok) {
    return { ok: false, artifact: undefined, diagnostics: irResult.diagnostics };
  }

  const irNodes = irResult.ir.nodes;
  const sources = irNodes.filter((node) => node.kind === 'source');
  if (sources.length !== 1 || sources[0] === undefined) {
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_NO_SOURCE,
          severity: 'error',
          message: 'Flow must have exactly one source node; a memory source is required.',
        },
      ],
    };
  }
  const sinks = irNodes.filter((node) => node.kind === 'sink');
  if (sinks.length !== 1 || sinks[0] === undefined) {
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_NO_SINK,
          severity: 'error',
          message: 'Flow must have exactly one sink node; a memory sink is required.',
        },
      ],
    };
  }
  const source = sources[0];
  const sink = sinks[0];

  const ordered = orderLinearChain(
    source.id,
    sink.id,
    irNodes,
    irResult.ir.edges,
  );
  if ('diagnostic' in ordered) {
    return { ok: false, artifact: undefined, diagnostics: [ordered.diagnostic] };
  }

  const runtimeNodeMap: Record<string, string> = {};
  const graphNodes: Record<string, EkuiperGraphNode> = {};
  const graphEdges: Record<string, string[]> = {};
  for (const irNode of ordered.chain) {
    const mapped = toEkuiperNode(irNode);
    if ('diagnostic' in mapped) {
      return { ok: false, artifact: undefined, diagnostics: [mapped.diagnostic] };
    }
    const runtimeId = createRuntimeId(runtimePrefixFor(irNode), irNode.id);
    runtimeNodeMap[irNode.id] = runtimeId;
    graphNodes[runtimeId] = mapped.node;
    graphEdges[runtimeId] = [];
  }
  for (let index = 0; index < ordered.chain.length - 1; index += 1) {
    const current = ordered.chain[index];
    const next = ordered.chain[index + 1];
    if (current === undefined || next === undefined) {
      continue;
    }
    graphEdges[runtimeNodeMap[current.id]!] = [runtimeNodeMap[next.id]!];
  }

  const sourceRuntimeId = runtimeNodeMap[source.id]!;
  const graph: EkuiperGraphRule = {
    nodes: graphNodes,
    topo: {
      sources: [sourceRuntimeId],
      edges: graphEdges,
    },
  };

  return {
    ok: true,
    artifact: {
      compilerVersion: FLOW_COMPILER_VERSION,
      semanticHash,
      ruleId,
      ruleDefinition: { graph },
      runtimeNodeMap,
    },
    diagnostics: [],
  };
}
