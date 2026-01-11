# Panel Modal Implementation Skill

Implement event-driven modal overlays for panels in the Electron app harness without modifying the panel code.

## When to Use This Skill

Use this skill when:
- User wants a panel displayed as a modal overlay
- User wants to trigger panel display from clicks/selections
- User needs modal-based panel interactions
- User asks to "show X as a modal" or "open Y in a popup"

## What This Skill Does

This skill helps implement the panel modal pattern by:
1. Adding modal state to the harness
2. Setting up event listeners for trigger and close events
3. Re-emitting events to the panel inside the modal
4. Rendering modal UI with backdrop and styling
5. Ensuring proper event flow and cleanup

## Implementation Steps

### Step 1: Identify Events

First, identify the events that will trigger and close the modal:

```typescript
// Example:
// Trigger event: 'task:selected' (when user clicks a task)
// Close event: 'task:deselected' (when user clicks X button)
```

**Questions to ask:**
- What event opens the modal?
- What data does the panel need?
- What event closes the modal?
- Does the panel already emit these events?

### Step 2: Add Modal State

In `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` (or equivalent harness component), add modal state:

```typescript
// Add modal state (inside DevWorkspacePanelFrameworkInner)
const [yourModal, setYourModal] = useState<{
  isOpen: boolean;
  data: YourDataType;
} | null>(null);
```

**Template:**
```typescript
const [___Modal, set___Modal] = useState<{
  isOpen: boolean;
  data: ___Type;
} | null>(null);
```

### Step 3: Listen for Trigger Event

Add event listener that opens the modal:

```typescript
// Listen for event to show modal
useEffect(() => {
  const unsubscribe = events.on('your:trigger-event', (event) => {
    console.log('[Harness] Received trigger event:', event);
    const payload = event.payload as YourPayloadType;
    setYourModal({
      isOpen: true,
      data: payload,
    });
  });

  return unsubscribe;
}, [events]);
```

**Template:**
```typescript
useEffect(() => {
  const unsubscribe = events.on('___:trigger-event', (event) => {
    console.log('[Harness] Received ___:trigger-event:', event);
    const payload = event.payload as ___PayloadType;
    set___Modal({
      isOpen: true,
      data: payload,
    });
  });

  return unsubscribe;
}, [events]);
```

### Step 4: Re-emit Event to Panel

The panel instance in the modal needs to receive the event:

```typescript
// Re-emit event when modal opens so panel can receive it
useEffect(() => {
  if (yourModal?.isOpen && yourModal?.data) {
    // Use setTimeout to ensure panel component is mounted first
    setTimeout(() => {
      events.emit({
        type: 'your:trigger-event',
        source: 'modal',
        timestamp: Date.now(),
        payload: yourModal.data,
      });
    }, 0);
  }
}, [yourModal?.isOpen, yourModal?.data, events]);
```

**Why this is needed:** The panel listens for the trigger event to populate its internal state. When we render a fresh panel instance in the modal, it needs to receive the event again.

**Template:**
```typescript
useEffect(() => {
  if (___Modal?.isOpen && ___Modal?.data) {
    setTimeout(() => {
      events.emit({
        type: '___:trigger-event',
        source: 'modal',
        timestamp: Date.now(),
        payload: ___Modal.data,
      });
    }, 0);
  }
}, [___Modal?.isOpen, ___Modal?.data, events]);
```

### Step 5: Listen for Close Event

Add event listener that closes the modal:

```typescript
// Listen for close event to close the modal
useEffect(() => {
  const unsubscribe = events.on('your:close-event', () => {
    console.log('[Harness] Closing modal');
    setYourModal(null);
  });

  return unsubscribe;
}, [events]);
```

**Template:**
```typescript
useEffect(() => {
  const unsubscribe = events.on('___:close-event', () => {
    console.log('[Harness] Closing ___ modal');
    set___Modal(null);
  });

  return unsubscribe;
}, [events]);
```

### Step 6: Render Modal JSX

Add modal UI to the harness component's render (at the end, before closing `</div>`):

