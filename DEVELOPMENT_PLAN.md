# eKuiper Manager Development Plan

**Status:** Living roadmap
**Baseline date:** 18 August 2026
**Manager baseline:** `main` at `7709df6`
**eKuiper baseline:** v2.4.1

### Implementation checkpoint — 18 August 2026

The experimental architecture has been replaced in the working tree. The supported base is now a
non-root Manager image, official eKuiper v2.4.1, and a private PostgreSQL 17 sidecar started by one
`docker compose up -d --build` command. Manager state has checked SQL migrations, an encrypted
server-side node registry, local cookie sessions, and no browser-selected proxy target.

Verified locally against the Compose stack:

- All three services became healthy; only the Manager port is published.
- First-owner setup, sign-in, node selection, stream create/delete, rule validate/create-stopped/start/stop/delete,
  and user add/reset/delete passed in Playwright.
- Every primary page passed desktop and mobile navigation with no unexpected browser errors.
- Owner, bundled-node, and migration rows survived a Manager-only container restart; a fresh browser signed in afterward.
- The 98-path/140-operation OpenAPI contract matched official v2.4.1 route registration.
- Type-check, lint, 57 unit tests, seven desktop/mobile browser journeys, production build, container build, and `npm audit` (zero findings) passed.

This is a release-candidate foundation, not a stable release yet. Owner recovery, backup/restore/upgrade,
eKuiper-aware readiness/capability gating, separate-port SSE/WebSocket transport, migration upgrade/rollback
tests, and broader workflow/security E2E coverage remain explicit release blockers below.

## 1. Product goal

Turn eKuiper Manager from an experimental playground into a self-hosted stack that a person can install, operate, upgrade, back up, and recover on their own system.

The first supported product should be deliberately small:

- One Docker Compose deployment containing eKuiper Manager, eKuiper, and a private PostgreSQL sidecar.
- PostgreSQL-backed Manager state on a named volume, migrated automatically before Manager starts.
- One bootstrap owner and simple local user accounts.
- Complete basic user lifecycle: bootstrap, sign in, sign out, add, list, reset password, change own password, delete, and recover the owner account from the command line.
- Safe management of streams, tables, rules, schemas, plugins, services, shared connections, imports, exports, and diagnostics supported by eKuiper v2.4.1.
- No external database, identity provider, broker, or cloud service is required for the base installation.

This is not a multi-tenant control plane. Organizations, configurable RBAC, invitations, SSO/OIDC/SAML, billing, and fleet orchestration are explicitly out of scope for the first stable release.

## 2. Definition of a stable self-hosted release

The product is ready to call stable when all of the following are true:

- [x] A clean host can start the supported stack with `docker compose up -d --build` and complete setup without editing source code.
- [x] Container images, eKuiper versions, volumes, ports, and health checks are explicit and pinned; upgrade compatibility remains separately tracked.
- [x] First-run setup creates the owner securely; no default username or password is shipped.
- [x] All Manager pages and API routes require a valid session except health, setup, and sign-in endpoints.
- [x] Destructive UI operations require confirmation and proxied mutations/user administration are recorded in the audit log.
- [x] Credentials are absent from browser configuration/storage and are recursively redacted at the Manager boundary.
- [x] eKuiper targets are selected from a server-side registry; callers cannot supply an arbitrary proxy target.
- [ ] Backup, restore, upgrade, rollback, password recovery, and uninstall procedures are documented and tested.
- [ ] Core workflows pass against a fresh official eKuiper v2.4.1 instance in CI.
- [ ] The Manager detects the connected eKuiper version and reports unsupported or unavailable capabilities clearly.
- [x] The OpenAPI contract remains at the audited v2.4.1 baseline of 98 paths and 140 registered management operations.
- [x] There are no known critical/high vulnerabilities in runtime dependencies (`npm audit`: zero findings at this checkpoint).

## 3. Product and architecture decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Deployment | Docker Compose is the first supported installation path. | It gives reproducible versions, health checks, networking, volumes, and upgrades. |
| Components | Base stack: Manager + eKuiper + a private PostgreSQL sidecar. | All required state is durable while installation and operation remain one Compose command. |
| Manager data | Direct PostgreSQL access through checked SQL migrations, stored on a named volume. | Sessions, audits, users, and concurrent node operations need predictable transactions; the sidecar is not published or separately administered. |
| Connection storage | One server-side `ManagedNode` model replaces the former database model, JSON file, and browser-local connection state. | One authoritative path prevents drift and keeps credentials out of browsers. |
| Authentication | Local accounts with secure cookie sessions and memory-hard password hashing. | This covers the requested basic lifecycle without introducing an identity platform. |
| Authorization | One immutable bootstrap owner capability plus ordinary local users; no configurable role editor. | User administration needs a trusted actor, while full RBAC remains out of scope. |
| eKuiper access | Server-side registered targets only in production, with URL and network-policy validation. | The current arbitrary target header/query mechanism is an SSRF and lateral-movement risk after authentication is added. |
| API compatibility | The audited OpenAPI file and tagged upstream code/tests define the client contract. | UI assumptions have drifted from real route and wire behavior. |
| Optional features | The human-in-the-loop assistant is provider-optional and off by default; the visual designer is part of rule authoring. External storage and debug tools remain outside the base product. | The one-command base install remains independent of cloud services while assisted operation and visual authoring have explicit security boundaries. |
| Secrets | Encrypt stored secrets with an installation key and redact them from every read response, log, export, and UI view. | eKuiper v2.4.1 may return connector properties verbatim; the Manager must add its own boundary. |

