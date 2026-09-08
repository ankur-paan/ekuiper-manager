# Flow Studio — Beta Guide (FS-0136)

Beta documentation for the visual stream-processing flow editor.
It describes behavior as implemented in this checkout, not a roadmap vision.

Related references:

- `docs/FLOW_STUDIO_ARCHITECTURE.md` — locked architecture boundaries.
- `docs/FLOW_EXTENSIONS.md` — declarative extension author guide.
- `docs/FLOW_STUDIO_PERFORMANCE.md` — canvas performance decision and smoke-test budgets.
- `docs/FLOW_STUDIO_RULE_TEST_NOTES.md` — why rule-test trial runs are unavailable.
- `docs/RULE_DESIGNER.md` — existing SQL Rule Designer (unchanged by Flow Studio).

## 1. What Flow Studio is

Flow Studio is a canvas-based editor for stream-processing flows.
Each flow is authored visually (nodes plus wires) and deployed as
**one eKuiper graph rule** on a registered eKuiper node
(one Flow = one eKuiper graph rule).

The existing SQL Rule Designer under `/rules` is unchanged and remains
supported. Flow Studio does not convert SQL rules into flows and does not
replace the Rule Designer.

Manager is control plane only: it persists drafts/revisions/deployments,
validates, compiles, and calls eKuiper management APIs. eKuiper owns
ingestion, stream processing, windows/aggregates/joins, state, and sink
delivery. Manager adds zero production processing overhead.

## 2. Entry points

| Route | Purpose |
| --- | --- |
| `/flows` | Flow list (name, target, updated time) with search and create action. Create calls `POST /api/flows`, then navigates to `/flows/{id}`. |
| `/flows/{id}` | Flow Studio editor for one flow. |
| `/flows/perf` | Development-only performance fixture route (see section 9). Never writes flow/draft APIs. |
| `/graph` | Compatibility redirect to `/flows`. |
| `/rules` | Existing Rule Designer; unchanged and still working. |

All Flow Studio pages and API routes require an authenticated session and
follow the existing same-origin mutation patterns. There is no
unauthenticated shortcut.

## 3. Supported built-in nodes (exact, version 1)

All built-in definitions are version 1 and registered through the shared
node registry (`createBuiltinNodeRegistry` in
`src/lib/flows/registry/builtin-registry.ts`). The editor palette reads the
registry; it maintains no separate catalog.

### Sources (`category: source`)

| Type | Display name | Compiled eKuiper `nodeType` |
| --- | --- | --- |
| `memory-source` | Memory Source | `memory` |
| `mqtt-source` | MQTT Source | `mqtt` |
| `stream-source` | Stream Source | stream/table reference source |
| `table-source` | Table Source | stream/table reference source |

Only confirmed non-secret editor properties are exposed. MQTT secret values
live in the Manager connection configuration, never in flow node config.

### Transforms (`category: transform`)

| Type | Display name | Compiled eKuiper `nodeType` |
| --- | --- | --- |
| `filter` | Filter | `filter` |
| `pick` | Pick | `pick` |
| `func` | Function | `function` (`props.expr`) |

### Streaming operators (`category: streaming`)

| Type | Display name | Compiled eKuiper `nodeType` |
| --- | --- | --- |
| `window` | Window | `window` |
| `aggregate` | Aggregate | `aggfunc` |
| `group-by` | Group By | `groupby` |
| `join` | Join | `join` |

### Routing (`category: routing`)

| Type | Display name | Compiled eKuiper `nodeType` |
| --- | --- | --- |
| `switch` | Switch | `switch` |
| `sort` | Sort | `orderby` |

### Sinks (`category: sink`)

| Type | Display name | Compiled eKuiper `nodeType` |
| --- | --- | --- |
| `memory-sink` | Memory Sink | `memory` |
| `mqtt-sink` | MQTT Sink | `mqtt` |
| `rest-sink` | REST Sink | `rest` |
| `log-sink` | Log Sink | `log` |

The eKuiper `script` (JavaScript) operator is intentionally not exposed as a
Flow Studio node; exposing a JS execution surface requires an explicit
security decision and owner ADR first.

## 4. Unsupported constructs

The following are rejected at validation time with structured diagnostics
(`valid: false` plus `FlowDiagnostic` entries), or are otherwise
unavailable:

- Cyclic graphs (`FLOW_CYCLE_UNSUPPORTED`); self-edges (`FLOW_SELF_EDGE_UNSUPPORTED`).
- Flows with no source (`FLOW_NO_SOURCE`) or no sink (`FLOW_NO_SINK`).
- Disconnected runtime nodes at deployment time.
- Unknown node types (`FLOW_UNKNOWN_NODE_TYPE`) and missing/incompatible ports.
- Missing required properties (`FLOW_REQUIRED_PROPERTY_MISSING`).
- Capability-gated nodes on targets that do not prove support (`FLOW_CAPABILITY_UNAVAILABLE`).
- `secret-ref` properties are never compiled into eKuiper props; extension
  runtime mappings that reference them are rejected until a secret-binding
  design lands. Built-ins expose no secret properties in flow config.
