# Storybook Sidecar Window Implementation

## Overview
This document outlines the implementation of a Storybook sidecar window that can be controlled from a terminal window. The Storybook window will load the dev server URL directly (Option A) and be manageable via IPC channels.

## Architecture

### Window Relationship
```
┌─────────────────┐         IPC Channels        ┌──────────────────┐
│ Terminal Window │ ◄──────────────────────────► │ Storybook Window │
│   (Controller)  │                              │    (Sidecar)     │
└─────────────────┘                              └──────────────────┘
        │                                                 │
        └── Sends Commands ──────────────────────────────┘
            (start, stop, restart, focus)        Loads: http://localhost:6006
```

## IPC Channel Definitions

### Main Process Channels

#### 1. Storybook Window Management
```typescript
// Channel: 'storybook:create'
interface CreateStorybookWindow {
  terminalSessionId: string;  // Associate with terminal session
  storybookUrl?: string;       // Default: http://localhost:6006
  windowOptions?: {
    width?: number;            // Default: 1200
    height?: number;           // Default: 800
    x?: number;                // Position relative to terminal
    y?: number;
  };
}
// Returns: { windowId: number, sessionId: string }

// Channel: 'storybook:destroy'
interface DestroyStorybookWindow {
  sessionId: string;
}
// Returns: { success: boolean }

// Channel: 'storybook:focus'
interface FocusStorybookWindow {
  sessionId: string;
}
// Returns: { success: boolean }
```

#### 2. Storybook Server Control
```typescript
// Channel: 'storybook:server:start'
interface StartStorybookServer {
  projectPath: string;
  port?: number;              // Default: 6006
  buildFirst?: boolean;       // Run build-storybook first
}
// Returns: { pid: number, url: string }

// Channel: 'storybook:server:stop'
interface StopStorybookServer {
  sessionId: string;
}
// Returns: { success: boolean }

// Channel: 'storybook:server:restart'
interface RestartStorybookServer {
  sessionId: string;
  newPort?: number;           // Optional port change
}
// Returns: { pid: number, url: string }

// Channel: 'storybook:server:status'
interface GetStorybookServerStatus {
  sessionId: string;
}
// Returns: { running: boolean, pid?: number, url?: string, port?: number }
```

#### 3. Window State Synchronization
```typescript
// Channel: 'storybook:reload'
interface ReloadStorybookWindow {
  sessionId: string;
  clearCache?: boolean;
}
// Returns: void

// Channel: 'storybook:navigate'
interface NavigateStorybookWindow {
  sessionId: string;
  path: string;               // e.g., "/?path=/story/button--primary"
}
// Returns: void

// Channel: 'storybook:devtools'
interface ToggleStorybookDevTools {
  sessionId: string;
}
// Returns: void
```

### Renderer Process Events (Terminal → Main)

```typescript
// Terminal window sends these commands
terminalAPI.storybookControl = {
  // Create/destroy window
  open: (options?: CreateStorybookWindow) =>
    ipcRenderer.invoke('storybook:create', options),

  close: (sessionId: string) =>
    ipcRenderer.invoke('storybook:destroy', { sessionId }),

  focus: (sessionId: string) =>
    ipcRenderer.invoke('storybook:focus', { sessionId }),

  // Server control
  startServer: (projectPath: string, port?: number) =>
    ipcRenderer.invoke('storybook:server:start', { projectPath, port }),

  stopServer: (sessionId: string) =>
    ipcRenderer.invoke('storybook:server:stop', { sessionId }),

  restartServer: (sessionId: string) =>
    ipcRenderer.invoke('storybook:server:restart', { sessionId }),

  getStatus: (sessionId: string) =>
    ipcRenderer.invoke('storybook:server:status', { sessionId }),

  // Window control
  reload: (sessionId: string) =>
    ipcRenderer.invoke('storybook:reload', { sessionId }),

  navigate: (sessionId: string, path: string) =>
    ipcRenderer.invoke('storybook:navigate', { sessionId, path }),
};
```

### Event Notifications (Main → Renderer)

```typescript
// Events sent to terminal window
interface StorybookEvents {
  'storybook:window:created': { sessionId: string, windowId: number };
  'storybook:window:closed': { sessionId: string };
  'storybook:window:focused': { sessionId: string };
  'storybook:server:started': { sessionId: string, url: string, pid: number };
  'storybook:server:stopped': { sessionId: string };
  'storybook:server:error': { sessionId: string, error: string };
  'storybook:navigation': { sessionId: string, url: string };
}

// Terminal window listens for events
ipcRenderer.on('storybook:server:error', (event, data) => {
  console.error(`Storybook server error: ${data.error}`);
});
```

