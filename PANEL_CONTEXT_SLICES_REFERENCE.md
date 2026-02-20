# Panel Context Slices Reference

## Overview

This document lists all available data slices that panels can access through `PanelContextValue`. Slices provide reactive data that panels can subscribe to for automatic updates.

## Migration Status

We are migrating from **dynamic slices** (only in Map) to **explicit slices** (typed properties on the context interface). This provides better TypeScript support and IDE autocomplete.

### Overall Progress (All Contexts)
- ✅ **Contexts Migrated**: 5/5 (100%) - COMPLETE! 🎉
- ✅ **WorldsViewPanelContext**: Complete (3/3 slices)
- ✅ **ProjectsPanelContext**: Complete (10/10 slices)
- ✅ **RepositoryPanelContext**: Complete (15/15 slices) - LARGEST!
- ✅ **PanelContext**: Complete (9/9 slices)
- ✅ **GitSyncPanelContext**: Complete (4/4 slices)

See [DYNAMIC_SLICE_MIGRATION.md](./DYNAMIC_SLICE_MIGRATION.md) for detailed migration tracking.

## Explicit Slices ✅

These slices are typed properties on `RepositoryPanelContextValue` and can be accessed directly:

```typescript
// Typed property access (preferred)
const fileTree = context.fileTree.data;
const activeFile = context.activeFile.data;
```

| Slice Name | Property | Type | Scope | Description |
|-----------|----------|------|-------|-------------|
| `fileTree` | `context.fileTree` | `DataSlice<FileTree>` | Repository | Complete file tree for current repository, includes deleted files from git status |
| `activeFile` | `context.activeFile` | `DataSlice<ActiveFileSlice>` | Repository | Currently active file for markdown/file viewers |
| `openTabs` | `context.openTabs` | `DataSlice<unknown[]>` | Workspace | Currently open tabs in DevWorkspace (for checking selection state) |

## Dynamic Slices ❌ (Need Migration)

These slices are only in the Map and must be accessed via `getSlice()`:

```typescript
// Map access (legacy)
const slice = context.getSlice('markdown');
const data = slice?.data;
```

### Repository Scope

| Slice Name | Access Method | Type | Description | Migration Priority |
|-----------|---------------|------|-------------|-------------------|
| `markdown` | `context.getSlice('markdown')` | `Array<{path, title, lastModified}>` | List of markdown files in repository | 🟡 Medium - Used by docs/markdown panels |
| `packages` | `context.getSlice('packages')` | `PackagesSliceData` | Package composition data (monorepo packages) | 🟡 Medium - Used by PackageComposition panel |
| `gitStatusWithFiles` | `context.getSlice('gitStatusWithFiles')` | `GitStatusWithFiles` | Git status with file lists (staged, modified, untracked, deleted) | 🔴 High - Used by GitChanges, GitDiff panels |
| `quality` | `context.getSlice('quality')` | `{packages, lastUpdated, fileCoverage, fileMetrics}` | Code quality metrics from GitHub Actions | 🟢 Low - Used by CodeQuality panel |
| `fileCityColorModes` | `context.getSlice('fileCityColorModes')` | `{selectedColorMode, qualityData}` | File city visualization color modes | 🟢 Low - Used by FileCity panel |
| `alexandriaRepositories` | `context.getSlice('alexandriaRepositories')` | `{repositories: AlexandriaEntry[]}` | All registered Alexandria repositories | 🟢 Low - Used by LocalProjects panel |

### Workspace Scope

| Slice Name | Access Method | Type | Description | Migration Priority |
|-----------|---------------|------|-------------|-------------------|
| `localhostServers` | `context.getSlice('localhostServers')` | `RunningServer[]` | Running localhost servers detected on machine | 🟢 Low - Used by LocalhostBrowser panel |
| `globalSkills` | `context.getSlice('globalSkills')` | `{skills: GlobalSkill[]}` | Global skills from ~/.claude/skills and ~/.agent/skills | 🟡 Medium - Used by AgenticResources panel |
| `telemetry` | `context.getSlice('telemetry')` | `RegisteredTrace[]` | OTEL telemetry traces from MessagePort | 🟡 Medium - Used by TraceViewer, TraceList panels |

