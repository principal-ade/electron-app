# Git-Backed Collections Cleanup

## Context

The git-backed collections system (WorldsView + CollectionsService) stores user repository collections as JSON files committed to a user's `web-ade-collections` GitHub repo. This system has been removed from web-ade and needs to be removed from the desktop app too.

The equivalent cleanup was done in web-ade on 2026-04-22 (commits `8e77b4d` and `df9e5cf` on the `main` branch of `web-ade`). The desktop app has a parallel implementation over IPC rather than HTTP, but the concept and scope are the same.

Note: the **starred collections** system (S3-backed, `src/lib/starred-collections/` in web-ade, `WebAdeService.getStarredCollections()` in the desktop app) is a separate feature and should not be touched.

---

## Files to Delete Entirely

These files have no purpose outside git-backed collections.

### Renderer — WorldsView

| File | Role |
|---|---|
| `src/renderer/principal-window/views/WorldsView/WorldsView.tsx` | The WorldsView page component |
| `src/renderer/principal-window/views/WorldsView/WorldsViewHeader.tsx` | WorldsView header bar |
| `src/renderer/principal-window/views/WorldsView/index.ts` | Barrel export |
| `src/renderer/contexts/WorldsViewPanelContext.tsx` | WorldsView context provider (~1046 lines), only consumer of WorldsView |
| `src/renderer/contexts/UserCollectionsContext.tsx` | Collections context — never mounted anywhere in the app (dead code) |
| `src/renderer/components/CreateCollectionModal.tsx` | Create-collection modal, only imported by `WorldsView.tsx` |
| `src/renderer/panels/CollectionRepositoriesPanel.tsx` | Panel only used in collections context |

### IPC Stack — Main Process

| File | Role |
|---|---|
| `src/main/services/CollectionsService.ts` | Main-process IPC handler (~600 lines), registers 17 `collections:*` IPC channels |
| `src/main/adapters/GitHubFileSystemAdapter.ts` | GitHub Contents API adapter, only used by `CollectionsService` |

### IPC Stack — Shared / Preload

| File | Role |
|---|---|
| `src/shared/main-process-api-interfaces/CollectionsAPI.ts` | IPC contract: `CollectionsAPI` interface, `CollectionsAPIEvent` enum, all request/response types |
| `src/renderer/main-process-api/CollectionsService.ts` | Renderer-side `window.mainProcess.collections.*` wrapper |
| `src/window/main-process-api-implementations/collectionsApi.ts` | Preload bridge: `ipcRenderer.invoke` → `collectionsApi` |

### Principal-views Storyboards

| Path | Role |
|---|---|
| `.principal-views/collections-flow/` (whole directory) | Collections telemetry workflow docs |
| `.principal-views/collection-map-interactions/` (whole directory) | Overworld map interaction docs |

---

## Files to Edit

### `src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx`
- Remove `import { WorldsView } from '../../views/WorldsView';` (line ~10)
- Remove `{activeView === 'worlds' && <WorldsView />}` (line ~573)

### `src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx`
- Remove `showWorldsButton` state and its preference/event wiring (lines ~46–71)
- Remove the `'worlds'` nav item from the `navItems` array (lines ~132–148)

### `src/renderer/principal-window/views/Settings/components/GeneralSettings.tsx`
- Remove the "Show Worlds Button" settings row and its `showWorldsButton` state variable (lines ~41, 77, 1228–1298)

### `src/shared/types/userPreferences.types.ts`
- Remove `'worlds'` from the `InteractiveShellNavigationView` union type (line ~30)
- Remove `showWorldsButton?: boolean` from the `UserPreferences` interface (line ~135)

### `src/shared/main-process-api-interfaces/index.ts`
- Remove `import type { CollectionsAPI } from './CollectionsAPI'` (line ~1)
- Remove `collections: CollectionsAPI` from the `MainProcessAPI` interface (line ~86)

### `src/window/preload.ts`
- Remove `import { collectionsAPI } from './main-process-api-implementations/collectionsApi'` (line ~53)
- Remove `collections: collectionsAPI` from the `mainProcessExposure` object (line ~97)

### `src/main/initialization.ts`
- Remove `import { registerCollectionsHandlers } from './services/CollectionsService'` (line ~79)
- Remove `registerCollectionsHandlers()` call (line ~292)

### `src/renderer/hooks/usePanelPersistence.ts`
- Remove `'worldsView'` from the `viewKey` union type (line ~51)

### `src/renderer/contexts/ProjectsPanelContext.tsx`
This is the most invasive edit. The context duplicates collections state for a separate panel surface. Remove:
- Imports: `UserCollectionsSlice`, `UserCollectionsPanelActions` from `@industry-theme/alexandria-panels`; `Collection`, `CollectionMembership` from `@principal-ai/alexandria-collections`; `CollectionsService` from the renderer service (lines ~35–50)
- `UserCollectionsPanelActions` from the context type extension (line ~65)
- `userCollections: DataSlice<UserCollectionsSlice>` from the context type (line ~151)
- Six collections state vars: `collections`, `collectionMemberships`, `collectionsLoading`, `collectionssaving`, `collectionsError`, `collectionsGitHubRepoExists`, `collectionsGitHubRepoUrl` (lines ~247–257)
- `fetchCollections` callback (lines ~875–905)
- Event listener for `'industry-theme.user-collections:collection:selected'` (lines ~961–964)
- `userCollectionsSlice` useMemo (lines ~1237–1261)
- Action methods: `createCollection`, `updateCollection`, `deleteCollection`, `addRepositoryToCollection`, `removeRepositoryFromCollection`, `enableGitHubSync` (lines ~1715–1913)

### Feed-related files (`'collections'` feedMode)

The feed panel has a `'collections'` mode that was wired to collections data. Remove it from:

| File | What to remove |
|---|---|
| `src/renderer/panels/FeedLeftPanel.tsx` | `import { CollectionsList }` + `'collections'` subtab state + render branch |
| `src/renderer/panels/ActivityFeedCardPanel.tsx` | `feedMode === 'collections'` conditional branches (lines ~56, 92, 222, 329, 374) |
| `src/renderer/feed-view/FeedPanelFramework.tsx` | `'collections'` from `feedMode` union + `CollectionRepositoriesPanel` usage (lines ~175–191, 1545, 1634) |
| `src/renderer/principal-window/views/FeedView/FeedView.tsx` | `'collections'` from the `FeedMode` type (line ~341) |

### `src/renderer/contexts/GitSyncPanelContext.tsx`
- Verify whether `UserCollectionsSlice` / `UserCollectionsPanelActions` imports are actually used in the context body. If they are only imported and not referenced, remove the imports.

---

## Verify Before Deleting

- **`src/renderer/panels/CollectionsList.tsx`** — this panel calls `WebAdeService.getStarredCollections()`, which is the S3-backed starred collections API, not git-backed. Decide whether the social feed "Collections" tab stays. If yes, keep this file but remove it from `FeedLeftPanel`'s subtab only if the tab is being removed. If the tab goes, this file can be deleted.

- **`@principal-ai/alexandria-collections` package** — once all the above is removed, check if anything else in the codebase still imports from this package. If not, remove it from `package.json`.

---

## Existing Doc to Update

`docs/collections-integration.md` describes the git-backed collections architecture as a reference for building the integration. Once the cleanup is done, that document can be deleted or repurposed to describe the starred collections system instead.
