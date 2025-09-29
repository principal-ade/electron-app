# Terminal Window Git Changes Feature - Implementation Document

## Overview

This document outlines the implementation of git change detection and file preview functionality in the standalone terminal window. The feature displays a button in the terminal header that shows when there are uncommitted changes, provides a dropdown list of changed files, and allows opening markdown files in a viewer.

**Status:** ✅ Implemented (2025-09-29)

## Features

### 1. Git Changes Button
- Location: Right side of the terminal titlebar
- Visibility: Only shown when there are uncommitted changes in the repository
- Badge: Shows count of changed files
- Icon: Git-related icon (e.g., GitBranch or GitCommit from lucide-react)

### 2. Changes Dropdown
- Triggered by: Clicking the git changes button
- Content: List of changed files grouped by status (staged, modified, deleted, untracked)
- File information: Filename, path, change type indicator
- Styling: Consistent with GitStatusPanel component

### 3. File Preview
- Action: Clicking on a markdown file in the dropdown
- Window: Opens markdown viewer in 'single' view mode for easier reading
- View Mode: Configurable, defaults to 'single' for git changes (vs 'book' mode)
- Support: Initially markdown files only, can be extended later

## Architecture

### Components Structure (As Implemented)

```
src/
├── renderer/
│   ├── components/
│   │   ├── Titlebar/
│   │   │   ├── TerminalTitlebar.tsx (modified)
│   │   │   └── TitlebarGitChanges.tsx (new) ✅
│   │   └── GitChanges/
│   │       └── GitChangesDropdown.tsx (new) ✅
│   ├── pages/
│   │   ├── StandaloneTerminal.tsx (modified)
│   │   └── MarkdownView.tsx (modified)
│   ├── hooks/
│   │   └── useRepositoryGitStatus.ts (existing - reused)
│   ├── main-process-api/
│   │   └── WindowService.ts (modified)
│   └── App.tsx (modified)
├── shared/
│   └── main-process-api-interfaces/
│       └── WindowAPI.ts (modified)
├── window/
│   └── main-process-api-implementations/
│       └── windowApi.ts (modified)
└── main/
    └── window/
        └── modernWindowHandlers.ts (modified)
```

**Note:** Instead of creating a new `useGitStatus.ts` hook, we reused the existing `useRepositoryGitStatus.ts` hook which already provided all the required functionality.

## Implementation Details

### Phase 1: Git Status Detection ✅

#### 1.1 Reused Existing Git Status Hook
**File:** `src/renderer/hooks/useRepositoryGitStatus.ts` (existing)

The existing `useRepositoryGitStatus` hook provided everything needed:
- Real-time git status updates via `RepositoryMonitoringService`
- File lists grouped by status (staged, modified, created, deleted, untracked)
- Automatic subscription to file system changes
- Error handling and loading states

```typescript
// Usage in StandaloneTerminal.tsx
const { gitStatusWithFiles } = useRepositoryGitStatus(terminalInfo?.directory || null);
```

#### 1.2 Git Status Types
Used existing types from `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts`:
```typescript
interface GitStatusWithFiles extends GitStatusMetadata {
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
  createdFiles: string[];
  deletedFiles: string[];
}
```

### Phase 2: UI Components ✅

#### 2.1 TitlebarGitChanges Component
**File:** `src/renderer/components/Titlebar/TitlebarGitChanges.tsx` (implemented)

Key features:
- Shows git changes count as a badge
- Uses GitBranch icon from lucide-react
- Positioned absolutely within the titlebar
- Toggles dropdown visibility on click
- Handles click-outside to close dropdown
- Only renders when there are uncommitted changes

```typescript
interface TitlebarGitChangesProps {
  directory: string;
  gitStatusWithFiles: GitStatusWithFiles | null;
  onFileClick: (filePath: string) => void;
  position?: 'left' | 'right';
}
```

#### 2.2 GitChangesDropdown Component
**File:** `src/renderer/components/GitChanges/GitChangesDropdown.tsx` (implemented)