## Data Structures

### FileTree
```typescript
interface FileTree {
  sha: string;                    // Content-based hash for change detection
  allFiles: FileInfo[];           // All files in repository
  directoryMap: Map<string, DirectoryNode>;
  rootNode: DirectoryNode;
}

interface FileInfo {
  path: string;                   // Absolute path
  relativePath?: string;          // Path relative to repo root
  name?: string;                  // File name
  size: number;
  lastModified: Date;
}
```

### ActiveFileSlice
```typescript
interface ActiveFileSlice {
  path: string;                   // Absolute file path
  content: string;                // File content
  type: string;                   // File type (markdown, md, mdx, etc.)
  source: FileTreeSource;         // Source information
}
```

### GitStatusWithFiles
```typescript
interface GitStatusWithFiles {
  branch: string;
  ahead: number;
  behind: number;
  hash: string;                   // Hash for change detection
  stagedFiles: string[];
  modifiedFiles: string[];
  untrackedFiles: string[];
  deletedFiles: string[];
}
```

### PackagesSliceData
```typescript
interface PackagesSliceData {
  packages: Array<{
    name: string;
    path: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>;
}
```

### RegisteredTrace
```typescript
interface RegisteredTrace {
  traceId: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  spanCount: number;
  serviceName: string;
  hasErrors: boolean;
  scope: {
    name: string;
    version?: string;
    attributes?: Record<string, any>;
  };
  registryStatus: 'matched' | 'unmatched';
  routing: {
    sourceUrl: string;
    destination: string;
  };
  otlpData?: any;
}
```

## Usage Examples

### Accessing Explicit Slices (Preferred)

```typescript
import type { PanelComponentProps } from '@principal-ade/panel-framework-core';

export const MyPanel: React.FC<PanelComponentProps> = ({ context }) => {
  // Direct property access - type-safe and autocomplete works
  const fileTreeData = context.fileTree.data;
  const activeFileData = context.activeFile.data;
  const openTabsData = context.openTabs.data;

  // Check loading state
  if (context.fileTree.loading) {
    return <div>Loading file tree...</div>;
  }

  // Use the data
  return <div>{fileTreeData?.allFiles.length} files</div>;
};
```

### Accessing Dynamic Slices (Legacy - Will be migrated)

```typescript
import type { PanelComponentProps } from '@principal-ade/panel-framework-core';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';

export const MyPanel: React.FC<PanelComponentProps> = ({ context }) => {
  // Must use getSlice - no autocomplete, manual type casting
  const gitSlice = context.getSlice('gitStatusWithFiles');
  const gitStatus = gitSlice?.data as GitStatusWithFiles | null;

  if (!gitStatus) {
    return <div>No git data</div>;
  }

  return <div>{gitStatus.modifiedFiles.length} modified files</div>;
};
```

### Reactive Usage (Detecting Changes)

```typescript
import { useMemo, useEffect, useRef } from 'react';

export const MyPanel: React.FC<PanelComponentProps> = ({ context }) => {
  // Extract change indicator for reactivity
  const fileTreeSha = useMemo(() => {
    return context.fileTree.data?.sha || null;
  }, [context.fileTree]);

  // Keep ref for stable access
  const contextRef = useRef(context);
  contextRef.current = context;

  // Effect triggers when SHA changes
  useEffect(() => {
    const ctx = contextRef.current;
    const data = ctx.fileTree.data;

    console.log('File tree changed:', data?.sha);
    // Reload panel data...
  }, [fileTreeSha]);
};
```

### Checking Tab State (New!)

