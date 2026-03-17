# Instrumentation Scopes

This document defines the OpenTelemetry instrumentation scopes for the Principal ADE application.

## What is a Scope?

An **instrumentation scope** in OpenTelemetry identifies the boundary where trace context must be explicitly propagated. In practice, this means **process boundaries**:

- Traces flow automatically within a process
- Traces require explicit context propagation (baggage) to cross process boundaries

## Scopes

### Production Scopes

| Scope | Process | Runtime | Description |
|-------|---------|---------|-------------|
| `principal-ade` | Electron main | Node.js | Core application logic, IPC handlers, services |
| `principal-ade-renderer` | Electron renderer | Chromium | React UI, user interactions, panels |
| `principal-ade-daemon` | PTY daemon | Node.js | Persistent terminal sessions, PTY management |

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

### principal-ade (Main Process)
- `window.*` - Window lifecycle
- `project.*` - Project operations
- `fs.*` - File system operations
- `app.update.*` - Application updates
- `mcp.*` - Model Context Protocol
- `terminal.session.*` - Session management (main side)
- `ipc.handle.*` - IPC request handlers

### principal-ade-renderer (Renderer Process)
- `terminal.panel.*` - Terminal UI
- `quality.panel.*` - Quality analysis UI
- `trace.viewer.*` - Trace visualization
- `devworkspace.*` - Workspace UI
- `alexandria.*` - Knowledge base UI
- `ipc.invoke.*` - IPC requests to main

### principal-ade-daemon (Daemon Process)
- `terminal.daemon.*` - Daemon lifecycle
- `terminal.pty.*` - PTY operations

## Migration from Old Scopes

The previous architecture defined ~20 logical "scopes" that were actually just namespaces within the same process. These have been consolidated:

| Old Scope | New Location |
|-----------|--------------|
| `terminal-activity` | `principal-ade` spans |
| `terminal-session` | `principal-ade` spans |
| `window-manager` | `principal-ade` `window.*` spans |
| `quality-panel` | `principal-ade-renderer` spans |
| `trace-viewer` | `principal-ade-renderer` spans |
| `terminal.daemon` | `principal-ade-daemon` spans |
