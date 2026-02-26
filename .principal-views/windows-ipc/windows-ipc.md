# Windows & IPC Architecture

This document explains the IPC (Inter-Process Communication) architecture between Electron's main and renderer processes.

## What Problem Does This Solve?

Electron's security model requires:

- **Process isolation**: Renderer processes can't directly access Node.js
- **Controlled communication**: All main process access through defined APIs
- **Type safety**: Consistent interfaces across the IPC boundary

## IPC Architecture Layers

### 1. Renderer Process

React components and services that need main process functionality.

### 2. Preload Bridge

The `contextBridge` exposes typed APIs via `window.mainProcess.*`:

```typescript
// Example: window.mainProcess.fileSystem.readFile(path)
```

### 3. Main Process

IPC handlers registered with `ipcMain.handle()` that execute privileged operations.

## Communication Patterns

### Request-Response (ipcRenderer.invoke)

For operations that return data:
- File operations
- GitHub API calls
- Window management

### Event Broadcasting (webContents.send)

For push notifications:
- Auth state changes
- Cache sync events
- File system changes

## Key Adapters

| Adapter | Purpose |
|---------|---------|
| FileSystem Adapter | File read/write operations |
| WindowManager Adapter | Window creation/management |
| GitHub Adapter | GitHub API integration |
| Terminal Manager | PTY session management |

## Design Decisions

### Why Per-Window Adapters?

Some adapters maintain window-specific state:
- Terminal sessions bound to windows
- File watchers scoped to workspaces

### Why Separate Interfaces and Implementations?

- **Interfaces** (`src/shared/`): Shared type definitions
- **Implementations** (`src/window/`): Renderer-side API calls

This separation enables:
- Type checking across process boundary
- Clear API contracts
- Easier testing

## Event Channels

IPC channels follow a naming convention:
- `namespace:action` for requests
- `namespace:event` for broadcasts

Examples: `file-system:read`, `auth-state:changed`