## Implementation Components

### 1. StorybookWindowManager (Main Process)
```typescript
class StorybookWindowManager {
  private windows: Map<string, BrowserWindow>;
  private servers: Map<string, ChildProcess>;
  private terminals: Map<string, string>; // sessionId -> terminalId

  async createWindow(options: CreateStorybookWindow): Promise<WindowInfo> {
    // 1. Create BrowserWindow with Storybook-specific settings
    // 2. Associate with terminal session
    // 3. Load Storybook URL
    // 4. Return window info
  }

  async startServer(projectPath: string, port: number): Promise<ServerInfo> {
    // 1. Check if server already running on port
    // 2. Execute 'npm run storybook' or 'yarn storybook'
    // 3. Wait for server ready
    // 4. Return server info
  }

  async restartServer(sessionId: string): Promise<void> {
    // 1. Stop existing server
    // 2. Start new server
    // 3. Reload associated window
  }
}
```

### 2. Terminal UI Components (Renderer Process)

```typescript
// Terminal window toolbar additions
interface StorybookControls {
  isStorybookOpen: boolean;
  storybookSessionId?: string;
  serverStatus: 'stopped' | 'starting' | 'running' | 'error';

  onOpenStorybook: () => void;
  onCloseStorybook: () => void;
  onRestartServer: () => void;
  onFocusStorybook: () => void;
}

// React component in terminal window
const StorybookToolbar = () => {
  const [status, setStatus] = useState<ServerStatus>('stopped');
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <div className="storybook-controls">
      <button onClick={handleOpen} disabled={sessionId !== null}>
        Open Storybook
      </button>
      <button onClick={handleRestart} disabled={!sessionId}>
        Restart Server
      </button>
      <button onClick={handleFocus} disabled={!sessionId}>
        Focus Window
      </button>
      <button onClick={handleClose} disabled={!sessionId}>
        Close Storybook
      </button>
      <span className={`status-${status}`}>{status}</span>
    </div>
  );
};
```

## Window Configuration

### Storybook Window Settings
```typescript
const STORYBOOK_WINDOW_CONFIG: BrowserWindowConstructorOptions = {
  width: 1200,
  height: 800,
  title: 'Storybook',
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    // Allow loading localhost URLs
    webviewTag: false,
    allowRunningInsecureContent: false,
  },
  // Visual settings
  backgroundColor: '#1EA7FD',
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 10, y: 10 },
  vibrancy: 'under-window',
};
```

## Error Handling

### Common Scenarios
1. **Port Already in Use**
   - Detect port conflict
   - Suggest alternative port
   - Allow user to kill existing process

2. **Storybook Not Installed**
   - Check package.json for storybook deps
   - Provide installation instructions
   - Offer to install automatically

3. **Build Errors**
   - Capture build output
   - Display in terminal window
   - Provide fix suggestions

4. **Window Closed Unexpectedly**
   - Notify terminal window
   - Clean up server process
   - Update UI state

## Security Considerations

1. **URL Validation**
   - Only allow localhost URLs
   - Validate port numbers
   - Prevent navigation to external sites

2. **Process Isolation**
   - Run Storybook server as child process
   - Limit permissions
   - Clean up on exit

3. **IPC Security**
   - Validate all IPC payloads
   - Use contextBridge for renderer access
   - Limit exposed APIs

## Future Enhancements

### Phase 2: Window Association
- Physical window snapping/docking
- Synchronized scrolling
- Shared clipboard

### Phase 3: Advanced Integration
- Story hot-reload from editor
- Component inspection tools
- Test runner integration
- Coverage overlay

## Testing Strategy

### Unit Tests
- IPC channel handlers
- Window creation logic
- Server management

### Integration Tests
- End-to-end window lifecycle
- Server start/stop/restart
- Error recovery scenarios

### Manual Testing Checklist
- [ ] Open Storybook window from terminal
- [ ] Restart server while window open
- [ ] Focus window from terminal
- [ ] Close window and verify cleanup
- [ ] Handle server errors gracefully
- [ ] Validate all IPC channels