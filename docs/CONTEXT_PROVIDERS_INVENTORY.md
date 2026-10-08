# Context Providers Inventory - Panel Framework Migration Tracking

**Purpose:** Track which context providers provide which slices and actions, and which need to be updated for v0.3.0+ panel support.

**Last Updated:** February 17, 2026

---

## 1. RepositoryPanelContext

**File:** `src/renderer/contexts/RepositoryPanelContext.tsx`
**Used By:** Dev Workspace panels and repository/project features
**Migration Status:** ✅ **MIGRATED** - Direct slice properties added

### Slices Provided

| Slice Name | Type | Data Source | Direct Property | Status |
|------------|------|-------------|-----------------|--------|
| `fileTree` | `DataSlice<FileTree>` | RepositoryMonitoringService | `context.fileTree` | ✅ Added |
| `active-file` | `DataSlice<ActiveFileSlice>` | FileSystemService | `context.activeFile` | ✅ Added |
| `markdown` | `DataSlice<MarkdownFile[]>` | Derived from fileTree | ❌ Not added yet | 🔄 TODO |
| `packages` | `DataSlice<PackagesSliceData>` | RepositoryMonitoringService | ❌ Not added yet | 🔄 TODO |
| `git-status` | `DataSlice<GitStatusWithFiles>` | RepositoryMonitoringService | ❌ Not added yet | 🔄 TODO |
| `quality` | `DataSlice<QualitySliceData>` | GitHubActionsService | ❌ Not added yet | 🔄 TODO |
| `localhost-servers` | `DataSlice<RunningServer[]>` | LocalhostMonitoringService | ❌ Not added yet | 🔄 TODO |
| `global-skills` | `DataSlice<GlobalSkill[]>` | FileSystemService | ❌ Not added yet | 🔄 TODO |
| `traces` | `DataSlice<RegisteredTrace[]>` | OtelCollectorService | ❌ Not added yet | 🔄 TODO |
| `fileCityColorModes` | `DataSlice<ColorModeData>` | Local state | ❌ Not added yet | 🔄 TODO |

### Actions Provided

| Action | Signature | Used By |
|--------|-----------|---------|
| `openFile` | `(filePath: string) => void` | alexandria-docs, file-editing-panels |
| `openGitDiff` | `(filePath: string, status?: string) => void` | git-changes panel |
| `setActiveFile` | `(filePath: string) => Promise<void>` | Internal |
| `navigateToPanel` | `(panelId: string) => void` | Multiple panels |

### Panels Using This Context

- ✅ `@industry-theme/alexandria-docs-panel` - Uses `activeFile`, `fileTree`
- ⚠️ `@industry-theme/file-editing-panels` - Needs `active-file`, `preferences`
- ⚠️ `@industry-theme/file-city-panel` - Needs `fileTree`, `quality`, `fileCityColorModes`
- ⚠️ `@industry-theme/repository-composition-panels` - Needs `packages`, `git-status`
- ⚠️ `@principal-ade/code-quality-panels` - Needs `quality`, `packages`

### Migration TODO

- [x] Add `fileTree` direct property
- [x] Add `activeFile` direct property
- [ ] Add `packages` direct property (for repository-composition-panels)
- [ ] Add `gitStatus` direct property (for git-changes panel)
- [ ] Add `quality` direct property (for code-quality-panels)
- [ ] Add other slices as panels get migrated

---

## 2. WorldsViewPanelContext

**File:** `src/renderer/contexts/WorldsViewPanelContext.tsx`
**Used By:** Worlds view (collections map)
**Migration Status:** ⚠️ **PENDING** - Has uncommitted changes, needs direct slice properties

### Slices Provided

| Slice Name | Type | Data Source | Direct Property | Status |
|------------|------|-------------|-----------------|--------|
| `alexandriaRepositories` | `DataSlice<AlexandriaEntry[]>` | AlexandriaService | ❌ Not added | 🔄 TODO |
| `discoveredRepositories` | `DataSlice<DiscoveredRepository[]>` | AlexandriaService | ❌ Not added | 🔄 TODO |
| `userCollections` | `DataSlice<Collection[]>` | CollectionsService | ❌ Not added | 🔄 TODO |
| `selectedCollectionView` | `DataSlice<CollectionViewData>` | Derived from collections + memberships | ❌ Not added | 🔄 TODO |

### Actions Provided

