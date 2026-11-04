import { showReportForm } from './overlay';
import { startSelection } from './selector';

if (
  typeof chrome !== 'undefined' &&
  chrome.runtime?.id &&
  !document.querySelector('[data-feedbackpin-host]')
) {
  startSelection({
    onSelect: (element) => {
      showReportForm(element, {
        onSave: async (report) => {
          const response = await chrome.runtime.sendMessage({
            type: 'SAVE_REPORT',
            report,
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
