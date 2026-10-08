# MDX Editor Status Indicators Integration Guide

**Package**: `@industry-theme/file-editing-panels@0.3.12`
**Updated**: January 28, 2026
**Status**: Ready for integration

## Overview

The MDXEditorPanel now displays document status indicators directly in the toolbar, showing:
- 🟠 **Unsaved** (amber dot) - File has unsaved changes
- 🔵 **Uncommitted** (blue dot) - File is saved but not committed to git
- 🔵 **Untracked** (blue dot) - New file not tracked by git

This is powered by the new `statusContent` prop in `@principal-ai/mdx-editor@1.1.0`.

## What's New

### New Props Added to MDXEditorPanel

```typescript
interface MDXEditorPanelProps extends PanelComponentProps {
  filePath?: string | null;
  showCloseButton?: boolean;

  // NEW: Optional git status for the current file
  gitStatus?: 'staged' | 'unstaged' | 'untracked' | 'deleted' | null;

  // NEW: Optional dirty state for the current file
  isDirty?: boolean;
}
```

## Integration Steps

### 1. Update Package

```bash
npm update @industry-theme/file-editing-panels
# Updates from ^0.3.11 to ^0.3.12
```

### 2. Choose Integration Mode

There are two ways to use the new status indicators:

#### **Option A: Event-Based Mode (No Code Changes)**

The panel automatically listens to `git:diff` events and tracks its own dirty state.

**Current implementation** (lines 1187-1193 in DevWorkspacePanelFramework.tsx):
```tsx
<MDXEditorPanelComponent
  context={contextRef.current}
  actions={actionsRef.current}
  events={eventsRef.current}
  filePath={mdxEditorTab.filePath}
  showCloseButton={false}
/>
```

**Status**: ✅ Works immediately after package update

**Limitation**: Git status only updates when `git:diff` events are emitted. Currently, the app emits:
```typescript
events.emit({
  type: 'git:diff',
  payload: { filePath, status }  // Note: uses 'filePath', not 'path'
});
```

The panel now accepts both `filePath` and `path` keys in the event payload.

#### **Option B: Prop-Controlled Mode (Recommended for Tabs)**

Parent component manages state per-tab. Better for tab scenarios where each tab needs independent status.

### 3. Implement Prop-Controlled Mode for Tabs

#### Step 3.1: Update MDXEditorTab Interface

**File**: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` (around line 100)

```typescript
interface MDXEditorTab extends BaseTab {
  contentType: 'mdx-editor';
  filePath: string;
  fileName: string;

  // NEW: Add git status tracking
  gitStatus?: 'staged' | 'unstaged' | 'untracked' | 'deleted' | null;

  // NEW: Add dirty state tracking
  isDirty?: boolean;
}
```

#### Step 3.2: Track State When Creating Tabs

**Location**: Where `file:open` events create MDX editor tabs

```typescript
// When creating a new MDX editor tab
const newTab: MDXEditorTab = {
  id: `mdx-editor-${filePath}`,
  label: fileName,
  contentType: 'mdx-editor',
  filePath: filePath,
  fileName: fileName,
  gitStatus: null,      // Will be updated via git events
  isDirty: false,       // Will be updated on file changes
};

setTabs([...tabs, newTab]);
```

#### Step 3.3: Update Tab State on Events

**Listen to git:diff events:**
```typescript
useEffect(() => {
  const unsubscribe = events.on('git:diff', (event) => {
    const payload = event.payload as { path?: string; filePath?: string; status?: GitChangeStatus };
    const eventPath = payload?.path || payload?.filePath;

    if (eventPath && payload.status) {
      // Update the tab with matching filePath
      setTabs(prevTabs =>
        prevTabs.map(tab => {
          if (tab.contentType === 'mdx-editor' && tab.filePath === eventPath) {
            return { ...tab, gitStatus: payload.status };
          }
          return tab;
        })
      );
    }
  });

  return unsubscribe;
}, [events]);
```

**Listen to file:save events:**
```typescript
useEffect(() => {
  const unsubscribe = events.on('file:save', (event) => {
    const payload = event.payload as { path: string };

    if (payload?.path) {
      // Clear dirty state and set git status to unstaged
      setTabs(prevTabs =>
        prevTabs.map(tab => {
          if (tab.contentType === 'mdx-editor' && tab.filePath === payload.path) {
            return {
              ...tab,
              isDirty: false,
              gitStatus: tab.gitStatus === 'untracked' ? 'untracked' : 'unstaged'
            };
          }
          return tab;
        })
      );
    }
  });

  return unsubscribe;
}, [events]);
```

**Track changes from MDXEditor onChange:**
```typescript
// In the tab render, capture onChange
<MDXEditorPanelComponent
  context={contextRef.current}
  actions={actionsRef.current}
  events={eventsRef.current}
  filePath={mdxEditorTab.filePath}
  gitStatus={mdxEditorTab.gitStatus}
  isDirty={mdxEditorTab.isDirty}
  showCloseButton={false}
  // Note: onChange is handled internally by the panel,
  // but you can track it via file:save events
/>
```

#### Step 3.4: Update Render Logic

**File**: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` (line 1187-1193)

