# Changelog

All notable changes to Izlix are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Izlix UI component package (`packages/ui`): Button, Switch, Chip, Field, Dialog, PromptDialog, Segmented, with a gallery.
- Visual regression test with baselines for nine screens.
- Third-party notices (`THIRD_PARTY_NOTICES.md`) generated from the dependency tree.

### Changed
- Design tokens and motion preferences moved into one file; "reduce motion" is respected.
- Every legacy button now uses the new button look and press behavior.

## [0.1.0-alpha.1] - 2026-11-11

### Added
- **Izlix for Chrome** (alpha): timeline with cause arrows, network, console, render tracker, request rules and click-to-source in a side panel.
- **Izlix Browser** (alpha): repackaged ungoogled-chromium with the extension preinstalled, for macOS (Apple Silicon), Windows and Linux. Google sign-in works.
- Platform-neutral core (`src/core`) shared by the desktop app and the extension.
- Apps hub (WhatsApp, Telegram, Meet, YouTrack, YouTube, Instagram) with unread counts.
- Malware and look-alike site warning, update check, optional end-to-end encrypted iCloud Drive sync.
- Continuous integration on macOS, Windows and Linux, CodeQL scanning, security policy.

### Security
- Sign-in requests are no longer recorded on the timeline.
- "Open in editor" accepts only known, absolute source paths from local development pages.
