# VictoriaTraces Local Storage Integration

## Overview

This document describes the integration of VictoriaTraces as a managed local trace storage solution for Principal ADE. VictoriaTraces is automatically managed by the Electron app, providing users with persistent trace storage via a simple toggle in settings.

**Date**: February 2026
**Package**: @principal-ai/otel-collector-server
**VictoriaTraces**: victoriametrics/victoria-traces (Docker)

---

## What is VictoriaTraces?

VictoriaTraces is a production-grade trace storage database from VictoriaMetrics:
- **Storage**: Persistent, indexed trace storage on disk
- **Query Engine**: Full query API with VMUI web interface
- **Scale**: Can handle terabytes of trace data
- **Performance**: Fast queries and efficient compression
- **Architecture**: Written in Go, runs as single binary or cluster

**Key Difference from OTEL Collector:**
- **OTEL Collector** (our wrapper): Lightweight router/forwarder, stateless
- **VictoriaTraces**: Full database with persistent storage, indexing, queries

---

## Architecture

### Integration Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Principal ADE (Electron App)              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  OTELCollectorServer (Main Process)                │    │
│  │  - Receives OTLP traces from instrumented apps     │    │
│  │  - Routes to multiple outputs:                     │    │
│  │    1. MessagePort → Electron UI (real-time)       │    │
│  │    2. HTTPOutput → VictoriaTraces (persistent)    │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓ (2. HTTP POST)                   │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              VictoriaTraces (Docker Container)               │
│              Managed by VictoriaTracesManager                │
│                                                              │
│  - Container: principal-victoria-traces                     │
│  - HTTP Endpoint: http://localhost:10428                    │
│  - Data Volume: principal-victoria-traces-data              │
│  - Web UI (VMUI): http://localhost:10428/vmui              │
│  - Auto-restart: unless-stopped                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Instrumented App
  ↓ (OTLP)
OTELCollectorServer
  ├─ Real-time view → Electron UI (MessagePort)
  └─ Persistent storage → VictoriaTraces (HTTP)
      ↓
  Stored in Docker volume
      ↓
  Queryable via VMUI
```

---

## Components

### 1. VictoriaTracesManager

**Location**: `packages/otel-collector-server/src/services/VictoriaTracesManager.ts`

**Responsibilities**:
- Manage VictoriaTraces Docker container lifecycle
- Health monitoring and status reporting
- Configuration management
- Storage statistics

**Key Methods**:

```typescript
class VictoriaTracesManager {
  // Lifecycle
  async start(): Promise<void>
  async stop(): Promise<void>
  async remove(deleteData: boolean): Promise<void>

  // Status
  async getStatus(): Promise<VictoriaTracesStatus>
  async isDockerAvailable(): Promise<boolean>

  // Monitoring
  startHealthMonitoring(callback, intervalMs): void
  stopHealthMonitoring(): void

  // Utilities
  getEndpoint(): string  // Returns OTLP endpoint URL
  async openUI(): Promise<void>  // Opens VMUI in browser
  async getStorageStats(): Promise<{size, location}>
}
```

**Configuration**:

```typescript
interface VictoriaTracesConfig {
  containerName?: string;      // Default: 'principal-victoria-traces'
  httpPort?: number;           // Default: 10428
  grpcPort?: number;           // Default: 4317
  dataVolume?: string;         // Default: 'principal-victoria-traces-data'
  retentionDays?: number;      // Default: 7
}
```

### 2. HTTPOutput

**Location**: `packages/otel-collector-server/src/output/HTTPOutput.ts`

**Responsibilities**:
- Send OTLP traces to remote HTTP endpoints
- Retry logic with exponential backoff
- Error handling without crashing collector

**Configuration**:

```typescript
interface HTTPOutputConfig {
  url: string;                        // OTLP endpoint URL
  headers?: Record<string, string>;   // Optional auth headers
  timeout?: number;                   // Request timeout (default: 10000ms)
  retries?: number;                   // Retry attempts (default: 3)
}
```

**Usage**:

```typescript
const httpOutput = new HTTPOutput({
  url: 'http://localhost:10428/insert/opentelemetry/v1/traces',
  headers: {
    'X-Trace-Source': 'principal-ade',
  },
});

// Sends traces automatically
httpOutput.send(tracePayload, sourceUrl);
```

### 3. OTELCollectorServer Integration

**Location**: `packages/otel-collector-server/src/OTELCollectorServer.ts`

**Extended Configuration**:

```typescript
interface OTELCollectorServerConfig {
  // Existing config...

