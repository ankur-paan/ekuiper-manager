import type { FlowNodeDefinition } from '../node-definition';

/**
 * Join streaming editor-semantic definition (v1, single-collection-input form).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the eKuiper graph
 *   operator name `join` (displayed as Join), with icon heuristics for
 *   `join`/`lookup`.
 * - `src/lib/ekuiper/types.ts` Table/KIND (`scan` | `lookup`) and
 *   `src/components/resources/sql-resource.tsx` (`KIND="lookup"`
 *   placeholder) confirm lookup tables exist as a joinable concept.
 * - `src/lib/ekuiper/rule-designer.ts` QueryDraft confirms filter, project,
 *   group-by, and sort expression concepts, but no join condition property
 *   shape; the exact eKuiper graph `join` node property shape was not
 *   confirmed in the audited metadata.
 * - `public/ekuiper-openapi.json` (eKuiper 2.4.1) proves the graph envelope
 *   (`RuleGraph` nodes/topo, `RuleTopology` sources/edges) with free-form
 *   node `props`; engine join prop semantics below are measured, not
 *   schema-proven.
 *
 * Live-engine correction (FS-0151, eKuiper 2.4.1, measured via
 * `POST /rules/validate`):
 * - leftSource -> join plus rightSource -> window -> join (one side
 *   windowed) is rejected `422 join node ... does not allow multiple
 *   stream inputs`.
 * - leftSource -> window plus rightSource -> SAME window, window -> join
 *   validates `200 {"sources":[...],"valid":true}`.
 * So eKuiper's join takes ONE collection input: both streams converge
 * through a shared window, and the joined stream identities are carried by
 * the join props (`from` and `joins[].name`), NOT by separate input ports.
 * The FS-0060 two-port (`left`/`right`) model could not produce a
 * deployable graph and is replaced here: one stable input (`in`, kind
 * `collection`) and one stream output. A direct stream (or table) upstream
 * is rejected by `src/lib/flows/validation/join-validation.ts` with an
 * existing diagnostic code; no `FlowPortKind` is widened and no new
 * diagnostic code is introduced. The required `from` and `joinName`
 * strings name the joined streams and compile verbatim to the eKuiper
 * `from` and `joins[0].name` props; the required opaque `condition`
 * expression compiles verbatim to `joins[0].on`. All three are stored as
 * text and never parsed here. The join type stays pinned to `inner` in the
 * compiler (the SQL default); no join-type control is exposed. Compiler
 * mapping (`runtimeKind`/`operation`) is intentionally omitted and lives in
 * the compiler overlay; no SQL join compiler lives here and nothing is
 * executed in Manager or the browser.
 */
export const joinDefinition: FlowNodeDefinition = {
  type: 'join',
  version: 1,
  displayName: 'Join',
  description: 'Combine two windowed streams identified by config.',
  category: 'streaming',
  icon: 'join',
  accent: 'streaming',
  subtitleKey: 'from',
  inputs: [{ id: 'in', label: 'Collection', kind: 'collection' }],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'from',
      label: 'From stream',
      type: 'string',
      required: true,
      description:
        'Left stream identity for the eKuiper join `from` prop. Stored as opaque text and copied verbatim by the compiler; never parsed here.',
    },
    {
      key: 'joinName',
      label: 'Join stream',
      type: 'string',
      required: true,
      description:
        'Right stream identity for the eKuiper join `joins[0].name` prop. Stored as opaque text and copied verbatim by the compiler; never parsed here.',
    },
    {
      key: 'condition',
      label: 'Condition',
      type: 'expression',
      required: true,
      description:
        'Join predicate for the eKuiper join `joins[0].on` prop. Stored as opaque text and never parsed here.',
    },
  ],
};
