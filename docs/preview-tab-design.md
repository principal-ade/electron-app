# Preview Tab Design (VS Code-style)

## Overview

VS Code has a "preview mode" for tabs where single-clicking a file opens it in a temporary/preview tab that gets replaced when clicking another file. Double-clicking "pins" the tab, making it persistent. This reduces tab clutter when browsing files.

## VS Code Behavior

### Visual Indicators
- Preview tabs show filename in *italics*
- Pinned tabs show filename in normal text
- Preview tab has no close button until hovered (optional)

### Interactions
| Action | Result |
|--------|--------|
| Single-click file | Opens in preview tab (replaces existing preview) |
| Double-click file | Opens as pinned tab (persistent) |
| Edit content in preview tab | Auto-pins the tab |
| Double-click preview tab header | Pins the tab |
| Drag preview tab | Pins the tab |

### Rules
1. Only ONE preview tab exists at a time per tab group
2. Preview tab is always the rightmost "temporary" position
3. Opening a new file replaces the preview tab (if unpinned)
4. Any edit action automatically pins the preview tab

## Proposed Implementation

### 1. Tab State Extension

Extend `BaseTab` interface in `TabbedTerminalPanel`:

```typescript
interface BaseTab {
  id: string;
  label: string;
  contentType: string;
  closable?: boolean;
  icon?: React.ReactNode;

  // New: preview mode support
  isPinned?: boolean;  // false = preview tab, true = pinned tab
}
```

### 2. New Props for TabbedTerminalPanel

```typescript
interface TabbedTerminalPanelProps<TTab extends BaseTab> {
  // ... existing props ...

  /**
   * Enable VS Code-style preview tabs.
   * Single-click opens in preview (replaceable), double-click pins.
   * @default false
   */
  enablePreviewTabs?: boolean;

  /**
   * Callback when a tab should be pinned (user double-clicked, edited content, etc.)
   */
  onPinTab?: (tabId: string) => void;

  /**
   * Callback when opening a file that should use preview mode.
   * Return the tab to open. If a preview tab exists, it will be replaced.
   */
  onPreviewOpen?: (tab: TTab) => void;
}
```

### 3. Event Flow Changes

#### Current Flow (DevWorkspacePanelFramework)
```
file:open event → check if tab exists → create new tab or focus existing
```

#### New Flow with Preview Mode
```
file:open event (single-click)
  → check if tab exists (by content, not just ID)
    → YES: focus existing tab
    → NO: check for existing preview tab
      → YES: replace preview tab content, update ID
      → NO: create new preview tab

file:open event (double-click or explicit pin)
  → check if tab exists
    → YES: pin if preview, focus
    → NO: create new pinned tab
```

### 4. Event Payload Extension

Extend the `file:open` event payload:

```typescript
interface FileOpenPayload {
  path: string;
  gitStatus?: string;

  // New: interaction type
  interaction?: 'single-click' | 'double-click' | 'enter-key' | 'explicit';
}
```

### 5. Tab ID Strategy

Preview tabs need special ID handling:

```typescript
// Option A: Special preview ID prefix
const previewTabId = `preview-${contentType}`;  // e.g., "preview-file-editor"

// Option B: Content-based ID with preview flag
const tabId = `file-editor-${filePath}`;
tab.isPinned = false;
```

**Recommendation:** Option B - content-based IDs with `isPinned` flag. This allows:
- Finding existing tabs by content (regardless of pin state)
- Converting preview → pinned without changing ID
- Simpler duplicate detection

### 6. UI Changes

#### Tab Header Styling
```typescript
// In tab header render
const tabLabelStyle = {
  fontStyle: tab.isPinned === false ? 'italic' : 'normal',
};
```

#### Tab Header Double-Click Handler
```typescript
const handleTabDoubleClick = (tabId: string) => {
  const tab = tabs.find(t => t.id === tabId);
  if (tab && !tab.isPinned) {
    onPinTab?.(tabId);
  }
};
```

### 7. Auto-Pin Triggers

Tabs should auto-pin when:
1. User edits content (file editor, canvas, etc.)
2. User double-clicks the tab header
3. User drags the tab to reorder
4. User explicitly requests via context menu

### 8. Integration Points

#### DevWorkspacePanelFramework Changes
```typescript
// Handle file:open with interaction type
const handleFileOpen = (event: PanelEvent) => {
  const { path, interaction } = event.payload;
  const shouldPin = interaction === 'double-click' || interaction === 'explicit';

  // Check for existing tab by content
  const existingTab = tabs.find(t =>
    t.contentType === 'file-editor' && t.filePath === path
  );

  if (existingTab) {
    if (shouldPin && !existingTab.isPinned) {
      pinTab(existingTab.id);
    }
    focusTab(existingTab.id);
    return;
  }

  if (shouldPin) {
    createPinnedTab(path);
  } else {
    createOrReplacePreviewTab(path);
  }
};
```

#### Tree Component Changes (dynamic-file-tree)
```typescript
// Detect single vs double click
const handleNodeClick = (node, event) => {
  // Use a timer to differentiate single/double click
  if (clickTimerRef.current) {
    // Double click
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
    onFileSelect?.(node.id, 'double-click');
  } else {
    // Potential single click - wait to confirm
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onFileSelect?.(node.id, 'single-click');
    }, 250); // Standard double-click threshold
  }
};
```

## Migration Strategy

### Phase 1: Add Infrastructure
1. Add `isPinned` to BaseTab interface
2. Add preview-related props to TabbedTerminalPanel
3. Add italic styling for preview tabs
4. Default `enablePreviewTabs={false}` for backward compatibility

### Phase 2: Update Event Sources
1. Update tree components to emit interaction type
2. Update file list components
3. Update search result clicks

### Phase 3: Enable Feature
1. Set `enablePreviewTabs={true}` in DevWorkspacePanelFramework
2. Implement auto-pin triggers in editor components
3. Add user preference to disable if desired

## Considerations

### Edge Cases
- What happens when preview tab has unsaved changes and user clicks another file?
  - Option A: Prompt to save (VS Code behavior)
  - Option B: Auto-save and replace
  - Option C: Auto-pin on first edit (prevents this scenario)

- Multiple tab groups (split view)?
  - Each group has its own preview tab

### Performance
- No significant impact - just tracking one boolean per tab
- Slightly more logic in click handlers

### User Preferences
Consider a setting: `editor.enablePreviewFromQuickOpen` (VS Code has this)
- Some users prefer all tabs to be pinned immediately
- Could be a workspace-level or global preference

## References
- [VS Code Preview Mode Docs](https://code.visualstudio.com/docs/getstarted/userinterface#_preview-mode)
- VS Code setting: `workbench.editor.enablePreview`
- VS Code setting: `workbench.editor.enablePreviewFromQuickOpen`
