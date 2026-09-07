# Flow Studio — Beta Release Acceptance Report (FS-0138)

Evidence-only beta record for Flow Studio as implemented in this checkout.
No behavior is changed by this ticket. Claims below cite the exact file or
command they were verified against. Anything not yet measured is listed
under Known blockers / limitations instead of being asserted.

Related references:

- `docs/FLOW_STUDIO.md` — beta user/operator guide (FS-0136).
- `docs/FLOW_STUDIO_ARCHITECTURE.md` — locked architecture boundaries.
- `docs/FLOW_EXTENSIONS.md` — declarative extension author guide.
- `docs/FLOW_STUDIO_PERFORMANCE.md` — canvas performance decision and smoke budgets.
- `docs/FLOW_STUDIO_RULE_TEST_NOTES.md` — why rule-test trial runs are unavailable.

## 1. Checkout under test

| Item | Evidence |
| --- | --- |
| HEAD commit | `37ae82d` — `FS-0136: Add production beta checklist/documentation` (`git log --oneline -1`) |
| Commit date | 2026-09-08 (`git log -1 --format=%ad --date=iso`) |
| Manager version | `1.3.0` (`package.json`) |
| Next.js / React | `16.2.11` / `19.x` (`package.json`) |
| Canvas library | `@xyflow/react 12.11.6` (`package.json`) |
| Toolchain in this environment | Node `v22.20.0`, npm `10.9.3` (`node -e`, `npm --version`) |

## 2. Tested eKuiper version / build

| Item | Evidence |
| --- | --- |
| Bundled image pin | `lfedge/ekuiper:2.4.1-slim@sha256:f1a2294dc005deb5a6ad5055d33019750111dc1c56f5280adb96d77c1cd096ff` (`compose.yaml`, `ekuiper` service) |
| Management REST endpoint | `http://ekuiper:9081` in-Compose (`compose.yaml`, `DEFAULT_EKUIPER_URL`); audited default REST listener `http://localhost:9081` (`docs/FLOW_STUDIO_RULE_TEST_NOTES.md` §1) |
| Audited OpenAPI contract | `public/ekuiper-openapi.json`, `info.version "2.4.1"`, `x-ekuiper-version "2.4.1"` |
| Contract size (recounted, not copied) | 98 paths / 140 operations — `node -e "const d=require('./public/ekuiper-openapi.json'); …"` prints `paths:98 ops:140`, matching `DEVELOPMENT_PLAN.md` §8 |

Compiler conformance tests validate compiled output against the `RuleGraph`
envelope in that audited file (see `docs/FLOW_STUDIO.md` §10). No eKuiper
shape was invented: anything not provable from `public/ekuiper-openapi.json`
is treated as unproven (this is why graph-rule trial runs stay disabled —
see §9, item 2).

## 3. Flow / compiler / extension versions

| Item | Evidence |
| --- | --- |
| Flow document version | `flow.ekuiper-manager.io/v1alpha1` (`src/lib/flows/model/flow-document.ts`, `FLOW_DOCUMENT_VERSION`) |
| Compiler version | `FLOW_COMPILER_VERSION = 1` (`src/lib/flows/compiler/types.ts:28`); pinned into every deployment artifact (`src/lib/flows/compiler/ekuiper/compile-graph.ts:2050`) |
| Extension manifest `apiVersion` | `flow.extensions.ekuiper-manager.io/v1alpha1` (`src/lib/flows/extensions/types.ts`, `FLOW_EXTENSION_MANIFEST_API_VERSION`) |
| Public SDK | `@ekuiper-manager/flow-sdk` — types-and-constants only, consumed via npm workspaces, **not published** (`packages/flow-sdk/src/index.ts`, `docs/FLOW_STUDIO.md` §8) |

## 4. Supported built-in nodes (exact)

All definitions are version `1` and registered through the shared registry
(`createBuiltinNodeRegistry` in
`src/lib/flows/registry/builtin-registry.ts`). The palette reads the
registry; there is no separate catalog. Seventeen definitions total:

