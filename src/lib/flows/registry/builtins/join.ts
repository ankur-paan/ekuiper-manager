import type { FlowNodeDefinition } from '../node-definition';

/**
 * Join streaming editor-semantic definition (v1, restricted static-port form).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the eKuiper graph
 *   operator name `join` (displayed as Join), with icon heuristics for
 *   `join`/`lookup`.
 * - `src/lib/ekuiper/types.ts` Table/KIND (`scan` | `lookup`) and
 *   `src/components/resources/sql-resource.tsx` (`KIND="lookup"`
 *   placeholder) confirm lookup tables exist as a joinable right-side
 *   concept.
 * - `src/lib/ekuiper/rule-designer.ts` QueryDraft confirms filter, project,
 *   group-by, and sort expression concepts, but no join condition property
 *   shape; the exact eKuiper graph `join` node property shape was not
 *   confirmed in the audited metadata.
 *
 * Because no engine join property shape is confirmed, this definition
 * advertises no engine operator and uses a documented restricted form: two
 * stable inputs (`left` for the driving event stream, `right` for the
 * second stream or lookup table) and one stream output. The `left` port
 * uses kind `stream`; the `right` port uses kind `any` so the existing
 * generic port compatibility accepts both `stream` and `table` upstreams
 * without requiring a new `FlowPortKind` (a `table` output connects only
 * to `table` or `any`). Join-specific topology rules (both inputs
 * connected, collection rejected on both sides, table rejected on the
 * left) live in `src/lib/flows/validation/join-validation.ts`, which can
 * reject what the permissive `any` port admits. The required opaque
 * `condition` expression describes the join predicate; it is stored as
 * text and never parsed here. Branch identity is carried only by the
 * stable string port IDs `left`/`right`: visual array position is never
 * semantic identity, and `FlowEdge` references ports by string
 * `sourcePortId`/`targetPortId` only. Compiler mapping
 * (`runtimeKind`/`operation`) is intentionally omitted and lands in a
 * later compiler ticket; no SQL join compiler lives here and nothing is
 * executed in Manager or the browser.
 */
export const joinDefinition: FlowNodeDefinition = {
  type: 'join',
  version: 1,
  displayName: 'Join',
  description: 'Combine left stream events with right stream or lookup table rows.',
  category: 'streaming',
  inputs: [
    { id: 'left', label: 'Left', kind: 'stream' },
    { id: 'right', label: 'Right', kind: 'any' },
  ],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'condition',
      label: 'Condition',
      type: 'expression',
      required: true,
      description:
        'Join predicate relating left and right inputs. Stored as opaque text and never parsed here; compiler mapping to the eKuiper join operator lands later.',
    },
  ],
};
