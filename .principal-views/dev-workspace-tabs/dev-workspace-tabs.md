# DevWorkspace Tab & File Opening Flow

This document describes the two distinct workflows for opening content in the DevWorkspace.

## Two Distinct Workflows

The DevWorkspace has **two separate entry points** for opening content, each with its own flow:

### 1. Open in Tab (Left Column)

**Triggers:**
- Context menu "Open in Tab" action
- Double-click on file
- Skill/Trace selection from list
- Canvas click
- Any action with "open in tab" intent

**Events:**
- `doc:openInTab` (NEW)
- `file:open`
- `skill:selected`
- `trace:selected`
- `custom` (action: 'openCanvas')

**Flow:**
```
Trigger → Event → Check Existing Tab → Create/Focus Tab → Render → TabbedTerminalPanel
```

### 2. Open in Right Panel (Right Column)

**Triggers:**
- Single-click on doc file
- Preview action
- Docs panel selection
- Any action with "show in side" intent

**Events:**
- `doc:openInRightPanel`
- `file:opened`

**Flow:**
```
Trigger → Event → setActiveFile() → onLayoutChange() → MarkdownPanel
```

## Key Differences

| Aspect | Tab | Right Panel |
|--------|-----|-------------|
| Data source | Own `filePath` prop | `context.activeFile` slice |
| Multiple open | Yes | No (single slot) |
| Closable | Yes (by user) | No (part of layout) |
| Persistence | Tab state | Layout state |
| Independence | Fully independent | Depends on activeFile |

## Tab Content Types

Tabs support multiple content types:
- `markdown` - Read-only markdown viewer
- `mdx-editor` - Editable MDX/markdown
- `canvas-editor` - Canvas file editor
- `canvas` - Canvas detail view
- `skill` - Skill detail panel
- `trace-details` - Trace viewer
- `git-diff` - Git diff viewer
- `file-editor` - Generic file editor

## Event Payloads

### doc:openInTab (NEW)

```typescript
interface DocOpenInTabPayload {
  path: string;           // File path to open
  label?: string;         // Optional tab label
  editable?: boolean;     // Use MDX editor vs read-only
  source?: string;        // Event source for loop prevention
}
```

### doc:openInRightPanel

```typescript
interface DocOpenInRightPanelPayload {
  path: string;           // File path to open
  relativePath?: string;  // Alternative path format
}
```

## Implementation Notes

### Tab Path
1. Event handler checks for existing tab by deterministic ID
2. If exists: focus existing tab
3. If not: create new tab with appropriate contentType
4. Set focusTabId to activate
5. renderTabContent() switches on contentType

### Right Panel Path
1. Event handler calls `actions.setActiveFile(path)`
2. File content is read and stored in activeFileSlice
3. Layout changed to show `markdown-viewer` in right slot
4. Panel expanded if collapsed
5. MarkdownPanel reads from `context.activeFile.data`

## OTEL Events

| Event | Workflow | Description |
|-------|----------|-------------|
| `devworkspace.openInTab.requested` | Tab | User triggered tab open |
| `devworkspace.event.openInTab` | Tab | Event emitted |
| `devworkspace.tab.lookup` | Tab | Check for existing tab |
| `devworkspace.tab.created` | Tab | New tab created |
| `devworkspace.tab.focused` | Tab | Tab activated |
| `devworkspace.tab.rendered` | Tab | Content rendered |
| `devworkspace.openInPanel.requested` | Panel | User triggered panel open |
| `devworkspace.event.openInPanel` | Panel | Event emitted |
| `devworkspace.activeFile.set` | Panel | File loaded into context |
| `devworkspace.layout.changed` | Panel | Layout updated |
| `devworkspace.panel.markdown.rendered` | Panel | Markdown panel rendered |

## Files

- `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` - Main event handlers
- `src/renderer/contexts/PanelContext.tsx` - activeFile management
- `@industry-theme/xterm-terminal-panel` - TabbedTerminalPanel (external)
