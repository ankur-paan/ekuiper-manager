import { test, expect, type Page } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Browser drag/drop MIME for palette node creation (FS-0066).
 *
 * Mirrors FLOW_PALETTE_DRAG_MIME in
 * src/components/flow-studio/palette/node-palette.tsx. The canvas drop
 * handler reads exactly this key, so the synthetic drop below must use it.
 */
const FLOW_PALETTE_DRAG_MIME = 'application/x-ekuiper-flow-node';

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
  // Guarded so a timed-out test whose browser context already closed does
  // not mask the original failure with a teardown error.
  if (page.isClosed()) return;
  try {
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
  } catch {
    // Intentionally ignored: cleanup only (e.g. browser closed after timeout).
  }
}

test('flow studio authoring journey round-trips through autosave', async ({ page }) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);

  const flowName = `e2e-flow-studio-${Date.now()}`;
  const flowId = await createFlow(page, flowName);

  try {
    await page.goto(`/flows/${flowId}`);
    await expect(page.getByTestId('flow-studio-shell')).toBeVisible();
    const canvas = page.getByTestId('flow-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('node-palette')).toBeVisible();
    await expect(page.getByTestId('flow-studio-header')).toContainText(flowName);

    // Use the outer ReactFlow node element: the inner flow-node div sits inside
    // ReactFlow's transformed container and Playwright can read its box as
    // unstable after a drag, even though the node is visually settled.
    const nodes = page.locator('.react-flow__node');
    const edges = page.locator('.react-flow__edge');
    // Scope to the property field's testid rather than the label text: the label
    // renders as 'Topic*' (required marker), so an exact label match finds nothing.
    const topicInput = page.getByTestId('property-field-topic').locator('input');

    async function ensureCanvasReady(): Promise<{ width: number; height: number }> {
      await expect(canvas).toBeVisible();
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error('Flow canvas has no bounding box');
      }
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
      return { width: box.width, height: box.height };
    }

    // Node creation uses the FS-0070 quick node picker (double-click empty
    // canvas), a genuine user path driven by ordinary mouse events.
    // Playwright's dragTo is deliberately NOT used here: it does not
    // populate the custom application/x-ekuiper-flow-node dataTransfer
    // payload the canvas drop handler reads, so the drop is ignored and no
    // node is created. Palette drag/drop itself is covered by the focused
    // synthetic-DataTransfer test below.
    // The double-click is driven RELATIVE TO THE CANVAS ELEMENT (not the
    // viewport): Flow Studio is a three-column layout (palette left, canvas
    // centre, inspector right), so absolute viewport points do not reliably
    // land on the canvas pane. canvas.dblclick({ position }) resolves the
    // point inside the canvas element, guaranteeing the event reaches the
    // canvas wrapper that owns onDoubleClick.
    async function addNodeViaQuickPicker(
      type: 'memory-source' | 'memory-sink',
      fractionX: number,
      fractionY: number,
    ): Promise<void> {
      const before = await nodes.count();
      const size = await ensureCanvasReady();
      const box = (await canvas.boundingBox())!;

      // The canvas is narrow and a node is ~208px wide, so a naive fraction can
      // land on an existing node. flow-canvas.tsx deliberately ignores
      // double-clicks inside .react-flow__node / .react-flow__panel (the React
      // Flow attribution link lives in a panel), so the picker would never open.
      // Probe the intended point and fall back to other candidates until one is
      // provably empty.
      const candidates = [
        { x: fractionX, y: fractionY },
        { x: fractionX, y: 0.8 },
        { x: 0.85, y: 0.8 },
        { x: 0.15, y: 0.85 },
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
          position = {
            x: Math.round(box.width * c.x),
            y: Math.round(box.height * c.y),
          };
          break;
        }
      }
      if (!position) {
        throw new Error(`No empty canvas point found to place ${type}`);
      }

      await canvas.dblclick({ position });
      const picker = page.getByTestId('quick-node-picker');
      await expect(picker).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('quick-node-picker-search').fill(type);
      const item = page.getByTestId(`quick-node-picker-item-${type}`);
      await expect(item).toBeVisible({ timeout: 10_000 });
      await item.click();
      await expect(picker).toBeHidden({ timeout: 10_000 });
      await expect(nodes).toHaveCount(before + 1, { timeout: 10_000 });
    }

    // Add a Memory Source and a Memory Sink at well-separated canvas points
    // so the second double-click lands on empty canvas, not on the first node.
    // Fractions are well inside the canvas element and comfortably apart.
    await addNodeViaQuickPicker('memory-source', 0.25, 0.4);
    await addNodeViaQuickPicker('memory-sink', 0.65, 0.4);

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
    // Pointer events (not HTML5 DnD) drive XYFlow connections, so the
    // Playwright mouse API is the faithful automation path here. Endpoints
    // are derived from each handle's own bounding box (element-relative, not
    // assumed viewport positions) after waiting on user-visible state.
    await expect(edges).toHaveCount(0);
    const sourceHandle = sourceNode.getByTestId('flow-node-output-out');
    const sinkHandle = sinkNode.getByTestId('flow-node-input-in');
    await sourceHandle.scrollIntoViewIfNeeded();
    await sinkHandle.scrollIntoViewIfNeeded();
    await expect(sourceHandle).toBeVisible();
    await expect(sinkHandle).toBeVisible();
    const fromBox = await sourceHandle.boundingBox();
    const toBox = await sinkHandle.boundingBox();
    expect(fromBox).not.toBeNull();
    expect(toBox).not.toBeNull();
    if (!fromBox || !toBox) {
      throw new Error('Connection handles have no bounding box');
    }
    expect(fromBox.width).toBeGreaterThan(0);
    expect(fromBox.height).toBeGreaterThan(0);
    expect(toBox.width).toBeGreaterThan(0);
    expect(toBox.height).toBeGreaterThan(0);
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2, { steps: 5 });
    await page.mouse.down();
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 20 });
    await page.mouse.up();
    await expect(edges).toHaveCount(1, { timeout: 10_000 });

    // Settle autosave so the move below is measured against a saved baseline.
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible({ timeout: 30_000 });

    // Move a node: layout-only, must not mark the flow semantically dirty.
    // Drag start is derived from the node's own bounding box (element
    // bounding box, not an assumed viewport position) after waiting on
    // user-visible state.
    await expect(sourceNode).toBeVisible();
    const nodeBox = await sourceNode.boundingBox();
    expect(nodeBox).not.toBeNull();
    if (!nodeBox) {
      throw new Error('Source node has no bounding box');
    }
    expect(nodeBox.width).toBeGreaterThan(0);
    expect(nodeBox.height).toBeGreaterThan(0);
    const startX = nodeBox.x + nodeBox.width / 2;
    const startY = nodeBox.y + nodeBox.height / 2;
    // Drag AWAY from the sink node. A fixed positive offset can land the
    // dragged node on top of the other one, after which it intercepts pointer
    // events and the later sink click hits the wrong node.
    const sinkBoxForDrag = await sinkNode.boundingBox();
    expect(sinkBoxForDrag).not.toBeNull();
    const sinkCx = sinkBoxForDrag!.x + sinkBoxForDrag!.width / 2;
    const sinkCy = sinkBoxForDrag!.y + sinkBoxForDrag!.height / 2;
    const dx = startX <= sinkCx ? -90 : 90;
    const dy = startY <= sinkCy ? -70 : 70;
    await page.mouse.move(startX, startY, { steps: 5 });
    await page.mouse.down();
    await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
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

    // A newly created flow has no draft row yet, so the first
    // GET /api/flows/:id/draft returns 404 and the browser logs a resource
    // error. The client handles it correctly (starts from an empty document),
    // but the status conflates "flow does not exist" with "no draft yet".
    // Tolerated here as a known, explained backend behaviour pending an API
    // decision; every OTHER console or page error still fails this test.
    const unexpectedErrors = errors.filter(
      (message) => !/404 \(Not Found\)/.test(message),
    );
    expect(unexpectedErrors).toEqual([]);
  } finally {
    await deleteFlowBestEffort(page, flowId);
  }
});

