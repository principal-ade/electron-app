# Metrics Backend Bridge Requirements

This document describes the requirements for integrating the desktop app with the otel-events-manager metrics backend via a push model for FileTree synchronization.

## Overview

The metrics backend (`otel-events-manager` running at `http://localhost:4321`) needs FileTree data from registered workspaces to perform trace matching using `@principal-ai/core`. The desktop app already has this data via `RepositoryMonitoringManager` and should push updates when workspaces change.

## Target Architecture

```
Desktop App                              Metrics Backend (localhost:4321)
─────────────                            ─────────────────────────────────

RepositoryMonitoringManager              POST /api/registry/sync
        │                                        │
        │ workspace-changed event                │
        ▼                                        ▼
MetricsBackendBridge ─────HTTP POST────▶ Registry Sync Handler
        │                                        │
        │                                        ▼
        │                                LocalRegistry
        │                                (@principal-ai/core)
        │                                        │
        ▼                                        ▼
  On file changes in                     TraceOrchestrator
  .principal-views/                      (matches incoming traces)
```

## API Endpoint

The metrics backend exposes:

```
POST http://localhost:4321/api/registry/sync
Content-Type: application/json

{
  "action": "update" | "remove",
  "workspace": {
    "id": string,           // Unique workspace identifier (rootPath or workspaceId)
    "rootPath": string,     // Absolute path to workspace root
    "name": string,         // Display name (optional, derived from path if not provided)
    "sha": string           // Content hash for change detection (optional)
  },
  "scopeNames": string[],   // Discovered scope names from library.yaml
  "timestamp": number       // Unix milliseconds
}

Response:
{
  "success": boolean,
  "registeredScopes": string[],
  "error": string           // Only if success=false
}
```

## MetricsBackendBridge Requirements

### Location
Create in: `src/main/metrics-backend/MetricsBackendBridge.ts`

### Interface

```typescript
interface MetricsBackendBridgeConfig {
  /** Metrics backend URL (default: http://localhost:4321) */
  backendUrl?: string;

  /** How often to check connection health (ms) */
  healthCheckInterval?: number;

  /** Whether to auto-reconnect on failure */
  autoReconnect?: boolean;
}

interface MetricsBackendBridge {
  /**
   * Initialize the bridge and start monitoring
   */
  initialize(): Promise<void>;

  /**
   * Push a workspace FileTree to the metrics backend
   */
  pushWorkspace(workspace: {
    id: string;
    rootPath: string;
    name?: string;
    fileTree: FileTree;
  }): Promise<{ success: boolean; registeredScopes: string[] }>;

  /**
   * Notify that a workspace was removed/closed
   */
  removeWorkspace(workspaceId: string): Promise<void>;

  /**
   * Check if metrics backend is reachable
   */
  isConnected(): boolean;

  /**
   * Get connection status for UI display
   */
  getStatus(): {
    connected: boolean;
    lastSuccessfulSync: number | null;
    syncedWorkspaces: string[];
  };

  /**
   * Cleanup on shutdown
   */
  destroy(): void;
}
```

### Implementation Details

#### 1. Initialization

On app startup:
1. Check if metrics backend is reachable (`GET /health`)
2. Subscribe to `RepositoryMonitoringManager` events
3. Sync all currently registered workspaces

```typescript
// In main process initialization
import { getManager } from './repository-monitoring/ipcHandlers';
import { MetricsBackendBridge } from './metrics-backend/MetricsBackendBridge';

const metricsBackendBridge = new MetricsBackendBridge({
  backendUrl: 'http://localhost:4321',
});

await metricsBackendBridge.initialize();

// Subscribe to workspace changes
const manager = getManager();
manager.on('workspace-changed', async (payload) => {
  const fileTree = await manager.getFileTree(payload.repoPath);
  if (fileTree) {
    await metricsBackendBridge.pushWorkspace({
      id: payload.repoPath,
      rootPath: payload.repoPath,
      fileTree,
    });
  }
});
```

