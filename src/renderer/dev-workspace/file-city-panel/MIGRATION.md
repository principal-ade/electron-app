# File City Panel Migration

Goal: replace the current `FileCityPanel` (a thin wrapper around `FileCity3D`) with our own copy of the upstream `FileCityExplorer` from `@principal-ai/file-city-react` (source: `web-ade/file-city/packages/react/src/components/FileCityExplorer/`). Once the new component lands and is wired in, **delete the existing `FileCityPanel`, `buildCityDataFromContext`, and `index.tsx`** in this folder and replace them with the ported component.

We are not consuming the upstream component directly — we want to fork it so we can evolve it (event bus integration, scope-manager binding, panel sizing, etc.) without forcing upstream PRs.

---

## What we are copying (verbatim, with light edits)

Source files in `file-city/packages/react/src/components/FileCityExplorer/`:

| File | Lines | Notes |
| --- | --- | --- |
| `FileCityExplorer.tsx` | 1457 | Main component. Owns trees, tabs, focus, modals, overlays. |
| `AddToScopeModal.tsx` | 320 | Modal — pure UI. Copy as-is. |
| `AddToAreaModal.tsx` | 273 | Modal — pure UI. Copy as-is. |
| `ScopeInfoOverlay.tsx` | 229 | Right-side overlay for scope tab. **Name collides** with our existing `dev-workspace/scope-overlay/ScopeInfoOverlay.tsx` — it stays inside the new component folder, no top-level re-export. |
| `layers.ts` | 72 | `NAMESPACE_PALETTE`, `pickNamespaceColor`, `buildLayersForScope`, `AREA_PANEL_COLOR`. Pure helpers. |
| `pathConversion.ts` | 32 | `createPathConverters`. Pure. |
| `scopeTreePaths.ts` | 52 | Tree-path encoding for the scope tree. Pure. |
| `styles.ts` | 34 | `withAlpha`, `makeSectionLabelStyle`, `makeOverlayStyle`. Pure. |
| `index.ts` | 2 | Re-exports. |

**`model.ts` is intentionally not ported.** Upstream defines its own `Scope`/`Namespace`/`Event` types there; we use the existing `ScopeRecord`/`NamespaceRecord`/`EventRecord` from `renderer/services/scope-manager/types.ts` directly — see §6.

**Total to port: ~2.4K LOC across 8 files**, of which ~1.5K is the main component and modals (mostly JSX). The pure helpers (`layers`, `pathConversion`, `scopeTreePaths`, `styles`) port unchanged.

Suggested target layout in `src/renderer/dev-workspace/file-city-panel/`:

```
file-city-panel/
  FileCityPanel.tsx                ← new wrapper (panel framework adapter)
  FileCityExplorer/
    FileCityExplorer.tsx           ← ported, with edits below
    AddToScopeModal.tsx
    AddToAreaModal.tsx
    ScopeInfoOverlay.tsx           ← upstream version, scoped to this folder
    layers.ts
    pathConversion.ts
    scopeTreePaths.ts
    styles.ts
    index.ts
  buildCityDataFromContext.ts      ← keep, still needed by the wrapper
  FloatingTerminalOverlay.tsx      ← unrelated, leave alone
  index.tsx                        ← keep, swap component reference
```

---

## Required changes during the port

### 1. Container sizing (`FileCityExplorer.tsx:806`)

Upstream renders as a full-viewport page:

```tsx
<div style={{ height: '100vh', display: 'flex', ... }}>
  <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
    <div style={{ position: 'absolute', top: 56, left: 0, right: 0, bottom: 0 }}>
      <FileCity3D ... />
    </div>
```

Our panels are sized by the panel framework. Change to:

```tsx
<div style={{ height: '100%', width: '100%', display: 'flex', ... }}>
  <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
    <div style={{ position: 'absolute', top: 56, left: 0, right: 0, bottom: 0 }}>
      <FileCity3D ... />
    </div>
```

Also note: the upstream layout has a left rail (file/scope trees). Decide whether the panel framework version keeps the left rail or hides it — if hidden, we lose tree-driven focus and selection. Recommend: **keep the left rail**; the existing `FeedLeftPanel`/`ProjectsList` are separate panels and the explorer's tree is internal to its own canvas. (Upstream component owns its tree state — there is no controlled prop for it.)

### 2. Building-click event emission

Upstream `handleBuildingClick` at `FileCityExplorer.tsx:629`:

```tsx
const handleBuildingClick = React.useCallback(
  (building: { path: string }) => {
    setParentLayersAnchor(building.path);
    setParentLayersDismissed(false);
  },
  [],
);
```

The current `FileCityPanel.tsx:188-199` also emits a panel-framework event so other panels (editor, terminal) can react:

```tsx
events.emit({
  type: 'file:open',
  source: 'file-city-panel',
  timestamp: Date.now(),
  payload: { path: stripRootPath(building.path, rootPath) },
});
```

**Add an `onBuildingOpen?: (cityPath: string) => void` prop** to the ported `FileCityExplorer`, call it from `handleBuildingClick`, and have the wrapper translate that into the framework `events.emit(...)` call.

### 3. CityData input

Upstream takes `cityData` as a required prop (stories pass a static JSON). The wrapper has to build it from the panel-framework `context.fileTree` slice. The existing `buildCityDataFromContext.ts` already does this — keep it and use it from the wrapper. The wrapper also handles the "no tree yet" / "building…" placeholder UI (see current `FileCityPanel.tsx:210-229`).

### 4. `packageRoot` value

Upstream stories pass `packageRoot="electron-app/"`. Our `buildCityDataFromContext` passes an empty `rootPath` to the city builder, so building paths are already repo-relative ("src/x.ts", not "electron-app/src/x.ts"). Default `packageRoot=''` in the wrapper. The path converters already handle the empty case (`pathConversion.ts:28`).

### 5. Scope/area persistence — the big one

Upstream owns scopes and areas as `React.useState`, persisting through `localStorage` keyed by `persistKey`. We have a real backend already.

**Replace `localStorage` with `ScopeManager`:**

- `dev-workspace/scope-manager-provider/ScopeManagerProvider.tsx` already wraps the dev-workspace and exposes `manager`, `workspace`, and `isLoaded` via `useScopeManagerOptional()`.
- `manager` (`renderer/services/scope-manager/ScopeManager.ts`) has `addScope`, `addNamespace`, `addPathToNamespace`, `addPathToScope`, `addEvent`, plus removals, and writes to `<repo>/.principal-views/*.canvas`.
- Subscribe to workspace changes via the provider (already done internally) — the explorer reads `scopeCtx.workspace.scopes` instead of local state.

In the ported component:

- Drop `initialScopes`, `initialAreas`, `persistKey`, the two localStorage `useState` initializers, and the two persistence `useEffect`s.
- Replace `setScopes(prev => …)` in `submitAddToScope` (`FileCityExplorer.tsx:671-770`) with calls to `manager.addScope(...)`, `manager.addNamespace(...)`, `manager.addPathToScope(...)`, `manager.addPathToNamespace(...)`. The branching logic in `submitAddToScope` already mirrors these operations 1:1 — translation is mechanical.
- Replace the `pendingExpand` ref + `resetPaths` dance with an effect that reacts to `workspace.scopes` changes (the manager pushes new workspace versions through context).

### 6. Use existing scope-manager types directly — do not introduce new ones

Upstream invents its own `Scope`/`Namespace`/`Event` types in `model.ts`. We already have equivalents we maintain for canvas round-tripping in `renderer/services/scope-manager/types.ts`:

| Concept | Upstream `Scope` | Local `ScopeRecord` |
| --- | --- | --- |
| Identity | `id: string` + `name: string` | `name: string` only |
| Description | required | optional |
| Color | n/a (per-namespace only) | optional `color`, plus `status`, `label`, `nodeId`, `position` |
| Namespaces | `Namespace[]` with **required** `color: string`, **required** `paths: string[]` | `NamespaceRecord[]` with optional `color`, required `paths` |
| Events | inline in namespace | inline in `NamespaceRecord` (`EventRecord` adds optional `attributes`) |

**Skip porting `model.ts` entirely.** The component becomes a direct consumer of `ScopeRecord` / `NamespaceRecord` / `EventRecord`. `ProjectArea` continues to come from `@principal-ai/principal-view-core` (same as upstream). Imports inside the ported files become:

```ts
import type {
  ScopeRecord,
  NamespaceRecord,
  EventRecord,
} from '@/renderer/services/scope-manager/types';
import type { ProjectArea } from '@principal-ai/principal-view-core';
```

Then a mechanical pass — the compiler will list every site once `model.ts` is missing:

