# Report creation and dashboard

Acceptance: save a validated text note with sanitized page metadata; restore reports from IndexedDB; filter open/resolved notes; change status and delete a report; preserve user input and show storage errors. Legacy images remain readable, but new writes are text-only.

- RED: `npm test -- tests/unit/dashboard.test.tsx --reporter=dot` against the scaffold dashboard exited 1 because the page shell had no mountable dashboard component. The test suite could not reach its expected empty/list behavior.
- GREEN: the focused dashboard suite covers empty state, filtering/status changes, deletion, and storage estimates. Overlay and save-handler suites cover text-only creation, save errors, privacy messaging, and dropping unexpected image payloads.
- Verification: see the current TDD entry below for latest local results. Loaded-extension persistence still requires E2E; it was not rerun after the privacy-driven removal of image capture.

## Local storage estimate

- RED: two new dashboard tests failed because no storage estimate or estimate-error state was displayed.
- GREEN: the dashboard reads `navigator.storage.estimate()` when available, displays local usage, and falls back to an unavailable message without blocking listing or deletion when estimation fails. Both tests pass; latest full suite passes 31/31.
