# FeedbackPin reference-style refresh

## Approved direction

The user supplied a white SaaS settings interface as the visual reference on 2026-11-06. Apply its visual language to FeedbackPin's existing inbox and report detail. Do not reproduce the sample app's account, search, payment, or user-management features/content.

## Acceptance

- Put FeedbackPin branding, report filters, and recent notes in a full-height left rail.
- Keep the report comment and status actions prominent in a white main area.
- Present page URL and selected element as labeled, rounded outline fields; use dark navy text, cool-gray borders, and a vivid violet primary action.
- Restyle the popup in the same visual language while keeping element selection its obvious primary action.
- Preserve keyboard access, visible focus, empty/error states, legacy-image display, and all existing report behavior.
- At 390 px, stack the navigation/list and report content without horizontal overflow.
- Add no dependencies, external assets, fonts, network calls, animations, or product features.

## Verification

- [x] Add a regression assertion for accessible URL and element context groups; confirm RED before implementing the markup.
- [x] Run unit tests, lint, strict typecheck, and production build locally; do not launch a local browser.
- [x] Run loaded-extension E2E and create real popup, 390 px, and 1440 px screenshots only in GitHub Actions. Inspect those artifacts and update README screenshots.
- [x] Update `docs/performance.md` bundle sizes from the resulting production build. Existing remote runtime measurements remain applicable because this change contains no page runtime or background code.
- [ ] Record final visual review evidence in `docs/tdd/reference-style-refresh.md` and complete an independent GPT-6 Luna High follow-up audit before publishing `main`.
