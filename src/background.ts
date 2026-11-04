import { addReport } from './shared/db';
import type {
  ExtensionMessage,
  SaveReportMessage,
  SaveReportResponse,
} from './shared/messages';

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

async function saveReport(
  message: SaveReportMessage,
): Promise<SaveReportResponse> {
  try {
    const { comment, url, viewport, element } = message.report;
    const report = await addReport({ comment, url, viewport, element });
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
    if (type === 'SAVE_REPORT' && isPageSender(sender, api.runtime.id)) {
      void saveReport(message as SaveReportMessage).then(sendResponse);
      return true;
    }
  });
}

if (typeof chrome !== 'undefined') registerBackground(chrome);
