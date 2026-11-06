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
- Screenshots are disabled in the MVP by the user's privacy decision. New report writes must remain text-only.
- TDD is required for behavior; run lint, typecheck, unit tests, E2E, and production build as available.

---

## Proposed file map

- `src/background.ts` — service worker event listeners, user-triggered injection, text report writes, Chrome API errors.
- `src/content/selector.ts` — on-demand pointer selection lifecycle and cleanup.
- `src/content/overlay.ts` — Shadow DOM highlight and text-only comment form; no React.
- `src/shared/report.ts` — report types and URL/selector sanitizers.
- `src/shared/db.ts` — IndexedDB open, create/read/update/delete, image cleanup.
- `src/popup/` — React toolbar popup.
- `src/dashboard/` — React local report list, filter, details, status.
- `manifest.json`, `vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` — build and CI.
- `tests/unit/` — selection, privacy/sanitization, storage, UI behavior.
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

**Messages:** `START_SELECTION` has no payload; `SAVE_REPORT` carries text-only report metadata and returns `{id}` or `{error}`. The service worker uses the active tab for injection and IndexedDB writes. Dashboard reads and updates IndexedDB directly from the extension origin.

- [x] Test start-selection injection calls for the active tab only, duplicate injection handling, and Chrome rejection on restricted pages.
- [x] Run focused tests to RED.
- [x] Implement a typed message contract and `chrome.scripting.executeScript` call reached only from the toolbar-button event; handle promise/API failures with a readable popup error.
- [x] Test that no tab receives injection without the explicit action and that unsupported pages do not receive a misleading success state.
- [x] Run focused tests to GREEN; the implementation remains uncommitted on this worktree.

## Task 5: Screenshot handling (superseded by privacy decision)

**Files:** `src/background.ts`, `src/content/overlay.ts`, `src/shared/messages.ts`, report tests, `docs/tdd/screenshots.md`.

- [x] Identify that late injection cannot discover every closed ShadowRoot created before FeedbackPin starts, so capture cannot guarantee private field values are excluded.
- [x] Obtain the user's choice to disable screenshot capture for privacy.
- [x] Remove screenshot UI, capture messages, Chrome capture handling, image processing, and new image persistence; test the disabled notice and rejection of image payloads.
- [x] Preserve previously saved local images rather than deleting existing user data; the current product does not create new screenshot blobs.
- [x] Commit the privacy change as `fix(privacy): disable screenshot capture`.

## Task 6: Complete report creation and dashboard behavior

**Files:** modify `src/content/overlay.ts`, `src/shared/db.ts`, `src/popup/`, `src/dashboard/`; create `tests/unit/dashboard.test.ts`, `docs/tdd/reports.md`.

- [x] Test empty comment validation, text-only saving, visible error states on IndexedDB failure, local storage estimate success/failure, list filtering, status transitions, and report deletion.
- [x] Confirm RED before adding behavior.
- [x] Implement the compact selection form and approved light product shell with required report actions.
- [x] Implement loading/error/empty states, semantic labels, keyboard controls, and visible focus.
- [x] Run focused tests to GREEN. Reopening is covered by unit lifecycle tests; loaded-extension reopen must be rechecked in E2E.
- [x] Commit the complete local reporting workflow as `feat(extension): complete local reporting workflow`.

## Task 7: Verify critical flows with a loaded extension

**Files:** create `tests/e2e/extension.spec.ts`, modify `playwright.config.ts`, `package.json`.

- [x] Add local fixture pages for a normal document, a long document, a dynamic DOM update, and a restricted/unsupported route simulation.
- [x] Launch Chromium with the built unpacked extension and test activation, hover, click, text-only save, report persistence after extension page reload, status change/filter, Escape cleanup, reopen, the screenshot-disabled notice, and restricted-page handling in remote CI. No browser was launched on the user's laptop.
- [x] Run E2E and fix failures through TDD; no Chrome API mocks replace the loaded-extension tests.
- [x] Check ordinary owned local fixtures with stock Playwright; no anti-bot behavior is involved, so CloakBrowser was unnecessary.
- [x] Commit as `test(extension): cover loaded-extension workflows` (`82143c6`). Current remote CI run `41916953384` passed all 3 scenarios.

