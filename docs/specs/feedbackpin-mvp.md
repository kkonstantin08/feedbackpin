# FeedbackPin MVP — product and technical specification

**Status:** design direction approved; MVP specification prepared 2026-11-04 and awaiting user review. It becomes the implementation contract after approval.

## Product intent

FeedbackPin is a local-first Chrome extension for creating concise visual bug reports anchored to DOM elements. It replaces vague screenshot handoffs with a comment, a visible-page screenshot when available, a safe element reference, the sanitized page URL, and viewport dimensions. It is not a project tracker or collaboration platform.

## Approved visual direction

The user approved a more developed product shell inspired by the visual feel of Userback. The FeedbackPin dashboard may use a clear app frame, polished light surfaces, strong typographic hierarchy, and one expressive accent color. The reference guides the visual character only; no Userback screen is copied. The extension popup and dashboard contain only FeedbackPin's required actions and report list/statuses. On the website itself, selection remains quiet: a restrained highlight and a compact comment form. MVP is light-theme only; a second theme adds UI surface without serving a stated need.

## User flow and functional requirements

1. The user opens the extension popup and explicitly starts element selection on the current tab.
2. The service worker injects the small selector script into that tab on demand. No content script runs on pages before this action.
3. While selection is active, pointer movement highlights the element under the cursor. One click selects it and opens a compact comment form. Escape or Cancel exits cleanly.
4. The form identifies the target without collecting its text or values. It offers an explicit screenshot action and preview; the user explicitly saves the report.
5. The screenshot is of the visible viewport. Before capture, the selector overlay is hidden so it does not appear in the image. Native form values are masked in the image before persistence; visible iframe regions are masked. The preview lets the user review the resulting image. A screenshot API error does not discard the text report: save the report with a clear “without screenshot” state.
6. A report stores comment, creation time, URL origin/path (query and fragment excluded), viewport width/height, a safe element reference, and an optional compressed screenshot blob.
7. The dashboard lists reports, filters All/Open/Resolved, opens report details, and allows status change. Reports remain local until explicitly deleted. The user can delete an individual report and its image; there is no automatic deletion.

### Element reference

Store a structural CSS path based on tag names and `:nth-of-type()` positions, plus the target's tag name. Do not store element text, form values, arbitrary attributes, or innerHTML. The path is best-effort context; it can become stale if the site changes its DOM.

### Privacy boundary

- Do not send page/report data over the network.
- Do not store typed text or form values from the website.
- Remove URL query strings and fragments to avoid persisting common tokens and personal data.
- Mask visible `input`, `textarea`, `select`, and editable field content in the screenshot; cover visible iframe rectangles because their field content may be inaccessible.
- A screenshot is kept only after the user previews and saves it. If a page feature cannot be safely captured, show a limitation and allow a report without an image.

## Acceptance criteria

- No page code or listeners are present before the user starts selection.
- Starting selection works on ordinary pages, long documents, and dynamically rendered pages without a global MutationObserver, polling, or React in the page.
- Hover feedback tracks the pointer without modifying the target element's styles or page logic.
- Click chooses one element; Escape and Cancel remove the overlay and every listener. Reopen works after cancel and after save.
- Form text, page field values, query strings, fragments, and arbitrary element text are absent from saved records.
- Screenshot is only requested by an explicit user action, is previewed before saving, masks visible native fields/iframes, is compressed and size-limited, and can be absent with a visible reason.
- Reports persist across dashboard and extension restarts. Status updates and filters behave correctly.
- Storage/API failures preserve the user's text when possible and show an actionable error; they never silently report success.
- `chrome://`, Chrome Web Store, browser new-tab pages, and other restricted tabs show a clear unsupported-page message without breaking the page.
- Keyboard users can start, cancel, submit, navigate, and change status; focus is visible and labels are programmatic.

## Architecture

- **MV3 service worker:** event-driven message handling; inject selector files after toolbar action; call `chrome.tabs.captureVisibleTab` only after the explicit screenshot action; no keep-alive or background polling.
- **Content script:** plain TypeScript, injected on demand. A single temporary Shadow DOM host isolates the highlight and small comment form from page CSS. Use a minimal pointer handler, click handler, and Escape handler only while active. `destroy()` removes handlers and the host on every exit path. Do not use React in the page.
- **Extension UI:** React + TypeScript for the toolbar popup and dashboard page. The popup starts selection or opens the dashboard. The dashboard presents a compact product shell and report list/details.
- **Persistence:** IndexedDB on the extension origin stores report metadata and optional image Blob. No `unlimitedStorage` permission. Surface quota/write errors; never auto-delete. Show local storage usage where the browser exposes a reliable estimate; manual deletion is the cleanup path.
- **Screenshot pipeline:** request a visible-tab capture only on explicit action. The content script hides its temporary UI and sends visible redaction rectangles to the service worker; the worker captures the sender tab, uses screenshot-pixel/viewport scale to mask visible native editable controls and iframe rectangles, resizes the longest edge to at most 1600 px, and encodes WebP at quality 0.8. It returns an ephemeral preview image to the content form. On explicit report save, send that image with the report for IndexedDB persistence. Reject an image above 2 MiB with a clear reason while allowing report text to be saved. These are initial caps to verify against the real Chromium quality/performance run.
- **Permissions:** `activeTab` and `scripting` only for the MVP. No host permissions, network access, broad `tabs` permission, remote code, or content-script match patterns.
- **Build isolation:** Vite bundles the two React extension pages, service worker, and standalone selector. Production manifest lists only extension pages and the service worker; it does not register an always-on content script.

## Non-goals

Backend/API, accounts, teams, notifications, AI, integrations, screen recording, full-page capture, screenshot drawing tools, analytics, cloud sync, and task-board features.

## Open limitations to report

- Structural selectors can stop pointing to the same element after site updates.
- Cross-origin/closed-shadow content cannot be inspected like ordinary DOM. Inaccessible embedded frames are masked; if safe capture cannot be assured, FeedbackPin saves only the text report and explains why.
- Chrome restrictions can prevent injection or screenshot capture on protected pages.
- Screenshot caps and quality must be validated on real Chromium; this spec does not claim a performance result.
