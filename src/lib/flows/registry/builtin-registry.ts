import { memorySinkDefinition, memorySourceDefinition } from './builtins/memory';
import { NodeRegistry } from './node-registry';

/**
 * Creates a new, isolated built-in node definition registry.
 *
 * Each call returns a fresh {@link NodeRegistry} instance pre-registered
 * with the v1 memory source and memory sink editor-semantic definitions;
 * no mutable global singleton is shared. Compiler mapping for these
 * definitions lands in a later ticket, so no compiler code lives here.
 */
export function createBuiltinNodeRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.register(memorySourceDefinition);
  registry.register(memorySinkDefinition);
  return registry;
}
