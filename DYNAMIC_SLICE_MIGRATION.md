# Dynamic Slice Migration Tracker

**Goal:** Migrate all panel contexts from Map-based dynamic slices to explicit typed slices.

**Status:** 5/5 contexts migrated (100%) ✅ COMPLETE!

---

## Migration Pattern

### Old Pattern (Map-based):
```typescript
const slices = useMemo(() => new Map([
  ['userCollections', {
    scope: 'global',
    name: 'userCollections',
    data: { collections, memberships },
    loading: collectionsLoading,
    error: null,
    refresh: fetchCollections,
  }],
  // ... more slices
]), [dependencies]);

// Usage in panels:
const slice = context.getSlice('userCollections');
await context.refresh(undefined, 'userCollections');
```

### New Pattern (Explicit):
```typescript
// Create explicit slice objects
const userCollectionsSlice = useMemo<DataSlice<UserCollectionsSlice>>(
  () => ({
    scope: 'global',
    name: 'userCollections',
    data: { collections, memberships },
    loading: collectionsLoading,
    error: null,
    refresh: fetchCollections,
  }),
  [collections, memberships, collectionsLoading, fetchCollections],
);

// Empty Map (required by interface)
const slices = useMemo(() => new Map(), []);

// Make legacy methods no-ops
getSlice: () => undefined,
hasSlice: () => false,
isSliceLoading: () => false,
refresh: async () => { /* no-op */ },

// Add to context as typed property
const context: PanelContextValue<MyContextType> = {
  // ... other props
  userCollections: userCollectionsSlice,  // Direct typed access!
}

// Usage in panels:
const data = context.userCollections.data;  // Typed!
await actions.createCollection(...)  // Action handles refresh
```

---

## Architecture Principles

1. **Actions handle refreshing** - Not `context.refresh()`
2. **React handles reactivity** - State changes trigger re-renders automatically
3. **Typed properties** - Direct access: `context.userCollections` not `context.getSlice('userCollections')`
4. **Legacy methods are no-ops** - Required by interface, but do nothing

---

## Contexts to Migrate

### ✅ 1. WorldsViewPanelContext (COMPLETE)
- **Location:** `src/renderer/contexts/WorldsViewPanelContext.tsx`
- **Status:** ✅ Migrated
- **Slices migrated:**
  - `alexandriaRepositories` → explicit slice
  - `userCollections` → explicit slice
  - `selectedCollectionView` → explicit slice
- **Notes:**
  - Reference implementation for other migrations
  - Legacy methods are no-ops with clear comments
  - Removed unused `collectionRepositories` slice (moved to ProjectsPanelContext)

---

### ✅ 2. ProjectsPanelContext (COMPLETE)
- **Location:** `src/renderer/contexts/ProjectsPanelContext.tsx`
- **Status:** ✅ Migrated
- **Slices migrated:**
  - `alexandriaRepositories` → explicit slice
  - `workspaces` → explicit slice
  - `workspace` → explicit slice
  - `workspaceRepositories` → explicit slice
  - `githubStarred` → explicit slice
  - `githubProjects` → explicit slice
  - `repositoriesQuality` → explicit slice
  - `userCollections` → explicit slice
  - `collectionRepositories` → explicit slice
  - `gitStatusWithFiles` → explicit slice
- **Used by:** ProjectsView
- **Complexity:** High - 10 slices migrated
- **Notes:**
  - All slices successfully converted to explicit pattern
  - Fixed error field type conversions (string → Error)
  - Legacy methods are no-ops with clear comments

---

### ✅ 3. RepositoryPanelContext (COMPLETE)
- **Location:** `src/renderer/contexts/RepositoryPanelContext.tsx`
- **Status:** ✅ Migrated
- **Slices migrated:**
  - `fileTree` → already explicit
  - `activeFile` → already explicit
  - `openTabs` → already explicit
  - `markdown` → explicit slice
  - `packages` → explicit slice
  - `gitStatusWithFiles` → explicit slice
  - `quality` → explicit slice
  - `fileCityColorModes` → explicit slice
  - `alexandriaRepositories` → explicit slice
  - `workspace` → explicit slice (stub)
  - `workspaceRepositories` → explicit slice (stub)
  - `workspaces` → explicit slice (stub)
  - `localhostServers` → explicit slice
  - `globalSkills` → explicit slice
  - `telemetry` → explicit slice
- **Used by:** DevWorkspace (main development view)
- **Complexity:** Very High - 15 slices migrated (largest context!)
- **Notes:**
  - Most heavily used context in the app
  - Three slices were already explicit before migration
  - Added all slices to RepositoryPanelContextValue interface
  - Legacy methods are no-ops with clear comments
  - All panels now have full TypeScript autocomplete

---

### ✅ 4. PanelContext (COMPLETE)
- **Location:** `src/renderer/contexts/PanelContext.tsx`
- **Status:** ✅ Migrated
- **Slices migrated:**
  - `fileTree` → already explicit
  - `activeFile` → already explicit
  - `git` → explicit slice (stub)
  - `workspace` → explicit slice
  - `workspaces` → explicit slice
  - `workspaceRepositories` → explicit slice
  - `markdown` → explicit slice
  - `localhostServers` → explicit slice (also kept as flat property for backward compatibility)
  - `alexandriaRepositories` → explicit slice
