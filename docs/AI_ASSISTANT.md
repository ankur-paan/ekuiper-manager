# Read-only operations agent

The optional operations agent is available from every authenticated Manager page, including the visual
rule designer. It combines the current route, page title, selected node, visible labels/status/form
values, sanitized Manager database reads, and allowlisted GET requests to the selected eKuiper node.

Unlike a one-shot page chatbot, the agent can choose several independent reads in parallel, inspect
their results, make dependent follow-up reads, and only then answer. Each reply can expose a compact
investigation timeline so the operator can see which sanitized sources were consulted without exposing
raw tool inputs, responses, or credentials.

Replies render safe GitHub-flavoured Markdown, including headings, lists, tables, links, and fenced
code. Raw HTML is ignored and remote images are not loaded. The latest reply includes up to three
related follow-up questions that can be clicked or ignored while the free-text composer remains available.

It is intentionally read-only and human-in-the-loop:

- It cannot click controls or call any mutation endpoint.
- It cannot save, create, update, start, stop, delete, reset, import, install, or otherwise mutate a resource.
- It has no arbitrary SQL tool, arbitrary URL tool, shell, browser automation, or general HTTP method.
- It uses the signed-in Manager user's permissions. Only owners receive user/session/audit/migration tools.
- It labels destructive or runtime-impacting steps for human review.
- It treats both the page snapshot and tool results as untrusted data, not model instructions.
- It warns that generated SQL, JSON, and operational advice must be reviewed.

## Read tools

The server owns every schema and query. Model-supplied names and JSON arguments are validated before
execution, and all database statements are fixed and parameterized.

| Tool | Visibility | Sanitized data |
| --- | --- | --- |
| `manager_overview` | All signed-in users | Manager/Node/PostgreSQL versions and health, migrations, size, bounded counts |
| `manager_nodes` | All signed-in users | Node URL/status/version/capabilities/check state; only a boolean for configured private authentication |
| `ekuiper_read` | All signed-in users | Allowlisted GET routes on the selected node |
| `manager_users` | Owner | Lifecycle fields; never `password_hash` |
| `manager_sessions` | Owner | User and session state/timestamps; never `token_hash` or cookies |
| `manager_audit_events` | Owner | Bounded filtered events with recursive secret redaction |
| `manager_migrations` | Owner | Migration name and application time; checksum omitted |

`ekuiper_read` covers the read side of streams, tables, rules and status/topology/schema/explain,
traces, shared connections, schemas, native/portable plugins and status, metadata, services/functions,
JavaScript UDFs, uploads, import status/tasks, and metrics-dump availability. Its path is matched against
fixed route patterns and rebuilt from encoded segments against the server-selected node URL. Write
routes, rule tests, exports/dumps, and other binary or side-effecting operations are absent.

Some eKuiper read responses (notably connections and metadata YAML) may contain embedded credentials.
Every tool result is recursively secret-redacted before it can enter model context, independent of the
redaction already applied by the browser and proxy.

## Enable a provider

The base Compose stack keeps the feature disabled, so self-hosting does not require an AI account or
an additional container. Configure an OpenAI-compatible chat-completions endpoint in `.env`:

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

Then apply the configuration:

```bash
docker compose up -d --build manager
```

When `AI_API_URL` ends in `/v1`, the Manager appends `/chat/completions`; a full operation URL is also
accepted. OpenRouter documents the current chat-completions request shape at
<https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request>. A self-hosted or
local provider can use another HTTP(S) endpoint; `AI_API_KEY` can be blank when that endpoint does not
require authentication. `OPENROUTER_API_KEY` remains a supported server-side fallback for older local
installations, but `AI_API_KEY` is the preferred setting.

`AI_MAX_TOKENS` is bounded to 16-4,096. `AI_TIMEOUT_MS` limits each provider turn, while
`AI_AGENT_TIMEOUT_MS` bounds the entire multi-turn investigation. The server permits 1-8 tool rounds
and 1-32 executed calls; defaults are six rounds and 16 calls. A final no-tools turn asks the model to
answer from collected evidence when either budget is reached.

The configured OpenAI-compatible endpoint must implement Chat Completions function/tool calling. A
provider that rejects tool schemas cannot serve this operations-agent endpoint.

After configuring `.env`, verify tool-call compatibility without sending any Manager or eKuiper data:

```bash
npm run ai:check
```

The check exposes one synthetic read tool, returns a synthetic fixture, and verifies that the provider
continues to a final answer. It prints capability status and the resolved model, never the key, URL,
tool arguments, or response text.

## Data boundary

When the user sends a message, the browser creates a bounded text snapshot from the current `<main>`
region. Hidden controls are omitted. Password/file/hidden inputs are omitted or redacted, fields whose
name or label looks secret are redacted, and JSON/free text is scrubbed for common password, token,
authorization, credential, API-key, private-key, bearer-token, and URL-credential forms. The server
applies the same redaction again.

Limits are enforced server-side: 12 conversation messages, 4,000 characters per message, 16,000
characters per conversation, 8,000 characters of screen context, 8,000 characters of tool arguments,
24,000 characters per tool result, 96,000 characters across tool results, and 256 KiB read from one
eKuiper response. A user may send 20 assistant requests per minute. The provider, model, tools, node
selection, credentials, SQL, routes, methods, and budgets cannot be selected or expanded by the browser.

The audit trail records only the actor, page path, selected model name, result/error class, round/call
counts, and tool names. It does not record prompts, arguments, tool results, visible page data,
completions, provider URLs, node authorization, or provider credentials.

The redaction layer is defence in depth, not a reason to paste secrets into chat. Operators should keep
passwords, raw authorization headers, tokens, keys, and credential-bearing configuration out of their
messages.

## Failure behavior

- Disabled or incomplete configuration returns `AI_ASSISTANT_DISABLED` without affecting other pages.
- Provider timeouts return a bounded timeout message.
- Rate limits and upstream failures are mapped to Manager errors without returning the provider body.
- Redirects from the configured provider endpoint are rejected.
- Individual tool failures are returned to the model as structured failures so it can try another read.
- A global deadline, round limit, call limit, per-result limit, and aggregate context limit prevent runaway investigations.
- Conversation text is rendered as plain text rather than provider-supplied HTML.

## Architecture and trade-offs

The browser sends conversation and redacted page context to one authenticated same-origin API. The
server builds the system prompt and role-specific tool catalog, calls the provider, executes any valid
read requests, appends bounded tool results, and repeats until the provider answers or the budget is
exhausted. Independent requests from one provider turn run concurrently; dependent reads happen in a
later turn.

This direct-tool harness is deliberately smaller and easier to audit than arbitrary code execution or a
database SQL agent. It costs more provider turns for long investigations and has a finite route catalog,
but it makes the non-mutation boundary enforceable in ordinary TypeScript. Revisit progressive tool
discovery or sandboxed code-mode only if the eKuiper read catalog becomes too large for provider context;
do not add it merely to reduce prompt size. Streaming, persisted chat memory, charts, and approved write
tools are separate future decisions, not implicit capabilities of this agent.
