# Flow Studio — UI Component Testing Decision (FS-0139)

Decision-checkpoint record for whether Storybook materially improves Flow
Studio maintenance now. This ticket installs nothing and changes no
behavior. Evidence below cites the exact file or command verified in this
checkout.

Related references:

- `docs/FLOW_STUDIO.md` — beta user/operator guide (FS-0136).
- `docs/FLOW_STUDIO_ARCHITECTURE.md` — locked architecture boundaries.
- `docs/FLOW_STUDIO_BETA_ACCEPTANCE.md` — beta acceptance evidence (FS-0138).
- `docs/FLOW_STUDIO_PERFORMANCE.md` — canvas performance decision and smoke budgets.
- `ekuiper-flow-studio-build-pack/MODEL_RULES.md` §2 — Storybook is
  forbidden until the ticket that authorizes it.

## 1. Component inventory (recounted, not copied)

Flow Studio UI as checked in under `src/components/flow-studio/`:

| Area | Files |
| --- | --- |
| Canvas | `canvas/flow-canvas.tsx`, `canvas/to-react-flow.ts` |
| Nodes | `nodes/flow-node.tsx` (single generic renderer) |
| Palette | `palette/node-palette.tsx`, `palette/quick-node-picker.tsx` |
| Inspector | `inspector/node-inspector.tsx`, `inspector/property-field.tsx`, `inspector/expression-editor.tsx`, `inspector/flow-settings-panel.tsx`, `inspector/node-focus-dialog.tsx` |
| Panels | `panels/validation-panel.tsx`, `panels/definition-panel.tsx`, `panels/test-panel.tsx`, `panels/runtime-panel.tsx`, `panels/flow-bottom-panel.tsx` |
| Command | `command/flow-command-palette.tsx` |
| Deploy | `deploy/deploy-dialog.tsx` |
| History | `history/revision-history.tsx`, `history/revision-diff.tsx` |
| Shell/page | `flow-studio-page.tsx`, `flow-studio-shell.tsx`, `shell/flow-studio-header.tsx`, `index.ts` |
| Hooks | `hooks/use-flow-autosave.ts`, `hooks/use-flow-runtime-metrics.ts` |

Total: ~24 modules, of which ~20 are render components. The set is small
and deliberately generic: one `flow-node.tsx` renderer driven by the node
registry, one generic `property-field.tsx` renderer, and one shared focus
dialog reusing the same renderer (FS-0129). There is no per-node custom
React path and no variant-heavy design-system surface to catalogue.

## 2. Current visual-regression coverage

- No Storybook dependency: `grep -ri storybook package.json
  playwright.config.* jest.config.*` returns no references (`package.json`
  has no `storybook`, `@storybook/*`, `chromatic`, `loki`, `percy`, or
  `happo` entries).
- No screenshot assertions: `grep -rl "toHaveScreenshot|toMatchSnapshot|
  screenshot" e2e/ src/` matches nothing outside Playwright's
  failure-only diagnostics (`playwright.config.ts`: `screenshot:
  'only-on-failure'`, `video: 'retain-on-failure'`, `trace:
  'retain-on-first-failure'`).
- What does exist: ~60 Jest suites under `src/lib/__tests__/` covering
  compiler/registry/validation/store behavior (including
  `flow-node-presentation.test.ts`,
  `flow-node-render-performance.test.tsx`, and canvas adapter/selection/
  handle suites), plus Playwright functional specs
  (`e2e/flow-studio.spec.ts`, `e2e/flow-studio-accessibility.spec.ts`,
  `e2e/flow-studio-performance.spec.ts`) asserting behavior and roles,
  not pixels.

Conclusion: visual-regression coverage is zero, and that is currently
adequate — there is no evidence of a class of shipped bug that pixel
snapshots would have caught. The failure modes that matter for a
stream-processing canvas (wrong operator mapping, stale selector data,
lost config round-trip) are all behavioral and already covered by the
suites above.

## 3. Decision: DEFER Storybook

Storybook does not materially improve maintenance now.

Rationale:

1. Small, generic surface. ~20 render components with a single generic
   node/property renderer have little isolated-variant value; stories
   would mostly duplicate the existing Jest + Playwright coverage.
2. Cost is real and immediate. Storybook adds dev dependencies, build
   config, and ongoing story maintenance, against an explicit
   `MODEL_RULES.md` §2 prohibition on introducing it without a dedicated
   authorizing ticket.
3. No triggering pain. Zero visual-regression coverage has not produced
   regressions attributable to missing component isolation; the beta
   acceptance report (FS-0138) lists no styling/isolation blocker.
4. Locked decisions already constrain the design space
   (`LOCKED_DECISIONS.md` §UI state, §Performance): third-party arbitrary
   React injection is unsupported, and canvas work is benchmark-driven —
   neither needs a component catalogue to proceed.

## 4. Trigger conditions for revisiting

Reopen this decision (as a new standalone dependency ticket, per
`MODEL_RULES.md` §5) when any of the following becomes true:

- The Flow Studio render-component count roughly doubles from the §1
  inventory with per-variant visual states worth isolating; or
- a shipped regression is root-caused to untested visual state that an
  isolated story would plausibly have caught; or
- third-party node authors (post declarative-model proving,
  `LOCKED_DECISIONS.md` §22) need a documented visual contract for node
  presentation.

## 5. Proposed future ticket scope (only if triggered)

A future standalone ticket would: install Storybook via the repo's npm
workflow with pinned versions recorded, add stories for `flow-node.tsx`
states (selected/error/runtime) and `property-field.tsx` types only,
wire one CI storybook-build check, run `npm audit --production`, and
record bundle/dev-tool impact in its summary. Explicitly out of scope:
visual-regression hosting (Chromatic/Percy), full-canvas stories, and
any change to the declarative node contract. Estimated size: M. No such
ticket is opened by this checkpoint.
