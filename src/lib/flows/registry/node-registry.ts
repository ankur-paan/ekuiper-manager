import type { FlowNodeDefinition } from './node-definition';

function registryKey(type: string, version: number): string {
  return `${type}@${version}`;
}

function cloneDefinition(definition: FlowNodeDefinition): FlowNodeDefinition {
  return structuredClone(definition);
}

/**
 * In-memory registry for Flow node definitions.
 *
 * Identity is the (type, version) pair. Registering a duplicate identity
 * throws an internal configuration error. Stored definitions are cloned on
 * both registration and retrieval so callers can never mutate registry
 * state through a held reference.
 */
export class NodeRegistry {
  private readonly definitions = new Map<string, FlowNodeDefinition>();

  register(definition: FlowNodeDefinition): void {
    const key = registryKey(definition.type, definition.version);
    if (this.definitions.has(key)) {
      throw new Error(
        `Duplicate node definition registration: type="${definition.type}" version=${definition.version}.`,
      );
    }
    this.definitions.set(key, cloneDefinition(definition));
  }

  get(type: string, version: number): FlowNodeDefinition | undefined {
    const stored = this.definitions.get(registryKey(type, version));
    return stored === undefined ? undefined : cloneDefinition(stored);
  }

  has(type: string, version: number): boolean {
    return this.definitions.has(registryKey(type, version));
  }

  list(): FlowNodeDefinition[] {
    return [...this.definitions.values()]
      .map((definition) => cloneDefinition(definition))
      .sort((a, b) => {
        if (a.type < b.type) {
          return -1;
        }
        if (a.type > b.type) {
          return 1;
        }
        return a.version - b.version;
      });
  }
}
