# Terminal MessagePort Mode

## Overview

The terminal system now supports an optional MessagePort architecture for direct PTY data streaming between the main process and renderers, bypassing the traditional IPC overhead for each data chunk.

## Architecture

### Phase 1 (Current): MessageChannels with PTY in Main Process

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  PTY Process    │         │ MessageChannel   │         │  Renderer       │
│  (Main Process) │         │                  │         │  (xterm.js)     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                           │                              │
        │ onData                    │                              │
        ├──────────────────────────>│ port1.postMessage           │
        │                           ├─────────────────────────────>│
        │                           │                     port2.on('message')
        │                           │                              │
        │                           │<─────────────────────────────┤
        │                           │ port2.postMessage   write/resize
        │<──────────────────────────┤
        │ PTY.write/resize          │
```

**Benefits over Legacy IPC:**
- Reduces main process event loop pressure
- Lower latency for high-frequency PTY data
- Prepares infrastructure for Phase 2 (worker process)

### Phase 2 (Future): PTY in Worker Process

In Phase 2, PTY processes will move to an Electron `utilityProcess`, achieving true process isolation while maintaining the same MessageChannel interface.

## Enabling MessagePort Mode

MessagePort mode is controlled by a feature flag and is **enabled by default** in the current implementation.

### Method 1: Disabling MessagePort Mode

To disable MessagePort mode and use legacy IPC instead:

```bash
export TERMINAL_ENABLE_MESSAGE_PORTS=false
npm start
```

Or in development:

```bash
TERMINAL_ENABLE_MESSAGE_PORTS=false npm run start
```

### Method 2: Runtime Configuration (for testing)

For testing purposes, you can modify the configuration at runtime (requires code change):

```typescript
import { setTerminalConfig } from './main/terminal/config';

setTerminalConfig({
  enableMessagePorts: true,
});
```

## How It Works

### Session Creation Flow

1. **Renderer requests terminal session**
   ```typescript
   const sessionId = await window.api.terminal.getOrCreate(directory, context);
   ```

2. **Main process creates session**
   - Spawns PTY process
   - If `enableMessagePorts=true`:
     - Creates `MessageChannelMain`
     - Transfers `port2` to renderer via `PORT_READY` event
     - Keeps `port1` for PTY data streaming

3. **Renderer receives MessagePort**
   ```typescript
   window.api.terminal.onPortReady((data, port) => {
     console.log(`Port ready for session: ${data.sessionId}`);

     // Listen for PTY data
     port.on('message', (event) => {
       const message = event.data;
       if (message.type === 'DATA') {
         terminal.write(message.data);
       }
     });

     // Send write commands
     port.postMessage({ type: 'WRITE', data: 'ls\r' });

     // Send resize commands
     port.postMessage({ type: 'RESIZE', cols: 80, rows: 24 });
   });
   ```

### Data Flow

**PTY Output (Main → Renderer):**
1. PTY emits data via `onData` event
2. Main process: `port1.postMessage({ type: 'DATA', data })`
3. Renderer: `port2.on('message')` receives data
4. Renderer writes to xterm.js

**User Input (Renderer → Main):**
1. User types in xterm.js
2. Renderer: `port2.postMessage({ type: 'WRITE', data })`
3. Main process: `port1.on('message')` receives command
4. Main process: `pty.write(data)`

### Fallback Behavior

- If MessagePort creation fails, the system automatically falls back to legacy IPC
- Legacy IPC path remains active and unchanged
- No user-visible difference if MessagePorts fail

## Monitoring and Debugging

### Console Logs

Enable debug logs to monitor MessagePort activity:

```javascript
// Main process
[Terminal] Created MessageChannel for session abc-123
[Terminal] Transferred port2 to window 1 for session abc-123

// Renderer
[TerminalAPI] Received MessagePort for session: abc-123
```

### Configuration Status

Check current configuration:

```typescript
import { terminalConfig } from './main/terminal/config';

console.log('MessagePorts enabled:', terminalConfig.enableMessagePorts);
console.log('Max sessions:', terminalConfig.maxSessions);
```

## Configuration Options

```typescript
interface TerminalConfig {
  // Enable MessagePort architecture
  enableMessagePorts: boolean;

  // Maximum concurrent terminal sessions
  maxSessions: number;

  // Output buffer size (for future replay feature)
  outputBufferSize: number;
}
```

**Defaults:**
- `enableMessagePorts`: `true`
- `maxSessions`: `20`
- `outputBufferSize`: `1000`

**Environment Variables:**
- `TERMINAL_ENABLE_MESSAGE_PORTS`: `'false'` to disable (enabled by default)
- `TERMINAL_MAX_SESSIONS`: Number (e.g., `'50'`)
- `TERMINAL_BUFFER_SIZE`: Number (e.g., `'2000'`)

## Compatibility

### Supported

- All existing terminal features work with MessagePorts
- Session reuse by directory/context
- Ownership tracking and management
- Multi-window terminal sessions
- Pop-out terminal windows

### Legacy IPC Fallback

The legacy IPC path is always available as a fallback:

```typescript
// This still works even with MessagePorts enabled
window.api.terminal.onDataForSession(sessionId, (data) => {
  terminal.write(data);
});
```

## Performance Considerations

### When to Enable

**Good candidates:**
- High-frequency terminal output (build logs, test runners)
- Long-running terminal sessions
- Multiple concurrent terminal sessions
- Systems with high main process load

**May not see benefits:**
- Single terminal with low output frequency
- Short-lived terminal sessions
- Systems with low overall load

### Metrics to Monitor

- Main process CPU usage
- IPC message queue depth
- Terminal data latency
- Memory usage per session

## Troubleshooting

### MessagePort not received

**Check:**
1. Is `enableMessagePorts` flag set to `true`?
2. Check console for errors during channel creation
3. Verify window ID is valid when port is transferred

**Debug:**
```javascript
window.api.terminal.onPortReady((data, port) => {
  if (!port) {
    console.error('Port is null/undefined');
    return;
  }
  console.log('Port received successfully:', data);
});
```

### Data not flowing through port

**Check:**
1. Is `port.start()` called? (automatically done by Electron)
2. Are you listening for 'message' events?
3. Check message format: `{ type: 'DATA', data: '...' }`

**Debug:**
```javascript
port.on('message', (event) => {
  console.log('Message received:', event.data);
});

port.on('messageerror', (event) => {
  console.error('Message error:', event);
});
```

### Fallback to legacy IPC

If MessagePort fails, the system automatically uses legacy IPC. Check console for:

```
[Terminal] Failed to send data via MessagePort for session XXX: <error>
```

This indicates fallback is active and you should investigate the MessagePort error.

## Future Enhancements

### Phase 2: Worker Process

Moving PTY to `utilityProcess` will provide:
- True process isolation
- Better main process performance
- Crash isolation (PTY crashes don't affect main)
- Same MessageChannel interface (no renderer changes)

### Planned Features

- Output buffering and replay for late subscribers
- Ownership tokens validated at worker level
- Multiple PTY workers for load distribution
- Automatic worker restart on crash

## Related Documentation

- [Terminal MessagePort Design](./terminal-message-port-design.md) - Architecture proposal
- [Terminal Architecture](./PANEL_ARCHITECTURE.md) - Overall terminal design
- [Terminal Implementation Guide](./PANEL_IMPLEMENTATION_GUIDE.md) - Developer guide
