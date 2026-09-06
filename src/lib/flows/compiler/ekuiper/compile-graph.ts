import { hashFlowSemantic } from '../../hashing/flow-hash';
import { buildFlowIr } from '../../ir/build-flow-ir';
import type { FlowIrEdge, FlowIrNode } from '../../ir/flow-ir';
import type { FlowDocument } from '../../model/flow-document';
import {
  FLOW_NO_SINK,
  FLOW_NO_SOURCE,
  FLOW_PORT_TARGET_MISSING,
  FLOW_REQUIRED_PROPERTY_MISSING,
  FLOW_UNKNOWN_NODE_TYPE,
  type FlowDiagnostic,
} from '../../model/diagnostic';
import { createBuiltinNodeRegistry } from '../../registry/builtin-registry';
import {
  filterDefinition,
  pickDefinition,
} from '../../registry/builtins/transforms';
import {
  aggregateDefinition,
  groupByDefinition,
} from '../../registry/builtins/aggregate';
import { windowDefinition } from '../../registry/builtins/window';
import {
  sortDefinition,
  switchDefinition,
} from '../../registry/builtins/routing';
import { joinDefinition } from '../../registry/builtins/join';
import { NodeRegistry } from '../../registry/node-registry';
import { createRuntimeId } from '../runtime-id';
import {
  FLOW_COMPILER_VERSION,
  type CompileFlowResult,
} from '../types';
import type { EkuiperGraphNode } from './graph-types';

/**
 * Minimal eKuiper graph-rule compiler (FS-0074, extended by
 * FS-0075/FS-0076/FS-0077).
 *
 * Scope: compiles a validated Flow DAG into one eKuiper graph rule
 * definition. Supported nodes: one or more memory sources, the
 * filter/pick/window/aggfunc/groupby/orderby/switch/join operators, and
 * one or more memory sinks. Linear operators carry exactly one input and
 * one output; switch fans out by stable branch port; join fans in from
 * explicit left/right ports. Any other shape yields structured
 * `FlowDiagnostic` failures; nodes are never silently dropped.
 *
 * Audited contract sources:
 * - Envelope (`nodes`/`topo`, node `type`/`nodeType`/`props`, topology
 *   `sources`/`edges`, graph rule carried under `graph` with a required
 *   rule `id`) is proven by `public/ekuiper-openapi.json` (eKuiper 2.4.1)
 *   schemas `RuleGraph`, `RuleTopology`, `Rule`, `RuleCreateRequest`
 *   (see `graph-types.ts`). The audited `RuleTopology.edges` value schema
 *   is an unconstrained array (`items: {}`), so the switch two-dimensional
 *   edge arrays below are schema-valid; only the FS-0073 TypeScript
 *   narrowing (`Record<string, string[]>`) predates them (see follow-up
 *   note on the local edge type).
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
 * - Operator values (FS-0076): the same official graph_rule doc defines
 *   the window operator as `{type: "operator", nodeType: "window",
 *   props: {type: "<windowtype>", unit: "<unit>", size: <int>,
 *   interval: <int>}}` (e.g. `{type: "hoppingwindow", unit: "ss",
 *   size: 10, interval: 5}`), the aggregate operator as
 *   `{type: "operator", nodeType: "aggfunc", props: {expr: "<aggregate
 *   expression>"}}` (e.g. `{expr: "count(*)"}`), and the grouping
 *   operator as `{type: "operator", nodeType: "groupby",
 *   props: {dimensions: [...]}}` (e.g. `{dimensions:
 *   ["device1.humidity"]}`). The v1 window editor exposes tumbling-only
 *   config (`length` + `timeUnit`), so the compiler emits
 *   `type: "tumblingwindow"` with `unit`/`size` copied from the v1 config
 *   and no `interval` (the eKuiper window runtime defaults an unset
 *   interval to the window length, which is exactly tumbling semantics).
 * - Operator values (FS-0077): verified against eKuiper v2.4.1 engine
 *   source (same version as the audited OpenAPI) plus the official
 *   graph_rule doc:
 *   - `internal/topo/graph/node.go` defines `Switch{cases []string,
 *     stopAtFirstMatch bool}`, `Orderby{sorts: [{field string,
 *     desc bool}]}`, and `Join{from string, joins: [{name, type, on}]}`.
 *     The sort graph nodeType is `orderby` (matched in
 *     `internal/topo/planner/planner_graph.go`); the bare word `order`
 *     seen in repository display metadata is the SQL-plan operator name,
 *     not a graph nodeType, and is never emitted here.
 *   - `internal/topo/node/switch_node.go`: the switch node allocates
 *     exactly `len(cases)` outlets and `GetEmitter(i)` indexes them
 *     without a bounds check, so `cases[i]` corresponds positionally to
 *     the `edges[switchNode][i]` branch-target array; unmatched messages
 *     are dropped (the engine has no default-branch concept).
 *   - `internal/topo/planner/planner_graph.go`: only switch nodes may
 *     originate multi-dimensional edge arrays (any other node found in a
 *     second-dimension position fails planning); sinks must have NO entry
 *     in `topo.edges` (`"sink %s has edge"`); every source and operator
 *     must have an entry; join `from`/`joins[].name` name stream emitters
 *     (graph source-node keys for inline sources, which is what this
 *     compiler emits), and more than one non-lookup input to a join is
 *     rejected (`"does not allow multiple stream inputs"`).
 *
 * Determinism: same Flow document always yields the same artifact
 * (deterministic runtime IDs, sorted IR input, canonical semantic hash,
 * port-grouped edges in canonical port order with sorted targets).
 * Edge-array insertion order never carries meaning: switch branches are
 * grouped by stable `sourcePortId` and every target list is sorted.
 * Layout is never read and secrets are never touched: only `metadata.id`
 * and semantic `spec` nodes/edges are consumed, and only whitelisted
 * config values are copied into `props`.
 */