```typescript
{/* Your Panel Modal */}
{yourModal?.isOpen && YourPanelComponent && (
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
    onClick={() => setYourModal(null)} // Click backdrop to close
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
      onClick={(e) => e.stopPropagation()} // Prevent close on content click
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

**Template:**
```typescript
{/* ___ Modal */}
{___Modal?.isOpen && ___PanelComponent && (
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
    onClick={() => set___Modal(null)}
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
        <___PanelComponent
          context={context}
          actions={actions}
          events={events}
        />
      </div>
    </div>
  </div>
)}
```

## Complete Code Template

Copy this entire template and replace `___` placeholders:

```typescript
// ============================================
// MODAL IMPLEMENTATION
// Replace all ___ with your feature name
// ============================================

// 1. Add modal state (inside DevWorkspacePanelFrameworkInner)
const [___Modal, set___Modal] = useState<{
  isOpen: boolean;
  data: ___Type;
} | null>(null);

// 2. Listen for trigger event
useEffect(() => {
  const unsubscribe = events.on('___:trigger-event', (event) => {
    console.log('[Harness] Received ___:trigger-event:', event);
    const payload = event.payload as ___PayloadType;
    set___Modal({
      isOpen: true,
      data: payload,
    });
  });

  return unsubscribe;
}, [events]);

// 3. Re-emit event to panel
useEffect(() => {
  if (___Modal?.isOpen && ___Modal?.data) {
    setTimeout(() => {
      events.emit({
        type: '___:trigger-event',
        source: 'modal',
        timestamp: Date.now(),
        payload: ___Modal.data,
      });
    }, 0);
  }
}, [___Modal?.isOpen, ___Modal?.data, events]);

// 4. Listen for close event
useEffect(() => {
  const unsubscribe = events.on('___:close-event', () => {
    console.log('[Harness] Closing ___ modal');
    set___Modal(null);
  });

  return unsubscribe;
}, [events]);

// 5. Render modal (add before closing </div> in component return)
{___Modal?.isOpen && ___PanelComponent && (
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
    onClick={() => set___Modal(null)}
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
        <___PanelComponent
          context={context}
          actions={actions}
          events={events}
        />
      </div>
    </div>
  </div>
)}
```

## Real-World Example: Task Detail Modal

**File:** `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`

**Events:**
- Trigger: `task:selected` (emitted by Kanban panel when task clicked)
- Close: `task:deselected` (emitted by TaskDetailPanel's X button)

**Implementation:**

```typescript
// 1. Modal state (line 161-165)
const [taskDetailModal, setTaskDetailModal] = useState<{
  isOpen: boolean;
  task: any;
} | null>(null);

// 2. Listen for task:selected (line 312-324)
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

// 3. Re-emit event (line 326-342)
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

// 4. Listen for close event (line 344-352)
useEffect(() => {
  const unsubscribe = events.on('task:deselected', () => {
    console.log('[DevWorkspacePanelFramework] Task deselected, closing modal');
    setTaskDetailModal(null);
  });

  return unsubscribe;
}, [events]);

// 5. Modal UI (line 1048-1087)
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
```

## Panel Requirements

For a panel to work with this pattern, it must:

### 1. Listen for Events

The panel should listen for the trigger event and update its state:

```typescript
// In your panel component
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
```

### 2. Emit Close Events

The panel should emit an event when it wants to close:

```typescript
// In your panel's close handler
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

### 3. Render Close Button

The panel should render its own close button (X):

```typescript
<button onClick={handleClose} title="Close">
  <X size={16} />
</button>
```

## Troubleshooting

### Issue: Panel shows "No Item Selected"

**Cause:** Panel instance in modal doesn't have data.

**Solution:** Ensure Step 4 (re-emit event) is implemented correctly:
```typescript
useEffect(() => {
  if (modalState?.isOpen && modalState?.data) {
    setTimeout(() => {
      events.emit({ /* ... */ });
    }, 0);
  }
}, [modalState?.isOpen, modalState?.data, events]);
```

### Issue: X button doesn't close modal

