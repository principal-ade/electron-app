# Drag and Drop Integration Guide

## Overview

This guide explains how to implement drag-and-drop functionality across panels in the electron-app. The key concept is using the HTML5 Drag and Drop API with `dataTransfer` to pass text/data between components.

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

## Specific Use Cases

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
// In XTerminalPanel
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
      <XTerminalPanel onData={mockOnData} />
    );

    const terminal = container.querySelector('.terminal-container-fix');

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
      <XTerminalPanel onData={mockOnData} />
    );

    const terminal = container.querySelector('.terminal-container-fix');
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
- `@a24z/industry-theme` - For terminal component (needs drag support)
- `@a24z/dynamic-file-tree` - For file tree component (needs drag support)

See dependency tasks:
- **Task**: Add drag support to industry-themed-terminal
- **Task**: Add drag support to dynamic-file-tree

## Resources

- [MDN: HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [MDN: DataTransfer](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer)
- [Electron: Drag and Drop](https://www.electronjs.org/docs/latest/tutorial/native-drag-drop)
