# Runtime impact and cleanup checks

## Acceptance criteria

- Remote Chromium samples no extension, installed idle, active selection, report save/close, and three repeated open/close cycles across ordinary, long, and dynamic React fixtures.
- Each runtime sample lasts two seconds and records aggregate Chrome CPU/RSS, GPU-process CPU/RSS when present, page task/script time, heap, and long tasks. Selector start latency is recorded for 12 activations.
- The run stores its raw JSON as a short-lived GitHub Actions artifact. No browser runs on the user's laptop.
- Unit tests verify selection and form listeners are removed on close, in addition to checking that closed tools no longer react.

## Evidence

- RED: strict TypeScript caught a mismatch with the installed CDP protocol (`getProcessInfo` returns `processInfo`, not `processes`). The cleanup test also first asserted that a detached host erased its Shadow DOM subtree; that assertion was invalid because detached nodes retain their subtree.
- GREEN: use the protocol's `processInfo` field and assert host disconnection plus removal of each registered listener. Focused cleanup tests pass 10/10; full unit, lint, typecheck, and build pass locally without launching a browser.
- First remote run `41978951113`: the performance matrix passed and produced 15 samples (Chrome GPU process reported), but the E2E job failed while capturing the popup README image with `Page.captureScreenshot: Unable to capture screenshot`. Functional E2E scenarios 2/2 and performance E2E 1/1 passed. Explicitly foregrounding the popup did not fix it in run `41979318374`; this falsified the first hypothesis. A transient blank-page screenshot probe now separates general runner capture support from extension-origin capture; it does not save page data.
- Playwright is intentionally not run on the user's laptop.
