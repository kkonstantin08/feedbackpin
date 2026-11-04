import type { NewReport } from './report';

export interface StartSelectionMessage {
  type: 'START_SELECTION';
}

export interface SaveReportMessage {
  type: 'SAVE_REPORT';
  report: NewReport;
}

export type ExtensionMessage = StartSelectionMessage | SaveReportMessage;
export type SaveReportResponse = { id: string } | { error: string };
