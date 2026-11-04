# FeedbackPin MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a minimal local-first MV3 extension that captures element-anchored reports and manages them in a React dashboard.

**Architecture:** A user action injects a standalone TypeScript selector into the active tab; a MV3 service worker handles injection and visible-tab capture. React runs only in extension pages, and IndexedDB stores report metadata and optional compressed images.

**Tech Stack:** React, strict TypeScript, Vite, Chrome MV3 APIs, DOM/Shadow DOM, IndexedDB, Vitest, React Testing Library, Playwright.

**Spec:** `docs/specs/feedbackpin-mvp.md`

## Global Constraints

- No always-on content scripts, broad host permissions, polling, background keep-alive, or external network requests.
- The service worker is event-driven; page code is injected only after a user gesture.
- The selector uses no React and removes all listeners/overlay on selection, cancel, errors, and teardown.
- Report values exclude page field values, URL query/hash, DOM text, and arbitrary attributes.
- Screenshots are user-requested, previewed, masked, compressed, size-limited, and optional after capture failure.
- TDD is required for behavior; run lint, typecheck, unit tests, E2E, and production build as available.

---

## Proposed file map

- `src/background.ts` — service worker install-time event listeners, injection, capture messages, Chrome API errors.
- `src/content/selector.ts` — on-demand pointer selection lifecycle and cleanup.
- `src/content/overlay.ts` — Shadow DOM highlight and comment/screenshot form; no React.
- `src/shared/report.ts` — report types and URL/selector sanitizers.
- `src/shared/db.ts` — IndexedDB open, create/read/update/delete, image cleanup.
- `src/shared/screenshot.ts` — visible screenshot resizing, redaction, WebP conversion, size cap.
- `src/popup/` — React toolbar popup.
- `src/dashboard/` — React local report list, filter, details, status.
- `manifest.json`, `vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` — build and CI.
- `tests/unit/` — selection, privacy/sanitization, storage, screenshot processing, UI behavior.
- `tests/e2e/` — extension loading and critical user flows in Chromium.
- `docs/tdd/` — brief RED/GREEN records for substantial features.

## Task 1: Scaffold and verify the MV3 shell

