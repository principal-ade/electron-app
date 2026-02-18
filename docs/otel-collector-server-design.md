# OTEL Collector Server - Design Document

## Overview

A lightweight OpenTelemetry collector service that receives OTLP traces via HTTP and forwards them to registered Electron renderer windows for real-time visualization. The service runs as a utility process within the desktop app and routes traces based on source URL matching.

**Repository**: New standalone npm package (similar to `@principal-ai/repository-monitoring-server`)

**Integration**: Electron desktop app spawns this as a utility process

---

## Architecture

```
┌──────────────────────────────────┐
│  web-ade (Next.js)               │
│  @ localhost:3000                │
│  - OTEL SDK instrumented         │
│  - Emits trace spans             │
└────────────┬─────────────────────┘
             │ HTTP POST
             │ Origin: http://localhost:3000
             │ POST /v1/traces
             ↓
┌──────────────────────────────────┐
│  OTEL Collector Server           │
│  (Utility Process)               │
│  @ localhost:4318                │
│                                  │
│  ┌────────────────────────────┐ │
│  │ HTTP Server                │ │
│  │ - OTLP receiver            │ │
│  │ - Origin extraction        │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │ Port Router                │ │
│  │ - Registered ports map     │ │
│  │ - Source URL matching      │ │
│  └────────────────────────────┘ │
└────────────┬─────────────────────┘
             │ MessagePort.postMessage()
             │ { type: 'TRACE_BATCH', traces, source }
             ↓
┌──────────────────────────────────┐
│  DevWorkspace Window             │
│  (Renderer Process)              │
│  - Registered for localhost:3000 │
│  - Receives trace batches        │
│  - UI visualization/filtering    │
└──────────────────────────────────┘
```

---

## Component Breakdown

### 1. HTTP Server (OTLP Receiver)

**Responsibility**: Accept OTLP trace requests from external sources

**Endpoints**:
```typescript
POST /v1/traces      // OTLP trace endpoint
POST /v1/metrics     // (Future) OTLP metrics endpoint
GET  /health         // Health check
```

**Request Processing**:
1. Parse OTLP JSON payload
2. Extract `Origin` or `Referer` header
3. Convert OTLP format to internal trace format
4. Route to registered ports

**CORS Configuration**:
```typescript
{
  allowedOrigins: [
    'http://localhost:*',  // Any localhost port
    'http://127.0.0.1:*'
  ],
  allowedHeaders: ['Content-Type', 'X-Source-Port'],
  allowedMethods: ['POST', 'OPTIONS']
}
```

### 2. Port Router

**Responsibility**: Maintain port registrations and route traces to correct windows

**Data Structure**:
```typescript
interface PortRegistration {
  windowId: string;           // Unique window identifier
  serviceIdentifier: string;          // e.g., "http://localhost:3000"
  port: MessagePort;          // Direct channel to renderer
  registeredAt: number;       // Timestamp
}

// Map: serviceIdentifier → PortRegistration[]
private portRegistry: Map<string, PortRegistration[]>;
```

**Routing Logic**:
```typescript
routeTraces(traces: Trace[], serviceIdentifier: string) {
  const registrations = this.portRegistry.get(serviceIdentifier);

  if (!registrations || registrations.length === 0) {
    // No registered consumers - optionally buffer or drop
    this.handleUnroutedTraces(traces, serviceIdentifier);
    return;
  }

  // Send to all registered windows for this source
  registrations.forEach(reg => {
    reg.port.postMessage({
      type: 'TRACE_BATCH',
      traces,
      source: serviceIdentifier,
      timestamp: Date.now()
    });
  });
}
```

### 3. Worker Entry Point

**Responsibility**: Bootstrap server in utility process, handle parent IPC

**File**: `worker-entry.ts`

