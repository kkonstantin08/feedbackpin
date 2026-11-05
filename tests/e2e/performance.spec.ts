import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type CDPSession,
  type Page,
  type Worker,
} from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { cpus, tmpdir, totalmem } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const extensionPath = path.resolve(
  process.env.FEEDBACKPIN_EXTENSION_PATH ?? 'dist',
);
const SAMPLE_MS = 2_000;
const pages = [
  {
    name: 'ordinary',
    url: 'http://127.0.0.1:4173/tests/fixtures/normal.html',
    target: '#target',
  },
  {
    name: 'long',
    url: 'http://127.0.0.1:4173/tests/fixtures/long.html',
    target: '#target',
  },
  {
    name: 'dynamic-react',
    url: 'http://127.0.0.1:4173/tests/fixtures/dynamic.html',
    target: '#react-target',
  },
] as const;

type BrowserProcess = { id: number; type: string; cpuTime: number };
type Metric = { name: string; value: number };
type Measurement = {
  page: string;
  state: string;
  durationMs: number;
  browserCpuMs: number;
  browserCpuPercentOneCore: number;
  browserRssMiB: number;
  gpuProcessCount: number;
  gpuCpuMs: number;
  gpuCpuPercentOneCore: number;
  gpuRssMiB: number;
  pageTaskMs: number;
  pageScriptMs: number;
  pageHeapAfterGcMiB: number;
  pageHeapAfterSampleMiB: number;
  longTaskCount: number;
  longTaskTotalMs: number;
};

async function processSnapshot(session: CDPSession) {
  const { processInfo } = await session.send('SystemInfo.getProcessInfo');
  const rows = processInfo as BrowserProcess[];
  const pids = rows.map((process) => process.id).filter(Number.isInteger);
  const gpuRows = rows.filter(
    (process) => process.type.toLowerCase() === 'gpu',
  );
  const rssByPid = new Map<number, number>();
  if (pids.length) {
    const output = execFileSync(
      'ps',
      ['-o', 'pid=,rss=', '-p', pids.join(',')],
      {
        encoding: 'utf8',
      },
    );
    for (const line of output.trim().split('\n')) {
      const [pid, rss] = line.trim().split(/\s+/).map(Number);
      if (
        typeof pid === 'number' &&
        Number.isInteger(pid) &&
        typeof rss === 'number' &&
        Number.isFinite(rss)
      ) {
        rssByPid.set(pid, rss);
      }
    }
  }
  return {
    cpuSeconds: rows.reduce((total, process) => total + process.cpuTime, 0),
    rssMiB:
      [...rssByPid.values()].reduce((total, value) => total + value, 0) / 1024,
    gpuProcessCount: gpuRows.length,
    gpuCpuSeconds: gpuRows.reduce(
      (total, process) => total + process.cpuTime,
      0,
    ),
    gpuRssMiB:
      gpuRows.reduce(
        (total, process) => total + (rssByPid.get(process.id) ?? 0),
        0,
      ) / 1024,
  };
}

