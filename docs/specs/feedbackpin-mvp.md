# FeedbackPin MVP — product and technical specification

**Status:** design direction and MVP specification approved by the user on 2026-11-04; this is the implementation contract.

## Product intent

FeedbackPin is a local-first Chrome extension for creating concise visual bug reports anchored to DOM elements. It replaces vague handoffs with a comment, a safe element reference, the sanitized page URL, and viewport dimensions. It is not a project tracker or collaboration platform.

## Approved visual direction

The user approved a more developed product shell inspired by the visual feel of Userback. The dashboard is an inbox: clear status navigation and a readable report list on the left, with the selected note and its page/element context in a distinct detail area. Use a polished light surface, confident type scale, and one expressive accent; keep real report content prominent and avoid empty screenshot placeholders for new text-only reports. Preserve historical local images when present. The reference guides the visual character only; no Userback screen is copied. The extension popup should feel like the same product and make the selection action immediately obvious. On the website itself, selection remains quiet: a restrained highlight and a compact comment form. MVP is light-theme only; a second theme adds UI surface without serving a stated need.

## User flow and functional requirements

1. The user opens the extension popup and explicitly starts element selection on the current tab.
2. The service worker injects the small selector script into that tab on demand. No content script runs on pages before this action.
3. While selection is active, pointer movement highlights the element under the cursor. One click selects it and opens a compact comment form. Escape or Cancel exits cleanly.
4. The form identifies the target without collecting its text or values and lets the user save a text note.
5. Screenshots are disabled. Late on-demand injection cannot detect every closed ShadowRoot created before FeedbackPin starts, so a capture could include an unmasked private field. The form explains this limitation; no screenshot capture or image processing runs.
6. A report stores comment, creation time, URL origin/path (query and fragment excluded), viewport width/height, and a safe element reference. Existing local image blobs from earlier development builds are preserved and remain visible for compatibility; new reports never accept or store images.
7. The dashboard lists reports, filters All/Open/Resolved, opens report details, and allows status change. Reports remain local until explicitly deleted. The user can delete an individual report and its image; there is no automatic deletion.

### Element reference

Store a structural CSS path based on tag names and `:nth-of-type()` positions, plus the target's tag name. Do not store element text, form values, arbitrary attributes, or innerHTML. The path is best-effort context; it can become stale if the site changes its DOM.

### Privacy boundary

- Do not send page/report data over the network.
- Do not store typed text or form values from the website.
- Remove URL query strings and fragments to avoid persisting common tokens and personal data.
- Do not capture or process screenshots in the MVP. No code path may call the tab capture API or persist image data from a new report.
- Keep existing image blobs readable so an update does not silently delete local user data.

## Acceptance criteria

- No page code or listeners are present before the user starts selection.
- Starting selection works on ordinary pages, long documents, and dynamically rendered pages without a global MutationObserver, polling, or React in the page.
- Hover feedback tracks the pointer without modifying the target element's styles or page logic.
- Click chooses one element; Escape and Cancel remove the overlay and every listener. Reopen works after cancel and after save.
- Form text, page field values, query strings, fragments, and arbitrary element text are absent from saved records.
- The on-page form clearly states that screenshots are disabled for privacy; it has no image capture action and saves text notes normally.
- New reports contain no screenshot blob even if a message includes an unexpected image property.
- Reports persist across dashboard and extension restarts. Status updates and filters behave correctly.
- Storage/API failures preserve the user's text when possible and show an actionable error; they never silently report success.
- `chrome://`, Chrome Web Store, browser new-tab pages, and other restricted tabs show a clear unsupported-page message without breaking the page.
- Keyboard users can start, cancel, submit, navigate, and change status; focus is visible and labels are programmatic.

## Architecture

- **MV3 service worker:** event-driven message handling; inject selector files after toolbar action; no capture API use, keep-alive, or background polling.
- **Content script:** plain TypeScript, injected on demand. A single temporary Shadow DOM host isolates the highlight and small comment form from page CSS. Use a minimal pointer handler, click handler, and Escape handler only while active. `destroy()` removes handlers and the host on every exit path. Do not use React in the page.
- **Extension UI:** React + TypeScript for the toolbar popup and dashboard page. The popup starts selection or opens the dashboard. The dashboard presents a compact product shell and report list/details.
- **Persistence:** IndexedDB on the extension origin stores report metadata. No `unlimitedStorage` permission. Surface quota/write errors; never auto-delete. Show local storage usage where the browser exposes a reliable estimate; manual deletion is the cleanup path. Preserve legacy image blobs already stored by development versions.
- **Screenshot pipeline:** intentionally absent. The approved privacy choice prioritizes never capturing private page pixels over screenshot convenience.
- **Permissions:** `activeTab` and `scripting` only for the MVP. No host permissions, network access, broad `tabs` permission, remote code, or content-script match patterns.
- **Build isolation:** Vite bundles the two React extension pages, service worker, and standalone selector. Production manifest lists only extension pages and the service worker; it does not register an always-on content script.

## Non-goals

Backend/API, accounts, teams, notifications, AI, integrations, screen recording, full-page capture, screenshot drawing tools, analytics, cloud sync, and task-board features.

## Open limitations to report

- Structural selectors can stop pointing to the same element after site updates.
- Cross-origin and closed-shadow content cannot be inspected like ordinary DOM; element references inside such content are best-effort only.
- Chrome restrictions can prevent injection or screenshot capture on protected pages.
- Historical image blobs from development builds remain in IndexedDB until the user deletes their report; the current version never creates new images.
- Runtime performance was measured on a hosted CI Chromium runner; impact on the user's laptop and extended real-world sessions remain unmeasured. See `docs/performance.md`.