Before implementation, record the irreversible parts of these decisions as short ADRs in `docs/adr/`.

## 4. Roadmap

Priority meanings:

- **P0:** blocks a safe, installable release.
- **P1:** required for a complete and reliable first stable release.
- **P2:** useful after the stable foundation exists.

### Now — make the experimental build safe and reproducible

| ID | Priority | Outcome | Work | Suggested owner | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | P0 | No secrets are exposed to browsers or logs. | Remove client-visible configuration credentials; centralize recursive redaction; mask connector/YAML responses; add regression tests. | Backend/Security | None | Complete for base stack; expand adversarial fixtures with each connector |
| SEC-002 | P0 | The Manager cannot be used as an arbitrary network proxy. | Remove caller-selected targets; proxy only registered targets; validate protocol, origin, DNS/IP ranges, redirects, and timeouts. | Backend/Security | DATA-001 | Base boundary complete; DNS rebinding and forwarded-IP hardening remain P1 |
| SEC-003 | P0 | Administrative operations have an access boundary. | Add bootstrap owner, local users, sessions, same-origin mutation checks, rate limiting, password reset/change, deletion, session revocation, and CLI recovery. | Backend | DATA-001 | Web lifecycle implemented; recovery CLI pending |
| DATA-001 | P0 | Manager state has one reliable source of truth. | Use PostgreSQL for users, sessions, registered nodes, and audit events; remove browser/JSON persistence splits and ship checked migrations. | Backend | ADRs | Complete; restart persistence verified |
| DIST-001 | P0 | A new user can install the stack. | Ship a production image and one Compose stack with private database, bundled eKuiper, health checks, named volumes, automatic migrations, `.env.example`, and first-run setup. | Platform | DATA-001 | Complete locally; CI clean-host job added |
| API-001 | P0 | Every client call uses a real v2.4.1 contract. | Keep an operation coverage matrix; remove nonexistent routes; correct bodies, query values, response types, media types, conditional APIs, and version handling. | Backend | Audited OpenAPI | Contract complete; active UI paths corrected and smoke-tested |
| API-002 | P0 | The proxy faithfully transports official APIs. | Implement a registered-target HTTP gateway for JSON, plain text, PATCH, multipart, and binary downloads; preserve query/status/content headers/cancellation with size, deadline, redirect, and auth policies. Keep separate-port SSE/WebSocket work explicit rather than widening the base proxy. | Backend | SEC-002 | Base HTTP complete; SSE/WebSocket remain P1 |
| TEST-001 | P0 | Regressions are caught before merge. | Add unit, API contract, integration, and Playwright smoke tests against an official pinned eKuiper container. | Quality | DIST-001, API-001 | Complete for release-candidate slice; broader matrix remains P1 |
| DEP-001 | P0 | Dependency risk is understood and reduced. | Run the live advisory audit; update vulnerable direct dependencies and scoped transitives; document any accepted risk. | Maintainer | TEST-001 | Complete; zero audit findings |
| CLEAN-001 | P1 | The repository contains no environment-specific defaults. | Remove environment-specific hosts, credentials, and test assumptions; keep only sanitized fixtures. | Maintainer | TEST-001 | Complete for tracked production/test files |
| AI-001 | P1 | Operators can understand and investigate every screen without surrendering control. | Provide a global read-only operations agent with a server-selected OpenAI-compatible provider, bounded/redacted page and tool context, permission-aware fixed database readers, allowlisted selected-node GETs, iterative/parallel tool calling, per-user rate limits, audit metadata, and no mutation tools. | Full stack/Security | SEC-001, SEC-003 | Complete; provider is optional and off by default |

### Next — complete the self-hosted lifecycle and core eKuiper workflows

