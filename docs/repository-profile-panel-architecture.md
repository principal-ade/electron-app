# RepositoryProfilePanel Architecture - Actions/Context Pattern

## Overview

This document explains how RepositoryProfilePanel will be converted from a props-based component to using the panel framework's actions/context pattern, with support for both local and remote repositories.

## Current vs. Proposed Architecture

### Current (Props-based)
```typescript
<RepositoryProfilePanel
  repositoryData={...}      // All data passed as props
  loading={...}
  error={...}
  onOpenRepository={...}    // Callbacks passed as props
  onDeleteRepository={...}
/>
```

**Problems:**
- Bypasses the panel framework
- Makes direct service calls (`RepositoryMonitoringService`, `window.mainProcess`)
- Tightly couples data fetching to the component
- Hard to test and reuse

### Proposed (Actions/Context)
```typescript
<RepositoryProfilePanel
  context={context}   // Data flows through context
  actions={actions}   // Operations through actions
  events={events}     // User interactions emit events
/>
```

**Benefits:**
- Consistent with other panels (ProjectInfoPanel, etc.)
- Testable (mock actions/context)
- Centralized data flow
- Parent controls data fetching strategy

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Parent Component                          │
│  (ProjectsView, RepositoriesView, etc.)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Context Provider                                    │    │
│  │  - currentScope.repository (local or remote)       │    │
│  │  - fileTree: DataSlice<FileTreeNode | null>        │    │
│  │  - activityData: Map<string, number>               │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Actions                                            │    │
│  │  - getLocalFileTree(repoPath)                     │    │
│  │  - getRemoteFileTree(owner, name)                 │    │
│  │  - getLineCounts(repoPath)                        │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Event Handlers                                     │    │
│  │  - repository-profile:open-requested              │    │
│  │  - repository-profile:delete-requested            │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              RepositoryProfilePanel                          │
│                                                              │
│  Reads from context:                                        │
│  - repository = context.currentScope?.repository            │
│  - fileTree = context.fileTree?.data                        │
│  - loading = context.fileTree?.loading                      │
│                                                              │
│  Derives:                                                   │
│  - cityData = buildCityDataFromFileTree(fileTree)          │
│    (transformation happens in component)                    │
│                                                              │
│  User actions:                                              │
│  - events.emit('repository-profile:open-requested')        │
│  - events.emit('repository-profile:delete-requested')      │
└─────────────────────────────────────────────────────────────┘
```

## Dual File Tree Approach (Local + Remote)

### Concept

For repositories that have both local and remote presence, we should fetch BOTH file trees and show them together. This gives users a visual understanding of:

1. **File differences** - Which files exist locally vs. remotely
2. **Sync state** - Whether local is ahead/behind/diverged from remote
3. **Uncommitted changes** - Files that are modified but not pushed
4. **Branch comparison** - Local working directory vs. remote default branch

### Repository States

```typescript
// 1. Remote-only (not cloned)
{
  path: undefined,
  github: { owner: 'foo', name: 'bar' }
}
// → Show only remote file tree
// → Show "Clone to work locally" CTA

// 2. Local-only (no remote/no GitHub)
{
  path: '/path/to/repo',
  github: undefined
}
// → Show only local file tree
// → Could show "Push to GitHub" CTA if has remote URL

// 3. Local + Remote (cloned from GitHub)
{
  path: '/path/to/repo',
  github: { owner: 'foo', name: 'bar' }
}
// → Fetch BOTH local and remote file trees
// → Show visual diff in File City
// → Highlight differences with colors/layers
```

### Enhancing Diff with Git Status

Git status provides additional information about file states:

```typescript
// From context
const gitStatus = context.gitStatus?.data;

// Enhance differences with git status
const enhancedDifferences = {
  ...differences,
  staged: gitStatus?.stagedFiles || [],        // Staged for commit
  modified: gitStatus?.modifiedFiles || [],    // Modified but not staged
  untracked: gitStatus?.untrackedFiles || [],  // New files not in git
};

