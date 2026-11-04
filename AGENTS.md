# FeedbackPin agent guide

## Goal
Build a small local-first Chrome MV3 extension for element-anchored visual bug reports. The browser must remain idle until the user starts selection.

## Stack and architecture
Use strict TypeScript, React only in extension pages, Vite, MV3, Chrome APIs, DOM APIs, Vitest/Testing Library, and Playwright. Inject a small content script only after an explicit toolbar action. Keep the service worker event-driven; use IndexedDB for local report data and screenshot blobs. No backend, external analytics, broad host permissions, persistent page scripts, polling, or global observers.

## Product and visual rules
Keep the approved Userback-inspired product-shell direction documented in `docs/research/design-reference-directions.md` and `docs/specs/feedbackpin-mvp.md`. Do not change it without user approval. Keep the on-page selector visually quiet. Local-first and privacy-first; never store typed field values.

## Implementation rules
- Read the relevant spec and plan before changing behavior.
- Use Superpowers brainstorming for design changes, writing-plans before implementation, TDD (RED → GREEN → REFACTOR), systematic-debugging for failures, verification-before-completion, and code review.
- Use Ponytail to remove unnecessary code/dependencies without weakening correctness, accessibility, privacy, or tests.
- Add acceptance criteria and short RED/GREEN evidence for significant features under `docs/tdd/`.
- Use English Conventional Commit messages, one logical change per commit.
- Preserve keyboard use, visible focus, Escape cancellation, error states, and cleanup of temporary page resources.
- Do not request permissions or add dependencies without a concrete need documented in the plan.

## Commands
Expected project commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`. Keep these commands accurate in `package.json` and README as the project is created.

## Completion and audit
A change is complete only when its acceptance criteria pass, relevant tests pass, and docs reflect actual behavior. Before release, measure performance in real Chromium/Chrome and record reproducible results in `docs/performance.md`; run the independent GPT-6 Luna High audit and record it in `docs/audits/final-gpt6-luna-high.md`. Never claim checks or publication that did not happen.
