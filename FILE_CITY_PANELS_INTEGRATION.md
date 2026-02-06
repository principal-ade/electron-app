# File City Panels Integration Guide

## New Features in v0.3.17 - Git Stage/Unstage Actions

### Overview

The File City Panels package now includes interactive git staging controls directly in the `GitChangesCardList` component. Users can stage and unstage files with visual feedback and smooth animations.

### New PanelActions

Two new actions have been added to the `PanelActions` interface:

```typescript
interface PanelActions {
  // ... existing actions

  /**
   * Stage a file for git commit
   * Called when user clicks the "Stage" button on an unstaged file
   */
  stageFile?: (filePath: string) => void;

  /**
   * Unstage a file from git staging area
   * Called when user clicks the "Unstage" button on a staged file
   */
  unstageFile?: (filePath: string) => void;
}
```

### Implementation Required

The host application (electron-app) must implement these two actions and pass them to the panel context.

---

## Step-by-Step Implementation Guide

### Step 1: Add Git Events to GitEvents Enum

Add the new IPC events to the `GitEvents` enum:

**File:** `src/shared/main-process-api-interfaces/GitAPI.ts`

```typescript
export enum GitEvents {
  GET_REPOSITORY_INFO = 'git:get-repository-info',
  CHECK_IF_PRIVATE_REPO = 'git:check-if-private-repo',
  GET_COMMIT_HISTORY = 'git:get-commit-history',
  EXECUTE_COMMAND = 'git:exec-command',
  CLONE_REPOSITORY = 'git:clone-repository',
  CHECK_AUTH_METHODS = 'git:check-auth-methods',
  DELETE_GIT_REPOSITORY = 'git:delete-git-repository',
  FORCE_DELETE_GIT_REPOSITORY = 'git:force-delete-git-repository',
  SCAN_FOLDER_FOR_REPOS = 'git:scan-folder-for-repos',
  GET_DISCOVERED_REPOS = 'git:get-discovered-repos',
  // Add these new events:
  STAGE_FILE = 'git:stage-file',
  UNSTAGE_FILE = 'git:unstage-file',
}
```

Also add the methods to the `GitAPI` interface in the same file:

```typescript
export interface GitAPI {
  // ... existing methods
  stageFile: (repoPath: string, filePath: string) => Promise<void>;
  unstageFile: (repoPath: string, filePath: string) => Promise<void>;
}
```

---

### Step 2: Add IPC Handlers in Main Process

Add the IPC handlers to execute git stage/unstage commands:

**File:** `src/main/file-system/gitHandlers.ts`

Add these handlers in the `registerGitHandlers()` function:

```typescript
// Stage a file
ipcMain.handle(
  GitEvents.STAGE_FILE,
  async (_event, repoPath: string, filePath: string) => {
    try {
      const git = await gitClientFactory.getClient(repoPath);
      await git.add(filePath);
      console.log(`[Git] Staged file: ${filePath}`);
    } catch (error) {
      console.error('[Git] Failed to stage file:', error);
      throw error;
    }
  },
);

// Unstage a file
ipcMain.handle(
  GitEvents.UNSTAGE_FILE,
  async (_event, repoPath: string, filePath: string) => {
    try {
      const git = await gitClientFactory.getClient(repoPath);
      await git.reset(['HEAD', filePath]);
      console.log(`[Git] Unstaged file: ${filePath}`);
    } catch (error) {
      console.error('[Git] Failed to unstage file:', error);
      throw error;
    }
  },
);
```

**Note:** The `gitClientFactory.getClient(repoPath)` returns a simple-git-like interface that wraps the electron-cli-bridge `GitExecutor`.

---

### Step 3: Add Methods to GitService (Renderer Process)

Add the renderer-side API methods:

**File:** `src/renderer/main-process-api/GitService.ts`

Add these static methods to the `GitService` class:

```typescript
/**
 * Stage a file for commit
 * @param repoPath - Repository root path
 * @param filePath - Relative or absolute path to the file
 */
static async stageFile(repoPath: string, filePath: string): Promise<void> {
  console.log(`[GitService] Staging file: ${filePath} in ${repoPath}`);
  return window.mainProcess.git.stageFile(repoPath, filePath);
}

/**
 * Unstage a file from the staging area
 * @param repoPath - Repository root path
 * @param filePath - Relative or absolute path to the file
 */
static async unstageFile(repoPath: string, filePath: string): Promise<void> {
  console.log(`[GitService] Unstaging file: ${filePath} in ${repoPath}`);
  return window.mainProcess.git.unstageFile(repoPath, filePath);
}
```

---

### Step 4: Implement PanelActions in PanelContext

Add the `stageFile` and `unstageFile` actions to your `PanelContext`:

**File:** `src/renderer/contexts/PanelContext.tsx`

In the `ExtendedPanelActions` interface (around line 40):

```typescript
interface ExtendedPanelActions extends PanelActions {
  // ... existing actions

  // Git staging actions
  stageFile?: (filePath: string) => Promise<void>;
  unstageFile?: (filePath: string) => Promise<void>;
}
```