#### 2. When to Push

Push FileTree updates when:

| Event | Source | Action |
|-------|--------|--------|
| Workspace registered | `REGISTER` IPC handler | Push full FileTree |
| Files changed in `.principal-views/` | `workspace-changed` event | Push updated FileTree |
| `library.yaml` changed | `workspace-changed` event | Push updated FileTree |
| Workspace unregistered | `UNREGISTER` IPC handler | Send remove action |

#### 3. Scope Discovery

Before pushing, discover scope names from the FileTree using `LibraryDiscovery`:

```typescript
import { LibraryDiscovery } from '@principal-ai/core';

async function discoverScopes(fileTree: FileTree): Promise<string[]> {
  const discovery = new LibraryDiscovery(fsAdapter);
  const result = await discovery.discover(fileTree, { fileReader });
  return result.allServiceNames;
}
```

Or simply push the FileTree and let the metrics backend discover scopes itself.

#### 4. Error Handling

- If metrics backend is unreachable, queue updates for retry
- Log failures but don't block main app functionality
- Provide status for debugging (via IPC to renderer)

#### 5. Debouncing

Debounce rapid file changes (e.g., 500ms) to avoid flooding the backend during active development.

### IPC Handlers (Optional)

Expose bridge status to renderer for debugging:

```typescript
// In ipcHandlers registration
ipcMain.handle('metrics-backend:get-status', () => {
  return metricsBackendBridge.getStatus();
});

ipcMain.handle('metrics-backend:force-sync', async (_event, repoPath: string) => {
  const fileTree = await manager.getFileTree(repoPath);
  if (fileTree) {
    return metricsBackendBridge.pushWorkspace({
      id: repoPath,
      rootPath: repoPath,
      fileTree,
    });
  }
  return { success: false, error: 'FileTree not available' };
});
```

## Integration Points

### Existing Code to Hook Into

1. **`src/main/repository-monitoring/ipcHandlers.ts`**
   - `registerRepositoryMonitoringHandlers()` - Add bridge initialization here
   - Hook into `manager.on('workspace-changed', ...)` events

2. **`RepositoryMonitoringManager`** (from `@principal-ai/repository-monitoring-server`)
   - `getFileTree(repoPath)` - Get current FileTree for a workspace
   - Events: `workspace-changed`, `cache-sync`

3. **`AlexandriaRegistryService`** (for workspace awareness)
   - `getRepositoriesInWorkspace(workspaceId)` - Get all repos in a workspace

### New Files to Create

```
src/main/metrics-backend/
├── MetricsBackendBridge.ts    # Main bridge implementation
├── types.ts                   # Type definitions
└── index.ts                   # Exports
```

## Testing

### Manual Testing

1. Start otel-events-manager (`bun run dev` or similar)
2. Start desktop app
3. Open a workspace with `.principal-views/` directory
4. Check metrics backend UI - workspace should appear in "Registry" section
5. Modify a `.workflow.json` file - sync time should update

### Verification Endpoints

```bash
# Check backend health
curl http://localhost:4321/health

# Check registry status
curl http://localhost:4321/api/registry/status

# Manual sync test
curl -X POST http://localhost:4321/api/registry/sync \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "workspace": {
      "id": "/path/to/repo",
      "rootPath": "/path/to/repo",
      "name": "test-repo"
    },
    "scopeNames": ["my-service"],
    "timestamp": '"$(date +%s000)"'
  }'
```

## Future Considerations

1. **Authentication**: Add shared secret for production deployments
2. **WebSocket**: Consider upgrading to WebSocket for bidirectional communication
3. **Batch sync**: Push multiple workspaces in single request
4. **Incremental updates**: Only push changed files instead of full FileTree

## Related Documents

- `otel-events-manager/docs/METRICS_BACKEND_DESIGN.md` - Full backend architecture
- `visual-validation/principal-view-core-library/docs/LOCAL_METRICS_STORAGE_DESIGN.md` - Storage patterns
