import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
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

test('captures, redacts, saves, reloads, filters, resolves, and deletes a report', async () => {
  await page.goto(normalUrl);
  expect(await page.locator('[data-feedbackpin-host]').count()).toBe(0);
  const inputRect = await page.locator('#secret').boundingBox();
  expect(inputRect).not.toBeNull();

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
  await page.getByRole('button', { name: /capture visible area/i }).click();
  const preview = page.getByRole('img', { name: 'Screenshot preview' });
  await expect(preview).toHaveAttribute('src', /^data:image\/webp;base64,/);
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
    const image = report?.screenshot as Blob | undefined;
    return {
      url: report?.url,
      viewport: report?.viewport as { width: number; height: number },
      serializedReport: JSON.stringify(report),
      screenshot: image ? { type: image.type, size: image.size } : undefined,
    };
  });
  expect(saved?.url).toBe('http://127.0.0.1:4173/tests/fixtures/normal.html');
  expect(saved?.serializedReport).not.toContain('private');
  expect(saved?.serializedReport).not.toContain(
    'sensitive-value-not-for-storage',
  );
  expect(saved?.screenshot).toBeTruthy();
  expect(saved?.screenshot).toMatchObject({ type: 'image/webp' });
  expect((saved?.screenshot as { size: number }).size).toBeGreaterThan(0);

  const screenshotPixels = await dashboard
    .getByRole('img', { name: 'Saved screenshot of the visible page' })
    .evaluate(
      (
        image,
        {
          box,
          viewport,
        }: {
          box: { x: number; y: number; width: number; height: number };
          viewport: { width: number; height: number };
        },
      ) => {
        const img = image as HTMLImageElement;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d')!;
        context.drawImage(img, 0, 0);
        const rect = {
          x: (box.x + box.width / 2) * (canvas.width / viewport.width),
          y: (box.y + box.height / 2) * (canvas.height / viewport.height),
        };
        const pixel = context.getImageData(rect.x, rect.y, 1, 1).data;
        return {
          width: canvas.width,
          height: canvas.height,
          maskedPixel: Array.from(pixel),
        };
      },
      { box: inputRect!, viewport: saved!.viewport },
    );
  expect(screenshotPixels.width).toBeGreaterThan(0);
  expect(screenshotPixels.height).toBeGreaterThan(0);
  expect(screenshotPixels.maskedPixel.slice(0, 3)).toEqual([0, 0, 0]);

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
