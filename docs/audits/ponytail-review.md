# Ponytail review

What this change does: FeedbackPin injects its selector only after the popup action, captures a visible screenshot only after an explicit request, and stores local reports in IndexedDB. React is limited to the popup and dashboard; the injected selector is a standalone bundle.

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
