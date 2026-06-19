# Trail panel: local vs. remote surface alignment

**Status:** Architecture note + alignment target. Describes how the trail panel
is wired across surfaces today, where the local/remote behavior diverges, and
the contract we want every surface to follow.

**Related:** `panel-prop-convention.md`, `repository-panel-system.md`. Trails
of record: topic `topic-1781747284259-s26dwpuqp` ("Notes on inbox / published
trails (remote backend)").

---

## TL;DR

A trail can be **local** (authored here, persisted under `~/.principal/trails`)
or **remote/published** (received from web-ade, hydrated in memory only). The
same UI renders both, but the data source and the write backend differ. Today
each surface decides this **independently and inconsistently**: only one surface
(`SharedTrailTabContent`) routes anything to the remote backend, and even that
covers note *create* only. The goal of this doc is a single, explicit notion of
**trail origin** that deterministically drives both reads and writes, so every
surface behaves the same.

---

## The layered model

```
FileCityTrailExplorerPanel        @industry-theme/file-city-panel   ← generic renderer (also runs in web-ade)
   ▲ context (data, read)   ▲ actions (callbacks, write)
   │                        │
DESKTOP ADAPTERS  (supply context + service-backed actions)
   ├─ FileCityTrailPanel              dev-workspace wrapper; has the `remoteNotes` flag
   └─ FileCityTrailTabContent         Alexandria wrapper; mounts the explorer DIRECTLY, local-only
   ▲
TAB CONTENT  (per-tab container; owns data-loading lifecycle → context)
   ├─ SharedTrailTabContent           kind 'shared-trail'  → FileCityTrailPanel (remoteNotes)
   ├─ LocalTrailTabContent            kind 'local-trail'   → FileCityTrailTabContent
   └─ (TrailsView / DevWorkspace mount FileCityTrailPanel directly)
   ▲
VIEW + PanelFramework  (ProjectsView, TrailsView, …; left/middle/right zones, tab strip)
```

Two planes, split across two owners (see `panel-prop-convention.md`):

- **Read plane (`context`)** — the *TabContent* loads the trail payload + file
  tree + line counts and packs them into typed `DataSlice`s. This is where the
  **read** source (local disk vs `fetchSharedById`) is chosen.
- **Write plane (`actions`)** — the *adapter* (`FileCityTrailPanel` /
  `FileCityTrailTabContent`) implements the callbacks against services. This is
  where the **write** backend (`TrailNotesService` vs `TrailShareService`) is
  chosen.

> The read source and the write backend are selected in **different files**.
> That separation is the root cause of the current misalignment.

---

## Surface inventory (current state)

| Surface | Adapter mounted | Read source | Note create | Note edit/delete | Remote-aware |
|---|---|---|---|---|---|
| `SharedTrailTabContent` (`shared-trail`) | `FileCityTrailPanel` w/ `remoteNotes` | web-ade `fetchSharedById` | **web-ade** | **local (broken)** | partial |
| `LocalTrailTabContent` (`local-trail`) | → `FileCityTrailTabContent` | local disk | local | local | no |
| `FileCityTrailTabContent` (Alexandria) | `FileCityTrailExplorerPanel` directly | local disk | local | local | no |
| `TrailsView` | `FileCityTrailPanel` (no flag) | local library | local | local | no |
| `DevWorkspacePanelFramework` | `FileCityTrailPanel` (no flag) | local | local | local | no |
| web-ade (`TrailViewer`, `RepoTrailExplorerPage`, PR page) | `FileCityTrailExplorerPanel` | S3 payload | remote | remote | canonical remote |

Key code:

- `FileCityTrailPanel.tsx` — `remoteNotes` prop (`:107`), backend branch in
  `createTrailNote` (`:295`), local-only `updateTrailNote`/`deleteTrailNote`
  (`:316`, `:332`), optimistic `notesOverride` (`:188-221`).
- `SharedTrailTabContent.tsx` — `fetchSharedById` (`:318`), sets `remoteNotes`
  (`:277`), mounts panel with `actions={{}}` (`:271`).
- `FileCityTrailTabContent.tsx` — mounts explorer directly (`:398`), note CRUD
  hardwired to `TrailNotesService` (`:311-341`), its own `notesOverride` copy.
- Local write path: `TrailNotesService` → IPC → `trailStore` →
  `trailPersistence.applyToPayload` (requires the trail on disk).
- Remote write path: `TrailShareService.createSharedNote` → IPC
  `SHARED_NOTE_CREATE` → `trailShare.ts` → `POST {apiBase}/trails/by-id/{id}/notes`.

---

## Where the surfaces diverge (the misalignment)

1. **Two adapters, duplicated logic.** `FileCityTrailPanel` and
   `FileCityTrailTabContent` each build their own `trailActions` and their own
   optimistic `notesOverride`. Only `FileCityTrailPanel` has a remote branch.
2. **`remoteNotes` is create-only.** On a shared trail, `updateTrailNote` /
   `deleteTrailNote` still call the local `TrailNotesService`, which can't find
   the in-memory trail on disk → the local store throws → `TrailNotesService`
   swallows it → the edit/delete silently vanishes (same failure mode as the
   original create bug).
3. **Alexandria surface has no remote path at all.** If a shared/published
   trail is ever opened through `FileCityTrailTabContent`, *all* note ops hit
   the dead local path.
4. **Backend choice is an ad-hoc per-mount boolean.** `remoteNotes` is passed
   by hand at one call site. A new surface that forgets it silently gets the
   wrong (local) backend with no type-level nudge.
5. **Read/write can disagree.** Nothing ties "I read this from web-ade" to "I
   should write back to web-ade." They're set in separate files and can drift.

---

## Alignment target

**Principle:** A trail has exactly one **origin**, and origin — not a per-mount
boolean — decides both the read source and the write backend. Every surface
derives behavior from origin the same way.

1. **Model origin explicitly.** Represent it on the trail context, e.g.
   `origin: 'local' | 'remote'` (or richer: `{ kind: 'remote', owner, repo }`).
   `fetchSharedById` produces `remote`; the local library produces `local`.
2. **One backend abstraction.** Introduce a single `TrailNotesBackend` with
   `create` / `update` / `delete`, with a `local` impl (`TrailNotesService`) and
   a `remote` impl (`TrailShareService`). Select the impl from `origin` in one
   place — not per action, not per surface.
3. **Cover full CRUD uniformly.** The remote impl mirrors web-ade's existing
   `PATCH` / `DELETE` (`trails/by-id/[id]/notes/[noteId]/route.ts`), closing the
   create-only gap.
4. **Share the adapter glue.** Factor the `trailActions` builder + optimistic
   `notesOverride` into one hook (e.g. `useTrailPanelActions(origin)`) consumed
   by both `FileCityTrailPanel` and `FileCityTrailTabContent`, so the two
   adapters can't drift.
5. **web-ade is the reference.** Its `TrailViewer` already does full remote CRUD
   against the same explorer; desktop remote behavior should match it.

**Outcome:** opening a trail anywhere — projects tab, Alexandria, dev workspace,
TrailsView — produces identical note behavior for its origin, with no surface
able to silently fall back to the wrong backend.

---

## Action items (incremental)

- [x] Remote **create** for shared trails (`SharedTrailTabContent` + `remoteNotes`).
- [ ] Remote **edit/delete**: extend the `remoteNotes` branch to
      `updateTrailNote` / `deleteTrailNote`; add `updateSharedNote` /
      `deleteSharedNote` to the remote chain (service → IPC → `trailShare.ts`).
- [ ] Replace the `remoteNotes` boolean with an `origin`-derived backend.
- [ ] Extract the shared `trailActions` + optimistic-notes hook; adopt in both
      desktop adapters.
- [ ] Give `FileCityTrailTabContent` (Alexandria) the same origin-driven path so
      a shared trail opened there behaves correctly.