// Color mapping
const getFileColor = (filePath: string) => {
  if (enhancedDifferences.staged.includes(filePath)) return 'green';      // Ready to commit
  if (enhancedDifferences.modified.includes(filePath)) return 'yellow';   // Has changes
  if (enhancedDifferences.untracked.includes(filePath)) return 'blue';    // New file
  if (enhancedDifferences.remoteOnly.includes(filePath)) return 'red';    // Deleted locally
  return 'gray';  // In sync
};
```

### Sync Status Information

Show visual indicators for repository sync state:

```typescript
interface SyncStatus {
  ahead: number;      // Commits ahead of remote
  behind: number;     // Commits behind remote
  diverged: boolean;  // Branches have diverged
  clean: boolean;     // No uncommitted changes
  synced: boolean;    // ahead === 0 && behind === 0
}

// Display sync badges
<div className="sync-status">
  {!syncStatus.synced && (
    <>
      {syncStatus.ahead > 0 && <Badge>↑ {syncStatus.ahead} ahead</Badge>}
      {syncStatus.behind > 0 && <Badge>↓ {syncStatus.behind} behind</Badge>}
    </>
  )}
  {!syncStatus.clean && <Badge>⚠ Uncommitted changes</Badge>}
</div>
```

### Visual Representation in File City

```typescript
interface CityDiffData {
  localCityData: CityData;      // Buildings for local files
  remoteCityData: CityData;     // Buildings for remote files
  differences: {
    localOnly: string[];        // Files only in local (new/untracked)
    remoteOnly: string[];       // Files only in remote (deleted locally)
    modified: string[];         // Files that differ between local/remote
    unchanged: string[];        // Files that are the same
  };
}
```

**Visualization strategies:**

1. **Side-by-side cities** - Show local city on left, remote on right
2. **Overlay with colors** - Show one city with color-coded buildings:
   - 🟢 Green: In sync with remote
   - 🟡 Yellow: Modified locally (uncommitted)
   - 🔵 Blue: New local files (untracked)
   - 🔴 Red: Deleted locally (exist on remote)
3. **Transparency/opacity** - Remote files shown semi-transparent behind local files
4. **Toggle view** - Switch between "Local", "Remote", and "Diff" views

**Recommended approach:**

```typescript
const FileCityWithDiff: React.FC<{ local: CityData; remote: CityData; differences: Diff }> = ({
  local,
  remote,
  differences,
}) => {
  const [viewMode, setViewMode] = useState<'diff' | 'local' | 'remote'>('diff');

  return (
    <div>
      {/* View mode toggle */}
      <div className="view-toggle">
        <button onClick={() => setViewMode('diff')} active={viewMode === 'diff'}>
          Diff View
        </button>
        <button onClick={() => setViewMode('local')} active={viewMode === 'local'}>
          Local ({differences.localOnly.length + differences.modified.length} changes)
        </button>
        <button onClick={() => setViewMode('remote')} active={viewMode === 'remote'}>
          Remote
        </button>
      </div>

      {/* Legend */}
      {viewMode === 'diff' && (
        <div className="legend">
          <span><Color color="green" /> In sync</span>
          <span><Color color="yellow" /> Modified</span>
          <span><Color color="blue" /> New</span>
          <span><Color color="red" /> Deleted</span>
        </div>
      )}

      {/* File City 3D */}
      {viewMode === 'local' && <FileCity3D cityData={local} />}
      {viewMode === 'remote' && <FileCity3D cityData={remote} />}
      {viewMode === 'diff' && (
        <FileCity3D
          cityData={local}
          highlightRules={[
            { files: differences.unchanged, color: 'green' },
            { files: differences.modified, color: 'yellow' },
            { files: differences.localOnly, color: 'blue' },
            { files: differences.remoteOnly, color: 'red', opacity: 0.5 },
          ]}
        />
      )}
    </div>
  );
};
```

### Supporting Local and Remote Repositories

### Repository Type Detection

The repository type is determined by the `currentScope.repository` object:

```typescript
// From context
const repository = context.currentScope?.repository;

// Detect repository type
const isLocal = !!repository?.path;
const isRemote = !repository?.path && !!repository?.github;

