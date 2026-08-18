# eKuiper Manager

eKuiper Manager is a self-hosted operator workspace for eKuiper. It provides a small local user lifecycle, a server-owned node registry, and everyday create/read/update/delete and runtime flows without exposing eKuiper credentials to the browser.

The default installation contains the Manager, eKuiper 2.4.1, and its private data store. Only the Manager port is published.

## Install

Requirements: Docker with Compose support.

```bash
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000), create the owner account, and sign in. The bundled eKuiper node is registered automatically.

Check the installation:

```bash
docker compose ps
curl --fail http://localhost:3000/health/ready
```

Stop the stack without deleting data:

```bash
docker compose down
```

Start it again with the same command. Users, node settings, eKuiper data, logs, and plugins are held in named volumes.

## Daily workflows

- Overview: selected-node health, version, uptime, resource counts, and rule state.
- Data: stream and table lifecycle using exact eKuiper SQL.
- Rules: validate, create, edit, start, stop, restart, delete, inspect status, topology, output schema, explain plan, and traces.
- Designer: visually assemble a rule, inspect the generated eKuiper SQL/JSON, validate it, then make an explicit create decision.
- Resources: shared connections, installed connector metadata, schemas, and uploaded files.
- Extensions: native and portable plugins, functions, and services.
- Operations: eKuiper import and export.
- Manager: add/check/select/delete nodes; add/reset/delete local users; change your password.
- Operations agent: investigate sanitized Manager/PostgreSQL state and the selected eKuiper node from every authenticated page. It can correlate multiple live reads but has no mutation tools.

Owner accounts manage users and nodes. Ordinary users operate the selected eKuiper node. A password reset revokes all sessions and produces a one-time password that must be changed after sign-in.

## Configuration

Compose works without an environment file. These optional values can be supplied in `.env` beside `compose.yaml`:

```dotenv
MANAGER_PORT=3000
MANAGER_ORIGIN=http://localhost:3000
SESSION_TTL_HOURS=12
EKUIPER_API_TIMEOUT=30000
POSTGRES_PASSWORD=replace-for-managed-networks
# Optional: use an externally operated PostgreSQL database instead of the sidecar.
# MANAGER_DATABASE_URL=postgres://user:password@database.example/ekuiper_manager
```

If `MANAGER_PORT` changes, set `MANAGER_ORIGIN` to the browser-visible origin. The database is not published by the supplied Compose file.
The database password is passed as a discrete PostgreSQL setting, so punctuation does not require URL encoding.
Legacy experimental `DATABASE_URL=file:...` entries are deliberately ignored by Compose. Use
`MANAGER_DATABASE_URL` only when intentionally replacing the bundled database.

The optional read-only operations agent uses an OpenAI-compatible Chat Completions endpoint with tool
calling. It can correlate sanitized Manager records with live state from the selected eKuiper node over
multiple reads, but has no write tools. It is off by default and adds no service to the base stack. To
enable it, add these server-side values to
`.env` and restart the Manager:

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

`AI_API_KEY` may be empty for a trusted local endpoint that does not require authentication. The key,
provider URL, prompts, tool arguments/results, and completions are never returned by the status API or
written to the audit log.
See [docs/AI_ASSISTANT.md](docs/AI_ASSISTANT.md) for the data boundary and deployment options.

The Manager encryption key is generated on first startup and stored in the `manager_state` volume. Keep that volume with database backups; encrypted eKuiper Authorization values cannot be recovered without it.

## Backup and restore

Create a Manager database backup:

```bash
docker compose exec -T database pg_dump -U ekuiper_manager -d ekuiper_manager -Fc > ekuiper-manager.dump
```

Use Operations → Export for eKuiper configuration. Keep both artifacts together.

Restore the Manager database into a stopped/empty installation:

```bash
docker compose up -d database
docker compose exec -T database pg_restore --clean --if-exists -U ekuiper_manager -d ekuiper_manager < ekuiper-manager.dump
docker compose up -d
```

Restore eKuiper configuration from Operations → Import after signing in. Test restore procedures before relying on a backup.

## Upgrade

Back up first, then rebuild and restart:

```bash
git pull --ff-only
docker compose up -d --build
```

The Manager obtains a migration lock and applies committed migrations before accepting traffic. Startup fails if an already-applied migration has been changed.

## Security model

- Browser requests select a registered node ID; they cannot submit a destination URL.
- Node Authorization values are encrypted with AES-256-GCM and are never returned.
- Session tokens are random, stored only as hashes, and sent in HttpOnly, Strict SameSite cookies.
- Passwords use the Node.js scrypt implementation.
- Mutating browser requests require the configured same origin.
- eKuiper destinations are DNS-checked on every request; redirects and unsafe address classes are rejected.
- Connection and metadata responses are recursively redacted for common secret fields.
- Operations-agent context is collected only when a user sends a message. Page and tool data are bounded and recursively redacted; provider keys stay server-side, privileged Manager readers remain owner-only, and eKuiper access is restricted to an explicit GET allowlist.
- The Manager container runs as a non-root user with a read-only filesystem and dropped capabilities.

## Development

Requirements: Node.js 22.20 or newer and Docker Compose.

```bash
npm install
docker compose up -d database ekuiper
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Quality gates:

```bash
npm run lint
npm run type-check
npm test
npm run validate:openapi
npm run build
```

The canonical eKuiper 2.4.1 OpenAPI document is `public/ekuiper-openapi.json`. The documentation workflow publishes the static API reference from the same repository. The Manager transport and client are kept node-scoped and media-type preserving so JSON, text, binary export, and multipart operations use the same audited contract.

## Scope

This is intentionally a single-installation Manager. It does not provide organisations, tenancy, external identity providers, billing, or fine-grained permission policies. The stable account model is owner/user, and the stable node model is registered/selectable eKuiper installations.
