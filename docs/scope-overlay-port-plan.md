# Scope Overlay — Port Plan (Dev Workspace)

Plan to port the `ScopeOverlay` story UI from the file-city repo into the
dev-workspace window of the electron-app. The prototype lives at
`web-ade/file-city/packages/react/src/stories/ScopeOverlay.stories.tsx`
(story: `Experiments/ScopeOverlay → SingleScope`).

## What we're building

The prototype is a single-window experience:

- **Left pane (320px, tabbed)**
  - *File tree* tab: file selection panel + audit filter (Off / Uncovered / Covered) + filtered file tree.
  - *Scopes* tab: scope → namespace → event tree, drives city highlights and elevated scope panels.
- **Right pane**: `FileCity3D` with `highlightLayers` and `elevatedScopePanels` driven by tree expansion.
- **Modal**: "Add to scope" dialog launched from a file selection.
- **Persistence**: scopes saved to `localStorage` under `file-city.scope-overlay.scopes`.

We want the same workflow available inside the dev-workspace window.

---

## Investigation summary

### Dev-workspace window layout

- Entry: `src/renderer/dev-workspace/DevWorkspaceApp.tsx` →
  `DevWorkspacePanelFramework`. Uses `ConfigurablePanelLayout` from
  `@principal-ade/panel-layouts` with three slots (`left`, `middle`, `right`),
  an icon sidebar on each side (`PanelIconSidebar`), and a registry of
  ~30 panels in `DevWorkspacePanelFrameworkInner.allPanels`.
- Adding a panel: push to `allPanels`, add the id to `LEFT_/RIGHT_PANEL_ICONS`
  in `components/Sidebar/PanelIconSidebar.tsx`, and (optionally) to
  `PANEL_IDS` + `QUICK_COMMANDS` in `DevWorkspaceApp.tsx`.
- Cross-panel comms: a single `PanelEventBus` (`events`) wired through
  `RepositoryPanelProvider`. The `file-city-3d:open` event is the closest
  existing analog and is the pattern we'll follow.

### Existing 3D usage

Two consumers today:

- `id: 'fileCity'` panel — `<FileCityWithHighlights>` rendering
  `CodeCityPanel` from `@industry-theme/file-city-panel`. **Production view —
  do not rip out.** Drives storyboard highlights, agent highlights, color
  modes.
- `case 'file-city-3d':` tab in `renderTabContent` — `FileCity3DPanelContent`
  from `@industry-theme/repository-composition-panels`, a thin wrapper around
  `FileCity3D` from `@principal-ai/file-city-react`. Opened from the titlebar's
  "Open File City 3D" button via `file-city-3d:open`.

City data is generated from the live `fileTree` slice with
`buildCityDataFromFileTree(fileTree, rootPath)` and enriched via
`window.mainProcess.fileCityImage.countLines` + `enrichWithLineCounts` +
`estimateLineCounts`. **All paths are prefixed with a generated
`git-<sha>-<dirty>` `rootPath` — not `electron-app/`** as the prototype
hardcodes.

The installed `@principal-ai/file-city-react@0.5.35` does **not** export
`ElevatedScopePanel` or accept `elevatedScopePanels`. We need ≥0.5.37 (or
whatever release lands the feature).

### Scope data sources today

- `library.yaml` discovery via `LibraryDiscovery` already populates `scopeNames`
  on workspace registration.
- Canvas parsing (`.canvas` / `.otel.canvas`) produces a `storyboardContext`
  with `manifest.nodeToFiles: Map<string, string[]>` — closest existing analog
  to "namespace.paths". Read on demand when a canvas tab is open.
- **No surface today authors or persists a Scope → Namespace → Event tree.**
  The prototype's localStorage is the only authoring path.
- A repo-wide search for `*.events.canvas` returned zero matches — that
  filename convention does not exist in the desktop-app yet.

### Dependency status

- `@principal-ai/file-city-builder@0.4.10` ✓
- `@principal-ai/file-city-react@0.5.35` — needs bump to ≥0.5.37
- `@industry-theme/file-city-panel@^0.5.49` ✓ (peer-dep range may need bump)
- `@pierre/trees` — **not present**, must be added (the prototype's
  expansion-state observer depends on it)

