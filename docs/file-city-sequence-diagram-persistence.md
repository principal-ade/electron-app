# File City Sequence Diagram Persistence

This document describes how to persist sequence-diagram payloads pushed to the [File City sequence-diagram overlay](file-city-sequence-diagram-overlay.md) so users can reopen, switch between, and delete past payloads instead of losing them on app restart or when the next payload arrives.

It supersedes the "Persisting payloads across app restarts" non-goal in the original overlay doc.

## Background

Today, payloads delivered to `POST /api/file-city/sequence` live in a single in-memory `Map<repositoryPath, SequenceDiagramPayload>` (`src/main/file-city/sequenceDiagramStore.ts:23`). Implications:

- Restarting the app drops every payload.
- Posting a new payload for the same repo overwrites the previous one with no way to recover it.
- The overlay has no concept of "saved diagrams" — `clear` is the only management primitive.

External tools (agents, MCP, CLI) that emit walkthroughs (especially `kind: 'diff'` review walkthroughs) treat each post as a one-shot artifact. Users have asked to keep them around so they can step away and come back, or curate a small set per repo.

## Goals

- Persist payloads across app restarts.
- Support multiple saved payloads per repository, not just the latest.
- Provide a dedicated **left-sidebar panel** in the dev workspace window for browsing, activating, and deleting saved payloads — independent of whether the File City panel is currently open.
- Keep the existing `POST /api/file-city/sequence` semantics (post → instantly active) so external callers don't change.
- Track which payload is currently *active* (visible in the panel) separately from the *library* of saved payloads.

## Non-goals

- Cross-machine sync of saved payloads.
- Authoring or editing payloads inside the app.
- Folder/tag organization within a repo's library.
- Sharing payloads between repositories.
- Versioning or history within a single payload's lifetime — replacing a payload by id overwrites it.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                          External Caller                            │
│                  (agent, CLI, browser, MCP tool)                    │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTP POST /api/file-city/sequence
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                  SequenceDiagramStore (main)                        │
│  - Assigns id, persists payload JSON to disk                        │
│  - Updates index.json manifest                                      │
│  - Marks the new payload active for its repository                  │
│  - Broadcasts PAYLOAD_SET via webContents.send(...)                 │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ IPC: file-city:sequence-diagram:*
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│              Dev Workspace Window (renderer)                        │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │ Left Sidebar Panel   │    │ File City Panel (existing)       │   │
│  │ "Sequence Diagrams"  │    │  useSequenceDiagram subscribes   │   │
│  │                      │    │  to PAYLOAD_SET / PAYLOAD_CLEARED │   │
│  │ - Lists saved        │    │                                  │   │
│  │   payloads per repo  │───▶│  Renders the active payload      │   │
│  │ - Active row badged  │    │  as bottom drawer + overlays     │   │
│  │ - Click → activate   │    │  (no UI changes here)            │   │
│  │ - Trash → delete     │    │                                  │   │
│  └──────────────────────┘    └──────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

## Storage Layout

Mirrors `excalidraw-storage.md` so the precedent is consistent.

