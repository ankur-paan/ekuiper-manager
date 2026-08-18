import { test, expect } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

test('all primary navigation destinations are reachable and mobile navigation works', async ({ page }, testInfo) => {
  const errors = captureUnexpectedErrors(page);
  await ensureSignedIn(page);

  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Toggle Menu' }).click();
  }
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  const links = await nav.getByRole('link').evaluateAll((elements) =>
    elements.map((element) => ({ href: element.getAttribute('href') ?? '' })),
  );
  expect(links.length).toBeGreaterThanOrEqual(10);

  for (const link of links) {
    await page.goto(link.href);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText('404')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