```typescript
import { OTELCollectorServer } from './OTELCollectorServer';

let server: OTELCollectorServer | null = null;

async function initialize() {
  if (!process.parentPort) {
    throw new Error('Must run as Electron utility process');
  }

  server = new OTELCollectorServer({
    port: 4318,
    enableCORS: true,
    bufferUnroutedTraces: true,
    bufferMaxSize: 1000
  });

  await server.start();

  process.parentPort.postMessage({
    type: 'READY',
    port: server.getPort(),
    pid: process.pid
  });

  setupMessageHandlers();
}

function setupMessageHandlers() {
  process.parentPort!.on('message', (message) => {
    switch (message.type) {
      case 'REGISTER_PORT':
        handlePortRegistration(message);
        break;
      case 'UNREGISTER_PORT':
        handlePortUnregistration(message);
        break;
      case 'GET_STATS':
        sendStats();
        break;
      case 'SHUTDOWN':
        shutdown();
        break;
    }
  });
}

function handlePortRegistration(message: any) {
  const { windowId, serviceIdentifier, port } = message;

  server!.registerPort(windowId, serviceIdentifier, port);

  process.parentPort!.postMessage({
    type: 'PORT_REGISTERED',
    windowId,
    serviceIdentifier
  });
}

async function shutdown() {
  if (server) {
    await server.stop();
  }
  process.exit(0);
}

initialize().catch(err => {
  console.error('[OTEL Collector] Failed to initialize:', err);
  process.exit(1);
});
```

---

## Message Protocol

### Main → Worker Messages

#### REGISTER_PORT
```typescript
{
  type: 'REGISTER_PORT',
  windowId: string,
  serviceIdentifier: string,  // e.g., "http://localhost:3000"
  port: MessagePort   // Transferred port
}
```

#### UNREGISTER_PORT
```typescript
{
  type: 'UNREGISTER_PORT',
  windowId: string,
  serviceIdentifier: string
}
```

#### GET_STATS
```typescript
{
  type: 'GET_STATS'
}
```

Response:
```typescript
{
  type: 'STATS',
  stats: {
    tracesReceived: number,
    tracesBatched: number,
    activeRegistrations: number,
    unroutedTraces: number,
    uptime: number
  }
}
```

#### SHUTDOWN
```typescript
{
  type: 'SHUTDOWN'
}
```

### Worker → Main Messages

#### READY
```typescript
{
  type: 'READY',
  port: number,  // HTTP server port
  pid: number
}
```

#### PORT_REGISTERED
```typescript
{
  type: 'PORT_REGISTERED',
  windowId: string,
  serviceIdentifier: string
}
```

#### ERROR
```typescript
{
  type: 'ERROR',
  error: {
    message: string,
    code: string,
    stack?: string
  }
}
```

### Worker → Renderer Messages (via MessagePort)

#### TRACE_BATCH
```typescript
{
  type: 'TRACE_BATCH',
  traces: Trace[],
  source: string,      // Origin URL
  timestamp: number,   // When received
  batchSize: number
}
```

#### BUFFER_OVERFLOW
```typescript
{
  type: 'BUFFER_OVERFLOW',
  source: string,
  droppedCount: number
}
```

---

## Data Types

### OTLP Trace (Received Format)

```typescript
interface OTLPTraceRequest {
  resourceSpans: ResourceSpan[];
}

interface ResourceSpan {
  resource: {
    attributes: Attribute[];
  };
  scopeSpans: ScopeSpan[];
}

interface ScopeSpan {
  scope: {
    name: string;
    version?: string;
  };
  spans: Span[];
}

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;  // 0=UNSPECIFIED, 1=INTERNAL, 2=SERVER, 3=CLIENT, etc.
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Attribute[];
  events: Event[];
  status: {
    code: number;  // 0=UNSET, 1=OK, 2=ERROR
    message?: string;
  };
}

interface Attribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: number;
    doubleValue?: number;
    boolValue?: boolean;
  };
}

interface Event {
  timeUnixNano: string;
  name: string;
  attributes: Attribute[];
}
```

### Internal Trace Format (Simplified)

```typescript
interface Trace {
  traceId: string;
  spans: SimplifiedSpan[];
  resource: Record<string, any>;  // Flattened attributes
  receivedAt: number;
}

interface SimplifiedSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  startTime: number;  // Unix ms
  endTime: number;
  duration: number;   // Milliseconds
  attributes: Record<string, any>;  // Flattened
  events: SimplifiedEvent[];
  status: 'ok' | 'error' | 'unset';
  statusMessage?: string;
}

interface SimplifiedEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, any>;
}
```

---

## API Design

### OTELCollectorServer Class

