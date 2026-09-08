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
    // Assert the RESPONSE, not the page text. `getByText('404')` is a substring match, so it
    // also matched user-generated content that merely contains those digits - the /flows list
    // renders flow names built from Date.now(), and a timestamp ending in 404 failed the whole
    // spec. That was a real intermittent failure once /flows joined the sidebar, and it said
    // nothing about whether the route resolved.
    const response = await page.goto(link.href);
    expect(response?.status() ?? 0, `${link.href} should resolve, not 404`).toBeLessThan(400);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
