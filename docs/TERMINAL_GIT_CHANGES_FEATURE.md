# Terminal Window Git Changes Feature - Design Document

## Overview

This document outlines the design for adding git change detection and file preview functionality to the standalone terminal window. The feature will display a button in the terminal header that shows when there are uncommitted changes, provides a dropdown list of changed files, and allows opening markdown files in a viewer.

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

### Components Structure

```
src/
├── renderer/
│   ├── components/
│   │   ├── Titlebar/
│   │   │   ├── TerminalTitlebar.tsx (modified)
│   │   │   └── TitlebarGitChanges.tsx (new)
│   │   └── GitChanges/
│   │       └── GitChangesDropdown.tsx (new)
│   ├── pages/
│   │   ├── StandaloneTerminal.tsx (modified)
│   │   └── MarkdownView.tsx (modified)
│   ├── hooks/
│   │   └── useGitStatus.ts (new)
│   └── main-process-api/
│       └── WindowService.ts (modified)
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

## Implementation Plan

### Phase 1: Git Status Detection

#### 1.1 Create Git Status Hook
**File:** `src/renderer/hooks/useGitStatus.ts`

```typescript
interface UseGitStatusOptions {
  directory: string;
  enabled?: boolean;
}

interface UseGitStatusResult {
  gitStatus: GitStatus | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useGitStatus(options: UseGitStatusOptions): UseGitStatusResult {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!options.enabled || !options.directory) {
      setGitStatus(null);
      setLoading(false);
      return;
    }

    // Initial fetch
    setLoading(true);
    GitService.getStatus(options.directory)
      .then((status) => {
        setGitStatus(formatGitStatus(status));
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });

