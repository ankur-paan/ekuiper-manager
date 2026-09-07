# Flow Studio — Auto-Layout Decision (FS-0140)

Decision-checkpoint record for whether automatic graph layout (ELK.js,
Dagre, or equivalent) is justified now. This ticket installs nothing,
adds no dependency, and changes no behavior. Evidence below cites the
exact file or command verified in this checkout.

Related references:

- `docs/FLOW_STUDIO.md` — beta user/operator guide (FS-0136).
- `docs/FLOW_STUDIO_ARCHITECTURE.md` — locked architecture boundaries.
- `docs/FLOW_STUDIO_BETA_ACCEPTANCE.md` — beta acceptance evidence (FS-0138).
- `docs/FLOW_STUDIO_PERFORMANCE.md` — canvas performance decision and smoke budgets.
- `docs/FLOW_STUDIO_UI_COMPONENT_TESTING_DECISION.md` — prior
  decision-checkpoint precedent (FS-0139, also deferred).
- `ekuiper-flow-studio-build-pack/MODEL_RULES.md` §5 — no dependency
  without ticket authorization; §2 — no speculative architecture.
- `ekuiper-flow-studio-build-pack/LOCKED_DECISIONS.md` §Data model
  (semantic/layout separation), §Performance (benchmark-driven).
- `ekuiper-flow-studio-build-pack/UI_PERFORMANCE_SPEC.md` §8 — canvas
  direction is `@xyflow/react`, auto-layout explicitly out of that scope.

## 1. Current graph sizes (evidence, not estimates)

- Seventeen version-1 built-in node definitions total (source, transform,
  streaming, routing, sink) registered through the shared registry
  (`createBuiltinNodeRegistry` in
  `src/lib/flows/registry/builtin-registry.ts`; see
  `docs/FLOW_STUDIO_BETA_ACCEPTANCE.md` §4). Real user flows are
  chain/branch-shaped stream pipelines (source → transforms → sinks).
- Deterministic large-flow fixtures exist for 50/250/500/1000 nodes
  (`src/lib/flows/testing/generate-large-flow.ts`), rendered on the
  development-only perf route (`src/app/flows/perf/page.tsx`, no DB
  writes). Fixture edges chain `out -> in` node-to-node and fixture
  layout is already a deterministic grid
  (`generate-large-flow.ts:112-117`), so large generated graphs arrive
  with usable positions and no overlap pile-up.
- Canvas-adapter micro-benchmark (FS-0125, recorded in
  `docs/FLOW_STUDIO_PERFORMANCE.md`): 250/500/1000-node conversion at
  ~1–2 ms per run, scaling linearly — layout computation is not the
  bottleneck anywhere in the measured path.
- The 500-node smoke spec budgets (< 30 s render readiness,
  < 15 s simple interaction, `e2e/flow-studio-performance.spec.ts`) are
  catastrophic-regression ceilings, and `onlyRenderVisibleElements`
  stays disabled for lack of measured benefit. 1000-node editing has
  fixture support but no tuned virtualization; large-graph work stays
  benchmark-driven by locked decision.

## 2. Current layout behavior (recounted, not copied)

- Semantic and layout state are separate by locked decision
  (`LOCKED_DECISIONS.md` §§11–12, 27): node coordinates live in
  `FlowDocument` layout (`document.layout.nodes`), moving a node is a
  layout-only edit that must not mark runtime as needing deployment, and
  drag updates stay in ephemeral XYFlow view state until a drag-stop
  commit (`src/components/flow-studio/canvas/flow-canvas.tsx:125-131`).
- Every node-creation path already assigns an explicit position — there
  is no unpositioned-node path in normal authoring:
  - palette drag-drop and picker place at the drop/click flow coordinate
    (`flow-canvas.tsx:290-327`, via `screenToFlowPosition`);
  - double-click on empty canvas opens the picker at that coordinate
    (`flow-studio-page.tsx:1063-1095`);
  - command-palette "add node" opens the picker at viewport center
    (`flow-studio-page.tsx:1160-1169`).
- The only fallback is a missing-layout default of `{0,0}`
  (`canvas/to-react-flow.ts`, adapter test
  `flow-react-flow-adapter.test.ts:82`), reachable only for documents
  that arrive without layout entries — not for anything the current
  authoring UI produces.
- Navigation chrome already covers the "lost in a big graph" case:
  XYFlow Controls plus a simple-rect MiniMap were added only after the
  500-node responsiveness check (FS-0126,
  `flow-canvas.tsx:391-431`), and fit-view is reachable from the
  command palette (FS-0127, `flow-command-palette.tsx:134`).

## 3. User-need evaluation

No evidenced need for auto-layout exists in this checkout:

1. Typical authoring graphs are small chains of the 17 built-ins; manual
   placement at the cursor plus drag-to-adjust covers them with zero
   added machinery.
2. Large graphs (250–1000 nodes) are currently generated fixtures with
   deterministic grid layout, not user-arranged canvases — there is no
   recorded user pain arranging them.
3. The beta acceptance report (FS-0138 §9) lists eight explicit
   blockers/limitations; none is a layout/arrangement complaint.
4. No feedback channel in the repo (beta guide, acceptance report, perf
   notes) requests auto-arrange.

## 4. Dependency cost if done now

- `grep -ri "dagre|elkjs|auto-layout" src/` matches nothing, and
  `package.json` contains neither `elkjs`/`@elkjs/layout` nor `dagre`:
  auto-layout would be a brand-new runtime dependency, requiring
  ticket authorization, version pinning, and a production audit per
  `MODEL_RULES.md` §5. This ticket explicitly forbids installing
  ELK/Dagre.
- At 500–1000 nodes, a layout pass on the main thread risks exactly the
  jank `LOCKED_DECISIONS.md` §§30–34 forbids; a credible implementation
  needs Web Worker execution plus deterministic output that commits as
  one layout-only history entry — a multi-ticket project, not a
  speculative add-on.

## 5. Decision: DEFER auto-layout

Do not install ELK.js, Dagre, or any auto-layout library. Do not build
custom auto-arrange. Manual placement, fit-view, Controls, and MiniMap
stand as the layout story for beta.

## 6. Trigger conditions for revisiting

Reopen this decision (as new standalone scoped tickets, per
`MODEL_RULES.md` §5) when any of the following becomes true:

- Beta/operator feedback explicitly reports arrangement cost as a
  blocker on real (non-fixture) graphs, roughly 100+ nodes where
  manual layout dominates authoring time; or
- an implemented import/generation path arrives that produces documents
  with missing or degenerate layout entries (hitting the `{0,0}`
  fallback at scale), so a one-shot arrange pass has a proven input; or
- a measured browser benchmark on `/flows/perf` shows manual-layout
  interaction missing the 60 FPS / usability targets on realistic
  graphs in a way a layout pass would plausibly fix.

## 7. Proposed future ticket scope (only if triggered)

A future standalone ticket (or worker-plumbing plus algorithm pair)
would: evaluate ELK.js layered layout (suits DAG stream graphs) versus
Dagre with a recorded size/quality trade-off; execute the layout pass
in a Web Worker off the main thread; expose it as an explicit
user-invoked "Arrange" command that commits a single layout-only
history entry (no semantic change, no per-node autosave storm, no
continuous re-layout on edit); keep output deterministic for the same
document; pin and audit the dependency via the repo npm workflow.
Explicitly out of scope: continuous auto-layout while editing, semantic
graph changes, custom edge routing, and any Manager-side execution of
flow logic. Estimated size: M–L across the pair. No such ticket is
opened by this checkpoint.
