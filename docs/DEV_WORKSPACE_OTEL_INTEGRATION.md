# Dev Workspace OTEL Integration

## Overview

This document describes the integration of OpenTelemetry (OTEL) trace viewer components into the dev workspace window. This integration allows developers to view real-time traces from running applications directly in the dev workspace, with the ability to route traces based on source URL.

**Date**: February 1-2, 2026
**Version**: Principal ADE 0.0.380
**Panels Package**: @industry-theme/principal-view-panels@0.9.2
**OTEL Server Package**: @principal-ai/otel-collector-server@0.1.8

---

## Architecture

### Component Flow

```
┌─────────────────┐
│  Running App    │ (sends traces via OTLP)
│  (Principal ADE)│
└────────┬────────┘
         │ OTLP/JSON
         │ http://localhost:4318/v1/traces
         ▼
┌─────────────────────────────────────┐
│  OTELCollectorServer (Main Process) │
│  - Receives OTLP traces             │
│  - Routes based on sourceUrl        │
└──────────────┬──────────────────────┘
               │ MessagePort
               │ (postMessage pattern)
               ▼
┌──────────────────────────────────────┐
│  Dev Workspace (Renderer)            │
│  RepositoryPanelContext              │
│  - Receives trace data               │
│  - Converts to TraceInfo[]           │
│  - Updates telemetry slice           │
└──────────────┬───────────────────────┘
               │ Data Slice
               ▼
┌──────────────────────────────────────┐
│  TraceListPanel (Sidebar)            │
│  - Shows list of traces              │
│  - Search/filter functionality       │
│  - Emits 'trace:selected' on click   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  TraceDetailsPanel (Custom Tab)      │
│  - Shows detailed span information   │
│  - Listens for 'trace:selected'      │
└──────────────────────────────────────┘
```

### Trace Routing

The OTEL collector routes traces based on the `sourceUrl` attribute extracted from trace data:

1. **Extraction Order** (in `OTLPForwardingServer.extractSourceUrl()`):
   - First checks `dev.server.url` attribute
   - Falls back to `service.name` attribute
   - Defaults to `'unknown'` if neither exists

2. **Routing Mechanism** (in `PortRouter`):
   - Traces are routed to all MessagePorts registered for the specific sourceUrl
   - Wildcard registrations (`*`) receive all traces regardless of sourceUrl
   - Prevents duplicate sends to the same windowId

3. **Dev Workspace Selection**:
   - UI dropdown in titlebar allows selecting sourceUrl
   - Options: `principal-ade`, `*` (all), or repository-specific path
   - Selection persisted in localStorage
   - Re-registration happens on sourceUrl change

---

## Key Files and Components

### Main Process

#### `/src/main/services/OtelCollectorService.ts`
- Singleton service managing the OTEL collector
- Starts/stops the collector server
- Registers MessagePorts for trace delivery
- Location: Lines 155-186 handle port registration

#### `/src/main/services/ipc/otelCollectorHandlers.ts`
- IPC handlers for OTEL collector operations
- **Critical Pattern**: Uses `postMessage()` instead of `invoke()` return
- Location: Lines 66-84 register MessagePort and send via postMessage

```typescript
// IMPORTANT: MessagePorts can't be returned via invoke()
event.sender.postMessage('otel-collector:port', { windowId, sourceUrl }, [port2]);
```

### Preload Layer

#### `/src/window/preload-dev-workspace.ts`
- **MessagePorts are kept in preload** - never passed to renderer (contextBridge serialization breaks them)
- Listens for MessagePort delivery via `otel-collector:port` IPC event
- Routes incoming messages to renderer subscribers
- Exposes helper methods through `window.electron`:
  - `onOtelMessage(windowId, sourceUrl, callback)` - Subscribe to trace messages
  - `sendOtelMessage(windowId, sourceUrl, data)` - Send messages to server
  - `hasOtelPort(windowId, sourceUrl)` - Check if port exists
  - `removeOtelPort(windowId, sourceUrl)` - Cleanup port
- Location: Lines 165-373

```typescript
// Key Pattern: MessagePort stays in preload, messages routed to subscribers
const otelPorts = new Map<string, MessagePort>();
const otelMessageSubscribers = new Map<string, Set<(data: any) => void>>();

ipcRenderer.on('otel-collector:port', (event, data) => {
  const [port] = event.ports;
  port.start();
  otelPorts.set(key, port);

  // Route messages to subscribers
  port.onmessage = (e) => {
    subscribers.forEach((cb) => cb(e.data));
  };
});
```

