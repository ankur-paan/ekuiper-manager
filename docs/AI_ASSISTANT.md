# Operator assistant

The optional operator assistant is available from every authenticated Manager page, including the
visual rule designer. It uses the current route, page title, selected node name/version, visible labels,
status text, and visible form values to explain options in context.

Replies render safe GitHub-flavoured Markdown, including headings, lists, tables, links, and fenced
code. Raw HTML is ignored and remote images are not loaded. The latest reply includes up to three
related follow-up questions that can be clicked or ignored while the free-text composer remains available.

It is intentionally human-in-the-loop:

- It cannot click controls or call eKuiper APIs.
- It cannot save, start, stop, delete, import, install, or otherwise mutate a resource.
- It labels destructive or runtime-impacting steps for human review.
- It treats the page snapshot as untrusted data, not model instructions.
- It warns that generated SQL, JSON, and operational advice must be reviewed.

## Enable a provider

The base Compose stack keeps the feature disabled, so self-hosting does not require an AI account or
an additional container. Configure an OpenAI-compatible chat-completions endpoint in `.env`:

```dotenv
AI_ASSISTANT_ENABLED=true
AI_API_URL=https://api.example.com/v1
AI_API_KEY=replace-with-provider-key
AI_MODEL=replace-with-provider-model-id
AI_TIMEOUT_MS=30000
AI_MAX_TOKENS=1200
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

`AI_MAX_TOKENS` is bounded to 16-4,096. Lower it for a constrained test key or small local model; the
1,200 default leaves room for useful operator guidance.

## Data boundary

When the user sends a message, the browser creates a bounded text snapshot from the current `<main>`
region. Hidden controls are omitted. Password/file/hidden inputs are omitted or redacted, fields whose
name or label looks secret are redacted, and JSON/free text is scrubbed for common password, token,
authorization, credential, API-key, private-key, bearer-token, and URL-credential forms. The server
applies the same redaction again.

Limits are enforced server-side: 12 conversation messages, 4,000 characters per message, 16,000
characters per conversation, and 8,000 characters of screen context. A user may send 20 assistant
requests per minute. The provider, model, and credentials cannot be selected by the browser.

The audit trail records only the actor, page path, selected model name, result, and error class. It does
not record prompts, visible page data, completions, provider URLs, or provider credentials.

The redaction layer is defence in depth, not a reason to paste secrets into chat. Operators should keep
passwords, raw authorization headers, tokens, keys, and credential-bearing configuration out of their
messages.

## Failure behavior

- Disabled or incomplete configuration returns `AI_ASSISTANT_DISABLED` without affecting other pages.
- Provider timeouts return a bounded timeout message.
- Rate limits and upstream failures are mapped to Manager errors without returning the provider body.
- Redirects from the configured provider endpoint are rejected.
- Conversation text is rendered as plain text rather than provider-supplied HTML.
