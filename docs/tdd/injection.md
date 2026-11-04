# User-triggered injection

Acceptance: only the FeedbackPin popup's `START_SELECTION` message queries the active tab; the service worker checks for an active selector before injecting `content/selector.js`, coalesces concurrent starts, and reports restricted-page/API errors without background activity.

- RED: the focused Vitest suite failed because the scaffold did not export a start-selection handler.
- GREEN: the event-driven message listener validates its popup sender, queries the active tab, checks the temporary selector host, injects once, and returns actionable errors; 5 focused tests pass.
- Verification: full unit suite, strict typecheck, ESLint/Prettier pass. The Vite build must emit the selector at `content/selector.js`; that output wiring is owned by the build-config task.
