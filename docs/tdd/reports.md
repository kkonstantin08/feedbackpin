# Report creation and dashboard

Acceptance: save a validated text note with sanitized page metadata; restore reports from IndexedDB; filter open/resolved notes; change status and delete a report; preserve user input and show storage errors. Legacy images remain readable, but new writes are text-only.

- RED: `npm test -- tests/unit/dashboard.test.tsx --reporter=dot` against the scaffold dashboard exited 1 because the page shell had no mountable dashboard component. The test suite could not reach its expected empty/list behavior.
- GREEN: the focused dashboard suite covers empty state, filtering/status changes, deletion, and storage estimates. Overlay and save-handler suites cover text-only creation, save errors, privacy messaging, and dropping unexpected image payloads.
- Verification: remote run `41988254350` passed the text-only flow and all six loaded-extension E2E scenarios, with 33 unit tests, lint, typecheck, performance artifact upload, and build. The focused DB suite passes 3/3 locally.

## Text-only IndexedDB creation boundary

- RED: the new DB regression passed an unexpected `screenshot: Blob` and `screenshotError` to `addReport()`; it failed because the restored record still contained `screenshot`.
- GREEN: `NewReport` no longer includes image fields and `createReport()` only constructs the text metadata fields. `Report` retains optional legacy image fields for read/update/delete compatibility. A legacy IndexedDB fixture remains readable, keeps its image through status changes, and can be deleted.
- Verification: focused DB suite passes 3/3; remote run `41988254350` passed all 33 unit tests and six loaded-extension E2E scenarios.

## Local storage estimate

- RED: two new dashboard tests failed because no storage estimate or estimate-error state was displayed.
- GREEN: the dashboard reads `navigator.storage.estimate()` when available, displays local usage, and falls back to an unavailable message without blocking listing or deletion when estimation fails. Both tests pass; latest full suite passes 31/31.
