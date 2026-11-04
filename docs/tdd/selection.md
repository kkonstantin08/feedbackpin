# On-demand page selection

Acceptance: hover highlights one hit-tested element without mutating it; click selects once; Escape and explicit cancel remove the temporary host and all three listeners; duplicate sessions are rejected.

- RED: focused Vitest suite failed to resolve `src/content/selector.ts`.
- GREEN: Shadow DOM host, hit-tested highlight, click selection, cancel, and idempotent cleanup are implemented; all 9 unit tests pass.
- Environment note: jsdom omits `document.elementFromPoint`; the focused unit fixture supplies it. Loaded-extension E2E remains required for real Chromium behavior.
- Verification: `npm test`, `npm run typecheck`, and `npm run lint` pass.
