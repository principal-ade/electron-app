# Dev Sidecar Window Implementation

## Overview
This document outlines the implementation of the Dev Sidecar window that can be controlled from a terminal window. The Dev Sidecar window loads a local development server URL directly (Option A) and is manageable via IPC channels.

### Expanded Use Cases
- **Reusable dev server runner** – The sidecar shell is reusable for other framework dev servers (e.g., `npm run dev` for Next.js or Vite) by parameterizing the command, port selection, and ready-state detection logic instead of hard-coding framework-specific defaults.
- **Integrated log surface** – Similar to the remote agent title bar affordance, the sidecar requires a title bar button that reveals an inline log viewer so developers can inspect process output without leaving the window.

All flow diagrams and IPC contracts in this document are expressed in framework-neutral terms and accept a generic "dev server descriptor" object that supplies the command, arguments, environment variables, working directory, and heuristics for determining when the server is ready.

## Architecture

### Window Relationship
```
┌─────────────────┐         IPC Channels        ┌──────────────────┐
│ Terminal Window │ ◄──────────────────────────► │ Dev Sidecar      │
│   (Controller)  │                              │    (Window)      │
└─────────────────┘                              └──────────────────┘
        │                                                 │
        └── Sends Commands ──────────────────────────────┘
            (start, stop, restart, focus,
             status, toggleLogs)                Loads: http://localhost:6006
```

The sidecar window continues to use a `BrowserView` for presenting the dev server UI. To support the title bar log toggle:

1. Mount a dedicated `BrowserView` (`devServerView`) that points to the external dev server URL.
2. Create a second `BrowserView` (`logsView`) that loads a local log template (e.g., `app://sidecar/logs.html`). The template renders live stdout/stderr output streamed over IPC from the managed process.
3. The window controller listens for the title bar "Logs" button click and swaps the attached view between `devServerView` and `logsView` using `window.setBrowserView(...)`.
4. Maintain each view's bounds so the transition is instantaneous and preserves the sizing constraints imposed by the custom title bar.

This approach preserves BrowserView isolation while giving the sidecar the same log-surface ergonomics as the remote agent windows.

## IPC Channel Definitions

### Main Process Channels

#### 1. Dev Sidecar Window Management
```typescript
// Channel: 'dev-sidecar:create'
interface CreateDevSidecarWindow {
  terminalSessionId: string;  // Associate with terminal session
  devServerUrl?: string;       // Default: http://localhost:6006
  windowOptions?: {
    width?: number;            // Default: 1200
    height?: number;           // Default: 800
    x?: number;                // Position relative to terminal
    y?: number;
  };
}
// Returns: { windowId: number, sessionId: string }

// Channel: 'dev-sidecar:destroy'
interface DestroyDevSidecarWindow {
  sessionId: string;
}
// Returns: { success: boolean }

// Channel: 'dev-sidecar:focus'
interface FocusDevSidecarWindow {
  sessionId: string;
}
// Returns: { success: boolean }
```

#### 2. Dev Server Control
```typescript
// Channel: 'dev-sidecar:server:start'
interface StartDevSidecarServer {
  projectPath: string;
  port?: number;              // Default: 6006
  buildFirst?: boolean;       // Run the optional build command first
  command?: string;           // Override default (e.g., `npm run dev`)
  args?: string[];            // Additional CLI args (e.g., ['--turbo'])
  env?: Record<string, string>;
  readyPattern?: string;      // Regex to detect readiness in stdout
}
// Returns: { pid: number, url: string }

// Channel: 'dev-sidecar:server:stop'
interface StopDevSidecarServer {
  sessionId: string;
}
// Returns: { success: boolean }

// Channel: 'dev-sidecar:server:restart'
interface RestartDevSidecarServer {
  sessionId: string;
  newPort?: number;           // Optional port change
}
// Returns: { pid: number, url: string }

// Channel: 'dev-sidecar:server:status'
interface GetDevSidecarServerStatus {
  sessionId: string;
}
// Returns: { running: boolean, pid?: number, url?: string, port?: number }
```

#### 3. Window State Synchronization
```typescript
// Channel: 'dev-sidecar:reload'
interface ReloadDevSidecarWindow {
  sessionId: string;
  clearCache?: boolean;
}
// Returns: void

// Channel: 'dev-sidecar:navigate'
interface NavigateDevSidecarWindow {
  sessionId: string;
  path: string;               // e.g., "/?path=/story/button--primary"
}
// Returns: void

// Channel: 'dev-sidecar:devtools'
interface ToggleDevSidecarDevTools {
  sessionId: string;
}
// Returns: void

// Channel: 'dev-sidecar:toggle-logs'
interface ToggleDevSidecarLogs {
  sessionId: string;
}
// Returns: { visible: boolean }
```

### Renderer Process Events (Terminal → Main)

```typescript
// Terminal window sends these commands
terminalAPI.devSidecarControl = {
  // Create/destroy window
  open: (options?: CreateDevSidecarWindow) =>
    ipcRenderer.invoke('dev-sidecar:create', options),

  close: (sessionId: string) =>
    ipcRenderer.invoke('dev-sidecar:destroy', { sessionId }),

  focus: (sessionId: string) =>
    ipcRenderer.invoke('dev-sidecar:focus', { sessionId }),

  // Server control
  startServer: (
    projectPath: string,
    options?: { port?: number; buildFirst?: boolean; command?: string; args?: string[]; env?: Record<string, string>; readyPattern?: string }
  ) =>
    ipcRenderer.invoke('dev-sidecar:server:start', { projectPath, ...options }),

  stopServer: (sessionId: string) =>
    ipcRenderer.invoke('dev-sidecar:server:stop', { sessionId }),

  restartServer: (sessionId: string) =>
    ipcRenderer.invoke('dev-sidecar:server:restart', { sessionId }),

  getStatus: (sessionId: string) =>
    ipcRenderer.invoke('dev-sidecar:server:status', { sessionId }),

  // Window control
  reload: (sessionId: string) =>
    ipcRenderer.invoke('dev-sidecar:reload', { sessionId }),

  navigate: (sessionId: string, path: string) =>
    ipcRenderer.invoke('dev-sidecar:navigate', { sessionId, path }),

  toggleLogs: (sessionId: string) =>
    ipcRenderer.invoke('dev-sidecar:toggle-logs', { sessionId }),
};
```