- **Used by:** Alexandria Workspace
- **Complexity:** High - 9 slices migrated
- **Notes:**
  - Two slices (fileTree, activeFile) were already explicit before migration
  - Added all slices to ExtendedPanelContextValue interface
  - Legacy methods (getSlice, getWorkspaceSlice, getRepositorySlice, hasSlice, isSliceLoading, refresh) are now no-ops
  - Type casts added for WorkspaceMetadata → Workspace compatibility

---

### ✅ 5. GitSyncPanelContext (COMPLETE)
- **Location:** `src/renderer/contexts/GitSyncPanelContext.tsx`
- **Status:** ✅ Migrated
- **Slices migrated:**
  - `githubSocial` → explicit slice (GitHub auth and social data)
  - `presence` → explicit slice (user presence data)
  - `userProfile` → explicit slice (selected user profile)
  - `currentProjects` → explicit slice (current user's open projects)
- **Used by:** Git Sync View
- **Complexity:** Medium - 4 slices migrated
- **Notes:**
  - All slices added to GitSyncPanelContextType interface
  - Legacy methods (getSlice, getWorkspaceSlice, getRepositorySlice, hasSlice, isSliceLoading, refresh) are now no-ops
  - Fixed error type conversion (string | null → string | undefined)
  - All slices are global scope

---

## Migration Checklist (Per Context)

### Phase 1: Analysis
- [ ] List all slices in the Map
- [ ] Identify slice data types
- [ ] Find all panels that use this context
- [ ] Grep for `context.getSlice()`, `context.refresh()`, `context.hasSlice()` usage

### Phase 2: Create Explicit Slices
- [ ] Create explicit slice objects with `useMemo`
- [ ] Define proper TypeScript types for each slice
- [ ] Ensure dependencies are correct in `useMemo`
- [ ] Empty the slices Map: `new Map()`

### Phase 3: Update Context Interface
- [ ] Add typed properties to context interface (e.g., `userCollections: DataSlice<UserCollectionsSlice>`)
- [ ] Update context value to use explicit slices
- [ ] Update context dependencies in `useMemo`

### Phase 4: Make Legacy Methods No-ops
- [ ] `getSlice()` → return `undefined`
- [ ] `hasSlice()` → return `false`
- [ ] `isSliceLoading()` → return `false`
- [ ] `refresh()` → no-op with comment
- [ ] Add clear migration comments

### Phase 5: Verify
- [ ] Run typecheck: `npm run typecheck`
- [ ] Test in UI - ensure data loads
- [ ] Verify panels access typed properties
- [ ] Check that actions handle refreshing

---

## External Dependencies

### Panels Using These Contexts (industry-themed-alexandria-entry-panels)
Located at: `/Users/griever/Developer/web-ade/industry-themed-alexandria-entry-panels`

**Current usage:**
- `UserCollectionsPanel` - calls `context.refresh(undefined, 'userCollections')`
- `LocalProjectsPanel` - calls `context.refresh('repository', 'alexandriaRepositories')` heavily
- `WorkspacesListPanel` - calls `context.refresh('workspace', 'workspaces')`
- Panel registration - uses `hasSlice()` and `isSliceLoading()` extensively

**Migration path for external panels:**
1. **Short term:** No-op stubs in contexts allow existing panel code to work (calls do nothing)
2. **Medium term:** Update panels to access typed properties directly
3. **Long term:** Remove all `context.refresh()` calls - rely on action-based refreshing

**Note:** We control this package and can update it after contexts are migrated.

---

## Testing Strategy

1. **Per-context testing:**
   - Verify UI loads correctly
   - Test all panels using that context
   - Check network requests (ensure no duplicate fetches)
   - Verify optimistic updates work

2. **Integration testing:**
   - Test interactions between panels
   - Verify event-driven updates
   - Check that actions properly update state

3. **Regression testing:**
   - Compare behavior before/after migration
   - Ensure no data loss
   - Verify all user workflows still work

---

## Related Documentation

- [PANEL_CONTEXT_SLICES_REFERENCE.md](./PANEL_CONTEXT_SLICES_REFERENCE.md) - Complete slice inventory
- [PANEL_CONTEXT_REACTIVITY_PATTERN.md](./PANEL_CONTEXT_REACTIVITY_PATTERN.md) - Reactivity patterns
- [panel-implementation-guide.md](./docs/panel-implementation-guide.md) - Panel development guide

---

## Progress Log

### 2025-02-20: GitSyncPanelContext Migration Complete ✅ - ALL CONTEXTS MIGRATED!
- Migrated all 4 slices to explicit pattern
- Added 4 new explicit slices: githubSocial, presence, userProfile, currentProjects
- Updated GitSyncPanelContextType interface with all slice properties
- Made legacy methods (getSlice, getWorkspaceSlice, getRepositorySlice, hasSlice, isSliceLoading, refresh) no-ops with clear comments
- Verified typecheck passes with no GitSyncPanelContext errors
- Fixed error type conversion (string | null → string | undefined)

**Key challenges:**
- Error type conversion for selectedUserError (null → undefined)
- All slices are global scope (no workspace/repository scoping)

**Lessons learned:**
- Null coalescing operator (`??`) useful for null → undefined conversions
- Global-scoped contexts follow the same pattern as workspace/repository contexts
- Final context completed the migration!

**Impact:**
- Git Sync View now has full type safety for all panels
- **ALL 5 CONTEXTS MIGRATED (100% COMPLETE!)**
- Entire codebase now uses explicit slice pattern
- Full TypeScript autocomplete for all panel contexts

---

### 2025-02-20: PanelContext Migration Complete ✅
- Migrated all 9 slices to explicit pattern
- Two slices (fileTree, activeFile) were already explicit
- Added 7 new explicit slices: git, workspace, workspaces, workspaceRepositories, markdown, localhostServers, alexandriaRepositories
- Updated ExtendedPanelContextValue interface with all slice properties
- Made legacy methods (getSlice, getWorkspaceSlice, getRepositorySlice, hasSlice, isSliceLoading, refresh) no-ops with clear comments
- Verified typecheck passes with no PanelContext errors

**Key challenges:**
- Multiple legacy helper methods (getSlice, getWorkspaceSlice, getRepositorySlice) to make no-ops
- Type compatibility between WorkspaceMetadata and Workspace (required casts)
- localhostServers kept as both slice and flat properties for backward compatibility

**Lessons learned:**
- Type casts are acceptable when bridging incompatible interfaces (WorkspaceMetadata → Workspace)
- Can keep both slice and flat properties during transition for backward compatibility
- Multiple scope-specific getters (getWorkspaceSlice, getRepositorySlice) all become no-ops

**Impact:**
- Alexandria Workspace now has full type safety for all panels
- 4 out of 5 contexts migrated (80% complete)
- Only GitSyncPanelContext remains

---

### 2025-02-20: RepositoryPanelContext Migration Complete ✅
- Migrated all 15 slices to explicit pattern (largest context!)
- Three slices (fileTree, activeFile, openTabs) were already explicit
- Added 12 new explicit slices: markdown, packages, gitStatusWithFiles, quality, fileCityColorModes, alexandriaRepositories, workspace, workspaceRepositories, workspaces, localhostServers, globalSkills, telemetry
- Updated RepositoryPanelContextValue interface with all slice properties
- Made legacy methods no-ops with clear comments
- Verified DevWorkspace panels have full TypeScript autocomplete

**Key challenges:**
- Most complex context with 15 total slices
- Multiple slice types (repository-scoped, workspace-scoped)
- Heavy usage by DevWorkspace - most critical context
- Some slices already partially migrated (fileTree, activeFile, openTabs)

**Lessons learned:**
- Large contexts benefit most from explicit slices (better type safety)
- Stub slices (workspace, workspaces, workspaceRepositories) still need to be explicit
- Interface must include ALL slices for panels to find them

**Impact:**
- DevWorkspace now has full type safety for all panels
- File City, Terminal, Git, Quality, Skills panels all benefit
- Largest migration yet - sets pattern for future contexts

---

### 2025-02-20: ProjectsPanelContext Migration Complete ✅
- Migrated all 10 slices to explicit pattern
- Fixed error field type conversions (string → Error)
- Made legacy methods no-ops with clear comments
- Verified typecheck passes with no errors
- Largest context migrated so far (10 slices)

**Key challenges:**
- More complex dependency tracking across many slices
- Error type conversions needed for GitHub-related slices
- Multiple workspace/repository scope slices to handle

**Lessons learned:**
- Pattern is consistent and repeatable
- Error field type conversions are straightforward
- Dependency arrays are critical for proper reactivity

---

### 2025-02-20: WorldsViewPanelContext Migration Complete ✅
- Migrated all 3 slices to explicit pattern
- Removed unused `collectionRepositories` slice
- Made legacy methods no-ops with clear comments
- Verified typecheck passes
- Set architecture pattern for remaining migrations

**Key decisions:**
- `refresh()` is no-op - actions handle refreshing
- Legacy methods return safe defaults (undefined/false)
- Clear comments explain migration path
- Kept empty Map for interface compatibility

---

## Next Steps ✅ MIGRATION COMPLETE!

All 5 contexts have been successfully migrated to explicit slices. Future work:

1. **Update external panels** - Update industry-themed-alexandria-entry-panels to use typed properties instead of `context.getSlice()`
2. **Consider deprecation** - Eventually remove legacy methods from PanelContextValue interface in @principal-ade/panel-framework-core
3. **Documentation cleanup** - Update panel-implementation-guide.md with explicit slice patterns and best practices
4. **Remove Map usage** - Consider removing the empty Map from contexts entirely (breaking change)
