import { showReportForm } from './overlay';
import { processScreenshot } from '../shared/screenshot';
import { startSelection } from './selector';

if (
  typeof chrome !== 'undefined' &&
  chrome.runtime?.id &&
  !document.querySelector('[data-feedbackpin-host]')
) {
  startSelection({
    onSelect: (element) => {
      showReportForm(element, {
        onCapture: async (rectangles, viewport) => {
          const response = await chrome.runtime.sendMessage({
            type: 'CAPTURE_VISIBLE',
            rectangles,
            viewport,
          });
          if (!response?.dataUrl) {
            throw new Error(
              response?.error ?? 'Could not capture the visible page.',
            );
          }
          return processScreenshot(response.dataUrl, rectangles, viewport);
        },
        onSave: async (report, screenshotDataUrl, screenshotError) => {
          const response = await chrome.runtime.sendMessage({
            type: 'SAVE_REPORT',
            report: {
              ...report,
              ...(screenshotError ? { screenshotError } : {}),
            },
            ...(screenshotDataUrl ? { screenshotDataUrl } : {}),
          });
          if (!response?.id) {
            throw new Error(response?.error ?? 'Could not save this report.');
          }
        },
      });
    },
    onCancel: () => undefined,
  });
}