async function sample(
  pageName: string,
  state: string,
  page: Page,
  pageSession: CDPSession,
  browserSession: CDPSession,
): Promise<Measurement> {
  await pageSession.send('HeapProfiler.collectGarbage');
  const [beforeBrowser, beforeMetrics, beforeLongTasks] = await Promise.all([
    processSnapshot(browserSession),
    pageSession.send('Performance.getMetrics'),
    page.evaluate(
      () =>
        (window as typeof window & { __feedbackPinLongTasks?: number[] })
          .__feedbackPinLongTasks?.length ?? 0,
    ),
  ]);
  const started = performance.now();
  await page.waitForTimeout(SAMPLE_MS);
  const durationMs = performance.now() - started;
  const [afterBrowser, afterMetrics, longTasks] = await Promise.all([
    processSnapshot(browserSession),
    pageSession.send('Performance.getMetrics'),
    page.evaluate((offset) => {
      const tasks =
        (window as typeof window & { __feedbackPinLongTasks?: number[] })
          .__feedbackPinLongTasks ?? [];
      return tasks.slice(offset);
    }, beforeLongTasks),
  ]);
  const getMetric = (metrics: { metrics: Metric[] }, name: string) =>
    metrics.metrics.find((metric) => metric.name === name)?.value ?? 0;
  const pageHeap = (metrics: { metrics: Metric[] }) =>
    Number((getMetric(metrics, 'JSHeapUsedSize') / (1024 * 1024)).toFixed(1));
  const cpuMs =
    Math.max(0, afterBrowser.cpuSeconds - beforeBrowser.cpuSeconds) * 1000;
  const gpuCpuMs =
    Math.max(0, afterBrowser.gpuCpuSeconds - beforeBrowser.gpuCpuSeconds) *
    1000;
  const pageTaskMs =
    Math.max(
      0,
      getMetric(afterMetrics, 'TaskDuration') -
        getMetric(beforeMetrics, 'TaskDuration'),
    ) * 1000;

  return {
    page: pageName,
    state,
    durationMs: Math.round(durationMs),
    browserCpuMs: Math.round(cpuMs),
    browserCpuPercentOneCore: Number(((cpuMs / durationMs) * 100).toFixed(2)),
    browserRssMiB: Number(afterBrowser.rssMiB.toFixed(1)),
    gpuProcessCount: afterBrowser.gpuProcessCount,
    gpuCpuMs: Number(gpuCpuMs.toFixed(2)),
    gpuCpuPercentOneCore: Number(((gpuCpuMs / durationMs) * 100).toFixed(2)),
    gpuRssMiB: Number(afterBrowser.gpuRssMiB.toFixed(1)),
    pageTaskMs: Number(pageTaskMs.toFixed(2)),
    pageScriptMs: Number(
      (
        Math.max(
          0,
          getMetric(afterMetrics, 'ScriptDuration') -
            getMetric(beforeMetrics, 'ScriptDuration'),
        ) * 1000
      ).toFixed(2),
    ),
    pageHeapAfterGcMiB: pageHeap(beforeMetrics),
    pageHeapAfterSampleMiB: pageHeap(afterMetrics),
    longTaskCount: longTasks.length,
    longTaskTotalMs: Number(
      longTasks.reduce((total, duration) => total + duration, 0).toFixed(2),
    ),
  };
}

