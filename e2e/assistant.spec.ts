import { test, expect } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

test('operator assistant is global, explicit, and available in the rule designer', async ({ page }) => {
  const errors = captureUnexpectedErrors(page);
  await ensureSignedIn(page);

  await page.goto('/rules/new');
  await expect(page.getByRole('heading', { name: 'Rule designer', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await expect(page.getByRole('heading', { name: 'Operator assistant' })).toBeVisible();
  await expect(page.getByText('Visible secrets are redacted')).toBeVisible();
  await expect(
    page.getByText(/It advises; you review and operate every control/i),
  ).toBeVisible();

  const disabled = page.getByText('Assistant provider not configured');
  const enabled = page.getByText('Ask about any visible option');
  await expect(disabled.or(enabled)).toBeVisible();

  expect(errors).toEqual([]);
});

test('configured assistant renders Markdown and clickable follow-up advice', async ({ page }) => {
  const errors = captureUnexpectedErrors(page);
  let requestBody: {
    messages?: Array<{ role?: string; content?: string }>;
    context?: { path?: string; title?: string; snapshot?: string };
  } = {};

  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true, model: 'test/model' }),
    }),
  );
  await page.route('**/api/assistant/chat', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        model: 'test/model',
        message: '## Review\n\n- Check the generated SQL.\n- Use `Validate` before **Create rule**.',
        suggestions: ['Explain the generated SQL', 'What should I validate next?'],
      }),
    });
  });

  await ensureSignedIn(page);
  await page.goto('/rules/new');
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await expect(page.getByText('Ask about any visible option')).toBeVisible();
  await page.getByRole('button', { name: 'Explain this page' }).click();

  await expect(page.getByText(/use Validate before Create rule/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explain the generated SQL' })).toBeVisible();
  expect(requestBody.messages?.at(-1)).toEqual({ role: 'user', content: 'Explain this page' });
  expect(requestBody.context).toMatchObject({ path: '/rules/new', title: 'Rule designer' });
  expect(requestBody.context?.snapshot).toContain('Rule designer');
  expect((requestBody.context?.snapshot ?? '').length).toBeLessThanOrEqual(8_000);

  await page.getByRole('button', { name: 'Explain the generated SQL' }).click();
  await expect(page.locator('[data-message-role="user"]').last()).toHaveText('Explain the generated SQL');
  expect(errors).toEqual([]);
});

test('optional live provider smoke returns operator guidance', async ({ page }) => {
  test.skip(process.env.E2E_LIVE_AI !== '1', 'Set E2E_LIVE_AI=1 only for an explicitly configured provider');
  await ensureSignedIn(page);

  const status = await page.request.get('/api/assistant/status');
  expect(status.ok()).toBeTruthy();
  expect(await status.json()).toMatchObject({ enabled: true });

  const response = await page.request.post('/api/assistant/chat', {
    headers: { Origin: 'http://localhost:3000' },
    data: {
      messages: [{ role: 'user', content: 'In one sentence, what should I review before creating this rule?' }],
      context: {
        path: '/rules/new',
        title: 'Rule designer',
        snapshot: 'Rule ID: release_smoke\nGenerated SQL: SELECT * FROM source\nCreate stopped: selected',
      },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  expect(payload.model).toBeTruthy();
  expect(payload.message.length).toBeGreaterThan(10);
});
