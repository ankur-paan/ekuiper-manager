# Commercial Feature Teardown and Port Plan

**Audit date:** 18 August 2026
**Manager baseline:** `main` at `7709df6`
**Subjects:**
- `emqx/ekuiper-manager:1.9.5-plus-ief` (closed source, commercial `-plus` edition, built 2024-04-18)
- `emqx/neuronex:3.9.2` (commercial industrial edge suite, built 2026-08-14)

**Companion documents:** [ORIGINAL_MANAGER_UX_AUDIT.md](ORIGINAL_MANAGER_UX_AUDIT.md), which covers the
live Manager 1.8.0 UI screen by screen, and
[ORIGINAL_MANAGER_PLUS_IEF_FLOW_CATALOG.md](ORIGINAL_MANAGER_PLUS_IEF_FLOW_CATALOG.md), which preserves
the complete declarative Flow catalog from 1.9.5-plus-IEF. This document covers the broader functional
and architectural surface of the later commercial builds.

## 1. Method and boundary

Both images were pulled from Docker Hub, exported with `docker export`, and inspected. The evidence
used here is shipped configuration, declarative metadata, route registries, and frontend source maps;
no binary decompilation was performed:

- route registries (`etc/apis.json`), permission models (`etc/defaultRoles.json`, `etc/auth.conf`)
- configuration schemas (`etc/conf.yaml`, `etc/neuronex.yaml`)
- error/i18n catalogues (`etc/multilingual/en_US.ini`, `locales/messages/en/error.en.yaml`)
- reverse-proxy tables, entrypoint scripts, exposed ports, layer history
- connector metadata JSON shipped with eKuiper itself
- the Manager image's own Vue source maps, used only to verify functional routes, controls, and state transitions

**The boundary this project observes:**

> We may reimplement useful product behavior. We do not copy vendor implementation code or visual assets.

Compiled binaries, bundled JavaScript, CSS, images, and raw source maps must not enter this repository.
This report records independently observed functional behavior in original prose. The raw teardown
artifacts are deliberately staged **outside this git tree**, in
`../ekuiper-manager-teardown/` and `../neuronex-teardown/`, each with its own licensing README.

One component is different and genuinely reusable: the eKuiper connector metadata bundled inside
NeuronEX at `software/ekuiper/etc/{sources,sinks}/*.json` is part of **eKuiper itself, Apache-2.0,
LF Edge**. It may be used directly, with attribution, and should be sourced from the upstream eKuiper
release rather than from the NeuronEX image.

## 2. What the commercial `-plus` Manager actually is

A 16 MB Go 1.17.9 binary serving a compiled Vue SPA on **port 9082**. No database server; local state
only. It is a **multi-node control plane**, not a single-node UI.

| Aspect | Implementation |
| --- | --- |
| Authentication | JWT access token (15 min) + refresh token (24 h), separate secrets |
| Account safety | Lockout after 5 failed attempts within 10 min, for 15 min |
| Authorization | Casbin, custom matcher `(rol, url, act, pos)` |
| Node registry | Nodes stored locally, credentials encrypted with AES-256 key from `conf.yaml` |
| Node proxying | All engine calls tunnelled under `/api/kuiper/:node/*` |
| Licence gating | `etc/emqx_test.lic` caps the **number of managed nodes** |
| i18n | Backend error catalogue in `en_US` / `zh_CN` INI files |

### 2.1 The ownership dimension — useful later, outside the basic-user milestone

The Casbin matcher carries a fourth term the standard model does not have:

```
m = r.rol == p.rol && keyMatch2(r.url, p.url) && regexMatch(r.act, p.act) && r.pos == p.pos
```

`possession` is `0` ("any resource") or `1` ("only resources you own"). The seeded roles use it like this:

| Role | Grant | Possession |
| --- | --- | --- |
| `root` | `/*` all methods | 0 — everything |
| `user` | `GET`/`PUT` `/api/users/:id` | 1 — own account only |
| `kuiperAdmin` | `/api/kuiper/*` all methods | 0 — all nodes |
| `kuiperUser` | `/api/kuiper/*` all methods | 1 — **only nodes they created** |