| Type | Category | Compiled eKuiper `nodeType` |
| --- | --- | --- |
| `memory-source` | source | `memory` |
| `mqtt-source` | source | `mqtt` |
| `stream-source` | source | stream/table reference source |
| `table-source` | source | stream/table reference source |
| `filter` | transform | `filter` |
| `pick` | transform | `pick` |
| `func` | transform | `function` (`props.expr`) |
| `window` | streaming | `window` |
| `aggregate` | streaming | `aggfunc` |
| `group-by` | streaming | `groupby` |
| `join` | streaming | `join` |
| `switch` | routing | `switch` |
| `sort` | routing | `orderby` |
| `memory-sink` | sink | `memory` |
| `mqtt-sink` | sink | `mqtt` |
| `rest-sink` | sink | `rest` |
| `log-sink` | sink | `log` |

The eKuiper `script` (JavaScript) operator is intentionally not exposed
(`docs/FLOW_STUDIO.md` §3). `secret-ref` properties are never compiled into
eKuiper props; built-ins expose no secret properties in flow config
(`docs/FLOW_STUDIO.md` §4).

## 5. Browsers used in CI / verification

| Item | Evidence |
| --- | --- |
| Playwright version | `@playwright/test 1.61.1` (`package.json` devDependencies) |
| CI browser projects | `desktop-chromium` (Desktop Chrome device) for all specs; `mobile-chromium` (Pixel 7) scoped to `navigation.spec.ts` only (`playwright.config.ts`) |
| Flow Studio specs (authored) | `e2e/flow-studio.spec.ts` (happy path incl. deploy against bundled stack, self-cleaning), `e2e/flow-studio-performance.spec.ts` (500-node smoke), `e2e/flow-studio-accessibility.spec.ts` (keyboard/roles/Delete guard) |
| Execution in this ticket | **Not executed here.** Per build-pack protocol, Playwright specs are authored as files and never executed in this environment (no TTY, no database, no running server). No `npm run test:e2e` was run for FS-0138. |
| Manual multi-browser matrix | **None recorded.** No manual Chrome/Firefox/Safari matrix exists in this checkout. Mobile Flow Studio editing is out of scope (`docs/FLOW_STUDIO.md` defers to desktop-first shell). |

## 6. Performance smoke results

Budgets are smoke-guard ceilings (catastrophic-regression detection), not lab
benchmarks (`docs/FLOW_STUDIO_PERFORMANCE.md`, `e2e/flow-studio-performance.spec.ts`):

| Measurement | Definition | Smoke budget |
| --- | --- | --- |
| Initial render readiness | navigation commit → 500 `.react-flow__node` elements present | `< 30 s` (`RENDER_READY_BUDGET_MS = 30_000`) |
| Simple interaction | first-node click → `node-inspector` visible | `< 15 s` (`INTERACTION_BUDGET_MS = 15_000`) |

Recorded measurement (adapter micro-benchmark, FS-0125 — fixture generation
plus real canvas-adapter conversion, 5 runs each, `performance.now()` wall
time; explicitly **not** a browser rendering benchmark):

| Nodes | Edges | Total (ms) | Avg per run (ms) |
| ---:| ---:| ---:| ---:|
| 250 | 249 | 5.8 | 1.2 |
| 500 | 499 | 8.1 | 1.6 |
| 1000 | 999 | 11.5 | 2.3 |

Environment for that run: HP EliteBook 6 G1a, Windows 11 Enterprise (Build
26200), Node v22.20.0, `@xyflow/react` 12.11.6
(`docs/FLOW_STUDIO_PERFORMANCE.md`).

Decision following the evidence: `onlyRenderVisibleElements` stays explicitly
disabled (`false` in `flow-canvas.tsx`); no node-count threshold was
introduced because no browser A/B showed an improvement. The CI baseline for
the 500-node smoke spec is **pending the first green CI run** and must be
recorded in `docs/FLOW_STUDIO_PERFORMANCE.md` when available — the budgets
above must never be loosened silently to make a regression pass.

Other implemented performance behavior (see `docs/FLOW_STUDIO.md` §9):
memoized node/edge adapter output on relevant document slices,
module-stable `nodeTypes`, lazy-loaded Monaco/raw/diff/debug viewers,
runtime snapshots at 1 Hz (`FLOW_RUNTIME_METRICS_POLL_MS = 1000`,
`src/components/flow-studio/hooks/use-flow-runtime-metrics.ts:15`), test
output bounded at `MAX_TEST_EVENTS = 100`
(`src/components/flow-studio/panels/test-panel.tsx:24`).

## 7. Required verification (FS-0138)

Ticket-required command:

- `npm run type-check` — PASS (run in this checkout after writing this report; doc-only plus `.gitignore`-negation change, no code touched)

Per protocol §17, no database, server, or Playwright execution was attempted
here. `npm run lint`, unit tests, and the e2e suites were not run for this
ticket because FS-0138's required verification is type-check only and the
ticket forbids behavior changes.

## 8. Rollback / recovery notes

These are the implemented mechanisms (see `docs/FLOW_STUDIO.md` §6), not
aspirations:

1. **Failed deploy never mutates runtime.** The deploy sequence validates →
    compiles → submits official eKuiper validation (`POST /rules/validate`)
    → upserts the runtime rule → confirms status → only then records success.
    A validation or update failure marks the attempt failed and leaves the
    previous deployment record active.
2. **Attempt record is redacted.** The persisted `pending` attempt carries
    only the redacted compiled definition; the full payload exists
    transiently for the eKuiper requests and is never persisted.
3. **Recover via revisions.** Every deploy pins the exact-current-draft
    revision (reusing the latest when semantic-plus-layout hashes match).
    Roll back by `POST /api/flows/{id}/revisions/{n}/restore` or redeploy a
    known-good revision via `POST .../revisions/{n}/deploy`; inspect state
    with `GET .../deployment`, `GET .../runtime`, `GET .../runtime/metrics`.
4. **Drafts are never mutated by deploy.** The deploy path loads the
    server-side draft and never trusts client-supplied documents or hashes.
5. **Database layer.** Checked SQL migrations run fail-fast before startup
    (`npm run db:migrate` / entrypoint). If a migration fails, Manager does
    not start against a half-migrated schema — restore the PostgreSQL named
    volume from backup and rerun.

What is **not** yet covered (honest gaps, see also §9): Manager-level
backup/restore/upgrade/rollback CLI and runbooks are pending (`OPS-001` in
`DEVELOPMENT_PLAN.md`, status "Not started"); there is no one-command
"undo deploy" beyond redeploying the previous revision.

## 9. Known blockers / explicit limitations

1. **Full regression suite (FS-0137) is not green in this checkout.**
    HEAD is FS-0136; FS-0137 (type-check, lint, full Jest, both Playwright
    suites, build, production audit) has not landed. Beta acceptance here
    records the state; it does not substitute for that suite.
2. **Rule-test trial runs are unavailable by design.** `ruleTest` and
    `ruleTestSse` resolve to `false` on every target profile
    (`src/lib/flows/capabilities/resolve-capabilities.ts:89-90,135-136`).
    Blockers: SSE streams on a dynamic per-test port unreachable under the
    registered-node origin-only policy, and no audited graph-rule test
    envelope (`RuleTestRequest` requires `sql`) in
    `public/ekuiper-openapi.json`. Full analysis in
    `docs/FLOW_STUDIO_RULE_TEST_NOTES.md`. The test panel renders a
    capability-gated empty state and issues no request.
3. **Performance CI baseline unrecorded** (see §6). Budgets stand; first
    green CI run must supply the observed values.
4. **No manual cross-browser verification recorded** (see §5).
5. **1000-node editing has fixture support but no tuned virtualization**
    beyond XYFlow defaults; large-graph work stays benchmark-driven.
6. **Extension installation is out of scope.** Local-directory loading only,
    read-only `GET` serving, no install/delete API, no custom editor
    components, no compiler hooks (`docs/FLOW_EXTENSIONS.md` §8).
7. **Operator runbooks pending:** backup/restore/upgrade/rollback,
    password recovery, and uninstall procedures are documented as remaining
    work in `DEVELOPMENT_PLAN.md` §§2, 4 (`OPS-001`, `DOC-001`).
8. **No compatibility claims.** Flow Studio does not convert SQL rules, does
    not replace the Rule Designer at `/rules`, and claims no Node-RED/n8n
    compatibility.

## 10. Beta acceptance statement

Flow Studio beta is accepted as a **documented, capability-gated visual
editor for eKuiper v2.4.1 graph rules** with the seventeen version-1
built-ins above, deterministic compilation (compiler v1), staged validation
with official eKuiper validation gating every deploy, bounded 1 Hz runtime
snapshots, declarative local-directory extensions, and smoke-budget
performance guards — subject to the blockers in §9, chiefly the pending
FS-0137 full-regression green run. No item in §9 is waived by this report.
