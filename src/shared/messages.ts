import type { NewReport, Viewport } from './report';

export interface StartSelectionMessage {
  type: 'START_SELECTION';
}

export interface CaptureVisibleMessage {
  type: 'CAPTURE_VISIBLE';
  rectangles: Array<{ x: number; y: number; width: number; height: number }>;
  viewport: Viewport;
}

export interface SaveReportMessage {
  type: 'SAVE_REPORT';
  report: NewReport;
  screenshotDataUrl?: string;
}

export type ExtensionMessage =
  StartSelectionMessage | CaptureVisibleMessage | SaveReportMessage;
export type CaptureVisibleResponse = { dataUrl: string } | { error: string };
export type SaveReportResponse = { id: string } | { error: string };
