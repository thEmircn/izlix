# Changelog

All notable changes to Izlix are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0-alpha.2] - 2026-11-12

### Added
- Unread badge for the apps hub on Windows (taskbar overlay dot) and Linux (launcher badge), not only the macOS dock.
- Choose any folder for encrypted sync (iCloud Drive, Dropbox, OneDrive, Google Drive, Syncthing), not only iCloud Drive.
- Izlix UI component package (`packages/ui`): Button, Switch, Chip, Field, Dialog, PromptDialog, Segmented, with a gallery.
- Chrome extension checks the public GitHub release list once a day and shows an update notice in the panel.
- Visual regression test with baselines for nine screens.
- Third-party notices (`THIRD_PARTY_NOTICES.md`) generated from the dependency tree, shipped inside the browser bundles.
- Project website and component gallery on GitHub Pages.
- Desktop app packages for macOS, Windows and Linux built in CI (unsigned), published on `desktop-v*` tags.
- Read aloud now works on Windows (PowerShell speech) and Linux (espeak-ng, espeak or spd-say), not only on macOS.

### Changed
- Windows and Linux: keyboard shortcut labels show "Ctrl+Shift+F" instead of macOS symbols, and the tab strip no longer reserves space for macOS window buttons.
- Chrome extension: the toolbar button opens the side panel natively, tracing starts when the panel opens, and the panel follows the active tab.
- The macOS browser bundle is named and iconified as Izlix; the Linux bundle includes a desktop entry.
- Design tokens and motion preferences live in one file; "reduce motion" is respected.
- Every legacy button uses the new button look and press behavior.

### Security
- Linux: passwords are not saved when only a weak keystore (plain-text backend) is available; Settings explains how to enable a system keyring.

## [0.1.0-alpha.1] - 2026-11-11

### Added
- **Izlix for Chrome** (alpha): timeline with cause arrows, network, console, render tracker, request rules and click-to-source in a side panel.
- **Izlix Browser** (alpha): repackaged ungoogled-chromium with the extension preinstalled, for macOS (Apple Silicon), Windows and Linux. Google sign-in works.
- Platform-neutral core (`src/core`) shared by the desktop app and the extension.
- Apps hub (WhatsApp, Telegram, Meet, YouTrack, YouTube, Instagram) with unread counts.
- Malware and look-alike site warning, update check, optional end-to-end encrypted iCloud Drive sync.
- Continuous integration on macOS, Windows and Linux, CodeQL scanning, security policy.

### Security
- Linux: passwords are no longer saved when only a weak keystore (plain-text backend) is available; Settings explains how to enable a system keyring.
- Sign-in requests are no longer recorded on the timeline.
- "Open in editor" accepts only known, absolute source paths from local development pages.