| ID | Priority | Outcome | Work | Suggested owner | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |
| OPS-001 | P1 | Operators can maintain the installation. | Add manifest/version-checked backup, preflighted atomic restore, upgrade, rollback, rotate-key, reset-owner, bounded component logs, recursively redacted diagnostics bundle, and uninstall commands/runbooks. | Platform | DIST-001, DATA-001 | Not started |
| NODE-001 | P1 | Connections are predictable and diagnosable. | Add node create/edit/delete/test, version/build/capability detection, TLS/JWT settings, component-aware readiness/degraded states, health history, and clear connection errors. | Full stack | SEC-002 | Core CRUD/probe/select complete; capabilities, health history, and readiness remain |
| UX-001 | P1 | Common tasks are node-scoped, discoverable, and low-friction. | Provide persistent node context, capability gates, simplified navigation, in-context dependency creation, a connector catalog, progressive forms, leave guards, and direct rule lifecycle controls. | Product/Frontend | NODE-001, API-001 | Navigation/workspaces complete; metadata forms, dependency creation, and leave guards remain |
| RULE-001 | P1 | Rule lifecycle is complete. | Finish create/edit/validate/explain/test/start/stop/restart/delete; add duplicate, tag match/edit, bulk start/stop, reset state, schema, topology, trace, and truthful metrics. | Full stack | API-001 | Core lifecycle/workspace and safe duplicate complete; rule test, tags/bulk, and reset UI remain |
| META-001 | P1 | Connector forms follow the installed eKuiper build. | Generate forms from official installed metadata/YAML rather than hard-coded field lists; support widget-vs-type, defaults, enums, hints, groups, recursive list/object/array/JSON controls, and connection-related fields; treat secrets as write-only. | Frontend | API-001, SEC-001 | Not started |
| SCHEMA-001 | P1 | v2.4.1 schema lifecycle is usable. | Support protobuf/custom create, replace, delete, and multipart schema upload with validation and version display. | Full stack | API-002 | Core lifecycle complete; broader fixtures pending |
| DATA-002 | P1 | Configuration can be moved safely. | Implement JSON/YAML import/export, async status/cancel, selective ruleset transfer, validation, dry preview, and backups without secret leakage. | Full stack | API-001, SEC-001 | Direct import/export complete; preview, ruleset UX, and Manager backup remain |
| EXT-001 | P1 | Optional eKuiper extensions are managed safely. | Complete native/portable plugin, UDF, JavaScript UDF, service, upload, and portable-status flows; hide unavailable features in core builds. | Full stack | NODE-001 | Contract-correct flows complete; capability gating and install hardening remain |
| OBS-001 | P1 | Health and performance screens show real data. | Replace fake sparklines/placeholders; add component readiness/degraded state, v2 rule status, trace controls, CPU usage, metrics dump/check, bounded refresh behavior, and component/time-scoped log access. | Frontend | API-001 | Fake data removed; rule status/trace complete; component diagnostics remain |
| DOC-001 | P1 | A first-time operator can succeed unaided. | Rewrite README; add install, configure, users, security, backup/restore, upgrade, troubleshooting, API compatibility, and contribution docs. | Documentation | OPS-001 | README complete; operator runbooks pending |
| REL-001 | P1 | Releases are repeatable. | Add semantic versioning, changelog, image publication, SBOM, provenance, signed artifacts, migration checks, and release smoke tests. | Maintainer | TEST-001, DIST-001 | Not started |

### Later — improve authoring and larger deployments

| ID | Priority | Outcome | Work | Suggested owner | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DESIGN-001 | P2 | Visual query design is dependable. | Design one metadata-backed authoring flow, validate every step, implement real data preview, and add round-trip SQL tests. | Frontend | RULE-001 | Visual/SQL split authoring, generated definition, metadata sink catalog, raw fallback, assistant guidance, and round-trip tests complete; real row preview remains |
| FLEET-001 | P2 | Multiple registered nodes are easier to operate. | Add aggregate health, saved filters, labels, batch-safe actions, and compatibility views without becoming a cloud control plane. | Full stack | NODE-001 | Not started |
| ALERT-001 | P2 | Operators are notified of failures without watching the UI. | Add rule-status, liveness, and metric-threshold alerts with bounded webhook/syslog delivery, retry policy, secret redaction, acknowledgement, and audit history. | Full stack | OBS-001, SEC-001 | Not started |
| DB-001 | P2 | Database operations stay invisible during normal use. | Add storage growth guidance, verified backup/restore, migration rollback, pool diagnostics, and a documented path to an operator-managed PostgreSQL endpoint without changing the default. | Architecture | Stable release | In progress |

## 5. Feature backlog

### Installation and operations

