import type { FlowNodeDefinition } from '../node-definition';

/**
 * Window editor-semantic definition (v1, tumbling-only).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/formatters.ts` OP_TYPE_MAP confirms the eKuiper graph
 *   operator name `window` (displayed as Window), with icon heuristics for
 *   `window`.
 * - `src/lib/ekuiper/functions.ts` EKUIPER_FUNCTIONS.window confirms the
 *   window function family, including `TumblingWindow(ss, 10)` described as
 *   a fixed non-overlapping window. Sliding, session, count, and delay
 *   window variants exist in the catalog but require significantly different
 *   config shapes, so they are out of scope for this v1 definition.
 *
 * Only the confirmed common properties required for one working tumbling
 * window are exposed: a numeric `length` plus a `timeUnit` string
 * (matching the two-argument `TumblingWindow(unit, size)` shape). Both are
 * stored as opaque editor semantics and are never parsed here; compiler
 * mapping (`runtimeKind`/`operation`) is intentionally omitted and lands in
 * a later compiler ticket. No compiler code lives here.
 */
export const windowDefinition: FlowNodeDefinition = {
  type: 'window',
  version: 1,
  displayName: 'Window',
  description: 'Group events into fixed tumbling windows.',
  category: 'streaming',
  icon: 'window',
  accent: 'streaming',
  inputs: [{ id: 'in', label: 'Stream', kind: 'stream' }],
  outputs: [{ id: 'out', label: 'Collection', kind: 'collection' }],
  properties: [
    {
      key: 'length',
      label: 'Length',
      type: 'number',
      required: true,
      description:
        'Tumbling window length in timeUnit units. Stored as editor semantics; compiler mapping to the eKuiper window operator lands later.',
    },
    {
      key: 'timeUnit',
      label: 'Time unit',
      type: 'string',
      required: true,
      description:
        'Time unit for the tumbling window length. Stored as editor semantics; compiler mapping to the eKuiper window operator lands later.',
    },
  ],
};
