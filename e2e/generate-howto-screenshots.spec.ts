import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { ensureSignedIn } from './helpers';

const DOCS_RESOURCES_DIR = path.resolve(
  __dirname,
  '../../rekuiper/ekuiper/docs/en_US/example/resources'
);

const COMPARISON_DIR = 'C:/Users/paanday/.gemini/antigravity-ide/brain/1ceca723-eca7-4d7a-b8e0-7fc0c474fd43/comparison';

async function saveScreenshot(locator: any, filename: string) {
  const docsPath = path.join(DOCS_RESOURCES_DIR, filename);
  const comparisonPath = path.join(COMPARISON_DIR, filename);

  const page = locator.page();
  // Reset any main scroll offset first
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);

  const box = await locator.boundingBox();
  const originalSize = page.viewportSize() || { width: 1440, height: 900 };
  let resized = false;

  if (box && box.height + 150 > originalSize.height) {
    const requiredHeight = Math.ceil(box.height + 350);
    await page.setViewportSize({ width: originalSize.width, height: requiredHeight });
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    resized = true;
  } else {
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }

  await locator.screenshot({ path: docsPath });
  try {
    fs.copyFileSync(docsPath, comparisonPath);
  } catch (err) {
    console.warn(`Could not copy screenshot to comparison dir: ${err}`);
  }

  if (resized) {
    await page.setViewportSize(originalSize);
    await page.waitForTimeout(200);
  }
}

