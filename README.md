# FeedbackPin

FeedbackPin is a local-first Chrome extension for leaving visual bug reports on the page element that needs attention. A report keeps a short comment, a safe element path, a sanitized URL, viewport dimensions, and an optional screenshot in the current browser profile.

## What it does

- Starts element selection only after you open the extension and choose **Select an element**.
- Adds a quiet highlight and compact note form to the current page.
- Captures the visible area only when you press the screenshot button.
- Masks rows containing visible inputs, editable regions, and iframes to prevent field values from leaking when screenshot and page coordinates differ.
- Keeps a note without an image when Chrome cannot capture or encode a screenshot.
- Stores reports in IndexedDB on the extension device. The dashboard filters open and resolved notes and lets you change status or delete a report.

FeedbackPin has no account, backend, network reporting, analytics, or team workspace. It is a focused handoff tool, not a project tracker.

## Screenshots

Product screenshots are not included yet. The prior browser capture showed a redaction offset, so those images were discarded. The screenshot path now masks the full horizontal row for sensitive page regions; a fresh visual capture is deferred until browser verification can run without overloading the development machine.

## Install in Chrome

1. Build the extension with `npm ci` and `npm run build`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the generated `dist/` directory.
4. Pin FeedbackPin, open a regular website, and choose **Select an element** from the extension popup.

The production manifest requests only `activeTab` and `scripting`. It does not register page scripts or host permissions. Chrome restricted pages such as `chrome://` do not allow extension injection.

## Develop and verify

Use Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run dev` serves the local fixtures and extension source for development. `npm run test:e2e` builds and loads a temporary copy of the extension in Chromium. That test copy adds permissions required to automate local pages and screenshots; the generated production manifest is separately checked to contain only `activeTab` and `scripting`.

## Architecture

- `src/background.ts` is an event-driven MV3 service worker. It injects the selector after the popup action, captures on explicit request, and writes validated reports.
- `src/content/` is a small plain TypeScript script with a temporary Shadow DOM overlay. It is not registered for page load and does not use React.
- `src/popup/` and `src/dashboard/` are React extension pages.
- `src/shared/db.ts` stores reports and optional WebP blobs in IndexedDB.
- `src/shared/screenshot.ts` resizes images to a maximum edge of 1600 px and a maximum stored size of 2 MiB.

The manifest guard also checks that the injected selector is a self-contained script, with no runtime module import.

## Privacy and limits

- Comments and reports remain in the current browser profile until deleted.
- Page field values, DOM text, arbitrary attributes, URL query strings, and URL fragments are not stored as report metadata.
- Visible input, textarea, select, editable, and iframe regions cause a full-width horizontal mask in the screenshot. This hides more surrounding page content than a tight rectangle, while tolerating screenshot coordinate offsets.
- Screenshots are optional and require an explicit capture action and a later save action.
- Element paths are structural hints and may become stale when a site changes its DOM.
- There is no cloud sync, collaboration, authentication, or automatic retention cleanup.

## Performance

The implementation keeps page code absent until selection starts and removes its temporary listeners when selection closes. Production bundle sizes and the unmeasured browser-performance matrix are recorded in [docs/performance.md](docs/performance.md). CPU, memory, long-task, responsiveness, and repeated-open measurements are not claimed until they can be collected safely in Chromium.

## Project records

- [Approved MVP specification](docs/specs/feedbackpin-mvp.md)
- [Implementation plan](docs/plans/2026-11-04-feedbackpin-mvp.md)
- [TDD evidence](docs/tdd/)
- [Performance status](docs/performance.md)

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build` before proposing a release. A public repository is not a Chrome Web Store listing.
