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
import type { NewReport, Report } from '../../src/shared/report';

const input: NewReport = {
  comment: 'Button does not respond',
  url: 'https://example.test/page',
  viewport: { width: 1280, height: 720 },
  element: { tag: 'button', selector: 'html > body > button:nth-of-type(1)' },
};

function seedLegacyReport(report: Report): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('feedbackpin', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('reports', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database
        .transaction('reports', 'readwrite')
        .objectStore('reports')
        .put(report);
      transaction.onsuccess = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}

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
  it('drops unexpected image fields when creating a report', async () => {
    const report = await addReport({
      ...input,
      screenshot: new Blob(['private image']),
      screenshotError: 'old capture failure',
    } as unknown as NewReport);

    const restored = await getReport(report.id);
    expect(restored).toMatchObject({ comment: input.comment });
    expect(restored).not.toHaveProperty('screenshot');
    expect(restored).not.toHaveProperty('screenshotError');
    expect(await getReports()).toHaveLength(1);
  });

  it('keeps legacy images readable and allows deleting their reports', async () => {
    const legacy: Report = {
      id: 'legacy-report',
      createdAt: 1,
      ...input,
      status: 'open',
      screenshot: new Blob(['legacy image']),
      screenshotError: 'historical failure',
    };
    await seedLegacyReport(legacy);

    await expect(getReport(legacy.id)).resolves.toMatchObject({
      screenshot: expect.anything(),
      screenshotError: 'historical failure',
    });
    await updateReportStatus(legacy.id, 'resolved');
    await expect(getReport(legacy.id)).resolves.toMatchObject({
      status: 'resolved',
      screenshot: expect.anything(),
    });
    await deleteReport(legacy.id);

    await expect(getReport(legacy.id)).resolves.toBeUndefined();
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
