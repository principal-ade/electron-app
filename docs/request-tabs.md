# Prepared HTTP request tabs

Agents can prepare requests in the focused Principal **MAIN** window with
`POST /api/requests/open`. Opening or reopening never sends a request. The user
reviews and edits the definition, then clicks **Send** to see the response.
There is no agent send or response-capture endpoint.

Use the intended build's bridge, production `3044` or development `3054`.
For example, against development:

```sh
curl http://localhost:3054/api/requests/open \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Create a widget",
    "request": {
      "http": { "method": "POST", "url": "http://localhost:3000/widgets" },
      "headers": [
        { "name": "Accept", "value": "application/json", "enabled": true }
      ],
      "body": { "json": "{\"name\":\"Example\"}" },
      "auth": { "mode": "bearer", "bearer": { "token": "{{token}}" } }
    },
    "environment": { "token": "replace-in-the-editor-before-sending" },
    "repositoryPath": "/absolute/path/to/caller-repo",
    "target": {
      "purl": "pkg:github/acme/backend",
      "identifier": "container:api"
    }
  }'
```

`request` is a Bruno request definition. `title`, `environment`,
`repositoryPath`, and `target` are optional. `title` defaults to `HTTP request`.
Definitions are limited to 2 million characters. Unknown fields, scripts,
tests, responses, and auto-send options are rejected.

Supported fields:

- `http`: `method`, `url`, optional body-format hint `body`.
- `headers`: `{ name, value, enabled }[]`.
- `params`: `{ name, value, enabled, type: "query" | "path" }[]`. Path parameters
  replace `:name` tokens and are URL-encoded.
- `body`: exactly one of `json`, `text`, `xml` (strings), `formUrlEncoded`
  (`{ name, value, enabled }[]`), or `multipartForm` (the same entries plus
  `type: "text" | "file"`). Multipart definitions can be edited and pinned,
  but sending multipart/file uploads is not supported and shows an error.
- `auth`: `{ mode: "none" }`, `{ mode: "basic", basic: { username, password } }`,
  or `{ mode: "bearer", bearer: { token } }`.
- Optional `meta`: `{ name, type, seq? }`.

Only HTTP/HTTPS requests can be sent. Explicit `environment` values replace
`{{variable}}` in URLs, parameter values, headers, bodies, and authentication.
No scripts or inherited process environment are evaluated. Non-2xx responses
are displayed normally; network failures are shown in the response area.

The endpoint returns `{ success: true, opened: true, tabId }` only after the
renderer commits the tab. This is not a successful network response.
Without a focused MAIN window, `opened` is false with reason
`no-focused-request-host`. A missing acknowledgement after three seconds gives
`request-host-unavailable`. The endpoint does not create or focus a window.
Requests with `Origin` or `Sec-Fetch-Site` headers are rejected with `403`.
Use `GET /routes` and `POST /routes` for the running build's contract.

## Remembered routes and favorites

Select **Requests** in the navigation sidebar for a dedicated left panel of
remembered routes, including closed, unpinned requests. Preparing a valid request
automatically retains its definition, even without Send or a focused MAIN window.
The same requests remain reachable from Home's
**Requests** section. Both group by **target PURL → identifier → requests**.
The Requests panel previews each method and URL origin/path, without URL
credentials or query values.
Use the filter bar to find routes by title, method, endpoint preview, or target.
Refresh reloads the catalog without opening or sending a request.
Requests without a target appear under
**Ungrouped**, including older pins. Open edits take precedence over the saved
group while a tab is open. Switching tabs preserves edits and responses.
Switching side panels also preserves the shared tabs and responses. Opening
a prepared request through the bridge reveals the Requests surface; it does
not send the request.

`target` is optional, unverified UI metadata:

```ts
target?: { purl: string; identifier: string };
```

Both strings are trimmed and must be non-empty when a target is supplied.
The PURL is limited to 1000 characters and the identifier to 200. Neither is
resolved or verified: no PURL syntax, repository registration, C4 element
existence, composition, process, or Portless lookup is required. The identifier
can be a container/component name or ID; prefixes such as `container:` and
`component:` are optional conventions. Grouping uses exact, case-sensitive
strings after trimming. Renaming an identifier changes its group.

Expand **Request group** in a request tab to edit the two fields and click
**Apply group**, or **Clear group** to return to Ungrouped. These changes never
alter the request URL, authorize anything, or send a request. `repositoryPath`
still describes the originating repository, independently of the target.

This is a route catalog, not an execution log. Preparing a route again updates
its definition and reuses its entry and favorite state. Identity is the exact
target pair (or Ungrouped), case-insensitive HTTP method, and URL origin/path.
Query strings, fragments, parameter values, headers, bodies, credentials,
environment overrides, title, and caller repository do not create extra rows.
Different methods, origins (including ports), paths, or target pairs remain
separate. URL templates stay literal and are not resolved using the environment
for catalog identity. No route pattern is inferred: `/users/42` and `/users/43`
are separate; prepare `/users/:id` with path parameters to reuse one route.

Pin a request from its toolbar, Requests panel, or Home to mark it as a favorite.
Unpinning only removes that favorite status, not the remembered definition.
Reopening restores the editable definition with no response and never sends.
If the route is already open, preparing or reopening focuses its tab without
discarding current edits or its in-memory response. Closing and reopening uses
the latest retained definition.

After editing a remembered request, including its target group, click **Save
changes** to update its definition, whether pinned or not. This does not change
favorite status. An explicit edit keeps the entry's ID; saving an edit that would
collide with another remembered route is rejected rather than overwriting it.
Closing without saving restores the last retained definition.

Definitions, including target metadata, environment overrides, and credentials, are
encrypted using Electron's OS-backed `safeStorage` in
`userData/pinned-http-requests.enc`.
Existing encrypted pins migrate in place as favorites, preserving their IDs and
definitions. There is no plaintext fallback. The prepare endpoint returns `503`
instead of opening an unremembered request when secure persistence fails.
Other storage failures are visible in the request tab, Requests panel, and Home.
Responses and send history are never persisted.

The catalog holds up to 1000 entries and never silently evicts routes. In the
Requests panel, **Forget** removes a retained definition without closing any
open tab; unpin a favorite first. Preparing that route again remembers it again.
