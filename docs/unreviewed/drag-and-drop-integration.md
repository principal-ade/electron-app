# Drag and Drop Integration Guide

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Implementation Patterns](#implementation-patterns)
4. [Panel-to-Panel Communication Protocol](#panel-to-panel-communication-protocol)
   - [Architecture Principles](#architecture-principles)
   - [Standard Data Transfer Formats](#standard-data-transfer-formats)
   - [Standard Panel Data Schema](#standard-panel-data-schema)
   - [Drop Handler Pattern](#drop-handler-pattern)
   - [Defining Panel Types and Data Types](#defining-panel-types-and-data-types)
   - [Action Semantics by Target Panel](#action-semantics-by-target-panel)
   - [Cross-Panel Drag Matrix](#cross-panel-drag-matrix)
5. [Specific Use Cases](#specific-use-cases)
   - [Alexandria Docs → Terminal](#alexandria-docs--terminal)
   - [Alexandria Docs → Editor](#alexandria-docs--editor)
   - [File Tree → Terminal](#file-tree--terminal)
   - [Git Panels Use Cases](#git-panels-use-cases)
   - [Drawing Panels Use Cases](#drawing-panels-use-cases)
6. [Advanced Patterns](#advanced-patterns)
   - [Modifier Keys for Action Selection](#modifier-keys-for-action-selection)
   - [Multi-Item Drag](#multi-item-drag)
   - [Drag Preview Customization](#drag-preview-customization)
   - [Context-Aware Drop Zones](#context-aware-drop-zones)
7. [Library Implementation Guide](#library-implementation-guide)
   - [For Panel Framework Developers](#for-panel-framework-developers)
8. [Visual Feedback Best Practices](#visual-feedback-best-practices)
9. [Edge Cases & Considerations](#edge-cases--considerations)
10. [Testing Drag and Drop](#testing-drag-and-drop)
11. [Accessibility](#accessibility)
12. [Common Pitfalls](#common-pitfalls)
13. [Implementation Checklist](#implementation-checklist)
14. [Migration Guide](#migration-guide)
15. [Real-World Examples](#real-world-examples)
16. [Troubleshooting](#troubleshooting)
17. [Future Enhancements](#future-enhancements)
18. [Related Dependencies](#related-dependencies)
19. [Resources](#resources)

## Overview

This guide explains how to implement drag-and-drop functionality across panels in the electron-app. The key concept is using the HTML5 Drag and Drop API with `dataTransfer` to pass text/data between components.

**Key Features:**
- ✅ **Native HTML5 API** - No external dependencies
- ✅ **Framework-agnostic protocol** - Works with any UI library
- ✅ **Progressive enhancement** - Rich metadata with text fallback
- ✅ **Type-safe** - Comprehensive TypeScript interfaces
- ✅ **Extensible** - Easy to add new panel types and data types

## Core Concepts

### 1. Drag Data Transfer

The HTML5 Drag and Drop API uses `DataTransfer` objects to pass data between draggable elements and drop targets:

```tsx
// Setting data when drag starts
e.dataTransfer.setData('text/plain', 'some text or path');

// Getting data when dropped
const data = e.dataTransfer.getData('text/plain');
```

### 2. Data Format Convention

Use `text/plain` as the standard MIME type for drag operations:
- **File paths**: Absolute paths like `/Users/name/project/src/file.ts`
- **Selected text**: Any text content the user has selected
- **Custom data**: Can be JSON strings if needed, but prefer simple text

## Implementation Patterns

### Pattern 1: Making Elements Draggable

To make an element draggable (e.g., file tree items, text selections):

```tsx
<div
  draggable={true}
  onDragStart={(e) => {
    // Set the data to transfer
    const dataToTransfer = 'path/to/file.ts';
    e.dataTransfer.setData('text/plain', dataToTransfer);
    e.dataTransfer.effectAllowed = 'copy'; // or 'move', 'link'

    // Optional: Set custom drag image
    e.dataTransfer.setDragImage(element, offsetX, offsetY);
  }}
  onDragEnd={(e) => {
    // Clean up any visual feedback
  }}
>
  {/* Draggable content */}
</div>
```

**Key Points:**
- Set `draggable={true}` on the element
- Use `onDragStart` to set the data via `dataTransfer.setData()`
- Use `effectAllowed` to indicate what drag operations are permitted

### Pattern 2: Creating Drop Targets

To make an element accept drops (e.g., terminal, editor):

```tsx
<div
  onDragOver={(e) => {
    e.preventDefault(); // Required to allow dropping
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy'; // Visual feedback
  }}
  onDragEnter={(e) => {
    e.preventDefault();
    e.stopPropagation();
    // Show visual feedback that drop is allowed
    e.currentTarget.style.opacity = '0.8';
  }}
  onDragLeave={(e) => {
    e.preventDefault();
    e.stopPropagation();
    // Remove visual feedback
    // Check if we're actually leaving (not entering a child)
    if (e.target === e.currentTarget) {
      e.currentTarget.style.opacity = '1';
    }
  }}
  onDrop={(e) => {
    e.preventDefault();
    e.stopPropagation();
    // Remove visual feedback
    e.currentTarget.style.opacity = '1';

    // Get the dropped data
    const droppedData = e.dataTransfer.getData('text/plain');

    // Process the data
    handleDroppedData(droppedData);
  }}
>
  {/* Drop target content */}
</div>
```

**Key Points:**
- **MUST** call `e.preventDefault()` in `onDragOver` to allow dropping
- Use `onDragEnter` and `onDragLeave` for visual feedback
- Extract data in `onDrop` via `dataTransfer.getData()`

### Pattern 3: Text Selection Drag

Browser text selections are draggable by default, but you can enhance them:

```tsx
<div
  onDragStart={(e) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString();

    if (selectedText && e.dataTransfer) {
      e.dataTransfer.setData('text/plain', selectedText);
      e.dataTransfer.effectAllowed = 'copy';
    }
  }}
>
  {/* Text content that can be selected */}
</div>
```

## Panel-to-Panel Communication Protocol

### Overview

To create a reusable, extensible drag-and-drop system across panels, we need a standardized protocol that:
1. **Works across different panel types** (file trees, document lists, git panels, terminals, editors, etc.)
2. **Supports rich metadata** while maintaining backward compatibility
3. **Defines clear action semantics** (view, insert, reference, open, etc.)
4. **Enables progressive enhancement** (fallback to simple text when needed)

### Architecture Principles

**For Panel Framework Library Developers:**

This protocol is designed to be **framework-agnostic** and **library-friendly**. It uses:

1. **Native HTML5 Drag-Drop API** - No external dependencies, works everywhere
2. **Layered Data Transfer** - Multiple MIME types for progressive enhancement
3. **Semantic Action System** - Clear, consistent behavior across panel types
4. **Type-Safe Interfaces** - Well-defined TypeScript types for all interactions
5. **Declarative Configuration** - Panels declare capabilities, framework handles coordination

**Key Design Decisions:**

- **Use `application/x-panel-data` as standard MIME type** for rich panel interactions
- **Always include `text/plain` fallback** for maximum compatibility
- **First suggested action is default** - ordered priority list
- **Metadata is optional** - minimum viable transfer is just `primaryData`
- **Source panel identification** - enables context-aware drop handling

### Quick Reference Table

| Concept | Description | Example |
|---------|-------------|---------|
| **MIME Type** | `application/x-panel-data` | Standard format for panel data |
| **Fallback** | `text/plain` | Always include for compatibility |
| **Data Types** | Semantic content type | `file-path`, `markdown-document`, `git-commit` |
| **Panel Types** | Source panel identifier | `alexandria-docs`, `file-tree`, `terminal` |
| **Actions** | What to do with data | `view`, `open`, `insert-path`, `reference` |
| **Primary Data** | Main payload | File path, commit SHA, text content |
| **Metadata** | Rich context | Name, relative path, status, etc. |

### How It Works

```
┌─────────────┐                                    ┌─────────────┐
│   Source    │                                    │   Target    │
│   Panel     │                                    │   Panel     │
└─────────────┘                                    └─────────────┘
      │                                                    │
      │ 1. User drags item                                │
      │    (file, doc, commit, etc.)                      │
      │                                                    │
      │ 2. onDragStart:                                   │
      │    - Set text/plain (fallback)                    │
      │    - Set application/x-panel-data (rich)          │
      │    - Set custom MIME type (optional)              │
      │                                                    │
      ├────────── DataTransfer Object ─────────────────> │
      │                                                    │
      │                                    3. onDragOver: │
      │                                       - Check MIME types │
      │                                       - Show visual feedback │
      │                                                    │
      │                                        4. onDrop: │
      │                                       - Try application/x-panel-data │
      │                                       - Parse JSON to PanelDragData │
      │                                       - Route by dataType │
      │                                       - Execute action │
      │                                       - Fallback to text/plain │
      │                                                    │
```

### Standard Data Transfer Formats

Use a **multi-format approach** where drag sources set multiple MIME types in order of specificity:

```tsx
// Layered data transfer strategy
onDragStart={(e) => {
  // Layer 1: Plain text fallback (always include)
  e.dataTransfer.setData('text/plain', item.path);

  // Layer 2: Typed data with metadata
  e.dataTransfer.setData('application/x-panel-data', JSON.stringify({
    sourcePanel: 'alexandria-docs',
    dataType: 'markdown-document',
    primaryData: item.path,
    metadata: { /* rich context */ },
    suggestedActions: ['view', 'insert-path', 'reference']
  }));

  // Layer 3: Domain-specific formats (optional)
  e.dataTransfer.setData('application/x-alexandria-doc', JSON.stringify({
    /* Alexandria-specific data */
  }));
}}
```

### Standard Panel Data Schema

Define a common interface for panel drag data:

```tsx
interface PanelDragData {
  /** Identifier for the source panel type */
  sourcePanel: string;

  /** Semantic type of the data being dragged */
  dataType: 'file-path' | 'directory-path' | 'markdown-document' |
            'drawing' | 'git-commit' | 'git-file-change' | 'terminal-command' |
            'code-symbol' | 'text-selection' | string;

  /** Primary data (usually a path, ID, or text content) */
  primaryData: string;

  /** Additional contextual metadata */
  metadata?: {
    name?: string;
    relativePath?: string;
    absolutePath?: string;
    fileType?: string;
    lineNumber?: number;
    [key: string]: any;
  };

  /** Actions the target might perform (in priority order) */
  suggestedActions?: Array<
    'view' | 'open' | 'insert-path' | 'insert-content' |
    'reference' | 'execute' | 'diff' | 'navigate' | string
  >;

  /** Version for future compatibility */
  version?: string;
}
```

### Drop Handler Pattern

Drop targets should check for data formats in order of specificity:

```tsx
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // Try richest format first
  const panelData = e.dataTransfer.getData('application/x-panel-data');
  if (panelData) {
    try {
      const data: PanelDragData = JSON.parse(panelData);
      return handlePanelDrop(data);
    } catch (err) {
      console.warn('Failed to parse panel data:', err);
    }
  }

  // Try domain-specific formats
  const alexandriaDoc = e.dataTransfer.getData('application/x-alexandria-doc');
  if (alexandriaDoc) {
    try {
      return handleAlexandriaDocDrop(JSON.parse(alexandriaDoc));
    } catch (err) {
      console.warn('Failed to parse Alexandria doc:', err);
    }
  }

  // Fall back to plain text
  const plainText = e.dataTransfer.getData('text/plain');
  if (plainText && plainText.trim()) {
    return handlePlainTextDrop(plainText);
  }

  console.warn('No valid drop data found');
};

const handlePanelDrop = (data: PanelDragData) => {
  // Route based on data type and suggested actions
  switch (data.dataType) {
    case 'file-path':
      return handleFileDrop(data);
    case 'markdown-document':
      return handleDocumentDrop(data);
    case 'git-commit':
      return handleGitCommitDrop(data);
    default:
      // Generic handler based on suggested actions
      return handleGenericDrop(data);
  }
};
```

### Defining Panel Types and Data Types

Create a registry of standard panel types and their data types:

```tsx
// Panel type identifiers
const PANEL_TYPES = {
  FILE_TREE: 'file-tree',
  ALEXANDRIA_DOCS: 'alexandria-docs',
  ALEXANDRIA_DRAWINGS: 'alexandria-drawings',
  GIT_CHANGES: 'git-changes',
  GIT_HISTORY: 'git-history',
  TERMINAL: 'terminal',
  EDITOR: 'editor',
  MARKDOWN_PREVIEW: 'markdown-preview',
  FILE_PREVIEW: 'file-preview',
} as const;

// Data type identifiers
const DATA_TYPES = {
  FILE_PATH: 'file-path',
  DIRECTORY_PATH: 'directory-path',
  MARKDOWN_DOCUMENT: 'markdown-document',
  EXCALIDRAW_DRAWING: 'excalidraw-drawing',
  GIT_COMMIT: 'git-commit',
  GIT_FILE_CHANGE: 'git-file-change',
  TERMINAL_COMMAND: 'terminal-command',
  CODE_SYMBOL: 'code-symbol',
  TEXT_SELECTION: 'text-selection',
} as const;

// Action identifiers
const DRAG_ACTIONS = {
  VIEW: 'view',              // Open/view the item
  OPEN: 'open',              // Open in editor
  INSERT_PATH: 'insert-path', // Insert file path as text
  INSERT_CONTENT: 'insert-content', // Insert file contents
  REFERENCE: 'reference',    // Create a reference/link
  EXECUTE: 'execute',        // Execute as command
  DIFF: 'diff',              // Show diff
  NAVIGATE: 'navigate',      // Navigate to location
} as const;
```

### Action Semantics by Target Panel

Different panels should interpret actions consistently:

| Target Panel | Action | Behavior |
|--------------|--------|----------|
| **Terminal** | `view` | Execute viewer command (cat, less, etc.) |
| | `insert-path` | Insert file path at cursor |
| | `execute` | Execute as shell command |
| | `insert-content` | Paste file contents |
| **Editor** | `view` | Open file in read-only mode |
| | `open` | Open file for editing |
| | `insert-path` | Insert path as text at cursor |
| | `insert-content` | Insert file contents at cursor |
| | `reference` | Insert as markdown link |
| **Markdown Preview** | `view` | Render the document |
| | `reference` | Scroll to anchor/heading |
| **Git Diff Panel** | `diff` | Show diff for the file |
| **File Preview** | `view` | Preview the file |

### Cross-Panel Drag Matrix

Define which panel types support dragging to which targets:

```tsx
// Example drag compatibility matrix
const DRAG_COMPATIBILITY = {
  [PANEL_TYPES.FILE_TREE]: {
    // File tree can drag to:
    [PANEL_TYPES.TERMINAL]: [DRAG_ACTIONS.INSERT_PATH, DRAG_ACTIONS.VIEW],
    [PANEL_TYPES.EDITOR]: [DRAG_ACTIONS.OPEN, DRAG_ACTIONS.INSERT_PATH],
    [PANEL_TYPES.GIT_CHANGES]: [DRAG_ACTIONS.DIFF],
  },
  [PANEL_TYPES.ALEXANDRIA_DOCS]: {
    // Alexandria docs can drag to:
    [PANEL_TYPES.TERMINAL]: [DRAG_ACTIONS.VIEW, DRAG_ACTIONS.INSERT_PATH],
    [PANEL_TYPES.EDITOR]: [DRAG_ACTIONS.OPEN, DRAG_ACTIONS.REFERENCE],
    [PANEL_TYPES.MARKDOWN_PREVIEW]: [DRAG_ACTIONS.VIEW],
  },
  [PANEL_TYPES.GIT_HISTORY]: {
    // Git history can drag to:
    [PANEL_TYPES.TERMINAL]: [DRAG_ACTIONS.INSERT_CONTENT, DRAG_ACTIONS.EXECUTE],
    [PANEL_TYPES.EDITOR]: [DRAG_ACTIONS.INSERT_CONTENT],
  },
};
```

## Specific Use Cases

### Alexandria Docs → Terminal

**Use Case**: Drag a markdown document from Alexandria panel to terminal to view documentation.

**Alexandria Panel** (source):
```tsx
// In AlexandriaDocItem.tsx
<div
  draggable={true}
  onDragStart={(e) => {
    // Layer 1: Plain text fallback
    e.dataTransfer.setData('text/plain', doc.path);

    // Layer 2: Rich panel data
    const panelData: PanelDragData = {
      sourcePanel: 'alexandria-docs',
      dataType: 'markdown-document',
      primaryData: doc.path,
      metadata: {
        name: doc.name,
        relativePath: doc.relativePath,
        absolutePath: doc.path,
        isTracked: doc.isTracked,
        trackedFiles: doc.files,
        fileType: 'markdown',
      },
      suggestedActions: ['view', 'insert-path', 'reference'],
      version: '1.0',
    };
    e.dataTransfer.setData('application/x-panel-data', JSON.stringify(panelData));

    // Layer 3: Alexandria-specific format
    e.dataTransfer.setData('application/x-alexandria-doc', JSON.stringify({
      path: doc.path,
      name: doc.name,
      relativePath: doc.relativePath,
      isTracked: doc.isTracked,
      files: doc.files,
    }));

    e.dataTransfer.effectAllowed = 'copy';

    // Visual feedback
    e.currentTarget.style.opacity = '0.5';
  }}
  onDragEnd={(e) => {
    e.currentTarget.style.opacity = '1';
  }}
  onClick={() => onSelect(doc.path, 'markdown')}
  // ... rest of props
>
  {/* Document item content */}
</div>
```

**Terminal** (target):
```tsx
// In TerminalPanelPackaged.tsx
const handleTerminalDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // Try rich panel data first
  const panelDataStr = e.dataTransfer.getData('application/x-panel-data');
  if (panelDataStr) {
    try {
      const panelData: PanelDragData = JSON.parse(panelDataStr);

      // Handle based on data type
      if (panelData.dataType === 'markdown-document') {
        // Check suggested actions
        if (panelData.suggestedActions?.includes('view')) {
          // Option 1: Use bat (modern cat with syntax highlighting)
          const command = `bat "${panelData.primaryData}"\n`;

          // Option 2: Use traditional less
          // const command = `less "${panelData.primaryData}"\n`;

          // Option 3: Use mdcat for markdown rendering
          // const command = `mdcat "${panelData.primaryData}"\n`;

          onData?.(command);
          terminal?.focus();
          return;
        }

        if (panelData.suggestedActions?.includes('insert-path')) {
          const path = panelData.primaryData;
          const needsQuotes = path.includes(' ');
          onData?.(needsQuotes ? `"${path}"` : path);
          terminal?.focus();
          return;
        }
      }

      // Generic file path handling
      if (panelData.dataType === 'file-path') {
        const path = panelData.primaryData;
        const needsQuotes = path.includes(' ');
        onData?.(needsQuotes ? `"${path}"` : path);
        terminal?.focus();
        return;
      }
    } catch (err) {
      console.warn('Failed to parse panel data:', err);
      // Fall through to plain text handling
    }
  }

  // Fall back to plain text
  const plainText = e.dataTransfer.getData('text/plain');
  if (plainText && plainText.trim()) {
    const needsQuotes = plainText.includes(' ');
    const textToInsert = needsQuotes ? `"${plainText}"` : plainText;
    onData?.(textToInsert);
    terminal?.focus();
  }
};

// Apply to terminal container
<div
  ref={terminalRef}
  onDragOver={(e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }}
  onDrop={handleTerminalDrop}
>
  {/* Terminal content */}
</div>
```

### Alexandria Docs → Editor

**Use Case**: Drag a document to editor to insert a markdown reference.

**Editor** (target):
```tsx
const handleEditorDrop = (e: React.DragEvent) => {
  e.preventDefault();

  const panelDataStr = e.dataTransfer.getData('application/x-panel-data');
  if (panelDataStr) {
    try {
      const panelData: PanelDragData = JSON.parse(panelDataStr);

      if (panelData.dataType === 'markdown-document') {
        const action = panelData.suggestedActions?.[0];

        if (action === 'reference' && panelData.metadata?.relativePath) {
          // Insert as markdown link
          const linkText = panelData.metadata.name || 'document';
          const linkPath = panelData.metadata.relativePath;
          const markdown = `[${linkText}](${linkPath})`;
          editor.trigger('keyboard', 'type', { text: markdown });
          return;
        }

        if (action === 'open') {
          // Open the file
          openFile(panelData.primaryData);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to parse panel data:', err);
    }
  }

  // Fall back to inserting path as text
  const plainText = e.dataTransfer.getData('text/plain');
  if (plainText) {
    editor.trigger('keyboard', 'type', { text: plainText });
  }
};
```

### File Tree → Terminal

**File Tree** (source):
```tsx
// In DynamicFileTree or FileTreeTab
<div
  draggable={true}
  onDragStart={(e) => {
    const filePath = node.path; // Full absolute path
    e.dataTransfer.setData('text/plain', filePath);
    e.dataTransfer.effectAllowed = 'copy';
  }}
>
  {node.name}
</div>
```

**Terminal** (target):
```tsx
// In TerminalPanelPackaged or terminal component
<div
  ref={terminalRef}
  onDragOver={(e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }}
  onDrop={(e) => {
    e.preventDefault();
    const filePath = e.dataTransfer.getData('text/plain');

    // Auto-quote paths with spaces
    const needsQuotes = filePath.includes(' ');
    const textToInsert = needsQuotes ? `"${filePath}"` : filePath;

    // Send to terminal as if user typed it
    onData?.(textToInsert);

    // Focus terminal after drop
    terminal?.focus();
  }}
>
  {/* Terminal content */}
</div>
```

### Text Selection → Terminal

Works automatically if terminal implements drop handler as shown above.

### File Tree → Editor

Similar pattern - editor accepts drops and opens the file:

```tsx
// In Monaco Editor wrapper
<div
  onDrop={(e) => {
    e.preventDefault();
    const filePath = e.dataTransfer.getData('text/plain');

    // Check if it's a file path
    if (isValidFilePath(filePath)) {
      openFile(filePath);
    } else {
      // Insert as text at cursor
      editor.trigger('keyboard', 'type', { text: filePath });
    }
  }}
>
```

## Visual Feedback Best Practices

### 1. Drag Source Feedback

```tsx
onDragStart={(e) => {
  e.currentTarget.style.opacity = '0.5';
}}
onDragEnd={(e) => {
  e.currentTarget.style.opacity = '1';
}}
```

### 2. Drop Target Feedback

```css
/* Use CSS transitions for smooth feedback */
.drop-target {
  transition: background-color 0.2s, opacity 0.2s;
}

.drop-target:hover {
  background-color: var(--theme-background-tertiary);
}

.drop-target.drag-over {
  background-color: var(--theme-primary);
  opacity: 0.8;
}
```

```tsx
const [isDragOver, setIsDragOver] = useState(false);

return (
  <div
    className={isDragOver ? 'drop-target drag-over' : 'drop-target'}
    onDragEnter={() => setIsDragOver(true)}
    onDragLeave={() => setIsDragOver(false)}
    onDrop={() => setIsDragOver(false)}
  >
    {children}
  </div>
);
```

### 3. Custom Drag Images

For better UX, set custom drag images:

```tsx
onDragStart={(e) => {
  // Create a custom drag preview element
  const dragImage = document.createElement('div');
  dragImage.style.cssText = `
    position: absolute;
    top: -1000px;
    padding: 8px 12px;
    background: var(--theme-primary);
    color: white;
    border-radius: 4px;
    font-size: 12px;
  `;
  dragImage.textContent = fileName;
  document.body.appendChild(dragImage);

  e.dataTransfer.setDragImage(dragImage, 0, 0);

  // Clean up after drag
  setTimeout(() => document.body.removeChild(dragImage), 0);
}}
```

## Edge Cases & Considerations

### 1. Path Handling

Always handle paths with spaces:

```tsx
const sanitizePath = (path: string): string => {
  // Add quotes if path contains spaces
  return path.includes(' ') ? `"${path}"` : path;
};
```

### 2. Relative vs Absolute Paths

For terminals, decide based on context:

```tsx
const getTerminalPath = (absolutePath: string, terminalCwd: string): string => {
  // Try to use relative path if in same directory tree
  if (absolutePath.startsWith(terminalCwd)) {
    return './' + absolutePath.slice(terminalCwd.length + 1);
  }
  return absolutePath;
};
```

### 3. Multi-file Drag

To support dragging multiple files:

```tsx
onDragStart={(e) => {
  // Store multiple paths with newlines
  const paths = selectedFiles.map(f => f.path).join('\n');
  e.dataTransfer.setData('text/plain', paths);
}}

onDrop={(e) => {
  const data = e.dataTransfer.getData('text/plain');
  const paths = data.split('\n').filter(p => p.trim());
  paths.forEach(path => handlePath(path));
}}
```

### 4. File vs Directory Handling

Distinguish between files and directories:

```tsx
onDrop={(e) => {
  const path = e.dataTransfer.getData('text/plain');
  const isDirectory = path.endsWith('/') || !path.includes('.');

  if (isDirectory) {
    // Change directory or list contents
    onData?.(`cd "${path}"\n`);
  } else {
    // Insert path for file operations
    onData?.(sanitizePath(path));
  }
}}
```

### 5. Cross-Window Drag (Future)

For Electron multi-window scenarios:

```tsx
// Use IPC to transfer data between windows
onDrop={(e) => {
  const data = e.dataTransfer.getData('text/plain');

  // Check if data is from another window (custom format)
  const windowData = e.dataTransfer.getData('application/x-electron-window');

  if (windowData) {
    // Handle cross-window drag
    ipcRenderer.invoke('handle-cross-window-drag', JSON.parse(windowData));
  } else {
    // Handle normal drag
    handleDrop(data);
  }
}}
```

## Testing Drag and Drop

### Manual Testing Checklist

- [ ] Drag file from tree to terminal inserts path
- [ ] Paths with spaces are automatically quoted
- [ ] Visual feedback shows when dragging over valid targets
- [ ] Visual feedback clears when drag ends or leaves target
- [ ] Drop inserts at terminal cursor position
- [ ] Terminal focus is restored after drop
- [ ] Selected text can be dragged to terminal
- [ ] Drag works across different panel layouts
- [ ] Invalid drop targets show appropriate feedback

### Automated Testing

```tsx
// Example Jest test for drop handling
describe('Terminal Drop Handler', () => {
  it('should insert dropped path into terminal', () => {
    const mockOnData = jest.fn();
    const { container } = render(
      <TerminalPanelPackaged directory="/test" onData={mockOnData} />
    );

    const terminal = container.querySelector('.terminal-container');

    // Simulate drop event
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      dataTransfer: new DataTransfer(),
    });
    dropEvent.dataTransfer.setData('text/plain', '/path/to/file.ts');

    terminal?.dispatchEvent(dropEvent);

    expect(mockOnData).toHaveBeenCalledWith('/path/to/file.ts');
  });

  it('should quote paths with spaces', () => {
    const mockOnData = jest.fn();
    const { container } = render(
      <TerminalPanelPackaged directory="/test" onData={mockOnData} />
    );

    const terminal = container.querySelector('.terminal-container');
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      dataTransfer: new DataTransfer(),
    });
    dropEvent.dataTransfer.setData('text/plain', '/path with spaces/file.ts');

    terminal?.dispatchEvent(dropEvent);

    expect(mockOnData).toHaveBeenCalledWith('"/path with spaces/file.ts"');
  });
});
```

## Accessibility

### Keyboard Alternatives

Always provide keyboard alternatives for drag-and-drop operations:

```tsx
// Example: Copy path to clipboard as alternative
<button
  onClick={() => {
    navigator.clipboard.writeText(filePath);
    showToast('Path copied to clipboard');
  }}
  title="Copy path (Cmd+C)"
>
  Copy Path
</button>
```

### Screen Reader Support

Add ARIA attributes for screen readers:

```tsx
<div
  draggable={true}
  aria-grabbed="false"
  onDragStart={(e) => {
    e.currentTarget.setAttribute('aria-grabbed', 'true');
  }}
  onDragEnd={(e) => {
    e.currentTarget.setAttribute('aria-grabbed', 'false');
  }}
>
```

## Common Pitfalls

### 1. Forgetting preventDefault()

```tsx
// ❌ WRONG - won't allow drop
onDragOver={(e) => {
  // Missing preventDefault()
}}

// ✅ CORRECT
onDragOver={(e) => {
  e.preventDefault();
}}
```

### 2. Not Stopping Propagation

```tsx
// ❌ WRONG - may trigger parent handlers
onDrop={(e) => {
  e.preventDefault();
  handleDrop();
}}

// ✅ CORRECT
onDrop={(e) => {
  e.preventDefault();
  e.stopPropagation();
  handleDrop();
}}
```

### 3. DragLeave Triggering on Children

```tsx
// ❌ WRONG - fires when entering child elements
onDragLeave={(e) => {
  removeHighlight();
}}

// ✅ CORRECT - check if actually leaving
onDragLeave={(e) => {
  if (e.target === e.currentTarget) {
    removeHighlight();
  }
}}
```

### 4. Not Handling Edge Cases

```tsx
// ❌ WRONG - assumes data is always present
onDrop={(e) => {
  const data = e.dataTransfer.getData('text/plain');
  processData(data); // Could fail if data is empty
}}

// ✅ CORRECT
onDrop={(e) => {
  e.preventDefault();
  const data = e.dataTransfer.getData('text/plain');

  if (!data || !data.trim()) {
    console.warn('No data in drop event');
    return;
  }

  processData(data);
}}
```

## Advanced Patterns

### Modifier Keys for Action Selection

Allow users to choose different actions using modifier keys:

```tsx
onDragOver={(e) => {
  e.preventDefault();

  // Determine action based on modifier keys
  if (e.ctrlKey || e.metaKey) {
    e.dataTransfer.dropEffect = 'copy';  // Insert path
  } else if (e.altKey) {
    e.dataTransfer.dropEffect = 'link';  // Create reference
  } else {
    e.dataTransfer.dropEffect = 'move';  // Default action (view/open)
  }
}}

onDrop={(e) => {
  e.preventDefault();

  const panelDataStr = e.dataTransfer.getData('application/x-panel-data');
  if (!panelDataStr) return;

  const panelData: PanelDragData = JSON.parse(panelDataStr);

  // Select action based on modifiers
  let action: string;
  if (e.ctrlKey || e.metaKey) {
    action = 'insert-path';
  } else if (e.altKey) {
    action = 'reference';
  } else {
    action = panelData.suggestedActions?.[0] || 'view';
  }

  handleActionForDrop(panelData, action);
}}
```

### Multi-Item Drag

Support dragging multiple items at once:

```tsx
// Source: Track selected items
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

onDragStart={(e) => {
  const items = Array.from(selectedItems);

  if (items.length === 0) {
    // No selection, drag single item
    items.push(currentItem.path);
  }

  // Plain text: newline-separated paths
  e.dataTransfer.setData('text/plain', items.join('\n'));

  // Rich data: array of panel data
  const panelData: PanelDragData = {
    sourcePanel: 'file-tree',
    dataType: 'file-path',
    primaryData: items[0], // First item as primary
    metadata: {
      items: items,
      count: items.length,
    },
    suggestedActions: ['insert-path', 'open'],
  };

  e.dataTransfer.setData('application/x-panel-data', JSON.stringify(panelData));
}}

// Target: Handle multiple items
onDrop={(e) => {
  e.preventDefault();

  const panelDataStr = e.dataTransfer.getData('application/x-panel-data');
  if (panelDataStr) {
    const panelData: PanelDragData = JSON.parse(panelDataStr);

    if (panelData.metadata?.items) {
      // Handle multiple items
      const items = panelData.metadata.items as string[];
      items.forEach(item => handleItem(item));
      return;
    }
  }

  // Fall back to plain text (split by newlines)
  const plainText = e.dataTransfer.getData('text/plain');
  if (plainText) {
    const items = plainText.split('\n').filter(s => s.trim());
    items.forEach(item => handleItem(item));
  }
}}
```

### Drag Preview Customization

Create informative drag previews:

```tsx
onDragStart={(e) => {
  // Create preview element
  const preview = document.createElement('div');
  preview.style.cssText = `
    position: absolute;
    top: -1000px;
    left: -1000px;
    padding: 8px 12px;
    background: ${theme.colors.primary};
    color: white;
    border-radius: 6px;
    font-size: 12px;
    font-family: ${theme.fonts.body};
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Add icon
  const icon = document.createElement('span');
  icon.innerHTML = '📄'; // or use lucide-react icon as SVG
  preview.appendChild(icon);

  // Add text
  const text = document.createElement('span');
  if (selectedCount > 1) {
    text.textContent = `${selectedCount} items`;
  } else {
    text.textContent = itemName;
  }
  preview.appendChild(text);

  document.body.appendChild(preview);
  e.dataTransfer.setDragImage(preview, 0, 0);

  // Clean up after drag starts
  setTimeout(() => {
    if (preview.parentNode) {
      document.body.removeChild(preview);
    }
  }, 0);
}}
```

### Context-Aware Drop Zones

Show different drop zones based on drag content:

```tsx
const [dropZone, setDropZone] = useState<'header' | 'content' | 'footer' | null>(null);

const getDragDataType = (e: React.DragEvent): string | null => {
  // Try to peek at data type without consuming it
  const types = Array.from(e.dataTransfer.types);

  if (types.includes('application/x-panel-data')) {
    // We can't read the data in dragover, so use heuristics
    return 'panel-data';
  }

  if (types.includes('text/plain')) {
    return 'text';
  }

  return null;
};

onDragOver={(e) => {
  e.preventDefault();

  const dataType = getDragDataType(e);
  if (!dataType) return;

  // Determine drop zone based on cursor position
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  if (y < height * 0.2) {
    setDropZone('header');
    // Drop in header: add to beginning
  } else if (y > height * 0.8) {
    setDropZone('footer');
    // Drop in footer: add to end
  } else {
    setDropZone('content');
    // Drop in content: insert at position
  }
}}

onDragLeave={(e) => {
  if (e.target === e.currentTarget) {
    setDropZone(null);
  }
}}

onDrop={(e) => {
  e.preventDefault();
  const zone = dropZone;
  setDropZone(null);

  // Handle drop based on zone
  // ...
}}

// Visual feedback
<div style={{
  borderTop: dropZone === 'header' ? `2px solid ${theme.colors.primary}` : 'none',
  borderBottom: dropZone === 'footer' ? `2px solid ${theme.colors.primary}` : 'none',
  background: dropZone === 'content' ? `${theme.colors.primary}10` : 'transparent',
}}>
```

### Git Panels Use Cases

#### Git Changes → Terminal

**Git Changes Panel** (source):
```tsx
<div
  draggable={true}
  onDragStart={(e) => {
    const panelData: PanelDragData = {
      sourcePanel: 'git-changes',
      dataType: 'git-file-change',
      primaryData: file.path,
      metadata: {
        path: file.path,
        status: file.status, // 'modified', 'added', 'deleted', etc.
        staged: file.staged,
      },
      suggestedActions: ['diff', 'insert-path', 'view'],
    };

    e.dataTransfer.setData('text/plain', file.path);
    e.dataTransfer.setData('application/x-panel-data', JSON.stringify(panelData));
  }}
>
  {file.name} ({file.status})
</div>
```

**Terminal** handles git files:
```tsx
if (panelData.dataType === 'git-file-change') {
  const action = panelData.suggestedActions?.[0];

  if (action === 'diff') {
    // Show git diff
    const command = `git diff "${panelData.primaryData}"\n`;
    onData?.(command);
  } else if (action === 'insert-path') {
    const path = panelData.primaryData;
    onData?.(path.includes(' ') ? `"${path}"` : path);
  }
}
```

#### Git History → Terminal

**Git History Panel** (source):
```tsx
<div
  draggable={true}
  onDragStart={(e) => {
    const panelData: PanelDragData = {
      sourcePanel: 'git-history',
      dataType: 'git-commit',
      primaryData: commit.sha,
      metadata: {
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        message: commit.message,
        author: commit.author,
        date: commit.date,
      },
      suggestedActions: ['execute', 'insert-content'],
    };

    e.dataTransfer.setData('text/plain', commit.sha);
    e.dataTransfer.setData('application/x-panel-data', JSON.stringify(panelData));
  }}
>
  {commit.message}
</div>
```

**Terminal** handles git commits:
```tsx
if (panelData.dataType === 'git-commit') {
  const action = e.shiftKey ? 'insert-content' : 'execute';

  if (action === 'execute') {
    // Show commit details
    const command = `git show ${panelData.metadata.shortSha}\n`;
    onData?.(command);
  } else {
    // Insert commit SHA
    onData?.(panelData.metadata.shortSha);
  }
}
```

### Drawing Panels Use Cases

#### Alexandria Drawings → Editor

**Alexandria Drawings Panel** (source):
```tsx
<div
  draggable={true}
  onDragStart={(e) => {
    const panelData: PanelDragData = {
      sourcePanel: 'alexandria-drawings',
      dataType: 'excalidraw-drawing',
      primaryData: drawing.path,
      metadata: {
        name: drawing.name,
        relativePath: drawing.relativePath,
        absolutePath: drawing.path,
        fileType: 'excalidraw',
      },
      suggestedActions: ['reference', 'open', 'insert-path'],
    };

    e.dataTransfer.setData('text/plain', drawing.path);
    e.dataTransfer.setData('application/x-panel-data', JSON.stringify(panelData));
  }}
>
  {drawing.name}
</div>
```

**Editor** creates drawing references:
```tsx
if (panelData.dataType === 'excalidraw-drawing') {
  const action = panelData.suggestedActions?.[0];

  if (action === 'reference' && panelData.metadata?.relativePath) {
    // Insert as markdown image reference
    const name = panelData.metadata.name || 'drawing';
    const path = panelData.metadata.relativePath;
    // Excalidraw files can be exported to PNG/SVG
    const pngPath = path.replace('.excalidraw', '.png');
    const markdown = `![${name}](${pngPath})`;
    editor.trigger('keyboard', 'type', { text: markdown });
  }
}
```

## Library Implementation Guide

### For Panel Framework Developers

If you're building a panel framework library, consider these architectural patterns:

#### 1. Provide Base Drag-Drop Hooks

```tsx
// useDraggable.ts
export interface DraggableConfig {
  dataType: string;
  primaryData: string;
  metadata?: Record<string, any>;
  suggestedActions?: string[];
  sourcePanel?: string;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export const useDraggable = (config: DraggableConfig) => {
  const handleDragStart = (e: React.DragEvent) => {
    // Set plain text fallback
    e.dataTransfer.setData('text/plain', config.primaryData);

    // Set rich panel data
    const panelData: PanelDragData = {
      sourcePanel: config.sourcePanel || 'unknown',
      dataType: config.dataType,
      primaryData: config.primaryData,
      metadata: config.metadata,
      suggestedActions: config.suggestedActions,
      version: '1.0',
    };

    e.dataTransfer.setData('application/x-panel-data', JSON.stringify(panelData));
    e.dataTransfer.effectAllowed = 'copy';

    // Visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }

    config.onDragStart?.(e);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }

    config.onDragEnd?.(e);
  };

  return {
    draggable: true,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  };
};

// Usage
const MyListItem = ({ item }) => {
  const dragProps = useDraggable({
    dataType: 'file-path',
    primaryData: item.path,
    metadata: { name: item.name },
    suggestedActions: ['open', 'insert-path'],
    sourcePanel: 'file-tree',
  });

  return <div {...dragProps}>{item.name}</div>;
};
```

#### 2. Provide Drop Zone Hooks

```tsx
// useDropZone.ts
export interface DropHandler {
  dataType: string | string[];
  onDrop: (data: PanelDragData, event: React.DragEvent) => void;
}

export interface DropZoneConfig {
  handlers: DropHandler[];
  onPlainTextDrop?: (text: string, event: React.DragEvent) => void;
  showVisualFeedback?: boolean;
}

export const useDropZone = (config: DropZoneConfig) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (config.showVisualFeedback) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.target === e.currentTarget) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Try rich panel data first
    const panelDataStr = e.dataTransfer.getData('application/x-panel-data');
    if (panelDataStr) {
      try {
        const panelData: PanelDragData = JSON.parse(panelDataStr);

        // Find matching handler
        for (const handler of config.handlers) {
          const types = Array.isArray(handler.dataType)
            ? handler.dataType
            : [handler.dataType];

          if (types.includes(panelData.dataType)) {
            handler.onDrop(panelData, e);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to parse panel data:', err);
      }
    }

    // Fall back to plain text
    const plainText = e.dataTransfer.getData('text/plain');
    if (plainText && config.onPlainTextDrop) {
      config.onPlainTextDrop(plainText, e);
    }
  };

  return {
    onDragOver: handleDragOver,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    isDragOver,
  };
};

// Usage
const MyDropTarget = () => {
  const dropZone = useDropZone({
    handlers: [
      {
        dataType: 'file-path',
        onDrop: (data) => console.log('File dropped:', data.primaryData),
      },
      {
        dataType: ['markdown-document', 'text-selection'],
        onDrop: (data) => console.log('Text dropped:', data.primaryData),
      },
    ],
    onPlainTextDrop: (text) => console.log('Plain text:', text),
    showVisualFeedback: true,
  });

  return (
    <div
      {...dropZone}
      style={{
        opacity: dropZone.isDragOver ? 0.8 : 1,
        background: dropZone.isDragOver ? '#f0f0f0' : 'transparent',
      }}
    >
      Drop here
    </div>
  );
};
```

#### 3. Export Type Definitions

```tsx
// types/drag-drop.ts
export interface PanelDragData {
  sourcePanel: string;
  dataType: string;
  primaryData: string;
  metadata?: Record<string, any>;
  suggestedActions?: string[];
  version?: string;
}

export const PANEL_TYPES = {
  FILE_TREE: 'file-tree',
  ALEXANDRIA_DOCS: 'alexandria-docs',
  ALEXANDRIA_DRAWINGS: 'alexandria-drawings',
  GIT_CHANGES: 'git-changes',
  GIT_HISTORY: 'git-history',
  TERMINAL: 'terminal',
  EDITOR: 'editor',
  MARKDOWN_PREVIEW: 'markdown-preview',
  FILE_PREVIEW: 'file-preview',
} as const;

export const DATA_TYPES = {
  FILE_PATH: 'file-path',
  DIRECTORY_PATH: 'directory-path',
  MARKDOWN_DOCUMENT: 'markdown-document',
  EXCALIDRAW_DRAWING: 'excalidraw-drawing',
  GIT_COMMIT: 'git-commit',
  GIT_FILE_CHANGE: 'git-file-change',
  TERMINAL_COMMAND: 'terminal-command',
  CODE_SYMBOL: 'code-symbol',
  TEXT_SELECTION: 'text-selection',
} as const;

export const DRAG_ACTIONS = {
  VIEW: 'view',
  OPEN: 'open',
  INSERT_PATH: 'insert-path',
  INSERT_CONTENT: 'insert-content',
  REFERENCE: 'reference',
  EXECUTE: 'execute',
  DIFF: 'diff',
  NAVIGATE: 'navigate',
} as const;

export type PanelType = typeof PANEL_TYPES[keyof typeof PANEL_TYPES];
export type DataType = typeof DATA_TYPES[keyof typeof DATA_TYPES];
export type DragAction = typeof DRAG_ACTIONS[keyof typeof DRAG_ACTIONS];
```

#### 4. Provide Utility Functions

```tsx
// utils/drag-drop.ts
export const sanitizePath = (path: string): string => {
  return path.includes(' ') ? `"${path}"` : path;
};

export const parsePanelData = (e: React.DragEvent): PanelDragData | null => {
  const dataStr = e.dataTransfer.getData('application/x-panel-data');
  if (!dataStr) return null;

  try {
    return JSON.parse(dataStr);
  } catch (err) {
    console.warn('Failed to parse panel data:', err);
    return null;
  }
};

export const createDragPreview = (
  content: string,
  theme: any
): HTMLDivElement => {
  const preview = document.createElement('div');
  preview.style.cssText = `
    position: absolute;
    top: -1000px;
    padding: 8px 12px;
    background: ${theme.colors.primary};
    color: white;
    border-radius: 6px;
    font-size: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  preview.textContent = content;
  return preview;
};
```

#### 5. Panel Configuration

Allow panels to declare their drag-drop capabilities:

```tsx
// Panel configuration schema
export interface PanelConfig {
  id: string;
  name: string;
  // Drag capabilities
  draggable?: {
    enabled: boolean;
    dataTypes: DataType[];
    defaultActions: DragAction[];
  };
  // Drop capabilities
  droppable?: {
    enabled: boolean;
    accepts: Array<{
      dataType: DataType;
      actions: DragAction[];
      handler: (data: PanelDragData) => void;
    }>;
  };
}

// Example configuration
const fileTreeConfig: PanelConfig = {
  id: 'file-tree',
  name: 'File Tree',
  draggable: {
    enabled: true,
    dataTypes: ['file-path', 'directory-path'],
    defaultActions: ['open', 'insert-path'],
  },
  droppable: {
    enabled: true,
    accepts: [
      {
        dataType: 'file-path',
        actions: ['open', 'view'],
        handler: (data) => openFile(data.primaryData),
      },
    ],
  },
};
```

## Future Enhancements

### Potential Improvements

1. **Rich Data Types**: Support multiple MIME types for richer interactions
   ```tsx
   e.dataTransfer.setData('text/plain', path);
   e.dataTransfer.setData('application/x-electron-file', JSON.stringify(fileMetadata));
   ```

2. **Drag Effects**: Use different effects for different operations
   ```tsx
   onDragOver={(e) => {
     if (e.ctrlKey) {
       e.dataTransfer.dropEffect = 'copy';
     } else {
       e.dataTransfer.dropEffect = 'move';
     }
   }}
   ```

3. **Visual Drag Previews**: Create custom drag preview components
4. **Multi-target Highlighting**: Show all valid drop targets when dragging
5. **Undo Support**: Allow undoing drops in editors

## Related Dependencies

This feature depends on:
- `@principal-ade/industry-theme` - For terminal component (needs drag support)
- `@a24z/dynamic-file-tree` - For file tree component (needs drag support)

See dependency tasks:
- **Task**: Add drag support to industry-themed-terminal
- **Task**: Add drag support to dynamic-file-tree

## Implementation Checklist

### For Panel Developers

When adding drag-drop to a new panel:

**Making a Panel Draggable:**
- [ ] Identify draggable items (files, docs, commits, etc.)
- [ ] Choose appropriate `dataType` from standard types
- [ ] Set `draggable={true}` on draggable elements
- [ ] Implement `onDragStart` handler
  - [ ] Set `text/plain` with primary data
  - [ ] Set `application/x-panel-data` with full `PanelDragData`
  - [ ] Define `suggestedActions` in priority order
  - [ ] Add visual feedback (opacity, drag image)
- [ ] Implement `onDragEnd` to restore visual state
- [ ] Test with multiple target panels

**Making a Panel Accept Drops:**
- [ ] Identify what data types panel should accept
- [ ] Define action handlers for each data type
- [ ] Implement `onDragOver` handler with `preventDefault()`
- [ ] Implement `onDragEnter` for visual feedback
- [ ] Implement `onDragLeave` to clear feedback
- [ ] Implement `onDrop` handler
  - [ ] Try `application/x-panel-data` first
  - [ ] Route by `dataType`
  - [ ] Check `suggestedActions` for behavior
  - [ ] Fall back to `text/plain`
  - [ ] Handle errors gracefully
- [ ] Test with multiple source panels
- [ ] Add keyboard alternatives (copy/paste, shortcuts)

### For Library Developers

When building a panel framework library:

**Phase 1: Core Infrastructure**
- [ ] Define `PanelDragData` interface
- [ ] Define standard `PANEL_TYPES`, `DATA_TYPES`, `DRAG_ACTIONS`
- [ ] Create `useDraggable` hook
- [ ] Create `useDropZone` hook
- [ ] Add utility functions (`sanitizePath`, `parsePanelData`, etc.)
- [ ] Write comprehensive TypeScript types

**Phase 2: Developer Experience**
- [ ] Create drag preview utilities
- [ ] Add visual feedback helpers
- [ ] Provide declarative panel configuration
- [ ] Build drag compatibility matrix
- [ ] Add debugging tools (log data transfer)

**Phase 3: Advanced Features**
- [ ] Multi-item drag support
- [ ] Modifier key handling
- [ ] Context-aware drop zones
- [ ] Cross-window drag (Electron)
- [ ] Drag validation and permissions

**Phase 4: Documentation & Testing**
- [ ] Document all data types and actions
- [ ] Provide example implementations
- [ ] Create integration tests
- [ ] Add accessibility features (keyboard alternatives, ARIA)
- [ ] Write migration guide from custom implementations

## Migration Guide

### From Custom Drag-Drop to Standard Protocol

**Step 1: Audit Current Implementation**

Identify all places where drag-drop is currently implemented:
```bash
# Search for drag event handlers
grep -r "onDragStart" src/
grep -r "onDrop" src/
grep -r "draggable=" src/
```

**Step 2: Map to Standard Data Types**

For each draggable item, identify the appropriate standard data type:
- File paths → `file-path`
- Directories → `directory-path`
- Markdown docs → `markdown-document`
- Git commits → `git-commit`
- etc.

**Step 3: Update Drag Sources**

Replace custom `onDragStart` with standard protocol:

```tsx
// Before (custom)
onDragStart={(e) => {
  e.dataTransfer.setData('text/plain', item.path);
}}

// After (standard protocol)
onDragStart={(e) => {
  e.dataTransfer.setData('text/plain', item.path);

  const panelData: PanelDragData = {
    sourcePanel: 'file-tree',
    dataType: 'file-path',
    primaryData: item.path,
    metadata: { name: item.name },
    suggestedActions: ['open', 'insert-path'],
  };

  e.dataTransfer.setData('application/x-panel-data', JSON.stringify(panelData));
}}
```

**Step 4: Update Drop Targets**

Replace custom drop handlers with protocol-aware handlers:

```tsx
// Before (custom)
onDrop={(e) => {
  e.preventDefault();
  const path = e.dataTransfer.getData('text/plain');
  handleFilePath(path);
}}

// After (standard protocol)
onDrop={(e) => {
  e.preventDefault();

  // Try rich data first
  const panelDataStr = e.dataTransfer.getData('application/x-panel-data');
  if (panelDataStr) {
    const panelData: PanelDragData = JSON.parse(panelDataStr);
    handlePanelDrop(panelData);
    return;
  }

  // Fall back to plain text
  const plainText = e.dataTransfer.getData('text/plain');
  if (plainText) {
    handlePlainTextDrop(plainText);
  }
}}
```

**Step 5: Test Compatibility**

- [ ] Test drag from old implementation to new
- [ ] Test drag from new implementation to old
- [ ] Verify text fallback works
- [ ] Test with external applications (text editors, file managers)

**Step 6: Gradual Rollout**

1. Update one panel type at a time (start with file tree)
2. Ensure backward compatibility during transition
3. Monitor for issues
4. Update dependent panels
5. Remove custom implementations when all panels migrated

## Real-World Examples

### Example 1: Electron IDE Panel System

```tsx
// Panel registry with drag-drop capabilities
const panelRegistry = {
  'file-tree': {
    draggable: {
      dataTypes: ['file-path', 'directory-path'],
      actions: ['open', 'insert-path', 'view'],
    },
    droppable: {
      accepts: ['file-path', 'directory-path'],
      handlers: {
        'file-path': (data) => openInFileTree(data.primaryData),
      },
    },
  },
  'terminal': {
    droppable: {
      accepts: ['file-path', 'markdown-document', 'git-commit', 'terminal-command'],
      handlers: {
        'file-path': (data) => insertPath(data.primaryData),
        'markdown-document': (data) => viewDoc(data.primaryData),
        'git-commit': (data) => showCommit(data.metadata.sha),
      },
    },
  },
};
```

### Example 2: Documentation Browser

```tsx
// Drag documentation to create references
const DocsBrowser = () => {
  const dragProps = useDraggable({
    dataType: 'markdown-document',
    primaryData: doc.url,
    metadata: {
      title: doc.title,
      section: doc.section,
      anchor: doc.anchor,
    },
    suggestedActions: ['reference', 'view', 'insert-path'],
  });

  return <div {...dragProps}>{doc.title}</div>;
};
```

### Example 3: Code Symbol Browser

```tsx
// Drag code symbols to navigate or insert references
const SymbolItem = ({ symbol }) => {
  const dragProps = useDraggable({
    dataType: 'code-symbol',
    primaryData: symbol.name,
    metadata: {
      filePath: symbol.filePath,
      lineNumber: symbol.lineNumber,
      kind: symbol.kind, // 'function', 'class', 'variable'
      namespace: symbol.namespace,
    },
    suggestedActions: ['navigate', 'reference', 'insert-content'],
  });

  return <div {...dragProps}>{symbol.name}</div>;
};
```

## Troubleshooting

### Common Issues

**Issue: Drop not working**
- Check that `e.preventDefault()` is called in `onDragOver`
- Verify `dataTransfer.dropEffect` is set
- Ensure drop handler doesn't have errors (check console)

**Issue: Data not transferred**
- Verify data is set in `onDragStart`, not `onClick`
- Check MIME type spelling (`application/x-panel-data`)
- Ensure JSON.stringify doesn't throw (circular references)

**Issue: Visual feedback not showing**
- Check `onDragEnter`/`onDragLeave` are implemented
- Verify state updates are triggering re-renders
- Check CSS/inline styles are being applied

**Issue: Wrong action executed**
- Review `suggestedActions` priority order
- Check if target is reading correct action
- Verify modifier key handling logic

**Issue: Cross-window drag fails**
- Electron requires special handling for cross-window
- Use IPC to transfer complex data between windows
- Consider using simplified format for cross-window

### Debugging Tips

```tsx
// Log all available data types
onDrop={(e) => {
  console.log('Available types:', e.dataTransfer.types);
  console.log('Text data:', e.dataTransfer.getData('text/plain'));
  console.log('Panel data:', e.dataTransfer.getData('application/x-panel-data'));
}}

// Validate panel data structure
const validatePanelData = (data: any): data is PanelDragData => {
  return (
    typeof data.sourcePanel === 'string' &&
    typeof data.dataType === 'string' &&
    typeof data.primaryData === 'string'
  );
};

// Use during development
onDrop={(e) => {
  const panelDataStr = e.dataTransfer.getData('application/x-panel-data');
  if (panelDataStr) {
    const data = JSON.parse(panelDataStr);
    if (!validatePanelData(data)) {
      console.error('Invalid panel data structure:', data);
      return;
    }
  }
}}
```

## Resources

- [MDN: HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [MDN: DataTransfer](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer)
- [Electron: Drag and Drop](https://www.electronjs.org/docs/latest/tutorial/native-drag-drop)
- [React DnD (alternative library approach)](https://react-dnd.github.io/react-dnd/)
- [ARIA Authoring Practices: Drag and Drop](https://www.w3.org/WAI/ARIA/apg/patterns/)