const MEMORY_OPERATION = 'memory';
const FILTER_OPERATION = 'filter';
const PICK_OPERATION = 'pick';
const WINDOW_OPERATION = 'window';
const AGGFUNC_OPERATION = 'aggfunc';
const GROUPBY_OPERATION = 'groupby';
const SWITCH_OPERATION = 'switch';
const SORT_OPERATION = 'orderby';
const JOIN_OPERATION = 'join';

const SOURCE_KIND_PREFIX = 'source';
const SINK_KIND_PREFIX = 'sink';

/**
 * Canonical switch branch ports in eKuiper `cases`/edge-group position
 * order. Branch identity is ONLY these stable string port IDs: the Flow
 * edge array order is never consulted (see `groupSwitchBranches`).
 */
const SWITCH_BRANCH_PORTS = ['branch-1', 'branch-2'] as const;
const SWITCH_DEFAULT_PORT = 'default';

const JOIN_LEFT_PORT = 'left';
const JOIN_RIGHT_PORT = 'right';

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
 * Compiler-local registry overlay (FS-0075, extended by FS-0076/FS-0077).
 *
 * `filter`/`pick`/`window`/`aggregate`/`group-by`/`switch`/`sort`/`join`
 * definitions intentionally carry no `runtimeKind` / `operation` metadata
 * (transforms.ts, window.ts, aggregate.ts, routing.ts, and join.ts defer
 * that mapping to "a later compiler ticket"), so the shared
 * `createBuiltinNodeRegistry()` cannot build IR for them yet. This
 * ticket's allowed paths exclude the builtins files, so the compiler
 * supplies the small operator mapping locally: each definition is
 * re-registered with `runtimeKind: 'operator'` plus its eKuiper operator
 * name (`filter`, `pick`, `window`, `aggfunc` for the `aggregate` Flow
 * type, `groupby` for the `group-by` Flow type, `switch` for the `switch`
 * Flow type, `orderby` for the `sort` Flow type, `join` for the `join`
 * Flow type), and every other definition is passed through untouched.
 * Definitions for later compiler tickets (mqtt, ...) therefore still fail
 * IR building with a structured diagnostic instead of being silently
 * dropped.
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
    } else if (
      definition.type === windowDefinition.type &&
      definition.version === windowDefinition.version
    ) {
      registry.register({
        ...definition,
        runtimeKind: 'operator',
        operation: WINDOW_OPERATION,
      });
    } else if (
      definition.type === aggregateDefinition.type &&
      definition.version === aggregateDefinition.version
    ) {
      registry.register({
        ...definition,
        runtimeKind: 'operator',
        operation: AGGFUNC_OPERATION,
      });
    } else if (
      definition.type === groupByDefinition.type &&
      definition.version === groupByDefinition.version
    ) {
      registry.register({
        ...definition,
        runtimeKind: 'operator',
        operation: GROUPBY_OPERATION,
      });
    } else if (
      definition.type === switchDefinition.type &&
      definition.version === switchDefinition.version
    ) {
      registry.register({
        ...definition,
        runtimeKind: 'operator',
        operation: SWITCH_OPERATION,
      });
    } else if (
      definition.type === sortDefinition.type &&
      definition.version === sortDefinition.version
    ) {
      registry.register({
        ...definition,
        runtimeKind: 'operator',
        operation: SORT_OPERATION,
      });
    } else if (
      definition.type === joinDefinition.type &&
      definition.version === joinDefinition.version
    ) {
      registry.register({
        ...definition,
        runtimeKind: 'operator',
        operation: JOIN_OPERATION,
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
 * Read the v1 tumbling-window editor config.
 *
 * The v1 `window` definition exposes only `length` (number) and
 * `timeUnit` (string); both are required. `length` must be a positive
 * integer because eKuiper documents the graph `size` prop as an int, and
 * `timeUnit` is copied verbatim into the graph `unit` prop (official
 * values are documented in the eKuiper windows reference, e.g. `ss`).
 * No other window modes or advanced fields are supported here.
 */
function readWindowConfig(
  config: Record<string, unknown>,
  nodeId: string,
): { length: number; timeUnit: string } | { diagnostic: FlowDiagnostic } {
  const length: unknown = config.length;
  if (typeof length !== 'number' || !Number.isInteger(length) || length <= 0) {
    return {
      diagnostic: {
        code: FLOW_REQUIRED_PROPERTY_MISSING,
        severity: 'error',
        message: `Window node "${nodeId}" requires a positive integer "length" property.`,
        nodeId,
        propertyPath: 'length',
      },
    };
  }
  const timeUnit: unknown = config.timeUnit;
  if (typeof timeUnit !== 'string' || timeUnit.length === 0) {
    return {
      diagnostic: {
        code: FLOW_REQUIRED_PROPERTY_MISSING,
        severity: 'error',
        message: `Window node "${nodeId}" requires a non-empty "timeUnit" property.`,
        nodeId,
        propertyPath: 'timeUnit',
      },
    };
  }
  return { length, timeUnit };
}

function toWindowNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const window = readWindowConfig(irNode.config, irNode.id);
  if ('diagnostic' in window) {
    return window;
  }
  return {
    node: {
      type: 'operator',
      nodeType: WINDOW_OPERATION,
      props: {
        type: 'tumblingwindow',
        unit: window.timeUnit,
        size: window.length,
      },
    },
  };
}

/**
 * Read the v1 aggregate `fields` expression text as an eKuiper `expr`
 * string. The editor stores the aggregate call as one opaque expression
 * (e.g. `avg(power) AS mean_power`), matching the official `aggfunc`
 * single-`expr` prop shape; it is never parsed here.
 */
function readAggregateExpression(
  config: Record<string, unknown>,
  nodeId: string,
): { expression: string } | { diagnostic: FlowDiagnostic } {
  const fields: unknown = config.fields;
  if (typeof fields === 'string' && fields.length > 0) {
    return { expression: fields };
  }
  return {
    diagnostic: {
      code: FLOW_REQUIRED_PROPERTY_MISSING,
      severity: 'error',
      message: `Aggregate node "${nodeId}" requires a non-empty "fields" property.`,
      nodeId,
      propertyPath: 'fields',
    },
  };
}

function toAggregateNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const expression = readAggregateExpression(irNode.config, irNode.id);
  if ('diagnostic' in expression) {
    return expression;
  }
  return {
    node: {
      type: 'operator',
      nodeType: AGGFUNC_OPERATION,
      props: { expr: expression.expression },
    },
  };
}

/**
 * Read the v1 group-by `keys` expression text as an eKuiper `dimensions`
 * array. The editor stores grouping keys as one opaque expression string
 * (never parsed by the registry), while eKuiper expects
 * `dimensions: []string`. The v1 mapping splits the text on commas and
 * trims each entry, dropping empties; a value with no usable key is
 * reported as a missing required property.
 */
function readDimensionList(
  config: Record<string, unknown>,
  nodeId: string,
): { dimensions: string[] } | { diagnostic: FlowDiagnostic } {
  const keys: unknown = config.keys;
  if (typeof keys === 'string') {
    const list = keys
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (list.length > 0) {
      return { dimensions: list };
    }
  }
  return {
    diagnostic: {
      code: FLOW_REQUIRED_PROPERTY_MISSING,
      severity: 'error',
      message: `Group By node "${nodeId}" requires a non-empty "keys" property.`,
      nodeId,
      propertyPath: 'keys',
    },
  };
}

function toGroupByNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const dimensions = readDimensionList(irNode.config, irNode.id);
  if ('diagnostic' in dimensions) {
    return dimensions;
  }
  return {
    node: {
      type: 'operator',
      nodeType: GROUPBY_OPERATION,
      props: { dimensions: dimensions.dimensions },
    },
  };
}