Key features:
- Groups files by git status with color-coded sections
- Shows file count for each group
- Highlights markdown files with "MD" badge
- Responsive positioning (adjusts to viewport boundaries)
- Escape key closes dropdown
- Visual hover states for clickable markdown files
- Shows file path hierarchy for better context

```typescript
interface GitChangesDropdownProps {
  gitStatusWithFiles: GitStatusWithFiles;
  onFileClick: (filePath: string) => void;
  onClose: () => void;
  anchorElement: HTMLElement | null;
}
```

### Phase 3: Integration ✅

#### 3.1 Update TerminalTitlebar
**File:** `src/renderer/components/Titlebar/TerminalTitlebar.tsx` (modified)

Implemented changes:
- Added gitStatusWithFiles prop
- Added onFileClick handler prop
- Renders TitlebarGitChanges component as child of BaseTitlebar
- Component only renders when all required props are provided

```typescript
export interface TerminalTitlebarProps {
  directory?: string;
  sessionId?: string;
  agentSessionId?: string;
  agentSessionName?: string;
  gitStatusWithFiles?: GitStatusWithFiles | null;
  onFileClick?: (filePath: string) => void;
}
```

#### 3.2 Update StandaloneTerminal
**File:** `src/renderer/pages/StandaloneTerminal.tsx` (modified)

Implemented changes:
- Added import for path module and WindowService
- Uses useRepositoryGitStatus hook with terminal directory
- Implemented handleFileClick to open markdown files
- Passes git status and handler to TerminalTitlebar

```typescript
const StandaloneTerminal: React.FC = () => {
  // ... existing state ...

  const { gitStatusWithFiles } = useRepositoryGitStatus(terminalInfo?.directory || null);

  const handleFileClick = async (filePath: string) => {
    if (!terminalInfo?.directory) return;

    if (filePath.endsWith('.md')) {
      const fullPath = path.join(terminalInfo.directory, filePath);

      try {
        await WindowService.openMarkdownView(
          fullPath,
          terminalInfo.directory,
          { viewMode: 'single' }  // Force single view for easier reading
        );
      } catch (error) {
        console.error('Failed to open markdown view:', error);
      }
    }
  };

  // Passes to TerminalTitlebar in render
}
```

### Phase 4: Event Management ✅

#### 4.1 Git Status Monitoring (Handled by useRepositoryGitStatus)
The existing hook already handles:
- Initial load with `RepositoryMonitoringService.getGitStatus()`
- Subscribe to `window.mainProcess.repositoryMonitoring.onGitStatusChanged()` for real-time updates
- File system watching via existing chokidar infrastructure
- Automatic updates when files change in the repository
- Cleanup on unmount

#### 4.2 Event Flow
1. File changes detected by file system watcher
2. Repository monitoring service emits git status change event
3. useRepositoryGitStatus hook receives update
4. Component re-renders with new git status
5. UI updates immediately without polling

## Dependencies

### Existing Services
- `GitService`: For initial git status fetch
- `RepositoryMonitoringService`: For real-time git status events
- `WindowService`: For opening markdown viewer
- `FileSystemService`: For file operations

### Existing Components
- `BaseTitlebar`: Base titlebar component
- `TitlebarButton`: Reusable button component
- Theme system from `themed-markdown`

## Styling Considerations

### Consistency
- Match existing GitStatusPanel visual design
- Use theme colors for status indicators:
  - Staged: `theme.colors.success`
  - Modified: `theme.colors.warning`
  - Deleted: `theme.colors.error`
  - Untracked: `theme.colors.textSecondary`

### Dropdown Positioning
- Use absolute positioning
- Calculate position based on button location
- Ensure dropdown doesn't overflow window bounds
- Add max-height with scrolling for long file lists

## Performance Considerations

### Event-Driven Updates
- No polling - all updates are event-driven
- File system watching handled by existing infrastructure
- Immediate updates when files change
- No unnecessary git operations

### Resource Efficiency
- Single file watcher per repository (shared across all windows)
- Event subscription cleanup on unmount
- Minimal memory footprint
- No duplicate watchers for same directory

## Testing Strategy

### Unit Tests
- Git status hook logic
- Component rendering with various states
- File click handlers