The error catalogue confirms enforcement: `non-owned_resources=No auth for the non-owned resources`
and `query_non-owned_resources=invalid query value %s=%s, you can only query your owned resources` —
so ownership is applied to **list filtering**, not just to direct fetches. That second one is the
detail most implementations get wrong.

This gives per-user node isolation without a full RBAC editor. It is technically interesting, but it
is not part of the requested first stable milestone, which deliberately has one owner and basic local
users without resource ownership or a role-policy editor. If multi-user node isolation is later added,
ownership must be enforced in list filtering as well as direct-resource checks.

### 2.2 Route surface

`etc/apis.json` registers ~40 path/method pairs across three groups. Condensed:

- **`roles`** — `POST|GET /api/roles`, `GET|PUT|DELETE /api/roles/:id`
- **`users`** — `POST|GET /api/users`, `GET|PUT|DELETE /api/users/:id`
- **`kuiper`** — node CRUD (`/api/kuiper/nodes[/:id]`), then per-node:
  `ping`, `streams`, `tables`, `rules` (+ `status`, `start`, `stop`, `restart`, `topo`),
  `plugins/{sources,sinks,functions}` (+ `prebuild`, `functions/:name/register`), `plugins/udfs`,
  `metadata/{functions,sinks,sources}` (+ `sources/yaml/:name`, `sources/:name/confKeys[/:key[/field]]`),
  `services` (+ `services/functions`)

### 2.3 Frontend screen inventory

Verified from the active SPA route table:

```
/login  /change_password  /users  /roles  /roles/:id  /language  /theme  /help
/nodes
/nodes/:id/system         /nodes/:id/configuration   /nodes/:id/extension
/nodes/:id/rules          /nodes/:id/rules/:ruleID   /nodes/:id/rules/:ruleID/topo
/nodes/:id/source         /nodes/:id/source/stream/:streamName
/nodes/:id/source/table/:tableName   /nodes/:id/source/lookupTable/:tableName
/flowEditor/flow
```

Confirms the node-scoped IA already recommended in the UX audit, and confirms `-plus` shipped a
**visual flow editor** (`/flowEditor/flow`) backed by `web/common/flow/Properties.json`.

Strings such as `/register`, `/gateway`, `/schemas/*`, `/ruleset/*`, `/config/uploads`, and
`/metadata/connections` appear in extracted bundles or API clients but are not active top-level SPA
routes in this build. Schemas, uploads, and connections are tabs inside the node Configuration route.

### 2.4 The connector catalog schema

`web/common/flow/Properties.json` describes each connector as a node type. The **schema shape** —
not the file — is the thing to adopt:

```jsonc
{
  "nodeType": "mqtt",
  "about": {
    "trial": false, "installed": true,
    "author": { "name": "...", "email": "...", "company": "...", "website": "..." },
    "helpUrl":     { "en": "...", "zh": "..." },
    "description": { "en": "...", "zh": "..." },
    "label":       { "en": "MQTT", "zh": "MQTT" }
  },
  "libs": ["github.com/pebbe/zmq4@v1.0.0"],
  "properties": [{
    "name": "server", "type": "string", "control": "text",
    "optional": false, "values": null, "placeholder": null,
    "connection_related": true,
    "hint":  { "en": "...", "zh": "..." },
    "label": { "en": "Server address", "zh": "..." }
  }],
  "outputs": [{ "label": { "en": "Output" }, "value": "signal" }]
}
```

Three fields carry most of the value:

- **`control`** — separates *data type* from *widget* (`string` + `text`, `string` + `select`). Removes
  the guesswork that produces wrong inputs for enums and passwords.
- **`connection_related`** — marks properties that belong to a **shared connection** rather than to the
  connector instance. This is what makes "reuse an existing connection" possible in a form.
