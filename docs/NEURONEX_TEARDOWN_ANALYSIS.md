# NeuronEX 3.9.2 Teardown: Product, UI, API, and Adaptation Analysis

Status: evidence-backed product analysis
Source snapshot: `emqx/neuronex:3.9.2`, built 2026-08-14 and decomposed 2026-08-18
Local evidence: `C:\Users\paanday\Documents\idacs\neuronex-teardown`
Target: the open-source eKuiper Manager described in [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md)

## 1. Purpose and evidence rules

This document records what the supplied NeuronEX image contains, how its interface is organised, and
which patterns should influence eKuiper Manager. It is a product reference, not a source-code donor.

The analysis uses five evidence classes:

1. image metadata and `entrypoint.sh` for packaging and persistence;
2. `etc/neuronex.yaml` for gateway, logging, and feature configuration;
3. the embedded OpenAPI/Redoc state for the documented HTTP surface;
4. the compiled SPA route table, UI labels, and API call strings for actual screen behaviour; and
5. bundled eKuiper metadata for connector/operator form structure.

Where these disagree, the document says so. In particular, NeuronEX's embedded eKuiper API pages are
not used as the eKuiper contract. The Manager must continue to use official LF Edge eKuiper source,
tests, and tagged documentation. No credential, private key, activation value, or example password from
the image is reproduced here.

## 2. Legal and reuse boundary

The image is a mixed distribution:

| Component | Evidence | How the Manager may use it |
| --- | --- | --- |
| NeuronEX gateway and web application | Proprietary product artefacts | Observe behaviour and interaction patterns only; do not copy code or assets. |
| eKuiper binary and `etc` metadata | Apache-2.0 upstream component | Reuse only from the corresponding official LF Edge eKuiper release, preserving notices. Do not make this image snapshot the source of truth. |
| Neuron core | LGPL-3.0 component distributed as a separate process | An optional external integration may be designed later; it is not part of the Manager base stack. |
| Neuron protocol drivers | 65 compiled plugin binaries plus 78 schema files; many are commercial | Do not redistribute or reverse engineer them. Dynamic-form ideas are reusable; the binaries and proprietary schemas are not. |
| DataLayers | Separate proprietary service and tools | Do not include it. A generic external data-store integration can be evaluated independently later. |

The connector and operator catalogs in this document list names and public configuration concepts so we
can design compatible UI behaviour. Implementation must fetch the metadata from the installed, official
eKuiper version instead of copying the teardown files.

## 3. Distribution and runtime architecture

### 3.1 Image shape

The supplied image is an amd64 Debian 13 (`trixie`) image, approximately 1.29 GB, exposing port 8085.
It contains a stripped Go gateway executable, eKuiper, Neuron, DataLayers, Python 3.13, AI/runtime
libraries, the web SPA, and protocol plugins. The product launches through one entrypoint:

```text
container :8085
  └─ NeuronEX gateway and process supervisor
      ├─ web SPA
      ├─ eKuiper REST :9081
      ├─ eKuiper rule-test transport :10081
      ├─ Neuron REST :7000
      ├─ DataLayers
      ├─ optional AI services
      └─ optional Node-RED dashboard service :1880
```

This creates a convenient appliance, but it is the wrong packaging trade-off for the open-source
Manager. Our distribution should keep Manager and eKuiper as separately replaceable containers, with
an optional EMQX profile. That produces smaller upgrades, clearer health ownership, fewer licence
boundaries, and easier rollback.

### 3.2 Persistent-data lifecycle

The entrypoint creates one product data root and then component roots for NeuronEX, eKuiper, and Neuron.
On first launch it seeds eKuiper data/plugins and Neuron persistence/plugins into those locations before
starting the gateway.

The useful pattern is **explicit per-component persistence with first-run initialization**. Adapt it as:

- named volumes for Manager state, eKuiper data, plugins, schemas, uploads, and logs;
- a version marker and idempotent migration for every volume-owning component;
- initialization that never silently replaces a user-edited file;
- backup manifests that record application, schema, and engine versions; and
- upgrade/rollback checks before a new container writes to an old volume.

