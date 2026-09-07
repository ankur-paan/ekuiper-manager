import type { FlowNodeDefinition } from '../node-definition';

/**
 * Stream source editor-semantic definition (v1, FS-0153).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/client.ts` (`listStreams` -> `GET /streams`) and the
 *   audited `public/ekuiper-openapi.json` (eKuiper 2.4.1, `listStreams`)
 *   confirm Manager already lists configured stream names; the FS-0147
 *   `streams` dynamic option provider serves exactly those names to the
 *   inspector, so the referenced name is never typed blind.
 * - `src/lib/ekuiper/types.ts` `StreamDetail` confirms a stream carries a
 *   connector `type` (for example memory, mqtt) alongside its name.
 *
 * Engine source form (official eKuiper graph_rule doc, "Source Node":
 * a source node "can be a stream or table", the `sourceType` property is
 * `stream` or `table`, `sourceName` names the stream/table, and "please
 * make sure the nodeType is the same as the type of the stream/table"):
 * `{type: "source", nodeType: "<connector>", props: {sourceType: "stream",
 * sourceName: "<name>"}}`. The audited `RuleGraph` schema in
 * `public/ekuiper-openapi.json` proves the envelope (node entries carry
 * free-form `props`, so `sourceType`/`sourceName` are schema-valid) while
 * the graph_rule doc proves the `sourceType`/`sourceName` semantics.
 *
 * The definition therefore exposes the referenced name as a required
 * `select` fed by the `streams` provider plus the required `connector`
 * naming the stream's source connector TYPE (copied verbatim into the
 * eKuiper graph `nodeType`); the compiler never guesses either value.
 * Output kind is `stream`. Compiler mapping (`runtimeKind`/`operation`)
 * is intentionally omitted and lives in the compiler overlay, exactly
 * like the join/mqtt/sink definitions; no compiler code lives here and
 * nothing is executed in Manager or the browser.
 */
export const streamSourceDefinition: FlowNodeDefinition = {
  type: 'stream-source',
  version: 1,
  displayName: 'Stream Source',
  description: 'Read events from an existing configured eKuiper stream.',
  category: 'source',
  accent: 'source',
  subtitleKey: 'stream',
  inputs: [],
  outputs: [{ id: 'out', label: 'Stream', kind: 'stream' }],
  properties: [
    {
      key: 'stream',
      label: 'Stream',
      type: 'select',
      required: true,
      description:
        'Name of an existing eKuiper stream. Loaded live from the selected node; compiles to the eKuiper graph source `sourceName` prop.',
      optionsProvider: 'streams',
    },
    {
      key: 'connector',
      label: 'Connector',
      type: 'string',
      required: true,
      description:
        'Source connector TYPE of the stream (for example memory or mqtt). Must match the stream definition; copied verbatim into the eKuiper graph `nodeType` and never guessed here.',
    },
  ],
};

/**
 * Table source editor-semantic definition (v1, FS-0153).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/client.ts` stream/table listing plus the audited
 *   `public/ekuiper-openapi.json` (eKuiper 2.4.1, `listTables`) confirm
 *   Manager already lists configured tables; the FS-0147 `tables` dynamic
 *   option provider serves exactly those names to the inspector.
 * - `src/lib/ekuiper/types.ts` `TableDetail` confirms a table carries a
 *   connector `type` and a scan/lookup `kind`.
 * - `src/lib/flows/validation/join-validation.ts` already models a
 *   table-kind upstream, so declaring the output kind as `table` keeps
 *   port-kind fidelity for join handling instead of masquerading as a
 *   stream.
 *
 * Engine source form: same official graph_rule "Source Node" contract as
 * the stream source, with `sourceType: "table"`
 * (`{type: "source", nodeType: "<connector>", props: {sourceType: "table",
 * sourceName: "<name>"}}`; the doc notes only lookup tables may feed a
 * join). The definition therefore exposes the referenced name as a
 * required `select` fed by the `tables` provider plus the required
 * `connector` naming the table's source connector TYPE. Output kind is
 * `table`. Compiler mapping (`runtimeKind`/`operation`) is intentionally
 * omitted and lives in the compiler overlay; no compiler code lives here
 * and nothing is executed in Manager or the browser.
 */
export const tableSourceDefinition: FlowNodeDefinition = {
  type: 'table-source',
  version: 1,
  displayName: 'Table Source',
  description: 'Read rows from an existing configured eKuiper table.',
  category: 'source',
  accent: 'source',
  subtitleKey: 'table',
  inputs: [],
  outputs: [{ id: 'out', label: 'Table', kind: 'table' }],
  properties: [
    {
      key: 'table',
      label: 'Table',
      type: 'select',
      required: true,
      description:
        'Name of an existing eKuiper table. Loaded live from the selected node; compiles to the eKuiper graph source `sourceName` prop.',
      optionsProvider: 'tables',
    },
    {
      key: 'connector',
      label: 'Connector',
      type: 'string',
      required: true,
      description:
        'Source connector TYPE of the table (for example memory or redis). Must match the table definition; copied verbatim into the eKuiper graph `nodeType` and never guessed here.',
    },
  ],
};