- **`installed` / `trial`** — lets the catalog show uninstalled connectors as discoverable-but-greyed
  rather than hiding them.

## 3. What NeuronEX 3.9.2 adds

The full image, UI-route, API, connector-control, and workflow analysis now lives in
[NEURONEX_TEARDOWN_ANALYSIS.md](NEURONEX_TEARDOWN_ANALYSIS.md). This section remains the short port-plan
summary. The embedded NeuronEX eKuiper API page is historical wrapper evidence only: it contains stale,
generic, and malformed eKuiper operations and must not be used to update the official Swagger contract.

A thin Go gateway on **port 8085** in front of separate co-located services. Full proxy table in
`../neuronex-teardown/README.md`. The architecturally significant points:

1. **One authenticated origin, declarative proxy table.** Routes are configuration
   (`etc/neuronex.yaml`), not code. Adding an upstream is a config edit.
2. **Protocol-aware proxying.** HTTP, **SSE** (`/api/sse/ekuiper` → `:10081`) and **WebSocket**
   (`/ws/ekuiper` → `:10081`) are all first-class. The open-source proxy currently handles neither
   SSE nor WebSocket — this is exactly roadmap item `API-002`.
3. **Capability switches.** `server.disableKuiper` and `server.disableAuth` toggle whole subsystems;
   `LICENSE_NOT_SUPPORT_EKUIPER` shows entitlement is checked at the feature level.

Features visible in the error catalogue and API strings that the open-source Manager does not have:

| Capability | Evidence |
| --- | --- |
| Diagnostics log bundles | `/api/log/download`, `ekuiper_logs.tar.gz`, `neuron_logs.tar.gz` |
| System backup / restore | `INVALID_SYSTEMDATA_FILE: "The file is not valid for data restore"` |
| Audit report | `/api/audit/report` |
| Alerting | `alert_config`, `alert_result`, webhook URL validation, `metric_config`, liveness config |
| Syslog forwarding | `log.syslog` block in `neuronex.yaml`, `DISTRIBUTE_SYSLOG_CONFIG_ERR` |
| Large-file upload | `/api/large-file/ekuiper_plugin` — separate path for big plugin uploads |
| eKuiper JWT key management | `/api/configuration/jwt/files/:filename`, `/api/configuration/jwt/upload` |
| SSO | `ADD_SSO_CONFIGURATION_FAIL`, `GET_ACCESSTOKEN_ERR`, `GET_USERINFO_ERR` |
| AI assistants + MCP | `/api/aiagent/{ekuiper_chat,neuron_doc_chat,datalayers_chat}`, `/api/mcp/message` |

## 4. Port plan

Mapped onto the existing roadmap IDs in [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md). Nothing here
requires new top-level roadmap entries; most of it **sharpens the specification** of work already
planned.

### 4.1 Adopt now — folds into existing P0 items

| # | Feature to port | Roadmap item | Notes |
| --- | --- | --- | --- |
| P-1 | JWT access + refresh token pair, separate secrets, 15 min / 24 h defaults | `SEC-003` | Plan says "secure cookie sessions"; adopt the refresh-pair lifetimes regardless of transport |
| P-2 | Account lockout: 5 attempts / 10 min window / 15 min lock, all configurable | `SEC-003` | Cheap, and the plan currently only says "rate limiting" |
| P-3 | AES-256 encryption of stored node credentials with an installation key | `SEC-001`, `DATA-001` | Confirms the planned `ManagedNode` model must encrypt, not just redact |
| P-5 | Server-side node registry as the only proxy target, addressed as `/:node` | `SEC-002`, `DATA-001` | Independent confirmation that the current `X-EKuiper-URL` mechanism is the wrong shape |
| P-6 | Declarative reverse-proxy table in config, not hard-coded routes | `SEC-002`, `API-002` | From `neuronex.yaml`; makes the allowlist auditable |
| P-7 | **SSE and WebSocket proxying as first-class** | `API-002` | Already a listed gap; NeuronEX shows the upstream split (REST `:9081`, SSE/WS `:10081`) |

