import { test, expect, type Page } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * FS-0133 — accessibility-focused Flow Studio browser test.
 *
 * Covers keyboard opening of the command palette (Cmd/Ctrl+K) and the
 * quick node picker (double-click empty canvas), palette search focus,
 * node selection, inspector labeled-field interaction, Escape close
 * behavior, and the Delete/Backspace guard while typing in an input.
 *
 * Roles/labels only (no new accessibility dependency). Event-driven
 * polling assertions throughout: no fixed sleeps. Self-cleaning via
 * best-effort flow DELETE in a finally block with unique flow names.
 */

async function createFlow(page: Page, name: string): Promise<string> {
  return page.evaluate(async (flowName: string) => {
    const response = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: flowName }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create flow (${response.status})`);
    }
    const payload = (await response.json()) as { flow: { id: string } };
    return payload.flow.id;
  }, name);
}

async function deleteFlowBestEffort(page: Page, flowId: string): Promise<void> {
  if (page.isClosed()) return;
  try {
    await page.evaluate(async (id: string) => {
      try {
        await fetch(`/api/flows/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {
        // Intentionally ignored: cleanup only.
      }
    }, flowId);
  } catch {
    // Intentionally ignored: cleanup only.
  }
}

async function openStudio(page: Page, flowId: string): Promise<void> {
  await page.goto(`/flows/${flowId}`);
  await expect(page.getByTestId('flow-studio-shell')).toBeVisible();
  await expect(page.getByTestId('flow-canvas')).toBeVisible();
  await expect(page.getByTestId('node-palette')).toBeVisible();
}

/** Double-click empty canvas to open the quick node picker, then add one node. */
async function addMemorySourceViaQuickPicker(page: Page): Promise<void> {
  const canvas = page.getByTestId('flow-canvas');
  const nodes = page.locator('.react-flow__node');
  const before = await nodes.count();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('Flow canvas has no bounding box');
  const candidates = [
    { x: 0.3, y: 0.4 },
    { x: 0.3, y: 0.8 },
    { x: 0.7, y: 0.8 },
    { x: 0.5, y: 0.15 },
  ];
  let position: { x: number; y: number } | null = null;
  for (const c of candidates) {
    const px = box.x + box.width * c.x;
    const py = box.y + box.height * c.y;
    const blocked = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x as number, y as number);
      if (!el) return true;
      return Boolean(
        el.closest('.react-flow__node') || el.closest('.react-flow__panel'),
      );
    }, [px, py]);
    if (!blocked) {
      position = { x: Math.round(box.width * c.x), y: Math.round(box.height * c.y) };
      break;
    }
  }
  if (!position) throw new Error('No empty canvas point found');
  await canvas.dblclick({ position });
  const picker = page.getByTestId('quick-node-picker');
  await expect(picker).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('quick-node-picker-search').fill('memory-source');
  const item = page.getByTestId('quick-node-picker-item-memory-source');
  await expect(item).toBeVisible({ timeout: 10_000 });
  await item.click();
  await expect(picker).toBeHidden({ timeout: 10_000 });
  await expect(nodes).toHaveCount(before + 1, { timeout: 10_000 });
}

test('command palette and picker are keyboard operable with Escape close', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);
  const flowId = await createFlow(page, `e2e-a11y-palette-${Date.now()}`);

  try {
    await openStudio(page, flowId);

    // Critical controls are discoverable by role/name.
    await expect(page.getByRole('button', { name: 'Commands' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deploy flow' })).toBeVisible();

    // Palette search is a labeled, focusable searchbox.
    const paletteSearch = page
      .getByTestId('node-palette')
      .getByRole('searchbox', { name: 'Search nodes' });
    await expect(paletteSearch).toBeVisible();
    await paletteSearch.focus();
    await expect(paletteSearch).toBeFocused();
    await paletteSearch.fill('memory');
    await expect(page.getByTestId('node-palette-item-memory-source')).toBeVisible();
    await paletteSearch.fill('');

    // Keyboard opens the command palette (Ctrl/Cmd+K driven by the page).
    await page.keyboard.press('Control+k');
    const paletteInput = page.getByTestId('flow-command-palette-input');
    await expect(paletteInput).toBeVisible({ timeout: 10_000 });
    await expect(paletteInput).toBeFocused({ timeout: 10_000 });

    // Palette search takes focus and filters command rows by role.
    await paletteInput.fill('Deploy');
    await expect(page.getByTestId('flow-command-deploy')).toBeVisible({
      timeout: 10_000,
    });

    // Escape closes the palette without side effects.
    await page.keyboard.press('Escape');
    await expect(paletteInput).toBeHidden({ timeout: 10_000 });

    // Quick node picker: dialog role, search focus on open, Escape closes.
    const canvas = page.getByTestId('flow-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('Flow canvas has no bounding box');
    await canvas.dblclick({
      position: { x: Math.round(box.width * 0.5), y: Math.round(box.height * 0.6) },
    });
    const picker = page.getByTestId('quick-node-picker');
    await expect(picker).toBeVisible({ timeout: 10_000 });
    await expect(picker).toHaveAttribute('role', 'dialog');
    const pickerSearch = page.getByTestId('quick-node-picker-search');
    await expect(pickerSearch).toBeFocused({ timeout: 10_000 });
    await pickerSearch.fill('memory-source');
    await expect(page.getByTestId('quick-node-picker-item-memory-source')).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('.react-flow__node')).toHaveCount(0);

    const unexpectedErrors = errors.filter(
      (message) => !/404 \(Not Found\)/.test(message),
    );
    expect(unexpectedErrors).toEqual([]);
  } finally {
    await deleteFlowBestEffort(page, flowId);
  }
});

test('node selection exposes labeled inspector fields and typing guards Delete', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);
  const flowId = await createFlow(page, `e2e-a11y-inspector-${Date.now()}`);

  try {
    await openStudio(page, flowId);
    await addMemorySourceViaQuickPicker(page);

    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(1);
    const node = nodes.first();

    // Node selection opens the inspector for that node type.
    await node.click();
    const inspector = page.getByTestId('node-inspector');
    await expect(inspector).toBeVisible({ timeout: 10_000 });
    await expect(inspector).toContainText('memory-source@v1', { timeout: 10_000 });

    // Inspector fields are labeled controls; interaction round-trips.
    const displayName = page.getByLabel('Display name');
    await expect(displayName).toBeVisible();
    await displayName.fill('a11y-node');
    await expect(displayName).toHaveValue('a11y-node');

    const topic = page.getByLabel(/Topic/);
    await expect(topic).toBeVisible();
    await topic.fill('a11y-topic');
    await expect(topic).toHaveValue('a11y-topic');

    // Delete guard: Backspace while typing edits text, never the graph.
    await displayName.focus();
    await expect(displayName).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await expect(displayName).toHaveValue('a11y-nod');
    await expect(nodes).toHaveCount(1);

    // Same guard on the required property field.
    await topic.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await expect(topic).toHaveValue('a11y-topi');
    await expect(nodes).toHaveCount(1);

    // Escape blurs/closes without deleting; the node survives keyboard noise.
    await page.keyboard.press('Escape');
    await expect(nodes).toHaveCount(1);
    await expect(inspector).toBeVisible();

    const unexpectedErrors = errors.filter(
      (message) => !/404 \(Not Found\)/.test(message),
    );
    expect(unexpectedErrors).toEqual([]);
  } finally {
    await deleteFlowBestEffort(page, flowId);
  }
});