```typescript
export interface OTELCollectorConfig {
  port: number;
  enableCORS: boolean;
  bufferUnroutedTraces?: boolean;
  bufferMaxSize?: number;
  maxBatchSize?: number;
  flushInterval?: number;  // ms
}

export class OTELCollectorServer {
  private httpServer: http.Server | null = null;
  private portRegistry: Map<string, PortRegistration[]>;
  private unroutedBuffer: Map<string, Trace[]>;
  private stats: ServerStats;

  constructor(private config: OTELCollectorConfig) {}

  async start(): Promise<void>;
  async stop(): Promise<void>;

  getPort(): number;
  getStats(): ServerStats;

  // Port management
  registerPort(windowId: string, serviceIdentifier: string, port: MessagePort): void;
  unregisterPort(windowId: string, serviceIdentifier: string): void;
  unregisterWindow(windowId: string): void;  // Unregister all ports for window

  // Internal methods
  private handleTraceRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
  private parseOTLPPayload(body: any): Trace[];
  private extractSourceUrl(req: http.IncomingMessage): string | null;
  private routeTraces(traces: Trace[], serviceIdentifier: string): void;
  private handleUnroutedTraces(traces: Trace[], serviceIdentifier: string): void;
}
```

### Manager Class (In Electron Main Process)

```typescript
// src/main/otel-collector/OTELCollectorManager.ts

export class OTELCollectorManager {
  private worker: Electron.UtilityProcess | null = null;
  private ready: boolean = false;
  private port: number | null = null;

  async start(): Promise<void>;
  async stop(): Promise<void>;

  // Called by renderer windows via IPC
  registerPort(windowId: string, serviceIdentifier: string, port: MessagePort): Promise<void>;
  unregisterPort(windowId: string, serviceIdentifier: string): Promise<void>;

  // Lifecycle
  onWindowClosed(windowId: string): void;

  getStats(): Promise<ServerStats>;
  isReady(): boolean;
  getPort(): number | null;

  // Private
  private spawnWorker(): void;
  private handleWorkerMessage(message: any): void;
  private handleWorkerExit(code: number): void;
}
```

### Renderer Service (IPC Layer)

```typescript
// src/renderer/main-process-api/OTELCollectorService.ts

export class OTELCollectorService {
  private static messagePort: MessagePort | null = null;
  private static listeners: Map<string, Set<TraceListener>> = new Map();

  /**
   * Register this window to receive traces from a specific source URL
   */
  static async registerForTraces(
    serviceIdentifier: string,
    listener: TraceListener
  ): Promise<void> {
    if (!this.messagePort) {
      await this.initializeMessagePort(serviceIdentifier);
    }

    const listeners = this.listeners.get(serviceIdentifier) || new Set();
    listeners.add(listener);
    this.listeners.set(serviceIdentifier, listeners);

    // Register with main process
    await window.mainProcess.otelCollector.registerPort(serviceIdentifier);
  }

  /**
   * Unregister this window from receiving traces
   */
  static async unregisterFromTraces(
    serviceIdentifier: string,
    listener?: TraceListener
  ): Promise<void> {
    if (listener) {
      const listeners = this.listeners.get(serviceIdentifier);
      listeners?.delete(listener);
    } else {
      this.listeners.delete(serviceIdentifier);
    }

    await window.mainProcess.otelCollector.unregisterPort(serviceIdentifier);
  }

  static async getStats(): Promise<ServerStats> {
    return await window.mainProcess.otelCollector.getStats();
  }

  // Private
  private static async initializeMessagePort(serviceIdentifier: string): Promise<void> {
    const { port1, port2 } = new MessageChannel();

    this.messagePort = port1;
    this.messagePort.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    // Transfer port2 to main process
    await window.mainProcess.otelCollector.initializePort(serviceIdentifier, port2);
  }

  private static handleMessage(message: any): void {
    switch (message.type) {
      case 'TRACE_BATCH':
        this.notifyListeners(message.source, message.traces);
        break;
      case 'BUFFER_OVERFLOW':
        console.warn('[OTEL] Buffer overflow:', message);
        break;
    }
  }

  private static notifyListeners(source: string, traces: Trace[]): void {
    const listeners = this.listeners.get(source);
    listeners?.forEach(listener => {
      try {
        listener(traces);
      } catch (err) {
        console.error('[OTEL] Listener error:', err);
      }
    });
  }
}

export type TraceListener = (traces: Trace[]) => void;
```

---

## Integration Points

### 1. Electron Main Process Integration

**File**: `src/main/initialization.ts`