Do not reproduce a blind “copy defaults if a directory is absent” strategy. An interrupted seed or a
partially populated directory must be detected and recoverable.

### 3.3 Gateway routing

`neuronex.yaml` declares upstreams instead of hard-coding every route. The significant mappings are:

| Public route | Upstream | Transport | Product role |
| --- | --- | --- | --- |
| `/api/neuron` | `127.0.0.1:7000/api/v2` | HTTP | data collection |
| `/api/ekuiper` | `127.0.0.1:9081` | HTTP | eKuiper management |
| `/api/sse/ekuiper` | `127.0.0.1:10081` | SSE | rule-test events |
| `/ws/ekuiper` | `127.0.0.1:10081` | WebSocket | processing streams/test output |
| `/api/process` | `127.0.0.1:38085` | HTTP | component lifecycle |
| Node-RED dashboard routes | `127.0.0.1:1880` | HTTP and WebSocket | optional dashboards |
| `/ws/ai` | `127.0.0.1:8000` | WebSocket | optional AI chat |
| `/api/aiagent` | `127.0.0.1:8001` | HTTP | optional AI control/history |

This validates two Manager design decisions:

- proxy targets must come from the server-side registered-node model, never a browser-supplied URL; and
- HTTP, downloads, multipart, SSE, and WebSocket need explicit transport policies rather than one generic
  JSON proxy helper.

The NeuronEX table itself must not be copied verbatim. Manager routes need a narrow allowlist, destination
validation, bounded body/stream sizes, deadlines, cancellation, hop-by-hop header removal, and audit data.

### 3.4 Runtime configuration patterns

The gateway exposes feature switches for authentication and eKuiper, optional TLS certificate/key paths,
bounded file logging, and optional remote syslog. File logs use a size limit and retained-backup count.
The syslog configuration has a network, remote address, tag, and threshold with these visible priorities:
`fatal`, `error`, `warning`, `notice`, `info`, and `debug`.

For Manager:

- authentication must not be a casually deployable “off” switch; development bypasses must be explicit,
  local-only, and impossible in the production image;
- eKuiper availability should be a detected capability/degraded state, not a licence switch;
- file-log rotation should have conservative defaults; and
- syslog/webhook destinations must use the same outbound-network policy as node targets.

## 4. Complete SPA information architecture

The compiled route table contains the following primary navigation. A blank child path is the list or
landing page under its parent.

| Area | Route | Child screens and actions visible in the route tree |
| --- | --- | --- |
| Home | `/` | Redirects to `/neuron/south-driver`, making collection the appliance's default task. |
| South devices | `/neuron/south-driver` | list; add south node; node/plugin detail; group list; group tag list; add tags. |
| North applications | `/neuron/north-driver` | list; add north app; app/plugin detail; group/subscription detail. |
| Collection plugins | `/neuron/plugin` | plugin catalog and installation/update. |
| Collection monitoring | `/neuron/monitoring` | current/history monitoring and tag read/write. |
| Sources | `/ekuiper/source` | Stream, Scan Table, and Lookup Table tabs; create/edit/detail routes for each. |
| Rules | `/ekuiper/rules` | list; create/edit detail; action editor; status; topology. |
| Extensions | `/ekuiper/extension` | native/portable plugins; resources; external services; custom functions; AI function generator. |
| Processing configuration | `/ekuiper/configuration` | connector/source/sink configuration and connector detail. |
| Data analysis | `/data/analysis` | canned tag queries, SQL, table/chart results, AI query entry. |
| Dashboards | `/data/dashboards` | dashboard list and dashboard editor/detail. |
| Applications | `/application` | application list. |
| System configuration | `/admin/configuration` | engine switches, storage, tracing, agent, SSO, AI model, simulator, backup/restore. |
| System information | `/admin/info` | versions, uptime, service status, usage, resource monitor. |
| Licence | `/admin/license` | licence status, activation/upload/reset. Reference only; reject for Manager. |
| Logs | `/admin/logs` | component logs, download, level, auto-refresh, forwarding/upload. |
| Users | `/admin/users` | user list, create/edit/delete/change password. Manager adopts only its simpler lifecycle. |
| Authentication | `/login` | login; authenticated root redirect. |

