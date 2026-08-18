import { test, expect } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

test.describe.configure({ mode: 'serial' });

test('owner, node, stream, rule, and user lifecycle', async ({ page }) => {
  test.setTimeout(90_000);
  await ensureSignedIn(page);

  // Keep reruns deterministic after an interrupted lifecycle attempt.
  await page.evaluate(async () => {
    await fetch('/api/ekuiper/rules/e2e_rule/stop', { method: 'POST' });
    await fetch('/api/ekuiper/rules/e2e_rule', { method: 'DELETE' });
    await fetch('/api/ekuiper/streams/e2e_stream', { method: 'DELETE' });
  });
  const errors = captureUnexpectedErrors(page);

  await page.goto('/nodes');
  await expect(page.getByRole('heading', { name: 'eKuiper nodes' })).toBeVisible();
  await expect(page.getByTestId('node-card').first()).toBeVisible();

  await page.goto('/streams/new');
  await page.getByLabel('eKuiper SQL').fill(
    'CREATE STREAM e2e_stream (id BIGINT, value FLOAT) WITH (TYPE="memory", DATASOURCE="e2e_stream", FORMAT="json");',
  );
  await page.getByRole('button', { name: 'Save stream' }).click();
  await expect(page).toHaveURL(/\/streams\/e2e_stream$/);
  await expect(page.getByRole('heading', { name: 'e2e_stream' })).toBeVisible();

  await page.goto('/rules/new');
  await page.getByLabel('Rule ID').fill('e2e_rule');
  await page.getByRole('button').filter({ hasText: 'e2e_stream' }).click();
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('eKuiper accepted this rule definition');
  await page.getByRole('button', { name: 'Create rule', exact: true }).first().click();
  await expect(page).toHaveURL(/\/rules\/e2e_rule/);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('running', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();

  await page.goto('/users');
  const existingUser = page.getByTestId('user-row').filter({ hasText: 'e2e-operator' });
  if (await existingUser.count()) {
    await existingUser.getByRole('button', { name: 'Actions for e2e-operator' }).click();
    await page.getByRole('menuitem', { name: 'Delete user' }).click();
    await page.getByRole('button', { name: 'Delete user', exact: true }).click();
    await expect(existingUser).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Add user' }).click();
  await page.getByLabel('Username').fill('e2e-operator');
  await page.getByTestId('confirm-add-user').click();
  await expect(page.getByRole('heading', { name: 'Temporary password' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  const userRow = page.getByTestId('user-row').filter({ hasText: 'e2e-operator' });
  await expect(userRow).toBeVisible();
  await userRow.getByRole('button', { name: 'Actions for e2e-operator' }).click();
  await page.getByRole('menuitem', { name: 'Reset password' }).click();
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Temporary password' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await userRow.getByRole('button', { name: 'Actions for e2e-operator' }).click();
  await page.getByRole('menuitem', { name: 'Delete user' }).click();
  await page.getByRole('button', { name: 'Delete user', exact: true }).click();
  await expect(userRow).toHaveCount(0);

  await page.goto('/rules/e2e_rule');
  await page.getByRole('button', { name: 'Delete rule' }).click();
  await page.getByRole('button', { name: 'Delete rule', exact: true }).last().click();
  await expect(page).toHaveURL(/\/rules$/);
  await page.goto('/streams/e2e_stream');
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete stream' }).click();
  await expect(page).toHaveURL(/\/streams$/);

  expect(errors).toEqual([]);
});
