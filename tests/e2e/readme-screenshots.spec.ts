import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Worker,
} from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve(
  process.env.FEEDBACKPIN_EXTENSION_PATH ?? 'dist',
);

test('captures the real extension UI on the remote headless runner', async () => {
  const profilePath = await mkdtemp(path.join(tmpdir(), 'feedbackpin-readme-'));
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(profilePath, {
      channel: 'chromium',
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      timeout: 20_000,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    const worker: Worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).hostname;
    const screenshotDir = path.resolve('.artifacts/readme');
    await mkdir(screenshotDir, { recursive: true });

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/tests/fixtures/normal.html');
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popup.setViewportSize({ width: 360, height: 420 });
    await popup.screenshot({ path: path.join(screenshotDir, 'popup.png') });

    await page.bringToFront();
    await popup
      .getByRole('button', { name: /select an element/i })
      .evaluate((button) => (button as HTMLButtonElement).click());
    await page.locator('[data-feedbackpin-host]').waitFor();
    await page.locator('#target').click();
    await page
      .getByRole('textbox', { name: /what needs attention/i })
      .fill('Checkout button overlaps account details.');
    await page.getByRole('button', { name: 'Save note' }).click();
    await page
      .locator('[data-feedbackpin-host]')
      .waitFor({ state: 'detached' });

    const dashboard = await context.newPage();
    await dashboard.goto(
      `chrome-extension://${extensionId}/src/dashboard/index.html`,
    );
    await expect(
      dashboard.getByRole('heading', {
        name: 'Checkout button overlaps account details.',
      }),
    ).toBeVisible();
    await dashboard.setViewportSize({ width: 1440, height: 920 });
    await dashboard.screenshot({
      path: path.join(screenshotDir, 'dashboard.png'),
      fullPage: true,
    });
  } finally {
    await context?.close();
    await rm(profilePath, { recursive: true, force: true });
  }
});