#### `/src/window/main-process-api-implementations/otelCollectorApi.ts`
- Thin wrapper around IPC calls for OTEL collector
- Does NOT handle MessagePorts (handled in preload-dev-workspace.ts)
- Triggers registration, but port delivery happens via IPC event

### Renderer (Dev Workspace)

#### `/src/renderer/dev-workspace/DevWorkspaceTitlebar.tsx`
- Added dropdown selector for trace source URL
- Options: `principal-ade`, `*` (all traces), repository path
- Location: Lines 45-70 render dropdown UI

#### `/src/renderer/dev-workspace/DevWorkspaceApp.tsx`
- State management for `traceSourceUrl`
- Persists selection to localStorage
- Passes to DevWorkspacePanelFramework
- Location: Lines 89-95 state and persistence

#### `/src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`
- Passes `traceSourceUrl` prop to RepositoryPanelProvider
- Location: Line 127 prop passing

#### `/src/renderer/contexts/RepositoryPanelContext.tsx`
- **Core Integration Point**
- Subscribes to OTEL messages via `window.electron.onOtelMessage()`
- Sends `RENDERER_READY` ping via `window.electron.sendOtelMessage()`
- Receives OTLP trace data in `TRACE_BATCH` wrapper
- Converts to `TraceInfo[]` using `groupSpansByTrace()`
- Updates `telemetryTraces` state (data slice)
- Location: Lines 712-840

```typescript
// Key Integration - subscribe to messages (port stays in preload)
const unsubscribe = window.electron.onOtelMessage(
  windowId,
  sourceUrl,
  (data) => {
    if (data?.type === 'CONNECTION_CONFIRMED') {
      console.info('Server connection confirmed!');
      return;
    }

    if (data?.type === 'TRACE_BATCH') {
      const newTraces = groupSpansByTrace(data.payload);
      setTelemetryTraces((prev) => {
        const existingIds = new Set(prev.map((t) => t.traceId));
        const uniqueNewTraces = newTraces.filter(t => !existingIds.has(t.traceId));
        return [...prev, ...uniqueNewTraces].slice(-1000);
      });
    }
  }
);

// Send ready ping to trigger server confirmation
window.electron.sendOtelMessage(windowId, sourceUrl, {
  type: 'RENDERER_READY',
  windowId,
  sourceUrl,
  timestamp: Date.now(),
});
```

### Shared Types

#### `/src/shared/main-process-api-interfaces/DevWorkspaceAPI.ts`
- Type definitions for dev workspace API
- Added `OtelCollectorAPI` interface
- Location: Lines 29-45 include otelCollector

#### `/src/shared/main-process-api-interfaces/OtelCollectorAPI.ts`
- Type definitions for OTEL collector API methods
- Mirrors main process OtelCollectorService interface

### Panels Package

#### `@industry-theme/principal-view-panels@0.9.2`
Published package with OTEL support:

**New Exports** (in `src/index.tsx`):
- `TraceInfo` - Aggregated trace representation
- `groupSpansByTrace()` - Converts OTLP to TraceInfo[]
- `OtelSpan`, `OtelResource`, etc. - OTLP type definitions

**Package.json Updates**:
- Added `./types/otel` subpath export
- Points to compiled `dist/types/otel.js` and `dist/types/otel.d.ts`

---

## Implementation Challenges & Solutions

### Challenge 1: MessagePort Cannot Be Cloned

**Problem**: Attempted to return MessagePort via `ipcRenderer.invoke()` resulted in:
```
Error: An object could not be cloned
```

**Root Cause**: MessagePorts use Structured Clone Algorithm which doesn't support cloning. They must be **transferred**, not cloned.

**Solution**: Use the `postMessage()` pattern (same as terminal):

**Main Process**:
```typescript
const { port1, port2 } = new MessageChannelMain();
service.registerPort(windowId, sourceUrl, port1);
event.sender.postMessage('otel-collector:port', { windowId, sourceUrl }, [port2]);
```

**Preload**:
```typescript
ipcRenderer.on('otel-collector:port', (event, data) => {
  const [port] = event.ports; // Extract transferred port
  port.start();
  callback(port);
});
```

