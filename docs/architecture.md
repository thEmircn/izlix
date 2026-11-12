# Architecture

Izlix has one platform-neutral core and several hosts that run it.

```
src/core      collector, event bus, correlator, request interceptor, source resolver, framework bridges (no Node, no Electron)
src/shared    pure logic: rules, search, masking, versions, i18n...
src/main      Electron host: windows, tabs, IPC, storage, native features
src/renderer  the desktop shell UI (React + Zustand)
packages/extension  Chrome extension host (MV3): background service worker + side panel
packages/ui         UI kit (CSS Modules): Button, Switch, Dialog, ...
```

## The core

Everything talks to the page through the Chrome DevTools Protocol (CDP). The core only knows the small `CdpClient` interface (`send`, `onEvent`, `detach`). The Electron app implements it with `webContents.debugger`; the Chrome extension implements it with `chrome.debugger`. A test (`src/core/boundary.test.ts`) fails if `src/core` or `src/shared` imports Electron, Node or the app shell, so the same code keeps running everywhere.

## Events and cause links

The collector turns CDP events and bridge messages into typed events on one bus: `input`, `request`, `response`, `render`, `console`, `error`, `navigation`, `hmr`. Each event can carry links to its causes:

- input to request: **exact** (the request started inside the input's handler)
- request to response: **exact** (same request id)
- response to render: **estimated** (time window)
- render to error: **exact** when the error's component rendered in that commit

## Framework bridges

A bridge is a script injected before the page runs. It reports component renders as `commit` messages through a CDP binding. The React bridge installs a lightweight devtools hook; the Vue bridge implements Vue's devtools hook. Both share the input and request tracking. Add a framework by writing an adapter in `src/core/adapters.ts`.

## Security boundaries

- Web pages run in sandboxed views with no preload script and cannot reach the app's IPC.
- IPC messages are allow-listed and validated with zod.
- Sign-in requests are not recorded; exports mask tokens and cookies.
- "Open in editor" only accepts absolute, known source paths from local development pages.

## Tests

- Unit tests: `npm test`.
- End-to-end: `python3 tests/e2e/suite.py [name...]` drives a real Electron app in quiet mode. `npm run test:ext` drives the Chrome extension in Chrome for Testing.
- Visual regression: `tests/e2e/visual.cjs` compares nine screens with committed baselines (per platform).
- CI runs unit tests, builds, desktop smoke tests (macOS, Windows, Linux), the extension test and CodeQL on every change.
