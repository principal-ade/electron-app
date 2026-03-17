# Span Naming Conventions

This document defines the OpenTelemetry span naming conventions for the Principal ADE application.

## Scope Boundaries

Spans are organized by **instrumentation scope**, which maps to process boundaries:

| Scope | Process | Runtime |
|-------|---------|---------|
| `principal-ade` | Electron main process | Node.js |
| `principal-ade-renderer` | Electron renderer process | Chromium |
| `principal-ade-daemon` | PTY daemon process | Node.js |

Traces can only cross scope boundaries through explicit **context propagation**:
- **Renderer → Main**: IPC messages include `traceparent` in metadata
- **Main → Daemon**: Unix socket messages include trace context
- **Main → External**: HTTP headers (`traceparent`, `tracestate`)

## Span Categories

### Lifecycle Spans
Operations with clear start/end that manage resource lifecycles:
- `window.create`, `window.close`
- `terminal.session.create`, `terminal.session.destroy`
- `app.update.check`, `app.update.download`, `app.update.install`
- `project.open`

### IO Spans
File system and data transfer operations:
- `fs.read`, `fs.write`, `fs.tree.build`
- `terminal.pty.write`, `terminal.pty.resize`

### IPC Spans
Inter-process communication:
- `ipc.invoke.*` (client, renderer → main)
- `ipc.handle.*` (server, main process handler)

## Span Kind

Following OpenTelemetry conventions:
- **internal**: In-process operations with no remote component
- **client**: Outgoing request (IPC invoke, HTTP request, socket message)
- **server**: Incoming request handler (IPC handle, daemon socket handler)

## Naming Pattern

```
<domain>.<operation>[.<detail>]
```

Examples:
- `terminal.session.create` - domain: terminal, operation: session.create
- `ipc.handle.fileSystem` - domain: ipc, operation: handle, detail: channel name
- `app.update.check` - domain: app, operation: update.check