**Files:** create `package.json`, lockfile, `manifest.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `src/background.ts`, `src/popup/index.html`, `src/popup/main.tsx`, `src/dashboard/index.html`, `src/dashboard/main.tsx`, `.gitignore`, `.github/workflows/ci.yml`.

- [x] Create a strict TypeScript Vite project with only the required runtime dependencies React and React DOM; add `@types/chrome`, Vitest, Testing Library, Playwright, fake-indexeddb (test-only), ESLint, and Prettier as development tools.
- [x] Initialize git, create the authorized public GitHub repository `feedbackpin`, add its remote, and verify GitHub reports it as public. The docs-only baseline is pushed to `main`.
- [x] Define an MV3 manifest with `activeTab` and `scripting`, an event-driven service worker, popup, and dashboard page; do not define content-script matches or `host_permissions`.
- [x] Add a build assertion that the generated manifest points at existing artifacts and has no content-script registration or unexpected permissions.
- [x] Run that assertion and verify it fails before the build artifact exists, then run it after build and verify it passes.
- [x] Add ESLint and Prettier configuration and CI commands for lint, typecheck, unit tests, E2E tests, and production build; E2E should run the built extension in local Chromium with no external service.
- [x] Commit as `chore: scaffold mv3 extension project`.

## Task 2: Define report contract and IndexedDB persistence

**Files:** create `src/shared/report.ts`, `src/shared/db.ts`, `tests/unit/report.test.ts`, `tests/unit/db.test.ts`, `docs/tdd/storage.md`.

**Contract:** `Report` has `id`, `comment`, `createdAt`, `url`, `viewport:{width,height}`, `element:{tag,selector}`, `status:'open'|'resolved'`, optional `screenshot:Blob`, and optional `screenshotError:string`. `NewReport` carries the same user-entered metadata before `id` and `createdAt` are assigned.

- [x] Write tests that reject empty comments, strip query/hash from URLs, build a structural selector without text/attributes, and preserve the exact approved report field set.
- [x] Run the focused tests and record the expected RED failures.
- [x] Write persistence tests for add/read/list/status update/delete, including deleting the image with its report and handling quota/open/write errors.
- [x] Run the tests before implementation and record the expected RED failures.
- [x] Implement the smallest validators and native IndexedDB operations; do not add an ORM or storage library.
- [x] Run focused tests to GREEN, then related unit tests; record concise RED/GREEN evidence in `docs/tdd/storage.md`.
- [x] Commit as `feat(storage): persist local reports in indexeddb`.

## Task 3: Implement on-demand selection lifecycle

**Files:** create `src/content/selector.ts`, `src/content/overlay.ts`, `tests/unit/selector.test.ts`, `docs/tdd/selection.md`.

- [x] Write DOM tests for pointer highlight, click target capture, Escape cancellation, explicit cancel, repeated start rejection, and cleanup of host plus listeners after every exit.
- [x] Run tests and confirm RED for the expected missing behavior.
- [x] Implement a single temporary Shadow DOM host and one pointer, click, and keydown listener while active; highlight with a fixed overlay driven by `elementFromPoint()` and rect reads, not target-style mutation.
- [x] Run tests to GREEN; add a cleanup assertion that dispatching pointer/click/Escape after teardown causes no selector action.
- [x] Record RED/GREEN evidence and commit as `feat(extension): add on-demand element selection`.

## Task 4: Add user-triggered injection and restricted-page handling

**Files:** modify `src/background.ts`, `src/popup/`, create `src/shared/messages.ts`, `tests/unit/background.test.ts`, `docs/tdd/injection.md`.

**Messages:** `START_SELECTION` has no payload; `CAPTURE_VISIBLE` carries CSS-pixel redaction rectangles and viewport dimensions and returns `{dataUrl}` or `{error}`; `SAVE_REPORT` carries `NewReport` plus an optional compressed screenshot data URL and returns `{id}` or `{error}`. The service worker uses `sender.tab.id` for injection/capture and IndexedDB writes. Dashboard reads and updates IndexedDB directly from the extension origin.

- [x] Test start-selection injection calls for the active tab only, duplicate injection handling, and Chrome rejection on restricted pages.
- [x] Run focused tests to RED.
- [x] Implement a typed message contract and `chrome.scripting.executeScript` call reached only from the toolbar-button event; handle promise/API failures with a readable popup error.
- [x] Test that no tab receives injection without the explicit action and that unsupported pages do not receive a misleading success state.
- [x] Run focused tests to GREEN; the implementation remains uncommitted on this worktree.

## Task 5: Build screenshot redaction and compression

**Files:** create `src/shared/screenshot.ts`, modify `src/background.ts`, `src/content/overlay.ts`, add `tests/unit/screenshot.test.ts`, `docs/tdd/screenshots.md`.

- [x] Add unit coverage for capture errors, CSS-to-bitmap mask scaling, resize, WebP, and the size cap.
- [x] Confirm RED, then implement capture only after the explicit screenshot control; do not request it at extension startup or selection start.
- [x] Show a preview before report save; store no image until report save. On capture/encode/cap failure, set a clear reason and preserve comment/metadata.
- [x] Run focused tests to GREEN and verify no data URL/base64 image is stored in report metadata.
- [x] Record RED/GREEN evidence. Real-browser image masking remains unverified and is a release blocker; see `docs/tdd/screenshots.md` and `docs/performance.md`.

## Task 6: Complete report creation and dashboard behavior

**Files:** modify `src/content/overlay.ts`, `src/shared/db.ts`, `src/popup/`, `src/dashboard/`; create `tests/unit/dashboard.test.ts`, `docs/tdd/reports.md`.

- [x] Test empty comment validation, saving with and without an image, visible error states on IndexedDB failure, list filtering, status transitions, and report deletion.
- [x] Confirm RED before adding behavior.
- [x] Implement the compact selection form and approved light product shell with required report actions.
- [x] Implement loading/error/empty states, semantic labels, keyboard controls, and visible focus.
- [x] Run focused tests to GREEN. Reopening is covered by unit lifecycle tests; loaded-extension reopen must be rechecked in E2E.
- [x] Commit the complete local reporting workflow as `feat(extension): complete local reporting workflow`.

## Task 7: Verify critical flows with a loaded extension

**Files:** create `tests/e2e/extension.spec.ts`, modify `playwright.config.ts`, `package.json`.

- [x] Add local fixture pages for a normal document, a long document, a dynamic DOM update, and a restricted/unsupported route simulation.
- [ ] Launch Chromium with the built unpacked extension and test activation, hover, click, comment, explicit screenshot, report persistence after extension page reload, status change/filter, Escape cleanup, reopen, and screenshot error fallback. Navigate to `chrome://settings` for an actual restricted-page check if Playwright's bundled Chromium permits it; otherwise record that limitation and verify manually in Chrome.
- [ ] Run E2E and fix failures through TDD; do not replace these tests with Chrome API mocks.
- [ ] Check ordinary owned local fixtures with stock Playwright; no anti-bot behavior is involved, so CloakBrowser is unnecessary for this test target.
- [ ] Commit as `test(extension): cover loaded-extension workflows`.

## Task 8: Release readiness evidence

**Files:** create `README.md`, `LICENSE`, `docs/performance.md`, `docs/audits/` after their checks; modify CI/config only as needed.

- [x] Document actual install/dev/test commands, architecture, limits, and available build measurements; screenshots are deferred because the privacy fix has not been visually verified.
- [x] Run lint, typecheck, unit tests, and production build. E2E was not rerun after the privacy fix; see `docs/performance.md`.
- [ ] In real Chromium, compare no extension, installed inactive, active selection, after save, after close, and repeated open/close on normal, long, and dynamic pages. Measure CPU, memory, start latency, long tasks, handler cleanup, responsiveness, and bundle sizes.
- [ ] Fix regressions; rerun affected unit/E2E and browser measurements.
- [x] Commit release documentation separately with `docs: record implementation and verification limits`.

## Task 9: Independent final audit and publication

**Files:** create `docs/audits/final-gpt6-luna-high.md`; publish the reviewed source and release evidence to the public `feedbackpin` repository.

- [ ] After all primary checks pass, dispatch one independent audit subagent with exact model `gpt-6-luna` and reasoning effort `high`; keep total active subagents at or below two.
- [ ] Provide the original user requirements, `AGENTS.md`, approved research/design direction, MVP spec, source, tests, build evidence, performance report, commit history, and README.
- [ ] Require findings to name severity, exact file/location, violated requirement, fix, and confirming test; write the independent findings and their scope to `docs/audits/final-gpt6-luna-high.md`.
- [ ] Fix findings and rerun corresponding tests, measurements, and audit checks; do not claim an item passed without evidence.
- [ ] Scan tracked files for credentials/private data, review the final git diff, push Conventional Commit history, and verify the public GitHub URL loads the expected repository.
- [ ] Commit the audit separately as `docs: record independent final audit`.

## Handoff

The user approved the Stage B specification and plan, then authorized implementation. Execute inline unless a task needs independent work; keep concurrent subagents at or below two.
