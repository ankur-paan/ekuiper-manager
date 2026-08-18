# eKuiper Manager

[![Build Status](https://github.com/ankur-paan/ekuiper-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/ankur-paan/ekuiper-manager/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/ankur-paan/ekuiper-manager)](https://github.com/ankur-paan/ekuiper-manager/releases/latest)
[![License: IOSL](https://img.shields.io/badge/License-IDACS%20Open%20Source-green.svg)](LICENSE)
[![eKuiper](https://img.shields.io/badge/eKuiper-2.4.1-orange)](https://ekuiper.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Live API Docs](https://img.shields.io/badge/Live-API%20Docs-purple)](https://ankur-paan.github.io/ekuiper-manager/)

> **🚀 An open-source, self-hosted web UI and manager for [LF Edge eKuiper](https://ekuiper.org/) — because the community deserves an operator stack it can own.**

eKuiper Manager is a community-driven management workspace for the lightweight IoT stream-processing engine. It combines a visual operator UI, a complete eKuiper API reference, local account and node management, and an optional read-only operations agent in one installable stack.

**Developed and maintained by [I-Dacs Labs](https://i-dacs.com)**

📧 [measure@i-dacs.com](mailto:measure@i-dacs.com) · 🌐 [i-dacs.com](https://i-dacs.com) · 💼 [LinkedIn](https://www.linkedin.com/company/110770924)

---

## 🎯 Why This Project?

The eKuiper engine is open source, but operators still need an approachable way to install it, understand it, and manage its full lifecycle. Existing commercial management products are closed source and cannot serve as a community-owned foundation.

This project fills that gap with a manager that is:

- **Open and extensible** — the UI, API contract, deployment stack, and roadmap are public.
- **Self-hosted** — Manager, eKuiper, and a private PostgreSQL sidecar start together.
- **Faithful to eKuiper** — the bundled OpenAPI reference is audited against official eKuiper v2.4.1 routes, source, and tests.
- **Safe by default** — credentials stay server-side, stored secrets are encrypted, and the browser cannot choose arbitrary proxy destinations.
- **Useful without a cloud account** — AI assistance is optional and disabled by default.

---

## 📋 Feature Status

### ✅ Fully Built and Working

| Feature | Description |
| --- | --- |
| **One-command self-hosted stack** | Docker Compose starts eKuiper Manager, official eKuiper 2.4.1, and a private PostgreSQL 17 sidecar. Only the Manager port is published. |
| **Local account lifecycle** | First-owner setup, sign in/out, user creation, forced first-password change, password reset, session revocation, and user deletion. |
| **Server-side node registry** | Add, probe, select, and delete eKuiper nodes without exposing stored authorization values to the browser. |
| **Streams and tables** | Create, inspect, edit, and delete SQL-defined stream and table resources. |
| **Rule lifecycle** | Validate, create, edit, duplicate, start, stop, restart, and delete rules from a unified workspace. |
| **Visual rule designer** | Assemble rule inputs, SQL, and ordered actions visually; inspect generated eKuiper SQL/JSON; validate before creating. |
| **Rule diagnostics** | Status, topology, output schema, explain plan, trace controls, and trace results live together in the rule workspace. |
| **Resources** | Shared connections, installed connector metadata, protobuf/custom schemas, schema upload, and managed uploads. |
| **Extensions** | Native and portable plugins, portable status, UDF symbols, JavaScript UDFs, and external services. |
| **Import and export** | Direct eKuiper configuration export and import through the node-scoped proxy. |
| **Swagger API playground** | Interactive OpenAPI reference covering the 98 paths and 140 management operations registered by eKuiper v2.4.1. |
| **Read-only operations agent** | Optional permission-aware assistant that correlates sanitized Manager/PostgreSQL records with allowlisted live reads from the selected eKuiper node. |
| **Production safety baseline** | Encrypted node credentials, hashed sessions, same-origin mutation checks, SSRF controls, recursive secret redaction, audit events, non-root container, and read-only filesystem. |

### 🔶 Functional but Still Being Expanded

| Feature | Current state | Remaining work |
| --- | --- | --- |
| **Node health and compatibility** | Node probe, selection, version, and current health are available. | Build/edition capability detection, health history, and component-aware degraded states. |
| **Metadata-driven connector forms** | Connections and installed source/sink metadata are visible. | Generate progressive forms from installed eKuiper metadata and support in-context dependency creation. |
| **Advanced rule administration** | Core lifecycle, workspace diagnostics, and safe duplication work. | Rule tests, tag management, bulk controls, reset state, and richer metrics UX. |
| **Backup and recovery** | Documented PostgreSQL backup/restore and eKuiper configuration transfer work. | Guided backup, restore preflight, owner recovery, key rotation, upgrade, rollback, and uninstall commands. |
| **Streaming diagnostics** | Standard node-scoped HTTP, binary, and multipart transport is supported. | Separate-port rule-test SSE and WebSocket transport. |
| **Capability-aware navigation** | The UI is organized around Data, Rules, Resources, Extensions, Operations, and Manager administration. | Hide or explain APIs unavailable in core, script-disabled, or differently configured eKuiper builds. |

### 🚧 Under Development

| Area | Priority | Goal |
| --- | --- | --- |
| **Stable self-hosted lifecycle** | High | Tested backup, restore, upgrade, rollback, owner recovery, diagnostics, and uninstall procedures. |
| **Connector authoring UX** | High | Common-first dynamic forms, advanced sections, write-only secrets, reusable configurations, and unsaved-change protection. |
| **Complete rule operations** | High | Rule-test SSE, tags, bulk actions, reset state, bounded metrics, and more failure fixtures. |
| **Capability model** | High | Detect the connected eKuiper version/build once and gate every route and action consistently. |
| **Operational history** | Medium | Health history, audit exploration, bounded logs, and recursively redacted diagnostic bundles. |
| **Extension trust** | Medium | Plugin source review, checksum/signature verification, compatibility checks, progress, and rollback. |
| **Guided first rule** | Medium | Optional local tutorial with automatic cleanup and no public-service dependency. |

See the living [development plan](DEVELOPMENT_PLAN.md) for tracked outcomes, gaps, and adoption decisions.

---

## 🛣️ Development Roadmap

### Phase 1 — Installable Community Stack (`v1.3.0`)

- ✅ One Docker Compose command for Manager, eKuiper, and PostgreSQL.
- ✅ Durable checked SQL migrations and named volumes.
- ✅ Local owner/user lifecycle and encrypted server-side node registry.
- ✅ Core streams, tables, rules, resources, extensions, and transfer flows.
- ✅ Official eKuiper v2.4.1 OpenAPI baseline: 98 paths and 140 operations.
- ✅ Global read-only, tool-calling operations agent with strict data boundaries.
- ✅ CI quality gates, official-stack browser tests, persistence checks, and CodeQL.

### Phase 2 — Stable Operator Lifecycle

- ⏳ Backup, restore, upgrade, rollback, owner recovery, key rotation, and uninstall tooling.
- ⏳ eKuiper-aware readiness, build capability detection, and compatibility reporting.
- ⏳ Broader security, proxy, migration, and upgrade test matrices.
- ⏳ Separate-port SSE and WebSocket support without widening the node allowlist.

### Phase 3 — Metadata-Driven Authoring

- ⏳ Installed-connector catalog with metadata-generated source and sink forms.
- ⏳ Reusable source configuration keys and sink templates created without losing drafts.
- ⏳ Complete rule test, tags, bulk lifecycle, reset-state, and import-preview workflows.
- ⏳ Consistent dirty-state protection and version-aware official documentation links.

### Phase 4 — Advanced Operations

- ⏳ Historical health and metrics views.
- ⏳ Safe diagnostic bundles and bounded component logs.
- ⏳ Verified plugin supply-chain workflow.
- ⏳ Optional guided onboarding and deeper local automation.

---

## 🚀 Quick Start

### Prerequisites

- Docker Engine or Docker Desktop with Compose support.
- Git, if you are installing from the repository.

### Installation

```bash
git clone https://github.com/ankur-paan/ekuiper-manager.git
cd ekuiper-manager
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000), create the first owner account, and sign in. The bundled eKuiper node is registered automatically.

Check the stack:

```bash
docker compose ps
curl --fail http://localhost:3000/health/ready
```

Stop the stack without deleting data:

```bash
docker compose down
```

Start it again with `docker compose up -d`. Users, nodes, eKuiper configuration, data, logs, and plugins remain in named volumes.

### Connect Another eKuiper Node

1. Open **Manager → Nodes**.
2. Add a name, the node's server-reachable URL, and optional raw `Authorization` value.
3. Test the connection.
4. Save and select the node.

The Manager stores authorization values encrypted and never returns them to the browser.

---

## ⚙️ Configuration

The base stack works without an environment file. Add optional overrides to `.env` beside `compose.yaml`:

```dotenv
MANAGER_PORT=3000
MANAGER_ORIGIN=http://localhost:3000
SESSION_TTL_HOURS=12
EKUIPER_API_TIMEOUT=30000
POSTGRES_PASSWORD=replace-for-managed-networks

# Optional: replace the bundled PostgreSQL sidecar.
# MANAGER_DATABASE_URL=postgres://user:password@database.example/ekuiper_manager
```

If `MANAGER_PORT` changes, set `MANAGER_ORIGIN` to the browser-visible origin. The bundled database is private and is not published by the supplied Compose file.

Legacy experimental `DATABASE_URL=file:...` values are intentionally ignored by Compose. Use `MANAGER_DATABASE_URL` only when deliberately replacing the sidecar.

### Optional Read-Only Operations Agent

The agent requires an OpenAI-compatible Chat Completions provider with tool-calling support. It is disabled by default and does not add another service to the base stack.

```dotenv
AI_ASSISTANT_ENABLED=true
AI_API_URL=https://api.example.com/v1
AI_API_KEY=replace-with-provider-key
AI_MODEL=replace-with-provider-model-id
AI_TIMEOUT_MS=30000
AI_AGENT_TIMEOUT_MS=90000
AI_MAX_TOKENS=1200
AI_MAX_TOOL_ROUNDS=6
AI_MAX_TOOL_CALLS=16
```

Run `npm run ai:check` before enabling an unfamiliar provider. `AI_API_KEY` may be empty for a trusted local endpoint that does not require authentication.

The provider key, prompts, tool arguments/results, and completions are not returned by the status API or written to the audit log. See [AI Assistant and Operations Agent](docs/AI_ASSISTANT.md) for the complete boundary.

---

## 💾 Backup, Restore, and Upgrade

Create a Manager database backup:

```bash
docker compose exec -T database pg_dump -U ekuiper_manager -d ekuiper_manager -Fc > ekuiper-manager.dump
```

Use **Operations → Export** for eKuiper configuration and keep both artifacts together. The Manager encryption key lives in the `manager_state` volume; encrypted node authorization values cannot be recovered without it.

Restore the Manager database into a stopped or empty installation:

```bash
docker compose up -d database
docker compose exec -T database pg_restore --clean --if-exists -U ekuiper_manager -d ekuiper_manager < ekuiper-manager.dump
docker compose up -d
```

Restore eKuiper configuration from **Operations → Import** after signing in. Test restore procedures before relying on a backup.

Upgrade after taking a backup:

```bash
git pull --ff-only
docker compose up -d --build
```

The Manager obtains a migration lock and applies committed migrations before accepting traffic. Startup fails if an already-applied migration has been changed.

---

## 📚 Documentation

- [Interactive eKuiper v2.4.1 API reference](https://ankur-paan.github.io/ekuiper-manager/)
- [Development plan and backlog](DEVELOPMENT_PLAN.md)
- [AI Assistant and Operations Agent](docs/AI_ASSISTANT.md)
- [Original eKuiper Manager UX audit](docs/ORIGINAL_MANAGER_UX_AUDIT.md)
- [NeuronEX teardown analysis](docs/NEURONEX_TEARDOWN_ANALYSIS.md)
- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)

---

## 🤝 Contributing — Let's Build This Together!

This project needs community experience across eKuiper connectors, industrial protocols, operations, accessibility, and deployment environments.

### Priority Contribution Areas

| Area | Difficulty | Impact |
| --- | --- | --- |
| **Connector metadata and forms** | Medium–High | 🔥🔥🔥 Exercise Kafka, SQL, Redis, HTTP, EdgeX, and other installed connectors; improve generated controls and fixtures. |
| **Backup and recovery lifecycle** | Medium–High | 🔥🔥🔥 Make upgrade, rollback, recovery, and diagnostics safe and testable on clean hosts. |
| **Advanced rule operations** | Medium | 🔥🔥🔥 Add rule test, tag/bulk/reset flows, and real-world failure cases. |
| **UI and accessibility** | Easy–Medium | 🔥🔥 Improve forms, empty/error states, keyboard paths, responsive layouts, and guidance. |
| **Testing** | Medium | 🔥🔥 Expand official-image integration, browser, security, migration, and compatibility coverage. |
| **Documentation** | Easy | 🔥 Add connector examples, tutorials, troubleshooting, and operator runbooks. |

### How to Contribute

1. Fork the repository.
2. Create a focused branch from `main`.
3. Add tests for behavior changes.
4. Run the quality gates.
5. Update affected documentation.
6. Open a pull request.

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

---

## 🔌 Tech Stack

| Technology | Purpose |
| --- | --- |
| **Next.js 16 + React 19** | Full-stack application and App Router UI. |
| **TypeScript 5** | Type-safe application and eKuiper client contracts. |
| **Tailwind CSS + Radix UI** | Responsive styling and accessible UI primitives. |
| **Monaco Editor** | eKuiper SQL and structured definition editing. |
| **TanStack Query and Table** | Server-state coordination and resource tables. |
| **Zustand** | Focused client-side workspace state. |
| **PostgreSQL 17** | Durable Manager users, sessions, nodes, audit events, and migrations. |
| **LF Edge eKuiper 2.4.1** | Bundled stream-processing engine and audited API baseline. |
| **Docker Compose** | One-command installation, private networking, health checks, and volumes. |
| **Jest + Playwright** | Unit, coverage, browser lifecycle, responsive navigation, and persistence tests. |
| **OpenAI-compatible API** | Optional read-only operations agent with iterative tool calling. |

---

## 📁 Project Structure

```text
src/
├── app/                    # Next.js pages and server API routes
├── components/             # Layout, resources, rules, designer, assistant, and UI
└── lib/
    ├── assistant/          # Read-only agent, tools, budgets, and redaction
    ├── auth/               # Local users, sessions, passwords, and authorization
    ├── db/                 # PostgreSQL access and Manager persistence
    └── ekuiper/            # Audited node-scoped eKuiper client and wire handling
database/
└── migrations/             # Ordered, checksummed SQL migrations
public/
└── ekuiper-openapi.json    # Canonical eKuiper v2.4.1 OpenAPI contract
e2e/                        # Official-stack Playwright journeys and fixtures
scripts/                    # Migrations, OpenAPI validation, and AI provider checks
compose.yaml                # Manager + eKuiper + private PostgreSQL stack
```

---

## 🧪 Development

Requirements: Node.js 22.20 or newer and Docker Compose.

```bash
npm ci
docker compose up -d database ekuiper
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Quality gates:

```bash
npm run lint
npm run type-check
npm run test:coverage
npm run validate:openapi
npm run build
```

---

## 🔐 Security Model

- Browsers select a registered node ID; they cannot submit a proxy destination URL.
- Node authorization values are encrypted with AES-256-GCM and are never returned.
- Session tokens are random, stored only as hashes, and sent in `HttpOnly`, `SameSite=Strict` cookies.
- Passwords use the Node.js `scrypt` implementation.
- Mutating browser requests require the configured same origin.
- eKuiper destinations are DNS-checked on every request; redirects and unsafe address classes are rejected.
- Connection and metadata responses are recursively redacted for common secret fields.
- Agent page/tool context is bounded and recursively redacted; privileged Manager readers remain owner-only, and eKuiper tools use an explicit GET allowlist.
- The Manager container runs as a non-root user with a read-only filesystem and dropped capabilities.

This is intentionally a single-installation manager. Organizations, tenancy, external identity providers, billing, and configurable fine-grained RBAC are outside the current scope.

Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.

---

## 📄 License

This project is licensed under the **IDACS Open Source License (IOSL) v1.0** — see [LICENSE](LICENSE).

**Key points:**

- ✅ Free to use, modify, merge, distribute, sublicense, and sell.
- ✅ Commercial and production use are permitted without fees or royalties.
- 📧 Organizations with annual turnover above USD $1,000,000 using the software in production are kindly requested to notify [measure@i-dacs.com](mailto:measure@i-dacs.com); notification is not permission.
- 🏷️ The I-Dacs Labs attribution must be preserved in copies and substantial portions.

---

## 🙏 Acknowledgments

- [LF Edge eKuiper](https://ekuiper.org/) — the open-source edge stream-processing engine this project manages.
- [EMQ](https://www.emqx.com/) — original developers and maintainers of eKuiper.
- [Next.js](https://nextjs.org/) — the full-stack React framework.
- [PostgreSQL](https://www.postgresql.org/) — the durable Manager data store.
- [Swagger UI](https://swagger.io/tools/swagger-ui/) — the interactive API reference foundation.
- Every contributor testing connectors, reporting gaps, improving the UX, or strengthening the self-hosted lifecycle.

---

## ⭐ Star This Repository!

If eKuiper Manager is useful to you, please give the repository a star. It helps other operators find the project and shows where the community wants investment.

---

**Developed by [I-Dacs Labs](https://i-dacs.com)**

📧 [measure@i-dacs.com](mailto:measure@i-dacs.com) · 🌐 [i-dacs.com](https://i-dacs.com) · 💼 [LinkedIn](https://www.linkedin.com/company/110770924)

*Building the future of Industrial IoT together.*
