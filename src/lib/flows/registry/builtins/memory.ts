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
 * Exact eKuiper graph-source property shape for a memory source node was not
 * confirmed in the audited metadata, so this definition exposes only the
 * confirmed editor-semantic `topic` property. Compiler mapping
 * (`runtimeKind`/`operation`) is intentionally omitted and lands in a later
 * compiler ticket. No compiler code lives here.
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
        'In-memory topic to subscribe to. Compiler mapping to the eKuiper graph source lands later.',
    },
  ],
};

/**
 * Memory sink editor-semantic definition (v1).
 *
 * `topic` is confirmed required by both `MemorySink` in
 * `src/lib/ekuiper/types.ts` and `KNOWN_FIELDS.memory` in
 * `src/lib/ekuiper/rule-designer.ts`. Only this confirmed property is
 * exposed; compiler mapping (`runtimeKind`/`operation`) is intentionally
 * omitted and lands in a later compiler ticket. No compiler code lives here.
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
        'In-memory topic to publish to. Compiler mapping to the eKuiper memory sink lands later.',
    },
  ],
};