This navigation is broad because NeuronEX is an industrial edge suite. Manager should not reproduce its
top-level module count. The useful adaptation is its task grouping:

```text
Manager target
  Nodes
  └─ selected node
      ├─ Overview
      ├─ Data (streams, scan tables, lookup tables)
      ├─ Rules
      ├─ Resources (connections, configurations, schemas, uploads)
      ├─ Extensions
      └─ Operations (health, traces, metrics, logs, transfer)
  Users
  System
```

## 5. Screen and workflow catalogue

### 5.1 Login and component gating

The active UI has a login page and redirects `/` to South Devices. Feature switches and health states
gate modules. The UI has explicit unavailable states for data collection, data processing, DataLayers,
and AI, rather than allowing every downstream page to fail independently.

Adapt this pattern: capability detection happens when a node is registered and on health refresh. A
missing script build, disabled rule-test server, unsupported route group, or stopped eKuiper process must
produce one stable capability state and a useful explanation throughout the UI.

### 5.2 South-device lifecycle (reference only)

The collection workflow is:

1. Search/list south devices and inspect status.
2. Add a device either from a template or by selecting a plugin.
3. Enter a name and render configuration from the plugin schema.
4. Start/stop the device and view connection/running state.
5. Create a group with a read interval (minimum visible validation: 30 ms).
6. Add/edit/rename/delete tags, including address, attribute, data type, precision, bias, unit, and static
   value where supported.
7. Test-read a tag, bulk import from the provided spreadsheet template, or browse/import device tag
   descriptions for supported drivers.
8. Monitor connection, latency, reads/errors, bytes, and group execution statistics.
9. Temporarily enable driver debug logging and download the driver log.

Notable interaction details:

- Template/plugin selection is a deliberate first step rather than a field buried in a long form.
- Plugin schema types choose widgets dynamically: integer/text, password text, boolean radio, file,
  enum map (radio for fewer than three values, select otherwise), array editor, or JSON editor.
- Validation comes from the schema, including number/length ranges and driver-specific addresses.
- Bulk import reports the failed row and retains actionable reasons; partial success is acknowledged.
- The tag page warns before leaving with unsaved changes.

Manager does not adopt Neuron device management, but it should adopt schema-driven widget selection,
partial-import reporting, test-before-save, and unsaved-change protection in eKuiper forms.

### 5.3 North-application lifecycle (reference only)

The northbound workflow creates an application from a plugin, edits its dynamic configuration, starts or
stops it, and subscribes it to groups from south devices. The application detail exposes subscription
groups, topic, status, sent/received/error/cached/discarded counters, and bulk unsubscribe. MQTT topic
validation rejects publish topics containing `#` or `+`.

The reusable Manager pattern is a two-stage dependency picker: select an existing resource or create it
in context, return the result to the original form, and preserve unsaved input.

### 5.4 Stream and table lifecycle

The Source screen uses three tabs: **Stream**, **Scan Table**, and **Lookup Table**. Creation is a two-step
flow:

1. select stream/table/source type;
2. configure the selected type and define schema fields if required.

The forms expose name, source type, data source, format, key, configuration key, shared-source setting,
timestamp field/format, schema name/file, fields, array element type, nested struct fields, and lookup
retention as applicable. Detail pages support edit and delete. Delete warnings correctly explain that
already-running rules can retain the deleted configuration until restart.

Adopt the tabs, two-stage progressive form, recursive field editor, official metadata hints, and explicit
runtime-impact warning. Keep the UI vocabulary aligned to current eKuiper (`scan` versus `lookup`) and the
connected version.

### 5.5 Rule lifecycle and rule workspace

The Rule list supports search by ID/name/tag, create, edit, copy, import/export, tags, start/stop/restart,
alarm/status information, tracing, and data statistics. The rule workspace supports text and visual modes.

