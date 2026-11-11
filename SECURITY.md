# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting instead:
**Security tab → "Report a vulnerability"** on this repository.

What helps: affected version/commit, steps to reproduce, impact, and (if you have one) a suggested fix.
You can expect an acknowledgement within 72 hours. We aim to fix confirmed issues quickly and will credit you in the release notes if you wish.

## Scope

In scope: the desktop app (`src/`), the Chrome extension (`packages/extension`), build and release workflows.
Out of scope: vulnerabilities in third-party sites you browse, in Chromium/Electron themselves (report those upstream), and social-engineering attacks.

## Design notes

- Web pages run in sandboxed views with no preload script and cannot reach the app's IPC.
- IPC messages are allow-listed and validated; the platform-neutral core (`src/core`, `src/shared`) cannot import Node or Electron APIs (enforced by a test).
- Sign-in requests are not recorded on the timeline, and exports mask tokens and cookies.
- The Chrome extension only attaches to tabs the user explicitly enables, and "open in editor" accepts only known, absolute source paths from local development pages.