- **Base directory:** `path.join(app.getPath('userData'), 'file-city-sequence-diagrams')`
- **Manifest:** `<base>/index.json`
- **Per-repo subdirectory:** `<base>/<projectHash>/` where `projectHash = md5(repositoryPath)`. Reuse the existing `getProjectHash` helper from `src/main/drawings/excalidrawHandlers.ts` (extract to a shared util if needed — see [Open Questions](#open-questions)).
- **Repo-agnostic subdirectory:** `<base>/repo-agnostic/` for payloads posted without `repositoryPath`.
- **Per-payload file:** `<projectHash>/<id>.json` (or `repo-agnostic/<id>.json`).

`id` is generated server-side (`crypto.randomUUID()`) when the caller doesn't supply one. Callers may supply a stable id to update an existing payload in place.

### `index.json` shape

```ts
interface SequenceDiagramIndex {
  version: 1;
  entries: SequenceDiagramIndexEntry[];
  /** id of the currently active payload, keyed by repositoryPath (or '__default__'). */
  active: Record<string, string | null>;
}

interface SequenceDiagramIndexEntry {
  id: string;
  repositoryPath?: string;
  title?: string;
  /** Short summary preview pulled from payload.summary, truncated to ~200 chars. */
  summaryPreview?: string;
  eventCount: number;
  hasDiffSnippets: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /** On-disk file size in bytes — used to surface large entries in the picker. */
  sizeBytes: number;
}
```

The manifest holds only metadata. Full payloads (which can reach the existing 10 MB JSON cap) are read on demand from `<projectHash>/<id>.json`.

### Recovery

If `index.json` is missing or unparseable, rebuild it by scanning each subdirectory for `*.json` files, parsing each, and reconstructing entries. Same recovery shape as Excalidraw (`excalidrawHandlers.ts:32`). On rebuild, `active` resets to `{}` (no payload auto-loads).

### Eviction

Soft cap at **50 saved payloads per repository**. When `set()` would push a repo over the cap, evict the oldest entries (by `updatedAt`) until back under. Surface a warning log; do not block the write. The cap is a defensive measure against unbounded growth from automated callers, not a UX feature — users delete via the picker.

## HTTP API Changes

Existing routes keep their meanings; new routes are additive.

### `POST /api/file-city/sequence` (changed)

- **New optional field:** `id?: string` in the request body. When present, replaces the existing payload with that id (anywhere in the manifest). When absent, the server generates a UUID.
- **New optional field:** `activate?: boolean` (default `true`). When `false`, the payload is saved to the library but the active slot for the repo is not changed and `PAYLOAD_SET` is **not** broadcast. Lets agents stage payloads without disturbing the user.
- **Response gains:** `{ success: true, id, broadcastTo }`.

### `DELETE /api/file-city/sequence/:id` (new)

Permanently delete a saved payload. If the deleted payload was active, broadcast `PAYLOAD_CLEARED` for its repo.

**Response:** `{ success: true }` on success, `404` if the id is unknown.

### `DELETE /api/file-city/sequence` (unchanged shape, narrowed meaning)

Still clears the *active* slot for a repo (or the default slot when no query). Saved entries are not deleted — this becomes "deactivate / close the overlay." The doc page should call this out so external callers don't expect it to wipe library state.

### `GET /api/file-city/sequence/library` (new)

Returns the manifest entries, optionally filtered.

- `GET /api/file-city/sequence/library` → `{ success: true, entries: SequenceDiagramIndexEntry[], active: Record<string, string | null> }`
- `GET /api/file-city/sequence/library?repositoryPath=<path>` → only entries matching that repo.

### `POST /api/file-city/sequence/activate` (new)

Body: `{ id: string }`. Loads the payload by id, marks it active for its repo, broadcasts `PAYLOAD_SET`. Equivalent to a renderer-side library pick but exposed for tooling.

### `GET /api/file-city/sequence/:id` (new)

Returns the full payload by id. Useful for debugging and for tools that want to read an entry without activating it.

The existing `GET /api/file-city/sequence` (with `?repositoryPath` or no query) continues to return *active* payloads only, so existing callers and the renderer rehydrate path don't change behavior.

## IPC Contract Changes

Add to `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts`:

```ts
export enum FileCitySequenceEvent {
  PAYLOAD_SET = 'file-city:sequence-diagram:set',
  PAYLOAD_CLEARED = 'file-city:sequence-diagram:cleared',
  GET_CURRENT = 'file-city:sequence-diagram:get-current',
  // new:
  LIBRARY_CHANGED = 'file-city:sequence-diagram:library-changed', // main → renderer broadcast
  LIST = 'file-city:sequence-diagram:list',                       // renderer → main invoke
  LOAD = 'file-city:sequence-diagram:load',                       // renderer → main invoke
  ACTIVATE = 'file-city:sequence-diagram:activate',               // renderer → main invoke
  DELETE = 'file-city:sequence-diagram:delete',                   // renderer → main invoke
}

export interface FileCitySequenceAPI {
  // existing
  getCurrent: (repositoryPath?: string) => Promise<SequenceDiagramPayload | null>;
  onPayloadSet: (cb: (p: SequenceDiagramPayload) => void) => () => void;
  onPayloadCleared: (cb: (info: { repositoryPath?: string }) => void) => () => void;

  // new
  list: (repositoryPath?: string) => Promise<{
    entries: SequenceDiagramIndexEntry[];
    activeId: string | null;
  }>;
  load: (id: string) => Promise<SequenceDiagramPayload | null>;
  activate: (id: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
  onLibraryChanged: (cb: (info: { repositoryPath?: string }) => void) => () => void;
}
```

`LIBRARY_CHANGED` fires on every `set` (new or replace), `delete`, and on activate/deactivate so all open windows can refresh their pickers without polling.

## Renderer Wiring

### Service: `SequenceDiagramLibraryService`

Following the precedent of `CustomLayersStorageService` (`src/renderer/services/storage/CustomLayersStorageService.ts`), the renderer wraps the preload surface in a single service class. **No component or hook touches `window.mainProcess.fileCitySequence` directly.** Reasons:

- Keeps preload-shape coupling in one place — if the IPC contract changes, only the service updates.
- Makes the API mockable in tests / Storybook (swap the service module rather than monkey-patching `window`).
- Centralizes error handling, logging, and the "preload not available" guard so call sites stay terse.

```ts
// src/renderer/services/SequenceDiagramLibraryService.ts
import type {
  SequenceDiagramPayload,
  SequenceDiagramIndexEntry,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

export class SequenceDiagramLibraryService {
  static async list(repositoryPath?: string): Promise<{
    entries: SequenceDiagramIndexEntry[];
    activeId: string | null;
  }> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return { entries: [], activeId: null };
    return api.list(repositoryPath);
  }

  static async load(id: string): Promise<SequenceDiagramPayload | null> {
    return window.mainProcess?.fileCitySequence?.load(id) ?? null;
  }

  static async activate(id: string): Promise<void> {
    await window.mainProcess?.fileCitySequence?.activate(id);
  }

  static async remove(id: string): Promise<void> {
    await window.mainProcess?.fileCitySequence?.delete(id);
  }

  /** Returns an unsubscribe function. */
  static onLibraryChanged(
    cb: (info: { repositoryPath?: string }) => void,
  ): () => void {
    return window.mainProcess?.fileCitySequence?.onLibraryChanged(cb) ?? (() => {});
  }
}
```

### Hook: `useSequenceDiagramLibrary`

Thin React adapter over the service. Sibling to the existing `useSequenceDiagram`. Subscribes to `LIBRARY_CHANGED` and exposes `{ entries, activeId, refresh, activate, remove }`. Keeping it separate keeps `useSequenceDiagram` focused on the active payload — the File City overlay components don't need library state, only the new sidebar panel does.

```ts
export function useSequenceDiagramLibrary(repositoryPath: string | null) {
  const [entries, setEntries] = useState<SequenceDiagramIndexEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await SequenceDiagramLibraryService.list(repositoryPath ?? undefined);
    setEntries(result.entries);
    setActiveId(result.activeId);
  }, [repositoryPath]);

  useEffect(() => {
    refresh();
    const off = SequenceDiagramLibraryService.onLibraryChanged((info) => {
      if (info.repositoryPath && info.repositoryPath !== repositoryPath) return;
      refresh();
    });
    return off;
  }, [refresh, repositoryPath]);

  return {
    entries,
    activeId,
    refresh,
    activate: (id: string) => SequenceDiagramLibraryService.activate(id),
    remove: (id: string) => SequenceDiagramLibraryService.remove(id),
  };
}
```

The existing `useSequenceDiagram` hook should also be migrated to a `SequenceDiagramService` (with `getCurrent`, `onPayloadSet`, `onPayloadCleared`) for the same reason — covered in the [Status](#status) checklist.

### UI: left-sidebar "Sequence Diagrams" panel

The library lives in its own dev-workspace panel rather than inside the File City overlay, so users can browse and curate diagrams without the File City panel being open. It mirrors how `files-panel` and `scopes-tab` slot into the left sidebar today.

#### Registration

Two registrations, following the existing pattern (see `src/renderer/components/Sidebar/PanelIconSidebar.tsx:76` and the `allPanels` array in `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx:3207`):

1. **Sidebar icon** — add an entry to `LEFT_PANEL_ICONS` in `PanelIconSidebar.tsx`:

   ```ts
   { id: 'sequenceDiagrams', Icon: Workflow, label: 'Diagrams' }
   ```

   `Workflow` (lucide) reads as "sequence/flow" and pairs visually with the existing icon set; substitute if a clearer glyph emerges.

2. **Panel definition** — add an entry to `allPanels` in `DevWorkspacePanelFramework.tsx`, mirroring the `gitConfig` shape (`DevWorkspacePanelFramework.tsx:3783`):

   ```tsx
   {
     id: 'sequenceDiagrams',
     label: 'Sequence Diagrams',
     content: (
       <SequenceDiagramsPanel
         repositoryPath={context.currentScope?.repository?.path}
       />
     ),
   }
   ```

3. **Command palette** — add `'sequenceDiagrams'` to `PANEL_IDS` in `DevWorkspaceApp.tsx` so the toggle keybinding works.

#### Component shape

`SequenceDiagramsPanel` is a self-contained, repository-scoped panel — same minimal shape as `GitConfigPanel` (takes `repositoryPath?: string` and reads its own data). It does **not** need the full `{ context, actions, events }` triple because library state lives in main and the panel reaches it directly via `useSequenceDiagramLibrary`.

```tsx
export function SequenceDiagramsPanel({ repositoryPath }: { repositoryPath?: string }) {
  const { entries, activeId, activate, remove } = useSequenceDiagramLibrary(repositoryPath ?? null);
  // ...
}
```

#### Layout

- **Header:** label "Sequence Diagrams" + a tiny repo indicator ("for <repoBasename>") so it's clear the list is scoped. A "Clear active" button appears only when `activeId` is set; it calls the existing `DELETE /api/file-city/sequence` (deactivate, not delete).
- **List body:** vertical list of entries for the active repo, sorted by `updatedAt` desc. Each row:
  - Title (or "Untitled flow · `<eventCount>` events" when missing).
  - Relative timestamp (`createdAt`).
  - Small badge for `hasDiffSnippets`.
  - Active row: filled accent stripe on the left edge + checkmark.
  - Hover-revealed trailing trash icon → `library.remove(id)`. Confirm prompt for entries older than ~24 h; immediate delete for fresh entries since they're easy to recreate.
- **Click anywhere on a row** calls `library.activate(id)`. The main process broadcasts `PAYLOAD_SET`, which the existing `useSequenceDiagram` hook in `FileCityPanel` picks up and renders. **No wiring change in the File City panel.**
- **Empty state:** "No saved diagrams for this repository yet. Post one to `POST /api/file-city/sequence` to get started." with a copyable curl snippet.

#### Cross-window behavior

The panel is per-window (each dev-workspace window mounts its own instance), but library state is global to the main process — `LIBRARY_CHANGED` broadcasts to all windows, so opening the panel in two windows shows the same entries and the same active id. See [Open Questions](#open-questions) for whether *active* state should remain global.

#### What this means for the File City panel

Nothing changes. `SequenceDiagramOverlay` keeps its current chrome; activation still flows through `PAYLOAD_SET`. When a payload is deleted while it is active, `useSequenceDiagram` receives `PAYLOAD_CLEARED` and the overlay collapses naturally — same behavior as today's manual `DELETE`.

## Lifecycle

- The store initializes lazily on first access from `getSequenceDiagramStore()`. First call creates the base directory (`fs.mkdir(..., { recursive: true })`) and reads `index.json` if present.
- The IPC handlers register inside `registerSequenceDiagramHandlers()` (already called from `src/main/initialization.ts`). Add `LIST`, `LOAD`, `ACTIVATE`, `DELETE` next to `GET_CURRENT`.
- Disk writes are serialized through a per-process write queue (single in-flight `fs.writeFile` for `index.json`) to avoid manifest interleaving. Per-payload writes don't share the queue since their filenames are id-scoped.
- No app-shutdown flush needed — every write is durable on its own.

## Migration

There is no on-disk schema today, so no migration is required for existing users. Rolling out the change:

1. Ship the store + routes; existing `POST` calls keep working but now persist by side effect.
2. Ship the renderer picker behind a flag (or unconditionally — UX is additive).
3. After a release, the existing in-memory-only behavior is gone; older external callers continue to work because `POST` semantics are backwards-compatible (id is auto-generated, `activate` defaults to true).

## Security

Same posture as the rest of the bridge: localhost-only, CORS `*`. The new persistence surface has two new considerations worth naming:

- **Disk writes from web origins.** A local browser tab can now spam payloads to disk (capped per-repo at 50; total disk per repo capped at ~500 MB by the eviction rule × the existing 10 MB body limit). If we later add a shared-secret header to the bridge, the persistence routes inherit it for free.
- **`DELETE /api/file-city/sequence/:id`** is destructive. It's still local-only, but worth gating behind the same secret if/when one is introduced.

## Key Files Reference

### Existing Infrastructure

| File | Purpose |
|------|---------|
| `src/main/file-city/sequenceDiagramStore.ts` | In-memory store today; gains disk persistence |
| `src/main/file-city/sequenceDiagramRoutes.ts` | Express routes; gains `library`, `:id`, `activate` |
| `src/main/drawings/excalidrawHandlers.ts` | Reference implementation for hashed per-repo storage + index recovery |
| `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts` | Shared types + IPC enum |
| `src/window/main-process-api-implementations/fileCitySequenceApi.ts` | Renderer API surface |
| `src/renderer/dev-workspace/file-city-panel/SequenceDiagramOverlay.tsx` | Bottom drawer (unchanged for this feature) |
| `src/renderer/dev-workspace/file-city-panel/useSequenceDiagram.ts` | Active-payload hook (unchanged) |
| `src/renderer/components/Sidebar/PanelIconSidebar.tsx` | Add `'sequenceDiagrams'` icon to `LEFT_PANEL_ICONS` (`:76`) |
| `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` | Register the panel in `allPanels` (`:3207`) |
| `src/renderer/dev-workspace/DevWorkspaceApp.tsx` | Add `'sequenceDiagrams'` to `PANEL_IDS` (`:83`) |

### New Files

| File | Purpose |
|------|---------|
| `src/main/file-city/sequenceDiagramPersistence.ts` | Disk read/write helpers, manifest reconciliation, recovery scan |
| `src/renderer/services/SequenceDiagramLibraryService.ts` | Renderer service — sole owner of `window.mainProcess.fileCitySequence` calls for library ops |
| `src/renderer/services/SequenceDiagramService.ts` | Renderer service for active-payload ops (migrate existing `useSequenceDiagram` to use this) |
| `src/renderer/dev-workspace/sequence-diagrams-panel/SequenceDiagramsPanel.tsx` | Left-sidebar panel root (header + list + empty state) |
| `src/renderer/dev-workspace/sequence-diagrams-panel/SequenceDiagramRow.tsx` | One row in the list; click-to-activate + trash button |
| `src/renderer/dev-workspace/sequence-diagrams-panel/useSequenceDiagramLibrary.ts` | Library hook (thin adapter over `SequenceDiagramLibraryService`) |
| `src/renderer/dev-workspace/sequence-diagrams-panel/index.ts` | Re-export barrel matching the convention of `files-panel/`, `git-config-panel/` |

## Open Questions

1. **Hash helper location.** Currently inlined in `sequenceDiagramPersistence.ts` (md5 over the resolved repo path). The Excalidraw handler that originally owned `getProjectHash` is no longer in the tree, so there was nothing to share with at implementation time. If a third subsystem needs project-hashing later, lift to `src/main/utils/projectHash.ts` then.
2. **Title fallback.** Payloads often arrive without `title`. Auto-derive from the first event's `name`, or render "Untitled flow"? The picker becomes harder to scan without titles. *Currently rendered as "Untitled flow · N events".*
3. **Activation across windows.** When two File City panels for the same repo are open in separate windows, `activate(id)` currently broadcasts to all of them. Confirm we want them to stay in sync, or scope active state per window (would require window-id keying in the manifest's `active` map).
4. **Auto-evict on disk pressure.** 50 entries × 10 MB = 500 MB per repo worst case. Likely fine, but worth a follow-up to surface total size in settings if power users hit it.
5. ~~**Repo path normalization.**~~ **Resolved.** `sequenceDiagramPersistence.ts` runs `path.resolve` before hashing, so `/Users/x/repo` and `/Users/x/repo/` map to the same subdirectory.

## Status

Shipped. The library + sidebar panel are live; saved payloads survive restart and can be activated/deleted from the dev-workspace left rail.

- [x] `sequenceDiagramPersistence.ts` — base dir, index read/write, recovery scan, eviction.
- [x] `SequenceDiagramStore` rewritten on top of persistence helpers; `set`/`clear` write through to disk.
- [x] `sequenceDiagramRoutes.ts` gains `GET /library`, `GET /:id`, `DELETE /:id`, `POST /activate`; `POST /` accepts `id` + `activate` fields.
- [x] IPC enum + `FileCitySequenceAPI` extended; preload + renderer api updated.
- [x] `SequenceDiagramLibraryService` + `SequenceDiagramService` added under `src/renderer/services/`; existing `useSequenceDiagram` migrated off raw `window.mainProcess` calls.
- [x] `useSequenceDiagramLibrary` hook + `SequenceDiagramsPanel` / `SequenceDiagramRow` components under `src/renderer/dev-workspace/sequence-diagrams-panel/` (consume the services, no direct preload access).
- [x] Register the panel: `LEFT_PANEL_ICONS` entry in `PanelIconSidebar.tsx`, `allPanels` entry in `DevWorkspacePanelFramework.tsx`, `PANEL_IDS` entry in `DevWorkspaceApp.tsx`.
- [ ] `getProjectHash` lifted to `src/main/utils/projectHash.ts` and reused. *(Skipped — no second consumer exists today; revisit if needed.)*
- [x] Original [overlay doc](file-city-sequence-diagram-overlay.md) updated: removed "Persisting payloads across app restarts" from non-goals, links here.

### Smoke test

```bash
# Post a payload — gets persisted, becomes active
curl -XPOST http://localhost:3054/api/file-city/sequence \
  -H 'content-type: application/json' \
  -d '{"title":"flow A","repositoryPath":"/Users/me/repo","events":[...],"edges":[...]}'

# List the library for that repo
curl -s 'http://localhost:3054/api/file-city/sequence/library?repositoryPath=/Users/me/repo' | jq

# Post another, then activate the first
curl -XPOST http://localhost:3054/api/file-city/sequence \
  -H 'content-type: application/json' \
  -d '{"title":"flow B","repositoryPath":"/Users/me/repo","events":[...],"edges":[...]}'
curl -XPOST http://localhost:3054/api/file-city/sequence/activate \
  -H 'content-type: application/json' \
  -d '{"id":"<id-of-flow-A>"}'

# Restart the app → reopen panel → both flows still in the picker, flow A active.

# Delete by id
curl -XDELETE http://localhost:3054/api/file-city/sequence/<id-of-flow-B>
```
