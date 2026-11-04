import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addReport,
  closeDatabase,
  deleteReport,
  getReport,
  getReports,
  updateReportStatus,
} from '../../src/shared/db';
import type { NewReport } from '../../src/shared/report';

const input: NewReport = {
  comment: 'Button does not respond',
  url: 'https://example.test/page',
  viewport: { width: 1280, height: 720 },
  element: { tag: 'button', selector: 'html > body > button:nth-of-type(1)' },
};

afterEach(async () => {
  await closeDatabase();
  const databases = await indexedDB.databases();
  for (const database of databases) {
    if (database.name) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(database.name!);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
});

describe('local report persistence', () => {
  it('adds and restores reports with their optional image', async () => {
    const image = new Blob(['screenshot'], { type: 'image/webp' });
    const report = await addReport({ ...input, screenshot: image });

    const restored = await getReport(report.id);
    expect(restored).toMatchObject({
      ...report,
      screenshot: expect.anything(),
    });
    expect(await getReports()).toHaveLength(1);
    expect(restored?.screenshot).toBeDefined();
  });

  it('updates status and deletes the complete record including its image', async () => {
    const report = await addReport({
      ...input,
      screenshot: new Blob(['image']),
    });

    await updateReportStatus(report.id, 'resolved');
    await expect(getReport(report.id)).resolves.toMatchObject({
      status: 'resolved',
    });
    await deleteReport(report.id);

    await expect(getReport(report.id)).resolves.toBeUndefined();
    await expect(getReports()).resolves.toEqual([]);
  });

  it('surfaces storage errors instead of reporting a successful write', async () => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    Object.defineProperty(indexedDB, 'open', {
      configurable: true,
      value: () => {
        throw new DOMException('Storage unavailable', 'SecurityError');
      },
    });
    try {
      await expect(addReport(input)).rejects.toThrow(/storage unavailable/i);
    } finally {
      Object.defineProperty(indexedDB, 'open', {
        configurable: true,
        value: originalOpen,
      });
    }
  });
});
