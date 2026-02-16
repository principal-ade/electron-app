# OTEL Trace Pipeline

Complete flow of OpenTelemetry traces from application instrumentation through the OTEL collector to dev workspace window visualization.

## Overview

This canvas documents how distributed traces flow through the desktop application's OpenTelemetry (OTEL) infrastructure:

1. **Application Code** creates spans using `@opentelemetry/api`
2. **OTLP HTTP Endpoint** receives trace data via POST
3. **OTEL Collector Server** processes and stores traces
4. **MessagePort System** routes traces to specific windows
5. **Preload Bridge** manages IPC communication
6. **DevWorkspace** and **SystemMonitor** visualize traces

## Architecture Components

### 1. External Service (Application Code)

**Location**: `src/renderer/**/*.ts`, `src/main/**/*.ts`

Application code instrumented with OpenTelemetry SDK creates spans:

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');
const span = tracer.startSpan('operation-name');
// ... do work ...
span.end();
```

Spans are automatically exported to the OTLP endpoint.

### 2. OTLP HTTP Endpoint

**Location**: `src/main/services/OtelCollectorService.ts`

**Endpoints**:
- Production: `http://localhost:4318/v1/traces`
- Development: `http://localhost:14318/v1/traces`

**Configuration**:
```typescript
this.server = new OTELCollectorServer({
  mode: 'electron',
  otlpPort: isDev ? 14318 : 4318,
  wrapperPort: isDev ? 14319 : 4319,
  binaryPath, // Platform-specific binary
  logLevel: 'info',
  restartOnCrash: true,
});
```

Accepts OTLP data in JSON or Protobuf format.

### 3. OTEL Collector Server

**Package**: `@principal-ai/otel-collector-server`
**Location**: `src/main/services/OtelCollectorService.ts`

The collector receives, processes, and routes trace data. It runs as a singleton service managed by the main process.

**Platform Support**:
- macOS (darwin_amd64, darwin_arm64)
- Linux (linux_amd64, linux_arm64)
- Windows (windows_amd64)

### 4. Trace Storage

**Location**: `src/main/services/OtelCollectorService.ts`

**Implementation**:
```typescript
private traces: StoredTrace[] = [];
private readonly MAX_TRACES = 50;

storeTrace(traceData: OTLPTraceData): void {
  const trace: StoredTrace = {
    timestamp: Date.now(),
    traceId: this.extractTraceId(traceData),
    data: traceData,
  };
  this.traces.unshift(trace); // Add to beginning
  if (this.traces.length > this.MAX_TRACES) {
    this.traces = this.traces.slice(0, this.MAX_TRACES);
  }
}
```

**Characteristics**:
- Circular buffer with max 50 traces
- In-memory storage (not persisted)
- FIFO eviction (oldest traces removed first)
- Indexed by trace ID

### 5. MessagePort System

**Location**: `src/main/services/OtelCollectorService.ts`

Uses Electron's `MessageChannelMain` for IPC:

**Port Registration**:
```typescript
registerPort(windowId: string, sourceUrl: string, port: MessagePortMain): void {
  const key = `${windowId}:${sourceUrl}`;
  this.ports.set(key, port);

  // Also register with wildcard for monitoring
  if (sourceUrl === WILDCARD_SOURCE) {
    this.monitorPorts.set(windowId, port);
  }
}
```

**Trace Routing**:
- Routes traces to specific window+source combinations
- Monitor port receives ALL traces (wildcard)
- Each port gets `{ type: 'TRACE_BATCH', payload: OTLPTraceData }`

### 6. IPC Handlers

**Location**: `src/main/services/ipc/otelCollectorHandlers.ts`

**Available Handlers**:

| Handler | Description |
|---------|-------------|
| `otel-collector:start` | Start OTEL collector server |
| `otel-collector:stop` | Stop OTEL collector server |
| `otel-collector:getStatus` | Get running status + trace count |
| `otel-collector:registerPort` | Create MessageChannel, send port2 to renderer |
| `otel-collector:unregisterPort` | Remove port for window:source |
| `otel-collector:unregisterWindow` | Remove all ports for window |
| `otel-collector:sendTestTrace` | Send test trace via HTTP POST |
| `otel-collector:getTraces` | Retrieve stored traces (with limit) |
| `otel-collector:clearTraces` | Clear all stored traces |

**Key Handler - registerPort**:
```typescript
ipcMain.handle('otel-collector:registerPort', (event, windowId, sourceUrl) => {
  const { port1, port2 } = new MessageChannelMain();
  service.registerPort(windowId, sourceUrl, port1);
  event.sender.postMessage('otel-collector:port', { windowId, sourceUrl }, [port2]);
  return { success: true };
});
```

### 7. Preload Bridge

**Location**: `src/window/main-process-api-implementations/otelCollectorApi.ts`

**Responsibilities**:
- Manages MessagePort storage: `Map<key, MessagePort>`
- Manages subscribers: `Map<key, Set<callback>>`
- Handles port lifecycle (register, unregister, cleanup)

**Port Listener Setup**:
```typescript
ipcRenderer.on('otel-collector:port', (event, data) => {
  const key = `${data.windowId}:${data.sourceUrl}`;
  const [port] = event.ports;

  port.start();
  port.onmessage = (e) => {
    const subscribers = messageSubscribers.get(key);
    subscribers?.forEach(callback => callback(e.data));
  };

  messagePorts.set(key, port);
});
```

**API Methods**:
- `onOtelMessage(windowId, sourceUrl, callback)` - Subscribe to traces
- `sendOtelMessage(windowId, sourceUrl, data)` - Send to port
- `removeOtelPort(windowId, sourceUrl)` - Cleanup

### 8. DevWorkspace Panel Framework

**Location**: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`

Handles `trace:selected` events from the panel event bus:

```typescript
events.on('trace:selected', (event) => {
  const payload = event.payload as TraceSelectedPayload;
  const trace = payload.trace;

  // Create trace details tab
  const newTab: TraceDetailsTab = {
    id: `trace-${trace.traceId}`,
    label: `Trace: ${traceName}`,
    contentType: 'trace-details',
    traceId: trace.traceId,
    traceData: trace, // Full trace for instant display
    closable: true,
  };

  setTabs(prev => [...prev, newTab]);
  setFocusTabId(newTab.id);
});
```

### 9. TraceDetailsPanel

**Package**: `@industry-theme/principal-view-panels`
**Location**: Used in `DevWorkspacePanelFramework.tsx`

Renders OTLP trace data with:
- Span hierarchy visualization
- Timing waterfall
- Span attributes display
- Parent-child relationships

**Props**:
```typescript
{
  context: PanelContext,
  actions: PanelActions,
  events: PanelEventBus,
  selectedTrace: OTLPTraceData
}
```

### 10. SystemMonitor TraceViewer

**Location**: `src/renderer/principal-window/views/SystemMonitor/TraceViewer.tsx`

**Features**:
- Polls traces every 2 seconds: `otelCollectorService.getTraces(20)`
- Groups traces by service name
- Converts OTLP to AgentPrism format
- Collapsible trace sections
- Clear traces button

**Polling Logic**:
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const fetchedTraces = await otelCollectorService.getTraces(20);
    setTraces(fetchedTraces);
  }, 2000);

  return () => clearInterval(interval);
}, []);
```

## Data Flow

```
Application Code (instrumented)
        ↓ [HTTP POST]
OTLP Endpoint (:4318/v1/traces)
        ↓ [Parse OTLP]
OTELCollectorServer
        ↓ [Store + Route]
    ┌───┴───┐
    ↓       ↓
Storage    MessagePorts
(50 max)   (per window:source)
    ↓       ↓ [postMessage]
    ↓   Preload Bridge
    ↓       ↓ [onmessage callback]
    ↓   Subscribers
    ↓       ↓
    ↓   ┌───┴───────┐
    ↓   ↓           ↓
    └→ SystemMonitor DevWorkspace
       TraceViewer   PanelFramework
           ↓             ↓
       (polls)      trace:selected
           ↓             ↓
       Display    TraceDetailsPanel
```

