import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Global setup signs in once and saves the session here; every project reuses it. Signing in
// per test exhausted the login rate limit (10 attempts per 15 minutes) partway through the
// suite, after which every remaining spec failed on /welcome regardless of what it tested.
const storageState = process.env.E2E_STORAGE_STATE ?? 'test-results/.auth/owner.json';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    storageState,
    trace: 'retain-on-first-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      testMatch: /navigation\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  outputDir: 'test-results',
});
