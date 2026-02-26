# Alexandria Window Opening Flow

This document describes how Alexandria Workspace windows are created and initialized, with telemetry instrumentation at each critical step.

## Problem Solved

Opening an Electron window involves multiple processes, async operations, and potential failure points:
- IPC communication between renderer and main process
- Database lookups for workspace metadata
- Window creation with proper configuration
- File system watch registration
- Renderer initialization with URL parameters

Without proper instrumentation, diagnosing slow startup or failed window opens is difficult.

## Window Opening Lifecycle

### 1. User Trigger (Renderer)
The user initiates window open from various entry points:
- **Feed card click** - Repository or workspace card in main window
- **Quick Open menu** - Cmd+K menu workspace selection
- **Workspace list** - Sidebar workspace navigation
- **CLI command** - External open via deep link

**Options passed:**
- `workspaceId` - Opens a named workspace with all its repositories
- `repositoryPath` - Opens a temporary single-repo workspace
- `repositoryId` - PURL identifier for repository lookup

### 2. WindowService IPC Call (Renderer → Main)
The `WindowService.openAlexandriaWorkspace()` method invokes the main process handler via IPC channel `window:open-alexandria-workspace`.

### 3. IPC Handler Processing (Main)
The `modernWindowHandlers.ts` handler:
1. Determines window naming convention
2. Checks for existing window (reuse vs create)
3. Fetches workspace metadata if needed
4. Builds window metadata object

**Window naming:**
- Named workspace: `alexandria-workspace-{uuid}`
- Temp workspace: `alexandria-workspace-temp-{sanitized-path}`

### 4. Window Creation (Main)
`createSpecialWindow()` in `modernWindowManager.ts`:
1. Checks if window already exists → focus and return
2. Creates BrowserWindow with configuration
3. Applies window features (adapters, CSP, menu)
4. Registers in application window maps
5. Sets up close handlers

**OTEL span:** `window.createSpecial` with attributes for purpose, reuse status, and window ID.

### 5. Terminal Registration (Main)
The terminal manager is notified of the new window so terminal sessions can route output correctly.

### 6. Repository Watch Acquisition (Main, Background)
Runs asynchronously to avoid blocking window display:
1. Fetches repositories in workspace
2. Filters to those with valid local paths
3. Calls `monitoringManager.acquireWatch()` for each
4. Tracks successful registrations for cleanup

**Reference ID pattern:** `alexandria-workspace:{windowId}`

Watch cleanup happens automatically when window closes via the `once('closed')` handler.

### 7. URL Loading (Main → Renderer)
The window loads `alexandria-workspace.html` with query parameters:
- `?workspaceId={uuid}` for named workspaces
- `?repositoryPath={path}` for temp workspaces
- `?repositoryId={purl}` for PURL-identified repos

### 8. Renderer Initialization
`AlexandriaWorkspaceApp.tsx` bootstraps:
1. Parses URL query string
2. Loads workspace data via `WorkspaceService`
3. Initializes panel framework
4. Sets up event bus subscriptions
5. Renders initial layout

### 9. Window Ready State
Final state when:
- Window is visible and focused
- Panel framework is mounted
- File watches are active
- Terminal routing is established

A `REPOSITORY_WINDOWS_CHANGED` event broadcasts to all windows so they can update their UI (e.g., disable "Open" buttons for already-open repos).

## Error Scenarios

### Workspace Not Found
If `workspaceId` references a deleted workspace:
- Handler logs error
- Window may still open with fallback state
- User sees empty workspace UI

### Watch Acquisition Failures
If repository path is invalid or monitoring fails:
- Error logged but window continues loading
- That repository won't receive file change events
- User may see stale data

### Window Already Open
If window exists and is not destroyed:
- Existing window is focused
- `window.reused = true` in telemetry
- No duplicate window created

## Telemetry Events

| Event | Process | Purpose |
|-------|---------|---------|
| `alexandria.window.open.requested` | Renderer | Tracks open trigger source |
| `alexandria.window.ipc.invoke` | Renderer | IPC call timing |
| `alexandria.window.handler.received` | Main | Handler entry point |
| `alexandria.workspace.lookup` | Main | Database query performance |
| `window.createSpecial` | Main | Window creation/reuse |
| `terminal.window.registered` | Main | Terminal routing setup |
| `alexandria.watches.acquired` | Main | Watch registration batch |
| `window.loadURL` | Main | URL navigation |
| `alexandria.app.initialized` | Renderer | Full renderer ready |
| `alexandria.window.ready` | Both | End-to-end completion |

## Performance Considerations

- Watch acquisition runs in background to not block window display
- Window reuse avoids expensive creation for repeated opens
- URL parameters avoid IPC round-trip for initial data
- Batch watch operations with `Promise.allSettled` for parallelism
