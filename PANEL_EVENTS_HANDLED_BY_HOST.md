# Panel Events Handled by Host (DevWorkspacePanelFramework)

This document lists all panel events that the host application (`DevWorkspacePanelFramework`) listens to and responds to.

**File:** `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`

## Event Handlers Summary

The host responds to the following panel events:

### 1. `task:selected` (Modal)
**Lines:** 462-472
**Action:** Opens task detail modal
**Payload:**
```typescript
{
  task: any;
  taskId: string;
}
```
**Behavior:**
- Ignores events re-emitted from modal (prevents loops)
- Opens `task-detail` panel in modal

---

### 2. `skill:selected` (Tab)
**Lines:** 474-523
**Action:** Creates/activates skill detail tab
**Payload:**
```typescript
{
  skill?: any;
  skillId?: string;
}
```
**Behavior:**
- Ignores events re-emitted from tabs (prevents loops)
- Checks if tab already exists for the skill
- If exists: no action (auto-activates existing tab)
- If new: creates new skill tab with full skill object
- Tab type: `SkillTab`

---

### 3. `agent:selected` (Modal)
**Lines:** 525-535
**Action:** Opens agent detail modal
**Payload:**
```typescript
{
  agent: any;
}
```
**Behavior:**
- Ignores events re-emitted from modal (prevents loops)
- Opens `agentDetail` panel in modal

---

### 4. `issue:selected` (Modal)
**Lines:** 537-547
**Action:** Opens GitHub issue detail modal
**Payload:**
```typescript
{
  issue: any;
}
```
**Behavior:**
- Ignores events re-emitted from modal (prevents loops)
- Opens `githubIssueDetail` panel in modal

---

### 5. `file:open` (Tab)
**Lines:** 549-622
**Action:** Creates file editor/git diff/MDX editor tab
**Payload:**
```typescript
{
  path: string;
  gitStatus?: string; // 'staged' | 'unstaged' | etc.
}
```
**Behavior:**
- Ignores events re-emitted from tabs (prevents loops)
- Checks if tab already exists for the file
- Determines tab type based on:
  - Markdown files (.md/.mdx) → MDX editor
  - Modified files (staged/unstaged) → Git diff
  - New/untracked files → File editor
- Creates appropriate tab type

---

### 6. `file:opened` (Tab - Markdown Only)
**Lines:** 624-689
**Action:** Creates markdown viewer tab
**Payload:**
```typescript
{
  filePath?: string;
  path?: string;
}
```
**Behavior:**
- Ignores events re-emitted from tabs (prevents loops)
- **Only handles markdown files** - ignores others
- Prevents duplicate tabs with loading tracker
- Pre-loads file content using `actions.setActiveFile()`
- Creates `MarkdownTab` if doesn't exist

---

### 7. `file:openInMdxEditor` (Modal)
**Lines:** 691-710
**Action:** Opens MDX editor modal
**Payload:**
```typescript
{
  filePath?: string;
}
```
**Behavior:**
- Ignores events re-emitted from modal (prevents loops)
- Opens `mdxEditor` panel in modal with file path

---

### 8. `custom` with `action: 'selectCanvas'` (Tab)
**Lines:** 712-795
**Action:** Creates/updates canvas editor or canvas detail tab
**Source Filter:** Only handles events from `canvas-list-panel` or `canvas-detail-panel`
**Payload:**
```typescript
{
  action: 'selectCanvas';
  canvasId: string;
  canvas: {
    name: string;
    path: string;
  };
  canvasFileInfo?: FileInfo;
  narrativeId?: string;
  narrative?: {
    path: string;
  };
  narrativeTemplate?: NarrativeTemplate;
  narrativeFileInfo?: FileInfo;
}
```
**Behavior:**
- **Only handles** `action: 'selectCanvas'` from canvas-list-panel or canvas-detail-panel
- Determines tab type based on narrative presence:
  - **With narrative** → `canvas-detail` tab (shows narrative scenarios)
  - **Without narrative** → `canvas-editor` tab (shows canvas editor)
- Checks if tab already exists:
  - If canvas-detail exists with narrative: updates narrative information
  - If canvas-editor exists: activates existing tab
  - If new: creates appropriate tab type

---

### 9. `task:deselected` (Modal Close)
**Lines:** 854-857
**Action:** Closes task detail modal
**Payload:** None
**Behavior:**
- Closes currently open modal

---

### 10. `agent:deselected` (Modal Close)
**Lines:** 858-861
**Action:** Closes agent detail modal
**Payload:** None
**Behavior:**
- Closes currently open modal

