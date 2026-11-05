# Runtime impact and cleanup checks

## Acceptance criteria

- Remote Chromium samples no extension, installed idle, active selection, report save/close, and three repeated open/close cycles across ordinary, long, and dynamic React fixtures.
- Each runtime sample lasts two seconds and records aggregate Chrome CPU/RSS, GPU-process CPU/RSS when present, page task/script time, page heap after GC and after the sample, and long tasks. Selector start latency is recorded for 12 activations.
- The run stores its raw JSON as a short-lived GitHub Actions artifact. No browser runs on the user's laptop.
- Unit tests verify selection and form listeners are removed on close, in addition to checking that closed tools no longer react.

## Evidence

- RED: strict TypeScript caught a mismatch with the installed CDP protocol (`getProcessInfo` returns `processInfo`, not `processes`). The cleanup test also first asserted that a detached host erased its Shadow DOM subtree; that assertion was invalid because detached nodes retain their subtree.
- GREEN: use the protocol's `processInfo` field and assert host disconnection plus removal of each registered listener. Focused cleanup tests pass 10/10; full unit, lint, typecheck, and build pass locally without launching a browser.
- Remote runs `41978951113` and `41979318374` passed the performance matrix and produced 15 samples each, but README image capture failed with `Page.captureScreenshot: Unable to capture screenshot`. Foregrounding did not help, and run `41979694912` reproduced the same error on an empty `about:blank` page, ruling out extension-origin and page-content causes. Capture is moved to an isolated headless `chromium` context, which Playwright documents as supporting extensions; remote verification is pending.
- Remote run `41980073610` passed all 5 loaded-extension E2E tests, including the headless image capture. Both authentic UI screenshots were downloaded from its CI artifact and checked into the README assets. The next performance run adds heap readings before and after explicit GC to distinguish retained page objects from browser RSS caching.
- Playwright is intentionally not run on the user's laptop.
