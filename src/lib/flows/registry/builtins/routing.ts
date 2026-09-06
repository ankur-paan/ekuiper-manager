import type { FlowNodeDefinition } from '../node-definition';

/**
 * Switch routing editor-semantic definition (v1, restricted static-branch form).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the sort-adjacent
 *   eKuiper graph operator name `order` (displayed as Sort), but contains no
 *   `switch`/`case`/`choice` operator entry and no `op_switch_*` node-id
 *   handling.
 * - `src/lib/ekuiper/rule-designer.ts` QueryDraft confirms filter (`WHERE`)
 *   and sort (`ORDER BY`) expression concepts, but no multi-branch routing
 *   expression shape.
 * - The only `switch` match in `rule-designer.ts` is an unrelated boolean
 *   form-control heuristic (`/bool|switch|checkbox/`), not an engine graph
 *   operator.
 *
 * Because no engine switch operator shape is confirmed, this definition
 * advertises no engine operator and uses a documented restricted form: one
 * stream input and exactly three stable stream outputs (`branch-1`,
 * `branch-2`, `default`). The required opaque `cases` expression describes
 * the branch conditions for `branch-1`/`branch-2`; `default` catches the
 * remainder and needs no condition. Branch identity is carried only by these
 * stable string port IDs: visual array position is never semantic identity,
 * and `FlowEdge` references ports by string `sourcePortId`/`targetPortId`
 * only. Compiler mapping (`runtimeKind`/`operation`) is intentionally omitted
 * and lands in a later compiler ticket, which must preserve branch identity
 * via these stable port IDs. No compiler code lives here.
 */
export const switchDefinition: FlowNodeDefinition = {
  type: 'switch',
  version: 1,
  displayName: 'Switch',
  description: 'Route events to one of two branches or a default output.',
  category: 'routing',
  icon: 'switch',
  accent: 'routing',
  subtitleKey: 'cases',
  inputs: [{ id: 'in', label: 'Stream', kind: 'stream' }],
  outputs: [
    { id: 'branch-1', label: 'Branch 1', kind: 'stream' },
    { id: 'branch-2', label: 'Branch 2', kind: 'stream' },
    { id: 'default', label: 'Default', kind: 'stream' },
  ],
  properties: [
    {
      key: 'cases',
      label: 'Cases',
      type: 'expression',
      required: true,
      description:
        'Branch conditions for branch-1 and branch-2 in output order. Stored as opaque text; the default output needs no condition. Compiler mapping lands later and must preserve branch identity via stable port IDs.',
    },
  ],
};

/**
 * Sort routing editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the eKuiper graph
 *   operator name `order` (displayed as Sort).
 * - `src/lib/ekuiper/rule-designer.ts` QueryDraft confirms the sort concept
 *   as the SQL `ORDER BY` clause text, and
 *   `src/lib/__tests__/rule-designer.test.ts` confirms the combined shape
 *   (`... ORDER BY mean_power DESC ...`).
 *
 * Live-engine correction (FS-0144, eKuiper 2.4.1): feeding a raw source
 * row stream directly into sort is rejected with
 * `input type mismatch, expect collection, got row`. Like `aggfunc` and
 * `groupby`, `orderby` accepts ONLY collection input, so a window must
 * precede it (source -> window -> sort). The input port is therefore kind
 * `collection` and the output stays `stream`. Only the confirmed
 * editor-semantic `orderBy` property is exposed. The value is stored as
 * opaque text and is never parsed here; compiler mapping
 * (`runtimeKind`/`operation`) is intentionally omitted and lands in a
 * later compiler ticket. No compiler code lives here.
 */
export const sortDefinition: FlowNodeDefinition = {
  type: 'sort',
  version: 1,
  displayName: 'Sort',
  description: 'Sort events by an order expression.',
  category: 'routing',
  icon: 'sort',
  accent: 'routing',
  subtitleKey: 'orderBy',
  inputs: [{ id: 'in', label: 'Collection', kind: 'collection' }],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'orderBy',
      label: 'Order By',
      type: 'expression',
      required: true,
      description:
        'Sort key expression evaluated per event. Stored as opaque text; compiler mapping to the eKuiper order operator lands later.',
    },
  ],
};