**Files Changed**:
- `/src/main/services/ipc/otelCollectorHandlers.ts:66-84`
- `/src/window/main-process-api-implementations/otelCollectorApi.ts:36-100`

---

### Challenge 2: MessagePort Cannot Pass Through ContextBridge

**Problem**: Error when passing MessagePort to renderer via callback:
```
TypeError: messagePort.postMessage is not a function
```

**Root Cause**: Even when MessagePorts are passed as callback parameters, `contextBridge` serializes them, stripping all methods. MessagePorts **cannot pass through contextBridge in any form**.

**Solution**: Keep MessagePorts in preload layer and expose helper methods (same pattern as terminal):

```typescript
// Preload: Store port and route messages to subscribers
const otelPorts = new Map<string, MessagePort>();
const otelMessageSubscribers = new Map<string, Set<(data: any) => void>>();

port.onmessage = (e) => {
  const subscribers = otelMessageSubscribers.get(key);
  subscribers?.forEach((cb) => cb(e.data));
};

// Expose through contextBridge
contextBridge.exposeInMainWorld('electron', {
  onOtelMessage: (windowId, sourceUrl, callback) => { /* subscribe */ },
  sendOtelMessage: (windowId, sourceUrl, data) => { /* send */ },
});
```

**Files Changed**:
- `/src/window/preload-dev-workspace.ts:165-373`
- `/src/renderer/contexts/RepositoryPanelContext.tsx:712-840`

---

### Challenge 3: Connection Confirmation Timing

**Problem**: Server sent confirmation before renderer's `onmessage` handler was ready, causing messages to be lost.

**Root Cause**: Race condition between port delivery and handler setup.

**Solution**: Implement ping-pong handshake where renderer sends `RENDERER_READY` after setting up handler:

**Server** (`@principal-ai/otel-collector-server@0.1.8`):
```typescript
// PortRouter.registerPort()
port.on('message', (event) => {
  if (event.data?.type === 'RENDERER_READY') {
    port.postMessage({
      type: 'CONNECTION_CONFIRMED',
      windowId,
      sourceUrl,
      timestamp: Date.now(),
    });
  }
});
port.start();
```

**Renderer**:
```typescript
// Subscribe to messages FIRST
window.electron.onOtelMessage(windowId, sourceUrl, (data) => { /* handle */ });

// THEN send ready ping
window.electron.sendOtelMessage(windowId, sourceUrl, {
  type: 'RENDERER_READY',
  windowId,
  sourceUrl,
});
```

**Files Changed**:
- `otel-collection-server/src/router/PortRouter.ts:35-50`
- `/src/renderer/contexts/RepositoryPanelContext.tsx:802-812`

---

### Challenge 4: OTEL Types Not Exported from Panels Package

**Problem**: Webpack error when importing from subpath:
```
Module not found: Error: "./dist/types/otel" is not exported
```

**Root Cause**: The `@industry-theme/principal-view-panels` package didn't export OTEL types from main entry point or declare subpath exports.

**Solution**:
1. Add types to main package exports in `src/index.tsx`
2. Add package.json subpath export for `./types/otel`
3. Compile TypeScript to JavaScript for runtime usage
4. Publish new patch version (0.9.2)

**Changes**:

`industry-themed-principal-view-panels/src/index.tsx`:
```typescript
// Re-export OTEL types and utilities
export type {
  TraceInfo,
  OtelSpan,
  OtelResource,
  // ... other types
} from './types/otel';

export {
  groupSpansByTrace,
  getAttributeValue,
  // ... other utilities
} from './types/otel';
```

`industry-themed-principal-view-panels/package.json`:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/panels.bundle.js"
  },
  "./types/otel": {
    "types": "./dist/types/otel.d.ts",
    "import": "./dist/types/otel.js"
  }
}
```

**Files Changed**:
- `industry-themed-principal-view-panels/src/index.tsx`
- `industry-themed-principal-view-panels/package.json`

---

### Challenge 5: Dev Workspace Uses Minimal Preload

**Problem**: `window.mainProcess.otelCollector` was undefined in dev workspace.

**Root Cause**: Dev workspace uses `preload-dev-workspace.ts` (minimal API surface) instead of main `preload.ts`. The OTEL collector API wasn't exposed.

**Solution**: Add `otelCollectorApi` to minimal preload:

```typescript
// preload-dev-workspace.ts
import { otelCollectorApi } from './main-process-api-implementations/otelCollectorApi';

