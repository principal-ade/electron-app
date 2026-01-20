# FileTree Timestamp and Size Data - Enhancement Request

**Date:** 2026-01-20
**Status:** Investigation Complete
**Priority:** Medium

## Executive Summary

The current FileTree implementation uses placeholder values for file modification times and sizes. While individual file watching (via `useFileWatch`) provides real-time change detection for actively watched files, the FileTree data structure lacks accurate metadata needed for:

- Efficient change detection without per-file watchers
- UI displays showing "last modified" times
- Size-based filtering and sorting
- Intelligent caching decisions

## Current State

### FileTree Builders

**PathsFileTreeBuilder** (most commonly used):
```typescript
const fileInfo: FileInfo = {
  path: filePath,
  name,
  extension,
  size: 0,                      // ← HARDCODED - not real file size
  lastModified: new Date(),     // ← CURRENT TIME - not file's actual mtime
  isDirectory: false,
  relativePath: '...',
};
```

**GitFileTreeBuilder**:
```typescript
{
  size: file.size || 0,                          // ← Falls back to 0 if not provided
  lastModified: file.lastModified || new Date(), // ← Falls back to current time
}
```

### Real Stats Collection (Available but Unused)

**FileSystemCore** has the capability to collect real stats:
```typescript
// Location: src/shared/repository-core/FileSystemCore.ts:295-312
if (includeStats) {  // ← This flag is rarely used!
  const stat = fs.statSync(fullPath);
  stats.push({
    path: relativePath,
    size: stat.size,               // ← Real file size from fs.stat()
    lastModified: stat.mtime,      // ← Real modification time
  });
}
```

## Impact Analysis

### What Works (Not Affected)

✅ **Individual File Watching** - Panels using `useFileWatch` hook work correctly:
- Canvas panels auto-reload on file changes
- Markdown viewers update when files change
- File editors detect external modifications
- Uses Chokidar with real file system events

✅ **Change Detection via SHA** - FileTree structure changes detected via path-based hash:
- Adding files triggers updates
- Removing files triggers updates
- Moving/renaming files triggers updates

### What Doesn't Work (Affected)

❌ **Content Change Detection** - FileTree SHA only hashes paths, not content:
- Modifying file content doesn't change SHA (paths unchanged)
- Can't detect "which files changed" without comparing timestamps
- Panels comparing `file.lastModified` get unreliable data

❌ **UI Display Issues** - Fake timestamps shown in interfaces:
- File lists can't sort by "last modified" accurately
- "Last updated" indicators show wrong times
- Size-based filtering not possible (all sizes = 0)

❌ **Inefficient Selective Reload** - Panels must reload everything or nothing:
- Can't determine if specific dependency files changed
- Current workaround: Canvas panels skip reload if unrelated files change
- But this relies on reference comparison, not actual change detection

## Proposed Enhancement

### Update Repository Monitoring Worker

Modify the FileTree builder in `@principal-ai/repository-monitoring-server` to collect real file stats:

**Change 1: Always include stats in PathsFileTreeBuilder**
```typescript
// In PathsFileTreeBuilder.build()
const stats = fs.statSync(fullPath);  // Add fs.stat() call

const fileInfo: FileInfo = {
  path: filePath,
  name,
  extension,
  size: stats.size,           // ← Use real size
  lastModified: stats.mtime,  // ← Use real modification time
  isDirectory: stats.isDirectory(),
  relativePath: '...',
};
```

**Change 2: Update FileTree SHA to include content hash**
```typescript
// Option A: Include mtime in SHA calculation
sha = hash(files.map(f => `${f.path}:${f.lastModified.getTime()}`))

// Option B: Separate content hash
{
  sha: 'abc123...',        // Path-based (structure hash)
  contentSha: 'xyz789...',  // Content-based (includes mtime/size)
}
```

**Change 3: Set `includeStats: true` by default**
```typescript
// In RepositoryMonitoringService
const tree = await FileSystemCore.buildFilteredFileTree(repoPath, {
  includeStats: true,  // ← Enable by default
  // ... other options
});
```

### Benefits

1. **Accurate Change Detection**
   - Panels can reliably detect if their dependencies changed
   - Avoid unnecessary reloads when unrelated files change
   - Enable smart caching based on actual modification times

