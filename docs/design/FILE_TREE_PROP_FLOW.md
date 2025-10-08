# File Tree Prop Flow Analysis

## Current Flow

```
RepositoryManager (manages state)
  ↓ (passes fileTree, cacheService as props)
DevelopmentWorkspace (distributes to children)
  ↓
  ├─> FileTreeTab (via panelContentMap)
  ├─> RepositorySearchTab (via fileTrees map)
  ├─> RepoSourceArchitecturePanelSimple (gets cacheService)
  └─> CityMapManager (gets fileTree directly)
```

## Components Using fileTree

### 1. FileTreeTab
**Current**: Gets `fileTree` via prop from DevelopmentWorkspace
**Usage**: Displays file tree
**Should be self-managed?**: **YES** - Already wrapped in `RepositoryPanelProvider`

### 2. RepositorySearchTab
**Current**: Gets `fileTrees` Map (includes fileTree) from DevelopmentWorkspace
**Usage**: Searches across files in the tree
**Should be self-managed?**: **NO** - Needs coordination with DevelopmentWorkspace for search state
**Why**: Search results, selected file, highlight layers all coordinated at parent level

### 3. RepoSourceArchitecturePanelSimple
**Current**: Gets `cacheService` (MonitoredFileTreeService) prop
**Usage**: Loads package layers and architecture data
**Should be self-managed?**: **YES** - Can use `useRepositoryData` for packages

### 4. CityMapManager (inside CityVisualizationPanel)
**Current**: Gets `fileTree` prop
**Usage**: Renders 3D city visualization of file tree
**Should be self-managed?**: **MAYBE** - Could subscribe independently, but coordinated with other views

## Why RepositoryManager Manages State

Looking at RepositoryManager.tsx lines 421-577:

```typescript
// Handles source selection
// Loads file tree when source changes
// Caches loaded trees
// Manages package layers
// Coordinates city visualization cache
```

**Problem**: RepositoryManager is doing too much:
- State management
- Loading coordination
- Cache management
- **All of this is duplicated by RepositoryDataCache!**

## Recommendation

### Phase 1: Make DevelopmentWorkspace Self-Sufficient (What we're doing now)

**DevelopmentWorkspace**:
- Subscribe to `useRepositoryData` for fileTree
- Keep local fileTree state for search coordination
- Pass fileTree to children that need coordination (Search, CityMap)

**RepositoryManager**:
- Stop managing fileTree state
- Stop passing fileTree/cacheService props
- Let DevelopmentWorkspace be self-sufficient

**FileTreeTab**:
- Already migrated to `RepositoryPanelProvider` ✅
- Gets updates automatically

### Phase 2: Clean Up Architecture Panel

**RepoSourceArchitecturePanelSimple**:
- Remove `cacheService` prop
- Use `useRepositoryData` for packages data
- Subscribe to cache updates

### Phase 3: (Optional) Make CityMapManager Self-Managed

**CityMapManager**:
- Could subscribe to `useRepositoryData` itself
- OR keep getting fileTree from parent for coordination

## What Gets Self-Managed vs Coordinated?

**Self-Managed** (each component subscribes independently):
- ✅ FileTreeTab - Simple display, no coordination needed
- ✅ GitChangesPanel - Already self-managed via RepositoryPanelProvider
- ✅ Package/Architecture panels - Just need packages data

**Coordinated** (parent manages and passes down):
- ❌ Search results - Needs coordination with file selection, highlights
- ❓ City visualization - Could go either way
- ❌ File selection state - Shared across multiple views

## Proposed Changes

### 1. Remove fileTree prop passing from RepositoryManager

```diff
  <DevelopmentWorkspace
    repository={repository}
-   fileTree={fileTree}
-   cacheService={cacheService}
-   fileTreeSourceService={fileTreeSourceService}
  />
```

### 2. DevelopmentWorkspace becomes self-sufficient

```typescript
// Already added in our changes:
const { data: cacheData } = useRepositoryData(repositoryPath, {
  autoLoad: true,
  subscribe: true,
});

useEffect(() => {
  if (cacheData?.fileTree) {
    setFileTree(cacheData.fileTree);
  }
}, [cacheData?.fileTree]);
```

### 3. Remove MonitoredFileTreeService entirely

- Delete the service
- Delete FileTreeInvalidator
- Remove all imports and instances

## Benefits

1. **Single Source of Truth**: Only RepositoryDataCache manages file trees
2. **Automatic Updates**: All components get cache sync events
3. **Less Prop Drilling**: Components manage their own subscriptions
4. **Simpler Code**: Remove 361 lines of MonitoredFileTreeService
5. **Consistent**: Same pattern everywhere (RepositoryPanelProvider + hooks)

## Answer to Your Question

**"How many things are getting fileTree from DevelopmentWorkspace and should they be self-managed?"**

**Answer**:
- **FileTreeTab**: Already self-managed ✅
- **RepositorySearchTab**: Keep coordinated (needs parent state)
- **Architecture Panel**: Should be self-managed (use hook for packages)
- **CityMapManager**: Keep coordinated (OR make self-managed, either works)

**RepositoryManager should NOT manage fileTree at all**. It's a coordination layer problem, not a data problem. Let each view manage its own subscription to the cache.