/**
 * Read the v1 switch `cases` expression text as the eKuiper `cases` array.
 *
 * The v1 `switch` definition exposes one opaque `cases` expression
 * covering `branch-1` and `branch-2` in output order (the `default` output
 * needs no condition). The v1 mapping splits the text on commas and trims
 * each entry, dropping empties, exactly like the v1 pick `fields` and
 * group-by `keys` mappings; nested commas inside function calls are
 * likewise out of scope for v1. The result must hold exactly two
 * conditions so that `cases[0]`/`cases[1]` align positionally with the
 * `branch-1`/`branch-2` edge groups; anything else is a missing required
 * property, never a silent guess.
 */
function readSwitchCases(
  config: Record<string, unknown>,
  nodeId: string,
): { cases: [string, string] } | { diagnostic: FlowDiagnostic } {
  const cases: unknown = config.cases;
  if (typeof cases === 'string') {
    const list = cases
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (list.length === SWITCH_BRANCH_PORTS.length) {
      const first = list[0];
      const second = list[1];
      if (first !== undefined && second !== undefined) {
        return { cases: [first, second] };
      }
    }
  }
  return {
    diagnostic: {
      code: FLOW_REQUIRED_PROPERTY_MISSING,
      severity: 'error',
      message:
        `Switch node "${nodeId}" requires a "cases" property with exactly ` +
        `two comma-separated branch conditions for branch-1 and branch-2 in output order.`,
      nodeId,
      propertyPath: 'cases',
    },
  };
}

function toSwitchNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const cases = readSwitchCases(irNode.config, irNode.id);
  if ('diagnostic' in cases) {
    return cases;
  }
  return {
    node: {
      type: 'operator',
      nodeType: SWITCH_OPERATION,
      props: {
        cases: [...cases.cases],
        // The v1 definition routes each event to ONE of the branches
        // ("Route events to one of two branches or a default output"),
        // which is exactly first-match routing; the v1 editor exposes no
        // stopAtFirstMatch control, so the compiler pins the documented
        // engine default explicitly instead of leaving it implicit.
        stopAtFirstMatch: true,
      },
    },
  };
}

interface SortCondition {
  field: string;
  desc: boolean;
}

/**
 * Read the v1 sort `orderBy` expression text as an eKuiper `sorts` array.
 *
 * The v1 `sort` definition exposes one opaque `orderBy` expression (the
 * SQL `ORDER BY` clause text confirmed by
 * `src/lib/ekuiper/rule-designer.ts`). The v1 mapping splits the text on
 * commas for multi-key sorts (nested commas out of scope, as with pick
 * fields); each entry takes an optional trailing `ASC`/`DESC` keyword
 * (case-insensitive) and defaults to ascending, matching SQL `ORDER BY`
 * semantics. The engine struct is `graph.Orderby{Sorts: [{field,
 * desc}]}` (`internal/topo/graph/node.go`), so each entry compiles to
 * `{field, desc}` — never the bare word `order`, which is only the
 * SQL-plan operator name.
 */
function readSortConditions(
  config: Record<string, unknown>,
  nodeId: string,
): { sorts: SortCondition[] } | { diagnostic: FlowDiagnostic } {
  const orderBy: unknown = config.orderBy;
  if (typeof orderBy === 'string') {
    const sorts: SortCondition[] = [];
    for (const entry of orderBy.split(',')) {
      const trimmed = entry.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const directionMatch = /^(.*?)\s+(asc|desc)$/i.exec(trimmed);
      if (directionMatch !== null) {
        const field = (directionMatch[1] ?? '').trim();
        if (field.length === 0) {
          break;
        }
        sorts.push({
          field,
          desc: directionMatch[2]?.toLowerCase() === 'desc',
        });
      } else {
        sorts.push({ field: trimmed, desc: false });
      }
    }
    if (sorts.length > 0) {
      return { sorts };
    }
  }
  return {
    diagnostic: {
      code: FLOW_REQUIRED_PROPERTY_MISSING,
      severity: 'error',
      message: `Sort node "${nodeId}" requires a non-empty "orderBy" property.`,
      nodeId,
      propertyPath: 'orderBy',
    },
  };
}

function toSortNode(
  irNode: FlowIrNode,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const sorts = readSortConditions(irNode.config, irNode.id);
  if ('diagnostic' in sorts) {
    return sorts;
  }
  return {
    node: {
      type: 'operator',
      nodeType: SORT_OPERATION,
      props: {
        sorts: sorts.sorts.map((entry) => ({
          field: entry.field,
          desc: entry.desc,
        })),
      },
    },
  };
}

/**
 * Context for mapping IR nodes whose eKuiper props reference other graph
 * nodes. Join `from`/`joins[].name` name the upstream graph nodes, so the
 * mapper needs the Flow-edge grouping plus the resolved runtime IDs.
 */
interface JoinMappingContext {
  edgesByTarget: Map<string, FlowIrEdge[]>;
  runtimeNodeMap: Record<string, string>;
}

function readJoinCondition(
  config: Record<string, unknown>,
  nodeId: string,
): { condition: string } | { diagnostic: FlowDiagnostic } {
  const condition: unknown = config.condition;
  if (typeof condition === 'string' && condition.length > 0) {
    return { condition };
  }
  return {
    diagnostic: {
      code: FLOW_REQUIRED_PROPERTY_MISSING,
      severity: 'error',
      message: `Join node "${nodeId}" requires a non-empty "condition" property.`,
      nodeId,
      propertyPath: 'condition',
    },
  };
}

