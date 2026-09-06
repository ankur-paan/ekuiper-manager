import type { FlowNodeDefinition } from '../node-definition';

/**
 * REST/HTTP sink editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/types.ts` RestSink confirms `rest.url` as the required
 *   endpoint URL plus optional `method`, `bodyType`, `headers`, `timeout`,
 *   and `insecureSkipVerify`.
 * - `src/lib/ekuiper/rule-designer.ts` KNOWN_FIELDS.rest confirms `url` as
 *   the required key, `method` with method options, `bodyType` with
 *   json/text/form options, and `headers` as a JSON object.
 *
 * Only the confirmed URL/method/body/header concepts are exposed. Advanced
 * properties (`timeout`, `insecureSkipVerify`) are intentionally omitted
 * until a later ticket. Compiler mapping (`runtimeKind`/`operation`) is
 * intentionally omitted and lands in a later compiler ticket. No compiler
 * code lives here.
 */
export const restSinkDefinition: FlowNodeDefinition = {
  type: 'rest-sink',
  version: 1,
  displayName: 'REST Sink',
  description: 'Send results to an HTTP endpoint.',
  category: 'sink',
  icon: 'rest',
  accent: 'sink',
  subtitleKey: 'url',
  inputs: [{ id: 'in', label: 'Stream', kind: 'stream' }],
  outputs: [],
  properties: [
    {
      key: 'url',
      label: 'URL',
      type: 'string',
      required: true,
      description:
        'HTTP endpoint URL to send results to. Compiler mapping to the eKuiper REST sink lands later.',
    },
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      description: 'HTTP method used for sink requests.',
      options: [
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'PATCH', value: 'PATCH' },
        { label: 'GET', value: 'GET' },
        { label: 'DELETE', value: 'DELETE' },
      ],
    },
    {
      key: 'bodyType',
      label: 'Body type',
      type: 'select',
      description: 'Encoding used for the request body.',
      options: [
        { label: 'json', value: 'json' },
        { label: 'text', value: 'text' },
        { label: 'form', value: 'form' },
      ],
    },
    {
      key: 'headers',
      label: 'Headers',
      type: 'json',
      description: 'Extra HTTP headers sent with each request.',
    },
  ],
};

/**
 * Log sink editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/types.ts` LogSink confirms an optional empty `log`
 *   object with no required keys.
 * - `src/lib/ekuiper/rule-designer.ts` KNOWN_FIELDS.log confirms the log
 *   sink exposes no sink-specific fields.
 *
 * No properties are exposed because no required log-sink field is confirmed
 * in the current sink behavior. Compiler mapping (`runtimeKind`/`operation`)
 * is intentionally omitted and lands in a later compiler ticket. No compiler
 * code lives here.
 */
export const logSinkDefinition: FlowNodeDefinition = {
  type: 'log-sink',
  version: 1,
  displayName: 'Log Sink',
  description: 'Write result rows to the eKuiper log.',
  category: 'sink',
  icon: 'log',
  accent: 'sink',
  inputs: [{ id: 'in', label: 'Stream', kind: 'stream' }],
  outputs: [],
  properties: [],
};
