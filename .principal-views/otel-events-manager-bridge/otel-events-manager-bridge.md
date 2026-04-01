# OTEL Events Manager Bridge

The OtelEventsManagerBridge provides integration between the desktop app and the `otel-events-manager` service for trace persistence and workspace-aware trace matching.

## Problem

The desktop app collects OpenTelemetry traces via `OtelCollectorService`, but these traces need to be:
1. **Persisted** - Stored beyond the in-memory buffer for historical analysis
2. **Matched to workspaces** - Correlated with workflow definitions in `.principal-views/` directories

The `otel-events-manager` service (running at `localhost:4321`) provides both capabilities, but needs workspace FileTree data to perform trace matching using `@principal-ai/core`.

## Solution

The bridge encapsulates all communication with `otel-events-manager`:

### Trace Forwarding
- Receives traces from `OtelCollectorService.storeTrace()`
- Forwards to `POST /v1/traces` as fire-and-forget
- Non-blocking - failures don't affect trace collection

### Workspace Sync
- Listens to `workspace-changed` events from `RepositoryMonitoringManager`
- Pushes FileTree data to `POST /api/registry/sync`
- Debounced (500ms) to avoid flooding during rapid file changes
- Discovers scope names from `library.yaml` for trace matching

## Design Choices

### Fire-and-Forget for Traces
Trace forwarding is intentionally non-blocking. If `otel-events-manager` is unavailable, traces are still stored locally in `OtelCollectorService`. This ensures the app remains functional even without the metrics backend.

### Debounced Workspace Sync
File changes often occur in bursts (e.g., during `git checkout` or IDE refactoring). The 500ms debounce prevents overwhelming the events manager while still providing timely updates.

### Singleton Pattern
The bridge follows the same singleton pattern as other services (`OtelCollectorService`, `DeviceIdService`), ensuring a single source of truth for connection state and metrics.

### Environment Configuration
The base URL defaults to `http://localhost:4321` but can be overridden via `OTEL_EVENTS_MANAGER_URL` environment variable for custom deployments.

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Health check (30s interval) |
| `POST /v1/traces` | Forward OTLP trace data |
| `POST /api/registry/sync` | Sync workspace FileTree |

## Workflow Patterns

### App Startup
1. Bridge initializes and checks health
2. Starts periodic health checks (30s)
3. Repository monitoring registers workspaces
4. Initial FileTree sync for each registered workspace

### File Change
1. User modifies files in `.principal-views/`
2. `RepositoryMonitoringManager` emits `workspace-changed`
3. Bridge debounces and pushes updated FileTree
4. Events manager updates its registry for trace matching

### Workspace Closed
1. Repository unregistered via IPC
2. Bridge sends `remove` action to registry sync endpoint
3. Events manager removes workspace from its registry

## Error Scenarios

### Events Manager Unavailable
- Health check marks bridge as disconnected
- Trace forwarding silently fails (logged in dev mode)
- Workspace sync fails gracefully
- App continues functioning normally

### Network Errors
- 5 second timeout on health checks
- No retry queue for traces (fire-and-forget)
- Workspace sync will retry on next file change
