import { expect, test } from '@playwright/test';
import { ensureSignedIn } from './helpers';

test('a selected non-default eKuiper node survives reload and navigation', async ({ page }) => {
  await ensureSignedIn(page);

  const bundledId = await page.evaluate(async () => {
    const current = await fetch('/api/nodes', { cache: 'no-store' }).then((response) => response.json());
    const stale = current.nodes.find((node: { name: string }) => node.name === 'e2e alternate');
    if (stale) await fetch(`/api/nodes/${encodeURIComponent(stale.id)}`, { method: 'DELETE' });
    const bundled = current.nodes.find((node: { id: string }) => node.id === 'bundled-ekuiper');
    return bundled.id as string;
  });

  await page.goto('/nodes');
  await page.getByRole('button', { name: 'Add node' }).click();
  await page.getByLabel('Name').fill('e2e alternate');
  await page.getByLabel('REST URL').fill('http://ekuiper-alt:9081');
  await page.getByRole('button', { name: 'Save node' }).click();
  await expect(page.getByText('Node added and selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select eKuiper node' })).toContainText('e2e alternate');

  const createdState = await page.evaluate(async () =>
    fetch('/api/nodes', { cache: 'no-store' }).then((response) => response.json()),
  );
  const alternateId = createdState.nodes.find(
    (node: { name: string }) => node.name === 'e2e alternate',
  ).id as string;

  await page.reload();
  await expect(page.getByRole('button', { name: 'Select eKuiper node' })).toContainText('e2e alternate');
  await page.goto('/streams');
  await expect(page.getByText('Definitions on e2e alternate.')).toBeVisible();
  const selected = await page.evaluate(async () =>
    fetch('/api/nodes', { cache: 'no-store' }).then((response) => response.json()),
  );
  expect(selected.selectedNodeId).toBe(alternateId);

  await page.evaluate(async ({ alternateId, bundledId }) => {
    await fetch(`/api/nodes/${encodeURIComponent(bundledId)}/select`, { method: 'POST' });
    await fetch(`/api/nodes/${encodeURIComponent(alternateId)}`, { method: 'DELETE' });
  }, { alternateId, bundledId });
});
