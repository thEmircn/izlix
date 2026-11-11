# Izlix (working name)

A **React-aware development browser** for macOS. See *why* something broke: a click, the request it fired, the response, the state change and the render that followed are drawn on **one timeline with cause arrows**, and any component, render, error or request opens its source file at the exact line in your editor.

> Status: **alpha**. Built with Electron 45 + React 19 + TypeScript. macOS only. Not signed, no auto-update (see [Limitations](#limitations)).

| Timeline with cause chain | Command palette | Apps hub |
|---|---|---|
| ![timeline](docs/screenshots/timeline.png) | ![palette](docs/screenshots/palette.png) | ![hub](docs/screenshots/hub.png) |

## What it does

**See**
- Unified Timeline: input → request → response → render → error on one axis. Each link is marked *certain* or *estimated*.
- React Inspector and Render Tracker (props/state/hooks, render count, time, reason), React 18 and 19.
- Own Network, Console, Elements, Sources (breakpoints, source maps), Storage, Performance, Coverage, Accessibility and SEO panels. Chrome DevTools can be embedded as well.
- State panel for Zustand and Redux stores.

**Find**
- Click-to-source: component, render, error or request → `file:line` in VS Code, Cursor or WebStorm.
- Workspaces with isolated cookies/storage, running dev servers detected in seconds.
- Command palette (⌘K), search across all tabs, session recorder with Playwright export and replay.

**Change**
- Request Rules per workspace: redirect, headers, JSON mock, latency, status code. Changed requests are badged on the timeline.
- Responsive Lab: up to 4 synchronized viewports, device/network/CPU/geolocation/media emulation.
- Bug report zip: timeline, HAR, screenshot, console, environment, Markdown summary. Tokens and cookies are masked.

**Everyday browser features**
Tabs and groups, vertical tabs, bookmarks, history, downloads manager, built-in password manager (macOS Keychain), private tabs and Tor tabs, ad/tracker blocker, HTTPS-only, malware and look-alike site warning, translate, reader mode, page notes, picture-in-picture, multi-window with shared tabs, optional encrypted iCloud Drive sync, and an Apps Hub (WhatsApp, Telegram, Meet, YouTrack, YouTube, Instagram) with unread counts.

## Run

```bash
npm install
npm run dev          # development (electron-vite)
npm test             # unit tests (vitest)
npm run typecheck
npm run pack         # unsigned .app in dist/
python3 tests/e2e/suite.py [name ...]   # end-to-end suite (real Electron, quiet mode)
```

`ELECTRON_RUN_AS_NODE` must not be set (the scripts clear it). Some e2e scripts expect a Vite + React 19 test app: set `DB_TESTAPP` to its folder and run it on `localhost:5173`.

## Architecture (short)

- `src/main`: windows/tabs, CDP collector, React bridge, event bus, correlator, source resolver, request interceptor, lab.
- `src/renderer`: shell UI (React + Zustand). Never talks to pages directly; everything goes through allow-listed, zod-validated IPC.
- `src/shared`: pure logic (rules, layout, search, masking, correlation helpers), unit tested.
- Pages run in sandboxed `WebContentsView`s with no preload. Details: [docs/PLAN.md](docs/PLAN.md) (Turkish product plan).

## Limitations

Please read before using it as your main browser.
- **No Google sign-in.** Google refuses sign-in in embedded Chromium browsers. Use another browser for Google accounts; the hub offers "open in default browser".
- **Unsigned, no auto-update.** Chromium security fixes arrive only when you update Electron yourself (`npm run update-electron`). The app checks and tells you.
- No extension store, passkeys or Widevine DRM (Netflix/Spotify web) with stock Electron.
- The malware/look-alike warning is **not** Google Safe Browsing: coverage is narrower.
- macOS only.

## Security

Pages are sandboxed and cannot reach IPC; permissions are denied by default; no telemetry unless you opt in; login requests are not recorded to the timeline. To report a vulnerability, open a private security advisory on GitHub.

## Türkçe özet

React geliştiricisi için macOS'ta çalışan, "hatanın sebebini tıklamadan render'a kadar tek zaman çizelgesinde gör, kaynağını tek tıkla editörde aç" diyen bir geliştirici tarayıcısı. Alfa sürüm. Google hesabı girişi, imzalı sürüm ve otomatik güncelleme yok. Ürün planı: [docs/PLAN.md](docs/PLAN.md).

## License

[Apache-2.0](LICENSE)