/**
 * Map one join IR node to its eKuiper graph node.
 *
 * The engine parses `from`/`joins[].name` as stream names
 * (`parseJoinAst` in `internal/topo/planner/planner_graph.go` builds
 * `SELECT * FROM <from> <type> JOIN <name> ON <on>`); for the inline
 * sources this compiler emits, the stream name IS the graph node key, so
 * `from` is the runtime ID feeding the stable `left` port and
 * `joins[0].name` is the runtime ID feeding the stable `right` port.
 * Edge-array position never decides identity: only `targetPortId` does.
 * The v1 editor exposes no join-type control, so the compiler pins the
 * SQL default `inner` explicitly. A two-stream join additionally needs an
 * upstream window at deploy time (the engine rejects multiple non-lookup
 * inputs); the compiler preserves the identities and leaves that engine
 * validation authoritative instead of rewriting topology.
 */
function toJoinNode(
  irNode: FlowIrNode,
  context: JoinMappingContext,
): { node: EkuiperGraphNode } | { diagnostic: FlowDiagnostic } {
  const condition = readJoinCondition(irNode.config, irNode.id);
  if ('diagnostic' in condition) {
    return condition;
  }
  const incoming = context.edgesByTarget.get(irNode.id) ?? [];
  const left = incoming.filter((edge) => edge.targetPortId === JOIN_LEFT_PORT);
  const right = incoming.filter(
    (edge) => edge.targetPortId === JOIN_RIGHT_PORT,
  );
  if (left.length === 0) {
    return {
      diagnostic: {
        code: FLOW_PORT_TARGET_MISSING,
        severity: 'error',
        message: `Flow join node "${irNode.id}" has no edge targeting required input port "left".`,
        nodeId: irNode.id,
      },
    };
  }
  if (right.length === 0) {
    return {
      diagnostic: {
        code: FLOW_PORT_TARGET_MISSING,
        severity: 'error',
        message: `Flow join node "${irNode.id}" has no edge targeting required input port "right".`,
        nodeId: irNode.id,
      },
    };
  }
  if (left.length !== 1 || right.length !== 1) {
    return {
      diagnostic: {
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message:
          `Flow join node "${irNode.id}" has more than one edge on a ` +
          `single input port; this compiler version maps exactly one edge per join input.`,
        nodeId: irNode.id,
      },
    };
  }
  const leftEdge = left[0];
  const rightEdge = right[0];
  if (leftEdge === undefined || rightEdge === undefined) {
    return {
      diagnostic: {
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message: `Flow edge into join node "${irNode.id}" references an unknown node.`,
        nodeId: irNode.id,
      },
    };
  }
  const from = context.runtimeNodeMap[leftEdge.sourceNodeId];
  const name = context.runtimeNodeMap[rightEdge.sourceNodeId];
  if (from === undefined || name === undefined) {
    return {
      diagnostic: {
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message: `Flow edge into join node "${irNode.id}" references an unknown node.`,
        nodeId: irNode.id,
      },
    };
  }
  return {
    node: {
      type: 'operator',
      nodeType: JOIN_OPERATION,
      props: {
        from,
        joins: [{ name, type: 'inner', on: condition.condition }],
      },
    },
  };
}

/**
 * Map one IR node to its eKuiper graph node. Any kind/operation pair
 * without an exact mapping yields a structured diagnostic; nodes are
 * never silently dropped. Join mapping needs edge context (see
 * `JoinMappingContext`) because its props name upstream graph nodes.
 */
