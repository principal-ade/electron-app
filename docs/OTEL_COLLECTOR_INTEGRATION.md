# OpenTelemetry Collector Integration

## Overview

This document describes the OpenTelemetry (OTEL) Collector integration in Principal ADE, including trace collection, visualization, and future plans for associating traces with repositories and development servers.

---

## What We Built

### 1. OTEL Collector Service

**Location:** `src/main/services/OtelCollectorService.ts`

A singleton service that manages the OpenTelemetry Collector binary and handles trace collection.

**Key Features:**
- Runs OTEL Collector binary (bundled with the app)
- Receives OTLP traces on port 4318
- Forwards traces to wrapper server on port 4319
- Stores last 50 traces in memory
- Provides IPC API for renderer process

**Binary Management:**
- Development: Binaries located in `resources/bin/`
- Production: Binaries bundled in app resources
- Platform-specific binaries for macOS, Linux, Windows
- Auto-downloaded via `npm run download:otel`

### 2. Trace Storage & Retrieval

**Storage Format:**
```typescript
interface StoredTrace {
  timestamp: number;
  traceId: string;
  data: any; // OTLP trace data
}
```

**Methods:**
- `storeTrace(traceData)` - Store incoming trace
- `getTraces(limit?)` - Retrieve stored traces
- `clearTraces()` - Clear all traces
- `extractTraceId(traceData)` - Extract trace ID from OTLP data

**Retention:**
- Stores up to 50 traces (MAX_TRACES constant)
- Newest traces added to beginning of array
- Older traces automatically removed

### 3. UI Components

#### System Monitor Tab Selector
**Location:** `src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx`

Two tabs:
- **Repository Monitoring** - File system monitoring, resource usage
- **OTEL Collector** - Trace collection and visualization

#### Trace Viewer
**Location:** `src/renderer/principal-window/views/SystemMonitor/TraceViewer.tsx`

**Features:**
- Auto-refresh every 2 seconds
- Group traces by source URL
- Collapsible source groups
- Click to view full trace details
- Refresh and Clear buttons

**Source Extraction:**
1. Looks for `dev.server.url` attribute (e.g., "http://localhost:3000")
2. Falls back to `service.name` attribute
3. Defaults to "Unknown Source"

---

## Architecture

### Data Flow

```
External App (instrumented with OTEL SDK)
         ↓
    HTTP POST /v1/traces (OTLP)
         ↓
OpenTelemetry Collector (Go binary - port 4318)
         ↓
    Forwards to Wrapper Server (port 4319)
         ↓
OtelCollectorService.storeTrace()
         ↓
    In-memory storage (last 50 traces)
         ↓
IPC API → Renderer Process
         ↓
    TraceViewer Component (UI)
```

### IPC Handlers

**Location:** `src/main/services/ipc/otelCollectorHandlers.ts`

Available handlers:
- `otel-collector:start` - Start collector
- `otel-collector:stop` - Stop collector
- `otel-collector:getStatus` - Get running status and stats
- `otel-collector:sendTestTrace` - Send test trace
- `otel-collector:getTraces` - Retrieve stored traces
- `otel-collector:clearTraces` - Clear all traces
- `otel-collector:registerPort` - Register MessagePort for trace delivery
- `otel-collector:unregisterPort` - Unregister port
- `otel-collector:unregisterWindow` - Unregister all ports for window

### Package Dependencies

**OTEL Collector Server:**
- `@principal-ai/otel-collector-server@0.1.2`
  - Wrapper around OTEL Collector binary
  - Electron mode support
  - MessagePort routing (for future use)

**Trace Visualization:**
- `@evilmartians/agent-prism-data@^0.1.x` - OTLP data adapter
- `@evilmartians/agent-prism-types@^0.1.x` - TypeScript types

**Note:** We use AgentPrism's data adapter but built our own simple UI instead of using their full component library.

---

## Binary Distribution

### Download Script

**Location:** `scripts/download-otel-binaries.js`

