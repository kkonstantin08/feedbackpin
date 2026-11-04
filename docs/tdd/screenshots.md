# Screenshot image processing

## Product decision: disable image capture

- RED: `npm test -- tests/unit/overlay.test.ts --reporter=dot` failed because the form still exposed its screenshot button. The updated save-handler test also failed against the previous capture-capable worker because it stored an unexpected image payload.
- GREEN: the form now states that screenshots are disabled, has no capture action, and saves only the comment plus structural metadata. Capture messages, Chrome capture handling, the image-processing module, and its tests were removed. The service-worker save handler drops unexpected image fields before persistence. Focused save tests pass 2/2; current lint, typecheck, 31/31 unit tests, and build pass.
- Compatibility: existing image blobs from local development are not deleted; existing reports can still display them. No new report can store an image through the production message flow.
- Verification: local unit tests, lint, typecheck, and production build are rerun after implementation. Browser E2E remains unrun by user instruction.

The following records document the earlier screenshot experiment, which is no longer part of the MVP.

Acceptance: process only an explicitly supplied image data URL; scale CSS-pixel redactions to the final bitmap dimensions; clip masks to the visible output; limit the longest edge to 1600 px; encode WebP at 0.8; reject output larger than 2 MiB with a clear message; close decoded image resources.

- RED: `npm test -- tests/unit/screenshot.test.ts --reporter=dot` failed to resolve the missing `src/shared/screenshot.ts` module.
- GREEN: processing uses `createImageBitmap` and Canvas through a small injectable adapter; the focused suite passes 4/4, covering output size/quality, scaling/clipping, size and format rejection, decode/encode errors, and bitmap release.
- Unit tests use an adapter because jsdom has no real Canvas encoder. Browser E2E must verify the production Canvas path.

## Shadow DOM privacy boundary

- RED: four new unit assertions failed: fields in open Shadow DOM were omitted, closed custom components did not block capture, and storage usage/failure states were absent from the dashboard.
- Historical GREEN: the explicit screenshot experiment traversed open ShadowRoots and refused capture when a custom element had no exposed root. This code was removed after identifying that closed roots on standard HTML elements remain undiscoverable; the user's privacy choice is to disable screenshots.
- Limitation: a closed shadow root attached to a standard HTML element cannot be detected after page code creates it. Chrome pixel verification remains unrun; see `docs/performance.md`.

## Sensitive-field mask alignment

- RED: a real Chromium screenshot showed the black rectangle displaced horizontally from the input, leaving its value visible. The earlier E2E assertion sampled a nearby black pixel and did not catch the leak.
- Historical GREEN: the screenshot experiment masked a full horizontal row for each visible input, editable region, or iframe. This is no longer shipped because the late-injection design could not guarantee coverage of all closed ShadowRoots.
- Not verified: no post-change browser run was performed. Current MVP does not capture screenshots.