test.describe.serial('Generate howto.md screenshots with real eKuiper verification', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await ensureSignedIn(page);
  });

  test('Step 1: Capture record_stream.png and verify real stream creation in background', async ({ page }) => {
    // Ensure clean state in eKuiper
    await page.evaluate(async () => {
      await fetch('/api/ekuiper/streams/mqttDemoStream', { method: 'DELETE' }).catch(() => {});
    });

    await page.goto('/streams/new');
    const nameInput = page.locator('#res-name');
    await nameInput.waitFor({ state: 'visible', timeout: 30000 });

    // Fill Stream Name
    await nameInput.fill('mqttDemoStream');

    // Select Connector Type: MQTT
    await page.locator('#res-type').click();
    await page.getByRole('option', { name: /^mqtt/i }).first().click();

    // Fill Data Source (MQTT Topic)
    const dsInput = page.locator('#res-datasource');
    await dsInput.fill('demo/#');

    // Ensure format is JSON
    await page.locator('#res-format').click();
    await page.getByRole('option', { name: /^json$/i }).first().click();

    await page.waitForTimeout(1000);

    // Capture tightly scoped form card screenshot: record_stream.png
    const formContainer = page.locator('#stream-form-container');
    await formContainer.waitFor({ state: 'visible' });
    await saveScreenshot(formContainer, 'record_stream.png');

    // Verify background: submit stream to live eKuiper
    const submitBtn = formContainer.getByRole('button', { name: /^Submit$/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    } else {
      await page.getByRole('button', { name: /Submit Stream/i }).click();
    }
    await page.waitForURL(/\/streams/, { timeout: 30000 });

    // Background verify: check live eKuiper stream existence
    const streamCheck = await page.evaluate(async () => {
      const res = await fetch('/api/ekuiper/streams/mqttDemoStream');
      return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
    });
    expect(streamCheck.ok).toBeTruthy();
  });

  test('Step 2 & 3: Capture record_sql.png, record_action.png, and verify real rule creation', async ({ page }) => {
    // Ensure clean state in eKuiper
    await page.evaluate(async () => {
      await fetch('/api/ekuiper/rules/ruleRecordToFile', { method: 'DELETE' }).catch(() => {});
    });

    await page.goto('/rules/new');
    const ruleIdInput = page.locator('#rule-id');
    await ruleIdInput.waitFor({ state: 'visible', timeout: 30000 });

    // Fill Rule ID & Name
    await ruleIdInput.fill('ruleRecordToFile');
    const ruleNameInput = page.locator('#rule-name');
    if (await ruleNameInput.isVisible()) {
      await ruleNameInput.fill('Record data to a file and use File source for data playback');
    }

    // Switch to SQL tab
    const sqlTab = page.getByRole('tab', { name: 'SQL' }).first();
    await sqlTab.click();
    const sqlEditor = page.locator('#rule-sql');
    await sqlEditor.waitFor({ state: 'visible', timeout: 15000 });
    await sqlEditor.fill('SELECT * FROM mqttDemoStream');

    await page.waitForTimeout(1000);

    // Capture tightly scoped Step 2 screenshot: record_sql.png
    const ruleEditorCard = page.locator('#rule-editor-card');
    await ruleEditorCard.waitFor({ state: 'visible' });
    await saveScreenshot(ruleEditorCard, 'record_sql.png');

    // Step 3: Continue to Outputs
    const toOutputsBtn = page.getByRole('button', { name: /Continue to outputs/i });
    await toOutputsBtn.click();
    await page.waitForTimeout(500);

    // Remove default log action if present
    const removeOutput1 = page.getByRole('button', { name: /Remove output 1/i });
    if (await removeOutput1.isVisible()) {
      await removeOutput1.click();
      await page.waitForTimeout(300);
    }

    // Add File sink from catalog (scoped inside the Add an output card)
    const addOutputCard = page.locator('div').filter({ hasText: /^Add an output/ });
    const fileSinkBtn = addOutputCard.locator('button').filter({ hasText: /^File/ }).first();
    await fileSinkBtn.waitFor({ state: 'visible', timeout: 15000 });
    await fileSinkBtn.click();

    // Fill file sink properties
    const pathInput = page.locator('#prop-path');
    await pathInput.waitFor({ state: 'visible', timeout: 15000 });
    await pathInput.fill('data/mock.lines');

    // Select file type 'lines' if not already default
    const fileTypeTrigger = page.locator('#prop-fileType');
    if (await fileTypeTrigger.isVisible()) {
      const current = await fileTypeTrigger.innerText().catch(() => '');
      if (!current.toLowerCase().includes('lines')) {
        await fileTypeTrigger.click();
        await page.locator('[role="option"]').filter({ hasText: /^lines$/i }).first().click();
      }
    }

    // Fill rolling interval and check interval if visible
    const rollingInput = page.locator('#prop-rollingInterval');
    if (await rollingInput.isVisible()) {
      await rollingInput.fill('60000');
    }
    const checkInput = page.locator('#prop-checkInterval');
    if (await checkInput.isVisible()) {
      await checkInput.fill('10000');
    }

    // Set sendSingle toggle to true
    const sendSingleSwitch = page.locator('#send-single');
    if (await sendSingleSwitch.isVisible()) {
      const isChecked = await sendSingleSwitch.getAttribute('aria-checked');
      if (isChecked !== 'true') {
        await sendSingleSwitch.click();
      }
    }

    await page.waitForTimeout(1000);

    // Capture tightly scoped Step 3 screenshot: record_action.png
    const actionCard = page.locator('#action-card-0');
    await actionCard.waitFor({ state: 'visible' });
    await saveScreenshot(actionCard, 'record_action.png');

    // Background verify: proceed to runtime, validate with live eKuiper, and save rule
    const toRuntimeBtn = page.getByRole('button', { name: /Continue to runtime/i });
    await toRuntimeBtn.click();
    await page.waitForTimeout(500);

    const validateBtn = page.getByRole('button', { name: /Validate with eKuiper/i }).first();
    await validateBtn.click();
    await page.waitForTimeout(800);

    const saveRuleBtn = page.getByRole('button', { name: /Create rule/i }).first();
    await saveRuleBtn.click();
    await page.waitForURL(/\/rules\/ruleRecordToFile/, { timeout: 30000 });

    // Background check: rule is verified online in eKuiper
    const ruleCheck = await page.evaluate(async () => {
      const res = await fetch('/api/ekuiper/rules/ruleRecordToFile');
      return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
    });
    expect(ruleCheck.ok).toBeTruthy();
  });

  test('Step 4 & 5: Capture replay_conf.png, replay_source.png, and verify file stream', async ({ page }) => {
    // Ensure clean state
    await page.evaluate(async () => {
      await fetch('/api/ekuiper/streams/demoStream', { method: 'DELETE' }).catch(() => {});
      await fetch('/api/ekuiper/metadata/sources/file/confKeys/linesInUpload', { method: 'DELETE' }).catch(() => {});
    });

    await page.goto('/streams/new');
    const nameInput = page.locator('#res-name');
    await nameInput.waitFor({ state: 'visible', timeout: 30000 });

    // Fill Stream Name: demoStream
    await nameInput.fill('demoStream');

    // Select Connector Type: File
    await page.locator('#res-type').click();
    await page.getByRole('option', { name: /^file/i }).first().click();

    // Fill Data Source: mock.lines
    const dsInput = page.locator('#res-datasource');
    await dsInput.fill('mock.lines');

    // Ensure format is JSON
    await page.locator('#res-format').click();
    await page.getByRole('option', { name: /^json$/i }).first().click();

    // Step 5: Open ConfKeyModal to create linesInUpload
    const addConfKeyBtn = page.getByRole('button', { name: /Add configuration key/i });
    await addConfKeyBtn.waitFor({ state: 'visible' });
    await addConfKeyBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 15000 });

    // In modal, fill name linesInUpload
    const confNameInput = page.locator('#conf-name');
    await confNameInput.waitFor({ state: 'visible', timeout: 15000 });
    await confNameInput.fill('linesInUpload');

    // Fill path data/uploads/
    const confPathInput = page.locator('#prop-path');
    if (await confPathInput.isVisible()) {
      await confPathInput.fill('data/uploads/');
    }

    // Select file type lines if not already default
    const confFileType = page.locator('#prop-fileType');
    if (await confFileType.isVisible()) {
      const current = await confFileType.innerText().catch(() => '');
      if (!current.toLowerCase().includes('lines')) {
        await confFileType.click();
        await page.locator('[role="option"]').filter({ hasText: /^lines$/i }).first().click();
      }
    }

    // Set interval and sendInterval if visible
    const intervalInput = page.locator('#prop-interval');
    if (await intervalInput.isVisible()) {
      await intervalInput.fill('0');
    }
    const sendIntervalInput = page.locator('#prop-sendInterval');
    if (await sendIntervalInput.isVisible()) {
      await sendIntervalInput.fill('100');
    }

    await page.waitForTimeout(1000);

    // Capture tightly scoped Step 5 modal screenshot: replay_conf.png
    await saveScreenshot(dialog, 'replay_conf.png');

    // Submit conf key in modal
    const saveConfBtn = dialog.getByRole('button', { name: /Create|Save|Submit/i }).first();
    await saveConfBtn.click();
    await dialog.waitFor({ state: 'hidden', timeout: 15000 });

    await page.waitForTimeout(1000);

    // Dismiss any active toast notifications before capturing screenshot
    await page.evaluate(() => {
      document.querySelectorAll('[data-sonner-toast]').forEach(el => el.remove());
    });
    await page.waitForTimeout(500);

    // Now capture tightly scoped Step 4 stream form screenshot: replay_source.png
    const formContainer = page.locator('#stream-form-container');
    await formContainer.waitFor({ state: 'visible' });
    await saveScreenshot(formContainer, 'replay_source.png');

    // Background verify: submit demoStream
    const submitBtn = formContainer.getByRole('button', { name: /^Submit$/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    } else {
      await page.getByRole('button', { name: /Submit Stream/i }).click();
    }
    await page.waitForURL(/\/streams/, { timeout: 30000 });

    const streamCheck = await page.evaluate(async () => {
      const res = await fetch('/api/ekuiper/streams/demoStream');
      return { ok: res.ok, status: res.status };
    });
    expect(streamCheck.ok).toBeTruthy();
  });

  test('Step 6 & 7: Capture replay_sql.png, replay_action.png, and verify ruleX', async ({ page }) => {
    // Ensure clean state
    await page.evaluate(async () => {
      await fetch('/api/ekuiper/rules/ruleX', { method: 'DELETE' }).catch(() => {});
    });

    await page.goto('/rules/new');
    const ruleIdInput = page.locator('#rule-id');
    await ruleIdInput.waitFor({ state: 'visible', timeout: 30000 });

    // Fill Rule ID: ruleX & Name
    await ruleIdInput.fill('ruleX');
    const ruleNameInput = page.locator('#rule-name');
    if (await ruleNameInput.isVisible()) {
      await ruleNameInput.fill('Rule to run example case X');
    }

    // Switch to SQL editor
    const sqlTab = page.getByRole('tab', { name: 'SQL' }).first();
    await sqlTab.click();
    const sqlEditor = page.locator('#rule-sql');
    await sqlEditor.waitFor({ state: 'visible', timeout: 15000 });
    await sqlEditor.fill('-- Copy SQL in example case X\nSELECT * FROM demoStream');

    await page.waitForTimeout(1000);

    // Capture tightly scoped Step 6 screenshot: replay_sql.png
    const ruleEditorCard = page.locator('#rule-editor-card');
    await ruleEditorCard.waitFor({ state: 'visible' });
    await saveScreenshot(ruleEditorCard, 'replay_sql.png');

    // Strip SQL comment for engine execution
    await sqlEditor.fill('SELECT * FROM demoStream');

    // Step 7: Continue to outputs
    const toOutputsBtn = page.getByRole('button', { name: /Continue to outputs/i });
    await toOutputsBtn.click();
    await page.waitForTimeout(500);

    // Remove default log action if present
    const removeOutput1 = page.getByRole('button', { name: /Remove output 1/i });
    if (await removeOutput1.isVisible()) {
      await removeOutput1.click();
      await page.waitForTimeout(300);
    }

    // Add MQTT sink from catalog (scoped inside Add an output card)
    const addOutputCard = page.locator('div').filter({ hasText: /^Add an output/ });
    const mqttSinkBtn = addOutputCard.locator('button').filter({ hasText: /^MQTT/ }).first();
    await mqttSinkBtn.waitFor({ state: 'visible', timeout: 15000 });
    await mqttSinkBtn.click();

    // Fill Broker URL and Topic
    const serverInput = page.locator('#prop-server');
    if (await serverInput.isVisible()) {
      await serverInput.fill('tcp://yourbroker:1883');
    }

    const topicInput = page.locator('#prop-topic');
    if (await topicInput.isVisible()) {
      await topicInput.fill('result/rulex');
    }

    await page.waitForTimeout(1000);

    // Capture tightly scoped Step 7 screenshot: replay_action.png
    const actionCard = page.locator('#action-card-0');
    await actionCard.waitFor({ state: 'visible' });
    await saveScreenshot(actionCard, 'replay_action.png');

    // Background verify: rule creation
    const toRuntimeBtn = page.getByRole('button', { name: /Continue to runtime/i });
    await toRuntimeBtn.click();
    await page.waitForTimeout(500);

    const saveRuleBtn = page.getByRole('button', { name: /Create rule/i }).first();
    await saveRuleBtn.click();
    await page.waitForURL(/\/rules\/ruleX/, { timeout: 30000 });

    const ruleCheck = await page.evaluate(async () => {
      const res = await fetch('/api/ekuiper/rules/ruleX');
      return { ok: res.ok, status: res.status };
    });
    expect(ruleCheck.ok).toBeTruthy();
  });

  test.afterAll(async () => {
    // Cleanup created test streams and rules from live eKuiper directly
    await fetch('http://127.0.0.1:9091/rules/ruleRecordToFile', { method: 'DELETE' }).catch(() => {});
    await fetch('http://127.0.0.1:9091/rules/ruleX', { method: 'DELETE' }).catch(() => {});
    await fetch('http://127.0.0.1:9091/streams/mqttDemoStream', { method: 'DELETE' }).catch(() => {});
    await fetch('http://127.0.0.1:9091/streams/demoStream', { method: 'DELETE' }).catch(() => {});
    await fetch('http://127.0.0.1:9091/metadata/sources/file/confKeys/linesInUpload', { method: 'DELETE' }).catch(() => {});
  });
});