### 4.2 Adopt next — folds into existing P1 items

| # | Feature to port | Roadmap item | Notes |
| --- | --- | --- | --- |
| P-8 | Connector metadata → generated forms, using **Apache-2.0 eKuiper `etc/{sources,sinks}/*.json`** | `META-001` | Source from upstream eKuiper, not from the NeuronEX image. Unblocks the whole item |
| P-9 | `control` field separating data type from widget | `META-001` | Fixes enum/password/boolean rendering |
| P-10 | `connection_related` flag driving "reuse a shared connection" in forms | `META-001`, `NODE-001` | The mechanism behind in-context connection reuse |
| P-11 | Connector catalog with description, help URL, author, installed/trial state | `UX-001` | Matches the UX audit's "discoverable connector catalog" recommendation |
| P-12 | Diagnostics bundle download (logs + config, redacted) | `OPS-001` | Already planned; NeuronEX confirms per-component tarballs |
| P-13 | Backup / restore of Manager state as a validated archive | `OPS-001` | Validate on import — see `INVALID_SYSTEMDATA_FILE` |
| P-14 | Audit report endpoint over the planned audit log | `SEC-003`, `OPS-001` | Plan already requires the log; add the report surface |
| P-15 | Separate large-file upload path for plugins/schemas | `EXT-001`, `SCHEMA-001` | Avoids body-size limits on the normal JSON path |
| P-17 | Capability switches to disable whole subsystems | `DIST-001` | Plan already wants optional features off by default |

### 4.3 Deliberately not ported

| Feature | Reason |
| --- | --- |
| Licence enforcement, node-count caps, hardware binding, floating licences | The entire point of the open-source project is that these do not exist |
| Neuron industrial protocol drivers (`.so`) | Proprietary EMQX binaries; LGPL-3.0 core is a separate process anyway |
| DataLayers time-series database and its dashboards | Proprietary; the plan explicitly excludes TimescaleDB-class dependencies from the base install |
| SSO / OIDC configuration | Explicitly out of scope for the first stable release |
| Resource ownership and configurable role policies | The first milestone intentionally supports only one owner capability plus ordinary local users; revisit with a complete authorization model later |
| eKuiper JWT key-file administration | Useful only for deployments that enable upstream JWT authentication; keep it after the basic stack and secret boundary are stable |
| Node-RED dashboard embedding | Large dependency, orthogonal to eKuiper management |
| AI agent + MCP endpoints | Repo already has its own AI assistant; keep it optional and off by default |

### 4.4 Alerting — a genuine gap worth a decision

NeuronEX has alert rules, metric thresholds, liveness checks, webhook delivery, and syslog forwarding.
The open-source roadmap has `OBS-001` ("health and performance screens show real data") but no
alerting at all.

Alerting is a coherent, high-value, licence-free capability and it is the clearest place where the
open-source Manager could exceed the commercial baseline. It does not belong in the first stable
release, but it deserves an explicit **Later** entry rather than silent omission.

**Recommendation:** add `ALERT-001` (P2) — rule-based alerts on rule status and metrics, with webhook
and syslog delivery — to the Later section of the development plan.

## 5. Corrections this teardown makes to existing assumptions

1. User and role CRUD exist through `/api/users` and `/api/roles`; the SPA has Users, Roles, and
   Change Password screens. There is **no active `/register` route and no distinct administrator
   reset-password flow**. User creation is a modal under Users, and editing a user forces a new
   password because the shared form keeps Password and Confirm password required.
2. The `-plus` edition is a multi-node control plane with per-user node ownership, which is a larger
   scope than the target product. The plan's smaller v1 boundary remains intentional. If ownership is
   ever introduced, list-query filtering and migration of existing records must be designed together.
3. eKuiper's own connector metadata is Apache-2.0 and shippable. `META-001` is less work than the
   plan implies; it is mostly a rendering problem, not a data-collection problem.