  // VictoriaTraces integration
  enableLocalStorage?: boolean;
  victoriaTraces?: {
    autoStart?: boolean;      // Auto-start on collector start
    retentionDays?: number;   // Data retention period
  };
}
```

**New Methods**:

```typescript
class OTELCollectorServer {
  // VictoriaTraces management
  async startVictoriaTraces(): Promise<void>
  async stopVictoriaTraces(): Promise<void>
  async getVictoriaTracesStatus(): Promise<VictoriaTracesStatus | null>

  // Events
  on('victoria-traces-status', (status) => void)
}
```

### 4. Electron IPC Handlers

**Location**: `src/main/ipc/victoria-traces-handlers.ts`

**IPC Channels**:

```typescript
// From renderer to main
'victoria-traces:start'          → Start VictoriaTraces
'victoria-traces:stop'           → Stop VictoriaTraces
'victoria-traces:get-status'     → Get current status
'victoria-traces:get-stats'      → Get storage statistics
'victoria-traces:open-ui'        → Open VMUI in browser

// From main to renderer (events)
'victoria-traces:status-update'  → Status changed
```

### 5. Settings UI Component

**Location**: `src/renderer/components/settings/TraceStorageSettings.tsx`

**Features**:
- Toggle to enable/disable local storage
- Real-time status indicator
- Storage usage display
- "Open Query UI" button
- Error handling with helpful messages

---

## User Experience

### Settings UI States

#### 1. Disabled State
```
┌─────────────────────────────────────────┐
│ Local Trace Storage                     │
├─────────────────────────────────────────┤
│                                         │
│ Enable Local Database                  │
│ Store traces on your machine with      │
│ VictoriaTraces                          │
│                               [OFF] ○   │
└─────────────────────────────────────────┘
```

#### 2. Starting State
```
┌─────────────────────────────────────────┐
│ Local Trace Storage                     │
├─────────────────────────────────────────┤
│                                         │
│ Enable Local Database                  │
│ Store traces on your machine with      │
│ VictoriaTraces                          │
│                               [ON] ●    │
│                                         │
│ Status: ⟳ Starting...                  │
└─────────────────────────────────────────┘
```

#### 3. Running State
```
┌─────────────────────────────────────────┐
│ Local Trace Storage                     │
├─────────────────────────────────────────┤
│                                         │
│ Enable Local Database                  │
│ Store traces on your machine with      │
│ VictoriaTraces                          │
│                               [ON] ●    │
│                                         │
│ Status: ✓ Running & Healthy            │
│ Endpoint: http://localhost:10428       │
│ Storage Used: 124 MB                   │
│                                         │
│ [Open Query UI]                        │
└─────────────────────────────────────────┘
```

#### 4. Error State
```
┌─────────────────────────────────────────┐
│ Local Trace Storage                     │
├─────────────────────────────────────────┤
│                                         │
│ Enable Local Database                  │
│ Store traces on your machine with      │
│ VictoriaTraces                          │
│                               [ON] ●    │
│                                         │
│ Status: ✗ Error                        │
│                                         │
│ Error: Docker is not available.        │
│ Please install Docker Desktop.         │
│                                         │
│ [Install Docker Desktop] →             │
└─────────────────────────────────────────┘
```

### User Flow

1. **Enable Local Storage**
   - User clicks toggle in Settings → Trace Storage
   - App checks Docker availability (2 seconds)
   - If Docker missing: Show error with install link
   - If Docker available: Continue to next step

2. **Auto-Start VictoriaTraces**
   - Status shows "Starting..." (10-15 seconds)
   - VictoriaTracesManager pulls image (first time only)
   - Container starts with configured ports/volumes
   - Health check runs until endpoint responds

3. **Running State**
   - Status shows "Running & Healthy"
   - HTTPOutput automatically added to OTEL collector
   - All new traces sent to both:
     - Electron UI (real-time)
     - VictoriaTraces (persistent)

4. **Query Traces**
   - User clicks "Open Query UI"
   - Opens http://localhost:10428/vmui in default browser
   - Full VMUI interface for querying traces

5. **Disable Local Storage**
   - User toggles OFF
   - VictoriaTraces container stops
   - HTTPOutput removed from collector
   - Data persists in Docker volume (not deleted)

---

## Docker Container Management

### Container Configuration

```bash
docker run -d \
  --name principal-victoria-traces \
  -p 10428:10428 \
  -p 4317:4317 \
  -v principal-victoria-traces-data:/victoria-traces-data \
  -e VICTORIA_TRACES_RETENTION="7d" \
  --restart unless-stopped \
  victoriametrics/victoria-traces:latest \
  -retentionPeriod=7d
