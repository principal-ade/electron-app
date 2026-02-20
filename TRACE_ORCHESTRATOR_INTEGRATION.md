# Trace Orchestrator Integration for Electron App

## Problem 1: Manual RegisteredTrace Construction

Currently, `DevWorkspacePanelFramework.tsx` manually constructs `RegisteredTrace` objects when loading stored traces from files. This bypasses the matching system and marks all traces as "unmatched".

**Current approach (lines 652-685)**:
```typescript
const registeredTrace: RegisteredTrace = {
  // ... manually construct with old fields
  scope: { ... },              // ❌ Old structure
  registryStatus: 'unmatched', // ❌ No matching performed
  spanMatches: [],             // ❌ Missing scenario/storyboard matches
  // ...
};
```

## Problem 2: LocalRegistry Breaks Browser Safety

**CRITICAL BUG DISCOVERED**: `LocalRegistry` is exported from the main `index.ts` (should be browser-safe) but uses Node.js `fs` module directly:

```typescript
// packages/core/src/registry/LocalRegistry.ts
import { watch, type FSWatcher } from 'fs';  // ❌ Node.js only!
import * as path from 'path';                 // ❌ Node.js only!
```

This violates the core library's browser-safety contract. The core library already has an adapter pattern via `@principal-ai/repository-abstraction`:
- `FileTree` - abstract file structure
- `FileSystemAdapter` - interface for file operations
- `fileReader` - injected function for reading files

**Example of correct pattern** (from `CanvasDiscovery`):
```typescript
// Takes FileTree and fileReader instead of using fs directly
const result = await discovery.discover(fileTree, {
  fileReader: async (path) => fs.promises.readFile(path, 'utf-8'),
  includeContent: true
});
```

## Solution

### Fix LocalRegistry to Use Adapter Pattern

`LocalRegistry` should be refactored to:
1. Accept `FileTree` instead of workspace path strings
2. Accept `fileReader` function for reading files
3. Remove all Node.js `fs` and `path` imports
4. Use `CanvasDiscovery` pattern for finding/loading canvas files

## Implementation Steps

### 1. Fix `LocalRegistry` to use adapter pattern (packages/core)

**Current signature**:
```typescript
class LocalRegistry {
  registerWorkspace(scopeName: string, workspacePath: string): void
  // Uses fs.watch directly ❌
}
```

**New signature**:
```typescript
class LocalRegistry {
  constructor(private fileReader: (path: string) => Promise<string>) {}

  registerWorkspace(scopeName: string, fileTree: FileTree): void
  // No fs imports, uses fileTree + fileReader ✅
}
```

**Changes required**:
- Remove `import { watch } from 'fs'` and `import * as path from 'path'`
- Accept `FileTree` instead of `workspacePath` string
- Accept `fileReader` in constructor
- Use `CanvasDiscovery` pattern to find/load canvas files from FileTree
- File watching can be handled externally (trigger `invalidateCache()` on changes)

### 2. Update `CompositeRegistry` (packages/core)

```typescript
class CompositeRegistry {
  constructor(
    private localRegistry: LocalRegistry,
    private remoteRegistry: RemoteRegistry
  ) {}
}
```

No changes needed - just passes through to LocalRegistry.

### 3. Update electron-app renderer (DevWorkspacePanelFramework.tsx)

**Initialize orchestrator with file tree**:
```typescript
// Use existing file tree from context
const fileTree = context.fileTree; // or however you access it
const fileReader = (path: string) => context.getSlice('fileCache').read(path);

const localRegistry = new LocalRegistry(fileReader);
localRegistry.registerWorkspace(scopeName, fileTree);

const remoteRegistry = new RemoteRegistry('https://registry-url');
const compositeRegistry = new CompositeRegistry(localRegistry, remoteRegistry);
const orchestrator = new TraceOrchestrator({ registry: compositeRegistry });
```

**Replace manual construction**:
```typescript
// OLD: Manual construction
const registeredTrace: RegisteredTrace = { ... };

// NEW: Process through orchestrator
const registeredTrace = await orchestrator.processTrace(storedTrace.data);
```

### 4. Benefits
- ✅ Fixes browser-safety violation in core library
- ✅ Stored traces get full matching (not just "unmatched")
- ✅ Consistent processing between live and stored traces
- ✅ Works with local dev workspaces via file tree
- ✅ Works with published library versions via remote registry
- ✅ Uses existing file tree infrastructure (no new IPC calls)
- ✅ File watching handled by existing file tree watchers

## Registry Interface

The registry interface is simple - just one key method:

```typescript
interface StoryboardRegistryInterface {
  lookupByScope(
    scope: { name: string; version: string },
    resource: { attributes?: Record<string, unknown> }
  ): Promise<VersionSnapshot | null>;
}
```

## Questions to Resolve

1. **File tree access in electron-app** - How does the renderer access the file tree? Is it in a context/slice?
2. **File reader interface** - What's the signature for reading files in the renderer? (e.g., `context.getSlice('fileCache').read(path)`)
3. **Workspace registration** - How should the renderer know which workspaces/scope names to register for local dev?
4. **File watching** - File tree already has watchers - how do we trigger `localRegistry.invalidateCache(scopeName)` when `.principal-views` files change?
5. **Version resolution** - For local dev, do we need version → commit hash mapping, or just use "latest" from file tree?

## Core Library Fix Required

Before electron-app integration, we need to fix the browser-safety violation:

**Immediate action**: Refactor `LocalRegistry` in `packages/core` to:
- Remove Node.js `fs` and `path` imports
- Use `FileTree` + `fileReader` adapter pattern like `CanvasDiscovery`
- Move to `/node` export if we decide to keep Node.js version

**Alternative**: Create two versions:
- `LocalRegistry` (browser-safe, uses FileTree) - exported from main index
- `NodeLocalRegistry` (Node.js, uses fs.watch) - exported from /node only
