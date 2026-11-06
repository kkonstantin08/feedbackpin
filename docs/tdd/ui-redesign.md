# Userback-inspired product shell

## Acceptance

- Dashboard presents feedback as a readable inbox with clear status navigation, a compact report list, and a selected-note detail view.
- New text-only reports use their space for note and page context; no empty screenshot panel is shown.
- Images already stored by older local builds remain viewable.
- Popup and dashboard share one product identity, visible focus, and legible type without new runtime dependencies, network assets, or animation libraries.
- Every report row names its status in text; color is supplemental.
- The loaded-extension dashboard remains usable at 390 px.

## Evidence

- RED: `npm test -- tests/unit/dashboard.test.tsx` failed on the new text-only report case because it rendered a full Screenshot region with the placeholder “No screenshot was saved with this note.”
- GREEN: the dashboard renders the screenshot section only for a legacy image, and shows stored capture errors as a compact note. The focused dashboard/popup suite passes 10/10, including no-placeholder and legacy-image regressions; the full unit suite passes 35/35.
- RED: the status-filter test failed when it required visible `Open` and `Resolved` labels, because each row exposed only a colored dot.
- GREEN: each row now includes a compact text status chip. Focused dashboard tests pass 7/7; all 35 unit tests, lint, strict typecheck, production build, and diff checks pass. Remote run `42182300358` passed all six loaded-extension E2E cases and produced current popup, 390 px and 1440 px screenshots. The 390 px test asserts no horizontal overflow; all three screenshots were visually inspected and saved to `docs/assets/`. No local browser was launched.
