# Git Changes Context Menu Implementation

## Overview

This document describes the implementation of a right-click context menu for the Git Changes file tree panel, similar to the existing context menu for the regular file tree.

## Research Findings

### Existing Infrastructure

#### File Tree Context Menu (src/renderer/components/FileTreeContextMenu.tsx)
The normal file tree has a context menu with:
- **Copy Path** - Copies the absolute file path
- **Copy Relative Path** - Copies the relative path from repository root
- **Reveal in Finder** - Opens the file location in system file explorer
- **Delete File/Folder** - Moves the file to trash with confirmation

#### Available Git Operations

From `src/renderer/main-process-api/GitService.ts`:
- `execCommand(directory, args)` - Execute arbitrary git commands
- `getStatus(directory)` - Get current git status
- Various git operations (commit, push, pull, etc.)

From `src/main/electron-cli-bridge/executors/GitExecutor.ts`:
- `checkout(directory, branch)` - Can be used to restore files
- `raw(directory, args)` - Execute raw git commands
- No dedicated "discard changes" method, but can be implemented via `checkout` or `restore`

#### File Operations

From `src/renderer/panels/RepositoryPanelProvider.tsx`:
- `actions.openFile(filePath)` - Opens a file in the editor (passed from parent)
- Files can be opened by calling this action with the file path

#### Git File Tree Component

The `GitStatusFileTree` component (from @a24z/dynamic-file-tree) already supports:
- `onContextMenu` prop - Callback for right-click events with (event, nodePath, isFolder)
- Similar API to the regular DynamicFileTree component

## Phase 1 Implementation (Current)

### Features

The initial implementation includes these menu items:

1. **Copy Path** - Copy absolute file path (same as file tree)
2. **Copy Relative Path** - Copy relative path from repository root (same as file tree)
3. **Reveal in Finder** - Open file location in system explorer (same as file tree)
4. **Discard Changes** - Revert file to HEAD state (git-specific)
   - Uses `git checkout HEAD -- <file>` or `git restore <file>`
   - Shows confirmation dialog with warning about data loss
   - Only shown for modified/deleted files (not untracked)
5. **Open File** - Open the file in the editor (git-specific)
   - Calls `actions.openFile(filePath)` from RepositoryPanelProvider

### Implementation Plan

#### 1. Create GitChangesContextMenu Component
**File**: `src/renderer/components/GitChangesContextMenu.tsx`

Similar structure to FileTreeContextMenu but with git-specific actions:
- Reuse the same portal rendering and positioning logic
- Add git-specific menu items
- Determine which items to show based on file status (staged, unstaged, untracked)

#### 2. Update GitChangesPanel
**File**: `src/renderer/panels/components/GitChangesPanel.tsx`

- Add context menu state management (similar to FileTreePanelContent)
- Pass `onContextMenu` handler to GitStatusFileTree
- Render GitChangesContextMenu when context menu is active

#### 3. Implement Discard Changes
**Method**: Use GitService.execCommand to run:
```typescript
// For single file
GitService.execCommand(repositoryPath, ['restore', filePath])
// Or for older git versions
GitService.execCommand(repositoryPath, ['checkout', 'HEAD', '--', filePath])
```

## Phase 2 - Future Enhancements

The following features should be considered for future iterations:

### Additional Git Operations

#### 1. Stage/Unstage Files
**Priority**: High
**Description**: Add ability to stage or unstage files directly from context menu
- **Stage File** - Show for unstaged and untracked files
  - Command: `git add <file>`
- **Unstage File** - Show for staged files
  - Command: `git restore --staged <file>` or `git reset HEAD <file>`

**Benefits**:
- Faster workflow for staging specific files
- Reduces need to use external git tools
- Common operation in git workflows

**Implementation Notes**:
- Need to refresh git status after staging/unstaging
- Consider batch operations for multiple selected files

#### 2. View Diff
**Priority**: High
**Description**: Show file changes in a diff viewer
- Open a modal or side panel with the diff
- Show colorized additions/deletions
- Allow inline editing capabilities

**Benefits**:
- Understand what changed before discarding or staging
- Make informed decisions about which changes to keep
- Better code review workflow

**Implementation Notes**:
- May need to implement or integrate a diff viewer component
- Could leverage existing DiffViewer component (src/renderer/components/DiffViewer.tsx)
- Show diff between working tree and HEAD for unstaged
- Show diff between index and HEAD for staged

#### 3. Ignore File
**Priority**: Medium
**Description**: Add file or pattern to .gitignore
- Add specific file path to .gitignore
- Offer to ignore file pattern (e.g., *.log instead of specific file)
- Smart detection of existing ignore patterns

**Benefits**:
- Quick way to ignore unwanted files
- Reduces clutter in git status
- Common operation when adding new file types