Downloads OTEL Collector v0.144.0 binaries for all platforms:
- macOS Intel: `otelcol_darwin_amd64` (332MB)
- macOS Apple Silicon: `otelcol_darwin_arm64` (308MB)
- Linux x64: `otelcol_linux_amd64` (325MB)
- Linux ARM64: `otelcol_linux_arm64` (299MB)
- Windows x64: `otelcol_windows_amd64.exe` (330MB)

**Build Integration:**
```json
"download:otel": "node scripts/download-otel-binaries.js",
"download:binaries": "npm run download:act && npm run download:otel",
"build": "... && npm run download:binaries && ..."
```

### Bundling

Binaries are bundled with the app via electron-builder:

**package.json:**
```json
"extraResources": [
  "./assets/**",
  {
    "from": "resources/bin",
    "to": "bin",
    "filter": ["**/*"]
  }
]
```

---

## Current Limitations

### 1. No Repository Association

**Problem:** Traces are not currently associated with specific repositories or projects.

**Current State:**
- Traces grouped by source URL (e.g., "http://localhost:3000")
- Source extracted from OTLP attributes
- No link to which repository/project the dev server belongs to

### 2. Manual Source Identification

**Problem:** Users must manually identify which source corresponds to which project.

**Current State:**
- Source URL shows generic localhost URLs
- No visual indication of which repo is being traced
- Multiple dev servers on different ports are treated as separate sources

### 3. Limited Trace Context

**Problem:** Traces lack contextual information about the development environment.

**Missing Context:**
- Repository name
- Branch name
- Project type (React, Node.js, etc.)
- Dev server framework (Vite, Next.js, etc.)
- Git commit hash

---

## Future Enhancements

### 1. Repository-Trace Association

**Goal:** Automatically associate traces with repositories being monitored.

**Approach A: Server Registration**
When a dev server starts, register it with Principal ADE:

```typescript
interface DevServerRegistration {
  serverUrl: string;          // http://localhost:3000
  repositoryPath: string;     // /path/to/repo
  repositoryName: string;     // my-project
  framework?: string;         // vite, next, create-react-app
  startTime: number;
  pid?: number;
}
```

**Implementation:**
1. Detect dev server start via process monitoring or file watching
2. Register server → repo mapping
3. When trace arrives, look up repo by source URL
4. Display repo name/icon next to trace source

**Approach B: OTLP Resource Attributes**
Instrument dev servers to include repo metadata in traces:

```typescript
// In dev server OTEL SDK configuration
resource: {
  attributes: {
    'dev.server.url': 'http://localhost:3000',
    'repo.path': '/Users/dev/my-project',
    'repo.name': 'my-project',
    'repo.branch': 'main',
    'repo.commit': 'abc123...',
  }
}
```

**Benefits:**
- Traces carry their own context
- No registration needed
- Works for remote servers too

**Challenges:**
- Requires instrumenting each dev server
- Need standardized attribute names
- Existing apps won't have this metadata

### 2. Localhost Panel Integration

**Goal:** Link traces to running dev servers in Localhost Panel.

**Proposed Flow:**
1. User opens Localhost Panel
2. Sees list of running dev servers with ports
3. Each server shows:
   - Repository name
   - Framework/technology
   - Port number
   - **NEW:** Trace count badge
4. Click server → Opens OTEL Collector tab filtered to that source
5. Click "View Traces" → Shows only traces from that dev server

**Data Structure:**
```typescript
interface LocalhostServer {
  id: string;
  repositoryId: string;
  repositoryName: string;
  url: string;              // http://localhost:3000
  port: number;
  framework: string;
  status: 'running' | 'stopped';
  traceCount: number;       // NEW
  lastTraceTime?: number;   // NEW
}
```

### 3. Repository Panel Trace Visualization

**Goal:** Show traces directly in Repository Monitoring panel.

**Proposed Features:**
- Add "Traces" tab to repository details
- Show traces filtered by repository
- Display trace timeline alongside git history
- Link trace events to code commits

