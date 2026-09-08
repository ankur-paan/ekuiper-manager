# Flow Studio Rule-Test Transport Notes (FS-0106)

Capability-only verification ticket: no SSE proxy was implemented here and no
network allowlist was weakened. Conclusion: `ruleTest` and `ruleTestSse` in
`TargetCapabilityProfile` resolve to `false` on every profile until the
blockers below are solved by a later ticket.

## 1. Audited eKuiper contract

Authoritative source: `public/ekuiper-openapi.json`
(`x-ekuiper-version: "2.4.1"`, tag
`https://github.com/lf-edge/ekuiper/tree/v2.4.1`, default REST listener
`http://localhost:9081` under `servers`).

Rule-test endpoints (tag `"Rule Test"` — "Temporary ten-minute rule trial
runs. SSE results use the separately configured HTTP server port."):

| Method + path | Operation | Notes |
| --- | --- | --- |
| `POST /ruletest` | `createRuleTest` | Body `RuleTestRequest` (`{id, sql, mockSource?, sinkProps?}` — `sql` is required). Returns `{"id":"uuid","port":10081}` written as JSON with a `text/plain` Content-Type. The test rule is not persisted and is cleared after ten minutes. |
| `POST /ruletest/{name}/start` | `startRuleTest` | Starts the temporary test rule. |
| `DELETE /ruletest/{name}` | `deleteRuleTest` | Stops and deletes the temporary test rule. |

Upstream sources recorded on each operation (`x-ekuiper-source`):

- `https://github.com/lf-edge/ekuiper/blob/v2.4.1/internal/server/rest.go`
- `https://github.com/lf-edge/ekuiper/blob/v2.4.1/docs/en_US/api/restapi/ruletest.md`

### SSE transport requirement

`POST /ruletest` description (quoted from the audited spec):

> "Connect to the returned port using SSE at /test/{id}, then start the test
> rule."

So result streaming is `GET /test/{id}` served over Server-Sent Events on the
**separate, per-test port** returned in the create response (example
`"port": 10081`) — not on the main REST port (`9081`). There is no audited
same-port SSE route for test output in this spec version.

## 2. Current Manager transport constraints

- Registered nodes are origin-only: `normalizeNodeUrl` in `src/lib/network.ts`
  rejects credentials, query strings, fragments, and any path, returning
  `url.origin` (scheme + host + main REST port).
- The eKuiper proxy in `src/app/api/ekuiper/[[...path]]/route.ts` derives every
  upstream target as `new URL(path, node.baseUrl)` and re-checks
  `assertSafeNodeDestination` (`src/lib/network.ts`, DNS + SSRF controls).
  Its `allowedRoots` set already contains `ruletest`, so `POST /ruletest`,
  `POST /ruletest/{name}/start`, and `DELETE /ruletest/{name}` can travel the
  existing same-origin proxy on the main REST port (also see
  `createRuleTest`/`startRuleTest`/`deleteRuleTest` in
  `src/lib/ekuiper/client.ts`, which call through `/api/ekuiper`).
- Nothing in the proxy can dial the dynamic per-test SSE port: the port comes
  back inside an eKuiper response body, and the proxy never substitutes a
  response-supplied or browser-supplied host/port into the upstream target.
  Reaching `GET /test/{id}` on that port would require either accepting an
  arbitrary host/port from the browser or adding a dedicated server-side SSE
  relay — both are new attack surface, explicitly out of scope for this ticket
  ("Do not implement SSE proxy yet").

No allowlist, proxy-root, or `normalizeNodeUrl` change was made in FS-0106.

## 3. Blockers for FS-0107 and later test work

1. **SSE port unreachable under current policy.** Consuming trial output
   requires a new audited SSE relay design (separate-port dialing, per-test
   port validation, timeouts, byte/event budgets, cancellation) that does not
   weaken `assertSafeNodeDestination` or let the browser choose upstream
   destinations.
2. **No audited graph-rule test envelope.** `RuleTestRequest` requires `sql`;
   no `RuleGraph` (or other compiled-artifact) test shape is proven by
   `public/ekuiper-openapi.json`. Flow Studio compiles to eKuiper graph rules,
   so the exact test-request body for a compiled flow is still unproven.
3. **No SSE consumer exists.** `src/lib/ekuiper/client.ts` covers only the
   main-port create/start/delete calls; nothing streams or bounds SSE output.

## 4. Capability resolution

- `src/lib/flows/capabilities/types.ts`: `TargetCapabilityProfile` gains
  optional `ruleTest` / `ruleTestSse` (optional so pre-FS-0106 literals still
  type-check; absent means "unproven", never "supported").
- `src/lib/flows/capabilities/resolve-capabilities.ts`: both resolve to
  `false` in every branch, including the reachable audited-baseline branch.
- Tests in `src/lib/__tests__/flow-capabilities.test.ts` assert
  `ruleTest === false` and `ruleTestSse === false` across baseline, newer,
  unreachable, below-baseline, and metadata-narrowed profiles.

FS-0107 may proceed only if a later design solves blockers 1–2 within the
existing registered-node policy; otherwise it must be marked BLOCKED without
code changes.