- [x] Multi-stage production image running as a non-root user.
- [x] Compose health checks for Manager, eKuiper, and PostgreSQL.
- [x] Named volumes for PostgreSQL, Manager key state, and eKuiper data, logs, and plugins.
- [x] Generated installation secret and restrictive file permissions.
- [x] First-run setup page that becomes unavailable after bootstrap.
- [ ] CLI commands for owner recovery, password reset, backup, restore, and key rotation.
- [x] Versioned, checksum-checked migration command executed before startup.
- [ ] Version marker and idempotent first-run initializer for every persistent volume; interrupted initialization is detectable and recoverable.
- [ ] Offline-friendly installation notes and image checksums.
- [ ] Reverse-proxy examples for TLS, with trusted-proxy configuration.
- [x] `/health/live` and `/health/ready` endpoints that do not disclose sensitive details.
- [ ] Bounded file-log rotation plus redacted, component-scoped log/diagnostics download.
- [ ] Backup manifest, restore preflight/preview, atomic replacement, readiness verification, and tested rollback.

### Minimal local users

- [x] Create the first owner through a single-use setup flow.
- [x] Sign in and sign out with `HttpOnly`, origin-appropriate `Secure`, `SameSite=Strict` cookies.
- [x] List and add local users.
- [x] Require password change on an owner-issued temporary password.
- [x] Let a user change their own password after re-authentication.
- [x] Let the owner reset another user's password and revoke their sessions.
- [x] Delete a user and revoke all of their sessions.
- [x] Prevent deletion of the last owner and prevent self-deletion.
- [x] Rate-limit sign-in and setup attempts without revealing whether an account exists.
- [x] Record sign-in, user lifecycle, node, and proxied mutation events.

### eKuiper node and API support

- [ ] Detect version, edition/build capabilities, and optional route groups on connection.
- [x] Treat v2.4.1 as the first fully supported contract; mark older/unknown versions incompatible.
- [x] Support optional raw `Authorization` JWT forwarding only from server-side encrypted configuration.
- [x] Handle JSON bodies served as `text/plain` and genuine plain-text success/error bodies.
- [x] Preserve binary downloads through the registered-node proxy.
- [x] Preserve multipart uploads for config uploads and schema uploads.
- [ ] Support rule-test SSE on its separate configured HTTP port.
- [ ] Support WebSocket upgrade/close/backpressure without widening the registered-target allowlist.
- [ ] Represent unavailable script/full-build APIs as capabilities, not generic failures.
- [x] Validate `public/ekuiper-openapi.json` against official tagged route registration in CI.

### Rules, data, and extensions

- [ ] Add bulk rule start/stop by tags introduced in eKuiper v2.4.0.
- [x] Add schema multipart upload introduced in eKuiper v2.4.1.
- [ ] Add global tracer start/stop, rule traces, and bounded trace retrieval.
- [ ] Add async import cancellation and correct task-state display.
- [ ] Add v2 YAML import/export and safe preview.
- [ ] Add metrics dump/check with download and retention guidance.
- [ ] Add dynamic metadata support for connections and lookup sources.
- [x] Add portable plugin status and UDF-symbol views.
- [x] Keep Prometheus `/metrics` and pprof outside the standard contract because they are deployment-conditional.

### Navigation and task flows

- [ ] Make the selected node, health, version, and capability state visible on every node-scoped screen.
- [x] Reduce primary navigation to Overview, Data, Rules, Resources, Extensions, Operations, and Manager administration.
- [x] Add a first-class Nodes screen while retaining fast node switching in the header.
- [ ] Let users create/test a connector configuration from the stream editor without losing unsaved work.
- [ ] Let users select or create a reusable sink template from the rule action editor.
- [ ] Present connector descriptions, installed/available state, capability reason, and official documentation together.
- [ ] Use common-first fields with a consistent collapsed Advanced section.
- [ ] Render metadata controls by widget and data type, including password, file, enum, recursive object/list/array, and JSON editor fixtures.
- [ ] Warn consistently before route change, node switch, refresh, or close when a resource form is dirty.
- [ ] Gate unavailable routes and actions from one version/build/capability model and show the reason/remediation.
- [x] Keep rule start/stop and runtime state visible in the list; use labelled secondary actions.
- [x] Unify rule definition, status, topology, schema, explain, and trace into one workspace; audit integration remains.
- [ ] Add an optional local first-rule tutorial with automated cleanup and no public-service dependency.

### First stable operator journeys

These journeys define the product slice more clearly than a list of screens. Each must work from a clean supported Compose installation and include loading, empty, success, validation, upstream failure, cancellation, and recovery states.