The authoring flow is:

1. enter a Rule ID and SQL, or use an SQL example;
2. optionally enable a simulated-source rule test;
3. map one or more SQL sources to simulated payloads, interval, and cyclic-send setting;
4. run/stop the test and inspect output;
5. add at least one sink action using **Select Plugin → Plugin Properties**;
6. configure common sink behaviour and connector-specific properties;
7. configure general, event-time, retry, scheduling, and tracing options; and
8. save, then use status/topology/detail views for operation.

Visible rule options include:

| Group | Options |
| --- | --- |
| General | concurrency, buffer length, disable full-buffer discard, send metadata, send error, send nil fields, incremental-window calculation, rule tracer, debug log level |
| Delivery | QoS `0`/`1`/`2`, checkpoint interval, sink concurrency, async mode, single-message mode, omit empty output, data template/data field |
| Retry | attempts, delay, maximum delay, multiplier, jitter factor |
| Scheduling | cron, duration |
| Cache/resend | enable cache, memory/disk limits, clean at stop, require acknowledgement, page size, resend interval, alternate queue, priority `-1`/`0`/`1`, indicator field, destination |

The Manager should adapt this as one rule workspace containing Definition, Test, Actions, Options,
Status, Topology, Schema, Explain, Trace, and Audit. Current eKuiper schemas and official behaviour remain
authoritative; NeuronEX labels are not a versioned contract.

### 5.6 Extensions and resources

The Extension area contains:

- native source/sink/function plugin installation and update;
- portable plugin installation/update/status;
- external service create/edit/delete;
- JavaScript custom function create/edit/delete; and
- an optional AI function generator with parameters, aggregate flag, code review, overwrite confirmation,
  and deployment.

Plugin forms expose type, name, file, shell parameters, and function registration where applicable.
Portable plugins offer a downloadable example. Destructive messages warn that dependent rules may fail
or that the engine may need restart.

Adopt the explicit dependency warnings, installed/available state, function registration, portable status,
and restart semantics. Keep AI generation optional and off by default.

### 5.7 Shared processing configuration

The configuration screen groups shared connectors, source configurations, sink templates, schemas, and
uploaded files. Connector fields are rendered from metadata and connection-related properties can be
stored once and selected by dependent resources. Forms support view, edit, reconnect/test, and source
kind selection (stream, scan table, lookup table).

This is directly applicable to `META-001`: a stream or action should be able to choose a shared connection,
test it, or create it in context. Secret values must never return to the browser after save.

### 5.8 Data analysis and dashboards (later, optional)

The Data Analysis page provides canned operations for the latest values, the latest 100 samples, a past
period, and maximum value, plus arbitrary SQL and table/chart result views. The dashboard editor supports:

- create/edit/copy dashboard;
- fixed time ranges from 1 minute through 7 days;
- configurable refresh interval;
- add/edit panels;
- title, chart type, symbol size, sparkline/trend, table merge, min/max range, and unit;
- one or more SQL queries with aliases; and
- optional `$timeFilter` handling.

These features depend on proprietary DataLayers in this distribution and are not part of the first stable
Manager. If a demand appears later, define a provider-neutral dashboard interface and make the data store
an optional adapter. Do not add DataLayers or a time-series database to the base Compose stack.

### 5.9 Administration and operations

System Information shows software/build/system versions, architecture, uptime, core service status, node
and tag usage, CPU load, memory use, per-component runtime, and storage. System Configuration exposes
component switches, metrics, storage retention, OpenTelemetry endpoint/service/sampling, log forwarding,
backup/restore, ECP, SSO, AI models, and industrial simulators.

Logs are component-scoped: NeuronEX, eKuiper, Neuron, and per-driver logs can be searched, auto-refreshed,
level-adjusted, and downloaded. The binary also exposes audit report, diagnostics archives, system backup,
validated restore, large-file upload, liveness, alert, metric, webhook, and syslog route families.

Manager should adapt only:

- component-aware readiness and version display;
- bounded log view/download with source and time filters;
- redacted diagnostics bundle;
- validated, versioned backup/restore with preview before replacement;
- optional OpenTelemetry configuration;
- metrics and liveness display; and
- later, bounded webhook/syslog alert delivery.

ECP management, licensing, industrial simulators, SSO, AI models, and DataLayers configuration remain out
of the first-stable scope.

### 5.10 Users

NeuronEX exposes Administrator and Viewer roles, user CRUD, remarks, password change, and role changes.
That is evidence for a conventional lifecycle, not a mandate to copy RBAC. Manager's first stable release
continues to implement one owner capability plus ordinary local users: add, temporary password, forced
change, self-change, owner reset, session revocation, delete, and CLI recovery. No configurable roles,
permissions editor, SSO, or multitenancy are added.

## 6. Metadata-driven control catalogue

The supplied metadata contains 14 source definitions (including root MQTT metadata), 15 sinks, and 9
visual operators. The UI separates `type` from `control`, supports required/optional state, defaults,
enumerated `values`, documentation hints, grouping/layout, nested object/list controls, and
`connection_related` properties. This is a better contract than hard-coded React forms.

### 6.1 Source types and enumerated controls

| Source | Required fields | Important optional fields and enumerations |
| --- | --- | --- |
| MQTT | server | connection selector; protocol `3.1`/`3.1.1`; QoS `0`/`1`/`2`; TLS paths; skip verification; decompression `zlib`/`gzip`/`flate`/`zstd` |
| CAN | address | network `can`/`udp` |
| File | file type, path | type `json`/`csv`/`lines`; read/move action `0`/`1`/`2`; interval, send interval, header, columns, skipped leading/trailing lines |
| HTTP Pull | URL, method | method `post`/`get`/`put`/`delete`; interval, timeout, incremental mode, body, TLS, headers, response `code`/`body`, OAuth |
| HTTP Push | method | method `POST`/`PUT` |
| Kafka | brokers, group ID | data source/topic |
| Memory | none | no connector-specific top-level properties |
| Neuron | URL | none in this metadata snapshot |
| Redis | address, data type | username/password; data type `string`/`list` |
| Redis Subscribe | address, DB, channels | credentials; decompression `zlib`/`gzip`/`flate`/`zstd` |
| Simulator | interval, data | loop |
| SQL | database URL | interval; lookup and SQL-query configuration objects |
| Video | URL | interval |
| WebSocket | address | connection selector; TLS paths; skip verification |

### 6.2 Sink types and enumerated controls

| Sink | Required fields | Important optional fields and enumerations |
| --- | --- | --- |
| File | path | type `lines`/`json`/`csv`; header; rolling count/interval; naming `prefix`/`suffix`/`none` |
| Image | path | format `jpeg`/`png`; max age/count |
| InfluxDB 1 | address, database, precision, measurement | precision `s`/`ms`/`us`/`ns`; credentials/TLS; timestamp field, fields, tags |
| InfluxDB 2 | address, bucket, organisation, precision, measurement | precision `s`/`ms`/`us`/`ns`; token/TLS; line protocol, fields/tags/template |
| Kafka | brokers, topic, required acknowledgements, SASL type | SASL `none`/`plain`/`scram`; credentials/TLS; batch, attempts, headers, key |
| Log | none | no connector-specific fields |
| Memory | topic | row-kind and key fields |
| MQTT | server, topic | protocol `3.1`/`3.1.1`; QoS `0`/`1`/`2`; retain; credentials/TLS; compression `zlib`/`gzip`/`flate`/`zstd` |
| Neuron | URL | node, group, tags, raw mode |
| Nop | none | optional logging |
| Redis | address, DB, data type, expiration | key type `single`/`multiple`; data type `string`/`list`; credentials, key/field, row kind |
| Redis Publish | address, DB, channel | credentials; compression `zlib`/`gzip`/`flate`/`zstd` |
| REST | URL | method `GET`/`POST`/`PUT`/`DELETE`/`HEAD`; body `none`/`json`/`text`/`html`/`xml`/`javascript`/`form`; headers/TLS; response `code`/`body`; OAuth |
| SQL | database URL, table | fields |
| WebSocket | address, path | connection selector; TLS paths; skip verification |

