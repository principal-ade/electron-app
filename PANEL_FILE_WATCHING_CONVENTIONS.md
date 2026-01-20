# Panel File Watching Conventions

**Date:** 2026-01-20
**Status:** Draft Proposal
**Related:** FILETREE_TIMESTAMPS_REPORT.md

## Executive Summary

This document establishes conventions for how panels should handle file change detection and auto-updates. Our system currently uses two parallel mechanisms:

1. **Individual File Watching** (`useFileWatch` hook) - Direct Chokidar watchers for instant updates
2. **FileTree Monitoring** - Repository-wide change detection with real timestamps

Both approaches have their place, but we need clear conventions to avoid confusion, resource duplication, and inconsistent UX.

## Background

### Current State (2026-01-20)

**FileTree Contains Real Data** ✅
- Real file sizes (bytes) from `fs.stat()`
- Real modification times (Date objects) from `fs.stat().mtime`
- Updates via repository-monitoring-server worker
- Batched updates (~100ms debounce)
- Verified working via testing on `/Users/griever/Developer/industry-themed-panels/industry-themed-agent-skills-panel/src/panels/SkillsListPanel.tsx`

**Two Independent Systems:**

```
┌─────────────────────────────────────────────────────────────┐
│ SYSTEM 1: useFileWatch (Individual File Watching)          │
├─────────────────────────────────────────────────────────────┤
│ • Scope: Single file at a time                             │
│ • Implementation: Direct Chokidar watcher in main process  │
│ • Latency: Instant (no batching)                           │
│ • API: useFileWatch(path, callback, options)               │
│ • Best for: Actively edited files, editors, viewers        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SYSTEM 2: FileTree (Repository Monitoring)                 │
├─────────────────────────────────────────────────────────────┤
│ • Scope: Entire repository (1000+ files)                   │
│ • Implementation: Repository-monitoring-server worker      │
│ • Latency: ~100ms (debounced batching)                     │
│ • API: context.getSlice('fileTree')                        │
│ • Best for: Lists, indexes, discovery, metadata display    │
└─────────────────────────────────────────────────────────────┘
```

## Convention 1: File Watching by Panel Type

### Rule: Choose Based on File Count and Edit Mode