```

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `containerName` | `principal-victoria-traces` | Docker container name |
| `httpPort` | `10428` | HTTP/OTLP endpoint port |
| `grpcPort` | `4317` | gRPC endpoint (optional) |
| `dataVolume` | `principal-victoria-traces-data` | Docker volume for data |
| `retentionDays` | `7` | Days to keep trace data |

### Data Persistence

- **Volume**: Named Docker volume (`principal-victoria-traces-data`)
- **Location**: Managed by Docker (typically `/var/lib/docker/volumes/...`)
- **Persistence**: Data survives container restarts and app restarts
- **Cleanup**: Only deleted if user explicitly chooses "Delete Data"

### Resource Usage

**Typical Footprint**:
- Binary: ~300MB (in Docker image)
- RAM: 500MB - 2GB (depends on query load)
- Disk: Grows over time (user configurable retention)
  - Day 1: ~500MB
  - Week 1: ~5GB (varies by trace volume)
  - Configurable via retention period

---

## Health Monitoring

### Status Types

```typescript
interface VictoriaTracesStatus {
  isRunning: boolean;        // Container running?
  isHealthy: boolean;        // HTTP endpoint responding?
  containerExists: boolean;  // Container exists but may be stopped?
  endpoint?: string;         // OTLP endpoint URL
  error?: string;           // Error message if any
}
```

### Health Check Logic

1. **Container Check**: `docker ps` to verify running
2. **HTTP Check**: Fetch `http://localhost:10428/metrics`
3. **Timeout**: 2 second timeout on health check
4. **Interval**: Check every 5 seconds when monitoring active

### Status Events

```typescript
// Emitted on status change
collectorServer.on('victoria-traces-status', (status) => {
  console.log('VictoriaTraces status:', status);
});

// Forwarded to renderer via IPC
ipcRenderer.on('victoria-traces:status-update', (event, status) => {
  updateUI(status);
});
```

---

## Error Handling

### Docker Not Available

**Detection**:
```typescript
const available = await victoriaTracesManager.isDockerAvailable();
if (!available) {
  throw new Error('Docker is not available. Please install Docker Desktop.');
}
```

**UI Response**:
- Show error state with install link
- Link to: https://docker.com/get-started
- Prevent toggle from enabling

### Container Failed to Start

**Timeout**: 30 seconds for startup
**Retry Logic**: No automatic retry (user must toggle again)
**Error Message**: "VictoriaTraces failed to become healthy"

**Common Causes**:
- Port already in use
- Docker daemon not running
- Insufficient disk space

### HTTPOutput Failures

**Behavior**: Non-blocking
- Logs error to console
- Retries with exponential backoff (3 attempts)
- Does not crash collector or prevent other outputs

**User Impact**:
- Real-time UI still works (MessagePort)
- Traces not persisted until VictoriaTraces recovers

---

## Configuration Examples

### Minimal Setup

```typescript
const collector = new OTELCollectorServer({
  mode: 'electron',
  enableLocalStorage: true,
  victoriaTraces: {
    autoStart: true,
  },
});

await collector.start();
```

### Custom Configuration

```typescript
const victoriaTracesManager = new VictoriaTracesManager({
  containerName: 'my-app-traces',
  httpPort: 11428,
  retentionDays: 30,
});

const collector = new OTELCollectorServer({
  mode: 'electron',
  outputs: [
    new MessagePortOutput(electronPort),
    new HTTPOutput({
      url: victoriaTracesManager.getEndpoint(),
      headers: {
        'X-App-Version': app.getVersion(),
      },
    }),
  ],
});
```

### Multiple Outputs

