# Terminal Activity Tracking Architecture

## Overview

This architecture enables tracking of terminal/agent working state across all windows in the Electron application. When an agent is working (blinds shown), the state is stored in main process and broadcast to all windows.

## Problem Statement

The terminal panel shows a "working overlay" (blinds) when an agent is busy. Currently this state is local to the renderer - other windows have no visibility into which terminals are active. We need to:

1. Track working state centrally in main process
2. Broadcast state changes to all windows
3. Enable UI indicators across the app (badges, activity lists, etc.)

## Architecture Decision

**Approach: Bubble Up Events from Terminal Panel**

Rather than intercepting at the host level, we emit events from the terminal panel when working state changes. This is cleaner because:

- Terminal panel owns the state transition (with animations)
- Accurate timing (after animation starts/completes)
- Follows existing `events.emit()` pattern
- Keeps concerns separated

## Data Flow

```
Terminal Panel (isWorking changes)
         │
         ▼
    events.emit('terminal:activity-change')
         │
         ▼
Dev Workspace (Panel Host receives event)
         │
         ▼
    terminalClient.updateActivity()  ← TIPC Client
         │
         ▼
Main Process (terminalRouter.updateActivity)  ← TIPC Router
         │
         ▼
TerminalActivityStore.update()
         │
         ▼
BrowserWindow.getAllWindows().forEach(broadcast)
         │
         ▼
All Windows receive 'terminal:activity-sync'
```

## State Shape

```typescript
// src/shared/tipc/terminalRouterTypes.ts

interface TerminalActivityState {
  sessionId: string;
  isWorking: boolean;
  workingMessage?: string;
  workingSubtitle?: string;
  windowId: number;
  timestamp: number;
}
```

## Implementation Steps

### 1. Terminal Panel Changes

Add event emission in `TabbedTerminalPanel.tsx` or `ThemedTerminal.tsx`:

```typescript
useEffect(() => {
  events.emit<TerminalActivityChangeEvent>({
    type: 'terminal:activity-change',
    source: 'TabbedTerminalPanel',
    timestamp: Date.now(),
    payload: {
      sessionId,
      isWorking,
      workingMessage,
      workingSubtitle,
    },
  });
}, [isWorking, sessionId]);
```

### 2. Shared Types (src/shared/tipc/terminalRouterTypes.ts)

```typescript
export interface UpdateActivityInput {
  sessionId: string;
  isWorking: boolean;
  workingMessage?: string;
  workingSubtitle?: string;
}

export interface TerminalActivityState extends UpdateActivityInput {
  windowId: number;
  timestamp: number;
}
```

### 3. TIPC Router (src/main/terminal/tipc/terminalRouter.ts)

```typescript
import { tipc } from '@egoist/tipc/main';
import { BrowserWindow } from 'electron';

const t = tipc.create();

// Activity store (could be extracted to separate module)
const activityStore = new Map<string, TerminalActivityState>();

export const terminalRouter = {
  // ... existing procedures ...

  updateActivity: t.procedure
    .input<UpdateActivityInput>()
    .action(async ({ input, context }) => {
      const window = BrowserWindow.fromWebContents(context.sender);
      if (!window) return;

      const state: TerminalActivityState = {
        ...input,
        windowId: window.id,
        timestamp: Date.now(),
      };

      if (input.isWorking) {
        activityStore.set(input.sessionId, state);
      } else {
        activityStore.delete(input.sessionId);
      }

      // Broadcast to all windows
      const data = Array.from(activityStore.values());
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('terminal:activity-sync', data);
      });
    }),

  getActivityState: t.procedure.action(async () => {
    return Array.from(activityStore.values());
  }),
};
```

### 4. TIPC Client (src/renderer/tipc/terminalClient.ts)

```typescript
export interface TerminalClient {
  // ... existing methods ...
  updateActivity: (input: UpdateActivityInput) => Promise<void>;
  getActivityState: () => Promise<TerminalActivityState[]>;
}
```

### 5. Dev Workspace Integration

```typescript
// In panel host event handler
events.on('terminal:activity-change', async (event) => {
  await terminalClient.updateActivity({
    sessionId: event.payload.sessionId,
    isWorking: event.payload.isWorking,
    workingMessage: event.payload.workingMessage,
    workingSubtitle: event.payload.workingSubtitle,
  });
});
```

## Use Cases

- **Window title badges**: Show indicator when agent is working
- **Activity overview**: Panel showing all active terminals
- **Prevent close**: Warn before closing window with active agent
- **Taskbar integration**: Show progress/activity in OS taskbar

## Related Files

**Terminal Panel (external package):**
- `packages/industry-themed-xterm-terminal-panel/src/components/WorkingOverlay.tsx`
- `packages/industry-themed-xterm-terminal-panel/src/components/ThemedTerminal.tsx`
- `packages/industry-themed-xterm-terminal-panel/src/panels/TabbedTerminalPanel.tsx`

**Electron App (TIPC):**
- `src/main/terminal/tipc/terminalRouter.ts` - Add updateActivity procedure
- `src/renderer/tipc/terminalClient.ts` - Add client method
- `src/shared/tipc/terminalRouterTypes.ts` - Add shared types