### 6.3 Visual operators

| Operator | Controls |
| --- | --- |
| Filter | required expression |
| Function | required expression |
| Group By | required dimension list |
| Join | required input and join-object list |
| Sort | required sort-object list |
| Pick | required field list |
| Script | required script editor |
| Switch | required case list and stop-at-first-match boolean |
| Window | type `tumblingwindow`/`hoppingwindow`/`slidingwindow`/`sessionwindow`/`countwindow`; unit `ms`/`ss`/`mi`/`hh`/`dd`; size; interval |

The metadata snapshot has known age-dependent values and documentation links. Implementation must not
freeze these tables into application code; they are test fixtures for the renderer only.

## 7. API inventory and drift findings

The embedded Redoc state is OpenAPI 3.1.0 with the generic document version `1.0.0`. It contains 112
paths, 164 operations, 28 component schemas, no declared server, and no security scheme. Operation counts
are dominated by configuration (37), rules (12), plugins (9), monitoring (8), services/licensing (7 each),
and streams/tables/log/SSO/server (6 each).

Useful gateway/product route families include:

- system, version, ping, process status/start/stop;
- login/password/users and SSO;
- logs, audit report, diagnostics, backup/restore, JWT files;
- liveness, metrics, alerts, webhook, and syslog;
- eKuiper, Neuron, DataLayers, dashboard/storage, and large-file proxy routes;
- templates, tunnels, licence/ECP, AI agent, and MCP.

However, the API document is incomplete relative to the gateway binary and SPA, and its proxied eKuiper
section is stale. Confirmed examples include:

- generic `/api/ekuiper/plugins/{type}` paths instead of the current explicit native/portable routes;
- a GET method for function registration where official eKuiper uses POST;
- malformed stream/table item paths with a doubled closing brace;
- a stream item operation labelled “Update” but documented as GET;
- upload and SSO paths that unexpectedly lose the `/api/ekuiper` or `/api` prefix; and
- absence of newer gateway route families that are present in binary strings and UI calls.

Therefore:

1. use this OpenAPI only to understand NeuronEX product coverage;
2. never merge its eKuiper operations into `public/ekuiper-openapi.json`;
3. keep the LF Edge eKuiper v2.4.1 audited contract as Manager's source of truth; and
4. add a compatibility detector rather than assuming that a commercial wrapper's docs match its bundled
   engine.

## 8. What Manager should adopt

| Pattern | Decision | Roadmap mapping | Acceptance boundary |
| --- | --- | --- | --- |
| Declarative, protocol-aware proxy records | Adopt now | `SEC-002`, `API-002` | Registered target only; HTTP/SSE/WS/download/multipart policies; no browser destination override. |
| Per-component persistence and first-run lifecycle | Adopt now | `DIST-001`, `OPS-001` | Named volumes, version markers, idempotent migrations, no silent overwrite. |
| Component/capability gates and degraded states | Adopt now | `NODE-001`, `UX-001` | One detected capability model drives routes, actions, and explanations. |
| Metadata-generated connector forms | Adopt next | `META-001` | Official installed metadata; nested controls; secret write-only fields; versioned fixtures. |
| Two-stage type/plugin then configuration forms | Adopt next | `UX-001`, `META-001` | Preserve unsaved state; create/test dependencies in context. |
| Unified rule definition/test/action/operation workspace | Adopt next | `RULE-001`, `UX-001` | Current official APIs and truthful status; no fake previews. |
| Partial bulk-error reporting and leave guards | Adopt next | `UX-001`, `DATA-002` | Failed rows/resources remain actionable; successful work is clearly identified. |
| Component logs and redacted diagnostics | Adopt next | `OPS-001`, `OBS-001` | Bounded range/size, download, redaction tests, no raw secrets. |
| Validated backup/restore | Adopt next | `OPS-001`, `DATA-002` | Preflight, manifest/version check, preview, atomic replace, health verification, rollback. |
| Alert rules and bounded webhook/syslog delivery | Later | `ALERT-001` | Rule/liveness/metric alerts after real observability exists. |
| Provider-neutral data insights | Defer | future decision | No proprietary database or base-stack dependency. |
| AI function/rule help | Later and optional | `AI-001` | Explicit flag, redaction, data-use warning, budgets, failure isolation. |

