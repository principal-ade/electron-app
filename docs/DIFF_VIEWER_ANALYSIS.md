# DiffViewer Implementation Analysis

## Overview
The application uses Monaco Editor's Diff Editor to display git diffs. The implementation is split between `DiffViewer.tsx` (the diff component) and `FilePanel.tsx` (orchestration layer).

## Current Architecture

### Component Structure
```
FilePanel (orchestrator)
  ├── Checks git status every 30 seconds
  ├── Manages showDiff state
  └── Renders either:
      ├── DiffViewer (when showDiff=true AND hasGitChanges)
      └── WatchingFileViewer (normal file view)
```

### How It Works
1. **FilePanel** checks git status for the file
2. **WatchingFileViewer** shows a "View Diff" button when git changes exist
3. Clicking the button sets `showDiff=true`
4. **DiffViewer** loads and displays the diff using Monaco's diff editor

## Identified Issues

### 1. ❌ CRITICAL BUG: Incorrect File Path
**Location**: `DiffViewer.tsx` line 36
```typescript
// BUG: Uses absolute path instead of full path
const currentContent = await FileSystemService.readFile(filePath);
```
**Problem**: `filePath` is the relative path (e.g., `src/file.ts`), but `FileSystemService.readFile()` expects an absolute path (e.g., `/Users/name/project/src/file.ts`)

**Impact**: The diff viewer likely fails to load the current file content, causing errors or empty diffs.

### 2. ⚠️ Path Confusion
The component receives `filePath` as a **relative path** from `FilePanel.tsx` (line 137), but treats it as if it were an absolute path.

### 3. ⚠️ Missing Error Context
When git commands fail (lines 44-47, 53-56), the error messages don't include which file or repository failed, making debugging difficult.

### 4. 🔍 No Loading State for Git Operations
The component shows "Loading diff..." but doesn't indicate which operation is taking time (file read vs git show).

### 5. 🎨 Limited Diff Options
The diff viewer is hardcoded to side-by-side view. Users cannot:
- Switch to inline/unified view
- Adjust diff sensitivity
- Navigate between changes

## How the Git Commands Work

### For Modified Files
```bash
git show HEAD:path/to/file.ts  # Gets original version
# Then reads current file from filesystem
```

### For Added/Untracked Files
- Original: Empty string
- Modified: Current file content

### For Deleted Files
```bash
git show HEAD:path/to/file.ts  # Gets original version
```
- Original: Content from HEAD
- Modified: Empty string

## Why It Might Not Be Working

The main issue is the **file path bug**. The DiffViewer receives a relative path but tries to read it as an absolute path:

```typescript
// FilePanel.tsx line 137
<DiffViewer
  filePath={relativeFilePath}  // e.g., "src/components/Button.tsx"
  repositoryPath={repositoryPath}
  gitStatus={gitStatus || undefined}
/>

// DiffViewer.tsx line 36
const currentContent = await FileSystemService.readFile(filePath);
// ❌ Tries to read "src/components/Button.tsx" instead of "/full/path/to/repo/src/components/Button.tsx"
```

## Recommended Fixes

### Immediate Fix (High Priority)
```typescript
// DiffViewer.tsx line 36
const absolutePath = repositoryPath + '/' + filePath;
const currentContent = await FileSystemService.readFile(absolutePath);
```

### Additional Improvements

1. **Add proper path handling**:
```typescript
const absolutePath = path.join(repositoryPath, filePath);
```

2. **Better error messages**:
```typescript
setError(`Failed to load diff for ${filePath}: ${error.message}`);
```

3. **Add view mode toggle**:
```typescript
options={{
  renderSideBySide: viewMode === 'split', // Allow toggle
  // ...
}}
```

4. **Add navigation between changes**:
```typescript
// Use Monaco's diff navigator API
const diffNavigator = monaco.editor.createDiffNavigator(diffEditor);
```

5. **Handle binary files**:
```typescript
if (isBinaryFile(filePath)) {
  return <div>Binary file - cannot show diff</div>;
}
```

## Testing the Fix

To verify the fix works:

1. Open a file with git changes
2. Click "View Diff" button
3. Should see:
   - Left panel: Original version from git
   - Right panel: Current working copy
   - Highlighted additions/deletions

## Alternative Solution

If Monaco continues to have issues, consider replacing with `react-diff-viewer`:
- Lighter weight (50KB vs 2-3MB)
- Simpler API
- No disposal issues
- Built specifically for showing diffs

## Conclusion

The DiffViewer is well-structured but has a critical path bug preventing it from working. The fix is simple - ensure the absolute file path is constructed before reading the file content. The component also needs better error handling and user feedback to make debugging easier.