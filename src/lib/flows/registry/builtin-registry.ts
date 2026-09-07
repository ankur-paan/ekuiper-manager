import { memorySinkDefinition, memorySourceDefinition } from './builtins/memory';
import { mqttSinkDefinition, mqttSourceDefinition } from './builtins/mqtt';
import { logSinkDefinition, restSinkDefinition } from './builtins/sinks';
import { funcDefinition } from './builtins/script';
import { filterDefinition, pickDefinition } from './builtins/transforms';
import { aggregateDefinition, groupByDefinition } from './builtins/aggregate';
import { windowDefinition } from './builtins/window';
import { sortDefinition, switchDefinition } from './builtins/routing';
import { joinDefinition } from './builtins/join';
import {
  streamSourceDefinition,
  tableSourceDefinition,
} from './builtins/stream-source';
import { NodeRegistry } from './node-registry';

/**
 * Creates a new, isolated built-in node definition registry.
 *
 * Each call returns a fresh {@link NodeRegistry} instance pre-registered
 * with the v1 memory and MQTT source/sink plus REST and log sink plus
 * filter, pick, and func transform plus tumbling window plus aggregate and
 * group-by plus switch and sort routing plus join editor-semantic plus
 * stream and table reference source definitions; no mutable global
 * singleton is shared. Compiler mapping for these definitions lands in a
 * later ticket, so no compiler code lives here.
 */
export function createBuiltinNodeRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.register(memorySourceDefinition);
  registry.register(memorySinkDefinition);
  registry.register(mqttSourceDefinition);
  registry.register(mqttSinkDefinition);
  registry.register(restSinkDefinition);
  registry.register(logSinkDefinition);
  registry.register(filterDefinition);
  registry.register(pickDefinition);
  registry.register(funcDefinition);
  registry.register(windowDefinition);
  registry.register(aggregateDefinition);
  registry.register(groupByDefinition);
  registry.register(switchDefinition);
  registry.register(sortDefinition);
  registry.register(joinDefinition);
  registry.register(streamSourceDefinition);
  registry.register(tableSourceDefinition);
  return registry;
}