| Action | Signature | Used By |
|--------|-----------|---------|
| `createCollection` | `(name: string, description?: string) => Promise<Collection>` | collection-map panel |
| `updateCollection` | `(id: string, updates: Partial<Collection>) => Promise<void>` | collection-map panel |
| `selectCollection` | `(collection: Collection \| null) => Promise<void>` | collection-map panel |
| `addRepositoryToCollection` | `(collectionId: string, repoPath: string, metadata: any) => Promise<void>` | collection-map panel |
| `removeCollectionRepository` | `(collectionId: string, repoId: string) => Promise<void>` | collection-map panel |
| `openRepository` | `(path: string) => void` | alexandria-panels, collection-map |
| `updateRepositoryPosition` | `(collectionId: string, repoId: string, layout: RepositoryLayoutData) => Promise<void>` | collection-map panel |
| `createRegion` | `(collectionId: string, region: CustomRegion) => Promise<void>` | collection-map panel |
| `updateRegion` | `(collectionId: string, regionId: string, updates: Partial<CustomRegion>) => Promise<void>` | collection-map panel |
| `deleteRegion` | `(collectionId: string, regionId: string) => Promise<void>` | collection-map panel |
| `assignRepositoryToRegion` | `(collectionId: string, repoId: string, regionId: string \| null) => Promise<void>` | collection-map panel |

### Panels Using This Context

- ⚠️ `@industry-theme/repository-composition-panels` (CollectionMapPanel) - Needs `selectedCollectionView`
- ⚠️ `@industry-theme/alexandria-panels` (LocalProjectsPanel) - Needs `alexandriaRepositories`, `discoveredRepositories`

### Migration TODO

- [ ] Add `selectedCollectionView` direct property
- [ ] Add `alexandriaRepositories` direct property
- [ ] Add `discoveredRepositories` direct property
- [ ] Add `userCollections` direct property

---

## 3. TerminalContext

**File:** `src/renderer/contexts/TerminalContext.tsx`
**Used By:** Terminal panels (xterm, ghostty)
**Migration Status:** ❓ **UNKNOWN** - Need to check if terminal panels use v0.3.0

### Slices Provided

| Slice Name | Type | Data Source | Direct Property | Status |
|------------|------|-------------|-----------------|--------|
| `terminalSessions` | Not a DataSlice - direct property | Local state | N/A | ✅ Custom |

### Actions Provided

| Action | Signature | Used By |
|--------|-----------|---------|
| `createSession` | `(sessionId: string, ...params) => void` | Terminal panels |
| `closeSession` | `(sessionId: string) => void` | Terminal panels |
| `sendCommand` | `(sessionId: string, command: string) => void` | Terminal panels |

### Panels Using This Context

- ✅ `@industry-theme/xterm-terminal-panel` - Already migrated (v0.4.2)
- ⚠️ `@industry-theme/ghostty-terminal-panel` - Still on v0.1.10

### Migration TODO

- [ ] Verify xterm-terminal-panel works with current context
- [ ] Check if ghostty-terminal-panel needs updates when it migrates

---

## 4. AgentHighlightContext

**File:** `src/renderer/contexts/AgentHighlightContext.tsx`
**Used By:** File City panel (for agent highlight layers)
**Migration Status:** ✅ **COMPATIBLE** - Provides direct properties, not slices

### Data Provided

- `highlightLayers` - Array of highlight layer data (not a DataSlice)

### Actions Provided

| Action | Signature | Used By |
|--------|-----------|---------|
| `addHighlightLayer` | `(layer: HighlightLayer) => void` | Agent-driven panels |
| `removeHighlightLayer` | `(layerId: string) => void` | Agent-driven panels |

### Panels Using This Context

- ✅ `@industry-theme/file-city-panel` - Receives via merged context in DevWorkspacePanelFramework

### Migration TODO

- [x] No changes needed - already provides direct properties

---

## 5. ProjectsPanelContext

**File:** `src/renderer/contexts/ProjectsPanelContext.tsx`
**Used By:** Projects panel
**Migration Status:** ❓ **UNKNOWN** - Need to audit

### Slices Provided

*TODO: Document slices after auditing the file*

### Actions Provided

*TODO: Document actions after auditing the file*

### Migration TODO

- [ ] Audit ProjectsPanelContext
- [ ] Document slices and actions
- [ ] Add direct slice properties if needed

---

## 6. UserCollectionsContext

**File:** `src/renderer/contexts/UserCollectionsContext.tsx`
**Used By:** Collection-related panels
**Migration Status:** ❓ **UNKNOWN** - Need to audit