- Cross-flow references, variables, groups, and comment/utility semantic
  nodes are not part of the `flow.ekuiper-manager.io/v1alpha1` model.
- Rule-test trial runs: `ruleTest`/`ruleTestSse` resolve to `false` on every
  target profile (see `docs/FLOW_STUDIO_RULE_TEST_NOTES.md`). The test panel
  renders a capability-gated empty state and issues no test request.

## 5. Authoring model

- Flow document version: `flow.ekuiper-manager.io/v1alpha1` (see
  `src/lib/flows/model/flow-document.ts`).
- Stable flow node IDs are immutable identifiers independent of display names.
- Semantic state (nodes, edges, config) and layout state (coordinates,
  viewport) are stored and hashed separately. Moving a node is a
  layout-only edit and does not mark the flow as needing deployment;
  changing node behavior/configuration is a semantic edit and does.
- Editor state (document, selection, viewport, undo history, panel
  visibility) lives in a dedicated Zustand store; server state lives in
  TanStack Query; runtime metrics/debug state is a separate store and is
  never stored inside flow node objects.
- Autosave writes the draft (debounced; high-frequency pointer events never
  write per-event and never recompute the semantic hash). Autosave is not
  deployment: deploying is an explicit action.
- Validation is staged (document, structural, property, port/semantic,
  capability, IR, compile, official eKuiper validation). User-correctable
  failures return structured diagnostics, not server errors.
- Compilation is deterministic for the same flow document plus target
  capability profile plus compiler version plus node-definition versions.
  Compiler version: `FLOW_COMPILER_VERSION = 1`. Layout is never sent to
  eKuiper. Runtime operator IDs are deterministic compiler output mapped
  back to flow node IDs (`runtimeNodeMap`).

## 6. Deployment semantics

Deploying a flow (`POST /api/flows/{id}/deploy`) runs this server-side
sequence:

1. Load the flow row and current draft server-side (client-supplied documents
   are never trusted).
2. Resolve the registered target's capability profile from its stored row;
   no live eKuiper call is made at this step.
3. Run authoritative server validation. User-correctable failures return
   structured diagnostics and create no deployment attempt and no runtime
   mutation.
4. Compile deterministically; compile failures behave the same way.
5. Create one `pending` deployment attempt carrying only the redacted
   compiled definition (the full payload exists transiently for the eKuiper
   requests and is never persisted). The attempt also pins the
   exact-current-draft revision (reusing the latest revision when
   semantic-plus-layout hashes match, otherwise creating one); the draft
   itself is never mutated.
6. Submit the artifact to official eKuiper validation
   (`POST /rules/validate` on the registered node). A rejection marks the
   attempt failed and never mutates runtime.
7. Upsert the runtime rule through the registered-node transport, confirm
   runtime status, and only then record the deployment as successful.
   If the update fails, the previous deployment record stays active.

Deployment history, revisions (with restore and deploy-from-revision), and
runtime status are available per flow:

- `POST /api/flows/{id}/validate`, `POST .../compile`, `POST .../deploy`
- `GET .../deployment`, `GET .../runtime`, `GET .../runtime/metrics`
- `GET .../revisions`, `POST .../revisions/{n}/restore`, `POST .../revisions/{n}/deploy`
- `GET/PUT .../draft`, `GET/PATCH /api/flows/{id}`, `GET/POST /api/flows`

## 7. Test and debug capability

- **Validation panel:** shows structured diagnostics for the current draft.
- **Definition panel:** shows the exact compiled rule definition for inspection.
- **Test panel:** capability-gated. Because `ruleTest` is `false` on all
  profiles, the panel currently explains that trial runs are unavailable
  and issues no request. Retained test output is bounded
  (`MAX_TEST_EVENTS = 100`, per-entry display truncation).
- **Runtime panel and metrics:** bounded current snapshots polled at 1 Hz
  (`FLOW_RUNTIME_METRICS_POLL_MS = 1000`) only while the studio view is
  visible. Metrics refresh uses fine-grained selectors and does not
  rerender the whole graph. High-frequency metrics are never persisted to
  PostgreSQL.
- **History:** revision list with diff, restore, and deploy-from-revision.
- **Command palette** (`Cmd/Ctrl+K`): existing actions only (search/add
  node, deploy when enabled, open panels, fit view). Commands are disabled
  when the underlying action is unavailable.
- **Focus mode:** double-clicking a node opens a large dialog with the same
  generic property renderer and diagnostics as the side inspector.
- **Expression editing:** Monaco loads lazily only when an expression field
  is focused; otherwise a plain textarea is used.

## 8. Extension limitations

Declarative extensions are the default; details and the worked example live
in `docs/FLOW_EXTENSIONS.md`. Current limits:

- Local-directory loading only (`extensions/` root, read-only). No remote
  registry, no zip upload/install, no install/delete API.