**Cause:** Missing close event listener.

**Solution:** Ensure Step 5 (listen for close event) is implemented:
```typescript
useEffect(() => {
  const unsubscribe = events.on('item:deselected', () => {
    setModalState(null);
  });
  return unsubscribe;
}, [events]);
```

### Issue: Modal closes when clicking content

**Cause:** Missing `stopPropagation` on modal content.

**Solution:** Add to modal content div:
```typescript
onClick={(e) => e.stopPropagation()}
```

### Issue: Multiple modals open at once

**Cause:** Not closing existing modals before opening new ones.

**Solution:** Close all modals in trigger handler:
```typescript
events.on('item:selected', (event) => {
  setTaskModal(null);
  setOtherModal(null);
  setItemModal({ isOpen: true, data: event.payload });
});
```

## Best Practices

### Do's ✅

1. **Use semantic event names**: `task:selected`, `skill:opened`
2. **Include source in events**: Helps debugging
3. **Provide backdrop click-to-close**: Better UX
4. **Use setTimeout(0) for re-emission**: Ensures panel is mounted
5. **Clean up listeners**: Always return unsubscribe
6. **Use theme colors**: Maintain consistency
7. **Set z-index 9999**: Modal above other content
8. **Let panel provide close button**: Don't duplicate UI

### Don'ts ❌

1. **Don't modify panel code**: Keep panels unaware of modals
2. **Don't hardcode event names**: Use constants/types
3. **Don't skip re-emission**: Panel needs the event
4. **Don't forget stopPropagation**: Content clicks would close modal
5. **Don't create duplicate close buttons**: Use panel's button

## Event Flow Diagram

```
User clicks task in Kanban
    ↓
Kanban emits 'task:selected'
    ↓
Harness receives event (Step 3)
    ↓
Harness opens modal (Step 2)
    ↓
Harness re-emits 'task:selected' (Step 4)
    ↓
TaskDetailPanel receives event
    ↓
Panel displays task details
    ↓
User clicks X button in panel
    ↓
Panel emits 'task:deselected'
    ↓
Harness receives event (Step 5)
    ↓
Harness closes modal
```

## Testing Checklist

After implementation, verify:

- [ ] Modal opens when trigger event fires
- [ ] Panel displays correct data in modal
- [ ] Panel's X button closes modal
- [ ] Clicking backdrop closes modal
- [ ] Clicking modal content doesn't close modal
- [ ] Multiple rapid clicks don't open multiple modals
- [ ] Console shows correct event flow
- [ ] Modal appears above all other content
- [ ] Modal styling matches theme

## Common Patterns

### Pattern: Click to Open Modal

Most common pattern - click an item to view details:

```typescript
// Kanban panel emits on click
onClick={() => {
  events.emit({
    type: 'task:selected',
    payload: { task, taskId: task.id }
  });
}}
```

### Pattern: Keyboard Shortcut to Open

Open modal via keyboard:

```typescript
// Listen for keyboard event
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && selectedItem) {
      events.emit({
        type: 'item:selected',
        payload: { item: selectedItem }
      });
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [selectedItem, events]);
```

### Pattern: Auto-close on Action

Close modal after successful action:

```typescript
// In panel after action completes
await performAction();
events.emit({
  type: 'item:deselected',
  payload: {}
});
```

## Files to Modify

Typically you'll modify:

1. **DevWorkspacePanelFramework.tsx**
   - Add modal state
   - Add event listeners
   - Add modal JSX

2. **(Optional) Panel component**
   - Only if panel doesn't already emit events
   - Add event emission on close

## Architecture Principles

This pattern follows:

- **Event-Driven Architecture**: All communication via events
- **Separation of Concerns**: Harness handles UI, panel handles content
- **Reusability**: Same panel works in layout slots or modals
- **Loose Coupling**: Panels don't know about modals

## References

- **Live Example**: `DevWorkspacePanelFramework.tsx` lines 161-352, 1048-1087
- **Panel Architecture**: `docs/panel-architecture.md`
- **Event System**: `@principal-ade/panel-framework-core`