## 9. What Manager should not adopt

| NeuronEX feature | Decision and reason |
| --- | --- |
| Licence activation, tag/node quotas, hardware binding, floating licences | Reject; they conflict with the open-source self-hosted goal. |
| ECP management/tunnel and global edge templates | Reject from the base product; they implement a fleet control plane and commercial ecosystem. |
| Neuron and proprietary protocol drivers | Exclude; a future integration can connect to a separately installed Neuron instance. |
| DataLayers and bundled dashboards | Exclude; proprietary and too heavy for the base stack. |
| Administrator/Viewer RBAC and SSO | Exclude from first stable; retain the deliberately simple owner plus local-user lifecycle. |
| Node-RED embedding | Exclude; orthogonal dependency and separate security surface. |
| Industrial simulators, BACnet scanner, CNC transfers | Exclude; they belong to device acquisition, not eKuiper management. |
| Licence-driven feature hiding | Replace with real build/version/capability detection. |
| One 1.29 GB all-in-one appliance image | Reject; use independently upgradeable Compose services. |

## 10. Acceptance tests derived from the teardown

| ID | Scenario | Required result |
| --- | --- | --- |
| NXREG-001 | Proxy an eKuiper JSON call, binary export, multipart upload, SSE rule test, and WebSocket stream. | Status, headers, body/stream, cancellation, and errors survive; only the registered target is reachable. |
| NXREG-002 | Start with an unavailable optional route group or stopped engine. | Navigation/actions are gated by one capability state with remediation, not repeated generic failures. |
| NXREG-003 | Render fixtures for text, password, integer, boolean, select, file, nested list/object, array, and JSON controls. | Required/default/enum/help behaviour is correct; saved secrets are never rehydrated into the browser. |
| NXREG-004 | Create a stream and create/test a required shared connection in context. | Returning to the stream preserves all entered values and selects the new dependency. |
| NXREG-005 | Leave a dirty stream, rule, connector, or schema form. | Internal navigation, node switch, refresh, and close produce a consistent unsaved-work warning. |
| NXREG-006 | Import a mixed-validity ruleset/configuration. | Preflight lists changes; partial/failed items have precise reasons; destructive apply needs confirmation. |
| NXREG-007 | Download a diagnostics bundle after using credential-bearing connectors. | Bundle is size bounded and recursively redacted; audit records the export without recording secrets. |
| NXREG-008 | Restore a backup from an incompatible, corrupt, or newer version. | Validation fails before replacement; current state stays operational. |
| NXREG-009 | Restore a valid backup. | Atomic apply, migration, restart/readiness check, and rollback path are proven. |
| NXREG-010 | Create, run, stop, and clean up a simulated-source rule test. | Events stream reliably, stop is idempotent, and no temporary rule/resource is leaked. |
| NXREG-011 | Delete or replace a resource used by a running rule. | UI identifies dependencies and explains runtime/restart impact before confirmation. |
| NXREG-012 | Download/view logs with auto-refresh and a bounded time range. | Polling stops off-screen, result size is capped, secrets are redacted, and source/time are visible. |

## 11. Resulting product direction

NeuronEX confirms that a successful eKuiper operator experience is more than CRUD pages. The best parts
are dependency-aware authoring, engine-informed forms, in-place testing, explicit health/capability states,
and lifecycle operations that make the appliance recoverable. Those are now part of the Manager target.

The scope remains intentionally smaller: one self-hosted Manager, one or more explicitly registered
eKuiper nodes, basic local users, no multitenancy, no configurable RBAC, and no bundled industrial or
time-series platform. The goal is to be easier to install, safer to operate, and more faithful to current
eKuiper than the commercial wrapper's own stale embedded API documentation.
