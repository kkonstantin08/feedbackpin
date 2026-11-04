import { addReport } from './shared/db';
import type {
  CaptureVisibleResponse,
  ExtensionMessage,
  SaveReportMessage,
  SaveReportResponse,
} from './shared/messages';
import type { NewReport } from './shared/report';

const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export type StartSelectionResponse =
  { ok: true; alreadyActive?: boolean } | { ok: false; error: string };

type BackgroundApi = Pick<typeof chrome, 'runtime' | 'tabs' | 'scripting'>;
const pendingByTab = new Map<number, Promise<StartSelectionResponse>>();

function isPopupSender(
  sender: chrome.runtime.MessageSender,
  extensionId: string,
): boolean {
  if (sender.id !== extensionId || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return (
      url.protocol === 'chrome-extension:' &&
      url.hostname === extensionId &&
      url.pathname === '/src/popup/index.html'
    );
  } catch {
    return false;
  }
}

async function startOnActiveTab(
  api: BackgroundApi,
): Promise<StartSelectionResponse> {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== 'number')
      return { ok: false, error: 'No active browser tab was found.' };

    const pending = pendingByTab.get(tab.id);
    if (pending) return pending;

    const operation = (async (): Promise<StartSelectionResponse> => {
      try {
        const [result] = await api.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () =>
            Boolean(document.querySelector('[data-feedbackpin-host]')),
        });
        if (result?.result === true) return { ok: true, alreadyActive: true };
        await api.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['content/selector.js'],
        });
        return { ok: true };
      } catch {
        return {
          ok: false,
          error:
            'FeedbackPin is not available on this page. Open a regular website and try again.',
        };
      }
    })();

    pendingByTab.set(tab.id, operation);
    try {
      return await operation;
    } finally {
      pendingByTab.delete(tab.id);
    }
  } catch {
    return {
      ok: false,
      error: 'Could not access the active browser tab. Try again.',
    };
  }
}

function isPageSender(
  sender: chrome.runtime.MessageSender,
  extensionId: string,
): boolean {
  if (sender.id !== extensionId || !sender.tab || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function captureForSender(
  api: BackgroundApi,
  sender: chrome.runtime.MessageSender,
): Promise<CaptureVisibleResponse> {
  const tab = sender.tab;
  if (typeof tab?.id !== 'number' || typeof tab.windowId !== 'number') {
    return { error: 'Could not identify the page for this screenshot.' };
  }
  try {
    const [activeTab] = await api.tabs.query({
      active: true,
      windowId: tab.windowId,
    });
    if (activeTab?.id !== tab.id) {
      return {
        error: 'This page is no longer active. Try the screenshot again.',
      };
    }
    const dataUrl = await api.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
    });
    return { dataUrl };
  } catch {
    return {
      error:
        'Chrome could not capture this page. Save the note without a screenshot.',
    };
  }
}

function screenshotBlob(dataUrl: string): Blob {
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    dataUrl,
  );
  if (!match) throw new Error('Screenshot data is not a valid WebP image.');
  const base64 = match[1]!;
  if (base64.length > Math.ceil(MAX_SCREENSHOT_BYTES / 3) * 4) {
    throw new Error('Screenshot exceeds the 2 MiB limit.');
  }
  const binary = atob(base64);
  if (binary.length > MAX_SCREENSHOT_BYTES) {
    throw new Error('Screenshot exceeds the 2 MiB limit.');
  }
  if (binary.slice(0, 4) !== 'RIFF' || binary.slice(8, 12) !== 'WEBP') {
    throw new Error('Screenshot data is not a valid WebP image.');
  }
  return new Blob(
    [Uint8Array.from(binary, (character) => character.charCodeAt(0))],
    { type: 'image/webp' },
  );
}

async function saveReport(
  message: SaveReportMessage,
): Promise<SaveReportResponse> {
  let input: NewReport = message.report;
  if (message.screenshotDataUrl) {
    try {
      input = {
        ...input,
        screenshot: screenshotBlob(message.screenshotDataUrl),
      };
    } catch (cause) {
      input = {
        ...input,
        screenshotError:
          cause instanceof Error
            ? cause.message
            : 'Screenshot could not be saved.',
      };
    }
  }
  try {
    const report = await addReport(input);
    return { id: report.id };
  } catch (cause) {
    return {
      error:
        cause instanceof Error
          ? cause.message
          : 'Could not save this report locally.',
    };
  }
}

export function registerBackground(api: BackgroundApi): void {
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = (message as ExtensionMessage)?.type;
    if (type === 'START_SELECTION' && isPopupSender(sender, api.runtime.id)) {
      void startOnActiveTab(api).then(sendResponse);
      return true;
    }
    if (type === 'CAPTURE_VISIBLE' && isPageSender(sender, api.runtime.id)) {
      void captureForSender(api, sender).then(sendResponse);
      return true;
    }
    if (type === 'SAVE_REPORT' && isPageSender(sender, api.runtime.id)) {
      void saveReport(message as SaveReportMessage).then(sendResponse);
      return true;
    }
  });
}

if (typeof chrome !== 'undefined') registerBackground(chrome);
