# Git Status Type Migration - Architecture & Implementation

## Overview

This document describes the migration of git status types to a unified system using `GitStatusWithFiles` from `@principal-ai/repository-abstraction`, including the addition of a content hash field for React optimization.

## Problem Statement

The GitChangesPanel was experiencing excessive re-renders on hover due to unstable object references in the git status data. Every time git status was fetched, new objects were created even when the content hadn't changed, causing React's referential equality checks to fail and triggering unnecessary re-renders.

## Solution Architecture

### Three-Tier Architecture

1. **Primitive Layer**: `@principal-ai/repository-monitoring`
   - Returns raw git command output as simple `GitFileStatus`
   - No metadata enrichment
   - Location: `/Users/griever/Developer/desktop-app/repository-monitoring`

2. **Enrichment Layer**: `@principal-ai/repository-monitoring-server`
   - Takes primitive data and enriches it into `GitStatusWithFiles`
   - Adds metadata: repoPath, branch, ahead/behind counts, watchingEnabled
   - Computes content hash for stable object identity
   - Location: `/Users/griever/Developer/desktop-app/repository-monitoring-server`

3. **Consumption Layer**: Panel Framework & Panels
   - RepositoryPanelContext provides dual slices for gradual migration
   - Panels consume `GitStatusWithFiles` with stable hash field
   - Location: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/contexts/RepositoryPanelContext.tsx`

### Type Definitions

#### GitStatusWithFiles (Full Type)
Source: `@principal-ai/repository-abstraction@0.5.0`
File: `/Users/griever/Developer/repository-abstraction/src/gitStatus.ts:36-59`

```typescript
export interface GitStatusWithFiles extends GitStatusMetadata {
  /** Files with modifications (working tree changes) */
  modifiedFiles: string[];
  /** Files not tracked by git */
  untrackedFiles: string[];
  /** Files staged for commit (index changes) */
  stagedFiles: string[];
  /** Newly created files (subset of untracked) */
  createdFiles: string[];
  /** Deleted files */
  deletedFiles: string[];
  /**
   * Content hash for stable object identity - only changes when file lists change.
   * Used for React memoization to prevent unnecessary re-renders.
   */
  hash: string;
}
```

#### Legacy GitStatus (Backward Compatibility)
File: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/contexts/RepositoryPanelContext.tsx:58-62`

```typescript
interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
  deleted: string[];
}
```

### Hash Computation

The hash is computed at data creation time in three locations within `RepositoryMonitoringServer.ts`:

1. **buildGitStatusSlice** (line 420-436)
2. **createFallbackGitStatusWithFiles** (line 495-510)
3. **Git watcher event handler** (line 1100-1129)

Hash input includes sorted file lists + branch metadata:
```typescript
const hashInput = JSON.stringify({
  staged: [...stagedFiles].sort(),
  modified: [...modifiedFiles].sort(),
  untracked: [...untrackedFiles].sort(),
  created: [...createdFiles].sort(),
  deleted: [...deletedFiles].sort(),
  branch: detailedStatus.branch,
  ahead: detailedStatus.ahead,
  behind: detailedStatus.behind,
});
const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
```

## Implementation Details

### Published Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@principal-ai/repository-abstraction` | 0.5.0 | Shared git status type definitions |
| `@principal-ai/repository-monitoring-server` | 2.1.20 | Server that computes hash and enriches git data |
| `@industry-theme/repository-composition-panels` | 0.2.48 | GitChangesPanel migrated to new slice |
| `@industry-theme/file-city-panel` | 0.2.55 | CodeCityPanel and GitChangesTree migrated to new slice |

### Key File Changes

#### 1. Repository Abstraction Package
**File**: `/Users/griever/Developer/repository-abstraction/src/gitStatus.ts`
- **Status**: New file created
- **Purpose**: Single source of truth for git status types
- **Exports**: `GitStatusMetadata`, `GitStatusWithFiles`

**File**: `/Users/griever/Developer/repository-abstraction/src/index.ts:4-5`
```typescript
// Git status types
export type { GitStatusMetadata, GitStatusWithFiles } from './gitStatus';
```

#### 2. Repository Monitoring Server
**File**: `/Users/griever/Developer/desktop-app/repository-monitoring-server/src/shared/RepositoryMonitoringAPI.ts`
- **Lines 5-8**: Import git types from repository-abstraction
```typescript
import type {
  FileTree,
  GitStatusMetadata,
  GitStatusWithFiles
} from '@principal-ai/repository-abstraction';
```

- **Lines 154-157**: Re-export for consumers
```typescript
// Re-export git status types for external consumers
export type { GitStatusMetadata, GitStatusWithFiles };

export type GitStatus = GitStatusMetadata;
```

