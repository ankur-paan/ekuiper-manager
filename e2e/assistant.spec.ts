import { test, expect } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

test('read-only operations agent is global and available in the rule designer', async ({ page }) => {
  const errors = captureUnexpectedErrors(page);
  await ensureSignedIn(page);

  await page.goto('/rules/new');
  await expect(page.getByRole('heading', { name: 'Rule designer', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await expect(page.getByRole('heading', { name: 'Operations agent' })).toBeVisible();
  await expect(page.getByText('Read-only tools · secrets redacted')).toBeVisible();
  await expect(
    page.getByText(/It correlates live state; you control every change/i),
  ).toBeVisible();

  const disabled = page.getByText('Assistant provider not configured');
  const enabled = page.getByText('Ask about the actual stack');
  await expect(disabled.or(enabled)).toBeVisible();

  expect(errors).toEqual([]);
});

test('configured agent renders Markdown, investigation evidence, and clickable follow-up advice', async ({ page }) => {
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
        rounds: 3,
        toolCallCount: 3,
        activity: [
          { tool: 'manager_overview', label: 'Manager and PostgreSQL overview', status: 'completed', round: 1, durationMs: 8 },
          { tool: 'ekuiper_read', label: 'eKuiper: /rules', status: 'completed', round: 1, durationMs: 12 },
          { tool: 'ekuiper_read', label: 'eKuiper: /rules/rule_1/status', status: 'completed', round: 2, durationMs: 7 },
        ],
      }),
    });
  });

  await ensureSignedIn(page);
  await page.goto('/rules/new');
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await expect(page.getByText('Ask about the actual stack')).toBeVisible();
  await page.getByRole('button', { name: 'Summarize this stack from live data' }).click();

  await expect(page.getByText(/use Validate before Create rule/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await expect(page.getByText(/Investigated 3 read-only sources over 3 reasoning rounds/i)).toBeVisible();
  await page.getByText(/Investigated 3 read-only sources/i).click();
  await expect(page.getByText('eKuiper: /rules/rule_1/status')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explain the generated SQL' })).toBeVisible();
  expect(requestBody.messages?.at(-1)).toEqual({
    role: 'user',
    content: 'Summarize this stack from live data',
  });
  expect(requestBody.context).toMatchObject({ path: '/rules/new', title: 'Rule designer' });
  expect(requestBody.context?.snapshot).toContain('Rule designer');
  expect((requestBody.context?.snapshot ?? '').length).toBeLessThanOrEqual(8_000);

  await page.getByRole('button', { name: 'Explain the generated SQL' }).click();
  await expect(page.locator('[data-message-role="user"]').last()).toHaveText('Explain the generated SQL');
  expect(errors).toEqual([]);
});

test('optional live provider performs a real multi-source stack investigation', async ({ page }) => {
  test.skip(process.env.E2E_LIVE_AI !== '1', 'Set E2E_LIVE_AI=1 only for an explicitly configured provider');
  await ensureSignedIn(page);

  const status = await page.request.get('/api/assistant/status');
  expect(status.ok()).toBeTruthy();
  expect(await status.json()).toMatchObject({ enabled: true });

  const response = await page.request.post('/api/assistant/chat', {
    headers: { Origin: 'http://localhost:3000' },
    data: {
      messages: [{
        role: 'user',
        content: 'Inspect the actual selected stack. Report the exact eKuiper version, rule count, and whether any rule is unhealthy. Use live data, not the screen.',
      }],
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
  expect(payload.toolCallCount).toBeGreaterThanOrEqual(2);
  expect(payload.rounds).toBeGreaterThanOrEqual(2);
  expect(payload.activity.length).toBeGreaterThanOrEqual(2);
  expect(payload.activity.every((item: { status: string }) => item.status === 'completed')).toBeTruthy();
});
