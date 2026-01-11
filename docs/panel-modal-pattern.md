# Panel Modal Pattern

## Overview

This document describes the event-driven pattern for displaying panels as modals in the Electron app harness. This pattern allows any panel to be displayed in a modal overlay without modifying the panel itself, maintaining clean separation of concerns.

## When to Use This Pattern

Use this pattern when you want to:
- Display a panel in a modal overlay instead of in a fixed layout slot
- Trigger panel display from user interactions (clicks, selections, etc.)
- Maintain panel reusability (same panel works in layout slots OR modals)
- Leverage existing event-driven architecture
- Avoid coupling panels to specific UI patterns

## Architecture

### Event Flow

```
User Action (e.g., click task)
    ↓
Panel emits event (e.g., 'task:selected')
    ↓
Harness listens for event
    ↓
Harness opens modal with selected panel
    ↓
Harness re-emits event to panel instance in modal
    ↓
Panel receives event and displays content
    ↓
Panel emits close event (e.g., 'task:deselected')
    ↓
Harness closes modal
```

### Key Principles

1. **Event-Driven**: All communication happens through the event bus
2. **Panel-Agnostic**: Panels don't know if they're in a modal or layout slot
3. **Harness-Controlled**: Modal state and lifecycle managed at harness level
4. **Reusable**: Same panel component works in both contexts

## Implementation Guide

### Step 1: Add Modal State

In `DevWorkspacePanelFrameworkInner` (or equivalent harness component):

```typescript
// Add modal state
const [panelModal, setPanelModal] = useState<{
  isOpen: boolean;
  data: any; // The data to pass to the panel
} | null>(null);
```

### Step 2: Listen for Trigger Event

Add event listener for the event that should open the modal:

```typescript
// Listen for event to show modal
useEffect(() => {
  const unsubscribe = events.on('your:trigger-event', (event) => {
    console.log('[Harness] Received trigger event:', event);
    const payload = event.payload as { /* your payload type */ };
    setPanelModal({
      isOpen: true,
      data: payload,
    });
  });

  return unsubscribe;
}, [events]);
```

### Step 3: Re-emit Event for Panel

The panel instance in the modal needs to receive the event to populate its state:

```typescript
// Re-emit event when modal opens so panel can receive it
useEffect(() => {
  if (panelModal?.isOpen && panelModal?.data) {
    // Use setTimeout to ensure panel component is mounted first
    setTimeout(() => {
      events.emit({
        type: 'your:trigger-event',
        source: 'modal',
        timestamp: Date.now(),
        payload: panelModal.data,
      });
    }, 0);
  }
}, [panelModal?.isOpen, panelModal?.data, events]);
```

### Step 4: Listen for Close Event

