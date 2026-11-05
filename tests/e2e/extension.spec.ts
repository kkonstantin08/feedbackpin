import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve(
  process.env.FEEDBACKPIN_EXTENSION_PATH ?? 'dist',
);
const normalUrl =
  'http://127.0.0.1:4173/tests/fixtures/normal.html?token=private#fragment';

let context: BrowserContext;
let worker: Worker;
let extensionId: string;
let profilePath: string;
let page: Page;
let popup: Page;

test.beforeEach(async () => {
  profilePath = await mkdtemp(path.join(tmpdir(), 'feedbackpin-chromium-'));
  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium',
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    timeout: 20_000,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).hostname;
  page = await context.newPage();
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await popup.setViewportSize({ width: 360, height: 420 });
});

test.afterEach(async () => {
  await context?.close();
  await rm(profilePath, { recursive: true, force: true });
});

async function beginSelection() {
  await page.bringToFront();
  await popup
    .getByRole('button', { name: /select an element/i })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.locator('[data-feedbackpin-host]')).toHaveCount(1);
  return popup;
}

test('explains screenshot privacy, saves, reloads, filters, resolves, and deletes a note', async () => {
  const screenshotDir = path.resolve('.artifacts/readme');
  await mkdir(screenshotDir, { recursive: true });
  await popup.bringToFront();
  await popup.screenshot({ path: path.join(screenshotDir, 'popup.png') });
  await page.goto(normalUrl);
  expect(await page.locator('[data-feedbackpin-host]').count()).toBe(0);

  await beginSelection();
  const target = page.locator('#target');
  await target.hover();
  await expect
    .poll(async () =>
      page
        .locator('[data-feedbackpin-host]')
        .evaluate((host) =>
          (host as HTMLElement).shadowRoot
            ?.querySelector('[data-feedbackpin-highlight]')
            ?.getAttribute('style'),
        ),
    )
    .toContain('display: block');
  await target.click();
  expect(
    await page.evaluate(
      () => (window as unknown as { pageClicks: number }).pageClicks,
    ),
  ).toBe(0);
  const comment = page.getByRole('textbox', { name: /what needs attention/i });
  await comment.fill('Checkout button overlaps the account details.');
  await expect(
    page.getByText(/screenshots are disabled for privacy/i),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.locator('[data-feedbackpin-host]')).toHaveCount(0);

  const dashboard = await context.newPage();
  await dashboard.goto(
    `chrome-extension://${extensionId}/src/dashboard/index.html`,
  );
  await expect(
    dashboard.getByRole('heading', {
      name: 'Checkout button overlaps the account details.',
    }),
  ).toBeVisible();
  await dashboard.setViewportSize({ width: 1440, height: 920 });
  await dashboard.screenshot({
    path: path.join(screenshotDir, 'dashboard.png'),
    fullPage: true,
  });
  await dashboard.setViewportSize({ width: 390, height: 844 });
  expect(
    await dashboard.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(
    dashboard.getByRole('heading', {
      name: 'Checkout button overlaps the account details.',
    }),
  ).toBeVisible();
  const saved = await dashboard.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('feedbackpin', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const reports = await new Promise<Record<string, unknown>[]>(
      (resolve, reject) => {
        const request = database
          .transaction('reports')
          .objectStore('reports')
          .getAll();
        request.onsuccess = () =>
          resolve(request.result as Record<string, unknown>[]);
        request.onerror = () => reject(request.error);
      },
    );
    database.close();
    const report = reports[0];
    return {
      url: report?.url,
      serializedReport: JSON.stringify(report),
      screenshot: report?.screenshot,
    };
  });
  expect(saved?.url).toBe('http://127.0.0.1:4173/tests/fixtures/normal.html');
  expect(saved?.serializedReport).not.toContain('private');
  expect(saved?.serializedReport).not.toContain(
    'sensitive-value-not-for-storage',
  );
  expect(saved?.screenshot).toBeUndefined();

  await dashboard.getByRole('button', { name: 'Mark as resolved' }).click();
  await expect(
    dashboard.getByRole('button', { name: /checkout button overlaps/i }),
  ).toBeVisible();
  await dashboard.getByRole('button', { name: /^Open/ }).click();
  await expect(dashboard.getByText(/No open notes yet/)).toBeVisible();
  await dashboard.getByRole('button', { name: /^Resolved/ }).click();
  await expect(
    dashboard.getByRole('button', { name: /checkout button overlaps/i }),
  ).toBeVisible();
  await dashboard.reload();
  await expect(
    dashboard.getByRole('heading', {
      name: 'Checkout button overlaps the account details.',
    }),
  ).toBeVisible();
  await dashboard.getByRole('button', { name: 'Delete report' }).click();
  await expect(dashboard.getByText(/no notes yet/i)).toBeVisible();
});

test('cancels cleanly, reopens repeatedly, and works after dynamic page rendering', async () => {
  await page.goto(normalUrl);
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await beginSelection();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-feedbackpin-host]')).toHaveCount(0);
  }

  await page.goto('http://127.0.0.1:4173/tests/fixtures/dynamic.html');
  const dynamicTarget = page.locator('#react-target');
  await expect(dynamicTarget).toBeVisible();
  await beginSelection();
  await dynamicTarget.hover();
  await dynamicTarget.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[data-feedbackpin-host]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-feedbackpin-host]')).toHaveCount(0);
});

test('works on a long document and reports restricted Chrome pages clearly', async () => {
  await page.goto('http://127.0.0.1:4173/tests/fixtures/long.html');
  await page.locator('#target').scrollIntoViewIfNeeded();
  await beginSelection();
  await page.locator('#target').hover();
  await page.locator('#target').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-feedbackpin-host]')).toHaveCount(0);

  await page.goto('chrome://settings');
  await page.bringToFront();
  await popup
    .getByRole('button', { name: /select an element/i })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(popup.getByRole('alert')).toContainText(
    /not available on this page/i,
  );
});
