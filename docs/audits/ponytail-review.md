# Ponytail review

What this change does: FeedbackPin injects its selector only after the popup action and stores text-only local reports in IndexedDB. Screenshot capture is disabled by the user's privacy decision. React is limited to the popup and dashboard; the injected selector is a standalone bundle.

**Must fix:**

1. **Screenshot privacy is not release-verified** (`src/content/overlay.ts:75-101`, `docs/performance.md:3-10`)
   - **What this is:** Visible fields and frames are covered by full-width horizontal masks before an optional screenshot is saved.
   - **Problem:** Unit tests check the mask rectangles, but do not prove that Chrome's captured bitmap aligns with those rows. The previous browser assertion sampled the wrong horizontal pixel and missed a real leak.
   - **Fix:** Keep screenshots out of release evidence until an approved, low-load Chromium run checks pixels inside the sensitive field after the current mask change.
   - **If we skip it:** A screenshot may still expose page input values.

2. **Browser performance has no measurements** (`docs/performance.md:30-42`)
   - **What this is:** The release requires CPU, memory, startup latency, long-task, and cleanup measurements across inactive and active states.
   - **Problem:** The only available evidence is static manifest inspection and bundle sizes; the requested runtime states have not been measured.
   - **Fix:** Run the documented sequential measurement matrix only after the user permits browser work.
   - **If we skip it:** The project cannot substantiate its core low-impact requirement.

**Not checked:** Loaded-extension E2E after the mask correction, real Chrome screenshot pixels, CPU/memory, long tasks, and UI behavior in narrow windows. No browser was started for this review.

Verdict: Fix 1 and 2 before release.

## Follow-up

The dashboard storage estimate is implemented, and its success, failure, listing, and deletion behavior have unit coverage. Sensitive controls in open ShadowRoots are masked; screenshots are refused for custom elements with no exposed shadow root, preserving text-only notes.

**Resolved by product decision:** A closed ShadowRoot attached to a standard HTML element remains undetectable after on-demand injection. The user chose to disable screenshots; the capture message, Chrome capture handler, image processing, and capture UI are removed. Unexpected image payloads are dropped before report persistence.

**Not checked:** Screenshot redaction is out of scope because screenshot capture is disabled. Impact on the user's laptop and extended real-world sessions remain unmeasured. GitHub Actions run `41988254350` passed all six loaded-extension E2E scenarios on a remote runner, including dashboard overflow at 390 px. The performance report records hosted-runner CPU/RSS, task, startup and cleanup measurements.

Verdict: Text-only privacy path is implemented. Remote CI performance measurements support the idle/active runtime claims only for the recorded hosted-runner conditions; they do not establish the same impact on the user's hardware.

## UI redesign follow-up — 2026-11-06

What this change does: The dashboard now presents reports as a compact inbox with a readable detail view and page context. The popup and dashboard share one product identity, and each report row shows its state in text as well as color.

Looks good. Ship. The change reuses the existing React page and CSS Modules, adds no dependencies, and retains the current data flow. Focused tests verify visible Open/Resolved labels; remote run `42182300358` passed lint, typecheck, all 35 unit tests, six loaded-extension E2E cases, and production build. The 390 px screenshot was inspected and has no horizontal overflow.

Not checked: Resource use on the user's laptop; hosted-runner process totals are not a laptop measurement.
