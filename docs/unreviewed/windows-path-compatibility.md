# Windows Path Compatibility Issues

## Overview
This document tracks path-related compatibility issues that will affect Windows users. Currently, the codebase assumes Unix-style paths with forward slashes (`/`), which will cause issues on Windows that uses backslashes (`\`).

## Immediate Issue (Production Build Failure)
- **File**: `src/renderer/utils/loadFileSystemTree.ts`
- **Error**: `TypeError: yt.join is not a function`
- **Cause**: Importing Node.js `path` module in renderer process, which isn't available in production builds
- **Quick Fix**: Replace `path` operations with string manipulation using `/` for Mac alpha testing

## Files Using Node.js Path Module in Renderer
These files import and use the Node.js `path` module, which breaks in production:

1. **src/renderer/utils/loadFileSystemTree.ts**
   - Line 68: `path.join(rootPath, relativePath)`
   - Line 75: `path.extname(relativePath)`
   - Line 85: `path.basename(relativePath)`
   - Line 99: `path.join(rootPath, cleanPath)`
   - Line 106: `path.dirname(f.relativePath)`
   - Line 112: `path.basename(cleanPath)` and `path.basename(rootPath)`
   - Line 124: `path.basename(rootPath)`
   - Line 162: `path.join(options.localPath, '.gitignore')`

2. **src/renderer/validation/runners/ESLintRunner.ts**
   - Line 109: `path.basename(packagePath)`

3. **src/renderer/services/ViolationMonitoringServiceIPC.ts**
   - Imports path but usage not found in search

## Widespread `.split('/')` Usage
Over 70 instances across 30+ files use `.split('/')` for path operations:

### Common Patterns:
- **Extract filename**: `.split('/').pop()`
- **Get path depth**: `.split('/').length`
- **Get parent directory**: `.split('/').slice(0, -1)`
- **Get first directory**: `.split('/')[0]`

### Affected Files (Sample):
- Components: FileViewer, Terminal, RepositoryMaps, AgentOverview
- Pages: LandingPage, RepoManager, MultiFileEditorWindow
- Services: GitSyncConnectionManager, NavigationService, FileTypeLayerService
- Utils: loadFileSystemTree, sessionProjectMapping, loadManifestContents

## Quick Fix for Mac Alpha Testing

### For loadFileSystemTree.ts:
Replace all `path.*` operations with string manipulation:
- `path.join(a, b)` → `${a}/${b}` (with cleanup for double slashes)
- `path.basename(p)` → `p.split('/').pop() || p`
- `path.dirname(p)` → `p.split('/').slice(0, -1).join('/') || '.'`
- `path.extname(p)` → Extract extension manually

## Long-term Solution (Post-Alpha)

### Option 1: Main Process Path Service
Create an IPC service in main process with methods:
- `joinPath(...segments)`
- `getBasename(path)`
- `getDirname(path)`
- `getExtension(path)`
- `splitPath(path)`
- `normalizePath(path)`

### Option 2: Path Utilities Library
Use a cross-platform path library that works in browser:
- `path-browserify` - Node.js path module for browsers
- Custom utilities that handle both `/` and `\`

### Option 3: Normalize at Boundaries
- Convert all paths to forward slashes when entering renderer
- Convert back to native format when sending to main process
- Requires careful handling at all IPC boundaries

## Testing Requirements for Windows Support

When implementing Windows support:
1. Test all file operations with Windows paths (C:\Users\...)
2. Test path depth calculations
3. Test filename extraction
4. Test relative path resolution
5. Test git operations (git uses forward slashes even on Windows)

## Priority for Fix

### High Priority (Blocking Production):
1. `loadFileSystemTree.ts` - Production build crashes

### Medium Priority (Functional Issues):
1. All `.split('/')` operations for filename extraction
2. Path depth calculations for tree structures

### Low Priority (Display Issues):
1. UI display of paths (can show forward slashes)
2. Breadcrumbs and navigation displays

## Implementation Timeline

1. **Immediate (Alpha)**: Quick fix using `/` for loadFileSystemTree.ts
2. **Beta**: Implement proper path service for critical operations
3. **Release**: Full Windows compatibility with all path operations