async function startExtension(
  profilePath: string,
): Promise<{ context: BrowserContext; worker: Worker; extensionId: string }> {
  const context = await chromium.launchPersistentContext(profilePath, {
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
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  return { context, worker, extensionId: new URL(worker.url()).hostname };
}

async function activateSelection(
  context: BrowserContext,
  page: Page,
  extensionId: string,
  startLatencies: number[],
) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await page.bringToFront();
  const started = performance.now();
  await popup
    .getByRole('button', { name: /select an element/i })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await page.locator('[data-feedbackpin-host]').waitFor();
  startLatencies.push(performance.now() - started);
  await popup.close();
}

test('records comparable browser impact across idle and active states', async () => {
  const results: Measurement[] = [];
  const startLatencies: number[] = [];
  let browserVersion = '';

  for (const fixture of pages) {
    const baselineProfile = await mkdtemp(
      path.join(tmpdir(), `feedbackpin-baseline-${fixture.name}-`),
    );
    const baseline = await chromium.launchPersistentContext(baselineProfile, {
      channel: 'chromium',
      headless: false,
      args: ['--no-first-run', '--no-default-browser-check'],
    });
    const baselinePage = await baseline.newPage();
    await baselinePage.addInitScript(() => {
      const tasks: number[] = [];
      Object.assign(window, { __feedbackPinLongTasks: tasks });
      if ('PerformanceObserver' in window) {
        new PerformanceObserver((list) => {
          tasks.push(...list.getEntries().map((entry) => entry.duration));
        }).observe({ type: 'longtask', buffered: true });
      }
    });
    await baselinePage.goto(fixture.url);
    await baselinePage.locator(fixture.target).waitFor();
    const baselineBrowser = baseline.browser();
    if (!baselineBrowser)
      throw new Error('Could not attach to baseline Chrome.');
    const baselineBrowserSession = await baselineBrowser.newBrowserCDPSession();
    const baselinePageSession = await baseline.newCDPSession(baselinePage);
    await baselinePageSession.send('Performance.enable');
    await baselinePageSession.send('HeapProfiler.enable');
    results.push(
      await sample(
        fixture.name,
        'no-extension',
        baselinePage,
        baselinePageSession,
        baselineBrowserSession,
      ),
    );
    await baseline.close();
    await rm(baselineProfile, { recursive: true, force: true });

    const extensionProfile = await mkdtemp(
      path.join(tmpdir(), `feedbackpin-extension-${fixture.name}-`),
    );
    const { context, extensionId } = await startExtension(extensionProfile);
    browserVersion = context.browser()?.version() ?? 'unknown';
    const page = await context.newPage();
    await page.addInitScript(() => {
      const tasks: number[] = [];
      Object.assign(window, { __feedbackPinLongTasks: tasks });
      if ('PerformanceObserver' in window) {
        new PerformanceObserver((list) => {
          tasks.push(...list.getEntries().map((entry) => entry.duration));
        }).observe({ type: 'longtask', buffered: true });
      }
    });
    await page.goto(fixture.url);
    const target = page.locator(fixture.target);
    await target.waitFor();
    const browser = context.browser();
    if (!browser) throw new Error('Could not attach to extension Chrome.');
    const browserSession = await browser.newBrowserCDPSession();
    const pageSession = await context.newCDPSession(page);
    await pageSession.send('Performance.enable');
    await pageSession.send('HeapProfiler.enable');

    results.push(
      await sample(
        fixture.name,
        'installed-inactive',
        page,
        pageSession,
        browserSession,
      ),
    );

    await page.bringToFront();
    await activateSelection(context, page, extensionId, startLatencies);
    await target.hover();
    results.push(
      await sample(
        fixture.name,
        'selection-active',
        page,
        pageSession,
        browserSession,
      ),
    );
    await target.click();

    if (fixture.name === 'ordinary') {
      await page
        .getByRole('textbox', { name: /what needs attention/i })
        .fill('Performance fixture note');
      await page.getByRole('button', { name: 'Save note' }).click();
      await page
        .locator('[data-feedbackpin-host]')
        .waitFor({ state: 'detached' });
      results.push(
        await sample(
          fixture.name,
          'after-report-save',
          page,
          pageSession,
          browserSession,
        ),
      );
    } else {
      await page.keyboard.press('Escape');
    }

    if (fixture.name !== 'ordinary') {
      await page
        .locator('[data-feedbackpin-host]')
        .waitFor({ state: 'detached' });
      results.push(
        await sample(
          fixture.name,
          'after-selection-close',
          page,
          pageSession,
          browserSession,
        ),
      );
    }

    for (let cycle = 0; cycle < 10; cycle += 1) {
      await page.bringToFront();
      await activateSelection(context, page, extensionId, startLatencies);
      await page.keyboard.press('Escape');
      await page
        .locator('[data-feedbackpin-host]')
        .waitFor({ state: 'detached' });
    }
    results.push(
      await sample(
        fixture.name,
        'after-ten-open-close-cycles',
        page,
        pageSession,
        browserSession,
      ),
    );
    await pageSession.detach();
    await browserSession.detach();
    await context.close();
    await rm(extensionProfile, { recursive: true, force: true });
  }

  const sortedLatencies = [...startLatencies].sort((a, b) => a - b);
  const middle = Math.floor(sortedLatencies.length / 2);
  const medianLatency =
    sortedLatencies.length % 2 === 0
      ? (sortedLatencies[middle - 1]! + sortedLatencies[middle]!) / 2
      : sortedLatencies[middle]!;
  const report = {
    generatedAt: new Date().toISOString(),
    runner: {
      name: process.env.RUNNER_NAME ?? 'local',
      os: process.env.RUNNER_OS ?? process.platform,
      architecture: process.env.RUNNER_ARCH ?? process.arch,
      logicalCpuCount: cpus().length,
      memoryMiB: Math.round(totalmem() / (1024 * 1024)),
    },
    browserVersion,
    sampleDurationMs: SAMPLE_MS,
    note: 'Browser CPU is summed Chrome process CPU time divided by wall time (one core = 100%). GPU CPU/RSS reports the dedicated GPU process when Chromium exposes one; zero processes means no separate GPU process was reported. RSS is resident memory from ps for CDP-reported process IDs. Page task/JS time and heap come from CDP Performance metrics. Samples are short sequential CI comparisons, not laptop measurements.',
    startLatencyMs: {
      samples: startLatencies.map((value) => Number(value.toFixed(1))),
      median: Number(medianLatency.toFixed(1)),
      max: Number(Math.max(...startLatencies).toFixed(1)),
    },
    measurements: results,
  };
  await mkdir('performance-results', { recursive: true });
  await writeFile(
    'performance-results/feedbackpin-performance.json',
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log('FEEDBACKPIN_PERFORMANCE', JSON.stringify(report));
  expect(results).toHaveLength(15);
  expect(results.every((entry) => entry.browserRssMiB > 0)).toBe(true);
  expect(results.every((entry) => entry.browserCpuPercentOneCore >= 0)).toBe(
    true,
  );
  for (const fixture of pages) {
    const idleHeap = results.find(
      (entry) =>
        entry.page === fixture.name && entry.state === 'installed-inactive',
    )!.pageHeapAfterGcMiB;
    const repeatedHeap = results.find(
      (entry) =>
        entry.page === fixture.name &&
        entry.state === 'after-ten-open-close-cycles',
    )!.pageHeapAfterGcMiB;
    expect(repeatedHeap - idleHeap).toBeLessThan(1);
  }
  expect(startLatencies).toHaveLength(33);
});