### Slices Provided

*TODO: Document slices after auditing the file*

### Actions Provided

*TODO: Document actions after auditing the file*

### Migration TODO

- [ ] Audit UserCollectionsContext
- [ ] Document slices and actions
- [ ] Add direct slice properties if needed

---

## 7. GitSyncPanelContext

**File:** `src/renderer/contexts/GitSyncPanelContext.tsx`
**Used By:** Git sync panels
**Migration Status:** ❓ **UNKNOWN** - Need to audit

### Slices Provided

*TODO: Document slices after auditing the file*

### Actions Provided

*TODO: Document actions after auditing the file*

### Migration TODO

- [ ] Audit GitSyncPanelContext
- [ ] Document slices and actions
- [ ] Add direct slice properties if needed

---

## Migration Pattern Reference

### For Each Migrated Panel Package

When a panel package is migrated to v0.3.0+ and starts using typed context:

1. **Check panel's context interface** (from package's types)
2. **Identify required slices** (properties on the context interface)
3. **Update host context provider:**
   ```typescript
   // Create slice object directly
   const mySlice: DataSlice = useMemo(() => ({
     scope: 'repository',
     name: 'mySlice',
     data: myData,
     loading: myLoading,
     error: myError,
     refresh: async () => { ... }
   }), [myData, myLoading, myError]);

   // Add to Map
   const slices = new Map([
     ['mySlice', mySlice],
     // ... other slices
   ]);

   // Add to context interface
   interface MyContextValue extends PanelContextValue {
     mySlice: DataSlice;
   }

   // Add to context object
   const context = {
     slices: slices,
     mySlice: mySlice,  // Direct reference
     // ... other properties
   };
   ```

4. **Update dependency array** with the slice object
5. **Run TypeScript** to verify
6. **Test the panel** in the app

### Quick Reference: Panel → Slices Mapping

| Panel Package | Required Slices | Context Provider |
|---------------|----------------|------------------|
| alexandria-docs-panel | `activeFile`, `fileTree` | RepositoryPanelContext |
| file-editing-panels | `active-file`, `preferences` | RepositoryPanelContext |
| file-city-panel | `fileTree`, `quality`, `fileCityColorModes` | RepositoryPanelContext |
| repository-composition-panels | `packages`, `git-status`, `selectedCollectionView` | RepositoryPanelContext + WorldsViewPanelContext |
| code-quality-panels | `quality`, `packages` | RepositoryPanelContext |
| xterm-terminal-panel | `terminalSessions` | TerminalContext |
| ghostty-terminal-panel | `terminalSessions` | TerminalContext |

---

## Progress Tracker

### Context Providers

- [x] RepositoryPanelContext - Partially migrated (2/10 slices)
- [ ] WorldsViewPanelContext - Needs migration (0/4 slices)
- [ ] TerminalContext - Need to verify
- [x] AgentHighlightContext - No changes needed
- [ ] ProjectsPanelContext - Not audited
- [ ] UserCollectionsContext - Not audited
- [ ] GitSyncPanelContext - Not audited

### Panel Packages (from migration plan)

**GROUP 1 - File Management:**
- [x] alexandria-docs-panel ✅ Migrated + Host Updated
- [ ] file-editing-panels ⚠️ Package migrated, host needs update
- [ ] code-quality-panels ⚠️ Not yet migrated

**GROUP 2 - GitHub/Collaboration:**
- [x] github-panels ✅ Migrated (v0.3.0)
- [ ] git-sync-panels ⚠️ Not yet migrated
- [ ] alexandria-panels 🔄 Mixed state

**GROUP 3 - Terminal:**
- [x] xterm-terminal-panel ✅ Migrated (v0.4.2)
- [ ] ghostty-terminal-panel ⚠️ Not yet migrated

**GROUP 4 - Visualization:**
- [x] principal-view-panels ✅ Migrated (v0.4.2)
- [ ] file-city-panel 🔄 Package migrated, host needs update
- [ ] repository-composition-panels 🔄 Package migrated, host needs update

**GROUP 5 - Event-Driven:**
- [ ] agent-driven-ui-panels ⚠️ Not yet migrated
- [ ] localhost-panels ⚠️ Not yet migrated
- [ ] backlogmd-kanban-panel ⚠️ Not yet migrated

---

**Next Actions:**
1. Complete RepositoryPanelContext migration (add remaining slices)
2. Migrate WorldsViewPanelContext
3. Audit and document unknown contexts
4. Test all migrated panels