**File**: `/Users/griever/Developer/desktop-app/repository-monitoring-server/src/worker/RepositoryMonitoringServer.ts`
- **Line 36**: Import crypto for hashing
- **Lines 420-436**: Hash computation in buildGitStatusSlice
- **Lines 495-510**: Hash computation for fallback status
- **Lines 1100-1129**: Hash computation for watcher events

#### 3. Desktop App Context
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/contexts/RepositoryPanelContext.tsx`

**Lines 58-75**: Legacy type and mapping helper
```typescript
// Legacy GitStatus format for backward compatibility with existing panels
interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
  deleted: string[];
}

// Helper to convert GitStatusWithFiles to legacy GitStatus format
function mapToLegacyGitStatus(status: GitStatusWithFiles | null): GitStatus | null {
  if (!status) return null;
  return {
    staged: status.stagedFiles,
    unstaged: status.modifiedFiles,
    untracked: status.untrackedFiles,
    deleted: status.deletedFiles,
  };
}
```

**Lines 1209-1237**: Legacy 'git' slice (backward compatible)
```typescript
[
  'git',
  {
    scope: 'repository' as const,
    name: 'git',
    data: mapToLegacyGitStatus(stableGitStatusData),
    loading: gitStatusLoading,
    error: null,
    refresh: async () => { /* ... */ },
  },
],
```

**Lines 1238-1266**: New 'gitStatusWithFiles' slice (full type with hash)
```typescript
[
  'gitStatusWithFiles',
  {
    scope: 'repository' as const,
    name: 'gitStatusWithFiles',
    data: stableGitStatusData,
    loading: gitStatusLoading,
    error: null,
    refresh: async () => { /* ... */ },
  },
],
```

**Line 448**: Hash extraction for memoization
```typescript
const gitStatusHash = gitStatusData?.hash; // Now comes from server
```

**Line 468**: Stable reference using hash
```typescript
const stableGitStatusData = useMemo(() => gitStatusData, [gitStatusHash]);
```

#### 4. GitChangesPanel Migration
**File**: `/Users/griever/Developer/web-ade/industry-themed-repository-composition-panels/src/panels/GitChangesPanel.tsx`

**Lines 5**: Import GitStatusWithFiles
```typescript
import type { FileTree, GitStatusWithFiles } from '@principal-ai/repository-abstraction';
```

**Lines 11-25**: Updated empty default
```typescript
const EMPTY_GIT_STATUS: GitStatusWithFiles = {
  repoPath: '',
  branch: '',
  isDirty: false,
  hasUntracked: false,
  hasStaged: false,
  ahead: 0,
  behind: 0,
  watchingEnabled: false,
  stagedFiles: [],
  modifiedFiles: [],
  untrackedFiles: [],
  deletedFiles: [],
  createdFiles: [],
  hash: 'empty',
};
```

**Line 44**: Updated prop type
```typescript
gitStatus: GitStatusWithFiles;
```

**Lines 135-142**: Updated field names in hasChanges check
```typescript
const hasChanges = useMemo(
  () =>
    gitStatus.stagedFiles.length > 0 ||
    gitStatus.modifiedFiles.length > 0 ||
    gitStatus.untrackedFiles.length > 0 ||
    gitStatus.deletedFiles.length > 0,
  [gitStatus.stagedFiles.length, gitStatus.modifiedFiles.length, gitStatus.untrackedFiles.length, gitStatus.deletedFiles.length]
);
```

**Lines 146-161**: Updated field names in getFileStatus
```typescript
const getFileStatus = useCallback(
  (filePath: string): GitChangeSelectionStatus | undefined => {
    if (gitStatus.stagedFiles.includes(filePath)) {
      return 'staged';
    }
    if (gitStatus.deletedFiles.includes(filePath)) {
      return 'deleted';
    }
    if (gitStatus.untrackedFiles.includes(filePath)) {
      return 'untracked';
    }
    if (gitStatus.modifiedFiles.includes(filePath)) {
      return 'unstaged';
    }
    return undefined;
  },
  [gitStatus],
);
```

**Line 256**: Updated untracked expansion
```typescript
const expandedUntracked = expandDirectories(gitStatus.untrackedFiles);
```

**Lines 258-283**: Updated file status data mapping
```typescript
const statusData: GitFileStatus[] = [
  ...gitStatus.stagedFiles.map((filePath) => ({ /* ... */ })),
  ...gitStatus.modifiedFiles.map((filePath) => ({ /* ... */ })),
  ...gitStatus.deletedFiles.map((filePath) => ({ /* ... */ })),
  ...expandedUntracked.map((filePath) => ({ /* ... */ })),
];
```

**Line 492**: Switch to new slice
```typescript
const gitSlice = context.getSlice<GitStatusWithFiles>('gitStatusWithFiles');
```

## Panels Requiring Migration

The following panels currently use the legacy `git` slice and should be migrated to `gitStatusWithFiles`:

### Panel Packages to Review

| Package | Location | Status | Notes |
|---------|----------|--------|-------|
| `@industry-theme/repository-composition-panels` | `/Users/griever/Developer/web-ade/industry-themed-repository-composition-panels` | ✅ **Migrated** | GitChangesPanel updated in v0.2.48 |
| `@industry-theme/file-city-panel` | `/Users/griever/Developer/web-ade/industry-themed-file-city-panels` | ✅ **Migrated** | CodeCityPanel and GitChangesTree updated in v0.2.55 |
| `@industry-theme/alexandria-panels` | TBD | ⏳ **Pending Review** | May contain git-related panels |
| `@industry-theme/agent-panels` | TBD | ⏳ **Pending Review** | May contain git-related panels |
| `@industry-theme/file-editing-panels` | TBD | ⏳ **Pending Review** | May show git status in file lists |
| `@industry-theme/github-panels` | TBD | ⏳ **Pending Review** | Likely uses git status for PR/commit info |
| `@industry-theme/git-sync-panels` | TBD | ⏳ **Pending Review** | High priority - git sync functionality |
| `@industry-theme/markdown-panels` | TBD | ⏳ **Pending Review** | May show git status for markdown files |
| `@principal-ade/code-quality-panels` | TBD | ⏳ **Pending Review** | May filter by git status |

### Search Commands to Identify Usage

```bash
# Find panels using the legacy 'git' slice
grep -r "getSlice.*'git'" --include="*.tsx" --include="*.ts"