- Read-only `GET` serving of safe metadata; invalid extensions are omitted
  with a diagnostic rather than crashing the studio.
- Manifest `apiVersion` must be exactly
  `flow.extensions.ekuiper-manager.io/v1alpha1`.
- No executable content: no arbitrary React injection, no JavaScript
  execution inside Manager, no shell commands, no npm installs, no remote
  scripts/styles, no iframes, no plaintext secrets, no arbitrary eKuiper
  target URLs.
- Runtime mappings are direct `configKey -> propsKey` allowlists only
  (`kind`/`nodeType`/`properties`); no expressions, templates, or code.
- A duplicate `(type, version)` never silently overrides a built-in.
- No custom editor components and no compiler hooks; complex properties
  must use the generic property types.
- The public SDK (`@ekuiper-manager/flow-sdk`) is types-and-constants only
  and is not published.

## 9. Performance targets and known limits

Engineering targets (see `ekuiper-flow-studio-build-pack/UI_PERFORMANCE_SPEC.md`):

| Scenario | Target |
| --- | --- |
| Canvas interaction, ordinary flows | 60 FPS |
| Node drag p95 frame | <= 16.7 ms |
| Inspector simple field reaction | < 50 ms |
| Client structural validation, typical flow | < 100 ms |
| 500-node warm open | < 1 s (aspirational) |
| Runtime metric cadence | 1 Hz default |
| Production processing overhead from Manager | 0 |

What is implemented:

- Node/edge adapter output is memoized on relevant document slices; the
  `nodeTypes` object is module-stable; callbacks are stabilized where they
  prevent rerenders (no blanket `useMemo`).
- `onlyRenderVisibleElements` stays explicitly disabled: local measurement
  showed no rendering improvement to justify its per-frame overhead, so no
  node-count threshold was introduced (see `docs/FLOW_STUDIO_PERFORMANCE.md`).
- MiniMap uses simple node rendering; canvas Controls are labeled for
  keyboard/accessibility use.
- Heavy viewers (Monaco expression editor, raw definition viewer, revision
  diff, debug event viewer) lazy-load.
- Deterministic large-flow fixtures (50/250/500/1000 nodes) back manual
  profiling through the development-only `/flows/perf` route, which loads
  fixtures locally without DB writes.
- A 500-node Playwright smoke guard (`e2e/flow-studio-performance.spec.ts`)
  asserts coarse render-readiness (< 30 s) and simple-interaction (< 15 s)
  budgets — catastrophic-regression detection, not a lab benchmark. Baseline
  values are recorded from CI runs in `docs/FLOW_STUDIO_PERFORMANCE.md`.

Known limits:

- Large-graph work is benchmark-driven; 1000-node editing has fixture
  support but no tuned virtualization beyond the defaults.
- Rule-test streaming, extension install flows, and auto-layout remain
  explicitly out of scope (decision records, not installed features).

## 10. Browser coverage and verification

- Playwright specs: `e2e/flow-studio.spec.ts` (happy path: authenticate,
  create flow, add/configure/connect source/filter/sink, autosave,
  validate, deploy against the bundled official eKuiper stack, then clean
  up), `e2e/flow-studio-performance.spec.ts` (500-node smoke),
  `e2e/flow-studio-accessibility.spec.ts` (keyboard, roles/labels, Escape
  and Delete guards). These specs are authored for CI with a running
  stack; they are not executed as part of routine type-check/lint.
- Unit/contract coverage includes the deterministic fixture generator,
  render-selector guards, compiler conformance against the audited
  `public/ekuiper-openapi.json` (eKuiper 2.4.1) `RuleGraph` envelope, and
  extension loader/compiler fixtures.
- Keyboard support: palette items are keyboard-reachable, inspector inputs
  are labeled, status is never color-only, and typing in an input never
  triggers canvas Delete.

## 11. Beta checklist

- [x] Flows list plus studio editor behind authenticated sessions.
- [x] Seventeen version-1 built-in definitions across source, transform,
  streaming, routing, and sink categories, compiled to audited eKuiper
  graph operators.
- [x] Draft autosave separated from explicit deployment; layout edits do
  not dirty runtime state.
- [x] Staged validation with structured diagnostics; official eKuiper
  validation gates every deploy; failed deploys never mutate runtime.
- [x] Revision history with diff, restore, and deploy-from-revision.
- [x] Bounded runtime snapshots at 1 Hz without full-graph rerenders.
- [x] Declarative local-directory extensions with read-only serving.
- [x] Performance fixtures, dev-only perf route, and smoke budgets documented.
- [ ] Full regression suite green on a clean host (FS-0137; includes
  type-check, lint, Jest, Playwright suites, production build, and
  production dependency audit).
- [ ] Beta acceptance report with tested eKuiper build, browsers,
  performance smoke results, and rollback notes (FS-0138).
- [ ] Rule-test trial runs remain blocked on a safe SSE relay design and an
  audited graph-rule test envelope.

No claim of compatibility with any third-party flow editor is made in this
document.
