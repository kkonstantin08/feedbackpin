# Userback-inspired product shell

## Acceptance

- Dashboard presents feedback as a readable inbox with clear status navigation, a compact report list, and a selected-note detail view.
- New text-only reports use their space for note and page context; no empty screenshot panel is shown.
- Images already stored by older local builds remain viewable.
- Popup and dashboard share one product identity, visible focus, and legible type without new runtime dependencies, network assets, or animation libraries.
- The loaded-extension dashboard remains usable at 390 px.

## Evidence

- RED: `npm test -- tests/unit/dashboard.test.tsx` failed on the new text-only report case because it rendered a full Screenshot region with the placeholder “No screenshot was saved with this note.”
- GREEN: the dashboard renders the screenshot section only for a legacy image, and shows stored capture errors as a compact note. The focused dashboard/popup suite passes 10/10, including no-placeholder and legacy-image regressions; the full unit suite passes 35/35.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass. Remote loaded-extension screenshot and 390 px verification remain pending; no local browser was launched.