test('palette drop payload creates a node via real drop events', async ({ page }) => {
  test.setTimeout(90_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);

  const flowName = `e2e-flow-studio-drop-${Date.now()}`;
  const flowId = await createFlow(page, flowName);

  try {
    await page.goto(`/flows/${flowId}`);
    await expect(page.getByTestId('flow-studio-shell')).toBeVisible();
    const canvas = page.getByTestId('flow-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('node-palette-item-memory-source')).toBeVisible();

    // Use the outer ReactFlow node element: the inner flow-node div sits inside
    // ReactFlow's transformed container and Playwright can read its box as
    // unstable after a drag, even though the node is visually settled.
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(0);

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) {
      throw new Error('Flow canvas has no bounding box');
    }
    const dropX = canvasBox.x + canvasBox.width / 2;
    const dropY = canvasBox.y + canvasBox.height / 2;

    // Playwright's dragTo cannot drive this path: it never populates the
    // custom application/x-ekuiper-flow-node dataTransfer payload the canvas
    // drop handler requires. Instead dispatch the same dragstart/dragover/drop
    // event sequence a real browser user produces, carrying a constructed
    // DataTransfer with the genuine registry payload. The drop target is the
    // inner ReactFlow wrapper that owns the onDragOver/onDrop handlers, and
    // viewport client coordinates position the node via screenToFlowPosition.
    const dispatchResult = await page.evaluate(
      ({ mime, clientX, clientY }: { mime: string; clientX: number; clientY: number }) => {
        const paletteItem = document.querySelector(
          '[data-testid="node-palette-item-memory-source"]',
        );
        const dropTarget =
          document.querySelector('[data-testid="flow-canvas"] .react-flow') ??
          document.querySelector('[data-testid="flow-canvas"]');
        if (!(paletteItem instanceof HTMLElement) || !(dropTarget instanceof Element)) {
          return { ok: false as const, reason: 'palette item or canvas not found' };
        }
        const payload = JSON.stringify({ type: 'memory-source', version: 1 });
        const transfer = new DataTransfer();
        transfer.setData(mime, payload);
        function withPayload(type: string): DragEvent {
          const event = new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX,
            clientY,
            dataTransfer: transfer,
          });
          // If the constructor did not adopt the provided transfer, populate
          // the event's own transfer so getData/types still resolve.
          if (event.dataTransfer && event.dataTransfer !== transfer) {
            event.dataTransfer.setData(mime, payload);
          }
          return event;
        }
        paletteItem.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            composed: true,
            dataTransfer: transfer,
          }),
        );
        dropTarget.dispatchEvent(withPayload('dragenter'));
        dropTarget.dispatchEvent(withPayload('dragover'));
        dropTarget.dispatchEvent(withPayload('drop'));
        return { ok: true as const };
      },
      { mime: FLOW_PALETTE_DRAG_MIME, clientX: dropX, clientY: dropY },
    );
    expect(dispatchResult.ok).toBe(true);

    await expect(nodes).toHaveCount(1, { timeout: 10_000 });
    await expect(
      nodes.filter({ has: page.getByTestId('flow-node-output-out') }),
    ).toHaveCount(1);
    await expect(page.getByTestId('flow-studio-header')).toContainText(flowName);

    // A newly created flow has no draft row yet, so the first
    // GET /api/flows/:id/draft returns 404 and the browser logs a resource
    // error. The client handles it correctly (starts from an empty document),
    // but the status conflates "flow does not exist" with "no draft yet".
    // Tolerated here as a known, explained backend behaviour pending an API
    // decision; every OTHER console or page error still fails this test.
    const unexpectedErrors = errors.filter(
      (message) => !/404 \(Not Found\)/.test(message),
    );
    expect(unexpectedErrors).toEqual([]);
  } finally {
    await deleteFlowBestEffort(page, flowId);
  }
});

