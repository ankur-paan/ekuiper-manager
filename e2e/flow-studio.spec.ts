import { test, expect } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

test.describe.configure({ mode: 'serial' });

test('flow studio authoring journey round-trips through autosave', async ({ page }) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);

  const flowName = `e2e-flow-studio-${Date.now()}`;
  const flowId = await page.evaluate(async (name: string) => {
    const response = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create flow (${response.status})`);
    }
    const payload = (await response.json()) as { flow: { id: string } };
    return payload.flow.id;
  }, flowName);

  try {
    await page.goto(`/flows/${flowId}`);
    await expect(page.getByTestId('flow-studio-shell')).toBeVisible();
    const canvas = page.getByTestId('flow-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('node-palette')).toBeVisible();
    await expect(page.getByTestId('flow-studio-header')).toContainText(flowName);

    const nodes = page.getByTestId('flow-node');
    const edges = page.locator('.react-flow__edge');
    const topicInput = page.getByLabel('Topic', { exact: true });

    async function addNodeFromPalette(
      type: 'memory-source' | 'memory-sink',
      targetPosition: { x: number; y: number },
    ): Promise<void> {
      const item = page.getByTestId(`node-palette-item-${type}`);
      await expect(item).toBeVisible();
      const before = await nodes.count();
      await item.dragTo(canvas, { targetPosition });
      await expect(nodes).toHaveCount(before + 1, { timeout: 10_000 });
    }

    // Add a Memory Source and a Memory Sink from the palette onto the canvas.
    await addNodeFromPalette('memory-source', { x: 160, y: 220 });
    await addNodeFromPalette('memory-sink', { x: 560, y: 220 });

    const sourceNode = nodes.filter({
      has: page.getByTestId('flow-node-output-out'),
    });
    const sinkNode = nodes.filter({
      has: page.getByTestId('flow-node-input-in'),
    });
    await expect(sourceNode).toHaveCount(1);
    await expect(sinkNode).toHaveCount(1);

    // R1: both nodes render visible connection handles.
    await expect(sourceNode.getByTestId('flow-node-output-out')).toBeVisible();
    await expect(sinkNode.getByTestId('flow-node-input-in')).toBeVisible();

    // Configure a required property on each node.
    const topic = `e2e-topic-${Date.now()}`;
    await sourceNode.click();
    await expect(page.getByTestId('node-inspector')).toContainText('memory-source@v1');
    await topicInput.fill(topic);
    await sinkNode.click();
    await expect(page.getByTestId('node-inspector')).toContainText('memory-sink@v1');
    await topicInput.fill(topic);

    // Connect source output to sink input by dragging between the real handles.
    await expect(edges).toHaveCount(0);
    const sourceHandle = sourceNode.getByTestId('flow-node-output-out');
    const sinkHandle = sinkNode.getByTestId('flow-node-input-in');
    const fromBox = await sourceHandle.boundingBox();
    const toBox = await sinkHandle.boundingBox();
    expect(fromBox).not.toBeNull();
    expect(toBox).not.toBeNull();
    if (!fromBox || !toBox) {
      throw new Error('Connection handles have no bounding box');
    }
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 15 });
    await page.mouse.up();
    await expect(edges).toHaveCount(1, { timeout: 10_000 });

    // Settle autosave so the move below is measured against a saved baseline.
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible({ timeout: 30_000 });

    // Move a node: layout-only, must not mark the flow semantically dirty.
    const nodeBox = await sourceNode.boundingBox();
    expect(nodeBox).not.toBeNull();
    if (!nodeBox) {
      throw new Error('Source node has no bounding box');
    }
    const startX = nodeBox.x + nodeBox.width / 2;
    const startY = nodeBox.y + nodeBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 140, startY + 90, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('[data-layout-dirty="true"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-semantic-dirty="false"]')).toBeVisible({ timeout: 10_000 });

    // R2: clearing a previously-set property must not crash and stays dirty.
    await sinkNode.click();
    await expect(page.getByTestId('node-inspector')).toContainText('memory-sink@v1');
    await expect(topicInput).toHaveValue(topic);
    await topicInput.fill('');
    await expect(topicInput).toHaveValue('');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('node-inspector')).toBeVisible();
    await expect(page.locator('[data-semantic-dirty="true"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('flow-studio-header')).toContainText(/Unsaved changes|Saving/, {
      timeout: 10_000,
    });

    // Delete a node, undo, and assert it returns with its edge.
    await sinkNode.click();
    await page.getByTestId('node-inspector-delete').click();
    await expect(nodes).toHaveCount(1, { timeout: 10_000 });
    await expect(edges).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(nodes).toHaveCount(2, { timeout: 10_000 });
    await expect(edges).toHaveCount(1, { timeout: 10_000 });

    // R3: wait for autosave, reload, and assert nodes, edge, and property persist.
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId('flow-studio-shell')).toBeVisible();
    await expect(nodes).toHaveCount(2, { timeout: 15_000 });
    await expect(edges).toHaveCount(1, { timeout: 10_000 });
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible({ timeout: 30_000 });
    await sourceNode.click();
    await expect(page.getByTestId('node-inspector')).toContainText('memory-source@v1');
    await expect(topicInput).toHaveValue(topic);
    await sinkNode.click();
    await expect(page.getByTestId('node-inspector')).toContainText('memory-sink@v1');
    await expect(topicInput).toHaveValue('');

    expect(errors).toEqual([]);
  } finally {
    // No DELETE /api/flows endpoint exists yet, so this is a best-effort
    // removal that a future delete route will honor. Flow names are unique
    // per run to avoid collisions in the meantime.
    await page.evaluate(async (id: string) => {
      try {
        await fetch(`/api/flows/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {
        // Intentionally ignored: cleanup only.
      }
    }, flowId);
  }
});
