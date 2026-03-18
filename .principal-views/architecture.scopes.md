# Instrumentation Scopes

This document defines the OpenTelemetry instrumentation scopes for the Principal ADE application.

## What is a Scope?

An **instrumentation scope** in OpenTelemetry identifies the boundary where trace context must be explicitly propagated. In practice, this means **process boundaries**:

- Traces flow automatically within a process
- Traces require explicit context propagation (baggage) to cross process boundaries

## Scopes

### Process Scopes

| Scope | Process | Runtime | Description |
|-------|---------|---------|-------------|
| `principal-ade-main` | Electron main | Node.js | Core application logic, IPC handlers, services |
| `principal-ade-daemon` | PTY daemon | Node.js | Persistent terminal sessions, PTY management |
| `principal-ade-event-processor` | Utility process | Node.js | Agent session event processing |

### Window Scopes (Renderer Processes)

| Scope | Window | Description |
|-------|--------|-------------|
| `principal-ade-principal-window` | Principal Window | Main app shell with auth, workspaces, settings |
| `principal-ade-dev-workspace` | Dev Workspace | Development environment with panels and terminal |
| `principal-ade-alexandria` | Alexandria | Knowledge base and code exploration workspace |
| `principal-ade-extension` | Extension Window | Browser extension host |
| `principal-ade-splash-screen` | Splash Screen | App loading screen |
| `principal-ade-window-switcher` | Window Switcher | Quick window navigation overlay |
| `principal-ade-quick-open` | Quick Open | Command palette overlay |

### Development Scopes

| Scope | Description |
|-------|-------------|
| `principal-ade-storybook` | UI component development environment |
| `principal-ade-tests` | Integration test suite |

### External Boundaries

| Boundary | Protocol | Context Propagation |
|----------|----------|---------------------|
| GitHub API | HTTPS | W3C `traceparent` header |
| Agent connections | HTTP | W3C `traceparent` header |

## Context Propagation

### Renderer → Main Process
- **Mechanism**: IPC invoke/send
- **Context**: `traceparent` in IPC message metadata
- **Spans**: `ipc.invoke.*` (client) → `ipc.handle.*` (server)

### Main Process → Daemon
- **Mechanism**: Unix socket messages
- **Context**: `traceparent` in message payload
- **Spans**: `terminal.session.connect` (client) → `terminal.daemon.client.connect` (server)

### Main Process → External Services
- **Mechanism**: HTTP requests
- **Context**: W3C `traceparent` and `tracestate` headers
- **Example**: `app.update.check` span includes outbound HTTP to GitHub

## Span Namespaces by Scope

Spans are organized into namespaces within each scope:

### principal-ade-main (Main Process)
- `window.*` - Window lifecycle
- `project.*` - Project operations
- `fs.*` - File system operations
- `app.update.*` - Application updates
- `mcp.*` - Model Context Protocol
- `terminal.session.*` - Session management (main side)
- `ipc.handle.*` - IPC request handlers

### principal-ade-daemon (Daemon Process)
- `terminal.daemon.*` - Daemon lifecycle
- `terminal.pty.*` - PTY operations

### principal-ade-event-processor (Event Processor)
- `event.*` - Event processing
- `agent.*` - Agent session events

### principal-ade-dev-workspace (Dev Workspace)
- `devworkspace.*` - Workspace UI
- `terminal.panel.*` - Terminal panel UI
- `ipc.invoke.*` - IPC requests to main

### principal-ade-alexandria (Alexandria)
- `alexandria.*` - Knowledge base UI
- `quality.panel.*` - Quality analysis UI
- `ipc.invoke.*` - IPC requests to main

### principal-ade-principal-window (Principal Window)
- `trace.viewer.*` - Trace visualization
- `ipc.invoke.*` - IPC requests to main

## Migration from Old Scopes

The previous architecture defined ~20 logical "scopes" that were actually just namespaces within the same process. These have been consolidated:

| Old Scope | New Location |
|-----------|--------------|
| `terminal-activity` | `principal-ade-main` spans |
| `terminal-session` | `principal-ade-main` spans |
| `window-manager` | `principal-ade-main` `window.*` spans |
| `quality-panel` | `principal-ade-alexandria` spans |
| `trace-viewer` | `principal-ade-principal-window` spans |
| `terminal.daemon` | `principal-ade-daemon` spans |
| `devworkspace` | `principal-ade-dev-workspace` spans |
| `principal-ade-utility` | `principal-ade-event-processor` spans |