---

## Architectural decisions

### A. Panel layout — recommend Option A1

A single new left-panel id `scopeOverlay` containing the prototype's tabbed
sidebar (Files | Scopes), plus a new right-panel id `scopeCity` mounting our
`FileCity3D`. A new preset (`scope-overlay`) sets
`{ left: 'scopeOverlay', middle: 'terminal', right: 'scopeCity' }`.

**Trade-off:** the dev-workspace's icon-sidebar idiom would suggest splitting
Files and Scopes into two separate left-panel ids (Option A2). A1 keeps the
prototype's spatial pairing of "select file → audit filter next to it" at
the cost of an in-panel tab strip — which is fine because panel internals
are owned by the panel component.

### B. Audit filter location

Inside the *File tree* tab of the new left panel (matches prototype). It's
small, only meaningful when scopes exist, and tightly coupled to the tree
it filters.

### C. Don't replace `CodeCityPanel`

The production `fileCity` right-panel has a lot of wiring (storyboard,
agents, color modes). Adding `scopeCity` as a parallel panel keeps both
available — users opt in to the scope view via preset.

### D. Path translation

Parameterise `toScopePath` / `toCityPath` by `rootPath` instead of
hardcoding `electron-app/`. Pull `rootPath` from
`context.fileTree?.data.metadata.id`. The existing `file-city-3d:open`
handler already does an equivalent translation.

### E. Persistence — phased

- **Phase 1 (port):** localStorage, keyed per repo
  (`file-city.scope-overlay.scopes:${repositoryPath}`). Zero new IPC.
- **Phase 2 (parse from canvases):** scan `**/*.events.canvas` files via
  `RepositoryMonitoringService.getFileTree`, parse via `FileSystemService.readFile`
  + `JSON.parse`, extract `otel-event` nodes' `otel.files` arrays into
  `namespace.paths`. Persist user deltas alongside via a
  `CustomLayersStorageService`-style pattern.
- **Phase 3 (write back):** "Add to scope" submits would write a new event
  node into the appropriate `*.events.canvas`. Out of scope for the port.

Phase 1 is the realistic ship target — `*.events.canvas` files don't exist
in the repo yet.

### F. `@pierre/trees` dependency

Recommend adding it directly rather than rewriting the expansion-state
observer (`useFileTreeSelector`) the elevated-panels feature depends on.
Already a transitive concept in file-city.

---

## Implementation steps

### Phase 0 — Dependencies

1. Bump `@principal-ai/file-city-react` to `^0.5.37`. Verify
   `@industry-theme/file-city-panel` peer range still resolves; bump if needed.
2. Add `@pierre/trees` (`^1.0.0-beta.3` from file-city devDeps) to
   `electron-app/package.json`.
3. `npm install` and `npm run typecheck` to surface API drift.

### Phase 1 — Port primitives

Create `src/renderer/dev-workspace/scope-overlay/`:

- `types.ts` — `MockScope`, `MockNamespace`, `MockEvent`, `AuditMode`, `ScopeTreeSelection`.
- `scopeStorage.ts` — `loadScopesFromStorage(repositoryPath)`, `saveScopesToStorage(repositoryPath, scopes)`.
- `scopeTreePaths.ts` — `buildScopeTreePaths`, `parseScopeTreePath`, sentinels.
- `pathTranslation.ts` — `makePathTranslators(rootPath)` returning `toScopePath` / `toCityPath`.
- `buildLayersForScope.ts` — `buildLayersForScope`, `pickNamespaceColor`, `NAMESPACE_PALETTE`.
- `coverage.ts` — `getCoveredPaths(scopes)`, `partitionFiles(buildings, claimedPaths, toScopePath)`.

### Phase 2 — Components

- `ScopeInfoOverlay.tsx` — copy from story (overlays the right pane).
- `AddToScopeModal.tsx` — copy from story.
- `ScopeOverlayPanel.tsx` — the new left panel. Tab strip + audit filter +
  both `FileTree` instances + selection actions. Reads `cityData` and
  `repositoryPath` from a `useScopeOverlayData()` hook. Emits via PanelEventBus:
  - `scope-overlay:focus-directory`
  - `scope-overlay:highlight-layers`
  - `scope-overlay:elevated-panels`
  - `scope-overlay:info-changed`
