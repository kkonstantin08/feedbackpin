# Report contract and local storage

Acceptance: reports contain only approved fields, omit URL query/hash data and DOM text/attributes, persist locally with optional image data, support status changes and deletion, and surface storage failures.

- RED: `npm test -- --reporter=dot` failed because `src/shared/report.ts` and `src/shared/db.ts` did not exist.
- GREEN: implemented validation, structural selectors, IndexedDB CRUD, and explicit connection close; all 6 focused tests pass.
- Follow-up evidence: the first green attempt exposed stale cached connections after test database deletion. `closeDatabase()` now closes the connection before cleanup. fake-indexeddb/jsdom returns a plain object for a cloned Blob, so this unit suite verifies image presence; Chromium E2E must verify the actual stored image payload.
- Verification: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
