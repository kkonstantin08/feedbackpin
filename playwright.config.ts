import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  use: {
    browserName: 'chromium',
    channel: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
});