| Journey | Required flow | Completion evidence |
| --- | --- | --- |
| Install and bootstrap | Copy `.env.example`, start Compose, wait for health, open one-time setup, create owner, register the bundled eKuiper node, land on Overview. | Automated clean-host Playwright test; no shipped credential; setup route locks after success. |
| Add and operate a user | Owner lists users, adds one with a temporary password, resets it, user changes it after re-authentication, owner deletes the user, all sessions are revoked. | Browser and API tests; last owner cannot be deleted; audit events recorded. |
| Connect an eKuiper node | Add endpoint plus optional TLS/JWT, test connection, detect v2.4.1 capabilities, save encrypted, display health/version everywhere, edit and delete safely. | Integration test against official container and failure fixtures for DNS/TLS/auth/version mismatch. |
| Create a source | Choose installed connector from metadata catalog, create/test a reusable connection or config key in context, define recursive fields, review generated SQL, create, view, edit, and delete. | Round-trip tests for every metadata control and recursive field type. |
| Create and run a rule | Enter SQL or graph, validate, add ordered actions/reusable sink template, review defaults, create stopped, start, wait for authoritative state, inspect failure, restart/stop/delete. | Test proves command success is not confused with Running state. |
| Diagnose a rule | Open one workspace containing status, last exception, schema, explain, topology, trace, test output, metrics, and audit history. | Real upstream values only; bounded polling; raw diagnostics copy/export. |
| Move and recover configuration | Preview import, choose stop/partial behavior, monitor/cancel async work, export/download, back up, restore into a clean volume, verify health. | Backup/restore and import/export round-trip tests with redacted secrets. |
| Upgrade the stack | Read compatibility result, create backup, pull pinned images, run migration, verify health/data, and roll back using documented commands. | CI upgrade matrix and a human-readable runbook tested on clean Linux. |

### Product UX and operations decisions

| Product requirement | Target implementation |
| --- | --- |
| Keep node context visible and navigation task-focused. | Persistent node switcher plus health/version/capability badge; primary sections Overview, Data, Rules, Resources, Extensions, and Operations. |
| Build connector forms from official eKuiper metadata. | Version-matched field types, widgets, choices, help, installed state, connection relationships, recursive validation, and write-only secrets. |
| Make reusable dependencies first-class resources. | Testable source configuration keys and sink templates with references, encrypted secrets, versioned edits, affected-rule preview, and inline creation without losing drafts. |
| Support visual and text authoring without semantic drift. | One canonical typed model, generated SQL/JSON preview, strict parsing, round-trip tests, and dirty-state warnings. |
| Reconcile commands with authoritative runtime state. | Start/stop/restart enters a pending state, refreshes status, and keeps failures visible beside the control. |
| Keep rule diagnostics together. | One workspace for definition, status, schema, explain, topology, trace, test output, metrics, and audit history. |
| Manage files and plugins safely. | Checksums, compatibility details, references, guarded deletion, install progress, runtime status, rollback, and redacted diagnostics. |
| Support every required transport deliberately. | Registered-node HTTP, download, multipart, SSE, and WebSocket policies with allowlists, limits, deadlines, cancellation, authentication, and audit. |
| Preserve installation state safely. | Named volumes, version markers, idempotent migrations, interrupted-start recovery, and no silent overwrite. |
| Gate unavailable features consistently. | One node capability model controls navigation, actions, errors, and remediation. |
| Keep the first stable scope small. | One immutable owner capability plus ordinary users; optional integrations remain independently licensed and outside the base stack. |
| Make operations recoverable and observable. | Bounded/redacted logs and diagnostics, restore preview, atomic apply, post-restore health verification, rollback, and audit. |

### UX quality safeguards

| Safeguard ID | Target assertion |
| --- | --- |
| UXREG-001 | Raw token/parser errors never render; expired or invalid sessions have one intentional recovery flow. |
| UXREG-002 | Stream and table formats share one typed constraint model and test suite. |
| UXREG-003 | Command success is distinct from authoritative runtime state; exceptions remain visible. |
| UXREG-004 | Labels and scope match the action; shared acknowledgements are server-backed and auditable. |
| UXREG-005 | Read-only state is consistent for every control. |
| UXREG-006 | Structured key/value input has one documented serialization, parser, validation path, and round-trip property test. |
| UXREG-007 | Conditional fields clear and hide atomically; excluded values cannot leak into payloads. |
| UXREG-008 | Every surface has a locale fallback and localization completeness test. |
| UXREG-009 | User profile changes and password reset remain separate operations. |
| UXREG-010 | Metadata forms distinguish engine values from prose hints and add semantic labels without changing wire values. |
| UXREG-011 | Polling is bounded, visibility-aware, and limited to dynamic data. |
| UXREG-012 | Secret classification overrides unsafe metadata and enforces masked input, encrypted storage, and redacted reads/logs/exports. |
| UXREG-013 | Operating system and architecture are structured compatibility fields, never inferred through URL string replacement. |
| UXREG-014 | Official documentation URLs match the connected engine version or are explicitly labelled unversioned. |

