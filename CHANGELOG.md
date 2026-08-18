# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-08-18

### Added
- Upgraded the page-aware assistant into a permission-aware read-only operations agent with parallel and iterative tool calling across sanitized Manager/PostgreSQL data and allowlisted selected-node eKuiper GET APIs.
- Added a compact per-answer investigation timeline showing which read-only sources completed without exposing tool inputs or raw results.

### Security
- Added fixed parameterized database readers, owner-only user/session/audit/migration access, an explicit eKuiper GET route allowlist, recursive tool-result redaction, and per-call/aggregate/round/deadline budgets.

## [1.2.1] - 2026-08-18

### Added
- Optional context-aware operator assistant on every authenticated page, including the visual rule designer, with safe Markdown replies and clickable related questions.
- Visual/SQL rule designer with generated eKuiper JSON, validation, raw fallback, and safe duplication.
- One-command Manager + official eKuiper 2.4.1 + private PostgreSQL deployment.
- Bootstrap owner, local owner/user lifecycle, secure sessions, password reset/change, and audit events.
- Server-owned multi-node registry with encrypted authorization values, probe/select/default flows, and safe proxying.
- Audited eKuiper 2.4.1 OpenAPI contract with 98 paths and 140 management operations.

### Changed
- Replaced experimental browser/SQLite persistence and caller-selected targets with checked PostgreSQL migrations and registered-node routing.
- Corrected rules, streams, tables, schemas, connections, plugins, functions, services, uploads, metadata, and import/export flows to the eKuiper 2.4.1 contract.
- Simplified navigation and resource workspaces using the original eKuiper Manager and NeuronEX UX audits.
- Pinned production images and moved PostgreSQL behind the private Compose network.

### Security
- Provider credentials for the optional assistant remain server-side; page context is bounded, redacted twice, and sent only on an explicit message.
- Added same-origin mutation checks, rate limits, encrypted node secrets, recursive response redaction, DNS/IP target validation, redirect rejection, non-root containers, a read-only Manager filesystem, and dropped capabilities.
- Removed legacy debug, EMQX, Supabase, arbitrary AI, and client-selected proxy routes from the supported stack.

### Fixed
- Preserved eKuiper JSON, text, binary, multipart, PATCH, query, status, and content-header behavior through the Manager proxy.
- Corrected stale plugin/service/function/schema/upload/import-export request and response assumptions.

## [1.2.0] - 2026-01-26

### Added
- **AI Assistant**: New conversational agent for generating rules and streams.
- **Query Designer (Beta)**: Initial scaffolding for a visual rule builder (Shop Floor Edition).
- **Swagger API Playground**: Interactive documentation for eKuiper APIs.
- **Rule Tracing**: Visual debugging for rule execution paths.

### Changed
- **Persistence**: Switched default persistence to Browser Local Storage for easier onboarding.
- **UI**: Improved connection status indicators and dialogs.

### Fixed
- Fixed memory leaks in development environment during compilation.
- Fixed production build by forcing Webpack over Turbopack for custom configurations.
- Fixed security vulnerability (js/resource-exhaustion) in MQTT debug API by capping timeouts.
- Improved EMQX connection stability.
