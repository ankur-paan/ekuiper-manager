import { NodeRegistry } from './node-registry';

/**
 * Creates a new, empty built-in node definition registry.
 *
 * Each call returns an isolated {@link NodeRegistry} instance; no mutable
 * global singleton is shared. No node definitions are registered yet;
 * built-in definitions are added by later catalog tickets.
 */
export function createBuiltinNodeRegistry(): NodeRegistry {
  return new NodeRegistry();
}
