import { test, expect } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

test.describe.configure({ mode: 'serial' });

test('visual rule design and safe duplication round-trip through eKuiper', async ({ page }) => {
  test.setTimeout(90_000);
  await ensureSignedIn(page);

  await page.evaluate(async () => {
    for (const id of ['e2e_designer_copy', 'e2e_designer_rule']) {
      await fetch(`/api/ekuiper/rules/${id}/stop`, { method: 'POST' });
      await fetch(`/api/ekuiper/rules/${id}`, { method: 'DELETE' });
    }
    await fetch('/api/ekuiper/streams/e2e_designer_stream', { method: 'DELETE' });
    await fetch('/api/ekuiper/streams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: 'CREATE STREAM e2e_designer_stream (deviceId STRING, temperature FLOAT) WITH (TYPE="memory", DATASOURCE="e2e_designer_stream", FORMAT="json");',
      }),
    });
  });
  const errors = captureUnexpectedErrors(page);

  await page.goto('/query-designer');
  await expect(page).toHaveURL(/\/rules\/new$/);
  await expect(page.getByRole('heading', { name: 'Rule designer', level: 2 })).toBeVisible();
  await page.getByLabel('Rule ID').fill('e2e_designer_rule');
  await page.getByRole('button').filter({ hasText: 'e2e_designer_stream' }).click();
  await page.getByLabel('Filter (WHERE)').fill('temperature > 80');
  await expect(page.getByRole('textbox', { name: 'Rule JSON' })).toHaveValue(/SELECT \* FROM e2e_designer_stream WHERE temperature > 80/);

  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('eKuiper accepted this rule definition');
  await page.getByRole('button', { name: 'Create rule', exact: true }).first().click();
  await expect(page).toHaveURL(/\/rules\/e2e_designer_rule/);

  const created = await page.evaluate(async () => (await fetch('/api/ekuiper/rules/e2e_designer_rule')).json());
  expect(created).toMatchObject({
    id: 'e2e_designer_rule',
    sql: 'SELECT * FROM e2e_designer_stream WHERE temperature > 80',
    triggered: false,
    actions: [{ log: {} }],
  });

  await page.goto('/rules');
  const row = page.getByText('e2e_designer_rule', { exact: true }).locator('..').locator('..');
  await row.getByRole('button', { name: 'Actions for e2e_designer_rule' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await page.getByLabel('New rule ID').fill('e2e_designer_copy');
  await page.getByRole('button', { name: 'Duplicate stopped' }).click();
  await expect(page).toHaveURL(/\/rules\/e2e_designer_copy\/edit$/);

  const copy = await page.evaluate(async () => (await fetch('/api/ekuiper/rules/e2e_designer_copy')).json());
  expect(copy).toMatchObject({
    id: 'e2e_designer_copy',
    sql: 'SELECT * FROM e2e_designer_stream WHERE temperature > 80',
    triggered: false,
    actions: [{ log: {} }],
  });

  for (const id of ['e2e_designer_copy', 'e2e_designer_rule']) {
    await page.request.delete(`/api/ekuiper/rules/${id}`, {
      headers: { Origin: 'http://localhost:3000' },
    });
  }
  await page.request.delete('/api/ekuiper/streams/e2e_designer_stream', {
    headers: { Origin: 'http://localhost:3000' },
  });

  expect(errors).toEqual([]);
});