**Example UI:**
```
Repository: my-web-app
├─ Files (123)
├─ Git Status (main)
├─ Dependencies (45 packages)
└─ Traces (NEW)
    ├─ http://localhost:3000 (12 traces)
    ├─ http://localhost:3001 (5 traces)
    └─ API Requests (8 traces)
```

### 4. Enhanced Source Attribution

**Goal:** Better identify and label trace sources.

**Proposed Enhancements:**

A. **Service Discovery:**
   - Scan for running processes on common dev server ports
   - Match process working directory to monitored repos
   - Auto-label sources with repo names

B. **Smart Source Labeling:**
   ```
   Instead of: "http://localhost:3000"
   Show:       "my-web-app (localhost:3000)"
               [React icon] Frontend Server
   ```

C. **Framework Detection:**
   - Detect framework from package.json
   - Show appropriate icon (React, Vue, Next.js, etc.)
   - Include framework version

D. **Repository Context:**
   ```typescript
   interface EnhancedSource {
     url: string;
     repository?: {
       name: string;
       path: string;
       branch: string;
       framework: string;
       icon: string;
     };
     processInfo?: {
       pid: number;
       command: string;
       startTime: number;
     };
   }
   ```

### 5. Trace-to-Code Navigation

**Goal:** Jump from trace to relevant code.

**Proposed Features:**
- Extract file paths from trace span attributes
- Link spans to source files in editor
- Highlight trace events in code timeline
- Show traces when viewing specific files

**Example:**
```
Trace Span: "API Handler - /api/users"
  ↓
Attributes:
  - code.filepath: "src/api/users.ts"
  - code.function: "getUsers"
  - code.lineno: 42
  ↓
Click → Opens file in Monaco editor at line 42
```

### 6. Multi-Repository Tracing

**Goal:** Trace requests across multiple microservices.

**Scenario:**
```
Frontend (localhost:3000)
    ↓ API call
Backend (localhost:4000)
    ↓ Database query
Database (localhost:5432)
```

**Proposed Features:**
- Distributed trace visualization
- Show trace spans across all services
- Link services to their respective repos
- Display service dependency graph

### 7. Trace Filtering & Search

**Goal:** Find specific traces easily.

**Proposed Filters:**
- By repository
- By time range
- By trace status (success/error)
- By duration (slow traces)
- By custom attributes

**Search Features:**
- Search span names
- Search attribute values
- Regex support
- Saved searches

---

## Technical Considerations

### Repository Detection Strategies

**1. Process Monitoring:**
- Monitor child processes spawned from terminal
- Track working directory of each process
- Match port bindings to process IDs

**2. File System Watching:**
- Watch for package.json changes
- Detect dev server config files
- Monitor .git directory for active development

**3. Network Port Scanning:**
- Scan common dev server ports (3000-9000)
- Make HTTP requests to detect server type
- Parse server response headers for framework info

**4. OTEL SDK Integration:**
- Provide Principal ADE OTEL SDK package
- Auto-inject repo metadata
- Standardize attribute naming

### Data Persistence

**Current:** In-memory only (lost on restart)

**Future Options:**

A. **SQLite Database:**
```sql
CREATE TABLE traces (
  id TEXT PRIMARY KEY,
  timestamp INTEGER,
  source_url TEXT,
  repository_id TEXT,
  data BLOB
);

CREATE TABLE dev_servers (
  id TEXT PRIMARY KEY,
  repository_id TEXT,
  url TEXT,
  framework TEXT,
  status TEXT,
  started_at INTEGER
);
```

B. **File-Based Storage:**
- JSONL files per repository
- Compressed for space efficiency
- Indexed for fast lookup

C. **Hybrid Approach:**
- Recent traces in memory (fast)
- Older traces in SQLite (persistent)
- Archive old traces to files (storage)

---

## Implementation Roadmap

### Phase 1: Basic Association (Completed ✓)
- [x] OTEL Collector integration
- [x] Trace storage
- [x] Source-based grouping
- [x] UI for viewing traces

### Phase 2: Repository Linking (Next)
- [ ] Define DevServerRegistration interface
- [ ] Implement process monitoring for dev servers
- [ ] Create server → repo mapping system
- [ ] Update TraceViewer to show repo names
- [ ] Add repo context to stored traces

