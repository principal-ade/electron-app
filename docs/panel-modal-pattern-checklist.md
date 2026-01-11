# Panel Modal Pattern - Quick Reference Checklist

Quick checklist for implementing the panel modal pattern. See [panel-modal-pattern.md](./panel-modal-pattern.md) for full documentation.

## Implementation Checklist

### 1. Define Events

- [ ] **Trigger Event**: What event opens the modal? (e.g., `task:selected`, `skill:opened`)
- [ ] **Close Event**: What event closes the modal? (e.g., `task:deselected`, `skill:closed`)
- [ ] **Payload Type**: What data does the panel need?

```typescript
// Example event types
type TriggerEvent = {
  type: 'item:selected';
  payload: {
    item: YourItemType;
    itemId: string;
  };
};

type CloseEvent = {
  type: 'item:deselected';
  payload: {};
};
```

### 2. Add Modal State

```typescript
// In DevWorkspacePanelFrameworkInner (or harness component)
const [yourModal, setYourModal] = useState<{
  isOpen: boolean;
  data: YourDataType;
} | null>(null);
```

### 3. Listen for Trigger Event

```typescript
useEffect(() => {
  const unsubscribe = events.on('your:trigger-event', (event) => {
    const payload = event.payload as YourPayloadType;
    setYourModal({
      isOpen: true,
      data: payload,
    });
  });

  return unsubscribe;
}, [events]);
```

### 4. Re-emit Event to Panel

```typescript
useEffect(() => {
  if (yourModal?.isOpen && yourModal?.data) {
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

### 5. Listen for Close Event

```typescript
useEffect(() => {
  const unsubscribe = events.on('your:close-event', () => {
    setYourModal(null);
  });

  return unsubscribe;
}, [events]);
```

### 6. Render Modal JSX

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
    onClick={() => setYourModal(null)}
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

## Panel Requirements Checklist

Your panel must:

- [ ] Listen for the trigger event
- [ ] Update state when event received
- [ ] Render close button (X)
- [ ] Emit close event when X clicked
- [ ] Handle empty state gracefully

## Testing Checklist

- [ ] Modal opens when trigger event fires
- [ ] Panel displays correct data in modal
- [ ] Panel's X button closes modal
- [ ] Clicking backdrop closes modal
- [ ] Modal content doesn't close on content click
- [ ] Multiple rapid clicks don't open multiple modals
- [ ] Console shows correct event flow

## Common Issues

| Issue | Solution |
|-------|----------|
| Panel shows "No Item Selected" | Add event re-emission (Step 4) |
| X button doesn't close modal | Add close event listener (Step 5) |
| Modal closes when clicking content | Add `onClick={(e) => e.stopPropagation()}` to content div |
| Multiple modals open | Close existing modals before opening new ones |

## Code Template

Copy this template to get started quickly:

```typescript
// ============================================
// MODAL IMPLEMENTATION TEMPLATE
// ============================================

// 1. Add modal state
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

// 5. Render modal (add to component return)
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

## Search & Replace

To use the template:

1. Replace `___` with your feature name (e.g., `task`, `skill`, `user`)
2. Replace `___Type` with your data type
3. Replace `___PayloadType` with your payload type
4. Replace `___PanelComponent` with your panel component name
5. Update event names to match your use case

## Examples

- **Task Detail**: See `DevWorkspacePanelFramework.tsx` lines 161-352, 1048-1087
- **Event Names**: `task:selected`, `task:deselected`
- **Panel**: TaskDetailPanel from `@industry-theme/backlogmd-kanban-panel`
