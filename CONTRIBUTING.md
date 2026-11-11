# Contributing to Izlix

Thanks for helping! Small, focused pull requests are easiest to review.

## Getting started

```bash
npm install
npm run dev          # desktop app (electron-vite)
npm test             # unit tests
npm run typecheck && npm run typecheck:ext
npm run test:ext     # Chrome extension end-to-end (needs Chrome for Testing; set CHROME_BIN)
```

## Guidelines

- **Core stays portable.** Code under `src/core` and `src/shared` must not import `electron`, `node:*` or touch `process`/`Buffer` (a test enforces this). Put platform code in `src/main` or `packages/extension`.
- Add or update tests with your change. UI changes: include a screenshot.
- Commit messages: a short English summary line; a second line in Turkish is welcome but optional for outside contributors.
- By contributing you agree that your work is licensed under Apache-2.0.

## Good first issues

Look for the `good first issue` label. Translations (`src/shared/i18n.ts`) and new framework adapters are great starting points.
