# Report contract and local storage

Acceptance: new reports contain only approved text metadata, omit URL query/hash data and DOM text/attributes, persist locally, and support status changes and deletion; legacy image data remains readable until its report is deleted; storage failures are surfaced.

- RED: `npm test -- --reporter=dot` failed because `src/shared/report.ts` and `src/shared/db.ts` did not exist.
- GREEN: implemented validation, structural selectors, IndexedDB CRUD, and explicit connection close; all 6 focused tests pass.
- Follow-up evidence: the first green attempt exposed stale cached connections after test database deletion. `closeDatabase()` now closes the connection before cleanup. fake-indexeddb/jsdom returns a plain object for a cloned Blob, so this unit suite verifies image presence; Chromium E2E must verify the actual stored image payload.
- Verification: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

## Text-only report write boundary

- RED: a DB regression test failed because `addReport()` persisted a synthetic screenshot Blob.
- GREEN: new-report types and creation now omit both image fields; a seeded legacy IndexedDB report still reads and updates its image, then deletes normally. The focused DB suite passes 3/3, full unit suite 33/33, lint, typecheck, and build pass locally. Remote run `41984496619` passed all five loaded-extension E2E scenarios after this fix; no local browser was run.
