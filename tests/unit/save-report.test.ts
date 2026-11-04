import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerBackground } from '../../src/background';
import { closeDatabase, getReports } from '../../src/shared/db';
import type { SaveReportMessage } from '../../src/shared/messages';

const payload: SaveReportMessage = {
  type: 'SAVE_REPORT',
  report: {
    comment: '  Broken button  ',
    url: 'https://example.test/page?token=private#section',
    viewport: { width: 1280, height: 720 },
    element: { tag: 'button', selector: 'html > body > button:nth-of-type(1)' },
  },
};

function worker() {
  let listener:
    | ((
        message: unknown,
        sender: chrome.runtime.MessageSender,
        respond: (value: unknown) => void,
      ) => boolean | void)
    | undefined;
  const api = {
    runtime: {
      id: 'feedbackpin-id',
      onMessage: {
        addListener: vi.fn((value) => {
          listener = value;
        }),
      },
    },
    tabs: { query: vi.fn() },
    scripting: { executeScript: vi.fn() },
  } as unknown as typeof chrome;
  registerBackground(api);
  const sender = {
    id: 'feedbackpin-id',
    url: 'https://example.test/page',
    tab: { id: 5, windowId: 2 },
  } as chrome.runtime.MessageSender;
  return {
    send: (message: unknown) =>
      new Promise<unknown>((resolve) => {
        const keepOpen = listener?.(message, sender, resolve);
        if (!keepOpen) resolve(undefined);
      }),
  };
}

afterEach(async () => {
  await closeDatabase();
  for (const item of await indexedDB.databases()) {
    if (item.name)
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(item.name!);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
  }
});

describe('saving a report from the injected form', () => {
  it('stores sanitized text metadata without persisting image payloads', async () => {
    const app = worker();
    const response = await app.send({
      ...payload,
      screenshotDataUrl: `data:image/webp;base64,${btoa('RIFF\u0000\u0000\u0000\u0000WEBP image')}`,
      report: {
        ...payload.report,
        screenshot: new Blob(['private image'], { type: 'image/webp' }),
      },
    } as unknown as SaveReportMessage);

    expect(response).toMatchObject({ id: expect.any(String) });
    const [saved] = await getReports();
    expect(saved).toMatchObject({
      comment: 'Broken button',
      url: 'https://example.test/page',
      status: 'open',
    });
    expect(saved?.screenshot).toBeUndefined();
    expect(saved?.screenshotError).toBeUndefined();
  });

  it('rejects an empty comment without writing a record', async () => {
    const app = worker();
    const response = await app.send({
      ...payload,
      report: { ...payload.report, comment: '  ' },
    });

    expect(response).toMatchObject({
      error: expect.stringMatching(/comment/i),
    });
    expect(await getReports()).toEqual([]);
  });
});
