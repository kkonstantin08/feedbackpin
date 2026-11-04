# Screenshot image processing

Acceptance: process only an explicitly supplied image data URL; scale CSS-pixel redactions to the final bitmap dimensions; clip masks to the visible output; limit the longest edge to 1600 px; encode WebP at 0.8; reject output larger than 2 MiB with a clear message; close decoded image resources.

- RED: `npm test -- tests/unit/screenshot.test.ts --reporter=dot` failed to resolve the missing `src/shared/screenshot.ts` module.
- GREEN: processing uses `createImageBitmap` and Canvas through a small injectable adapter; the focused suite passes 4/4, covering output size/quality, scaling/clipping, size and format rejection, decode/encode errors, and bitmap release.
- Unit tests use an adapter because jsdom has no real Canvas encoder. Browser E2E must verify the production Canvas path.

## Sensitive-field mask alignment

- RED: a real Chromium screenshot showed the black rectangle displaced horizontally from the input, leaving its value visible. The earlier E2E assertion sampled a nearby black pixel and did not catch the leak.
- GREEN: mask the full horizontal viewport row for every visible input, editable region, or iframe. The focused overlay suite now passes 7/7, including the expected full-width row rectangles.
- Not verified: the updated mask has not been visually checked in Chromium because the user asked to stop browser runs after the test workload overloaded the laptop. Do not claim screenshot privacy is browser-verified until an approved run checks the pixel under the field.
