# Getting started

Izlix shows what caused what in your web app: the click, the request it fired, the response and the render that followed, on one timeline.

## 1. Pick how to run it

| | What it is | Best for |
|---|---|---|
| **Izlix for Chrome** | An extension with a side panel | You want to keep using Chrome |
| **Izlix Browser** | A ready-to-run browser with the extension built in | You also want Google sign-in and a dedicated dev browser |
| **Desktop app** | The full Electron app with every panel | The deepest tooling (Elements, Sources, Storage, Lab...) |

Downloads: [Releases](https://github.com/thEmircn/izlix/releases). Builds are unsigned alpha builds, so your OS asks you to confirm the first launch.

## 2. See the chain

1. Start your app locally (for example `npm run dev`) and open it on `localhost`.
2. Open the Izlix panel (toolbar button in Chrome / Izlix Browser). The page reloads once so tracing can start from the first byte.
3. Click something in your app. A new column of dots appears: **input** (your click), **request**, **response** and **render**.
4. Click the last render dot. The **cause chain** below lists each step with the time between them.

Solid arrows are **exact** links (the click happened in the handler that started the request). Dashed arrows are **estimated** links (a response and the render that followed within a short window).

## 3. Open the source

Rows in the render table show `file:line`. Click one to open that file at that line in VS Code, Cursor or WebStorm (choose the editor in Settings of the desktop app). For Vite and Next.js dev servers this works without setup because Izlix reads your source maps.

## 4. Change a request without touching the backend

Right-click a request in the timeline (or open Request rules) and choose a rule: mock the response, add latency, change the status code or redirect. Changed requests carry a badge on the timeline. See [Request rules](request-rules.md).

## Frameworks

React 18 and 19 (full inspector and render reasons) and Vue 3 (components added and updated) are supported. Other frameworks still get the network, console and timeline parts.

## Privacy

Everything stays on your computer. See the [privacy policy](https://themircn.github.io/izlix/privacy.html).
