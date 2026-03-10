# Event Processing Server

The Event Processing Server handles real-time agent session events from coding assistants like Claude Code, Cline, OpenCode, and Droid. It runs as an Electron utility process to isolate event processing from the main process.

## What Problem Does This Solve?

Coding agents emit events during their operation (session start/stop, tool usage, file access, etc.). The Event Processing Server:

- **Receives events** from multiple agent providers via HTTP webhooks
- **Normalizes events** through the AgentEventPipeline to a universal format
- **Enriches events** with git repository context (owner, repo, branch)
- **Broadcasts updates** to renderer windows for real-time UI updates
- **Isolates processing** in a utility process to avoid blocking the main process

## Architecture Overview

```
External Agents (Claude, Cline, OpenCode, Droid)
          |
          | HTTP POST to webhook endpoints
          v
    HttpEventServer (Utility Process)
          |
          | processRawEvent()
          v
    AgentEventPipeline (@principal-ai/agent-monitoring)
          |
          | normalize & enrich
          v
    ServerPathNormalizationAdapter
          |
          | getRepoInfo()
          v
    GitRepoCache (LRU cache)
          |
          | broadcast via IPC
          v
    EventServerManager (Main Process)
          |
          | SESSION_UPDATED / MessagePort
          v
    Renderer Windows (Real-time UI)
```

## HTTP Endpoints

The server exposes endpoints for each supported agent:

| Endpoint | Agent | Port |
|----------|-------|------|
| `POST /claude-hook` | Claude Code | 3043 (prod) / 3045 (dev) |
| `POST /cline-hook` | Cline | 3043 (prod) / 3045 (dev) |
| `POST /opencode-hook` | OpenCode | 3043 (prod) / 3045 (dev) |
| `POST /droid-hook` | Droid | 3043 (prod) / 3045 (dev) |
| `GET /health` | Health check | 3043 (prod) / 3045 (dev) |

## Key Components

### EventServerManager (Main Process)
- Spawns and manages the utility process
- Handles port registration for direct event delivery
- Broadcasts SESSION_UPDATED events to all windows
- Implements auto-restart on crash (configurable)

### HttpEventServer (Utility Process)
- Express-based HTTP server
- Routes events to appropriate handlers per agent
- Returns processing duration in response

### AgentEventPipeline
- From `@principal-ai/agent-monitoring` package
- Parses provider-specific event formats
- Normalizes to `RepoNormalizedUniversalAgentSessionEvent`
- Tracks metrics (processing time, error count)

### ServerPathNormalizationAdapter
- Resolves absolute paths to git repository context
- Extracts owner/repo from remote URL
- Caches repository info by git root

### GitRepoCache
- LRU-style cache for repository lookups
- Avoids repeated `git rev-parse` calls
- Maps directories to their git roots

## Event Flow

1. **Agent sends event** - Agent POSTs JSON to webhook endpoint
2. **HTTP handler receives** - Express route validates and passes to pipeline
3. **Pipeline processes** - Raw event normalized to universal format
4. **Path adapter enriches** - Git repository context added
5. **Server broadcasts** - WINDOW_BROADCAST message sent to main
6. **Manager distributes** - Main process sends to all renderer windows
7. **UI updates** - Renderer receives SESSION_UPDATED event

## Configuration

Environment variables:
- `NODE_ENV` - `production` uses port 3043, development uses 3045
- `DEBUG_EVENT_SERVER=true` - Enable debug logging

EventServerManager config:
```typescript
{
  autoStart: true,        // Start with app
  restartOnCrash: true,   // Auto-restart on failure
  maxRestartAttempts: 3,  // Restart limit
  logLevel: 'info'        // Log verbosity
}
```

## Port Registration

Windows can register MessagePorts for direct event delivery filtered by repository:

```typescript
// Main process registers port
manager.registerPortForWindow(windowId, repository, webContents);

// Creates MessageChannel, transfers:
// - port1 -> utility process
// - port2 -> renderer via EVENT_PORT_READY
```

## Error Handling

- Pipeline errors increment error counter, don't crash server
- Slow processing (>100ms) logged as warning
- HTTP 500 returned on processing failure with error message
- Worker exit triggers automatic restart with exponential backoff

## Statistics

The server tracks:
- `processedEvents` - Total events processed
- `errors` - Total error count
- `uptime` - Server uptime in milliseconds
- `averageProcessingTime` - Mean processing duration
- `lastProcessedEvent` - Timestamp of last event
- `gitCache` - Cache hit statistics