// Repository can have both local and remote info
interface RepositoryMetadata {
  name: string;
  path?: string;                    // Local path (if cloned)
  github?: {                        // Remote GitHub info (always present for GitHub repos)
    owner: string;
    name: string;
  };
  // ... other metadata
}
```

### File Tree - Local AND Remote

The **panel** fetches both file trees using actions:

```typescript
interface RepositoryProfilePanelActions extends PanelActions {
  getLocalFileTree: (repoPath: string) => Promise<FileTreeNode | null>;
  getRemoteFileTree: (owner: string, name: string) => Promise<FileTreeNode | null>;
}

// Implementation in parent (actions provider)
const actions: RepositoryProfilePanelActions = {
  getLocalFileTree: async (repoPath) => {
    // Get current working directory state
    return await RepositoryMonitoringService.getFileTree(repoPath);
  },

  getRemoteFileTree: async (owner, name) => {
    // Get latest commit on default branch
    const latestCommit = await GithubService.getLatestCommit(owner, name);

    // Get file tree at that commit
    const filePaths = await GithubService.getFileTreeAtCommit(owner, name, latestCommit.sha);

    // Convert filePaths array to FileTreeNode structure
    return convertPathsToFileTree(filePaths);
  },
};
```

**In the panel component (not parent):**

```typescript
const RepositoryProfilePanel: React.FC<Props> = ({ context, actions, events }) => {
  const repository = context.currentScope?.repository;

  // Panel manages its own file tree state
  const [localFileTree, setLocalFileTree] = useState<FileTreeNode | null>(null);
  const [remoteFileTree, setRemoteFileTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch file trees when repository changes
  useEffect(() => {
    if (!repository) {
      setLocalFileTree(null);
      setRemoteFileTree(null);
      return;
    }

    const fetchFileTrees = async () => {
      setLoading(true);
      try {
        const promises: Promise<void>[] = [];

        // Fetch local if available
        if (repository.path) {
          promises.push(
            actions.getLocalFileTree(repository.path).then(setLocalFileTree)
          );
        }

        // Fetch remote if available
        if (repository.github) {
          promises.push(
            actions.getRemoteFileTree(
              repository.github.owner,
              repository.github.name
            ).then(setRemoteFileTree)
          );
        }

        await Promise.all(promises);
      } catch (error) {
        console.error('Failed to fetch file trees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFileTrees();
  }, [repository, actions]);

  // ... rest of component
};
```

**Key Points:**
- **Panel fetches** file trees, not parent
- **Actions provide** the fetching capability
- **Panel manages** its own loading/error states
- **Scales better** - parent doesn't track state for every panel

### Activity Data - Provided via Repository Metadata

**Decision:** Activity data is NOT fetched via actions. It should be included in the repository metadata.

The parent component should populate `repository.activityData: Map<string, number>` before passing it to the panel through context. If not provided, the panel uses an empty Map as a fallback:

```typescript
// In the component
<ActivityHeatmap
  activityData={repositoryData.activityData || new Map()}
  theme={theme}
/>
```

This keeps activity data alongside other repository metadata (stars, forks, etc.) rather than requiring a separate action.

### Line Counts - Local Only

Some operations only make sense for local repositories:

```typescript
interface RepositoryProfilePanelActions extends PanelActions {
  getLineCounts: (repoPath: string) => Promise<Record<string, number>>;
}

// Implementation
const actions: RepositoryProfilePanelActions = {
  getLineCounts: async (repoPath: string) => {
    // Only works for local repositories
    if (window.mainProcess?.fileCityImage?.countLines) {
      return await window.mainProcess.fileCityImage.countLines(repoPath);
    }
    return {};
  },
};
```

**In the component:**

```typescript
// Only get line counts if it's a local repository
useEffect(() => {
  if (!fileTree || !repository?.path) {
    return; // Skip for remote repos
  }

  const enrichWithLineCounts = async () => {
    const lineCounts = await actions.getLineCounts(repository.path);
    // ... use line counts
  };

  enrichWithLineCounts();
}, [fileTree, repository?.path, actions]);
```

## City Data Derivation

**Important:** City data is **derived** from the file tree(s), not fetched separately.

```typescript
const RepositoryProfilePanel: React.FC<Props> = ({ context, actions, events }) => {
  // Read file trees from context
  const localFileTree = context.localFileTree?.data;
  const remoteFileTree = context.remoteFileTree?.data;
  const repository = context.currentScope?.repository;

  // State for derived city data
  const [cityDiffData, setCityDiffData] = useState<CityDiffData | null>(null);
  const [cityDataLoading, setCityDataLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'local' | 'remote' | 'diff'>('diff');

  // Derive city data from both file trees
  useEffect(() => {
    if (!localFileTree && !remoteFileTree) {
      setCityDiffData(null);
      return;
    }

    const buildCityData = async () => {
      setCityDataLoading(true);
      try {
        let localCityData: CityData | null = null;
        let remoteCityData: CityData | null = null;

        // Build local city data
        if (localFileTree) {
          const rootPath = localFileTree.metadata?.id || '';
          const rawLocalCity = buildCityDataFromFileTree(localFileTree, rootPath);

          // Enrich with actual line counts (local only)
          if (repository?.path) {
            const lineCounts = await actions.getLineCounts(repository.path);
            localCityData = enrichWithLineCounts(rawLocalCity, lineCounts);
          } else {
            localCityData = estimateLineCounts(rawLocalCity);
          }
        }

        // Build remote city data
        if (remoteFileTree) {
          const rootPath = remoteFileTree.metadata?.id || '';
          const rawRemoteCity = buildCityDataFromFileTree(remoteFileTree, rootPath);
          // Remote always uses estimated line counts
          remoteCityData = estimateLineCounts(rawRemoteCity);
        }

        // Compute differences
        const differences = computeFileTreeDiff(localFileTree, remoteFileTree);

        setCityDiffData({
          localCityData,
          remoteCityData,
          differences,
        });
      } catch (error) {
        console.error('Failed to build city data:', error);
        setCityDiffData(null);
      } finally {
        setCityDataLoading(false);
      }
    };

    buildCityData();
  }, [localFileTree, remoteFileTree, repository?.path, actions]);

  // Helper to compute file differences
  const computeFileTreeDiff = (
    local: FileTreeNode | null,
    remote: FileTreeNode | null
  ): CityDiffData['differences'] => {
    const localFiles = local ? extractFilePaths(local) : [];
    const remoteFiles = remote ? extractFilePaths(remote) : [];

    const localSet = new Set(localFiles);
    const remoteSet = new Set(remoteFiles);

    return {
      localOnly: localFiles.filter(f => !remoteSet.has(f)),    // New/untracked
      remoteOnly: remoteFiles.filter(f => !localSet.has(f)),   // Deleted locally
      modified: [],  // TODO: Compare file hashes/sizes to detect modifications
      unchanged: localFiles.filter(f => remoteSet.has(f)),
    };
  };

  // Render based on view mode
  return (
    <div>
      {/* View mode toggle */}
      <div>
        <button onClick={() => setViewMode('local')}>Local</button>
        <button onClick={() => setViewMode('remote')}>Remote</button>
        <button onClick={() => setViewMode('diff')}>Diff</button>
      </div>

      {/* Render appropriate view */}
      {viewMode === 'local' && cityDiffData?.localCityData && (
        <FileCity3D cityData={cityDiffData.localCityData} isLoading={cityDataLoading} />
      )}

      {viewMode === 'remote' && cityDiffData?.remoteCityData && (
        <FileCity3D cityData={cityDiffData.remoteCityData} isLoading={cityDataLoading} />
      )}

      {viewMode === 'diff' && cityDiffData && (
        <FileCityDiff
          localCity={cityDiffData.localCityData}
          remoteCity={cityDiffData.remoteCityData}
          differences={cityDiffData.differences}
          isLoading={cityDataLoading}
        />
      )}
    </div>
  );
};
```

**Helper Types:**

```typescript
interface CityDiffData {
  localCityData: CityData | null;
  remoteCityData: CityData | null;
  differences: {
    localOnly: string[];     // Files only in local (new/untracked)
    remoteOnly: string[];    // Files only in remote (deleted locally)
    modified: string[];      // Files that differ between local/remote
    unchanged: string[];     // Files that are the same
  };
}
```

**Why derived, not fetched?**
1. City data is a **visualization transformation** of the file tree
2. The file trees are the source of truth
3. No need to cache or store city data separately
4. Diff computation is a pure function of the two trees
5. Keeps the context interface simpler

## Context Interface

```typescript
interface RepositoryProfilePanelContext extends PanelContextValue {
  // Only the selected repository metadata is in context
  // The panel will fetch file trees on-demand using actions

  // Note: File trees are NOT in context - they're fetched via actions
  // localFileTree?: DataSlice<FileTreeNode | null>; // ❌ NOT IN CONTEXT
  // remoteFileTree?: DataSlice<FileTreeNode | null>; // ❌ NOT IN CONTEXT

  // Note: City data is NOT in context - it's derived in the component
  // cityData?: DataSlice<CityData | null>; // ❌ NOT NEEDED
}
```

**Why file trees are NOT in context:**

1. **Panel-specific data** - Only the RepositoryProfilePanel needs its file trees
2. **Multiple panels** - Multiple profile panels might be open, each with different repositories
3. **On-demand loading** - Panel fetches when it mounts, not eagerly loaded by parent
4. **Scalability** - Parent doesn't need to manage state for every possible panel
5. **Different from workspace** - Unlike dev workspace where file tree is shared across many components

**Contrast with Dev Workspace Window:**
- **Workspace**: File tree in context because many components need it (file explorer, editor, search, etc.)
- **Profile Panel**: Only this panel needs the file tree, so it fetches via actions

## Actions Interface

```typescript
interface RepositoryProfilePanelActions extends PanelActions {
  /**
   * Get local file tree from working directory
   * Implementation: RepositoryMonitoringService.getFileTree()
   */
  getLocalFileTree: (repoPath: string) => Promise<FileTree | null>;

  /**
   * Get remote file tree from GitHub default branch
   * Implementation:
   *   1. GithubService.getLatestCommit(owner, name)
   *   2. GithubService.getFileTreeAtCommit(owner, name, sha)
   *   3. PathsFileTreeBuilder.build({ files, rootPath })
   */
  getRemoteFileTree: (owner: string, name: string) => Promise<FileTree | null>;

  /**
   * Get line counts for files in a local repository
   * Implementation: window.mainProcess.fileCityImage.countLines(repoPath)
   * Returns empty object for remote repositories or if service unavailable
   */
  getLineCounts: (repoPath: string) => Promise<Record<string, number>>;
}
```

**Note:** Activity data (`Map<string, number>`) is NOT fetched via actions. It must be provided in the repository metadata through `context.currentScope.repository.activityData`. The panel will use an empty Map as fallback if not provided.

## Event Interface

```typescript
// Events emitted by the panel
interface RepositoryProfilePanelEvents {
  'repository-profile:open-requested': {
    repository: RepositoryMetadata;
  };

  'repository-profile:delete-requested': {
    repository: RepositoryMetadata;
  };
}
```

## Example: Parent Implementation

```typescript
const ProjectsView: React.FC = () => {
  const [selectedRepository, setSelectedRepository] = useState<RepositoryMetadata | null>(null);

  // Parent only manages repository selection, NOT file trees
  // File trees are fetched by the panel on-demand

  // Context for the panel - only provides repository metadata
  const context: RepositoryProfilePanelContext = {
    currentScope: {
      repository: selectedRepository,
    },
    refresh: async () => {
      // Refresh could trigger re-selection or other parent-level operations
      // The panel will re-fetch its own data
    },
  };

  // Actions implementation - provides capabilities, not data
  const actions: RepositoryProfilePanelActions = {
    getLocalFileTree: async (repoPath) => {
      // Delegates to service
      return await RepositoryMonitoringService.getFileTree(repoPath);
    },

    getRemoteFileTree: async (owner, name) => {
      // Fetches from GitHub and converts format
      const latestCommit = await GithubService.getLatestCommit(owner, name);
      const filePaths = await GithubService.getFileTreeAtCommit(owner, name, latestCommit.sha);
      return convertPathsToFileTree(filePaths);
    },

    getLineCounts: async (repoPath) => {
      // Gets line counts for local repos
      if (window.mainProcess?.fileCityImage?.countLines) {
        return await window.mainProcess.fileCityImage.countLines(repoPath);
      }
      return {};
    },

    getActivityData: async (repository) => {
      // Fetches commit activity (local or remote)
      if (repository.path) {
        return await GitService.getCommitActivity(repository.path);
      } else if (repository.github) {
        return await GithubService.getCommitActivity(
          repository.github.owner,
          repository.github.name
        );
      }
      return new Map();
    },
  };

  // Event handlers
  useEffect(() => {
    const unsubscribers = [
      events.on('repository-profile:open-requested', (event) => {
        const { repository } = event.payload;
        // Open repository in workspace
        openInWorkspace(repository);
      }),

      events.on('repository-profile:delete-requested', (event) => {
        const { repository } = event.payload;
        // Delete repository
        deleteRepository(repository);
      }),
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [events]);

  return (
    <RepositoryProfilePanel
      context={context}
      actions={actions}
      events={events}
    />
  );
};
```

## Implementation Considerations

### Edge Cases

1. **Repository with local path but no GitHub info**
   - Only fetch local file tree
   - Don't show remote comparison
   - Could show "Push to GitHub" CTA if has remote URL

2. **Repository with GitHub info but not cloned**
   - Only fetch remote file tree
   - Show "Clone to work locally" CTA
   - Disable local-specific features (line counts)

3. **Repository with both local and GitHub, but different remotes**
   - GitHub metadata points to one repo, git remote points to another
   - Need to decide: compare against GitHub metadata or git remote?
   - Recommendation: Use GitHub metadata (it's more stable)

4. **Large repositories (1000+ files)**
   - File tree fetching might be slow
   - Show loading states clearly
   - Consider pagination or lazy loading for file lists
   - FileCity3D should handle large datasets well already

5. **Private repositories**
   - Ensure GitHub token is available for remote fetches
   - Handle 403/404 errors gracefully
   - Show authentication prompt if needed

### Performance Optimizations

```typescript
// Debounce file tree fetches if repository changes rapidly
const debouncedFetchFileTrees = useMemo(
  () => debounce(fetchFileTrees, 300),
  [actions]
);

// Cancel in-flight requests when repository changes
useEffect(() => {
  const abortController = new AbortController();

  fetchFileTrees(repository, abortController.signal);

  return () => abortController.abort();
}, [repository]);

// Cache file trees by repository ID
const fileTreeCache = useRef<Map<string, FileTreeNode>>(new Map());
```

### Error Handling

```typescript
const [errors, setErrors] = useState<{
  local?: string;
  remote?: string;
  lineCounts?: string;
}>({});

// Handle partial failures gracefully
try {
  const local = await actions.getLocalFileTree(repo.path);
  setLocalFileTree(local);
} catch (error) {
  setErrors(prev => ({ ...prev, local: error.message }));
  // Still try to fetch remote even if local failed
}

// Show error states in UI
{errors.local && <Alert variant="error">Failed to load local files: {errors.local}</Alert>}
{errors.remote && <Alert variant="warning">Failed to load remote files: {errors.remote}</Alert>}
```

## Implementation Summary

**Status: ✅ COMPLETED**

The RepositoryProfilePanel has been successfully migrated to use the actions/context pattern:

### What Was Implemented

1. **Actions-based data fetching** - Panel fetches file trees via actions instead of receiving through props
2. **Remote file tree support** - Implemented using `GithubService.getLatestCommit()` + `GithubService.getFileTreeAtCommit()` + `PathsFileTreeBuilder`
3. **Event-driven user actions** - Open/delete emit events instead of callback props
4. **Type safety** - Removed all type casting, using correct `FileTree` type from `@principal-ai/repository-abstraction`
5. **Error handling** - Added fallback for missing `activityData` (`|| new Map()`)
6. **Comprehensive mocks** - Storybook stories for local-only, remote-only, and local+remote scenarios

### Key Architectural Decisions

- **File trees fetched via actions** - Not in context (unlike workspace where it's shared)
- **Activity data via repository metadata** - Not an action, provided in `repository.activityData`
- **City data derived in component** - Built from file trees, not fetched separately
- **Diff computation deferred** - Planned for future enhancement

## Migration Checklist

All items below have been implemented:

- [x] Define `RepositoryProfilePanelContext` interface (minimal - just repository)
- [x] Define `RepositoryProfilePanelActions` interface (getLocalFileTree, getRemoteFileTree, getLineCounts)
- [x] Update component props to use context/actions/events
- [x] Replace `repositoryData` prop with reading from `context.currentScope.repository`
- [x] Remove `loading`/`error` props - panel manages its own state
- [x] Replace direct service calls (`RepositoryMonitoringService`, `window.mainProcess`) with action calls
- [x] Replace callback props (`onOpenRepository`, `onDeleteRepository`) with event emissions
- [x] Implement actions in parent component (delegate to services) - See FeedPanelFramework.tsx
- [x] Implement event handlers in parent component
- [x] Add state management in panel for local/remote file trees
- [ ] Add diff computation logic in panel (deferred - future enhancement)
- [x] Keep city data derivation in component (not in context)
- [x] Test with local-only repositories (Storybook stories)
- [x] Test with remote-only repositories (Storybook stories)
- [x] Test with local + remote repositories (Storybook stories)
- [x] Test error handling (network failures, permission errors) - Error story
- [ ] Test performance with large repositories (manual testing needed)

## Architectural Decisions Summary

### 1. File Trees via Actions, Not Context

**Decision:** Panel fetches file trees using actions, parent doesn't manage file tree state.

**Rationale:**
- RepositoryProfilePanel is **self-contained** - only it needs the file trees
- Multiple panels might be open simultaneously, each with different repositories
- Parent shouldn't manage state for every panel (doesn't scale)
- Different from workspace window where file tree is shared across many components

```typescript
// ✅ GOOD - Panel fetches on-demand
const panel = () => {
  const [fileTree, setFileTree] = useState(null);
  useEffect(() => {
    actions.getLocalFileTree(repo.path).then(setFileTree);
  }, [repo]);
};

// ❌ BAD - Parent manages file tree state
const parent = () => {
  const [fileTree, setFileTree] = useState(null);
  return <Panel context={{ fileTree }} />;
};
```

### 2. Both Local AND Remote File Trees

**Decision:** Fetch both local and remote file trees to show diff visualization.

**Rationale:**
- Users need to see where they are compared to remote
- Visualize uncommitted changes, deleted files, new files
- Show sync status at file level, not just commit level
- Remote repos (not cloned) only show remote tree

### 3. City Data is Derived, Not Fetched

**Decision:** City data is computed from file trees in the component, not in context or actions.

**Rationale:**
- City data is a **visualization transformation** of file trees
- File trees are source of truth
- No need to cache city data separately
- Diff computation is pure function of local + remote trees

### 4. Git Status Enhances Diff

**Decision:** Use git status information to provide richer file state visualization.

**Rationale:**
- Git status tells us staged/modified/untracked files
- Can color-code buildings based on file state
- Shows not just what's different, but what's ready to commit
- Provides actionable information to user

### 5. Context Only Provides Repository Metadata

**Decision:** Context only contains `currentScope.repository`, not file trees or other fetched data.

**Rationale:**
- Repository metadata is shared across parent and panel
- Parent manages selection, panel manages data fetching
- Keeps context lightweight
- Clear separation of concerns

## Key Takeaways

1. **Panel fetches its own data** - Using actions, not receiving through context
2. **Actions abstract implementation** - Panel doesn't know if local or remote
3. **Events for user actions** - Parent decides how to handle open/delete
4. **City data is derived** - Transformation happens in component, not fetched
5. **Dual file trees** - Show both local and remote to visualize sync state
6. **Consistent with framework** - Uses actions/context/events pattern correctly
