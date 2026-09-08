import type { FlowPropertyDefinition } from '@ekuiper-manager/flow-sdk';

/**
 * Properties every eKuiper sink accepts, exposed on each sink node (AC-D003).
 *
 * eKuiper documents `omitIfEmpty` as a common sink property: when true the sink skips a
 * trigger whose result set is empty. Without it a tumbling window over an idle machine still
 * emits an empty batch downstream every interval - measured live, where an idle window sent
 * `[]` to the sink on every tick before any reading arrived.
 *
 * Default is left unset rather than false so the compiled rule keeps eKuiper's own default
 * and existing flows behave exactly as before; the property only appears in the compiled
 * output when a user turns it on.
 */
export const OMIT_IF_EMPTY_PROPERTY: FlowPropertyDefinition = {
  key: 'omitIfEmpty',
  label: 'Skip empty results',
  type: 'boolean',
  required: false,
  description:
    'Do not send anything when a trigger produces no rows. Useful for windowed flows: an idle machine otherwise emits an empty batch every window.',
};
