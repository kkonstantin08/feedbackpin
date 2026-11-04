# MV3 scaffold check

Acceptance: the production manifest is MV3, requests only `activeTab` and `scripting`, registers no page scripts or host permissions, and points only to built artifacts.

- RED: `node scripts/check-build.mjs` before build failed with `ENOENT` for `dist/manifest.json`.
- GREEN: `npm run build` created the package and the same assertion passed.
- Verification: `npm run lint`, `npm run typecheck`, `npm test` (no behavior suite yet), and `npm run build` passed. The empty unit-suite result is temporary; behavior tests begin with storage.
