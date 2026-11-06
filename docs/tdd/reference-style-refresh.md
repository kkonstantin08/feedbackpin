# Supplied-reference style refresh

## Acceptance

- The inbox keeps the existing report filters, selection, status changes, deletion, errors, and local privacy notice.
- The selected report remains the main heading; page URL and element path are exposed as named groups and styled as outlined fields.
- Popup and inbox use a white surface, cool-gray borders, navy text, and violet primary actions without remote assets or new dependencies.
- The 390 px dashboard has no horizontal overflow; the real extension popup and dashboard screenshots match the supplied style direction.

## RED → GREEN

- RED: `npm test -- tests/unit/dashboard.test.tsx -t "text-only reports"` failed because the page URL and selected element were plain row content with no named groups.
- GREEN: the dashboard now exposes `Page URL` and `Selected element` as labelled groups. The same focused test passed, and the full unit suite passed 35/35. `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass. Remote loaded-extension E2E and current screenshots are pending; no local browser was launched.
