import { expect, type Page } from '@playwright/test';

export const ownerUsername = process.env.E2E_USERNAME ?? 'e2e-owner';
export const ownerPassword = process.env.E2E_PASSWORD ?? 'e2e-owner-password!42';

export async function ensureSignedIn(page: Page): Promise<void> {
  await page.goto('/');
  if (!page.url().includes('/welcome')) return;

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