### Integration Tests
- Git status polling
- Window opening functionality
- Event handling

### Manual Testing
- Various git states (clean, dirty, conflicts)
- Multiple file types
- Window positioning
- Theme switching
- Real-time update verification (make changes and verify immediate UI update)

## Future Enhancements

1. **File Type Support**
   - Support for more file types beyond markdown
   - Open appropriate viewer/editor based on file type

2. **Inline Diff Preview**
   - Show file diffs in dropdown on hover
   - Quick preview without opening separate window

3. **Git Actions**
   - Stage/unstage files from dropdown
   - Discard changes
   - Create commits

4. **Real-time Updates**
   - File system watching for instant updates
   - WebSocket connection for remote changes

5. **Search and Filter**
   - Filter files by name or path
   - Search within changed files

## Migration Path

1. Phase 1: Basic implementation with event subscriptions
2. Phase 2: Optimize event handling and debouncing
3. Phase 3: Extended file type support
4. Phase 4: Git actions integration
5. Phase 5: Advanced features (diff preview, etc.)

## API Changes ✅

### WindowService API Extension (Implemented)

All API changes have been successfully implemented to support passing view mode options to the markdown viewer.

#### 1. WindowAPI Interface Updated
**File:** `src/shared/main-process-api-interfaces/WindowAPI.ts`
- Added optional `options` parameter with `viewMode` property

#### 2. WindowService Updated
**File:** `src/renderer/main-process-api/WindowService.ts`
- Method signature updated to accept optional options parameter
- Passes options through to main process API

#### 3. Window API Implementation Updated
**File:** `src/window/main-process-api-implementations/windowApi.ts`
- IPC invoke call updated to pass options as third parameter

#### 4. Window Handler Updated
**File:** `src/main/window/modernWindowHandlers.ts`
- IPC handler accepts options parameter
- Encodes viewMode in window data for route parsing

#### 5. MarkdownView Component Updated
**File:** `src/renderer/pages/MarkdownView.tsx`
- Accepts `initialViewMode` prop
- Uses initial view mode if provided, otherwise falls back to user preference

#### 6. App.tsx Router Updated
**File:** `src/renderer/App.tsx`
- Extracts viewMode from window data
- Passes as prop to MarkdownView component

### Backwards Compatibility
- All changes are backwards compatible
- The `options` parameter is optional
- If not provided, behavior remains unchanged (uses user preference)
- Existing calls to `openMarkdownView` continue to work without modification

## Implementation Summary

### What Was Built
The feature has been fully implemented with the following key accomplishments:

1. **Git Status Integration**: Leveraged existing `useRepositoryGitStatus` hook instead of creating a new one, reducing code duplication
2. **UI Components**: Created two new components (TitlebarGitChanges and GitChangesDropdown) that integrate seamlessly with the existing titlebar system
3. **Real-time Updates**: Git status updates immediately when files change, no polling required
4. **Markdown Preview**: Clicking markdown files opens them in single view mode for optimal readability
5. **Clean Architecture**: All changes follow existing patterns and conventions in the codebase

### Key Differences from Original Design
- **Reused existing hook**: Instead of creating `useGitStatus.ts`, we used the existing `useRepositoryGitStatus.ts`
- **Simplified types**: Used existing `GitStatusWithFiles` interface instead of creating new types
- **Additional file modified**: Added changes to `App.tsx` to properly pass viewMode through the routing system

### Files Modified
- ✅ Created: `TitlebarGitChanges.tsx`, `GitChangesDropdown.tsx`
- ✅ Modified: `TerminalTitlebar.tsx`, `StandaloneTerminal.tsx`, `MarkdownView.tsx`, `App.tsx`
- ✅ Modified: `WindowAPI.ts`, `WindowService.ts`, `windowApi.ts`, `modernWindowHandlers.ts`

### Testing Recommendations
1. Open a terminal window in a git repository
2. Make changes to files to see the git button appear
3. Click the button to see the dropdown with grouped files
4. Click on markdown files to verify they open in single view mode
5. Test with different git states (staged, modified, deleted, untracked files)
6. Verify real-time updates when files are modified outside the app