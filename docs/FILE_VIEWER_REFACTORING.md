# File Viewer Refactoring Documentation

## Overview
This document captures the complete refactoring of the file viewing system to add git diff support, file watching, edit mode toggling, and Monaco error suppression.

## Key Features Added
1. **Git Diff Support** - View diffs for files with uncommitted changes
2. **File Watching** - Auto-reload when files change externally
3. **Edit Mode Toggle** - Switch between read-only and editable modes
4. **Visual Indicators** - Show if file is editable or read-only
5. **Vim Mode Support** - Enable vim navigation even in read-only mode
6. **Monaco Error Suppression** - Eliminate "Canceled" errors in development

## Architecture

### Component Hierarchy
```
FilePanel (orchestrator)
  ├─> WatchingFileViewer (adds file watching)
  │     └─> FileViewer (core viewing/editing)
  └─> DiffViewer (when showing diffs)
```

### Key Components

#### FilePanel (`src/renderer/components/FilePanel.tsx`) - **NEW**
- Orchestrates between FileViewer and DiffViewer
- Checks git status every 30 seconds
- Shows "View Diff" button only when file has changes
- Manages edit mode state

#### WatchingFileViewer (Updated)
- Wraps FileViewer with file system watching
- Forces re-mount when external changes detected
- Passes through all FileViewer props including new git-related ones

#### FileViewer (Updated)
- Removed broken diff viewing code
- Added visual indicators for editable/read-only state
- Added edit mode toggle button
- Integrated Monaco error suppression

## Files Modified

### New Files Created
1. **`src/renderer/components/FilePanel.tsx`**
   - Main orchestrator component
   - Git status detection logic
   - Switches between normal and diff views

2. **`src/renderer/utils/monacoErrorSuppressor.ts`**
   - Suppresses Monaco "Canceled" errors
   - Overrides Promise.reject for cancellation errors
   - Patches event listeners and setTimeout

3. **`src/renderer/components/MonacoEditorErrorBoundary.tsx`**
   - Error boundary for Monaco Editor
   - Catches and suppresses harmless cleanup errors

### Modified Files

#### `src/renderer/components/FileViewer.tsx`
**Changes:**
- Removed broken diff viewing code (buildVersionHistory, applyEditHighlights, renderDiffView)
- Added props: `hasGitChanges`, `gitStatus`, `isCheckingGit`, `onShowDiff`, `allowEditToggle`, `onEditableChange`
- Added visual indicators (Lock/Edit icons) showing editable state
- Added Edit toggle button to switch between modes
- Integrated Monaco error suppression
- Wrapped Editor in MonacoEditorErrorBoundary

**Key sections removed:**
- Lines 287-335: `buildVersionHistory` function
- Lines 337-478: `applyEditHighlights` function
- Lines 759-847: `renderDiffView` function

#### `src/renderer/pages/LandingPage/AgentConfigurationView/WatchingFileViewer.tsx`
**Changes:**
- Extended props interface to include all git-related props
- Added `allowEditToggle` and `onEditableChange` props
- Props are passed through to FileViewer via spread operator

#### `src/renderer/pages/RepoManager/RepositoryExplorationView.tsx`
**Changes:**
- Replaced `import { FileViewer }` with `import { FilePanel }`
- Updated file viewer rendering to use FilePanel
- Added `repositoryPath` prop for git functionality
- Added `enableVimMode={true}` for vim support

#### `src/renderer/pages/MultiFileEditorWindow.tsx`
**Changes:**
- Replaced FileViewer/WatchingFileViewer/DiffViewer imports with FilePanel
- Removed `showDiff` state and toggle button (handled by FilePanel)
- Added git repository root detection logic
- Simplified rendering to use single FilePanel component

#### `src/renderer/index.tsx`
**Changes:**
- Added import for monacoErrorSuppressor at the top
- Enhanced global error handlers to suppress Monaco cancellation errors
- Added `stopImmediatePropagation()` to prevent error propagation

## Git Integration

### How Git Status Detection Works
1. FilePanel determines repository path
2. Checks git status using `GitService.getDetailedChanges()`
3. Checks every 30 seconds (reduced from 5 seconds)
4. Shows "View Diff" button only when changes detected
5. Supports: modified, added, deleted, and untracked files

### Repository Path Detection
- **RepoManager**: Uses `activeFileTreeSource.location` for local repos
- **MultiFileEditor**: Uses `git rev-parse --show-toplevel` to find git root
- **Remote files**: No git support (repositoryPath is undefined)

## Monaco Error Suppression

### The Problem
Monaco Editor throws harmless "Canceled" errors during cleanup when components unmount. These appear as red error overlays in development.

### The Solution (Multi-Layer Approach)

1. **Promise.reject Override** (`monacoErrorSuppressor.ts`)
   - Intercepts rejected promises
   - Returns resolved promise for cancellation errors
   - Prevents errors from propagating to React

2. **Global Error Handlers** (`index.tsx`)
   - Catches errors at window level
   - Uses `stopImmediatePropagation()`
   - Filters out Monaco-specific errors

3. **Error Boundary** (`MonacoEditorErrorBoundary.tsx`)
   - Wraps Monaco Editor component
   - Catches synchronous errors
   - Suppresses cancellation errors

4. **Unhandled Rejection Handler** (`FileViewer.tsx`)
   - Additional layer of error suppression
   - Checks for various error patterns

### Error Patterns Suppressed
- `message === 'Canceled'`
- `toString() === 'Canceled: Canceled'`
- Stack traces containing:
  - `Delayer.cancel`
  - `Delayer.dispose`
  - `DisposableStore`
  - `WordHighlighter`
  - `monaco-editor`

## Usage Examples

### Basic Usage with Git Support
```tsx
<FilePanel
  filePath="/path/to/file.ts"
  repositoryPath="/path/to/repo"
  enableVimMode={true}
  editable={false}
/>
```

### With Custom Save Handler
```tsx
<FilePanel
  filePath={file.path}
  repositoryPath={repoPath}
  editable={true}
  onSave={async (content) => {
    await FileSystemService.writeFile(file.path, content);
  }}
/>
```

## Testing Checklist

- [ ] File opens in read-only mode by default
- [ ] "View Diff" button appears only for files with git changes
- [ ] Clicking "Edit" toggles to editable mode
- [ ] Visual indicator shows current mode (Editable/Read-only)
- [ ] Files auto-reload when changed externally
- [ ] Git status updates every 30 seconds
- [ ] Vim mode works in both read-only and edit modes
- [ ] No Monaco "Canceled" errors in console or UI
- [ ] Diff viewer shows correct changes

## Benefits

1. **Cleaner Separation of Concerns** - Each component has a single responsibility
2. **Better Performance** - Only loads needed components (DiffEditor loaded on demand)
3. **Improved UX** - Clear visual indicators, no flickering "checking" messages
4. **Reduced Noise** - No more Monaco cancellation errors
5. **Flexibility** - Easy to add more diff sources or viewing modes

## Future Enhancements

1. Add support for staging individual hunks from diff view
2. Add side-by-side editing of original vs modified
3. Support for comparing against different branches/commits
4. Integrate with git blame information
5. Add merge conflict resolution UI