**Implementation Notes**:
- Read existing .gitignore file
- Append new patterns
- Consider gitignore syntax and ordering
- Offer suggestions for common patterns

#### 4. Open in External Diff Tool
**Priority**: Low
**Description**: Open file in configured external diff tool (e.g., Beyond Compare, Kaleidoscope)
- Read git config for merge.tool or diff.tool
- Launch external tool with file

**Benefits**:
- Better for complex diffs
- User's preferred diff tool
- More powerful diff features

**Implementation Notes**:
- Need to read git config: `git config --get diff.tool`
- Execute external tool via shell
- Handle tool not configured case

#### 5. Commit Single File
**Priority**: Low
**Description**: Quickly commit a single file with a message
- Show commit message dialog
- Stage and commit just this file
- Optional: Amend to previous commit

**Benefits**:
- Quick commits for small changes
- More granular commit history
- Focused commits

**Implementation Notes**:
- Simple dialog for commit message
- Command: `git add <file> && git commit -m "message"`
- Consider pre-filling message based on file changes

#### 6. Copy Relative Path (from repo root vs from current branch)
**Priority**: Low
**Description**: Additional copy options
- Copy path relative to repository root (already implemented)
- Copy GitHub URL to file (if remote is GitHub)
- Copy file:line permalink

**Benefits**:
- Share file references easily
- Link to specific lines in GitHub
- Better collaboration

### Context-Aware Menu Items

**Description**: Show different menu items based on file status

| File Status | Menu Items to Show |
|------------|-------------------|
| Untracked | Copy Path, Copy Relative Path, Reveal, Open, Ignore, Delete |
| Unstaged Modified | Copy Path, Copy Relative Path, Reveal, Open, Stage, Discard, View Diff |
| Staged | Copy Path, Copy Relative Path, Reveal, Open, Unstage, View Diff |
| Deleted | Copy Path, Copy Relative Path, Reveal, Restore (Discard), View Diff |

### UI Enhancements

1. **Icons for Git Operations**
   - Use git-specific icons (from lucide-react or custom)
   - Visual distinction between file operations and git operations

2. **Keyboard Shortcuts**
   - Add keyboard shortcuts for common operations
   - Show shortcuts in menu items
   - Example: Cmd+Shift+D for Discard, Cmd+Shift+S for Stage

3. **Batch Operations**
   - Support multiple file selection
   - Context menu operates on all selected files
   - Confirm batch operations with summary

4. **Status Indicators**
   - Show file status icon in menu
   - Indicate if operation is destructive
   - Warning color for discard/delete operations

## Technical Considerations

### Error Handling
- All git operations should have try-catch blocks
- Show user-friendly error messages
- Log detailed errors for debugging
- Handle cases where git command fails

### Performance
- Avoid blocking operations
- Show loading states for long operations
- Consider debouncing rapid context menu opens
- Cache git status to avoid repeated calls

### Testing
- Unit tests for context menu component
- Integration tests for git operations
- Test edge cases (detached HEAD, merge conflicts, etc.)
- Test with various file states

### Refresh Strategy
After git operations that modify status:
- Trigger git status refresh
- Update UI to reflect new state
- Consider optimistic updates for better UX
- Handle refresh failures gracefully

## Related Files

- `src/renderer/components/FileTreeContextMenu.tsx` - Reference implementation
- `src/renderer/panels/components/FileTreePanelContent.tsx` - Usage example
- `src/renderer/panels/components/GitChangesPanel.tsx` - Target for integration
- `src/renderer/main-process-api/GitService.ts` - Git operations API
- `src/main/electron-cli-bridge/executors/GitExecutor.ts` - Git command execution
- `src/renderer/components/DiffViewer.tsx` - Existing diff viewer component

## Timeline Estimate

### Phase 1 (Current - 1-2 days)
- GitChangesContextMenu component implementation
- Integration with GitChangesPanel
- Discard Changes functionality
- Open File functionality
- Testing and bug fixes

### Phase 2 (Future)
- Stage/Unstage (1 day)
- View Diff (2-3 days)
- Ignore File (1 day)
- Context-aware menus (1 day)
- Other enhancements (as needed)

## Success Criteria

### Phase 1
- [ ] Context menu appears on right-click in Git Changes panel
- [ ] All menu items work correctly
- [ ] Discard changes shows confirmation and reverts file
- [ ] Open file opens in editor
- [ ] Copy operations copy correct paths
- [ ] Reveal in Finder opens correct location
- [ ] Menu positioning handles edge cases
- [ ] Menu closes on outside click and escape key

### Phase 2
- [ ] Stage/Unstage operations work and refresh status
- [ ] Diff viewer shows accurate changes
- [ ] Ignore file adds to .gitignore correctly
- [ ] Context-aware menu shows appropriate items
- [ ] Performance is acceptable with large change sets
- [ ] Error messages are clear and actionable