### Event Notifications (Main → Renderer)

```typescript
// Events sent to terminal window
interface DevSidecarEvents {
  'dev-sidecar:window:created': { sessionId: string, windowId: number };
  'dev-sidecar:window:closed': { sessionId: string };
  'dev-sidecar:window:focused': { sessionId: string };
  'dev-sidecar:server:started': { sessionId: string, url: string, pid: number };
  'dev-sidecar:server:stopped': { sessionId: string };
  'dev-sidecar:server:error': { sessionId: string, error: string };
  'dev-sidecar:navigation': { sessionId: string, url: string };
  'dev-sidecar:logs:toggled': { sessionId: string, visible: boolean };
}

// Terminal window listens for events
ipcRenderer.on('dev-sidecar:server:error', (event, data) => {
  console.error(`Dev server error: ${data.error}`);
});

ipcRenderer.on('dev-sidecar:logs:toggled', (event, data) => {
  updateLogsVisibility(data.sessionId, data.visible);
});
```

## Implementation Components

### 1. DevSidecarWindowManager (Main Process)
```typescript
class DevSidecarWindowManager {
  private windows: Map<string, BrowserWindow>;
  private servers: Map<string, ChildProcess>;
  private terminals: Map<string, string>; // sessionId -> terminalId

  async createWindow(options: CreateDevSidecarWindow): Promise<WindowInfo> {
    // 1. Create BrowserWindow with dev-sidecar-specific settings
    // 2. Instantiate devServerView + logsView BrowserViews
    // 3. Associate with terminal session
    // 4. Load the dev server URL in devServerView, preload logs template in logsView
    // 5. Return window info
  }

  async startServer(projectPath: string, port: number): Promise<ServerInfo> {
    // 1. Check if server already running on port
    // 2. Execute provided command (default: 'npm run dev')
    // 3. Wait for server ready
    // 4. Return server info
  }

  async restartServer(sessionId: string): Promise<void> {
    // 1. Stop existing server
    // 2. Start new server
    // 3. Reload associated window
  }

  async toggleLogs(sessionId: string): Promise<boolean> {
    // 1. Swap active BrowserView between devServerView and logsView
    // 2. Emit 'dev-sidecar:logs:toggled' event with new visibility
    // 3. Return current visibility state
  }
}
```

### 2. Terminal UI Components (Renderer Process)

```typescript
// Terminal window toolbar additions
interface DevSidecarControls {
  isDevSidecarOpen: boolean;
  devSidecarSessionId?: string;
  serverStatus: 'stopped' | 'starting' | 'running' | 'error';
  logsVisible: boolean;

  onOpenDevSidecar: () => void;
  onCloseDevSidecar: () => void;
  onRestartDevServer: () => void;
  onFocusDevSidecar: () => void;
  onToggleDevSidecarLogs: () => void;
}

// React component in terminal window
const DevSidecarToolbar = () => {
  const [status, setStatus] = useState<ServerStatus>('stopped');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logsVisible, setLogsVisible] = useState(false);

  return (
    <div className="dev-sidecar-controls">
      <button onClick={handleOpen} disabled={sessionId !== null}>
        Open Preview
      </button>
      <button onClick={handleRestart} disabled={!sessionId}>
        Restart Server
      </button>
      <button onClick={handleFocus} disabled={!sessionId}>
        Focus Window
      </button>
      <button onClick={handleToggleLogs} disabled={!sessionId}>
        {logsVisible ? 'Hide Logs' : 'Show Logs'}
      </button>
      <button onClick={handleClose} disabled={!sessionId}>
        Close Preview
      </button>
      <span className={`status-${status}`}>{status}</span>
    </div>
  );
};
```

## Window Configuration

### Dev Sidecar Window Settings
```typescript
const DEV_SIDECAR_WINDOW_CONFIG: BrowserWindowConstructorOptions = {
  width: 1200,
  height: 800,
  title: 'Dev Sidecar',
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

2. **Dev Server Script Missing**
   - Check package.json for the configured dev script
   - Provide instructions for adding or correcting the script
   - Offer to fall back to a safe default command when possible

3. **Custom Command Missing**
   - Validate that the configured `command` exists in package.json scripts
   - Fall back to default command when missing and notify the user
   - Surface actionable error message in the log view if execution fails immediately

4. **Build Errors**
   - Capture build output
   - Display in terminal window
   - Provide fix suggestions

5. **Window Closed Unexpectedly**
   - Notify terminal window
   - Clean up server process
   - Update UI state

## Security Considerations

1. **URL Validation**
   - Only allow localhost URLs
   - Validate port numbers
   - Prevent navigation to external sites

2. **Process Isolation**
   - Run the dev server as a child process
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
- [ ] Open Dev Sidecar window from terminal
- [ ] Restart server while window open
- [ ] Focus window from terminal
- [ ] Close window and verify cleanup
- [ ] Handle server errors gracefully
- [ ] Validate all IPC channels