- `ScopeCityPanel.tsx` — the new right panel. Renders `<FileCity3D>` with
  state subscribed from the events above. Mounts `<ScopeInfoOverlay>` and
  `<AddToScopeModal>`.
- `buildCityDataFromContext.ts` — extract the existing inline city builder
  (`DevWorkspacePanelFramework.tsx` lines ~2421–2465) so both new panels
  and the existing `file-city-3d:open` handler share one implementation.

### Phase 3 — Register

- `DevWorkspacePanelFramework.tsx` `allPanels`:
  - `{ id: 'scopeOverlay', label: 'Scopes', content: <ScopeOverlayPanel /> }`
  - `{ id: 'scopeCity', label: 'Scope City', content: <ScopeCityPanel /> }`
- `components/Sidebar/PanelIconSidebar.tsx`:
  - Add `scopeOverlay` to `LEFT_PANEL_ICONS`.
  - Add `scopeCity` to `RIGHT_PANEL_ICONS`.
- `DevWorkspaceApp.tsx`:
  - Add `'scopeOverlay'` and `'scopeCity'` to `PANEL_IDS`.
  - Add `/scopes` and `/scope-city` quick commands (mirror `/files`, `/file-city`).
- `DevWorkspaceTitlebar.tsx` `DEFAULT_PANEL_PRESETS`:
  - Add `scope-overlay` preset = `{ left: 'scopeOverlay', middle: 'terminal', right: 'scopeCity' }`.

### Phase 4 — Data flow

- State (`scopes`, `auditMode`, `activeTab`, modal, selections) lives inside
  `ScopeOverlayPanel`. Panels stay mounted while collapsed, so a single
  source of truth is fine.
- On every state change derive `highlightLayers` / `elevatedScopePanels` /
  `focusDirectory` / `scopeInfo` and emit through PanelEventBus.
- `ScopeCityPanel` subscribes via `events.on(...)` and stores them in local
  state. Either panel can be in any slot or hidden without breaking the other.
- Add a `fileCity3DCityData` slice to `RepositoryPanelContext` so the city
  builder runs once and both panels read the same instance (avoids
  duplicating an expensive line-count fetch).

### Phase 5 — Validation

- Open dev workspace on a real repo, switch to scope-overlay preset, walk
  through prototype flows: tab toggle, audit filter, add-to-scope, scope
  tree expansion → elevated panels appearing/disappearing.
- Confirm scopes persist across reload, isolated per repo.
- Confirm path translation works on real `git-<sha>` rootPath.

---

## Decisions needed before coding

1. **`@principal-ai/file-city-react@0.5.37` published?** Or do we need a
   workspace link / private publish / inline the elevated-panel code?
2. **`@pierre/trees` license / bundle ok?** It's beta. Check size and
   GPL-3.0 compatibility for distribution.
3. **City data root path source.** Confirm `context.fileTree?.data.metadata.id`
   always matches the `rootPath` `buildCityDataFromFileTree` uses.
4. **Keep both `fileCity` and `scopeCity` right panels?** Recommended — but
   if scope view should *replace* the production city, we'd need to migrate
   storyboard / agent / color-mode wiring (much bigger scope).
5. **A1 vs A2 — in-panel tab strip vs two icon-sidebar entries.** Recommend A1.
6. **Phase 1 only for now?** Phase 2 (canvas parsing) requires `*.events.canvas`
   files that don't exist yet. Confirm we ship localStorage-only first.
7. **Modal z-index.** Prototype uses 1000. Verify no conflict with
   `AgentCommandPalette`.

---

## Critical files

- `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`
- `src/renderer/dev-workspace/DevWorkspaceApp.tsx`
- `src/renderer/dev-workspace/DevWorkspaceTitlebar.tsx`
- `src/renderer/components/Sidebar/PanelIconSidebar.tsx`
- `src/renderer/contexts/RepositoryPanelContext.tsx`
- *(reference)* `web-ade/file-city/packages/react/src/stories/ScopeOverlay.stories.tsx`
