import { describe, expect, it, vi } from 'vitest';
import {
  registerBackground,
  type StartSelectionResponse,
} from '../../src/background';
import type { ExtensionMessage } from '../../src/shared/messages';

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void;

function setup(tabId: number | null = 8) {
  let listener: Listener | undefined;
  let selectorActive = false;
  const executeScript = vi.fn(
    async (options: { func?: unknown; files?: string[] }) => {
      if (typeof options.func === 'function')
        return [{ result: selectorActive }] as never;
      selectorActive = true;
      return [] as never;
    },
  );
  const api = {
    runtime: {
      id: 'extension-id',
      onMessage: {
        addListener: vi.fn((callback: Listener) => {
          listener = callback;
        }),
      },
    },
    tabs: {
      query: vi.fn(async () =>
        tabId === null ? [] : [{ id: tabId, windowId: 2 }],
      ),
    },
    scripting: { executeScript },
  } as unknown as typeof chrome;
  registerBackground(api);
  const sender = {
    id: 'extension-id',
    url: 'chrome-extension://extension-id/src/popup/index.html',
    tab: { id: 8, windowId: 2 },
  } as chrome.runtime.MessageSender;
  const send = (message: unknown, fromSender = sender) =>
    new Promise<unknown>((resolve) => {
      const keepChannelOpen = listener?.(message, fromSender, resolve);
      if (!keepChannelOpen) resolve(undefined);
    });
  return { api, executeScript, send, sender };
}

describe('user-triggered selector injection', () => {
  it('does not inject until the popup sends START_SELECTION', async () => {
    const { api, executeScript, send } = setup();
    expect(executeScript).not.toHaveBeenCalled();
    expect(await send({ type: 'OTHER' })).toBeUndefined();
    expect(api.tabs.query).not.toHaveBeenCalled();
    await expect(
      send({ type: 'START_SELECTION' } satisfies ExtensionMessage),
    ).resolves.toEqual({ ok: true });
    expect(api.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(executeScript).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: { tabId: 8 },
        files: ['content/selector.js'],
      }),
    );
  });

  it('does not inject twice while a selector host is already on the active tab', async () => {
    const { executeScript, send } = setup();
    await send({ type: 'START_SELECTION' });
    await expect(send({ type: 'START_SELECTION' })).resolves.toEqual({
      ok: true,
      alreadyActive: true,
    });
    expect(executeScript).toHaveBeenCalledTimes(3);
  });

  it('coalesces simultaneous start requests for the same tab', async () => {
    const { executeScript, send } = setup();
    const responses = await Promise.all([
      send({ type: 'START_SELECTION' }),
      send({ type: 'START_SELECTION' }),
    ]);
    expect(responses).toEqual([{ ok: true }, { ok: true }]);
    expect(executeScript).toHaveBeenCalledTimes(2);
  });

  it('returns a clear error when no active tab exists or Chrome denies injection', async () => {
    const noTab = setup(null);
    const noTabResponse = (await noTab.send({ type: 'START_SELECTION' })) as
      StartSelectionResponse | undefined;
    expect(noTabResponse?.ok).toBe(false);
    if (noTabResponse?.ok === false)
      expect(noTabResponse.error).toMatch(/active browser tab/i);

    const restricted = setup();
    vi.mocked(restricted.executeScript).mockRejectedValueOnce(
      new Error('Cannot access contents of url chrome://settings/'),
    );
    const restrictedResponse = (await restricted.send({
      type: 'START_SELECTION',
    })) as StartSelectionResponse | undefined;
    expect(restrictedResponse?.ok).toBe(false);
    if (restrictedResponse?.ok === false)
      expect(restrictedResponse.error).toMatch(/not available on this page/i);
  });

  it('ignores messages from page scripts and non-popup extension pages', async () => {
    const { api, sender } = setup();
    const listener = vi.mocked(api.runtime.onMessage.addListener).mock
      .calls[0]?.[0] as Listener;
    const response = vi.fn();
    expect(
      listener(
        { type: 'START_SELECTION' },
        { ...sender, url: 'https://example.test/' },
        response,
      ),
    ).toBeUndefined();
    expect(api.tabs.query).not.toHaveBeenCalled();
    expect(response).not.toHaveBeenCalled();
  });

  it('does not register a page-capture message handler', async () => {
    const { api, sender, send } = setup();
    const listener = vi.mocked(api.runtime.onMessage.addListener).mock
      .calls[0]?.[0] as Listener;
    const response = vi.fn();
    expect(
      listener(
        { type: 'CAPTURE_VISIBLE' },
        { ...sender, url: 'https://example.test/' },
        response,
      ),
    ).toBeUndefined();
    await expect(send({ type: 'CAPTURE_VISIBLE' })).resolves.toBeUndefined();
    expect(response).not.toHaveBeenCalled();
  });
});
