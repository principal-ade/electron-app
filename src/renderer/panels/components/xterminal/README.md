# XTerminalPanel

A pure UI component for rendering an xterm.js terminal, extracted from the original `TerminalPanel` for better testability and separation of concerns.

## Purpose

This component decouples the **terminal UI** from **business logic** (IPC, session management, ownership, etc.), making it:

- ✅ Testable in Storybook
- ✅ Easier to debug UI issues
- ✅ Reusable across different contexts
- ✅ Independent of Electron services

## Architecture

```
XTerminalPanel (Pure UI)
  ├── xterm.js rendering
  ├── FitAddon & WebLinksAddon
  ├── Theming
  ├── Resize handling
  └── Event callbacks (onData, onResize, etc.)

TerminalPanel (Business Logic - to be created)
  ├── TerminalService IPC
  ├── AgentSessionService integration
  ├── Session lifecycle management
  └── Window ownership logic
```

## Usage

### Basic Example

```tsx
import { useRef, useEffect } from 'react';
import { XTerminalPanel } from './components/xterminal';
import type { XTerminalPanelRef } from './components/xterminal';

function MyTerminal() {
  const terminalRef = useRef<XTerminalPanelRef>(null);

  useEffect(() => {
    // Write initial content
    terminalRef.current?.write('Welcome to the terminal!\r\n$ ');
  }, []);

  const handleData = (data: string) => {
    // Send data to backend/PTY
    console.log('User typed:', data);

    // Echo back to terminal
    terminalRef.current?.write(data);
  };

  return (
    <XTerminalPanel
      ref={terminalRef}
      headerTitle="My Terminal"
      headerSubtitle="/home/user/project"
      onData={handleData}
      onResize={(cols, rows) => {
        // Notify backend of resize
        console.log('Resized to:', cols, rows);
      }}
      onLinkClick={(url, isLocalhost) => {
        // Handle link clicks
        if (isLocalhost) {
          // Open in dev sidecar
        } else {
          // Open in external browser
        }
      }}
    />
  );
}
```

### With Overlay State

```tsx
<XTerminalPanel
  headerTitle="Terminal"
  overlayState={{
    type: 'owned',
    message: 'This terminal is active in another window',
    subtitle: 'Window ID: 42',
    actions: [
      {
        label: 'Switch to Window',
        onClick: () => focusOwnerWindow(),
        primary: true,
      },
      {
        label: 'Take Control',
        onClick: () => claimOwnership(),
        primary: false,
      },
    ],
  }}
/>
```

## Props

See [`types.ts`](./types.ts) for complete prop definitions.

### Key Props

- **onData**: Callback when user types (send to PTY)
- **onResize**: Callback when terminal resizes (update PTY dimensions)
- **onLinkClick**: Callback when user clicks a link
- **overlayState**: Show overlay messages (ownership, loading, errors)
- **headerBadge**: Display badge in header (e.g., AI session)

## Ref Methods

```tsx
interface XTerminalPanelRef {
  write: (data: string) => void;      // Write data to terminal
  scrollToBottom: () => void;          // Scroll to bottom
  focus: () => void;                   // Focus terminal
  clear: () => void;                   // Clear screen
  getTerminal: () => Terminal | null; // Get xterm instance
  fit: () => void;                     // Resize to fit container
}
```

## Testing in Storybook

### Setup Storybook (if not already installed)

```bash
npx storybook@latest init
```

### Run Storybook

```bash
npm run storybook
```

The component comes with comprehensive stories in [`XTerminalPanel.stories.tsx`](./XTerminalPanel.stories.tsx):

- **Basic**: Simple terminal with welcome message
- **WithOutput**: Simulated build output
- **ColoredOutput**: ANSI color codes
- **Interactive**: Full interactive terminal with commands
- **OwnershipOverlay**: Shows ownership message
- **WithLinks**: Clickable links demo
- And more...

## Next Steps

### 1. Create Integration Wrapper (Optional)

Create a new `TerminalPanel` that wraps `XTerminalPanel` and handles:

```tsx
// src/renderer/panels/TerminalPanelV2.tsx
import { useRef, useEffect } from 'react';
import { XTerminalPanel } from './components/xterminal';
import { useTerminalSession } from './hooks/useTerminalSession';
import { useTerminalOwnership } from './hooks/useTerminalOwnership';
import { useTerminalData } from './hooks/useTerminalData';

export function TerminalPanelV2({ directory, agentSessionId, ... }) {
  const terminalRef = useRef<XTerminalPanelRef>(null);

  // Custom hooks handle business logic
  const { sessionId } = useTerminalSession(directory, agentSessionId);
  const { overlayState, onTakeControl } = useTerminalOwnership(sessionId);
  const { onData, onResize } = useTerminalData(sessionId, terminalRef);

  return (
    <XTerminalPanel
      ref={terminalRef}
      onData={onData}
      onResize={onResize}
      overlayState={overlayState}
      // ... other props
    />
  );
}
```

### 2. Migrate Existing TerminalPanel

Once `XTerminalPanel` is tested and stable, you can:

1. Rename current `TerminalPanel.tsx` to `TerminalPanelLegacy.tsx`
2. Create new `TerminalPanel.tsx` that uses `XTerminalPanel`
3. Gradually migrate usage points
4. Delete legacy version

## What Issues Were You Seeing?

The pure UI component should help isolate:

- **Rendering issues**: Test in Storybook without IPC
- **Resize problems**: Verify FitAddon behavior
- **Theming bugs**: Test different theme configurations
- **Scroll position**: Test with different data patterns
- **Performance**: Isolate xterm.js performance from IPC overhead

## Files in this Directory

```
xterminal/
├── XTerminalPanel.tsx          # Pure UI component
├── XTerminalPanel.stories.tsx  # Storybook stories
├── types.ts                     # TypeScript types
├── index.ts                     # Public exports
└── README.md                    # This file
```

## Dependencies

- `@xterm/xterm` - Terminal emulator
- `@xterm/addon-fit` - Auto-fit addon
- `@xterm/addon-web-links` - Clickable links
- `@a24z/industry-theme` - Theming
- `lucide-react` - Icons
- `react` - UI framework
