import type { FlowNodeDefinition } from '../node-definition';

/**
 * Memory source editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/types.ts` MemorySink confirms `memory.topic` as the
 *   required in-memory topic key for the memory sink.
 * - `src/lib/ekuiper/rule-designer.ts` KNOWN_FIELDS.memory confirms `topic`
 *   required for the memory sink.
 * - `src/lib/ekuiper/types.ts` StreamOptions confirms memory streams use a
 *   datasource name (`DATASOURCE`) for the in-memory topic.
 *
 * Compiler mapping (FS-0074):
 * - `operation` is the eKuiper graph source `nodeType` (`memory`).
 * - The eKuiper graph source `props` share stream-definition properties
 *   (official eKuiper graph_rule doc), so the editor-semantic `topic`
 *   compiles to the `datasource` prop (official eKuiper memory source doc:
 *   `WITH (DATASOURCE="<topic>", ... TYPE="memory")`). The exact props
 *   mapping lives in the compiler, not here; no compiler code lives here.
 */
export const memorySourceDefinition: FlowNodeDefinition = {
  type: 'memory-source',
  version: 1,
  displayName: 'Memory Source',
  description: 'Read events from an in-memory topic.',
  category: 'source',
  inputs: [],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'topic',
      label: 'Topic',
      type: 'string',
      required: true,
      description:
        'In-memory topic to subscribe to. Compiles to the eKuiper graph source `datasource` prop.',
    },
  ],
  runtimeKind: 'source',
  operation: 'memory',
};

/**
 * Memory sink editor-semantic definition (v1).
 *
 * `topic` is confirmed required by both `MemorySink` in
 * `src/lib/ekuiper/types.ts` and `KNOWN_FIELDS.memory` in
 * `src/lib/ekuiper/rule-designer.ts`. Only this confirmed property is
 * exposed.
 *
 * Compiler mapping (FS-0074):
 * - `operation` is the eKuiper graph sink `nodeType` (`memory`).
 * - The editor-semantic `topic` compiles to the `topic` prop (official
 *   eKuiper memory sink doc: `{"memory": {"topic": "<topic>"}}`). The exact
 *   props mapping lives in the compiler, not here; no compiler code lives
 *   here.
 */
export const memorySinkDefinition: FlowNodeDefinition = {
  type: 'memory-sink',
  version: 1,
  displayName: 'Memory Sink',
  description: 'Publish results to an in-memory topic.',
  category: 'sink',
  inputs: [{ id: 'in', label: 'Stream', kind: 'stream' }],
  outputs: [],
  properties: [
    {
      key: 'topic',
      label: 'Topic',
      type: 'string',
      required: true,
      description:
        'In-memory topic to publish to. Compiles to the eKuiper memory sink `topic` prop.',
    },
  ],
  runtimeKind: 'sink',
  operation: 'memory',
};