In the `actions` object (around line 790), add these implementations:

```typescript
const actions: ExtendedPanelActions = useMemo(
  () => {
    const repoPath = repository?.path || workspace?.path || '';

    return {
      // ... existing actions (openFile, openRepository, etc.)

      // Git staging actions
      stageFile: async (filePath: string) => {
        console.info('[PanelContext] Staging file:', filePath);

        try {
          // Stage the file via GitService
          await GitService.stageFile(repoPath, filePath);

          // Refresh git status data slice
          await context.refresh('repository', 'gitStatusWithFiles');

          console.info('[PanelContext] File staged successfully:', filePath);
        } catch (error) {
          console.error('[PanelContext] Failed to stage file:', error);
          throw error;
        }
      },

      unstageFile: async (filePath: string) => {
        console.info('[PanelContext] Unstaging file:', filePath);

        try {
          // Unstage the file via GitService
          await GitService.unstageFile(repoPath, filePath);

          // Refresh git status data slice
          await context.refresh('repository', 'gitStatusWithFiles');

          console.info('[PanelContext] File unstaged successfully:', filePath);
        } catch (error) {
          console.error('[PanelContext] Failed to unstage file:', error);
          throw error;
        }
      },
    };
  },
  // Dependencies...
  [events, workspace, repository?.path, repository?.name, terminalContext],
);
```

---

### Step 5: Add gitStatusWithFiles Data Slice

You need to add a data slice that provides git status data to the panels. This slice should use `RepositoryMonitoringService.getGitStatusWithFiles()`.

**File:** `src/renderer/contexts/PanelContext.tsx`

Add state for git status (around line 240):

```typescript
// Track git status with files
const [gitStatusWithFiles, setGitStatusWithFiles] = useState<GitStatusWithFiles | null>(null);
const [gitStatusLoading, setGitStatusLoading] = useState(false);
```

Add a useEffect to fetch git status when repository changes (around line 330):

```typescript
// Fetch git status with files when repository changes
useEffect(() => {
  const fetchGitStatus = async () => {
    if (!repository?.path) {
      setGitStatusWithFiles(null);
      return;
    }

    setGitStatusLoading(true);
    try {
      const status = await RepositoryMonitoringService.getGitStatusWithFiles(
        repository.path,
      );
      console.info(
        '[PanelContext] Fetched git status for repository:',
        repository.path,
        status,
      );
      setGitStatusWithFiles(status);
    } catch (error) {
      console.error('[PanelContext] Failed to fetch git status:', error);
      setGitStatusWithFiles(null);
    } finally {
      setGitStatusLoading(false);
    }
  };

  fetchGitStatus();
}, [repository?.path]);
```

Add the data slice to the slices map (around line 545):

```typescript
const slices = useMemo<Map<string, DataSlice>>(
  () =>
    new Map([
      // ... existing slices (git, workspace, markdown, fileTree, etc.)

      [
        'gitStatusWithFiles',
        {
          scope: 'repository' as const,
          name: 'gitStatusWithFiles',
          data: gitStatusWithFiles,
          loading: gitStatusLoading,
          error: null,
          refresh: async () => {
            // Refetch git status
            if (repository?.path) {
              setGitStatusLoading(true);
              try {
                const status = await RepositoryMonitoringService.getGitStatusWithFiles(
                  repository.path,
                );
                setGitStatusWithFiles(status);
              } catch (error) {
                console.error(
                  '[PanelContext] Failed to refresh git status:',
                  error,
                );
                setGitStatusWithFiles(null);
              } finally {
                setGitStatusLoading(false);
              }
            }
          },
        },
      ],
    ]),
  [
    // ... existing dependencies
    gitStatusWithFiles,
    gitStatusLoading,
    repository?.path,
  ],
);
```

Update the extended context value to use real git status (around line 1423):

```typescript
const context: ExtendedPanelContextValue = useMemo(
  () => ({
    // ... other properties

    gitStatus: {
      staged: gitStatusWithFiles?.stagedFiles || [],
      unstaged: gitStatusWithFiles?.modifiedFiles || [],
      untracked: gitStatusWithFiles?.untrackedFiles || [],
      deleted: gitStatusWithFiles?.deletedFiles || [],
    },
    gitStatusLoading,
  }),
  [
    // ... other dependencies
    gitStatusWithFiles,
    gitStatusLoading,
  ],
);
```

Don't forget to add the import at the top of the file:

```typescript
import { GitService } from '../main-process-api/GitService';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
```

---

### Step 6: Update Window Preload API

Add the IPC methods to the preload API so renderer can call them:

**File:** `src/window/main-process-api-implementations/gitApi.ts` (or similar preload bridge file)

```typescript
git: {
  // ... existing methods

  stageFile: async (repoPath: string, filePath: string) => {
    return ipcRenderer.invoke(GitEvents.STAGE_FILE, repoPath, filePath);
  },

  unstageFile: async (repoPath: string, filePath: string) => {
    return ipcRenderer.invoke(GitEvents.UNSTAGE_FILE, repoPath, filePath);
  },
}
```

---