```typescript
import { OTELCollectorManager } from './otel-collector/OTELCollectorManager';

const otelCollectorManager = new OTELCollectorManager();

export async function initializeServices() {
  // Start OTEL collector
  await otelCollectorManager.start();

  // ... other services
}

// Register IPC handlers
ipcMain.handle('otel-collector:register-port', async (event, serviceIdentifier) => {
  const { port1, port2 } = new MessageChannel();

  // Send port1 back to renderer
  event.sender.postMessage('otel-collector:port-ready', null, [port1]);

  // Register port2 with collector
  const windowId = getWindowId(event.sender);
  await otelCollectorManager.registerPort(windowId, serviceIdentifier, port2);
});

ipcMain.handle('otel-collector:unregister-port', async (event, serviceIdentifier) => {
  const windowId = getWindowId(event.sender);
  await otelCollectorManager.unregisterPort(windowId, serviceIdentifier);
});

ipcMain.handle('otel-collector:get-stats', async () => {
  return await otelCollectorManager.getStats();
});

// Cleanup on window close
app.on('browser-window-closed', (event, window) => {
  const windowId = getWindowId(window);
  otelCollectorManager.onWindowClosed(windowId);
});
```

### 2. DevWorkspace Integration

**File**: `src/renderer/dev-workspace/DevWorkspace.tsx`

```typescript
import { OTELCollectorService, Trace } from '../main-process-api/OTELCollectorService';

export function DevWorkspace() {
  const devServerUrl = 'http://localhost:3000'; // From config or context

  useEffect(() => {
    const handleTraces = (traces: Trace[]) => {
      console.log('Received traces:', traces);
      // TODO: Store in state, visualize, filter, etc.
    };

    // Register for traces from this dev server
    OTELCollectorService.registerForTraces(devServerUrl, handleTraces);

    return () => {
      OTELCollectorService.unregisterFromTraces(devServerUrl, handleTraces);
    };
  }, [devServerUrl]);

  return (
    <div>
      {/* DevWorkspace UI */}
    </div>
  );
}
```

### 3. Webpack Configuration

**File**: `webpack.main.config.ts`

```typescript
export const mainConfig: Configuration = {
  entry: {
    index: './src/main/index.ts',
    'otel-collector-worker': './src/otel-collector-server/worker-entry.ts',
    // ... other workers
  },
  // ...
};
```

---

## Source URL Matching Strategy

### Priority Order (Most to Least Reliable):

1. **Origin Header**: Standard HTTP header, most reliable
   ```
   Origin: http://localhost:3000
   ```

2. **Referer Header**: Fallback if Origin not present
   ```
   Referer: http://localhost:3000/some-page
   ```

3. **Custom Header**: Explicitly sent by web-ade
   ```
   X-Source-Port: 3000
   X-Dev-Server-URL: http://localhost:3000
   ```

4. **OTLP Resource Attributes**: In the payload itself
   ```json
   {
     "resource": {
       "attributes": [
         { "key": "dev.server.url", "value": { "stringValue": "http://localhost:3000" } }
       ]
     }
   }
   ```

### URL Normalization:

```typescript
function normalizeSourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Normalize to http://localhost:PORT format
    return `http://localhost:${parsed.port}`;
  } catch {
    return url;
  }
}
```

---

## Error Handling

### Unrouted Traces

When traces arrive with no registered consumers:

**Option 1: Buffer (Default)**
```typescript
if (this.config.bufferUnroutedTraces) {
  const buffer = this.unroutedBuffer.get(serviceIdentifier) || [];
  buffer.push(...traces);

  // Prevent unbounded growth
  if (buffer.length > this.config.bufferMaxSize!) {
    buffer.splice(0, buffer.length - this.config.bufferMaxSize!);
    this.stats.buffersOverflowed++;
  }

  this.unroutedBuffer.set(serviceIdentifier, buffer);
}
```

**Option 2: Drop**
```typescript
else {
  this.stats.tracesDropped += traces.length;
  console.warn(`[OTEL] Dropped ${traces.length} traces for ${serviceIdentifier} (no consumers)`);
}
```

### Worker Crashes

```typescript
// In OTELCollectorManager
private handleWorkerExit(code: number): void {
  console.error('[OTEL Collector] Worker exited with code:', code);

  this.ready = false;
  this.worker = null;

  // Auto-restart after delay
  setTimeout(() => {
    console.log('[OTEL Collector] Restarting worker...');
    this.start().catch(err => {
      console.error('[OTEL Collector] Failed to restart:', err);
    });
  }, 5000);
}
```

### HTTP Errors

```typescript
private async handleTraceRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const body = await this.readBody(req);
    const serviceIdentifier = this.extractSourceUrl(req);

    if (!serviceIdentifier) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing source identification' }));
      return;
    }

    const traces = this.parseOTLPPayload(JSON.parse(body));
    this.routeTraces(traces, serviceIdentifier);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tracesReceived: traces.length }));

  } catch (err) {
    console.error('[OTEL] Request error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
```

---

## Dependencies

### Package Dependencies

```json
{
  "name": "@principal-ai/otel-collector-server",
  "version": "1.0.0",
  "dependencies": {
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/cors": "^2.8.17",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "electron": ">=28.0.0"
  }
}
```

### Desktop App Integration

```json
{
  "dependencies": {
    "@principal-ai/otel-collector-server": "^1.0.0"
  }
}
```

---

## Performance Considerations

### Batching

Collect traces and forward in batches to reduce MessagePort overhead:

```typescript
private traceBatch: Trace[] = [];
private batchTimer: NodeJS.Timeout | null = null;

private addToBatch(traces: Trace[], serviceIdentifier: string): void {
  this.traceBatch.push(...traces);

  if (this.traceBatch.length >= this.config.maxBatchSize!) {
    this.flushBatch(serviceIdentifier);
  } else if (!this.batchTimer) {
    this.batchTimer = setTimeout(() => {
      this.flushBatch(serviceIdentifier);
    }, this.config.flushInterval!);
  }
}

private flushBatch(serviceIdentifier: string): void {
  if (this.traceBatch.length === 0) return;

  this.routeTraces([...this.traceBatch], serviceIdentifier);
  this.traceBatch = [];

  if (this.batchTimer) {
    clearTimeout(this.batchTimer);
    this.batchTimer = null;
  }
}
```

### Memory Management

- Limit unrouted buffer size
- Clear old registrations on window close
- Use WeakMap for port references where possible

---

## Testing Strategy

### Unit Tests

1. OTLP payload parsing
2. Source URL extraction
3. Port registration/unregistration
4. Trace routing logic
5. Buffer overflow handling

### Integration Tests

1. HTTP server lifecycle
2. MessagePort communication
3. Multi-window routing
4. Worker crash recovery

### E2E Tests

1. web-ade → collector → DevWorkspace flow
2. Multiple dev servers to multiple windows
3. Window close cleanup
4. Collector restart recovery

---

## Implementation Phases

### Phase 1: Core Server (MVP)
- [ ] HTTP server with OTLP endpoint
- [ ] Basic OTLP JSON parsing
- [ ] Source URL extraction
- [ ] Single port registration & forwarding
- [ ] Worker entry point

### Phase 2: Manager Integration
- [ ] OTELCollectorManager in main process
- [ ] IPC handlers for port registration
- [ ] Window lifecycle integration
- [ ] Worker spawn & restart logic

### Phase 3: Renderer Service
- [ ] OTELCollectorService API
- [ ] MessagePort management
- [ ] Listener registration
- [ ] DevWorkspace integration

### Phase 4: Production Ready
- [ ] Multi-window routing
- [ ] Unrouted trace buffering
- [ ] Stats & monitoring
- [ ] Error handling & recovery
- [ ] Tests & documentation

### Phase 5: Enhancements
- [ ] Trace filtering in collector
- [ ] Sampling support
- [ ] Metrics endpoint (OTLP metrics)
- [ ] Log export endpoint
- [ ] Performance optimizations

---

## Open Questions

1. **Buffering Strategy**: Should unrouted traces be:
   - Buffered indefinitely until a window registers?
   - Buffered with TTL (e.g., discard after 60s)?
   - Dropped immediately?

2. **Multi-Window Behavior**: If multiple DevWorkspace windows register for same serviceIdentifier:
   - Broadcast to all? (Current design)
   - Round-robin?
   - User choice?

3. **Trace Persistence**: Should collector optionally write to disk for:
   - Session replay?
   - Debugging crashes?
   - Export functionality?

4. **Security**: Should we validate/sanitize:
   - Source URLs (allow-list)?
   - Trace payloads (max size)?
   - Request rate limiting?

---

## References

- [OpenTelemetry Protocol Specification](https://opentelemetry.io/docs/specs/otlp/)
- [OTLP HTTP Specification](https://opentelemetry.io/docs/specs/otlp/#otlphttp)
- [Electron Utility Process](https://www.electronjs.org/docs/latest/api/utility-process)
- [MessagePort API](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort)
- Desktop App Event Processing Server: `/src/event-processing-server/`
