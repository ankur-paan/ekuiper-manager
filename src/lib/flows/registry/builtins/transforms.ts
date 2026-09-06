import type { FlowNodeDefinition } from '../node-definition';

/**
 * Filter transform editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the eKuiper graph
 *   operator name `filter` and the `op_filter_*` node-id prefix, with icon
 *   heuristics for `filter`/`where`.
 * - `src/lib/ekuiper/rule-designer.ts` QueryDraft confirms the filter
 *   expression concept as the SQL `WHERE` clause text.
 *
 * Only the confirmed editor-semantic `expression` property is exposed. The
 * expression is stored as opaque text and is never parsed here; compiler
 * mapping (`runtimeKind`/`operation`) is intentionally omitted and lands in
 * a later compiler ticket. No compiler code lives here.
 */
export const filterDefinition: FlowNodeDefinition = {
  type: 'filter',
  version: 1,
  displayName: 'Filter',
  description: 'Keep only events matching an expression.',
  category: 'transform',
  inputs: [{ id: 'in', label: 'Stream', kind: 'stream' }],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'expression',
      label: 'Expression',
      type: 'expression',
      required: true,
      description:
        'Filter expression evaluated per event. Stored as opaque text; compiler mapping to the eKuiper filter operator lands later.',
    },
  ],
};

/**
 * Pick transform editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the eKuiper graph
 *   operator name `project` (displayed as Transform), with icon heuristics
 *   for `project`/`select`.
 * - `src/lib/ekuiper/rule-designer.ts` QueryDraft confirms the projection
 *   concept as the SQL `SELECT` fields text.
 *
 * The Flow node keeps the engine-neutral type name `pick` and presents the
 * project/select semantics through a single `fields` expression property.
 * The value is stored as opaque text and is never parsed here; compiler
 * mapping (`runtimeKind`/`operation`) is intentionally omitted and lands in
 * a later compiler ticket. No compiler code lives here.
 */
export const pickDefinition: FlowNodeDefinition = {
  type: 'pick',
  version: 1,
  displayName: 'Pick',
  description: 'Select output fields from each event.',
  category: 'transform',
  inputs: [{ id: 'in', label: 'Stream', kind: 'stream' }],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'fields',
      label: 'Fields',
      type: 'expression',
      required: true,
      description:
        'Projection expression listing the output fields. Stored as opaque text; compiler mapping to the eKuiper project operator lands later.',
    },
  ],
};