function toEkuiperNode(
  irNode: FlowIrNode,
  context: JoinMappingContext,
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
  if (irNode.kind === 'operator' && irNode.operation === WINDOW_OPERATION) {
    return toWindowNode(irNode);
  }
  if (irNode.kind === 'operator' && irNode.operation === AGGFUNC_OPERATION) {
    return toAggregateNode(irNode);
  }
  if (irNode.kind === 'operator' && irNode.operation === GROUPBY_OPERATION) {
    return toGroupByNode(irNode);
  }
  if (irNode.kind === 'operator' && irNode.operation === SWITCH_OPERATION) {
    return toSwitchNode(irNode);
  }
  if (irNode.kind === 'operator' && irNode.operation === SORT_OPERATION) {
    return toSortNode(irNode);
  }
  if (irNode.kind === 'operator' && irNode.operation === JOIN_OPERATION) {
    return toJoinNode(irNode, context);
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
 * stay readable (`filter_<hash>`, `pick_<hash>`, `window_<hash>`,
 * `aggfunc_<hash>`, `groupby_<hash>`, `switch_<hash>`,
 * `orderby_<hash>`, `join_<hash>`). Only the Flow node ID
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
 * Grouped semantic edges for one IR node, derived without consulting
 * edge-array order for meaning: outgoing edges are grouped by stable
 * `sourcePortId` (switch branches), incoming edges are kept as a list.
 */
interface NodeEdgeGroups {
  outgoingByPort: Map<string, FlowIrEdge[]>;
  incoming: FlowIrEdge[];
}

function groupNodeEdges(
  irNodes: FlowIrNode[],
  irEdges: FlowIrEdge[],
): { byId: Map<string, FlowIrNode>; groups: Map<string, NodeEdgeGroups> } {
  const byId = new Map(irNodes.map((node) => [node.id, node]));
  const groups = new Map<string, NodeEdgeGroups>();
  for (const node of irNodes) {
    groups.set(node.id, { outgoingByPort: new Map(), incoming: [] });
  }
  for (const edge of irEdges) {
    const source = groups.get(edge.sourceNodeId);
    if (source !== undefined) {
      const list = source.outgoingByPort.get(edge.sourcePortId) ?? [];
      list.push(edge);
      source.outgoingByPort.set(edge.sourcePortId, list);
    }
    const target = groups.get(edge.targetNodeId);
    if (target !== undefined) {
      target.incoming.push(edge);
    }
  }
  return { byId, groups };
}

function outgoingCount(group: NodeEdgeGroups): number {
  let count = 0;
  for (const list of group.outgoingByPort.values()) {
    count += list.length;
  }
  return count;
}

/**
 * Validate that the IR graph has the DAG shape this compiler version can
 * map: every edge references known nodes, every non-source has at least
 * one input, every non-sink has at least one output, linear operators
 * carry exactly one input and one output, switch carries exactly one
 * input with branch outputs grouped by stable port ID, and join carries
 * exactly one `left` and one `right` input with one output. Only switch
 * nodes may fan out; any other multi-output shape fails with a diagnostic
 * instead of being silently dropped or reordered. Nodes unreachable from
 * any source (disconnected islands or sourceless cycles) fail as well.
 * Checks run in sorted Flow-node-ID order so the first reported
 * diagnostic is deterministic for the same document.
 */
function validateDagShape(
  irNodes: FlowIrNode[],
  irEdges: FlowIrEdge[],
): { ok: true } | { ok: false; diagnostic: FlowDiagnostic } {
  const sortedEdges = [...irEdges].sort((a, b) => {
    const keysA = [
      a.sourceNodeId,
      a.targetNodeId,
      a.sourcePortId,
      a.targetPortId,
    ];
    const keysB = [
      b.sourceNodeId,
      b.targetNodeId,
      b.sourcePortId,
      b.targetPortId,
    ];
    for (let index = 0; index < keysA.length; index += 1) {
      if (keysA[index]! < keysB[index]!) {
        return -1;
      }
      if (keysA[index]! > keysB[index]!) {
        return 1;
      }
    }
    return 0;
  });
  const { byId, groups } = groupNodeEdges(irNodes, sortedEdges);

  for (const edge of sortedEdges) {
    if (!byId.has(edge.sourceNodeId) || !byId.has(edge.targetNodeId)) {
      const unknownId = !byId.has(edge.sourceNodeId)
        ? edge.sourceNodeId
        : edge.targetNodeId;
      return {
        ok: false,
        diagnostic: {
          code: FLOW_UNKNOWN_NODE_TYPE,
          severity: 'error',
          message: `Flow edge references unknown node "${unknownId}".`,
          nodeId: unknownId,
        },
      };
    }
  }

  const sortedNodes = [...irNodes].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const node of sortedNodes) {
    const group = groups.get(node.id);
    if (group === undefined) {
      continue;
    }
    if (node.kind !== 'source' && group.incoming.length === 0) {
      return {
        ok: false,
        diagnostic: {
          code: FLOW_UNKNOWN_NODE_TYPE,
          severity: 'error',
          message:
            `Flow node "${node.id}" has no input edge; every non-source ` +
            `node must be fed by at least one edge.`,
          nodeId: node.id,
        },
      };
    }
    if (node.kind !== 'sink' && outgoingCount(group) === 0) {
      return {
        ok: false,
        diagnostic: {
          code: FLOW_UNKNOWN_NODE_TYPE,
          severity: 'error',
          message:
            `Flow node "${node.id}" has no output edge; every non-sink ` +
            `node must feed at least one edge.`,
          nodeId: node.id,
        },
      };
    }
    if (
      node.kind === 'operator' &&
      node.operation !== SWITCH_OPERATION &&
      node.operation !== JOIN_OPERATION
    ) {
      if (group.incoming.length !== 1 || outgoingCount(group) !== 1) {
        return {
          ok: false,
          diagnostic: {
            code: FLOW_UNKNOWN_NODE_TYPE,
            severity: 'error',
            message:
              `Flow node "${node.id}" is outside the supported shape: ` +
              `only switch nodes may fan out and only join nodes may fan ` +
              `in, so this operator needs exactly one input and one output.`,
            nodeId: node.id,
          },
        };
      }
    }
    if (node.kind === 'operator' && node.operation === SWITCH_OPERATION) {
      if (group.incoming.length !== 1) {
        return {
          ok: false,
          diagnostic: {
            code: FLOW_UNKNOWN_NODE_TYPE,
            severity: 'error',
            message: `Flow switch node "${node.id}" needs exactly one input edge.`,
            nodeId: node.id,
          },
        };
      }
      for (const portId of group.outgoingByPort.keys()) {
        if (
          portId !== SWITCH_BRANCH_PORTS[0] &&
          portId !== SWITCH_BRANCH_PORTS[1] &&
          portId !== SWITCH_DEFAULT_PORT
        ) {
          return {
            ok: false,
            diagnostic: {
              code: FLOW_UNKNOWN_NODE_TYPE,
              severity: 'error',
              message:
                `Flow switch node "${node.id}" has an edge on unknown ` +
                `output port "${portId}"; v1 switch outputs are ` +
                `"branch-1", "branch-2", and "default".`,
              nodeId: node.id,
            },
          };
        }
      }
      if (group.outgoingByPort.has(SWITCH_DEFAULT_PORT)) {
        return {
          ok: false,
          diagnostic: {
            code: FLOW_UNKNOWN_NODE_TYPE,
            severity: 'error',
            message:
              `Flow switch node "${node.id}" feeds its "default" output, ` +
              `which has no eKuiper representation in this compiler ` +
              `version: the engine evaluates "cases" in order and drops ` +
              `unmatched events, so only "branch-1"/"branch-2" can be ` +
              `compiled.`,
            nodeId: node.id,
          },
        };
      }
    }
    if (node.kind === 'operator' && node.operation === JOIN_OPERATION) {
      const left = group.incoming.filter(
        (edge) => edge.targetPortId === JOIN_LEFT_PORT,
      );
      const right = group.incoming.filter(
        (edge) => edge.targetPortId === JOIN_RIGHT_PORT,
      );
      if (left.length !== 1 || right.length !== 1) {
        return {
          ok: false,
          diagnostic: {
            code: FLOW_UNKNOWN_NODE_TYPE,
            severity: 'error',
            message:
              `Flow join node "${node.id}" needs exactly one edge on ` +
              `each of the "left" and "right" input ports.`,
            nodeId: node.id,
          },
        };
      }
      if (outgoingCount(group) !== 1) {
        return {
          ok: false,
          diagnostic: {
            code: FLOW_UNKNOWN_NODE_TYPE,
            severity: 'error',
            message: `Flow join node "${node.id}" needs exactly one output edge.`,
            nodeId: node.id,
          },
        };
      }
    }
  }

  const reachable = new Set<string>();
  const stack = sortedNodes
    .filter((node) => node.kind === 'source')
    .map((node) => node.id)
    .sort();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (reachable.has(current)) {
      continue;
    }
    reachable.add(current);
    const targets: string[] = [];
    for (const list of groups.get(current)?.outgoingByPort.values() ?? []) {
      for (const edge of list) {
        targets.push(edge.targetNodeId);
      }
    }
    targets.sort();
    for (const target of targets) {
      if (!reachable.has(target)) {
        stack.push(target);
      }
    }
  }
  const island = sortedNodes.find((node) => !reachable.has(node.id));
  if (island !== undefined) {
    return {
      ok: false,
      diagnostic: {
        code: FLOW_UNKNOWN_NODE_TYPE,
        severity: 'error',
        message:
          `Flow node "${island.id}" is not reachable from any source; ` +
          `only source-fed graphs can be compiled.`,
        nodeId: island.id,
      },
    };
  }
  return { ok: true };
}

