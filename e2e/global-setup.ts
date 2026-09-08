import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { ownerPassword, ownerUsername, STORAGE_STATE_PATH } from './helpers';

/**
 * Sign in once for the whole run and save the session.
 *
 * `POST /api/auth/login` is rate limited to 10 attempts per 15 minutes per client+username
 * (`src/app/api/auth/login/route.ts`). Every spec signing in for itself exhausted that budget
 * partway through the suite, and from then on every remaining test failed at
 * `toHaveURL(/dashboard$/)` while sitting on `/welcome` - regardless of what it was testing.
 * Retries made it worse, because each retry spent another attempt.
 *
 * The limit is correct product behaviour, so the suite adapts to it: authenticate once here,
 * hand every test the resulting cookie via `storageState`, and spend exactly one attempt per
 * run instead of one per test.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.E2E_BASE_URL ??
    'http://localhost:3000';

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await page.goto('/');
    if (page.url().includes('/welcome')) {
      const setup = page.getByRole('heading', { name: 'Create the owner account' });
      const signIn = page.getByRole('heading', { name: 'Sign in' });
      await setup.or(signIn).waitFor({ state: 'visible', timeout: 30_000 });

      await page.getByLabel('Username').fill(ownerUsername);
      await page.getByLabel('Password', { exact: true }).fill(ownerPassword);
      if (await setup.isVisible()) {
        await page.getByLabel('Confirm password').fill(ownerPassword);
        await page.getByRole('button', { name: 'Complete setup' }).click();
      } else {
        await page.getByRole('button', { name: 'Sign in' }).click();
      }
      await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
    }

    mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });
    await context.storageState({ path: STORAGE_STATE_PATH });
  } finally {
    await browser.close();
  }
}