## Event Flow

### Span Creation → Storage

1. **App creates span** → `otel.trace.span_created`
2. **OTLP endpoint receives** → `otel.endpoint.request_received`
3. **Collector processes** → `otel.collector.trace_received`
4. **Storage saves** → `otel.storage.trace_stored`

### Storage → MessagePort → UI

5. **MessagePort routes** → `otel.messageport.trace_routed`
6. **Preload registers** → `otel.preload.port_registered`
7. **Subscriber receives** → `otel.subscriber.message_received`

### User Interaction → Visualization

8. **SystemMonitor polls** → `otel.systemmonitor.traces_polled`
9. **User selects trace** → `otel.eventbus.trace_event_emitted`
10. **DevWorkspace handles** → `otel.devworkspace.trace_selected`
11. **Panel renders** → `otel.panel.trace_rendered`

## Trace Data Format

### OTLP Structure

```typescript
interface StoredTrace {
  timestamp: number;
  traceId: string;
  data: {
    resourceSpans: [{
      resource: {
        attributes: Array<{
          key: string,
          value: { stringValue?: string, intValue?: string }
        }>,
      },
      scopeSpans: [{
        scope: { name: string, version?: string },
        spans: [{
          traceId: string,          // Hex string
          spanId: string,           // Hex string
          parentSpanId?: string,    // Hex string
          name: string,             // Span operation name
          kind: number,             // 0=UNSPECIFIED, 1=INTERNAL, etc.
          startTimeUnixNano: string,
          endTimeUnixNano: string,
          attributes: Array<{
            key: string,
            value: { stringValue?: string }
          }>,
          status: { code: number, message?: string },
        }],
      }],
    }],
  };
}
```

### Service Name Extraction

```typescript
// From resource attributes
const serviceNameAttr = trace.data.resourceSpans[0]?.resource.attributes
  .find(attr => attr.key === 'service.name');

const serviceName = serviceNameAttr?.value.stringValue || 'unknown';
```

## Configuration

### Collector Ports

- **Production OTLP**: 4318
- **Production Wrapper**: 4319
- **Development OTLP**: 14318
- **Development Wrapper**: 14319

### Storage Limits

- **Max traces**: 50
- **Storage type**: In-memory
- **Eviction**: FIFO (oldest first)

### Polling Intervals

- **SystemMonitor**: 2000ms (2 seconds)

## Testing

### Send Test Trace

From SystemMonitor UI or programmatically:

```typescript
await otelCollectorService.sendTestTrace();
```

Sends a test trace with:
- Random trace ID
- Single span named "test-operation"
- Attributes: `test.key: "test-value"`
- Current timestamp

### Verify Flow

1. Send test trace
2. Check SystemMonitor TraceViewer (wait 2s for poll)
3. Click trace to open in DevWorkspace
4. Verify TraceDetailsPanel shows span hierarchy

## Key Files

| File | Purpose |
|------|---------|
| `src/main/services/OtelCollectorService.ts` | Collector management & storage |
| `src/main/services/ipc/otelCollectorHandlers.ts` | IPC handlers |
| `src/window/main-process-api-implementations/otelCollectorApi.ts` | Preload port management |
| `src/shared/main-process-api-interfaces/OtelCollectorAPI.ts` | Type definitions |
| `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` | Trace event handling |
| `src/renderer/principal-window/views/SystemMonitor/TraceViewer.tsx` | Trace display |
| `src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx` | Collector controls |

## Related Documentation

- [FileTree Sync Flow](./../filetree-sync/filetree-sync.md)
- [Collections Flow](./../collections-flow/collections-flow.md)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otlp/)
- [Electron MessagePorts](https://www.electronjs.org/docs/latest/api/message-port-main)
