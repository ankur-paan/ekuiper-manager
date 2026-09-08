import type { FlowNodeDefinition } from '../node-definition';
import { OMIT_IF_EMPTY_PROPERTY } from './sink-common';

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
 * Broker binding (UX-0002): the source binds by eKuiper MQTT source
 * connection NAME (`confKey`), served live by the `mqtt-confkeys` option
 * provider (`src/lib/flows/options/index.ts`, names only so broker
 * credentials never leave the server), exactly like `stream-source`
 * declares `optionsProvider: 'streams'`. The v1 `connectionSelector`
 * stays as a deprecated alias: the compiler
 * (`src/lib/flows/compiler/ekuiper/compile-graph.ts`) maps it to
 * `confKey` and still rejects a source with neither value via the
 * existing `FLOW_REQUIRED_PROPERTY_MISSING`, so existing flows keep
 * compiling.
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
  icon: 'mqtt',
  accent: 'source',
  subtitleKey: 'topic',
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
      key: 'confKey',
      label: 'Connection name',
      type: 'select',
      description:
        'Name of the eKuiper MQTT source connection holding the broker. Loaded live from the selected node. A source binds by connection NAME, not by broker URL.',
      optionsProvider: 'mqtt-confkeys',
    },
    {
      key: 'connectionSelector',
      label: 'Legacy shared connection (deprecated)',
      type: 'string',
      description:
        'Deprecated alias for Connection name: the compiler still maps it to confKey so existing flows keep compiling. Use Connection name for new flows. Broker credentials stay inside that connection.',
    },
  ],
};

/**
 * MQTT sink editor-semantic definition (v1).
 *
 * `topic` (required) and `connectionSelector` are confirmed by both
 * `MqttSink` in `src/lib/ekuiper/types.ts` and `KNOWN_FIELDS.mqtt` in
 * `src/lib/ekuiper/rule-designer.ts`.
 *
 * Broker binding (UX-0002): unlike the source, the sink binds by broker
 * URL (`server`), never by confKey — passing a confKey name as the sink
 * address fails with `dial tcp: address <name>: missing port in address`
 * (see `compile-graph.ts:138-146`). The v1 `connectionSelector` stays as
 * a deprecated alias mapped to `server` by the compiler so existing flows
 * keep compiling. Only these confirmed non-secret
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
  icon: 'mqtt',
  accent: 'sink',
  subtitleKey: 'topic',
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
      key: 'server',
      label: 'Broker URL',
      type: 'string',
      description:
        'MQTT broker address for the sink (for example tcp://broker-host:1883). A sink binds by broker URL, not by connection name.',
    },
    {
      key: 'connectionSelector',
      label: 'Legacy shared connection (deprecated)',
      type: 'string',
      description:
        'Deprecated alias for Broker URL: the compiler still maps it to server so existing flows keep compiling. Use Broker URL for new flows. Broker credentials stay inside that connection.',
    },
    OMIT_IF_EMPTY_PROPERTY,
  ],
};