## 6. Manager bug backlog

These are confirmed code or contract problems, not speculative feature requests.

| ID | Priority | Problem | Required correction |
| --- | --- | --- | --- |
| BUG-001 | P0 | [`/api/config`](src/app/api/config/route.ts) returns MQTT username/password and contains an environment-specific broker default. | Return only non-sensitive public configuration; never fall back to `NEXT_PUBLIC_*` credentials; remove external defaults. |
| BUG-002 | P0 | The generic [eKuiper proxy](src/app/api/ekuiper/[[...path]]/route.ts) accepts a caller-controlled URL and intentionally suppresses request-forgery analysis. | Restrict requests to authenticated, server-registered nodes and enforce outbound network policy. |
| BUG-003 | P0 | The generic proxy always forwards JSON, always wraps responses as JSON, has permissive `Access-Control-Allow-Origin: *`, and omits PATCH. | Preserve content types/binary streams and approved headers; add PATCH; remove unnecessary CORS; enforce body/time limits. |
| BUG-004 | P0 | The connection-specific proxy drops query parameters, lacks a timeout, cannot preserve multipart/download/SSE responses, and does not forward configured auth. | Replace both proxies with one tested transport adapter. |
| BUG-005 | P0 | Destructive routes and UI actions have no Manager authentication boundary. | Complete SEC-003 before treating the app as deployable beyond a disposable test host. |
| BUG-006 | P0 | Server definitions were split between browser storage, an incomplete ORM path, and a JSON file. | Replace all three with one transactional PostgreSQL-backed node registry. |
| BUG-007 | P0 | Database initialization could silently become unavailable and no migrations shipped. | Use direct PostgreSQL access, checked SQL migrations, and fail-fast readiness/startup. |
| BUG-008 | P1 | [`EKuiperManagerClient`](src/lib/ekuiper/manager-client.ts) says official `/rules/validate` and `/rules/{id}/explain` do not exist and substitutes weaker behavior. | Use the official v2.4.1 endpoints and parse explain's plain-text record format. |
| BUG-009 | P1 | Config-key clients issue nonexistent GET collection/item routes. Official reads use `/metadata/{kind}/yaml/{name}`; item routes support PUT/DELETE only. | Remove speculative calls and use the audited routes. |
| BUG-010 | P1 | Upload client paths use `/uploads`; official paths are `/config/uploads` and `/config/uploads/{name}`. | Correct paths and support both JSON and multipart creation rules. |
| BUG-011 | P1 | Rule tag match sends the wrong model and expects a bare array. Official v2.4.1 requires GET body `{tags:[...]}` and returns `{rules:[...]}`. | Correct request/response types and test the unusual GET-body transport. |
| BUG-012 | P1 | Async import expects `request_id`; v2.4.1 returns `{id}`. Cancellation is absent. | Correct the type, query flags, task states, and cancel operation. |
| BUG-013 | P1 | Schema types and payloads drift: the client exposes `avro`, uses `file` for custom schemas, and lacks multipart upload. | Support `protobuf` and `custom`; use `soFile` for custom; implement upload and exact validation. |
| BUG-014 | P1 | Prebuilt plugins are typed as a string array, but eKuiper returns a name-to-download-URL object. | Correct models and UI. |
| BUG-015 | P1 | Rule and stream/table models omit or misrepresent official fields and recursive field types. | Regenerate/repair types from the audited contract and add response fixtures. |
| BUG-016 | P1 | Rule action editing does not consistently restore and submit number, boolean, and array values. | Adopt a metadata/schema-driven coercion layer and test round trips. |
| BUG-017 | P1 | Settings fetch is a placeholder and submits stale `rotateTime`/`maxAge` fields. | Display only supported dynamic fields: `logLevel`, `debug`, `consoleLog`, `fileLog`, `timezone`, and `metricsDumpConfig.enable`. |
| BUG-018 | P1 | Rule-list sparklines and query-designer preview present placeholder/fake behavior. | Connect them to real bounded data or label/remove them until implemented. |
| BUG-019 | P1 | Debug routes and environment-specific verification/fix scripts are shipped with production code. | Disable debug routes in production; sanitize and convert useful scripts into tests/fixtures. |
| BUG-020 | P1 | CI has no separate type-check, integration/E2E tests, container build, migration test, or eKuiper compatibility smoke test. | Extend CI and make each release artifact pass the same stack test users will run. |
| BUG-021 | P2 | `query-designer-wip/` duplicates the active implementation and can drift. | Select, merge, or archive it; do not maintain two product trees. |
| BUG-022 | P2 | Supabase and TimescaleDB configuration/dependencies appear in the base project without being required for the supported stack. | Remove them from the base distribution or move them to documented optional adapters. |