```typescript
case 'mdx-editor': {
  const mdxEditorTab = tab as MDXEditorTab;

  if (!MDXEditorPanelComponent) {
    return <div>MDX Editor panel not available</div>;
  }

  return (
    <div key={tab.id} style={{ height: '100%', overflow: 'auto' }}>
      <MDXEditorPanelComponent
        context={contextRef.current}
        actions={actionsRef.current}
        events={eventsRef.current}
        filePath={mdxEditorTab.filePath}
        gitStatus={mdxEditorTab.gitStatus}      // NEW: Pass git status from tab
        isDirty={mdxEditorTab.isDirty}          // NEW: Pass dirty state from tab
        showCloseButton={false}
      />
    </div>
  );
}
```

## Testing

### Manual Testing Steps

1. **Test Unsaved State**:
   - Open a markdown file in MDX editor
   - Edit the content
   - Verify 🟠 "Unsaved" appears in toolbar

2. **Test Save**:
   - Press Cmd/Ctrl+S
   - Verify "Unsaved" disappears
   - Verify 🔵 "Uncommitted" appears

3. **Test New File (Untracked)**:
   - Create a new .md file
   - Verify 🔵 "Untracked" appears after saving

4. **Test Multiple Tabs**:
   - Open multiple markdown files
   - Edit in different tabs
   - Verify each tab shows independent status

5. **Test After Commit**:
   - Commit changes via git
   - Verify status indicator clears

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ MDXEditorPanel (in @industry-theme/file-editing-panels)    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Toolbar (with statusContent)                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ Undo/Redo│  │  Format  │  │  Status: 🟠 Unsaved │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ MDXEditor Content                                   │  │
│  │ (Lexical-based rich text editor)                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
      ↑                           ↑
      │                           │
      │ events.on('git:diff')     │ props: gitStatus, isDirty
      │                           │
      └───────────────────────────┘
    Event-based mode       Prop-controlled mode
```

### Status Update Flow

#### Event-Based Mode:
```
User edits → MDXEditor onChange → Panel sets internalIsDirty=true
                                → Toolbar shows "Unsaved"

User saves → fileSystem.writeFile() → Panel sets internalIsDirty=false
                                    → Panel sets internalGitStatus='unstaged'
                                    → Toolbar shows "Uncommitted"

Git event → events.emit('git:diff') → Panel sets internalGitStatus
                                    → Toolbar updates
```

#### Prop-Controlled Mode:
```
User edits → MDXEditor onChange → Panel emits 'file:change' (internal)
                                → Parent updates tab.isDirty=true
                                → Panel receives new prop
                                → Toolbar shows "Unsaved"

User saves → fileSystem.writeFile() → Panel emits 'file:save'
                                    → Parent updates tab.isDirty=false
                                    → Parent updates tab.gitStatus='unstaged'
                                    → Panel receives new props
                                    → Toolbar shows "Uncommitted"

Git event → events.emit('git:diff') → Parent updates tab.gitStatus
                                    → Panel receives new prop
                                    → Toolbar updates
```

## Troubleshooting

### Status indicators not appearing

**Check 1**: Verify package version
```bash
npm list @industry-theme/file-editing-panels
# Should show @0.3.12 or higher
```

**Check 2**: Verify git:diff events are being emitted
```typescript
// Add logging in PanelContext.tsx
openGitDiff: (filePath: string, status?: string) => {
  console.log('[DEBUG] Emitting git:diff:', { filePath, status });
  events.emit({
    type: 'git:diff',
    source: 'panel-context',
    timestamp: Date.now(),
    payload: { filePath, status },
  });
}
```

**Check 3**: Verify event payload format
The panel accepts both formats:
- `{ path: string, status: ... }` (GitDiffPanel format)
- `{ filePath: string, status: ... }` (PanelContext format)

### Status not updating after save

**Issue**: The `file:save` event may not include git status.

**Solution**: Ensure git status is checked after save:
```typescript
// After file:save event, check git status
const gitStatus = await checkGitStatus(filePath);
events.emit({
  type: 'git:diff',
  payload: { filePath, status: gitStatus }
});
```

### Multiple tabs showing same status

**Issue**: Using event-based mode with tabs.

**Solution**: Switch to prop-controlled mode (see Step 3 above).

## Related Files

- **Panel Component**: `node_modules/@industry-theme/file-editing-panels/dist/panels/MDXEditorPanel/MDXEditorPanel.d.ts`
- **Tab Rendering**: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` (lines 1187-1193)
- **Event Emitter**: `src/renderer/contexts/PanelContext.tsx` (line 834)
- **Types**: `node_modules/@industry-theme/file-editing-panels/dist/types/index.d.ts`

## Dependencies

- `@principal-ai/mdx-editor@1.1.0` - Core MDX editor with `statusContent` support
- `@industry-theme/file-editing-panels@0.3.12` - Panel wrapper with status tracking

## Next Steps

1. ✅ Update package (`npm update @industry-theme/file-editing-panels`)
2. ⏳ Test event-based mode (should work immediately)
3. ⏳ Implement prop-controlled mode for tabs (follow Step 3)
4. ⏳ Add git status checking after file operations
5. ⏳ Test with multiple tabs
6. ⏳ Deploy and verify in production

## Questions?

- Check MDXEditorPanel source: `node_modules/@industry-theme/file-editing-panels/src/panels/MDXEditorPanel/MDXEditorPanel.tsx`
- Review example in Ladle stories: `MDXEditorPanel.stories.tsx`
- See original PR/commit for context

---

**Last Updated**: January 28, 2026
**Author**: Claude Code