```typescript
export const StoryboardListPanel: React.FC<PanelComponentProps> = ({
  context,
  events
}) => {
  const handleCanvasClick = (canvasId: string) => {
    // Check if canvas is already open in a tab
    const openTabs = context.openTabs.data as Array<{
      contentType: string;
      canvasId?: string;
    }>;

    const isOpen = openTabs.some(tab =>
      tab.contentType === 'canvas-editor' && tab.canvasId === canvasId
    );

    if (!isOpen) {
      // Only emit event if not already open
      events.emit({
        type: 'custom',
        source: 'storyboard-list-panel',
        payload: { action: 'openCanvas', canvasId, ... }
      });
    }
  };
};
```

## Migration Plan

### Phase 1: File-Related Slices (High Impact)
- [ ] Migrate `gitStatusWithFiles` to `git` - Used by GitChanges, GitDiff panels
- [ ] Migrate `packages` - Used by PackageComposition panel
- [ ] Migrate `markdown` - Used by Docs, Markdown panels

### Phase 2: Workspace Slices (Medium Impact)
- [ ] Migrate `telemetry` - Used by TraceViewer, TraceList panels
- [ ] Migrate `globalSkills` - Used by AgenticResources panel

### Phase 3: Visualization Slices (Low Impact)
- [ ] Migrate `quality` - Used by CodeQuality panel
- [ ] Migrate `fileCityColorModes` - Used by FileCity panel
- [ ] Migrate `localhostServers` - Used by LocalhostBrowser panel
- [ ] Migrate `alexandriaRepositories` - Used by LocalProjects panel

### Migration Steps (Per Slice)

1. **Add to RepositoryPanelContextValue interface**
   ```typescript
   interface RepositoryPanelContextValue extends PanelContextValue {
     // ... existing
     git: DataSlice<GitStatusWithFiles>;  // Add new property
   }
   ```

2. **Create typed slice object**
   ```typescript
   const gitSlice: DataSlice<GitStatusWithFiles> = useMemo(
     () => ({
       scope: 'repository' as const,
       name: 'gitStatusWithFiles',
       data: stableGitStatusData,
       loading: gitStatusLoading,
       error: null,
       refresh: async () => { /* ... */ },
     }),
     [stableGitStatusData, gitStatusLoading, repositoryPath],
   );
   ```

3. **Add to context value**
   ```typescript
   const context: RepositoryPanelContextValue = useMemo(
     () => ({
       // ... existing
       git: gitSlice,
     }),
     [/* ... deps */, gitSlice],
   );
   ```

4. **Update consuming panels**
   ```typescript
   // Before
   const gitSlice = context.getSlice('gitStatusWithFiles');
   const gitStatus = gitSlice?.data as GitStatusWithFiles;

   // After
   const gitStatus = context.git.data;
   ```

5. **Keep Map entry for backwards compatibility** (optional during transition)
   ```typescript
   ['gitStatusWithFiles', gitSlice as DataSlice<unknown>],
   ```

## Benefits of Migration

### For Panel Developers
- ✅ TypeScript autocomplete works
- ✅ Type-safe - no manual casting needed
- ✅ Compile-time errors if slice doesn't exist
- ✅ Better IDE documentation tooltips

### For Codebase Maintainability
- ✅ Easy to find all slice usages (TypeScript "Find References")
- ✅ Refactoring is safer (rename property updates all usages)
- ✅ Clear contract - interface shows all available data

### Performance
- ✅ Slightly faster (no Map lookup)
- ✅ Same reactivity as before (still triggers re-renders)

## Related Documentation

- [PANEL_CONTEXT_REACTIVITY_PATTERN.md](./PANEL_CONTEXT_REACTIVITY_PATTERN.md) - How to use slices reactively
- [panel-implementation-guide.md](./docs/panel-implementation-guide.md) - Creating new panels
- [RepositoryPanelContext.tsx](./src/renderer/contexts/RepositoryPanelContext.tsx) - Context implementation

## Questions / Decisions Needed

1. Should we keep Map entries for backwards compatibility during migration?
2. Should we rename `gitStatusWithFiles` to `git` during migration?
3. Should we batch migrate related slices (e.g., all git-related at once)?
4. Do we need deprecation warnings for Map access?