- `Scope` → `ScopeRecord` (type references)
- `Namespace` → `NamespaceRecord`
- `Event` → `EventRecord`
- `scope.id` → `scope.name` (~25 sites in `FileCityExplorer.tsx` plus the scope-tree path encoder in `scopeTreePaths.ts:23-35` and the modal labels in `AddToScopeModal.tsx`)
- `scope.description` → `scope.description ?? ''` at the 2-3 sites that render it (`ScopeInfoOverlay.tsx:156`, modal preview)
- `ns.color` → `ns.color ?? pickNamespaceColor(workspace.scopes)` at the 2-3 sites that read it (`layers.ts:40-46` building highlight layers, the namespace swatch in `ScopeInfoOverlay.tsx`)

Result: zero new types defined in our codebase. The ported component reads/writes `ScopeRecord` directly, which is also what `ScopeManager` produces and accepts — no adapter layer, no parallel model to keep in sync.

The only cost is that ported file imports look slightly different from upstream's, so future upstream merges would need manual diffing on the type-name lines. Since we're forking and not tracking upstream, that cost is theoretical.

### 7. Areas — add a real area store

`ProjectArea` has no equivalent in our `ScopeWorkspace` today. We're adding one rather than deferring the feature. principal-view-core already ships everything we need to back this:

- `ProjectArea` and `AuxiliaryManifest` types (`@principal-ai/principal-view-core` root export).
- `isAuxiliaryManifest` runtime guard.
- `AuxiliaryManifestValidator` and `validateAreaScopeDisjoint` (node entrypoint — `@principal-ai/principal-view-core/node`). The latter is the cross-cutting rule: an area path must not overlap any scope path. Wire this into write paths so the UI fails loudly if a user tries to claim a path that's already in a scope.
- Persistence target: `.principal-views/auxiliary.manifest.json` (per the type doc-comment on `AuxiliaryManifest`).

Mirror the existing `services/scope-manager/` shape exactly — that pattern has already been validated and the README on it explicitly anticipates lifting it to a shared package upstream. Same boundary rules apply: keep electron-specific I/O behind an `adapters/` subfolder.

Suggested layout — parallel folder, not folded into `scope-manager` (areas and scopes are sibling concepts on disk and validated together by `validateAreaScopeDisjoint`, but they live in different files and have different schemas):

```
src/renderer/services/area-manager/
  types.ts                            ← re-export ProjectArea, AuxiliaryManifest
                                        from principal-view-core; define
                                        AddAreaInput, AreaManagerError
  model.ts                            ← pure functions: addArea, removeArea,
                                        addPathToArea, removePathFromArea
  AreaStore.ts                        ← interface
  AreaManager.ts                      ← class with load() / subscribe() /
                                        getWorkspace() — mirror ScopeManager
  adapters/
    AuxiliaryManifestStore.ts         ← file-backed implementation reading/
                                        writing .principal-views/auxiliary.manifest.json
                                        via FileSystemService (mirror
                                        CanvasFileScopeStore.ts)
    InMemoryAreaStore.ts              ← for tests / storybook
  index.ts
```

And the React provider:

```
src/renderer/dev-workspace/area-manager-provider/
  AreaManagerProvider.tsx             ← mirror ScopeManagerProvider; resolves
                                        store from repositoryPath, exposes
                                        manager + workspace + isLoaded via
                                        context; exports useAreaManager()
                                        and useAreaManagerOptional()
  index.ts
```

Mount the provider next to `ScopeManagerProvider` in whatever currently wraps the dev-workspace (grep for `ScopeManagerProvider` to find the mount site).

Cross-validation: when `submitAddToArea` runs, call `validateAreaScopeDisjoint({ areas: workspace.areas, scopes: scopeWorkspace.scopes })` (or just check the new path against current scope paths inline) before persisting. Surface failures in the modal UI rather than silently rejecting.

In the ported `FileCityExplorer`:

- Drop `initialAreas`, the localStorage `useState`, and the persistence `useEffect` (same as we did for scopes in §5).
- Read `areas` from `useAreaManagerOptional()?.workspace.areas ?? []`.
- Replace `setAreas(prev => …)` in `submitAddToArea` (`FileCityExplorer.tsx:779-803`) with `manager.addArea(...)` / `manager.addPathToArea(...)`. The branching is even simpler than scopes — just create-or-extend.