const devWorkspaceAPI: DevWorkspaceMainProcessAPI = {
  terminal: terminalAPI,
  fileSystem: fileSystemAPI,
  // ... other APIs
  otelCollector: otelCollectorApi, // ← Added
};
```

**Critical Bug**: Initially imported as `otelCollectorAPI` (uppercase "API") but the export is `otelCollectorApi` (lowercase "api"). JavaScript imports are case-sensitive.

**Files Changed**:
- `/src/window/preload-dev-workspace.ts:35,56`
- `/src/shared/main-process-api-interfaces/DevWorkspaceAPI.ts:29-45`

---

## Data Flow Details

### MessagePort Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RepositoryPanelContext (Renderer)                        │
│    OtelCollectorService.registerPort(windowId, sourceUrl)   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. otelCollectorApi (Preload)                               │
│    - Creates Promise waiting for port                       │
│    - Calls ipcRenderer.invoke('otel-collector:registerPort')│
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. otelCollectorHandlers (Main Process IPC)                 │
│    - Creates MessageChannelMain                             │
│    - Registers port1 with OtelCollectorService              │
│    - Sends port2 via event.sender.postMessage()             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. OtelCollectorService (Main Process)                      │
│    - Stores port1 in PortRouter                             │
│    - Associates with windowId + sourceUrl                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 5. otelCollectorApi (Preload) - 'otel-collector:port' event │
│    - Receives port2 from event.ports[0]                     │
│    - Calls port.start()                                     │
│    - Resolves Promise with port                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. RepositoryPanelContext (Renderer)                        │
│    - Receives started MessagePort                           │
│    - Sets up onmessage handler                              │
│    - Ready to receive trace data                            │
└─────────────────────────────────────────────────────────────┘
```

### Trace Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Running App sends OTLP trace                             │
│    POST http://localhost:4318/v1/traces                     │
│    Body: { resourceSpans: [...] }                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. OTELCollectorServer receives trace                       │
│    - Extracts sourceUrl from attributes                     │
│    - Routes to PortRouter                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PortRouter routes trace                                  │
│    - Finds ports registered for sourceUrl                   │
│    - Sends via port.postMessage(payload)                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RepositoryPanelContext.messagePort.onmessage             │
│    - Receives event.data (OTLP format)                      │
│    - Calls groupSpansByTrace(event.data)                    │
│    - Returns TraceInfo[]                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. setTelemetryTraces() state update                        │
│    - Merges new traces with existing                        │
│    - Deduplicates by traceId                                │
│    - Keeps last 1000 traces                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. TraceListPanel renders                                   │
│    - Consumes 'telemetry' data slice                        │
│    - Displays trace list with search                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Usage

### Running with Trace Collection

1. **Start the Dev Workspace**:
   ```bash
   npm run dev
   ```

2. **OTEL Collector Auto-Starts**:
   - Collector starts automatically with main process
   - Default ports: 4318 (OTLP), 4319 (wrapper)
   - Dev mode uses: 14318, 14319 (to avoid conflicts)

3. **Configure Your App to Send Traces**:
   ```typescript
   import { trace } from '@opentelemetry/api';

   const tracer = trace.getTracer('my-service');

   const span = tracer.startSpan('operation-name', {
     attributes: {
       'service.name': 'principal-ade',
       // or
       'dev.server.url': 'http://localhost:3000'
     }
   });

   // ... do work

   span.end();
   ```

4. **View Traces in Dev Workspace**:
   - Open dev workspace window
   - TraceListPanel appears in left sidebar
   - Select trace source from titlebar dropdown:
     - `principal-ade` - traces with service.name=principal-ade
     - `*` - all traces
     - Repository path - traces from specific dev server
   - Click trace to view details in TraceDetailsPanel tab

---

## Debugging

### Enable Comprehensive Logging

The integration includes extensive logging at key points:

**Main Process** (`otelCollectorHandlers.ts`):
```
[IPC] Registering trace port for window: dev-workspace-xxxxx, sourceUrl: principal-ade
[IPC] ✅ Trace port registered and sent to renderer
```