```
┌──────────────────────────────────────────────────────────────┐
│ DECISION TREE                                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  How many files does your panel track?                      │
│                                                              │
│  ┌─ 1 file                                                  │
│  │  └─> useFileWatch ✅                                     │
│  │      Examples: Canvas editor, markdown viewer           │
│  │                                                          │
│  ┌─ 2-10 files                                              │
│  │  ├─ Actively edited by user?                            │
│  │  │  ├─ YES → useFileWatch (one per file) ✅             │
│  │  │  └─ NO  → FileTree timestamps ✅                     │
│  │  │                                                       │
│  │  Examples: Multi-tab editor, config file aggregator     │
│  │                                                          │
│  └─ 10+ files                                               │
│     └─> FileTree timestamps ✅                              │
│         (Optional: useFileWatch for ONE active file)        │
│                                                              │
│     Examples: Canvas list, markdown index, package viewer  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Convention 2: Editing Panels Must Use `skipReloadWhen`

### Rule: Never Auto-Reload During User Edits

**Problem:** User types → external change → auto-reload → user's work lost

**Solution:** Always use `skipReloadWhen` to preserve unsaved changes

### Pattern: Editor with Dirty State Tracking

```typescript
const MyEditorPanel: React.FC<{ filePath: string }> = ({ filePath, actions }) => {
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const isSavingRef = useRef(false);

  // Load file content
  const loadFile = useCallback(async () => {
    const result = await actions.readFile(filePath);
    if (result) {
      setContent(result.content);
      setIsDirty(false);
    }
  }, [filePath, actions]);

  // Initial load
  useEffect(() => {
    loadFile();
  }, [loadFile]);

  // CRITICAL: Watch file but skip reload during edits or saves
  useFileWatch(filePath, loadFile, {
    skipReloadWhen: () => isDirty || isSavingRef.current,
  });

  // Handle user edits
  const handleChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true); // Mark as dirty - prevents auto-reload
  };

  // Handle save
  const handleSave = async () => {
    isSavingRef.current = true; // Prevent reload during save
    try {
      await actions.writeFile(filePath, content);
      setIsDirty(false); // Clean state - re-enable auto-reload
    } finally {
      isSavingRef.current = false;
    }
  };

  return (
    <div>
      <textarea value={content} onChange={(e) => handleChange(e.target.value)} />
      <button onClick={handleSave} disabled={!isDirty}>
        Save {isDirty && '*'}
      </button>
    </div>
  );
};
```

### Anti-Pattern: No Dirty State Protection ❌

```typescript
// BAD: Will reload and lose user's edits!
const BadEditorPanel = ({ filePath }) => {
  const [content, setContent] = useState('');

  const loadFile = () => {
    const data = readFile(filePath);
    setContent(data); // Overwrites user's unsaved changes!
  };

  // Missing skipReloadWhen!
  useFileWatch(filePath, loadFile); // ❌ Dangerous

  return <textarea value={content} onChange={(e) => setContent(e.target.value)} />;
};
```

## Convention 3: Multi-File Panels Should Use FileTree

### Rule: Use FileTree for Discovery and Lists

**When you need to:**
- Display all files of a certain type (`.canvas`, `.md`, etc.)
- Show file metadata (size, last modified)
- Track multiple dependencies
- Monitor directory contents

### Pattern: List Panel with FileTree

```typescript
const CanvasListPanel: React.FC = () => {
  const { context } = useRepositoryPanelProvider();
  const fileTree = context.getSlice<FileTree>('fileTree')?.data;

  // Extract relevant files - re-runs when fileTree updates
  const canvases = useMemo(() => {
    if (!fileTree?.allFiles) return [];

    return fileTree.allFiles
      .filter((file) => file.path.endsWith('.canvas'))
      .map((file) => ({
        path: file.path,
        name: file.name,
        size: file.size, // Real size in bytes
        lastModified: file.lastModified, // Real Date object
      }))
      .sort((a, b) => {
        // Sort by most recently modified
        return b.lastModified.getTime() - a.lastModified.getTime();
      });
  }, [fileTree]);

  // Load data when list changes
  useEffect(() => {
    if (canvases.length > 0) {
      console.log(`Found ${canvases.length} canvas files`);
      // Could load additional data here if needed
    }
  }, [canvases]);

  return (
    <div>
      {canvases.map((canvas) => (
        <div key={canvas.path}>
          <h3>{canvas.name}</h3>
          <p>Size: {canvas.size} bytes</p>
          <p>Modified: {canvas.lastModified.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
};
```

### Key Points

1. **React handles change detection** - `useMemo` dependencies trigger automatically
2. **No manual timestamp comparison needed** - React compares `fileTree` reference
3. **Efficient** - One watcher for entire repo, not per-file
4. **Real metadata** - Sizes and timestamps are accurate

## Convention 4: Hybrid Panels (Editor + List)

### Rule: Use Both Systems for Different Purposes

**When you have:**
- One actively edited file (primary)
- Multiple related files (secondary)

**Example:** Canvas editor that shows a sidebar list of all canvases

### Pattern: Hybrid Panel

```typescript
const CanvasEditorWithListPanel: React.FC<{ selectedCanvas: string }> = ({
  selectedCanvas,
  actions,
  context,
  events,
}) => {
  // STATE: Current canvas (edited file)
  const [currentContent, setCurrentContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // SYSTEM 1: useFileWatch for active canvas (instant updates)
  const loadCurrentCanvas = useCallback(async () => {
    const result = await actions.readFile(selectedCanvas);
    if (result) {
      setCurrentContent(result.content);
      setIsDirty(false);
    }
  }, [selectedCanvas, actions]);

  useFileWatch(selectedCanvas, loadCurrentCanvas, {
    skipReloadWhen: () => isDirty, // Protect user edits
  });

  // SYSTEM 2: FileTree for canvas list (efficient discovery)
  const fileTree = context.getSlice<FileTree>('fileTree')?.data;

  const allCanvases = useMemo(() => {
    if (!fileTree?.allFiles) return [];
    return fileTree.allFiles
      .filter((f) => f.path.endsWith('.canvas'))
      .map((f) => ({
        path: f.path,
        name: f.name,
        isActive: f.path === selectedCanvas,
      }));
  }, [fileTree, selectedCanvas]);

  // Handle canvas selection
  const handleSelectCanvas = (canvasPath: string) => {
    if (isDirty) {
      // Warn user about unsaved changes
      if (!confirm('You have unsaved changes. Continue?')) {
        return;
      }
    }
    events.emit('canvas:selected', { canvasPath });
  };

  return (
    <div style={{ display: 'flex' }}>
      {/* Sidebar: List of all canvases (FileTree-powered) */}
      <aside>
        <h3>Canvases ({allCanvases.length})</h3>
        {allCanvases.map((canvas) => (
          <button
            key={canvas.path}
            onClick={() => handleSelectCanvas(canvas.path)}
            disabled={canvas.isActive}
          >
            {canvas.name} {canvas.isActive && '(active)'}
          </button>
        ))}
      </aside>

      {/* Main: Editor for selected canvas (useFileWatch-powered) */}
      <main>
        <h2>{selectedCanvas}</h2>
        <textarea
          value={currentContent}
          onChange={(e) => {
            setCurrentContent(e.target.value);
            setIsDirty(true);
          }}
        />
        <button onClick={saveCanvas} disabled={!isDirty}>
          Save {isDirty && '*'}
        </button>
      </main>
    </div>
  );
};
```

### Why This Works

- **Instant updates for active file** - User sees changes immediately (useFileWatch)
- **Efficient list monitoring** - All canvases tracked with one watcher (FileTree)
- **No resource waste** - Not watching 100 canvases individually
- **Consistent UX** - Active file feels responsive, list stays in sync

## Convention 5: Event-Driven Updates for Cross-Panel Changes

### Rule: Use Events for User Actions, FileTree for File System Changes

**Two types of changes:**
1. **File system changes** - External edits, git operations, CLI tools
2. **User actions** - Installing skills, creating canvases, etc.

### Pattern: Combining Events and FileTree

```typescript
const SkillsListPanel: React.FC = ({ context, events }) => {
  const fileTree = context.getSlice<FileTree>('fileTree')?.data;

  // FileTree-based skill discovery (handles file system changes)
  const fileSystemSkills = useMemo(() => {
    if (!fileTree?.allFiles) return [];
    return fileTree.allFiles
      .filter((f) => f.name === 'SKILL.md')
      .map((f) => ({ path: f.path, lastModified: f.lastModified }));
  }, [fileTree]);

  const { skills, refreshSkills } = useSkillsData({ context });

  // Event-based refresh (handles user actions that might not trigger FS changes yet)
  useEffect(() => {
    const unsubInstalled = events.on('skill:installed', () => {
      console.log('[SkillsListPanel] Skill installed, refreshing...');
      refreshSkills(); // Force refresh before file system catches up
    });

    const unsubUninstalled = events.on('skill:uninstalled', () => {
      console.log('[SkillsListPanel] Skill uninstalled, refreshing...');
      refreshSkills();
    });

    return () => {
      unsubInstalled();
      unsubUninstalled();
    };
  }, [events, refreshSkills]);

  // Render skills...
};
```

**Why both?**
- **Events** - Immediate feedback for user actions (no waiting for FS)
- **FileTree** - Catches external changes (git, CLI, other processes)

## Convention 6: Performance Considerations

### Rule: Don't Watch More Than ~20 Individual Files

**Resource cost of file watching:**

| Approach | Files Watched | Chokidar Instances | Memory | CPU |
|----------|---------------|-------------------|--------|-----|
| useFileWatch | 1 | 1 | ~1 MB | Low |
| useFileWatch | 10 | 10 | ~10 MB | Medium |
| useFileWatch | 100 | 100 | ~100 MB | High ❌ |
| FileTree | 1000+ | 1 | ~5 MB | Low ✅ |

### Anti-Pattern: Watching Many Files Individually ❌

```typescript
// BAD: Creates 50 separate Chokidar watchers!
const BadMultiFilePanel = () => {
  const [files] = useState([...Array(50)].map((_, i) => `file-${i}.md`));

  files.forEach((file) => {
    useFileWatch(file, () => reloadFile(file)); // ❌ 50 watchers!
  });
};
```

### Best Practice: Use FileTree for Many Files ✅

```typescript
// GOOD: One watcher for entire repo
const GoodMultiFilePanel = () => {
  const fileTree = context.getSlice<FileTree>('fileTree')?.data;

  const files = useMemo(() => {
    return fileTree?.allFiles.filter((f) => f.name.endsWith('.md'));
  }, [fileTree]); // ✅ One watcher via FileTree

  // Process files...
};
```

## Convention 7: Testing and Debugging

### Testing File Watching

**Add debug logs to verify behavior:**

```typescript
const loadFile = useCallback(async () => {
  console.log(`[MyPanel] Loading file: ${filePath}`);
  const result = await actions.readFile(filePath);
  console.log(`[MyPanel] File loaded, size: ${result.content.length}`);
  setContent(result.content);
}, [filePath]);

useFileWatch(filePath, loadFile, {
  skipReloadWhen: () => {
    const shouldSkip = isDirty;
    if (shouldSkip) {
      console.log('[MyPanel] Skipping reload - file is dirty');
    }
    return shouldSkip;
  },
});
```

**FileTree change logging:**

```typescript
useEffect(() => {
  if (!fileTree?.allFiles) return;

  const targetFile = fileTree.allFiles.find((f) => f.path.includes('my-file.tsx'));
  if (targetFile) {
    console.log('[Debug] File metadata:', {
      path: targetFile.path,
      size: targetFile.size,
      lastModified: targetFile.lastModified,
      timestamp: targetFile.lastModified?.getTime(),
    });
  }
}, [fileTree]);
```

## Open Questions & Future Optimizations

### Question 1: Should We Unify the APIs?

**Current:** Two separate APIs (`useFileWatch` vs `context.getSlice`)

**Proposal:** Create `useFileTreeWatch` for FileTree-based watching

```typescript
// Proposed API
useFileTreeWatch(
  pathPattern: string | RegExp,
  onFilesChange: (files: FileInfo[]) => void,
  options?: {
    enabled?: boolean;
  }
);

// Usage
useFileTreeWatch('**/*.canvas', (canvases) => {
  console.log(`Found ${canvases.length} canvases`);
  setCanvases(canvases);
});
```

### Question 2: Should We Auto-Deduplicate?

**Current:** Both systems can watch the same file independently

**Proposal:** Make `useFileWatch` automatically use FileTree when available

```typescript
// Proposed enhancement
useFileWatch(path, callback, {
  preferFileTree: true, // NEW: Use FileTree if available
  skipReloadWhen: () => isDirty,
});

// Implementation
function useFileWatch(path, callback, options) {
  const fileTree = useContext(RepositoryPanelContext).getSlice('fileTree');

  if (options.preferFileTree && fileTree?.data) {
    // Use FileTree timestamp comparison (no new watcher)
    return useFileTreeBasedWatch(path, callback, options);
  } else {
    // Fall back to individual Chokidar watcher
    return useIndividualFileWatch(path, callback, options);
  }
}
```

**Benefits:**
- Automatic resource optimization
- No breaking changes (opt-in via `preferFileTree`)
- Panels get instant mode when needed, efficient mode by default

### Question 3: What About Non-Repository Files?

**Current:** useFileWatch works for any file, FileTree only for repo files

**Edge cases:**
- Global skills (`~/.claude/skills/SKILL.md`)
- Config files outside repo (`~/.gitconfig`)
- Temporary files (`/tmp/preview.md`)

**Convention:** Use `useFileWatch` for non-repository files (FileTree can't see them)

## Migration Guide

### Migrating from useFileWatch to FileTree

**Before (useFileWatch for list):**
```typescript
const [canvases, setCanvases] = useState([]);

// Watching multiple files individually (inefficient)
useEffect(() => {
  canvasFiles.forEach((file) => {
    useFileWatch(file, () => reloadCanvases());
  });
}, [canvasFiles]);
```

**After (FileTree):**
```typescript
const fileTree = context.getSlice<FileTree>('fileTree')?.data;

const canvases = useMemo(() => {
  return fileTree?.allFiles.filter((f) => f.path.endsWith('.canvas'));
}, [fileTree]);
```

### Migrating from Manual Polling to FileTree

**Before (manual polling):**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    checkForFileChanges(); // Polls every second
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

**After (FileTree):**
```typescript
const fileTree = context.getSlice<FileTree>('fileTree')?.data;

useEffect(() => {
  // Automatically updates when files change (no polling!)
}, [fileTree]);
```

## Summary: Convention Checklist

When building a new panel, follow this checklist:

- [ ] **Determine file count** - How many files will this panel track?
- [ ] **Choose mechanism:**
  - [ ] 1 file, actively edited → `useFileWatch`
  - [ ] 10+ files or read-only → FileTree
  - [ ] Both → Hybrid (useFileWatch for active, FileTree for list)
- [ ] **If using useFileWatch:**
  - [ ] Implement dirty state tracking
  - [ ] Use `skipReloadWhen: () => isDirty`
  - [ ] Use `skipReloadWhen: () => isSaving`
  - [ ] Add debug logging
- [ ] **If using FileTree:**
  - [ ] Use `useMemo` with `[fileTree]` dependency
  - [ ] Filter `fileTree.allFiles` by pattern
  - [ ] Use `lastModified` and `size` for metadata
- [ ] **If using events:**
  - [ ] Subscribe in `useEffect` with cleanup
  - [ ] Use events for user actions
  - [ ] Use FileTree for file system changes
- [ ] **Test file watching:**
  - [ ] Verify auto-reload on external change
  - [ ] Verify no reload during user edit
  - [ ] Verify no reload during save
  - [ ] Check console for debug logs

## Related Files

**Implementation:**
- `/Users/griever/Developer/desktop-app/electron-app/src/renderer/hooks/useFileWatch.ts` - useFileWatch hook
- `/Users/griever/Developer/desktop-app/electron-app/src/renderer/contexts/RepositoryPanelContext.tsx` - FileTree provider
- `/Users/griever/Developer/desktop-app/electron-app/src/main/file-system/fileSystemHandlers.ts` - Individual file watching (main process)
- `/Users/griever/Developer/desktop-app/repository-monitoring-server/src/worker/FileTreeBuilder.ts` - FileTree construction

**Examples:**
- `/Users/griever/Developer/desktop-app/electron-app/src/renderer/pages/MarkdownView.tsx` - Single file viewer with useFileWatch
- `/Users/griever/Developer/desktop-app/electron-app/src/renderer/panels/components/HeadlessFileEditorPanel.tsx` - Editor with dirty state
- `/Users/griever/Developer/industry-themed-panels/industry-themed-agent-skills-panel/src/panels/SkillsListPanel.tsx` - List panel with FileTree + events
- `/Users/griever/Developer/visual-validation/industry-themed-principal-view-panels/src/panels/CanvasEditorPanel.tsx` - Hybrid panel (editor + list)

**Documentation:**
- `/Users/griever/Developer/desktop-app/electron-app/FILETREE_TIMESTAMPS_REPORT.md` - FileTree timestamp investigation

## Next Steps

1. **Review this document** with team for feedback
2. **Choose optimization strategy** (keep dual system, unify APIs, or auto-deduplicate)
3. **Update panel templates** with conventions
4. **Audit existing panels** for compliance
5. **Add TypeScript types** for file watching patterns
6. **Create migration guide** for non-compliant panels

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
**Authors:** Investigation completed via codebase analysis
