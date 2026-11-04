# FeedbackPin

A local-first Chrome MV3 extension for element-anchored visual bug reports.
Currently only the build and minimal extension page shells are implemented.
Selection, storage, screenshots, and report management follow in later plan tasks.

## Development

Use Node.js 24 LTS (minimum 22.12) and npm.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm run dev` previews extension page scaffolds only. Load `dist/` through
Chrome's **Extensions → Developer mode → Load unpacked** after a production build.
Rebuild and reload the extension after source changes.

`npm run check:build` validates generated manifest permissions and artifact paths.
`npm run build` includes this assertion. It fails if `dist/manifest.json` is absent.
Unit and E2E commands currently allow empty suites; no behavioral tests exist yet.
The E2E command builds the unpacked extension first; Task 7 will add local Chromium
extension fixtures and actual workflow tests without external services.

Runtime dependencies are React and React DOM, used only in extension pages.
The manifest requests only `activeTab` and `scripting`; it registers no content
scripts or host permissions. The service worker is currently inert.
