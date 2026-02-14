# VictoriaTraces Architecture Diagrams

Visual reference for the VictoriaTraces local storage integration.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INSTRUMENTED APPLICATION                          │
│                 (Principal ADE, User's App, etc.)                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ OTLP/HTTP POST
                             │ http://localhost:4318/v1/traces
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│               PRINCIPAL ADE ELECTRON APP (Main Process)             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │         OTELCollectorServer                                 │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Go Binary: OpenTelemetry Collector                  │  │   │
│  │  │  - Receives OTLP on :4318                            │  │   │
│  │  │  - Forwards to Node.js wrapper on :4319              │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Node.js Wrapper                                      │  │   │
│  │  │  - Processes traces                                   │  │   │
│  │  │  - Routes to multiple outputs:                        │  │   │
│  │  │                                                        │  │   │
│  │  │    Output 1: MessagePortOutput                        │  │   │
│  │  │    ├─> Renderer Process (Real-time UI)               │  │   │
│  │  │                                                        │  │   │
│  │  │    Output 2: HTTPOutput (if enabled)                  │  │   │
│  │  │    ├─> http://localhost:10428 (VictoriaTraces)       │  │   │
│  │  │                                                        │  │   │
│  │  │    Output 3: HTTPOutput (optional)                    │  │   │
│  │  │    └─> Remote cloud endpoint                          │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │         VictoriaTracesManager                               │   │
│  │  - Manages Docker container lifecycle                       │   │
│  │  - Health monitoring                                        │   │
│  │  - Status reporting to UI                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              │ Docker API
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DOCKER DAEMON (User's Machine)                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Container: principal-victoria-traces                       │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  VictoriaTraces Binary                               │  │   │
│  │  │  - HTTP Server: :10428                               │  │   │
│  │  │  - gRPC Server: :4317 (optional)                     │  │   │
│  │  │  - Storage Engine                                     │  │   │
│  │  │  - Query Engine                                       │  │   │
│  │  │  - VMUI Web Interface                                │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  │  Volume: principal-victoria-traces-data                     │   │
│  │  ├─ /victoria-traces-data/                                  │   │
│  │  │  ├─ cache/                                               │   │
│  │  │  ├─ indexdb/                                             │   │
│  │  │  ├─ snapshots/                                           │   │
│  │  │  └─ txn/                                                 │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP
                              │
                              ▼
                    ┌──────────────────────┐
                    │  Default Browser     │
                    │  VMUI Query Interface│
                    │  localhost:10428/vmui│
                    └──────────────────────┘
```

## Component Interaction Flow

### Trace Ingestion Flow

```
┌──────────────┐
│ Application  │
│ sends trace  │
└──────┬───────┘
       │
       │ 1. OTLP HTTP POST
       │    http://localhost:4318/v1/traces
       ▼
┌─────────────────────────┐
│ OTEL Collector (Go)     │
│ - Receives trace        │
│ - Minimal processing    │
└──────┬──────────────────┘
       │
       │ 2. Forward to Node wrapper
       │    http://localhost:4319
       ▼
┌─────────────────────────────────────┐
│ Node.js Wrapper                     │
│ - Extract metadata                  │
│ - Route based on source             │
│ - Dispatch to outputs               │
└──────┬──────────────────────────────┘
       │
       ├───────────────┬──────────────────┐
       │               │                  │
       ▼               ▼                  ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────┐
│MessagePort  │ │ HTTPOutput   │ │ HTTPOutput   │
│Output       │ │ (Local VT)   │ │ (Cloud)      │
└─────┬───────┘ └──────┬───────┘ └──────┬───────┘
      │                │                 │
      │                │                 │
      ▼                ▼                 ▼
┌──────────┐  ┌────────────────┐  ┌──────────┐
│ Electron │  │ VictoriaTraces │  │  Remote  │
│ Renderer │  │ Container      │  │  Server  │
│ (UI)     │  │ (Storage)      │  │ (Backup) │
└──────────┘  └────────────────┘  └──────────┘
```

### Settings UI Interaction Flow

```
┌────────────────────────────────────────────────────────────┐
│                  RENDERER PROCESS                          │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  TraceStorageSettings Component                   │     │
│  │  ┌────────────────────────────────────────────┐  │     │
│  │  │  User clicks toggle                         │  │     │
│  │  └────────────┬───────────────────────────────┘  │     │
│  │               │                                   │     │
│  │               │ window.victoriaTraces.start()     │     │
│  │               ▼                                   │     │
│  │  ┌────────────────────────────────────────────┐  │     │
│  │  │  Preload API (contextBridge)                │  │     │
│  │  │  - Exposes safe IPC methods                 │  │     │
│  │  └────────────┬───────────────────────────────┘  │     │
│  └───────────────┼──────────────────────────────────┘     │
│                  │                                         │
└──────────────────┼─────────────────────────────────────────┘
                   │
                   │ IPC: victoria-traces:start
                   │
┌──────────────────▼─────────────────────────────────────────┐
│                  MAIN PROCESS                              │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  IPC Handler                                      │     │
│  │  - Receives start command                         │     │
│  │  - Calls collectorServer.startVictoriaTraces()   │     │
│  └────────────┬───────────────────────────────────┘  │     │
│               │                                       │     │
│               ▼                                       │     │
│  ┌──────────────────────────────────────────────────┐│     │
│  │  VictoriaTracesManager                           ││     │
│  │  1. Check Docker availability                    ││     │
│  │  2. Create/start container                       ││     │
│  │  3. Wait for healthy                             ││     │
│  │  4. Start health monitoring                      ││     │
│  └────────────┬───────────────────────────────────┘ │     │
│               │                                       │     │
│               │ Emit: victoria-traces-status          │     │
│               ▼                                       │     │
│  ┌──────────────────────────────────────────────────┐│     │
│  │  Event Forwarder                                 ││     │
│  │  - Forwards status to all renderer windows       ││     │
│  └────────────┬───────────────────────────────────┘ │     │
└───────────────┼──────────────────────────────────────┘     │
                │                                             │
                │ IPC: victoria-traces:status-update          │
                │                                             │
┌───────────────▼──────────────────────────────────────────┐
│                  RENDERER PROCESS                         │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  TraceStorageSettings Component                   │   │
│  │  - Receives status update                         │   │
│  │  - Updates UI: "Running & Healthy" ✓             │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

## Docker Container Lifecycle

```
┌─────────────────┐
│  User Action    │
│  Toggle ON      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Check: Docker Available?           │
└────────┬───────────────┬────────────┘
         │               │
    YES  │               │  NO
         ▼               ▼
┌─────────────────┐  ┌──────────────────┐
│ Check: Container│  │ Show Error:      │
│ Exists?         │  │ "Install Docker" │
└────┬───────┬────┘  └──────────────────┘
     │       │
 YES │       │ NO
     ▼       ▼
┌─────────┐ ┌────────────────────┐
│ Start   │ │ Pull Image +       │
│ Existing│ │ Create Container   │
└────┬────┘ └──────┬─────────────┘
     │             │
     └──────┬──────┘
            │
            ▼
    ┌───────────────────┐
    │ Container Running │
    └────────┬──────────┘
             │
             ▼
    ┌───────────────────┐
    │ Health Check Loop │
    │ - Every 2 seconds │
    │ - Timeout: 30s    │
    └────────┬──────────┘
             │
       ┌─────┴─────┐
       │           │
   PASS│           │FAIL
       ▼           ▼
┌────────────┐  ┌────────────┐
│ Status:    │  │ Status:    │
│ Running &  │  │ Starting..│
│ Healthy ✓  │  │            │
└────────────┘  └────────────┘
```

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────┐
│              TRACE DATA FLOW                                │
└────────────────────────────────────────────────────────────┘

Incoming Trace
     │
     ▼
┌─────────────────────────────────┐
│ OTLP Payload                    │
│ {                               │
│   resourceSpans: [{             │
│     resource: {...},            │
│     scopeSpans: [{              │
│       spans: [...]              │
│     }]                          │
│   }]                            │
│ }                               │
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Extract Metadata                 │
│ - service.name                   │
│ - service.version                │
│ - dev.server.url (source)        │
└──────────────┬───────────────────┘
               │
               ├─────────────────────────────────┐
               │                                 │
               ▼                                 ▼
    ┌──────────────────────┐         ┌────────────────────┐
    │ MessagePort Output   │         │ HTTP Output        │
    │ (Real-time UI)       │         │ (VictoriaTraces)   │
    └──────────┬───────────┘         └─────────┬──────────┘
               │                               │
               ▼                               ▼
    ┌──────────────────────┐         ┌────────────────────┐
    │ Electron Renderer    │         │ VictoriaTraces     │
    │ - TraceListPanel     │         │ Storage Engine     │
    │ - TraceViewerPanel   │         │ - Indexes traces   │
    │ - Immediate display  │         │ - Persists to disk │
    │ - No persistence     │         │ - Enables queries  │
    └──────────────────────┘         └────────────────────┘
           (Ephemeral)                     (Persistent)
```

## File Structure

```
packages/
└── otel-collector-server/
    ├── src/
    │   ├── services/
    │   │   └── VictoriaTracesManager.ts     ← Docker management
    │   ├── output/
    │   │   ├── TraceOutput.ts               ← Interface
    │   │   ├── ConsoleOutput.ts             ← Existing
    │   │   ├── FileOutput.ts                ← Existing
    │   │   ├── MessagePortOutput.ts         ← Existing
    │   │   └── HTTPOutput.ts                ← NEW
    │   └── OTELCollectorServer.ts           ← Extended

electron-app/
├── src/
│   ├── main/
│   │   ├── ipc/
│   │   │   └── victoria-traces-handlers.ts  ← NEW IPC handlers
│   │   └── preload.ts                       ← Extended API
│   └── renderer/
│       ├── components/
│       │   └── settings/
│       │       └── TraceStorageSettings.tsx ← NEW UI component
│       └── types/
│           └── window.d.ts                  ← Extended types
└── docs/
    ├── VICTORIA_TRACES_LOCAL_STORAGE.md              ← Full docs
    ├── victoria-traces-implementation-guide.md       ← Quick guide
    └── victoria-traces-architecture-diagram.md       ← This file
```

## State Machine: VictoriaTraces Status

```
                    ┌─────────────┐
                    │   STOPPED   │ ◄──────────┐
                    └──────┬──────┘            │
                           │                   │
                   User clicks toggle          │
                           │                   │
                           ▼                   │
                    ┌─────────────┐            │
                    │  STARTING   │            │
                    └──────┬──────┘            │
                           │                   │
                    Health checks              │
                           │                   │
              ┌────────────┼────────────┐      │
              │            │            │      │
         PASS │            │ TIMEOUT    │      │
              ▼            ▼            │      │
       ┌─────────────┐ ┌─────────┐     │      │
       │   RUNNING   │ │  ERROR  │     │      │
       └──────┬──────┘ └────┬────┘     │      │
              │             │           │      │
        Continuous          │           │      │
        monitoring          │           │      │
              │             │           │      │
         ┌────┴────┐        │           │      │
         │         │        │           │      │
    PASS │         │ FAIL   │           │      │
         │         ▼        ▼           │      │
         │    ┌─────────────────┐       │      │
         │    │ UNHEALTHY       │       │      │
         │    └────────┬────────┘       │      │
         │             │                │      │
         │       Auto-recovery          │      │
         │       attempts               │      │
         │             │                │      │
         │             ▼                │      │
         │      [Back to checks]        │      │
         │                              │      │
         └──────────────────────────────┘      │
                                               │
              User clicks toggle               │
                                               │
                    ┌──────────────────────────┘
                    │
                    ▼
              [Stop container]
```

## Deployment View

```
┌──────────────────────────────────────────────────────────────┐
│                   USER'S MACHINE                              │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Principal ADE.app                                     │  │
│  │  - Electron app bundle                                 │  │
│  │  - OTEL Collector binary (~300MB)                      │  │
│  │  - Node.js wrapper                                     │  │
│  │  - UI components                                       │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                      │
│                       │ Manages via Docker API               │
│                       ▼                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Docker Desktop                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Container: principal-victoria-traces            │ │  │
│  │  │  - Image: victoriametrics/victoria-traces:latest │ │  │
│  │  │  - Ports: 10428:10428, 4317:4317                │ │  │
│  │  │  - Volume: principal-victoria-traces-data        │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  File System                                           │  │
│  │  /var/lib/docker/volumes/                             │  │
│  │    └─ principal-victoria-traces-data/                 │  │
│  │       ├─ cache/ (indexes)                             │  │
│  │       ├─ indexdb/ (trace index)                       │  │
│  │       └─ snapshots/ (data files)                      │  │
│  │                                                         │  │
│  │  Storage grows with traces                             │  │
│  │  Retention: 7 days (configurable)                      │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

**See Also:**
- [Full Documentation](./VICTORIA_TRACES_LOCAL_STORAGE.md)
- [Implementation Guide](./victoria-traces-implementation-guide.md)
- [OTEL Integration](./DEV_WORKSPACE_OTEL_INTEGRATION.md)