Resolution checkpoint:

- **Fixed/removed:** BUG-001 through BUG-014 and BUG-017 through BUG-022.
- **Partially fixed:** BUG-015 (active SQL-rule and recursive stream/table models corrected; graph-rule authoring still needs a first-class type/flow).
- **Fixed:** BUG-016 (metadata-aware action coercion now preserves number, boolean, array, nested, unknown, and outer action values; round-trip fixtures cover SQL and `sendSingle`).
- The deleted routes, scripts, duplicate app tree, and former storage integrations remain in Git history for auditability; they are not shipped or built.

## 7. Public fork findings and adoption plan

There are three public forks. Two have no commits ahead of this repository and offer nothing to port at the audited point in time.

| Fork | Audit result | Decision |
| --- | --- | --- |
| [`lhqmcy/ekuiper-manager`](https://github.com/lhqmcy/ekuiper-manager) | 0 ahead, 1 behind. | No action. |
| [`SsJackX/ekuiper-manager`](https://github.com/SsJackX/ekuiper-manager) | 0 ahead, 5 behind. | No action. |
| [`kenvaid/ekuiper-manager`](https://github.com/kenvaid/ekuiper-manager) | 5 ahead, 5 behind; contains focused rule-editor and legacy persistence fixes. | Port behavior selectively with current contracts and tests; do not merge/cherry-pick the stale branch wholesale. |

Work to port from `kenvaid`:

- [x] Add SQL and EdgeX sink editing using installed metadata plus typed built-in definitions.
- [x] Preserve number, boolean, array, nested object, unknown, and outer action values through rule edit/load/save; include `sendSingle`.
- [x] Add duplicate-rule flow with ID validation, collision detection, sanitization of runtime fields, stopped-by-default behavior, confirmation, and a real eKuiper browser test.
- [x] Do not port the fork's persistence fallback; the Manager now uses a typed, fail-fast PostgreSQL layer and checked SQL migrations.

The adopted implementation and its intentional differences from the stale fork are recorded in [`docs/RULE_DESIGNER.md`](docs/RULE_DESIGNER.md). The fork supplied useful field coverage and the duplicate concept; it did not supply the source catalog, generated-definition split view, lossless unknown-field handling, graph-rule fallback, secret masking, safe clone semantics, or current registered-node transport.

## 8. Upstream eKuiper compatibility and bug watchlist

### Contract baseline

- Official release: [eKuiper v2.4.1](https://github.com/lf-edge/ekuiper/releases/tag/2.4.1).
- Route authority: [tagged server registration and handlers](https://github.com/lf-edge/ekuiper/blob/v2.4.1/internal/server/rest.go).
- Official REST documentation: [v2.4.1 REST API tree](https://github.com/lf-edge/ekuiper/tree/v2.4.1/docs/en_US/api/restapi).
- Manager contract: [`public/ekuiper-openapi.json`](public/ekuiper-openapi.json), deployed at [the project Swagger site](https://ankur-paan.github.io/ekuiper-manager/).

For future audits, use tagged upstream code, tests, and official docs as authority. Do not use the Manager-hosted Swagger as input to its own audit.

### Wire behavior the Manager must tolerate

- Many success bodies are plain text; some JSON-shaped bodies arrive with `text/plain` because upstream writes headers late.
- Normal errors are shaped like `{ "error": <integer>, "message": <string> }`, but media types vary.
- Rule explain is plain text containing newline-separated, tab-indented JSON records rather than one JSON document.
- Rule tag matching is a GET request with a JSON body.
- Authentication is optional and uses a raw RS256 JWT in the `Authorization` header, without the `Bearer` prefix.
- Metadata, plugins, portable plugins, and services are absent from core builds; JavaScript UDFs require script/full builds.
- Rule-test SSE runs on the separately configured HTTP server port rather than the management REST port.

### Confirmed upstream issues to defend against and report

| Upstream issue | Manager mitigation | Upstream action |
| --- | --- | --- |
| Invalid ruleset import can call `handleError` with a nil error ([source](https://github.com/lf-edge/ekuiper/blob/v2.4.1/internal/server/rest.go#L1030-L1033)). | Validate import structure locally, refuse empty/invalid payloads, and isolate failures. | Prepare minimal reproduction and upstream fix/test. |
| Rule-tag PUT/PATCH/DELETE can pass a nil error to `handleError` when the registry is unavailable ([source](https://github.com/lf-edge/ekuiper/blob/v2.4.1/internal/server/rule_tag.go#L127-L201)). | Detect node health and avoid retry loops; show a bounded actionable error. | Prepare upstream fix/test. |
| Connection and metadata YAML reads may return connector properties, including secrets, verbatim. | Redact recursively at the Manager boundary and require authenticated access. | Propose centralized upstream redaction with regression tests. |
| Several handlers write `Content-Type` after `WriteHeader`, producing JSON as `text/plain`. | Parse by content first and declared media type second; preserve raw downloads. | Submit targeted header-order fixes/tests upstream. |

Upstream issues should not block Manager-side defenses. Never include real credential values in reports or fixtures.

## 9. Test and release matrix

| Layer | Minimum coverage before stable release |
| --- | --- |
| Unit | URL policy, redaction, password/session logic, migrations, API codecs, rule action coercion, import validation. |
| Contract | Every used operation has an OpenAPI-backed request/response fixture; no client references a route absent from the canonical contract. |
| Integration | Fresh eKuiper v2.4.1 container: stream, table, rule, tag/bulk, schema upload, plugin capability, connection test, import/export, trace, metrics, and error paths. |
| Security | Unauthenticated access, CSRF, SSRF including redirects/DNS rebinding, secret leakage, session revocation, brute force, unsafe upload, log redaction. |
| Migration | Empty database, upgrade from every supported Manager release, failed migration rollback, backup/restore round trip. |
| Browser smoke | Bootstrap, sign in, add/select node, persist non-default selection, create stream, visually design/validate/create/duplicate a stopped rule, observe status, add/reset/delete user, navigate on desktop/mobile, and clean up fixtures. |
| Distribution | Build and scan image, start Compose on clean Linux, verify health, persist through restart, upgrade, and uninstall without deleting user data unexpectedly. |

CI order is: install → dependency audit → OpenAPI validation → lint → type-check → unit/contract tests → production build → clean Compose integration/Playwright smoke → persistence restart check → artifact/security checks.

## 10. Documentation set

- [x] `docs/RULE_DESIGNER.md`: complete visual/SQL/action/runtime flow, ESPHome inspiration, downstream-fork adoption map, fidelity rules, tests, and remaining gaps.
- [x] `README.md`: product purpose, supported version, one-command Compose start, configuration, operations, and known limits.
- [ ] `docs/installation.md`: prerequisites, ports, volumes, profiles, TLS, initial setup.
- [ ] `docs/users.md`: owner bootstrap, add/delete/reset, recovery, session behavior.
- [ ] `docs/configuration.md`: Manager and eKuiper environment settings without secret examples.
- [ ] `docs/security.md`: trust model, outbound target policy, secret storage, reporting.
- [ ] `docs/backup-restore.md`: tested commands and recovery verification.
- [ ] `docs/upgrade.md`: version compatibility, migration, rollback, image pinning.
- [ ] `docs/troubleshooting.md`: diagnostics, logs, connectivity, capability detection.
- [ ] `docs/development.md`: local stack, tests, fixtures, OpenAPI update process.
- [ ] `CHANGELOG.md` and release notes for every supported upgrade.

## 11. Definition of done for every roadmap item

An item is complete only when:

- The behavior and failure modes are documented.
- Code contains no environment-specific hostname, account, credential, or test-only bypass.
- Unit tests cover transformations and validation; integration tests cover upstream behavior where applicable.
- Secrets and personal data are redacted from responses, UI state, logs, traces, errors, exports, and fixtures.
- Accessibility, empty/loading/error states, confirmation, and cancellation have been considered.
- The supported installation can upgrade without manual database edits.
- OpenAPI/client coverage and operator documentation are updated in the same change.
- CI passes from a clean checkout and a clean container volume.

## 12. Immediate implementation sequence

1. Ship owner-recovery/password-reset, backup, restore, upgrade, rollback, key-rotation, and uninstall commands with destructive preflight checks.
2. Make readiness eKuiper-aware and drive every optional route/action from the detected version/build capability model.
3. Close the remaining security hardening: trusted client-address handling, DNS pinning/rebinding defence, streaming byte limits independent of `Content-Length`, and adversarial regression tests.
4. Test empty database, upgrade from every supported release, failed migration recovery, backup/restore round trip, and persistent eKuiper data/configuration.
5. Extend the shipped metadata-backed rule-action editor into the remaining connector/resource forms; add in-context dependency creation, fully write-only secret controls, recursive metadata controls, and consistent dirty-form guards.
6. Complete the remaining rule operations: rule test, tags/match, bulk control, state reset, and authoritative failure reconciliation.
7. Add the deliberately separate rule-test SSE and WebSocket transports with registered-node policies, backpressure, timeouts, cancellation, and audit coverage.
8. Expand Playwright/API coverage across schemas, plugins, services, imports/exports, multipart/binary/error paths; finish operator runbooks and release artifacts.
9. Run the full clean-host, security, migration, backup/restore, and upgrade matrix before declaring the first stable release.