### Phase 3: Localhost Panel Integration
- [ ] Add trace count to server status
- [ ] Link from Localhost Panel to OTEL tab
- [ ] Filter traces by selected server
- [ ] Show framework/technology icons

### Phase 4: Advanced Features
- [ ] Trace persistence (SQLite)
- [ ] Search and filtering
- [ ] Trace-to-code navigation
- [ ] Multi-repo distributed tracing
- [ ] Performance analytics

### Phase 5: OTEL SDK Package
- [ ] Create @principal-ade/otel-sdk package
- [ ] Auto-inject repo metadata
- [ ] Framework-specific integrations
- [ ] Documentation and examples

---

## Configuration

### OTEL Collector Endpoints

**OTLP HTTP:** `http://localhost:4318/v1/traces`
- Standard OTLP endpoint for receiving traces
- Accepts JSON or Protobuf format
- CORS enabled for localhost

**Wrapper Server:** `http://localhost:4319/v1/traces`
- Internal endpoint for trace forwarding
- Not exposed to external applications
- Handles trace storage and routing

### Instrumentation Example

To send traces to Principal ADE from your dev server:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  resource: {
    attributes: {
      'service.name': 'my-app',
      'dev.server.url': 'http://localhost:3000',
      // Future: Add repo metadata
      // 'repo.name': 'my-project',
      // 'repo.path': '/path/to/repo',
    },
  },
});

sdk.start();
```

---

## Resources

### Documentation
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [AgentPrism GitHub](https://github.com/evilmartians/agent-prism)

### Internal Files
- Service: `src/main/services/OtelCollectorService.ts`
- IPC Handlers: `src/main/services/ipc/otelCollectorHandlers.ts`
- UI Component: `src/renderer/principal-window/views/SystemMonitor/TraceViewer.tsx`
- Download Script: `scripts/download-otel-binaries.js`

### Package Changes
- Added: `@principal-ai/otel-collector-server@0.1.2`
- Added: `@evilmartians/agent-prism-data`
- Added: `@evilmartians/agent-prism-types`

---

## Troubleshooting

### Binary Not Found Error

**Error:**
```
OpenTelemetry Collector binary not found at /path/to/binary
```

**Solution:**
```bash
npm run download:otel
```

### Traces Not Appearing

**Check:**
1. OTEL Collector is running (check status in UI)
2. Dev server is instrumented with OTEL SDK
3. Traces being sent to `http://localhost:4318/v1/traces`
4. Check browser console for errors
5. Verify trace format is valid OTLP JSON

### Port Already in Use

**Error:**
```
Failed to start: Address already in use (port 4318 or 4319)
```

**Solution:**
1. Stop other OTEL collectors
2. Kill process using the port: `lsof -ti:4318 | xargs kill -9`
3. Restart OTEL Collector in Principal ADE

---

## Contributing

When making changes to the OTEL Collector integration:

1. **Test with real traces:** Use the "Send Test Trace" button
2. **Test grouping:** Send traces from different sources
3. **Test persistence:** Verify traces survive refresh
4. **Check memory usage:** Monitor with 50+ traces stored
5. **Update this doc:** Document new features or changes

---

## Future Discussion Points

1. **Should we use SQLite for persistence?**
   - Pros: Persistent across restarts, queryable
   - Cons: Disk I/O, complexity

2. **How to handle multi-repo monorepos?**
   - Single OTEL collector for all services?
   - Separate collectors per service?

3. **Privacy & Security:**
   - Should we store trace data containing sensitive info?
   - Do we need trace data encryption?
   - Should users opt-in to trace collection?

4. **Performance:**
   - What's the impact of storing 50 traces?
   - Should we have configurable limits?
   - Do we need trace sampling?

5. **Integration with existing features:**
   - How to link traces to git commits?
   - How to show traces in Alexandria docs?
   - Can we use traces for code intelligence?

---

**Last Updated:** January 29, 2026
**Version:** 0.1.0
**Status:** Active Development
