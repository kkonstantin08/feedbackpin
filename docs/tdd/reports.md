# Report creation and dashboard

Acceptance: save a validated comment with sanitized page metadata and an optional screenshot; restore reports from IndexedDB; filter open/resolved notes; change status and delete a report; preserve user input and show storage errors.

- RED: `npm test -- tests/unit/dashboard.test.tsx --reporter=dot` against the scaffold dashboard exited 1 because the page shell had no mountable dashboard component. The test suite could not reach its expected empty/list behavior.
- GREEN: the focused dashboard suite passes 3/3 for empty state, filtering/status changes, and deletion. Overlay and save-handler suites also cover save errors, optional screenshots, screenshot failures, and comment preservation.
- Verification: `npm run lint`, `npm run typecheck`, `npm test -- --reporter=dot` (39/39), and `npm run build` pass. Loaded-extension persistence and screenshot behavior still require E2E; it was not rerun after the screenshot privacy correction.