```typescript
const collector = new OTELCollectorServer({
  mode: 'electron',
  outputs: [
    // Real-time UI
    new MessagePortOutput(electronPort),

    // Local VictoriaTraces
    new HTTPOutput({
      url: 'http://localhost:10428/insert/opentelemetry/v1/traces',
    }),

    // Remote cloud backup
    new HTTPOutput({
      url: 'https://traces.yourcompany.com/insert/opentelemetry/v1/traces',
      headers: {
        'X-API-Key': userSettings.apiKey,
      },
    }),
  ],
});
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `VictoriaTracesManager.ts`
  - [ ] Docker detection
  - [ ] Container lifecycle methods
  - [ ] Health monitoring
  - [ ] Storage stats
- [ ] Create `HTTPOutput.ts`
  - [ ] OTLP HTTP POST
  - [ ] Retry logic
  - [ ] Error handling
- [ ] Extend `OTELCollectorServer`
  - [ ] Add VictoriaTraces config
  - [ ] Integration methods
  - [ ] Event emission

### Phase 2: Electron Integration
- [ ] Create IPC handlers
  - [ ] `victoria-traces:start`
  - [ ] `victoria-traces:stop`
  - [ ] `victoria-traces:get-status`
  - [ ] `victoria-traces:get-stats`
  - [ ] `victoria-traces:open-ui`
- [ ] Add preload API
  - [ ] Expose IPC channels
  - [ ] TypeScript types

### Phase 3: UI Components
- [ ] Create `TraceStorageSettings.tsx`
  - [ ] Toggle component
  - [ ] Status indicator
  - [ ] Storage stats display
  - [ ] Error states
  - [ ] "Open Query UI" button
- [ ] Add to Settings panel
- [ ] Wire up state management

### Phase 4: Testing & Polish
- [ ] Test Docker detection
- [ ] Test container lifecycle
- [ ] Test health monitoring
- [ ] Test error scenarios
- [ ] Test UI states
- [ ] Performance testing
- [ ] Documentation

---

## Advantages Over Manual Setup

### Without Managed Integration (Manual)

User would need to:
1. Install Docker
2. Download docker-compose.yml
3. Run `docker-compose up -d`
4. Configure app settings with endpoint
5. Manually check if it's running
6. Manage updates/cleanup

**Steps**: 6+
**Technical Knowledge**: Medium-High
**Error Prone**: Yes

### With Managed Integration (Our Approach)

User experience:
1. Click toggle in Settings
2. Done!

**Steps**: 1
**Technical Knowledge**: None
**Error Prone**: No (app handles everything)

---

## Future Enhancements

### Planned Features

1. **Cloud Sync**
   - Option to sync local traces to cloud VictoriaTraces
   - Encrypted upload of anomalies only
   - Cost optimization (5% of traces)

2. **Contract-Based Filtering**
   - Validate traces against Principal-View contracts
   - Only store violations/anomalies
   - 90%+ storage savings

3. **Auto-Cleanup**
   - Configurable retention policies
   - Storage quota management
   - Old trace pruning

4. **Advanced Querying**
   - In-app query builder
   - Saved queries
   - Query templates

5. **Multi-Environment**
   - Separate containers for dev/staging/prod
   - Environment-based routing
   - Isolated storage

---

## References

### VictoriaTraces Documentation
- [Official Docs](https://docs.victoriametrics.com/victoriatraces/)
- [Quick Start](https://docs.victoriametrics.com/victoriatraces/quick-start/)
- [GitHub Repository](https://github.com/VictoriaMetrics/VictoriaTraces)

### Related Documents
- [DEV_WORKSPACE_OTEL_INTEGRATION.md](./DEV_WORKSPACE_OTEL_INTEGRATION.md) - Current OTEL integration
- OTEL Collector Server package documentation

### Docker Resources
- [Docker Desktop](https://docker.com/get-started)
- [Docker Volumes](https://docs.docker.com/storage/volumes/)

---

## FAQ

### Q: What happens if Docker is not installed?
**A**: The app detects this and shows an error with a link to install Docker Desktop. The toggle remains disabled until Docker is available.

### Q: Does VictoriaTraces run inside Electron?
**A**: No, it runs as a separate Docker container. This keeps the Electron app lightweight and allows proper database management.

### Q: What happens to my data if I disable local storage?
**A**: The Docker container stops, but the data volume persists. Re-enabling will restart the container with existing data intact.

### Q: How do I completely delete all trace data?
**A**: In Settings → Trace Storage, there will be a "Delete All Data" option that removes the Docker volume.

### Q: Can I use VictoriaTraces and cloud storage simultaneously?
**A**: Yes! The app supports multiple outputs. You can send traces to both local VictoriaTraces and a remote endpoint.

### Q: How much disk space does VictoriaTraces use?
**A**: It depends on trace volume and retention period. Typical usage: ~5GB per week with 7-day retention. This is configurable.

### Q: Can I query traces from the Electron app?
**A**: Currently, you click "Open Query UI" which opens VMUI in your browser. Future versions may include in-app query builder.

### Q: What if VictoriaTraces becomes unhealthy?
**A**: The app monitors health every 5 seconds. If unhealthy, the status shows an error. Real-time traces still work (they're shown in the Electron UI via MessagePort).

---

**Last Updated**: February 2026
**Status**: Design Phase
**Owner**: Principal AI Engineering Team
