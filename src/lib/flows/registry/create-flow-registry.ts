import type { FlowExtensionPackage } from '../extensions/types';
import { createBuiltinNodeRegistry } from './builtin-registry';
import type { FlowNodeDefinition } from './node-definition';
import { NodeRegistry } from './node-registry';

/**
 * Options for {@link createFlowRegistry} (FS-0114).
 *
 * Extension packages are the already-validated output of the FS-0113 local
 * loader (`FlowExtensionPackage` per FS-0111). This factory performs no
 * filesystem access, no dynamic import/require/eval, and no remote fetch;
 * it only merges declarative definitions into a registry.
 */
export interface CreateFlowRegistryOptions {
  /**
   * Validated extension packages to merge after built-ins, in array order.
   * When omitted (or empty) the result equals the built-in registry.
   */
  extensionPackages?: FlowExtensionPackage[];
}

/**
 * Returns true when plain JSON-compatible data contains a function value.
 *
 * Declarative extension definitions are data-only (see `EXTENSION_SPEC.md`
 * section 4: no executable browser JavaScript). The FS-0112 validator
 * already rejects function values; this is a defence-in-depth guard so the
 * registry factory never stores or returns a React component hook even if
 * it is handed an unvalidated object.
 */
function containsFunctionValue(value: unknown): boolean {
  if (typeof value === 'function') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsFunctionValue(entry));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).some((entry) =>
      containsFunctionValue(entry),
    );
  }
  return false;
}

/**
 * Create a combined Flow node registry: built-ins plus validated extension
 * definitions (FS-0114).
 *
 * Each call returns a fresh, isolated {@link NodeRegistry} pre-registered
 * with the built-in definitions (via `createBuiltinNodeRegistry`), then
 * merges every node descriptor from `options.extensionPackages` in package
 * and node order.
 *
 * Rules:
 *
 * - a duplicate `(type, version)` colliding with a built-in or with another
 *   extension definition is rejected with a deterministic `Error`; an
 *   extension can never silently override a built-in (or another extension);
 * - extension definitions are registered as plain data only: no React
 *   component hook is attached, and a function-valued definition is
 *   rejected instead of being stored;
 * - output order stays deterministic via `NodeRegistry.list()` (sorted by
 *   type then version);
 * - the factory never executes extension content and never touches the
 *   filesystem.
 *
 * @throws When an extension descriptor collides on `(type, version)` or
 * carries an unsupported function value. The message is deterministic for
 * the same input.
 */
export function createFlowRegistry(
  options: CreateFlowRegistryOptions = {},
): NodeRegistry {
  const registry = createBuiltinNodeRegistry();
  const packages = options.extensionPackages ?? [];
  for (const extensionPackage of packages) {
    const extensionId = extensionPackage?.manifest?.id ?? '<unknown-extension>';
    const nodes: FlowNodeDefinition[] = extensionPackage?.nodes ?? [];
    for (const definition of nodes) {
      if (containsFunctionValue(definition)) {
        throw new Error(
          `Extension node definition "${extensionId}" type="${definition?.type}" version=${definition?.version} contains an unsupported executable value. ` +
            `Extension definitions are declarative data only and receive no React component hooks.`,
        );
      }
      if (registry.has(definition.type, definition.version)) {
        throw new Error(
          `Extension node definition collision: type="${definition.type}" version=${definition.version} from extension "${extensionId}" collides with an existing definition. ` +
            `Extension definitions cannot override built-ins or each other.`,
        );
      }
      registry.register(definition);
    }
  }
  return registry;
}