/**
 * Group one switch node's outgoing edges into eKuiper branch-target
 * arrays in canonical port order (`branch-1`, then `branch-2`). Targets
 * inside each branch are sorted by Flow node ID so the result never
 * depends on edge-array insertion order. The `default` port is rejected
 * by `validateDagShape` before this runs; reaching it here is an internal
 * invariant violation.
 */
function groupSwitchBranches(
  irNode: FlowIrNode,
  irEdges: FlowIrEdge[],
  runtimeNodeMap: Record<string, string>,
): string[][] {
  const branchTargets: string[][] = [];
  for (const portId of SWITCH_BRANCH_PORTS) {
    const targets = irEdges
      .filter(
        (edge) =>
          edge.sourceNodeId === irNode.id && edge.sourcePortId === portId,
      )
      .map((edge) => edge.targetNodeId)
      .sort();
    const runtimes: string[] = [];
    for (const target of targets) {
      const runtime = runtimeNodeMap[target];
      if (runtime === undefined) {
        throw new Error(
          `groupSwitchBranches: missing runtime ID for node "${target}"`,
        );
      }
      if (!runtimes.includes(runtime)) {
        runtimes.push(runtime);
      }
    }
    branchTargets.push(runtimes);
  }
  return branchTargets;
}

/**
 * eKuiper graph topology whose edge values admit the switch
 * two-dimensional branch arrays alongside the flat downstream lists used
 * by every other node. The audited `RuleTopology` OpenAPI schema permits
 * both (`edges` values are unconstrained arrays); the FS-0073
 * `EkuiperGraphTopo` narrowing predates switch support and is intentionally
 * left untouched here (its file is outside this ticket's allowed paths),
 * so switch graphs are typed locally. Follow-up: extend the FS-0073
 * envelope for switch branch edges.
 */
