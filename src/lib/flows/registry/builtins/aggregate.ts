import type { FlowNodeDefinition } from '../node-definition';

/**
 * Aggregate editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the eKuiper graph
 *   operator name `agg` (displayed as Aggregate), with icon heuristics for
 *   `agg`/`group`.
 * - `src/lib/ekuiper/functions.ts` EKUIPER_FUNCTIONS.aggregate confirms the
 *   aggregate function family (`avg`, `sum`, `count`, `max`, `min`,
 *   `collect`, and others) used inside aggregate field expressions.
 * - `src/lib/ekuiper/rule-designer.ts` QueryDraft confirms the aggregate
 *   fields concept as the SQL `SELECT` fields text, and
 *   `src/lib/__tests__/rule-designer.test.ts` confirms the combined shape
 *   (`SELECT deviceId, avg(power) ... GROUP BY ...`).
 *
 * The Flow node keeps the engine-neutral type name `aggregate` (matching the
 * function-category id in `functions.ts`) and exposes only the confirmed
 * editor-semantic `fields` property. The value is stored as opaque text and
 * is never parsed here; compiler mapping (`runtimeKind`/`operation`) is
 * intentionally omitted and lands in a later compiler ticket. No compiler
 * code lives here.
 */
export const aggregateDefinition: FlowNodeDefinition = {
  type: 'aggregate',
  version: 1,
  displayName: 'Aggregate',
  description: 'Compute aggregate values over windowed collections.',
  category: 'streaming',
  inputs: [{ id: 'in', label: 'Collection', kind: 'collection' }],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'fields',
      label: 'Fields',
      type: 'expression',
      required: true,
      description:
        'Aggregate field expressions evaluated per windowed group. Stored as opaque text; compiler mapping to the eKuiper agg operator lands later.',
    },
  ],
};

/**
 * Group By editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/rule-designer.ts` QueryDraft confirms the group-by
 *   concept as the SQL `GROUP BY` keys text (`buildSql`/`parseSimpleSql`),
 *   and `src/lib/__tests__/rule-designer.test.ts` confirms the combined
 *   windowed grouping shape (`... TUMBLINGWINDOW(ss, 10) ... GROUP BY
 *   deviceId ...`).
 * - `src/lib/ekuiper/formatters.ts` icon heuristics confirm grouping is part
 *   of the aggregate operator family (`agg`/`group`), so no separate engine
 *   graph operator name is advertised here.
 *
 * Grouping operates on windowed collections and preserves collection-ness
 * for a downstream aggregate, so the existing `FlowPortKind` values already
 * represent it: collection input and collection output. No new semantic port
 * kind is required and none is introduced here. Only the confirmed
 * editor-semantic `keys` property is exposed. The value is stored as opaque
 * text and is never parsed here; compiler mapping (`runtimeKind`/`operation`)
 * is intentionally omitted and lands in a later compiler ticket. No compiler
 * code lives here.
 */
export const groupByDefinition: FlowNodeDefinition = {
  type: 'group-by',
  version: 1,
  displayName: 'Group By',
  description: 'Group windowed events by key before aggregation.',
  category: 'streaming',
  inputs: [{ id: 'in', label: 'Collection', kind: 'collection' }],
  outputs: [{ id: 'out', label: 'Collection', kind: 'collection' }],
  properties: [
    {
      key: 'keys',
      label: 'Keys',
      type: 'expression',
      required: true,
      description:
        'Group-by key expressions partitioning each window. Stored as opaque text; compiler mapping to the eKuiper agg dimensions lands later.',
    },
  ],
};
