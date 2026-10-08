# Trail Panel Mounts — Audit Notes

_Last updated: 2026-06-04_

Tracking how the File City trail explorer is mounted across the app, two open
concerns surfaced while fixing the "added note doesn't show until reload" bug,
and follow-up items to audit later.

## Background: the note-visibility bug (fixed)

The upstream `FileCityTrailExplorerPanel` (`@industry-theme/file-city-panel`)
renders trail notes **purely** from `trail.notes` — it does no local merging.
Our IPC note handlers (`TrailNotesService.create/update/remove`) persist to disk
but **do not** re-broadcast `PAYLOAD_SET` (this is by design — see
`src/main/file-city/trailStore.ts`, whose store methods return rich values so IPC
callers update their own state). Result: a freshly added note never makes it back
into the panel's props, so it only appears after the trail is reloaded from disk.

The fix is an optimistic `notesOverride` local-state pattern, keyed by trail id:
apply the returned note to local state on create/update/delete and merge it into
the payload handed to the panel.

> Note: this is per-window optimistic state only. A note added in one window
> still won't live-update a _different_ already-open window viewing the same
> trail. True cross-window sync would require the IPC `createNote`/`updateNote`/
> `deleteNote` handlers to broadcast `PAYLOAD_SET` like the HTTP routes do.

## Mount inventory

There are **two** components that mount the upstream panel directly and wire
note CRUD. Everything else reuses the dev-workspace wrapper.

| # | File | Mounts | Note CRUD source | Optimistic fix |
|---|------|--------|------------------|----------------|
| 1 | `src/renderer/dev-workspace/file-city-trail-panel/FileCityTrailPanel.tsx` | upstream `FileCityTrailExplorerPanel` | builds `trailActions` internally | ✅ has fix |
| 2 | `src/renderer/projects-view/file-city-trail-tab/FileCityTrailTabContent.tsx` | upstream `FileCityTrailExplorerPanel` | builds `trailActions` internally | ✅ has fix |
| 3 | `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx:547` | the wrapper (`FileCityTrailPanel`) | inherits from wrapper | ✅ inherits |
| 4 | `src/renderer/principal-window/views/TrailsView/TrailsView.tsx:385` | the wrapper (`FileCityTrailPanel`) | inherits from wrapper | ✅ inherits |
| 5 | `src/renderer/feed-view/SharedTrailTabContent.tsx:235` | the wrapper (`FileCityTrailPanel`) | inherits from wrapper | ✅ inherits |

`SharedTrailViewer` (the component in `SharedTrailTabContent.tsx`) is itself
mounted in two places, both inheriting whatever the wrapper provides:
- `src/renderer/inbox-view/TopicTabContent.tsx:515`
- `src/renderer/feed-view/SharedTrailTabContent.tsx:331`

Because rows 3–5 all go through the single wrapper, the optimistic fix landing in
`FileCityTrailPanel.tsx` covers them automatically.

## Concern 1 — "read-only" mounts may not actually be read-only

Rows 3–5 pass `actions={{}}` (TrailsView, SharedTrail) or the generic
panel-framework `actions={actions}` (DevWorkspacePanelFramework) into
`FileCityTrailPanel`, **presumably intending those views to be read-only**:

- Recent-trail preview pane (`TrailsView`)
- Shared / published trail viewer (`SharedTrailTabContent`, reached from feed + inbox)

**But `FileCityTrailPanel` never destructures the incoming `actions` prop.** It
always builds its own `trailActions` (with live `createTrailNote` /
`updateTrailNote` / `deleteTrailNote`) and passes those to the upstream panel.
So note create/edit/delete is actually live in those preview/shared views — and,
after the fix, optimistically updates there too.

### To audit / decide
- [ ] Are TrailsView preview and SharedTrail viewer _meant_ to allow note editing?
- [ ] If not: give `FileCityTrailPanel` a way to suppress CRUD (e.g. a
      `readOnly`/`disableNotes` prop, or actually honor the passed-in `actions`)
      instead of unconditionally building `trailActions`.
- [ ] The `actions` prop on `FileCityTrailPanelProps` is currently dead (declared,
      never read). Either wire it or remove it to avoid the false impression that
      passing `actions={{}}` disables anything.

## Concern 2 — two near-identical trail components (`TabContent` vs `Panel`)

`FileCityTrailTabContent.tsx` (topic tab) and `FileCityTrailPanel.tsx`
(Dev Workspace wrapper) do substantially the same job — mount the upstream panel,
supply `fileTree` / `lineCounts` / `trail` slices, wire note CRUD, handle close /
share — and now carry duplicate copies of the `notesOverride` optimistic logic.

Key differences observed:
- **Input shape:** `TabContent` takes a `trailPayload` prop directly and fetches
  its own `fileTree`/`lineCounts`. `Panel` reads everything from a
  `context.trail` DataSlice supplied by `RepositoryPanelProvider`.
- **Share UX:** `TabContent` owns a `TrailShareModal`; `Panel` delegates via an
  `onShareTrail` callback.

These are real differences, but the overlap (slice plumbing + note CRUD +
optimistic override) is the part that drifts out of sync — this bug existed in
`Panel` precisely because the fix had only been applied to `TabContent`.

### To audit / decide
- [ ] Extract the shared note-CRUD + `notesOverride` logic into a hook
      (e.g. `useTrailNotesOptimistic(baseTrail)`) so both mounts share one
      implementation and can't drift again.
- [ ] Consider whether the two components can be unified behind one component
      that accepts either a payload or a slice, leaving only the input-adapter
      and share-UX differences at the edges.
