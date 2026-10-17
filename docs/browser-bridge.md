# Localhost browser tabs

The Principal bridge accepts `POST /api/browser/open`. It targets an
already-focused Principal window, reveals its workspace, and waits up to three
seconds for the renderer to acknowledge a committed tab. It does not open or
focus another window, start a server, or support the Dev Workspace window.

Open a managed process at its current port:

```sh
curl http://localhost:3044/api/browser/open \
  -H 'Content-Type: application/json' \
  -d '{"processId":"<managed-process-id>","path":"/docs?mode=preview#intro"}'
```

Or open a localhost URL:

```sh
curl http://localhost:3044/api/browser/open \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://localhost:5173/docs","label":"Preview"}'
```

Supply exactly one of `processId` and `url`. `path` is only accepted with
`processId`; it defaults to `/`. URLs must use HTTP, the literal `localhost`
hostname, and an explicit port from 1 through 65535, without credentials.
Requests carrying an `Origin` or `Sec-Fetch-Site` header are rejected. This is a
local agent API, not a browser-page API.

A successful response looks like:

```json
{
  "success": true,
  "opened": true,
  "tabId": "localhost-browser-process-<id>",
  "processId": "<id>"
}
```

`opened` means the tab state committed, not that the server answered or its
page loaded. With no capable focused window or no renderer acknowledgement,
the response has `opened: false` and a `reason`. Invalid requests return 400;
unknown managed processes return 404; stopped processes or processes without
a known port return 409. Start/restart the server separately and retry after
it reports its port.

## Process ownership

- Managed tabs are keyed by the registry's process ID, never the OS PID or
  current port. The Processes panel and the bridge share this opening path.
- URL opens associate with a managed process only when exactly one running
  registry entry matches the port. Otherwise, the tab is keyed by localhost
  origin. Detected external servers are not managed-process associations.
- Reopening a tab updates its path and reloads its browser panel, including for
  an identical URL. Explicit opens reset browser navigation history.
- Linked tabs follow status, run count, and port updates even when the
  Processes view is not visible. Restart clears the old registry port so a
  tab waits for the new run to report its port.
- A stopped, failed, restarting, or removed process leaves the tab open with
  an unavailable message. It does not leave a webview pointed at a stale port.
- Logs, Stop, and Restart are explicit controls on a linked tab. Closing the
  tab only closes the preview; it never kills the process.

The browser panel is the existing `@industry-theme/localhost-panels` webview.
URL validation restricts the opening request, not redirects or subsequent
in-page navigation. This change does not harden that panel's existing webview
preferences or turn it into a general-purpose secure browser.

## Validation

Run `npm run test:browser-bridge` for the bridge, process lifecycle, tab state,
and React integration tests without building Electron bundles first.