**Preload** (`otelCollectorApi.ts`):
```
[otelCollectorApi] 🔄 Registering port for dev-workspace-xxxxx:principal-ade
[otelCollectorApi] 📤 Invoking IPC for dev-workspace-xxxxx:principal-ade
[otelCollectorApi] 📨 Received otel-collector:port event
[otelCollectorApi] ✅ Received OTEL collector port for dev-workspace-xxxxx:principal-ade
[otelCollectorApi] ✅ Port successfully registered
```

**Renderer** (`RepositoryPanelContext.tsx`):
```
[RepositoryPanelProvider] Registering telemetry port with sourceUrl: principal-ade
[RepositoryPanelProvider] ✅ Telemetry port registered successfully
[RepositoryPanelProvider] MessagePort received data: {resourceSpans: [...]}
[RepositoryPanelProvider] Valid trace data, resourceSpans count: 1
[RepositoryPanelProvider] Converted to TraceInfo[]: [...]
[RepositoryPanelProvider] Received 1 new traces
```

### Common Issues

**No traces appearing**:
1. Check that OTEL collector is running:
   ```typescript
   await window.mainProcess.otelCollector.getStatus()
   // { isRunning: true, stats: {...} }
   ```

2. Verify trace sourceUrl matches selection:
   ```javascript
   // In your app's trace
   attributes: { 'service.name': 'principal-ade' }

   // In dev workspace dropdown
   Select: "principal-ade"
   ```

3. Check console for registration errors

**MessagePort errors**:
- Ensure dev workspace window is restarted after rebuilding preload
- Check that `window.mainProcess.otelCollector` is defined
- Verify preload script loaded successfully

---

## Testing

### Manual Testing Steps

1. **Test Port Registration**:
   ```javascript
   // In dev workspace console
   const status = await window.mainProcess.otelCollector.getStatus();
   console.log('Collector running:', status.isRunning);
   ```

2. **Send Test Trace**:
   ```javascript
   // In dev workspace console
   await window.mainProcess.otelCollector.sendTestTrace('principal-ade');
   ```
   - Should see trace appear in TraceListPanel
   - Check console for data flow logs

3. **Test Source Switching**:
   - Switch dropdown from `principal-ade` to `*`
   - Should see cleanup logs
   - Should see new registration logs
   - Send test trace again - should still appear

4. **Test Trace Details**:
   - Click a trace in TraceListPanel
   - Should open TraceDetailsPanel in new tab
   - Should show span information

---

## Future Enhancements

### Potential Improvements

1. **Trace Filtering**:
   - Add filters by service name, duration, status
   - Persist filter state in localStorage

2. **Trace Retention**:
   - Currently keeps last 1000 traces
   - Add configurable retention limit
   - Add "Clear traces" button

3. **Performance**:
   - Virtualize trace list for large trace counts
   - Debounce trace state updates

4. **Integration**:
   - Link traces to source code locations
   - Correlate traces with git commits
   - Match traces to canvas workflows

5. **Export**:
   - Export traces to JSON
   - Share trace permalinks

---

## Related Documentation

- [OTEL Collector Integration](./OTEL_COLLECTOR_INTEGRATION.md) - Main collector documentation
- [Trace Viewer Integration](./TRACE-VIEWER-INTEGRATION.md) - Panel integration guide
- [Panel Framework](./PANEL_FRAMEWORK.md) - Panel framework overview

---

## Changelog

### 2026-02-02 - Architecture Refinement
- **Critical Fix**: Resolved contextBridge serialization breaking MessagePorts
- Refactored to keep MessagePorts in preload layer (same pattern as terminal)
- Added helper methods: `onOtelMessage()`, `sendOtelMessage()`, `removeOtelPort()`
- Implemented ping-pong handshake for connection confirmation
- Published @principal-ai/otel-collector-server@0.1.8 with RENDERER_READY support
- Server sends CONNECTION_CONFIRMED only after renderer is ready
- Messages from server now wrapped in `TRACE_BATCH` type

### 2026-02-01 - Initial Integration
- Added TraceListPanel to dev workspace sidebar
- Added TraceDetailsPanel as custom tab
- Implemented MessagePort-based trace delivery
- Added titlebar dropdown for trace source selection
- Published @industry-theme/principal-view-panels@0.9.2 with OTEL exports
- Fixed MessagePort transfer pattern (invoke → postMessage)
- Added comprehensive debug logging

---

## Contributors

- Development: Claude Sonnet 4.5
- Architecture: griever + Claude
- Testing: griever
