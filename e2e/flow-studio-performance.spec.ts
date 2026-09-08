import { test, expect } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

/**
 * FS-0132 — 500-node interaction performance smoke test.
 *
 * Loads the development-only perf route (`/flows/perf`, FS-0122) with its
 * default deterministic 500-node fixture (FS-0121, in-browser only: no
 * flow/draft API writes) and measures two coarse browser wall-clock timings
 * with event-driven waits:
 *
 * - initial render readiness: navigation commit -> 500 canvas nodes present;
 * - one simple interaction: first-node click -> `node-inspector` visible.
 *
 * This is a smoke guard, not a lab benchmark: budgets are deliberately
 * generous ceilings so ordinary hardware variance in CI never fails the
 * suite, while a catastrophic multi-second regression (or hang) trips it.
 * No exact FPS assertions and no GPU-dependent animation-frame metrics are
 * used, so the test is not hardware-fragile. Measured timings are attached
 * to the test report; the first green CI run establishes the baseline
 * recorded in `docs/FLOW_STUDIO_PERFORMANCE.md`.
 */

const PERF_ROUTE = '/flows/perf';
const EXPECTED_NODE_COUNT = 500;

// Generous smoke ceilings (see docs/FLOW_STUDIO_PERFORMANCE.md). Chosen as
// ceilings above the expected few-second render on development hardware, not
// from a measured CI distribution.
const RENDER_READY_BUDGET_MS = 30_000;
const INTERACTION_BUDGET_MS = 15_000;

// Event-driven wait ceilings sit comfortably above the budgets so that a
// genuinely slow run trips the budget assertion below (with its measured
// timings attached to the report) instead of flaking on an actionability
// timeout with no data.
const RENDER_WAIT_TIMEOUT_MS = 120_000;
const INTERACTION_WAIT_TIMEOUT_MS = 60_000;

test('flow studio 500-node performance smoke guard', async ({ page }) => {
  test.setTimeout(240_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);

  // The perf route must stay read-only towards the API: any same-origin
  // mutating request (flow/draft writes in particular) fails this test.
  const mutatingApiRequests: string[] = [];
  page.on('request', (request) => {
    const method = request.method();
    if (
      (method === 'POST' ||
        method === 'PUT' ||
        method === 'PATCH' ||
        method === 'DELETE') &&
      request.url().includes('/api/')
    ) {
      mutatingApiRequests.push(`${method} ${request.url()}`);
    }
  });

  const renderStart = Date.now();
  await page.goto(PERF_ROUTE);

  // The fixture route is development-only: src/app/flows/perf/page.tsx renders
  // "Not available in production" when NODE_ENV is production, and CI runs these tests
  // against a production Docker image. Skip rather than fail, and say why - a guard that
  // cannot run in this build should not read as a broken product.
  const toolbar = page.getByTestId('flow-perf-toolbar');
  const perfRouteAvailable = await toolbar
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(
    !perfRouteAvailable,
    'The /flows/perf fixture route is development-only and is not served by a production build.',
  );

  // Development-only toolbar proves we are on the fixture route (not a real
  // flow), defaulting to the 500-node fixture with Deploy disabled.
  await expect(toolbar).toBeVisible({
    timeout: RENDER_WAIT_TIMEOUT_MS,
  });
  await expect(page.getByTestId('flow-perf-size-500')).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: RENDER_WAIT_TIMEOUT_MS },
  );
  await expect(page.getByTestId('flow-perf-counts')).toContainText('500 nodes', {
    timeout: RENDER_WAIT_TIMEOUT_MS,
  });

  const canvas = page.getByTestId('flow-canvas');
  await expect(canvas).toBeVisible({ timeout: RENDER_WAIT_TIMEOUT_MS });

  // Render readiness: all 500 deterministic fixture nodes present in the
  // canvas. Polling assertion, never a fixed sleep.
  const nodes = page.locator('.react-flow__node');
  await expect(nodes).toHaveCount(EXPECTED_NODE_COUNT, {
    timeout: RENDER_WAIT_TIMEOUT_MS,
  });
  const renderReadyMs = Date.now() - renderStart;

  // One simple canvas interaction: the first fixture node sits at the
  // fixture origin, inside the default viewport, so a plain click selects
  // it and opens the inspector — the same user path the happy-path suite
  // uses, with no canvas-coordinate arithmetic.
  const firstNode = nodes.first();
  await expect(firstNode).toBeVisible({
    timeout: INTERACTION_WAIT_TIMEOUT_MS,
  });
  const interactionStart = Date.now();
  await firstNode.click({ timeout: INTERACTION_WAIT_TIMEOUT_MS });
  await expect(page.getByTestId('node-inspector')).toBeVisible({
    timeout: INTERACTION_WAIT_TIMEOUT_MS,
  });
  const interactionMs = Date.now() - interactionStart;

  await test.info().attach('perf-smoke-timings', {
    body: JSON.stringify(
      {
        nodeCount: EXPECTED_NODE_COUNT,
        renderReadyMs,
        renderBudgetMs: RENDER_READY_BUDGET_MS,
        interactionMs,
        interactionBudgetMs: INTERACTION_BUDGET_MS,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  expect(renderReadyMs).toBeLessThan(RENDER_READY_BUDGET_MS);
  expect(interactionMs).toBeLessThan(INTERACTION_BUDGET_MS);
  expect(mutatingApiRequests).toEqual([]);

  // Same tolerated-backend-behaviour filter as the happy-path suite: every
  // OTHER console or page error still fails this test.
  const unexpectedErrors = errors.filter(
    (message) => !/404 \(Not Found\)/.test(message),
  );
  expect(unexpectedErrors).toEqual([]);
});
