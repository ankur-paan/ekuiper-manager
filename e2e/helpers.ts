import { expect, type Page } from '@playwright/test';

export const ownerUsername = process.env.E2E_USERNAME ?? 'e2e-owner';
export const ownerPassword = process.env.E2E_PASSWORD ?? 'e2e-owner-password!42';

/** Where global setup saves the one signed-in session the whole run shares. */
export const STORAGE_STATE_PATH =
  process.env.E2E_STORAGE_STATE ?? 'test-results/.auth/owner.json';

/**
 * Ensure this page is signed in.
 *
 * Normally a no-op: `storageState` from global setup already carries the session, so this
 * just confirms we are past `/welcome`. Logging in again is the fallback for a session that
 * genuinely expired mid-run - and it is deliberately the exception, because
 * `POST /api/auth/login` allows only 10 attempts per 15 minutes per client+username
 * (src/app/api/auth/login/route.ts), and a suite that signs in per test exhausts that budget
 * and then fails every remaining spec at `toHaveURL(/dashboard$/)` on `/welcome`.
 */
export async function ensureSignedIn(page: Page): Promise<void> {
  await page.goto('/');
  if (!page.url().includes('/welcome')) {
    // Already authenticated via storageState. `/` redirects to the dashboard, and returning
    // the moment the URL is merely "not /welcome" hands the caller a page still mid-redirect,
    // whose shell has not rendered. Wait for the destination the fresh-login path also awaited.
    // Waiting on the navigation element instead would not work: on mobile it lives in a
    // collapsed drawer and is not attached until the menu is opened.
    await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
    return;
  }

  const setup = page.getByRole('heading', { name: 'Create the owner account' });
  const signIn = page.getByRole('heading', { name: 'Sign in' });
  await expect(setup.or(signIn)).toBeVisible();
  await page.getByLabel('Username').fill(ownerUsername);
  await page.getByLabel('Password', { exact: true }).fill(ownerPassword);
  if (await setup.isVisible()) {
    await page.getByLabel('Confirm password').fill(ownerPassword);
    await page.getByRole('button', { name: 'Complete setup' }).click();
  } else {
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page).toHaveURL(/\/dashboard$/);
}

export function captureUnexpectedErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/**
 * Double-click an empty spot on the Flow Studio canvas to open the quick node picker.
 *
 * `flow-canvas.tsx` deliberately ignores double-clicks inside `.react-flow__node` and
 * `.react-flow__panel`, and the canvas carries several panels: React Flow's attribution link,
 * plus the MiniMap and Controls added by FS-0126. A fixed fraction therefore lands on a panel
 * often enough to fail, and the picker simply never opens. Probe candidate points and use the
 * first that is provably empty.
 */
export async function dblclickEmptyCanvas(
  page: Page,
  preferred: { x: number; y: number } = { x: 0.5, y: 0.4 },
): Promise<void> {
  const canvas = page.getByTestId('flow-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Flow canvas has no bounding box');

  const candidates = [
    preferred,
    { x: preferred.x, y: 0.25 },
    { x: 0.3, y: 0.3 },
    { x: 0.7, y: 0.25 },
    { x: 0.5, y: 0.15 },
  ];
  for (const candidate of candidates) {
    const px = box.x + box.width * candidate.x;
    const py = box.y + box.height * candidate.y;
    const blocked = await page.evaluate(([x, y]) => {
      const element = document.elementFromPoint(x as number, y as number);
      if (!element) return true;
      return Boolean(
        element.closest('.react-flow__node') || element.closest('.react-flow__panel'),
      );
    }, [px, py]);
    if (!blocked) {
      await canvas.dblclick({
        position: {
          x: Math.round(box.width * candidate.x),
          y: Math.round(box.height * candidate.y),
        },
      });
      return;
    }
  }
  throw new Error('No empty canvas point found to open the quick node picker');
}
