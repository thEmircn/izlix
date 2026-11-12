# Chrome Web Store listing (draft)

**Name:** Izlix: see why your React app broke

**Short description (132 characters max):**
One timeline from click to render with cause arrows. Mock requests, open the source in your editor. Local-first.

**Description**
Izlix shows what caused what in your web app. Click something and watch the click, the request it fired, the response and the render that followed appear on one timeline, with arrows between them (exact links are solid, estimated links are dashed).

- Unified timeline: input, request, response, render and error on one axis
- React render tracker: which component rendered, why, and what changed
- Network and console panels in the same view
- Request rules: mock a response, add latency, change a status code or redirect a request on a tab you chose
- Click to source: open the exact file and line in VS Code, Cursor or WebStorm

Privacy: everything is processed on your computer and kept in memory for the tab you open. Nothing about you or your pages is sent anywhere. See the privacy policy: https://themircn.github.io/izlix/privacy.html

Open source (Apache-2.0): https://github.com/thEmircn/izlix

**Single purpose:** Help web developers understand and debug what caused a page's network requests and renders.

**Permission justifications**
- `debugger`: attaches to the single tab the user opens the panel for, to read network, console and render events and to apply the user's request rules.
- `tabs`: reads the active tab's id and address to know which tab the panel shows.
- `sidePanel`: shows the timeline in Chrome's side panel.
- `storage`: saves the user's request rules and the update-check result on the device.
- `alarms`: schedules the once-a-day update check.
- Host access to `localhost` and `127.0.0.1`: resolves source maps of local development pages. Other sites only if the user grants access.
- Host access to `api.github.com/repos/thEmircn/izlix/releases`: the daily check for a newer extension version (public release list; no user data).

**Category:** Developer Tools