interface CompiledGraphTopo {
  sources: string[];
  edges: Record<string, Array<string | string[]>>;
}

interface CompiledGraphRule {
  nodes: Record<string, EkuiperGraphNode>;
  topo: CompiledGraphTopo;
}

/**
 * Compile a semantic Flow document into an eKuiper graph-rule deployment
 * artifact. Supported shape: one or more memory sources feeding a DAG of
 * memory/filter/pick/window/aggfunc/groupby/orderby/switch/join nodes
 * into one or more memory sinks, validated by `validateDagShape`.
 *
 * Every user-correctable failure is returned as a structured diagnostic
 * (never a thrown string); only an empty Flow metadata ID or a missing
 * runtime ID after validation throws, as internal invariant violations.
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

  const irNodes = [...irResult.ir.nodes].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const irEdges = irResult.ir.edges;

  const sources = irNodes.filter((node) => node.kind === 'source');
  if (sources.length === 0) {
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_NO_SOURCE,
          severity: 'error',
          message: 'Flow must have at least one source node; a memory source is required.',
        },
      ],
    };
  }
  const sinks = irNodes.filter((node) => node.kind === 'sink');
  if (sinks.length === 0) {
    return {
      ok: false,
      artifact: undefined,
      diagnostics: [
        {
          code: FLOW_NO_SINK,
          severity: 'error',
          message: 'Flow must have at least one sink node; a memory sink is required.',
        },
      ],
    };
  }

  const shaped = validateDagShape(irNodes, irEdges);
  if (!shaped.ok) {
    return { ok: false, artifact: undefined, diagnostics: [shaped.diagnostic] };
  }

  const runtimeNodeMap: Record<string, string> = {};
  for (const irNode of irNodes) {
    runtimeNodeMap[irNode.id] = createRuntimeId(
      runtimePrefixFor(irNode),
      irNode.id,
    );
  }

  const edgesByTarget = new Map<string, FlowIrEdge[]>();
  for (const edge of irEdges) {
    const list = edgesByTarget.get(edge.targetNodeId) ?? [];
    list.push(edge);
    edgesByTarget.set(edge.targetNodeId, list);
  }
  const joinContext: JoinMappingContext = { edgesByTarget, runtimeNodeMap };

  const graphNodes: Record<string, EkuiperGraphNode> = {};
  for (const irNode of irNodes) {
    const mapped = toEkuiperNode(irNode, joinContext);
    if ('diagnostic' in mapped) {
      return { ok: false, artifact: undefined, diagnostics: [mapped.diagnostic] };
    }
    graphNodes[runtimeNodeMap[irNode.id]!] = mapped.node;
  }

  const sinkRuntimeIds = new Set(sinks.map((sink) => runtimeNodeMap[sink.id]!));
  const graphEdges: Record<string, Array<string | string[]>> = {};
  for (const irNode of irNodes) {
    const runtimeId = runtimeNodeMap[irNode.id]!;
    if (sinkRuntimeIds.has(runtimeId)) {
      // Sinks carry no entry: the engine rejects ANY edges entry for a
      // sink (`"sink %s has edge"` in planner_graph.go), even an empty
      // one, so emitting `"sinkId": []` would fail official validation.
      continue;
    }
    if (irNode.kind === 'operator' && irNode.operation === SWITCH_OPERATION) {
      graphEdges[runtimeId] = groupSwitchBranches(
        irNode,
        irEdges,
        runtimeNodeMap,
      );
      continue;
    }
    const targets = irEdges
      .filter((edge) => edge.sourceNodeId === irNode.id)
      .map((edge) => edge.targetNodeId)
      .sort();
    const runtimes: string[] = [];
    for (const target of targets) {
      const runtime = runtimeNodeMap[target];
      if (runtime === undefined) {
        return {
          ok: false,
          artifact: undefined,
          diagnostics: [
            {
              code: FLOW_UNKNOWN_NODE_TYPE,
              severity: 'error',
              message: `Flow edge references unknown node "${target}".`,
              nodeId: target,
            },
          ],
        };
      }
      if (!runtimes.includes(runtime)) {
        runtimes.push(runtime);
      }
    }
    graphEdges[runtimeId] = runtimes;
  }

  const sourceRuntimeIds = sources
    .map((source) => runtimeNodeMap[source.id]!)
    .sort();
  const graph: CompiledGraphRule = {
    nodes: graphNodes,
    topo: {
      sources: sourceRuntimeIds,
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