Listen for the event that should close the modal (usually from panel's close button):

```typescript
// Listen for close event to close the modal
useEffect(() => {
  const unsubscribe = events.on('your:close-event', () => {
    console.log('[Harness] Closing modal');
    setPanelModal(null);
  });

  return unsubscribe;
}, [events]);
```

### Step 5: Render Modal JSX

Add the modal UI to the harness component's render:

```typescript
{/* Panel Modal */}
{panelModal?.isOpen && YourPanelComponent && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}
    onClick={() => setPanelModal(null)} // Click backdrop to close
  >
    <div
      style={{
        backgroundColor: theme.colors.background,
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '1200px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      onClick={(e) => e.stopPropagation()} // Prevent backdrop click from closing
    >
      {/* Render Panel (panel should have its own close button) */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <YourPanelComponent
          context={context}
          actions={actions}
          events={events}
        />
      </div>
    </div>
  </div>
)}
```

## Complete Example: Task Detail Modal

### Context
Display the TaskDetailPanel in a modal when a task is clicked in the Kanban board.

### Events Used
- **Trigger**: `task:selected` - Emitted by Kanban panel when task clicked
- **Close**: `task:deselected` - Emitted by TaskDetailPanel's X button

### Implementation

**File**: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`

```typescript
// 1. Add modal state
const [taskDetailModal, setTaskDetailModal] = useState<{
  isOpen: boolean;
  task: any;
} | null>(null);

// 2. Listen for task:selected events to show modal
useEffect(() => {
  const unsubscribe = events.on('task:selected', (event) => {
    console.log('[DevWorkspacePanelFramework] Received task:selected event:', event);
    const payload = event.payload as { task: any; taskId: string };
    setTaskDetailModal({
      isOpen: true,
      task: payload.task,
    });
  });

  return unsubscribe;
}, [events]);

// 3. Re-emit task:selected event when modal opens
useEffect(() => {
  if (taskDetailModal?.isOpen && taskDetailModal?.task) {
    setTimeout(() => {
      events.emit({
        type: 'task:selected',
        source: 'modal',
        timestamp: Date.now(),
        payload: {
          task: taskDetailModal.task,
          taskId: taskDetailModal.task.id,
        },
      });
    }, 0);
  }
}, [taskDetailModal?.isOpen, taskDetailModal?.task, events]);

// 4. Listen for task:deselected event to close modal
useEffect(() => {
  const unsubscribe = events.on('task:deselected', () => {
    console.log('[DevWorkspacePanelFramework] Task deselected, closing modal');
    setTaskDetailModal(null);
  });

  return unsubscribe;
}, [events]);

// 5. Render modal in component return
return (
  <div style={{ /* ... */ }}>
    {/* Existing harness content */}
    <EditableConfigurablePanelLayout /* ... */ />

    {/* Task Detail Modal */}
    {taskDetailModal?.isOpen && TaskDetailPanelComponent && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
        onClick={() => setTaskDetailModal(null)}
      >
        <div
          style={{
            backgroundColor: theme.colors.background,
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '1200px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ flex: 1, overflow: 'auto' }}>
            <TaskDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        </div>
      </div>
    )}
  </div>
);
```

## Panel Requirements

For a panel to work with this pattern, it must:

1. **Listen for events**: Panel should listen for the trigger event and update its state
2. **Emit close events**: Panel should emit an event when it wants to close (e.g., X button click)
3. **Be self-contained**: Panel should render all its UI including close button

### Example Panel Event Handling

```typescript
// In your panel component

// Listen for selection event
useEffect(() => {
  const handleItemSelected = (event: { payload: YourPayload }) => {
    setSelectedItem(event.payload.item);
  };

  const unsubscribe = events.on('item:selected', handleItemSelected);
  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
}, [events]);

// Emit close event when X button clicked
const handleClose = () => {
  setSelectedItem(null);

  if (events) {
    events.emit({
      type: 'item:deselected',
      source: 'your-panel',
      timestamp: Date.now(),
      payload: {},
    });
  }
};
```

## Best Practices

### Do's ✅

- **Use semantic event names**: `task:selected`, `skill:opened`, etc.
- **Include source in events**: Helps with debugging event flow
- **Provide backdrop click-to-close**: Improves UX
- **Use setTimeout(0) for re-emission**: Ensures panel is mounted first
- **Clean up event listeners**: Always return unsubscribe functions
- **Use theme colors**: Maintain consistent styling
- **Set appropriate z-index**: Modal should be above other content (9999 is standard)

### Don'ts ❌

- **Don't duplicate close buttons**: Let panel provide its own UI
- **Don't modify panel code**: Keep panels unaware of modal context
- **Don't hardcode event names**: Use constants or types
- **Don't forget stopPropagation**: Prevent modal close on content click
- **Don't skip re-emission**: Panel won't have data without it

## Styling Guidelines

### Modal Container

```typescript
{
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)', // Semi-transparent backdrop
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999, // Above all other content
}
```

### Modal Content

```typescript
{
  backgroundColor: theme.colors.background,
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  maxWidth: '1200px', // Adjust based on content
  width: '90%',
  maxHeight: '90vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
}
```

## Troubleshooting

### Panel shows "No Item Selected"

**Problem**: Panel renders in modal but shows empty state.

**Solution**: Ensure you're re-emitting the event after modal opens:

```typescript
useEffect(() => {
  if (modalState?.isOpen && modalState?.data) {
    setTimeout(() => {
      events.emit({ /* ... */ });
    }, 0);
  }
}, [modalState?.isOpen, modalState?.data, events]);
```

### Modal doesn't close when X clicked

**Problem**: Panel's X button doesn't close modal.

**Solution**: Add event listener for the close event:

```typescript
useEffect(() => {
  const unsubscribe = events.on('item:deselected', () => {
    setModalState(null);
  });
  return unsubscribe;
}, [events]);
```

### Multiple modals open at once

**Problem**: Multiple modals stack on top of each other.

**Solution**: Close existing modals before opening new ones:

```typescript
events.on('item:selected', (event) => {
  // Close any existing modals first
  setTaskDetailModal(null);
  setOtherModal(null);

  // Then open the new modal
  setItemModal({ isOpen: true, data: event.payload });
});
```

## Related Documentation

- [Panel Architecture](./panel-architecture.md)
- [Panel Implementation Guide](./panel-implementation-guide.md)
- [Panel Extension System](./panel-extension-system.md)

## Version History

- **v1.0.0** (2026-01-10): Initial pattern documentation
  - Task Detail Modal example
  - Complete implementation guide
  - Best practices and troubleshooting