---

## Events NOT Currently Handled

### `openCanvas` (Custom Event)
**Status:** ❌ NOT HANDLED
**Emitted by:** `CanvasListPanel` (line 136-156 in CanvasListPanel.tsx)
**Payload:**
```typescript
{
  action: 'openCanvas';
  canvasId: string;
  canvas: DiscoveredCanvas;
  canvasFileInfo?: FileInfo;
}
```
**Purpose:** Emitted when user clicks the "Edit Canvas" button on a canvas with narratives
**Expected Behavior:** Should open the canvas file in the user's preferred editor or IDE

**Recommendation:** Add handler for `openCanvas` events to enable the "Edit Canvas" button functionality.

---

## Event Handling Patterns

### Loop Prevention
All handlers check the event source to prevent infinite loops:
- Modal handlers: Ignore `event.source === 'modal'`
- Tab handlers: Ignore `event.source === 'tab'`

### Tab Management
- **Check for existing tabs** before creating new ones
- **Auto-activation:** TabbedTerminalPanel automatically activates new tabs or existing tabs
- **Pre-loading:** Some handlers pre-load content before creating tabs (e.g., markdown files)
- **Deduplication:** Uses refs to track loading files and prevent duplicate tabs on rapid clicks

### Modal Management
- Modals are stored in `detailModal` state
- Only one modal can be open at a time
- Deselection events close the current modal

---

## Event Sources

Events can come from:
- **Panels:** `canvas-list-panel`, `canvas-detail-panel`, `git-changes-panel`, etc.
- **Tabs:** Events re-emitted when tabs are activated
- **Modals:** Events re-emitted when modal panels emit events
- **External:** User actions, keyboard shortcuts, menu items

---

## Tab Types

The host creates these tab types:
1. **SkillTab** - Skill detail view
2. **MDXEditorTab** - MDX file editor
3. **GitDiffTab** - Git diff viewer
4. **FileEditorTab** - Generic file editor
5. **MarkdownTab** - Markdown viewer
6. **CanvasTab** - Canvas detail with narrative scenarios
7. **CanvasEditorTab** - Canvas YAML editor

---

## Suggested Enhancements

### 1. Add `openCanvas` Handler
Handle the "Edit Canvas" button functionality:

```typescript
events.on('custom', (event) => {
  if (event.payload?.action !== 'openCanvas' || event.source !== 'canvas-list-panel') {
    return;
  }

  const { canvasId, canvas } = event.payload;

  // Option A: Open in system editor via actions.openFile()
  if (actions.openFile) {
    actions.openFile(canvas.path);
  }

  // Option B: Create canvas-editor tab
  setTabs((prevTabs) => {
    const existingTab = prevTabs.find(
      (t) => t.contentType === 'canvas-editor' && (t as CanvasEditorTab).canvasId === canvasId
    );

    if (existingTab) return prevTabs;

    return [...prevTabs, {
      id: `canvas-editor-${canvasId}-${Date.now()}`,
      label: canvas.name,
      contentType: 'canvas-editor',
      canvasId,
      canvasPath: canvas.path,
      canvasName: canvas.name,
      closable: true,
    }];
  });
});
```

### 2. Consolidate Custom Events
Currently only `selectCanvas` is handled via `custom` events. Consider:
- Creating specific event types (`canvas:selected`, `canvas:opened`)
- OR documenting which `action` values are supported in custom events

### 3. Add Event Documentation
Document expected payload schemas in TypeScript types for better type safety.

---

## Related Files

- **Event Definitions:** `src/renderer/types/panel-events.ts` (if exists)
- **Panel Context:** `src/renderer/contexts/PanelContext.tsx`
- **Panel Framework:** `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`
- **Canvas List Panel:** `industry-themed-principal-view-panels/src/panels/CanvasListPanel.tsx`
- **Canvas Narrative Tree:** `dynamic-file-tree/src/components/CanvasNarrativeTree/CanvasNarrativeTreeCore.tsx`

---

## Testing Events

To test event handling:

1. **Console Logging:** All handlers include console.log statements
2. **Event Tracking Story:** Use the `CanvasEventsTest` story in Storybook
3. **Source Filtering:** Check event.source to trace event origins

Example test:
```typescript
// Emit test event
events.emit({
  type: 'custom',
  source: 'canvas-list-panel',
  timestamp: Date.now(),
  payload: {
    action: 'selectCanvas',
    canvasId: 'test-canvas',
    canvas: { name: 'Test', path: '/test.canvas' }
  }
});
```