test('flow studio happy path validates memory source, filter, and log sink then deploys', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);

  // Resolve the bundled eKuiper target for deploy (FS-0089). Display-only
  // fallback: when no managed node exists the test still covers
  // authoring + autosave + server validation, and skips the deploy step.
  const targetNodeId = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/nodes', { cache: 'no-store' });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        nodes?: Array<{ id: string }>;
        selectedNodeId?: string | null;
      };
      if (
        typeof payload.selectedNodeId === 'string' &&
        payload.selectedNodeId.length > 0
      ) {
        return payload.selectedNodeId;
      }
      const first = Array.isArray(payload.nodes) ? payload.nodes[0] : undefined;
      return typeof first?.id === 'string' ? first.id : null;
    } catch {
      return null;
    }
  });

  const flowName = `e2e-flow-studio-happy-${Date.now()}`;
  const flowId = await page.evaluate(
    async ({
      flowName: name,
      target,
    }: {
      flowName: string;
      target: string | null;
    }) => {
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          target ? { name, targetNodeId: target } : { name },
        ),
      });
      if (!response.ok) {
        throw new Error(`Failed to create flow (${response.status})`);
      }
      const payload = (await response.json()) as { flow: { id: string } };
      return payload.flow.id;
    },
    { flowName, target: targetNodeId },
  );
  let deployedRuleId: string | null = null;

  try {
    await page.goto(`/flows/${flowId}`);
    await expect(page.getByTestId('flow-studio-shell')).toBeVisible();
    const canvas = page.getByTestId('flow-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('node-palette')).toBeVisible();
    await expect(page.getByTestId('flow-studio-header')).toContainText(flowName);

    // Use the outer ReactFlow node element: the inner flow-node div sits
    // inside ReactFlow's transformed container and Playwright can read its
    // box as unstable after a drag, even though the node is visually settled.
    const nodes = page.locator('.react-flow__node');
    const edges = page.locator('.react-flow__edge');
    const topicInput = page.getByTestId('property-field-topic').locator('input');
    const expressionInput = page
      .getByTestId('property-field-expression')
      .getByTestId('flow-expression-fallback');

    async function ensureCanvasReady(): Promise<void> {
      await expect(canvas).toBeVisible();
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error('Flow canvas has no bounding box');
      }
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }

    // Node creation uses the FS-0070 quick node picker (double-click empty
    // canvas), a genuine user path driven by ordinary mouse events. The
    // double-click is driven RELATIVE TO THE CANVAS ELEMENT: Flow Studio is
    // a three-column layout, so absolute viewport points do not reliably
    // land on the canvas pane.
    async function addNodeViaQuickPicker(
      type: 'memory-source' | 'filter' | 'log-sink',
      fractionX: number,
      fractionY: number,
    ): Promise<void> {
      const before = await nodes.count();
      await ensureCanvasReady();
      const box = await canvas.boundingBox();
      if (!box) {
        throw new Error('Flow canvas has no bounding box');
      }
      const candidates = [
        { x: fractionX, y: fractionY },
        { x: fractionX, y: 0.8 },
        { x: 0.85, y: 0.8 },
        { x: 0.15, y: 0.85 },
        { x: 0.5, y: 0.15 },
      ];
      let position: { x: number; y: number } | null = null;
      for (const candidate of candidates) {
        const px = box.x + box.width * candidate.x;
        const py = box.y + box.height * candidate.y;
        const blocked = await page.evaluate(([x, y]) => {
          const el = document.elementFromPoint(x as number, y as number);
          if (!el) return true;
          return Boolean(
            el.closest('.react-flow__node') || el.closest('.react-flow__panel'),
          );
        }, [px, py]);
        if (!blocked) {
          position = {
            x: Math.round(box.width * candidate.x),
            y: Math.round(box.height * candidate.y),
          };
          break;
        }
      }
      if (!position) {
        throw new Error(`No empty canvas point found to place ${type}`);
      }
      await canvas.dblclick({ position });
      const picker = page.getByTestId('quick-node-picker');
      await expect(picker).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('quick-node-picker-search').fill(type);
      const item = page.getByTestId(`quick-node-picker-item-${type}`);
      await expect(item).toBeVisible({ timeout: 10_000 });
      await item.click();
      await expect(picker).toBeHidden({ timeout: 10_000 });
      await expect(nodes).toHaveCount(before + 1, { timeout: 10_000 });
    }

    async function connectHandles(
      from: ReturnType<Page['locator']>,
      to: ReturnType<Page['locator']>,
    ): Promise<void> {
      await from.scrollIntoViewIfNeeded();
      await to.scrollIntoViewIfNeeded();
      await expect(from).toBeVisible();
      await expect(to).toBeVisible();
      const fromBox = await from.boundingBox();
      const toBox = await to.boundingBox();
      expect(fromBox).not.toBeNull();
      expect(toBox).not.toBeNull();
      if (!fromBox || !toBox) {
        throw new Error('Connection handles have no bounding box');
      }
      await page.mouse.move(
        fromBox.x + fromBox.width / 2,
        fromBox.y + fromBox.height / 2,
        { steps: 5 },
      );
      await page.mouse.down();
      await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, {
        steps: 20,
      });
      await page.mouse.up();
    }

    // Memory/log built-ins only: no external service is required by the
    // bundled eKuiper stack (FS-0131). The log sink needs no configuration.
    // Stack the three nodes in rows rather than a horizontal line. The canvas is roughly
    // 400px wide between the palette, inspector and bottom dock, and a node is ~208px, so
    // three side by side overlap and the last runs past the right edge with its input handle
    // out of reach - the second connection below then cannot be made.
    await addNodeViaQuickPicker('memory-source', 0.05, 0.12);
    await addNodeViaQuickPicker('filter', 0.05, 0.42);
    // Not bottom-left: React Flow's Controls panel sits there, the picker treats a panel as
    // blocked, and its fallback candidate placed this node past the right edge of the canvas
    // with its input handle unreachable (measured at x=915 in a canvas ending at 936).
    // Mid-canvas clears both the Controls and the bottom-right attribution badge.
    await addNodeViaQuickPicker('log-sink', 0.4, 0.72);
    await expect(nodes).toHaveCount(3, { timeout: 10_000 });

    // Identify each node by its port signature: the source exposes only an
    // output, the sink exposes only an input, and the filter exposes both.
    const sourceNode = nodes
      .filter({ has: page.getByTestId('flow-node-output-out') })
      .filter({ hasNot: page.getByTestId('flow-node-input-in') });
    const sinkNode = nodes
      .filter({ has: page.getByTestId('flow-node-input-in') })
      .filter({ hasNot: page.getByTestId('flow-node-output-out') });
    const filterNode = nodes
      .filter({ has: page.getByTestId('flow-node-input-in') })
      .filter({ has: page.getByTestId('flow-node-output-out') });
    await expect(sourceNode).toHaveCount(1, { timeout: 10_000 });
    await expect(filterNode).toHaveCount(1, { timeout: 10_000 });
    await expect(sinkNode).toHaveCount(1, { timeout: 10_000 });

    // Configure the source topic and the filter expression via the stable
    // inspector hooks. The log sink exposes no required properties.
    const topic = `e2e-happy-${Date.now()}`;
    await sourceNode.click();
    await expect(page.getByTestId('node-inspector')).toContainText(
      'memory-source@v1',
    );
    await topicInput.fill(topic);
    await filterNode.click();
    await expect(page.getByTestId('node-inspector')).toContainText('filter@v1');
    // The expression field starts as a plain textarea and swaps to the lazy-loaded Monaco
    // editor ON FOCUS (FS-0128). `fill()` focuses first, so the textarea unmounts mid-write
    // and the typed value is lost - the flow then fails server validation with
    // FLOW_REQUIRED_PROPERTY_MISSING on an expression the test did set. Focus first, wait for
    // the swap to settle, then type into whichever editor is mounted.
    await expect(expressionInput).toBeVisible({ timeout: 10_000 });
    await expressionInput.click();
    const monacoExpression = page
      .getByTestId('property-field-expression')
      .getByTestId('flow-expression-monaco');
    await monacoExpression.waitFor({ state: 'visible', timeout: 15_000 });
    await monacoExpression.locator('textarea').first().fill('temperature > 20');

    // Let the edit land before the connection drags below: a pointer interaction started
    // while the property write is still in flight loses it.
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible({
      timeout: 30_000,
    });

    // Connect source -> filter -> sink through the real XYFlow handles.
    // Pointer events (not HTML5 DnD) drive XYFlow connections, so the
    // Playwright mouse API is the faithful automation path here.
    await expect(edges).toHaveCount(0);
    await connectHandles(
      sourceNode.getByTestId('flow-node-output-out'),
      filterNode.getByTestId('flow-node-input-in'),
    );
    await expect(edges).toHaveCount(1, { timeout: 10_000 });
    await connectHandles(
      filterNode.getByTestId('flow-node-output-out'),
      sinkNode.getByTestId('flow-node-input-in'),
    );
    await expect(edges).toHaveCount(2, { timeout: 10_000 });

    // Wait for autosave (event-driven polling assertion, never a fixed
    // sleep) so validation and deploy run against the saved draft.
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible({
      timeout: 30_000,
    });

    // Run authoritative server validation from the bottom panel and require
    // a valid saved draft before attempting deploy.
    await page.getByTestId('flow-bottom-panel-tab-validation').click();
    await page.getByTestId('flow-validation-server-button').click();
    await expect(page.getByTestId('flow-validation-server-summary')).toContainText(
      'Server: valid',
      { timeout: 30_000 },
    );

    // Deploy only when the header action is enabled for the saved,
    // error-free draft (FS-0089). The dialog validates the saved draft
    // again; its confirm stays blocked until the server reports valid.
    const deployButton = page.getByRole('button', { name: 'Deploy flow' });
    await expect(deployButton).toBeVisible();
    if (targetNodeId && (await deployButton.isEnabled())) {
      await deployButton.click();
      const dialog = page.getByTestId('flow-deploy-dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByTestId('flow-deploy-validation-summary'),
      ).toContainText('can be deployed', { timeout: 30_000 });
      const confirm = page.getByTestId('flow-deploy-confirm');
      await expect(confirm).toBeEnabled({ timeout: 10_000 });
      await confirm.click();
      await expect(page.getByTestId('flow-deploy-success')).toBeVisible({
        timeout: 60_000,
      });
      deployedRuleId = await page.evaluate(async (id: string) => {
        try {
          const response = await fetch(
            `/api/flows/${encodeURIComponent(id)}/deployment`,
            { cache: 'no-store' },
          );
          if (!response.ok) return null;
          const payload = (await response.json()) as {
            deployment?: { ruleId?: unknown } | null;
          };
          const ruleId = payload.deployment?.ruleId;
          return typeof ruleId === 'string' ? ruleId : null;
        } catch {
          return null;
        }
      }, flowId);
      expect(deployedRuleId).not.toBeNull();
      await page.getByTestId('flow-deploy-cancel').click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
      await expect(page.getByTestId('flow-deployment-status')).toContainText(
        'Deployed',
        { timeout: 30_000 },
      );
    }

    // A newly created flow has no draft row yet, so the first
    // GET /api/flows/:id/draft returns 404 and the browser logs a resource
    // error. The client handles it correctly (starts from an empty document),
    // but the status conflates "flow does not exist" with "no draft yet".
    // Tolerated here as a known, explained backend behaviour pending an API
    // decision; every OTHER console or page error still fails this test.
    const happyUnexpectedErrors = errors.filter(
      (message) => !/404 \(Not Found\)/.test(message),
    );
    expect(happyUnexpectedErrors).toEqual([]);
  } finally {
    await page.evaluate(
      async ({ id, ruleId }: { id: string; ruleId: string | null }) => {
        try {
          if (ruleId) {
            try {
              await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}/stop`, {
                method: 'POST',
              });
            } catch {
              // Intentionally ignored: cleanup only.
            }
            try {
              await fetch(`/api/ekuiper/rules/${encodeURIComponent(ruleId)}`, {
                method: 'DELETE',
              });
            } catch {
              // Intentionally ignored: cleanup only.
            }
          }
        } finally {
          try {
            await fetch(`/api/flows/${encodeURIComponent(id)}`, {
              method: 'DELETE',
            });
          } catch {
            // Intentionally ignored: cleanup only.
          }
        }
      },
      { id: flowId, ruleId: deployedRuleId },
    );
    await deleteFlowBestEffort(page, flowId);
  }
});
