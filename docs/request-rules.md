# Request rules

Rules change requests from the browser without touching your backend. They are stored per workspace (desktop app) or on your device (Chrome extension).

## What a rule can do

| Action | Effect |
|---|---|
| **Mock** | Answer with a status code, content type and body you provide |
| **Delay** | Wait N milliseconds before the request continues |
| **Status** | Keep the real response but change its status code |
| **Redirect** | Send the request to another URL |
| **Headers** | Set or remove request headers |
| **Block** | Fail the request as if the network refused it |

A rule has a **URL pattern** (`*` matches anything; without `*` the pattern just has to appear in the URL) and an optional **method**.

## Safety

- Rules only run on pages whose host is on the rule's **allowed domains**. The default is `localhost`, `127.0.0.1` and `*.localhost`, so a forgotten rule cannot change traffic on a real site.
- While a rule is active the desktop app shows a badge in the address bar.
- Changed requests are marked on the timeline so you never wonder why a response looks different.

## Quick start

1. Make a request happen in your app.
2. In the timeline, select the request and choose **Mock this response** (the real body is copied so you can edit it).
3. Reload or trigger the request again; the page now sees your mock.

## Cross-origin writes

Mocking a cross-origin `POST`/`PUT` uses a small local server in the desktop app. The Chrome extension passes those requests through unchanged instead, because it has no local server.