    // Subscribe to real-time updates
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged((status) => {
      if (status.repoPath === options.directory) {
        setGitStatus(formatGitStatus(status.files));
        setError(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [options.directory, options.enabled]);

  return { gitStatus, loading, error, refresh: () => { /* manual refresh */ } };
}
```

#### 1.2 Git Status Types
Reuse existing types from `src/shared/types/repository.types.ts`:
```typescript
interface GitStatus {
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: GitFile[];
  deleted: GitFile[];
}

interface GitFile {
  path: string;
  lastModified?: string;
}
```

### Phase 2: UI Components

#### 2.1 TitlebarGitChanges Component
**File:** `src/renderer/components/Titlebar/TitlebarGitChanges.tsx`

```typescript
interface TitlebarGitChangesProps {
  directory: string;
  gitStatus: GitStatus;
  onFileClick: (filePath: string) => void;
  position?: 'left' | 'right';
}

export const TitlebarGitChanges: React.FC<TitlebarGitChangesProps> = ({
  directory,
  gitStatus,
  onFileClick,
  position = 'right'
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  // Calculate total changes
  // Render button with badge
  // Render dropdown when open
}
```

#### 2.2 GitChangesDropdown Component
**File:** `src/renderer/components/GitChanges/GitChangesDropdown.tsx`

```typescript
interface GitChangesDropdownProps {
  gitStatus: GitStatus;
  onFileClick: (filePath: string) => void;
  onClose: () => void;
  anchorElement: HTMLElement | null;
}

export const GitChangesDropdown: React.FC<GitChangesDropdownProps> = ({
  gitStatus,
  onFileClick,
  onClose,
  anchorElement
}) => {
  // Render dropdown positioned relative to anchor
  // Group files by status
  // Handle file clicks
  // Style similar to GitStatusPanel
}
```

### Phase 3: Integration

#### 3.1 Update TerminalTitlebar
**File:** `src/renderer/components/Titlebar/TerminalTitlebar.tsx`

Changes:
- Add gitStatus prop
- Add onFileClick handler prop
- Render TitlebarGitChanges component as child

```typescript
export interface TerminalTitlebarProps {
  directory?: string;
  sessionId?: string;
  agentSessionId?: string;
  agentSessionName?: string;
  gitStatus?: GitStatus;
  onFileClick?: (filePath: string) => void;
}
```

#### 3.2 Update StandaloneTerminal
**File:** `src/renderer/pages/StandaloneTerminal.tsx`

Changes:
- Import and use useGitStatus hook
- Pass git status to TerminalTitlebar
- Implement file click handler to open markdown viewer

```typescript
const StandaloneTerminal: React.FC = () => {
  // Existing code...

  const { gitStatus } = useGitStatus({
    directory: terminalInfo?.directory || '',
    enabled: !!terminalInfo?.directory
  });

  const handleFileClick = async (filePath: string) => {
    if (filePath.endsWith('.md')) {
      // Construct full path
      const fullPath = path.join(terminalInfo.directory, filePath);

      // Open markdown viewer window in single view mode
      await WindowService.openMarkdownView(
        fullPath,
        terminalInfo.directory,
        { viewMode: 'single' } // Force single view for easier reading
      );
    }
  };

  // Pass to TerminalTitlebar
}
```

### Phase 4: Event Management

#### 4.1 Git Status Monitoring
- Subscribe to `RepositoryMonitoringService.onGitStatusChanged()` for real-time updates
- File system watching via existing chokidar infrastructure
- Automatic updates when files change in the repository
- Initial load with `GitService.getStatus()` on mount

#### 4.2 Event Subscription Pattern
```typescript
useEffect(() => {
  if (!directory) return;

  // Initial fetch
  GitService.getStatus(directory).then(setGitStatus);

  // Subscribe to changes
  const unsubscribe = RepositoryMonitoringService.onGitStatusChanged((status) => {
    if (status.repoPath === directory) {
      setGitStatus(status.files);
    }
  });

  return () => {
    unsubscribe();
  };
}, [directory]);
```

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

## API Changes

### WindowService API Extension

#### Current API:
```typescript
WindowService.openMarkdownView(filePath: string, projectName: string): Promise<void>
```

#### Updated API:
```typescript
interface MarkdownViewOptions {
  viewMode?: 'single' | 'book';  // Optional, defaults to user preference
}

WindowService.openMarkdownView(
  filePath: string,
  projectName: string,
  options?: MarkdownViewOptions
): Promise<void>
```

### Implementation Changes Required:

#### 1. Update WindowAPI Interface
**File:** `src/shared/main-process-api-interfaces/WindowAPI.ts`
```typescript
export interface WindowAPI {
  // Updated signature
  openMarkdownView: (
    filePath: string,
    projectName: string,
    options?: { viewMode?: 'single' | 'book' }
  ) => Promise<void>;
}
```

#### 2. Update Window Service
**File:** `src/renderer/main-process-api/WindowService.ts`
```typescript
static async openMarkdownView(
  filePath: string,
  projectName: string,
  options?: { viewMode?: 'single' | 'book' }
): Promise<void> {
  try {
    await window.mainProcess.window.openMarkdownView(filePath, projectName, options);
  } catch (error) {
    console.error('[WindowService] Failed to open markdown view:', error);
    throw new Error('Failed to open markdown view window');
  }
}
```

#### 3. Update Window API Implementation
**File:** `src/window/main-process-api-implementations/windowApi.ts`
```typescript
openMarkdownView: (filePath: string, projectName: string, options?: { viewMode?: 'single' | 'book' }) =>
  ipcRenderer.invoke(WindowEvent.OPEN_MARKDOWN_VIEW, filePath, projectName, options),
```

#### 4. Update Window Handler
**File:** `src/main/window/modernWindowHandlers.ts`
```typescript
ipcMain.handle(
  WindowEvent.OPEN_MARKDOWN_VIEW,
  async (_event, filePath: string, projectName: string, options?: { viewMode?: 'single' | 'book' }) => {
    // Encode options in the window data
    const encodedData = encodeURIComponent(
      JSON.stringify({
        filePath,
        projectName,
        viewMode: options?.viewMode // Pass view mode if provided
      }),
    );
    // Rest of implementation...
  }
);
```

#### 5. Update MarkdownView Component
**File:** `src/renderer/pages/MarkdownView.tsx`
```typescript
// Parse viewMode from the route data
const [viewMode, setViewMode] = useState<'single' | 'book'>(() => {
  // Check if viewMode was passed in the window data
  const windowData = parseWindowData(); // Extract from route/params
  if (windowData?.viewMode) {
    return windowData.viewMode;
  }
  // Otherwise use saved preference
  return 'book'; // Will be overridden by user preference in useEffect
});
```

### Backwards Compatibility
- All changes are backwards compatible
- The `options` parameter is optional
- If not provided, behavior remains unchanged (uses user preference)
- Existing calls to `openMarkdownView` continue to work without modification