## Task 8: Release readiness evidence

**Files:** create `README.md`, `LICENSE`, `docs/performance.md`, `docs/audits/` after their checks; modify CI/config only as needed.

- [x] Document actual install/dev/test commands, architecture, limits, and available build measurements; screenshots are disabled by user choice to protect privacy.
- [x] Run lint, typecheck, 33 unit tests, loaded-extension E2E, and production build. Latest remote run: `41988254350`.
- [x] On the remote GitHub Actions runner only, compare no extension, installed inactive, active selection, after save/close, and repeated open/close on ordinary, long, and dynamic pages. Record CPU, memory, start latency, long tasks, page task time, and bundle sizes in `docs/performance.md`. Do not run a browser on the user's laptop.
- [x] Fix the invalid Playwright worker-disappearance assertion; rerun lint, typecheck, unit, E2E, performance, and build checks.
- [x] Verify natural MV3 worker suspension with a remote browser-level CDP lifecycle test that does not attach to the worker. Chrome destroyed the worker target after 30,101 ms in run `41988254350`. Never launch it locally on the user's laptop.
- [x] Commit release documentation separately with `docs: record implementation and verification limits`.

## Task 9: Independent final audit and publication

**Files:** create `docs/audits/final-gpt6-luna-high.md`; publish the reviewed source and release evidence to the public `feedbackpin` repository.

- [x] After primary local checks passed, dispatch an independent audit subagent with exact model `gpt-6-luna` and reasoning effort `high`; concurrency stayed below the limit.
- [x] Provide the original requirements, `AGENTS.md`, approved design/spec, source, tests, build/performance evidence, commit history, and README.
- [x] Require severity, exact location, violation, fix, confirming tests, and unchecked scope; save the independent report at `docs/audits/final-gpt6-luna-high.md`.
- [x] Resolve the two findings: disable screenshot capture for privacy and add the optional local storage estimate. Rerun focused RED/GREEN, 31 unit tests, lint, typecheck, and build; remote CI later passed all 3 E2E scenarios.
- [x] Scan tracked content for common credential patterns, review diffs, push Conventional Commit history, and verify the public repository and branch on GitHub.
- [x] Commit the independent audit separately as `docs: record independent final audit` (`664d75a`).

## Handoff

The user approved the Stage B specification and plan, then authorized implementation. Execute inline unless a task needs independent work; keep concurrent subagents at or below two.

## Task 10: Apply the approved product-shell design to the actual UI

**Files:** `src/dashboard/main.tsx`, `src/dashboard/dashboard.module.css`, `src/popup/main.tsx`, `src/popup/popup.module.css`, `tests/unit/dashboard.test.tsx`, `tests/unit/popup.test.tsx`, `tests/e2e/readme-screenshots.spec.ts`, `docs/specs/feedbackpin-mvp.md`, `docs/tdd/ui-redesign.md`.

- [x] Use the Userback-inspired inbox structure already approved in the spec: visible product header, status navigation, readable report list, and a report-detail area that foregrounds the note and page context.
- [x] Remove the large empty screenshot placeholder for text-only reports while preserving rendering of legacy local screenshot blobs.
- [x] Bring popup typography, spacing, and action hierarchy into the same product identity without adding dependencies, remote fonts, or animation work.
- [x] Add RED/GREEN evidence for the screenshot-free detail state and regression coverage for legacy image display and current report actions.
- [x] Run the 35 unit tests, lint, strict typecheck, and production build locally; no browser was launched.
- [ ] Run loaded-extension E2E and produce updated screenshots only on the remote GitHub Actions runner. Never start a local browser.
- [ ] Recheck dashboard layout at 390 px and 1440 px using the existing loaded-extension scenario; inspect downloaded CI screenshots without opening a browser locally.
