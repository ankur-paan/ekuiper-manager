import type { FlowNodeDefinition } from '../node-definition';

/**
 * MQTT source editor-semantic definition (v1).
 *
 * Audited repository metadata:
 * - `src/lib/ekuiper/types.ts` StreamOptions confirms MQTT streams carry a
 *   datasource name (`DATASOURCE`) identifying the subscribed topic.
 * - `src/lib/ekuiper/types.ts` MqttSourceConfig confirms non-secret
 *   connection fields, including `connectionSelector` for a shared
 *   connection and `servers` for inline broker addresses.
 * - `src/lib/ekuiper/rule-designer.ts` KNOWN_FIELDS.mqtt confirms `topic`
 *   as the required topic key and `connectionSelector` as the supported
 *   shared-connection reference.
 * - Shared connections are managed through the existing `/connections`
 *   Manager API (`src/lib/ekuiper/client.ts`), where secret values live in
 *   eKuiper and are never read back into an editable form
 *   (`src/app/connections/page.tsx`).
 *
 * Only confirmed non-secret editor-semantic properties are exposed. No
 * plaintext credential field (`password`, `privateKeyPath`, or similar) is
 * included; broker authentication stays inside the referenced shared
 * connection. Compiler mapping (`runtimeKind`/`operation`) is intentionally
 * omitted and lands in a later compiler ticket. No compiler code lives here.
 */
export const mqttSourceDefinition: FlowNodeDefinition = {
  type: 'mqtt-source',
  version: 1,
  displayName: 'MQTT Source',
  description: 'Subscribe to an MQTT topic via a shared connection.',
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
        'MQTT topic to subscribe to. Compiler mapping to the eKuiper MQTT source lands later.',
    },
    {
      key: 'connectionSelector',
      label: 'Shared connection',
      type: 'string',
      description:
        'ID of an existing shared eKuiper MQTT connection. Broker credentials stay inside that connection.',
    },
  ],
};

/**
 * MQTT sink editor-semantic definition (v1).
 *
 * `topic` (required) and `connectionSelector` are confirmed by both
 * `MqttSink` in `src/lib/ekuiper/types.ts` and `KNOWN_FIELDS.mqtt` in
 * `src/lib/ekuiper/rule-designer.ts`. Only these confirmed non-secret
 * properties are exposed; no plaintext credential field is included and
 * compiler mapping (`runtimeKind`/`operation`) is intentionally omitted
 * until a later compiler ticket. No compiler code lives here.
 */
export const mqttSinkDefinition: FlowNodeDefinition = {
  type: 'mqtt-sink',
  version: 1,
  displayName: 'MQTT Sink',
  description: 'Publish results to an MQTT topic via a shared connection.',
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
        'MQTT topic to publish to. Compiler mapping to the eKuiper MQTT sink lands later.',
    },
    {
      key: 'connectionSelector',
      label: 'Shared connection',
      type: 'string',
      description:
        'ID of an existing shared eKuiper MQTT connection. Broker credentials stay inside that connection.',
    },
  ],
};