# Find panels using legacy GitStatus type
grep -r "import.*GitStatus" --include="*.tsx" --include="*.ts"

# Find panels with git status dependencies
grep -r "staged\|unstaged\|untracked.*length" --include="*.tsx" --include="*.ts"
```

## Migration Checklist for Other Panels

When migrating a panel from legacy `git` slice to `gitStatusWithFiles`:

### 1. Update Dependencies
```json
{
  "dependencies": {
    "@principal-ai/repository-abstraction": "^0.5.0"
  }
}
```

### 2. Update Imports
```typescript
// Before
import type { GitStatus } from '../types';

// After
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';
```

### 3. Update Slice Access
```typescript
// Before
const gitSlice = context.getSlice<GitStatus>('git');

// After
const gitSlice = context.getSlice<GitStatusWithFiles>('gitStatusWithFiles');
```

### 4. Update Field Names
| Legacy Field | New Field |
|--------------|-----------|
| `staged` | `stagedFiles` |
| `unstaged` | `modifiedFiles` |
| `untracked` | `untrackedFiles` |
| `deleted` | `deletedFiles` |
| N/A | `createdFiles` (new) |

### 5. Update Empty Default
```typescript
const EMPTY_GIT_STATUS: GitStatusWithFiles = {
  repoPath: '',
  branch: '',
  isDirty: false,
  hasUntracked: false,
  hasStaged: false,
  ahead: 0,
  behind: 0,
  watchingEnabled: false,
  stagedFiles: [],
  modifiedFiles: [],
  untrackedFiles: [],
  deletedFiles: [],
  createdFiles: [],
  hash: 'empty',
};
```

### 6. Leverage New Metadata
The new type includes additional fields you can use:
- `repoPath`: Absolute path to repository
- `branch`: Current branch name
- `isDirty`: Whether there are uncommitted changes
- `hasUntracked`: Quick check for untracked files
- `hasStaged`: Quick check for staged files
- `ahead/behind`: Commit counts relative to remote
- `watchingEnabled`: Whether file watching is active
- `hash`: Content hash for React optimization

## Benefits

### Performance
- **Stable Object Identity**: Hash-based memoization prevents unnecessary re-renders
- **Efficient Comparisons**: React can use hash for quick equality checks
- **Reduced Re-render Cascade**: Stable references prevent downstream effect re-runs

### Code Quality
- **Single Source of Truth**: All git status types come from repository-abstraction
- **Type Safety**: Shared types prevent field name mismatches
- **Gradual Migration**: Dual-slice system allows incremental panel updates

### Developer Experience
- **Better IntelliSense**: Richer metadata provides more context
- **Clear Naming**: `modifiedFiles` is clearer than `unstaged`
- **Consistent API**: All panels use the same type structure

## Testing

After migrating a panel, verify:

1. **No Excessive Re-renders**: Use React DevTools Profiler to check render counts
2. **Hover Performance**: Hovering over elements shouldn't trigger re-renders
3. **Data Accuracy**: File lists match expected git status
4. **Hash Stability**: Hash only changes when file lists change
5. **Loading States**: Loading indicators work correctly
6. **Error Handling**: Null/empty states render properly

## Related Documentation

- Panel Performance Optimization: `/Users/griever/Developer/desktop-app/electron-app/docs/PANEL_PERFORMANCE_OPTIMIZATION.md`
- Panel Framework Core: `@principal-ade/panel-framework-core`
- Repository Abstraction: `/Users/griever/Developer/repository-abstraction/README.md`

## Final Steps Required

The following packages have been published but the desktop app dependencies need to be fully installed:

1. **package.json updated** ✅
   - `@principal-ai/repository-abstraction`: ^0.5.0
   - `@principal-ai/repository-monitoring-server`: ^2.1.20
   - `@industry-theme/repository-composition-panels`: ^0.2.48

2. **Installation pending** ⏳
   - Run `bun install` or `npm install --legacy-peer-deps` to update node_modules
   - May need to clean node_modules and reinstall if there are conflicts

3. **Test after installation**:
   - Verify GitChangesPanel loads without errors
   - Check that hover doesn't cause excessive re-renders
   - Confirm git status data displays correctly

## Migration History

### @industry-theme/file-city-panel v0.2.55 (2026-01-25)

**Files Modified:**
- `package.json` - Updated `@principal-ai/repository-abstraction` to ^0.5.0
- `src/panels/CodeCityPanel.tsx` - Updated to use `gitStatusWithFiles` slice
- `src/panels/components/GitChangesTree.tsx` - Migrated to `GitStatusWithFiles` type
- `src/panels/components/Legend.tsx` - Updated type imports
- `src/panels/components/GitChangesTree.stories.tsx` - Updated all Storybook examples

**Key Changes:**
1. Changed slice access from `getSlice<GitStatus>('git')` to `getSlice<GitStatusWithFiles>('gitStatusWithFiles')`
2. Updated all git status field references throughout CodeCityPanel:
   - `gitStatus.staged` → `gitStatus.stagedFiles`
   - `gitStatus.unstaged` → `gitStatus.modifiedFiles`
   - `gitStatus.untracked` → `gitStatus.untrackedFiles`
   - `gitStatus.deleted` → `gitStatus.deletedFiles`
3. Updated git changes count computation to use new field names
4. Updated file status checking in hover handlers
5. Updated all highlight layer creation logic
6. Removed local `GitStatus` interface, now using shared `GitStatusWithFiles`
7. Re-exported `GitStatusWithFiles` from GitChangesTree for Legend component

**Impact:**
- CodeCityPanel now benefits from stable hash-based memoization
- Git status highlighting in file city visualization uses optimized data
- Reduced re-renders when hovering over buildings in the 3D city view

### ProjectInfoPanel (Internal Desktop App Panel) (2026-01-25)

**Files Modified:**
- `src/renderer/panels/ProjectInfoPanel.tsx` - Migrated to use `gitStatusWithFiles` slice

**Key Changes:**
1. Removed local `GitStatusData` interface definition
2. Added import for `GitStatusWithFiles` from `@principal-ai/repository-abstraction`
3. Changed slice access from `getSlice<GitStatusData>('git')` to `getSlice<GitStatusWithFiles>('gitStatusWithFiles')`
4. Updated all git status field references:
   - `gitData.staged` → `gitData.stagedFiles`
   - `gitData.unstaged` → `gitData.modifiedFiles`
   - `gitData.untracked` → `gitData.untrackedFiles`
5. Updated field references in:
   - `handleDeleteRequest` function (lines 86-117)
   - `handleDeleteConfirmation` function (lines 126-143)
   - Main render section (lines 224-231)
6. Maintained backward compatibility in event payload by mapping new fields to old names

**Impact:**
- ProjectInfoPanel now uses optimized git status with stable hash
- Git status display in project info uses the same data source as other panels
- Delete operation warnings correctly reflect current repository state

## Timeline

- **2026-01-25**:
  - Initial implementation and type definitions
  - Migrated `@industry-theme/repository-composition-panels` v0.2.48
  - Migrated `@industry-theme/file-city-panel` v0.2.55
  - Migrated ProjectInfoPanel (internal desktop app panel)
  - **Legacy 'git' slice removed** - all consumers migrated to `gitStatusWithFiles`
- **Status**: Migration complete - all known consumers updated

## Contact

For questions about this migration, refer to:
- This document
- Panel Performance Optimization guide
- Git status type definitions in repository-abstraction package
