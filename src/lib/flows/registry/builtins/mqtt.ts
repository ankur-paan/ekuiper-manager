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
  * Routine plant options (UX-0006): `qos`, `protocolVersion`, and
  * `insecureSkipVerify` are exposed as optional properties, emitted by
  * the compiler only when set so existing flows compile byte-identically.
  * Provenance (eKuiper v2.4.1, same version as the audited OpenAPI):
  * - `qos`: `public/ekuiper-openapi.json` schema `RuleOptions`
  *   (`{type: integer, enum: [0, 1, 2]}`) plus the MQTT confKey examples
  *   (`{"qos": 0, ...}`), the MQTT source doc ("The default subscription
  *   QoS level"), and `MqttSourceConfig.qos?: 0 | 1 | 2` in
  *   `src/lib/ekuiper/types.ts`.
  * - `protocolVersion`: the MQTT source doc ("MQTT protocol version.
  *   3.1 ... or 3.1.1 .... If not specified, the default value is 3.1",
  *   plus "When `protocolVersion` is set to `5`" for MQTT v5 message
  *   properties) and `MqttSourceConfig.protocolVersion?: string`.
  * - `insecureSkipVerify`: the MQTT source doc ("Controls whether to
  *   skip certificate verification") and
  *   `MqttSourceConfig.insecureSkipVerify?: boolean`.
  * `retained` is sink-only and lives on the sink definition below.
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
      key: 'qos',
      label: 'QoS',
      type: 'select',
      description:
        'Subscription QoS level. Emitted only when set; otherwise the referenced connection default applies.',
      options: [
        { label: '0', value: 0 },
        { label: '1', value: 1 },
        { label: '2', value: 2 },
      ],
    },
    {
      key: 'protocolVersion',
      label: 'Protocol version',
      type: 'select',
      description:
        'MQTT protocol version for this source. Emitted only when set; otherwise the referenced connection default (3.1) applies.',
      options: [
        { label: '3.1 (MQTT 3)', value: '3.1' },
        { label: '3.1.1 (MQTT 4)', value: '3.1.1' },
        { label: '5 (MQTT 5)', value: '5' },
      ],
    },
    {
      key: 'insecureSkipVerify',
      label: 'Skip TLS verification',
      type: 'boolean',
      description:
        'Skip broker certificate verification for TLS connections. Emitted only when turned on; eKuiper verifies certificates by default.',
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
  *
  * Routine plant options (UX-0006): `qos`, `retained`,
  * `protocolVersion`, and `insecureSkipVerify` are exposed as optional
  * properties, emitted by the compiler only when set so existing flows
  * compile byte-identically. Provenance (eKuiper v2.4.1, same version as
  * the audited OpenAPI): the MQTT sink doc lists `qos` ("Only int type
  * value 0 or 1 or 2"), `retained` (boolean, default false),
  * `protocolVersion` ("3.1 ... or 3.1.1 ..., default 3.1", sample
  * `"protocolVersion": "3.1.1"`), and `insecureSkipVerify` (boolean,
  * default false, TLS connections only); `MqttSink.mqtt` in
  * `src/lib/ekuiper/types.ts` confirms `qos?: 0 | 1 | 2`,
  * `retained?: boolean`, and `insecureSkipVerify?: boolean`, and
  * `KNOWN_FIELDS.mqtt` in `src/lib/ekuiper/rule-designer.ts` confirms
  * the same three sink fields. None of `retained`, `protocolVersion`,
  * or `insecureSkipVerify` appears in `public/ekuiper-openapi.json`
  * (zero hits; `RuleGraph` node `props` are free-form, so emitting them
  * is schema-valid); the engine docs above are the authority, exactly as
  * UX-0003 did for `window.timeUnit`.
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
      key: 'qos',
      label: 'QoS',
      type: 'select',
      description:
        'Delivery QoS level. Emitted only when set; otherwise the eKuiper default applies.',
      options: [
        { label: '0', value: 0 },
        { label: '1', value: 1 },
        { label: '2', value: 2 },
      ],
    },
    {
      key: 'retained',
      label: 'Retain message',
      type: 'boolean',
      description:
        'Ask the broker to retain the last message on the topic. Emitted only when turned on; eKuiper defaults to false.',
    },
    {
      key: 'protocolVersion',
      label: 'Protocol version',
      type: 'select',
      description:
        'MQTT protocol version for this sink. Emitted only when set; otherwise the eKuiper default (3.1) applies.',
      options: [
        { label: '3.1 (MQTT 3)', value: '3.1' },
        { label: '3.1.1 (MQTT 4)', value: '3.1.1' },
      ],
    },
    {
      key: 'insecureSkipVerify',
      label: 'Skip TLS verification',
      type: 'boolean',
      description:
        'Accept any broker certificate for TLS connections. Emitted only when turned on; eKuiper verifies certificates by default.',
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