Effort: roughly **half a day** on top of the scope-manager wiring — the parallelism with `ScopeManager` means most files are mechanical translations of their scope counterparts (the model layer is tiny since `AuxiliaryManifest.areas` is a flat list, no nested namespaces/events).

### 8. Delete the existing `scope-overlay/` folder

`dev-workspace/scope-overlay/` exists only to support the legacy `FileCityPanel`. The ported `FileCityExplorer` brings its own (different, prop-driven) `ScopeInfoOverlay` plus its own internal selection state, so nothing in the new component references this folder.

Plan:

- During the port, keep the new `ScopeInfoOverlay` private to `FileCityExplorer/` (don't re-export from any top-level barrel) — that prevents accidental name clashes while the legacy code still exists.
- After the legacy `FileCityPanel` is deleted, **delete the entire `dev-workspace/scope-overlay/` folder**. That removes:
  - `ScopeInfoOverlay.tsx` (replaced by the new component's version)
  - `buildOverlay.ts`, `buildElevatedPanels.ts` (overlay-derivation helpers — the new component derives overlays internally)
  - `ScopeOverlaySelectionContext.tsx` and `useScopeOverlaySelection*` (selection lived here so the file tree could push selections into the city — no longer needed since the explorer owns its own tree)
  - `index.ts`
- Sanity check before deleting: `rg "scope-overlay" src` should return zero hits once the legacy panel is gone. If anything outside the dev-workspace turns out to reference these helpers, fix the call site rather than keeping the folder around.

### 9. Folder-expansion provider — drop the integration

The legacy `FileCityPanel.tsx:120-150` wires `useFolderExpansion()` so the **separate** files panel can drive the city's umbrella tiles. The upstream `FileCityExplorer` owns its own internal file tree and does not consume an external folder-expansion provider.

Decision: **drop the cross-panel sync.** The new component's left rail *is* the file tree the city responds to. If we still want the dev-workspace's `FeedLeftPanel` to drive the city, that's a future feature — not a port blocker. After the swap, `FolderExpansionProvider` (and `useFolderExpansion`) likely have no remaining consumers; check and delete if so.

### 10. Wrapper signature

Replacement `FileCityPanel.tsx` shrinks to roughly:

```tsx
export const FileCityPanel: React.FC<FileCityPanelProps> = ({ context, events }) => {
  const tree = context.fileTree?.data ?? null;
  const repositoryPath = context.repository?.path ?? null;
  const [cityData, setCityData] = React.useState<CityData | null>(null);
  const [isBuilding, setIsBuilding] = React.useState(false);

  React.useEffect(() => {
    if (!tree) { setCityData(null); return; }
    let cancelled = false;
    setIsBuilding(true);
    buildCityDataFromContext({ fileTree: tree, repositoryPath })
      .then(next => { if (!cancelled) setCityData(next); })
      .finally(() => { if (!cancelled) setIsBuilding(false); });
    return () => { cancelled = true; };
  }, [tree, repositoryPath]);

  const rootPath = tree?.metadata?.id ?? '';

  if (!cityData) return <Placeholder building={isBuilding} />;

  return (
    <FileCityExplorer
      cityData={cityData}
      packageRoot=""
      onBuildingOpen={(cityPath) => {
        events.emit({
          type: 'file:open',
          source: 'file-city-panel',
          timestamp: Date.now(),
          payload: { path: stripRootPath(cityPath, rootPath) },
        });
      }}
    />
  );
};
```

All the highlight-layer / elevated-panel / scope-overlay derivation that's currently in `FileCityPanel.tsx:96-163` moves *inside* `FileCityExplorer` (which already does its own version of it).

### 11. Props to keep / drop on the wrapper

Current `FileCityPanelProps` (`FileCityPanel.tsx:37-49`):

| Prop | Decision |
| --- | --- |
| `context` | Keep |
| `actions` | Keep (currently unused — leave for future) |
| `events` | Keep (we'll emit `file:open`) |
| `cityData?` | **Drop** — wrapper always builds from `context.fileTree`. Story should mock `context.fileTree` instead of bypassing the build step. |
| `highlightLayers?` | **Drop** — explorer derives its own |
| `elevatedScopePanels?` | **Drop** — explorer derives its own |
| `focusDirectory?` | **Drop** — explorer owns focus state |

Update `FileCityPanel.stories.tsx` accordingly: build a fake `PanelContextValue` whose `fileTree` slice resolves to a synthetic `RepoFileTree`, so the story exercises the same code path as production. (Or, if you'd rather not assemble a fake `RepoFileTree`, render `<FileCityExplorer>` directly in the story rather than going through the wrapper.)

---

## Things upstream does that we should keep but verify

1. **Two-pane layout with tabs (Files / Scopes)** at `FileCityExplorer.tsx:1366-1411`. Verify the tab pill renders correctly inside our panel chrome (positioned `bottom: theme.space[3]`, `left: 50%`).
2. **Pinnable focus + breadcrumb header** (`FileCityExplorer.tsx:844-1014`). Heavy use of `theme.space[2]` / `theme.colors.warning` etc. — should look right since we use the same theme provider.
3. **Folder umbrella tiles + parent-layers popup** (`FileCityExplorer.tsx:527-608`, `1287-1364`). The parent-layers popup is triggered by Cmd/Ctrl-click on a building — make sure `FileCity3D`'s click handler still surfaces modifier keys (it does in the version we depend on).
4. **`<FileTree>` from `@pierre/trees/react`** is rendered for the floating "show contents" panel at `FileCityExplorer.tsx:1265-1280`. Same package version we use — should drop in.
5. **`useTheme` from `@principal-ade/industry-theme`** matches our package — no swap needed.

## Things to test after the swap

- Open a repo, see the city build.
- Click a building → editor opens the file (proves event-bus wiring).
- Click a folder umbrella → "Open" card appears; clicking Open expands the folder and removes the umbrella.
- Double-click a folder umbrella → camera focuses; double-click again → zooms out.
- Switch to Scopes tab, "+Add" → scope shows up in `.principal-views/*.canvas` on disk (proves `ScopeManager` wiring).
- Existing scope canvases load on app start and render in the scope tree.
- Click a namespace in the tree → city highlights its paths.

## Estimated effort

- Mechanical copy + sizing/event-bus edits + type-name swap (`Scope` → `ScopeRecord`, `scope.id` → `scope.name`, optional-field fallbacks): ~half a day.
- Replacing localStorage with `ScopeManager` calls: ~half a day.
- Building `area-manager` + `AreaManagerProvider` (§7, option B): ~half a day — files are mechanical translations of their scope counterparts.
- Cleanup pass (delete legacy `FileCityPanel`, `scope-overlay/`, `folder-expansion-provider/`, story rewrite): ~2 hours.
- Manual QA against the test list above: ~1 hour.

**Total: ~2 days** for the full swap including areas.

## Order of operations

1. Create `file-city-panel/FileCityExplorer/` and copy the 8 files (everything except `model.ts`) in unchanged. Confirm what type-checks and what doesn't — the missing `./model` import is the entry point for step 2.
2. Replace every `from './model'` import with direct imports from `@/renderer/services/scope-manager/types` (and `@principal-ai/principal-view-core` for `ProjectArea`); rename `Scope`/`Namespace`/`Event` references to `ScopeRecord`/`NamespaceRecord`/`EventRecord`; replace `scope.id` with `scope.name`; add `?? ''` / `?? pickNamespaceColor(...)` fallbacks at the few sites that need them. Compiler errors are the to-do list.
3. Build `services/area-manager/` and `dev-workspace/area-manager-provider/` (§7). Mount the provider next to `ScopeManagerProvider`.
4. Strip localStorage / `initialScopes` / `initialAreas` / `persistKey` from `FileCityExplorer`. Wire `useScopeManagerOptional()` and `useAreaManagerOptional()` in their place. Replace `setScopes(...)` and `setAreas(...)` callsites with `manager.*` calls. Wire `validateAreaScopeDisjoint` into `submitAddToArea`.
5. Add `onBuildingOpen` prop and call it from `handleBuildingClick`.
6. Change container `100vh` → `100%`.
7. Rewrite `FileCityPanel.tsx` as the thin wrapper described in §10 (no `cityData?` / `highlightLayers?` / `elevatedScopePanels?` / `focusDirectory?` props).
8. Rewrite `FileCityPanel.stories.tsx` per §11 — either mock `context.fileTree` or render `<FileCityExplorer>` directly.
9. Run the test list. Once green, delete:
   - `dev-workspace/scope-overlay/` (entire folder — see §8).
   - `dev-workspace/folder-expansion-provider/` *if* nothing outside the legacy panel imported it (`rg "folder-expansion-provider" src`).
10. Bump panel version metadata in `index.tsx` if we want to signal the rewrite.