2. **Better UI/UX**
   - File lists show accurate "last modified" times
   - Size-based sorting and filtering
   - Users can see which files were recently changed

3. **Reduced File Watchers**
   - Fewer individual file watchers needed
   - Can poll FileTree instead of watching 100s of individual files
   - Lower resource usage for large repositories

4. **Future-Proofing**
   - Enables content-aware caching strategies
   - Supports incremental build systems
   - Allows for "dirty file" indicators in UI

## Performance Considerations

### Concerns

- **Initial Build Time**: Calling `fs.statSync()` for thousands of files may slow initial FileTree builds
- **Watch Event Overhead**: Each file change triggers a full rebuild

### Mitigations

1. **Lazy Stat Collection**: Only stat files in watched directories or by pattern
2. **Incremental Updates**: When Chokidar fires change event, only re-stat changed files
3. **Selective Stats**: Add option to include stats only for certain file types (e.g., `.canvas`, `.md`)
4. **Caching**: Cache stats for unchanged files between rebuilds

### Benchmarks Needed

- [ ] Measure FileTree build time with/without stats for typical repo sizes:
  - Small repo (~100 files)
  - Medium repo (~1,000 files)
  - Large repo (~10,000 files)
- [ ] Compare memory usage
- [ ] Test rebuild performance on file change events

## Implementation Plan

### Phase 1: Enable Stats Collection (Low Risk)

1. Update `FileSystemCore.buildFilteredFileTree()` calls to use `includeStats: true`
2. Verify existing code handles real timestamps correctly
3. Monitor performance impact
4. **Estimated effort:** 1-2 hours

### Phase 2: Update SHA Calculation (Medium Risk)

1. Add content-based hash that includes mtime/size
2. Update cache comparison logic to check both structural and content changes
3. Update event emission to indicate what type of change occurred
4. **Estimated effort:** 4-6 hours

### Phase 3: Optimize Builders (Low Risk)

1. Implement incremental stat updates on file changes
2. Add selective stat collection by pattern
3. Benchmark and optimize for large repositories
4. **Estimated effort:** 6-8 hours

## Alternative Solutions

### Option 1: Keep Current System (Not Recommended)

- Rely on individual file watching for all change detection
- Continue using placeholder timestamps
- **Pros:** No changes needed
- **Cons:** Scales poorly, fake data in UI, inefficient

### Option 2: Hybrid Approach (Recommended)

- Collect real stats in FileTree
- Continue using `useFileWatch` for actively edited files
- Use FileTree timestamps for bulk change detection
- **Pros:** Best of both worlds, minimal risk
- **Cons:** Slightly more complex logic

### Option 3: Full Content Hashing (Overkill)

- Hash file contents instead of just timestamps
- **Pros:** Perfect change detection
- **Cons:** Extremely slow for large files, high CPU usage

## Recommendation

**Implement Phase 1 immediately** - Enable stats collection with minimal changes. This provides real data for UI display and change detection with low risk.

**Evaluate Phase 2 after metrics** - If Phase 1 shows acceptable performance, proceed with content-based SHA hashing.

**Phase 3 as needed** - Only optimize if performance issues arise with large repositories.

## Open Questions

1. What is the typical repository size in production?
2. How many files are typically watched simultaneously?
3. What is the acceptable latency for FileTree updates?
4. Should stats collection be configurable per-repository?
5. Do we need to support repositories with 10,000+ files?

## References

- FileTree builders: `/Users/griever/Developer/desktop-app/electron-app/release/app/node_modules/@industry-theme/principal-view-panels/node_modules/@principal-ai/repository-abstraction/src/builders/`
- File watching: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/hooks/useFileWatch.ts`
- FileSystem core: `/Users/griever/Developer/desktop-app/electron-app/src/shared/repository-core/FileSystemCore.ts`
- Canvas panels: `/Users/griever/Developer/visual-validation/industry-themed-principal-view-panels/src/panels/`

---

**Next Steps:**
1. Review this report with team
2. Decide on implementation approach
3. Create benchmarks for current FileTree build performance
4. Implement Phase 1 changes
5. Monitor production impact