## Data Structure: GitStatusWithFiles

The `GitStatusWithFiles` interface extends `GitStatusMetadata` and provides:

```typescript
interface GitStatusWithFiles extends GitStatusMetadata {
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
  /** Content hash for stable object identity */
  hash: string;
}

interface GitStatusMetadata {
  repoPath: string;
  branch: string;
  isDirty: boolean;
  hasUntracked: boolean;
  hasStaged: boolean;
  ahead: number;
  behind: number;
}
```

---

## UI Behavior

### View Toggle
- GitChangesCardList now includes a toggle between "Unstaged" and "Staged" views
- Shows file counts: `Unstaged (6)` | `Staged (2)`
- Users can switch between views to see different file sets

### Stage Button (Unstaged View)
- Appears on each file card in the "Unstaged" view
- Green theme with Plus icon
- Shows spinner animation while processing
- File fades out and slides left after staging

### Unstage Button (Staged View)
- Appears on each file card in the "Staged" view
- Orange theme with Minus icon
- Shows spinner animation while processing
- File fades out and slides left after unstaging

### Animation Sequence

When a user clicks Stage/Unstage:
1. Button shows spinning loader (100ms)
2. Card fades out and slides left (200ms)
3. Action is called
4. Git status refreshes
5. File appears in the other view

---

## Data Flow

```
User clicks "Stage" button
  → handleStageWithAnimation()
  → Button shows loader
  → Card fades out
  → actions?.stageFile?.(filePath) is called
  → GitService.stageFile(repoPath, filePath)
  → IPC: GitEvents.STAGE_FILE
  → Main Process: gitClientFactory.getClient().add(filePath)
  → Git command executed: git add <filePath>
  → Renderer: context.refresh('repository', 'gitStatusWithFiles')
  → RepositoryMonitoringService.getGitStatusWithFiles(repoPath)
  → GitChangesCardList re-renders with updated data
  → File appears in "Staged" view
```

---

## Testing

The panels include Storybook stories for testing:
- `GitChangesCardList` → `InteractiveWithStage` story
- `FileCardList` → `WithStageButton` and `WithUnstageButton` stories

Run storybook to preview:
```bash
cd packages/file-city-panels
npm run storybook
```

---

## Important Notes

1. **Data Slice Refresh**: Always refresh the `gitStatusWithFiles` data slice after stage/unstage operations
2. **Error Handling**: Implement proper error handling and user notifications
3. **Path Handling**: File paths in `GitStatusWithFiles` are relative to the repository root
4. **Async Operations**: Actions can be async - the UI handles loading states
5. **Double-Click Protection**: The UI prevents double-clicks during processing
6. **Repository Path**: The `repoPath` should be the repository root, not the workspace path

---

## Migration Checklist

- [ ] Add `STAGE_FILE` and `UNSTAGE_FILE` to `GitEvents` enum
- [ ] Add methods to `GitAPI` interface
- [ ] Implement IPC handlers in `gitHandlers.ts`
- [ ] Add `stageFile` and `unstageFile` methods to `GitService`
- [ ] Add `stageFile` and `unstageFile` actions to `PanelContext`
- [ ] Add `gitStatusWithFiles` data slice to `PanelContext`
- [ ] Update preload API to expose git stage/unstage methods
- [ ] Add error handling and user notifications
- [ ] Test with files containing spaces and special characters
- [ ] Test staging/unstaging multiple files in sequence
- [ ] Verify file counts update correctly in the toggle
- [ ] Verify data slice refresh after operations

---

## Related Files

**Types & Interfaces:**
- `src/shared/main-process-api-interfaces/GitAPI.ts` - GitEvents enum and GitAPI interface
- `@principal-ai/repository-monitoring-server` - GitStatusWithFiles type

**Main Process:**
- `src/main/file-system/gitHandlers.ts` - IPC handlers for git operations
- `src/main/utils/gitClientFactory.ts` - Git client factory (simple-git interface)
- `src/main/electron-cli-bridge/executors/GitExecutor.ts` - Actual git command execution

**Renderer Process:**
- `src/renderer/main-process-api/GitService.ts` - Renderer-side git API wrapper
- `src/renderer/main-process-api/RepositoryMonitoringService.ts` - Repository monitoring API
- `src/renderer/contexts/PanelContext.tsx` - Main panel state and actions
- `src/renderer/hooks/useRepositoryGitStatus.ts` - React hook for git status

**Preload Bridge:**
- `src/window/main-process-api-implementations/gitApi.ts` - Preload API for git operations

**File City Panels:**
- `@industry-theme/file-city-panel/src/types/index.ts` - PanelActions interface
- `@industry-theme/file-city-panel/src/panels/components/GitChangesCardList.tsx` - Main component
- `@industry-theme/file-city-panel/src/panels/components/FileCardList.tsx` - Base component with animations

---

## Questions?

If you need clarification or encounter issues during integration, check:
- The Storybook stories for expected behavior
- Mock implementations in `src/mocks/panelContext.tsx`
- Console logs during development for action calls
- Existing git operations in `GitService` for patterns
