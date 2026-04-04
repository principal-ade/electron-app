# CLI Bridge Worker

The CLI Bridge is a worker process system that executes CLI commands (git, npm, etc.) in a separate Electron `utilityProcess`, keeping the main process responsive.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Main Process  │────▶│    CLIBridge     │────▶│ Universal Worker│
│                 │     │  (orchestrator)  │     │  (utilityProc)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
   Consumers:              IPC Messages:            Executes:
   - gitClientFactory      - { type: 'ready' }     - git commands
   - FastForwardService    - { type: 'execute' }   - npm commands
   - QualityLensService    - { type: 'complete' }  - shell commands
   - Quick Open (clone)    - { type: 'error' }
```

## Initialization Flow

1. **Consumer calls `electronCLI.initialize()`**
   - First call triggers worker spawn
   - Subsequent calls return cached promise

2. **CLIBridge spawns worker via `utilityProcess.fork()`**
   - Worker script: `universal-worker.cjs`
   - Environment includes user PATH for tool access

3. **Worker sends ready signal**
   - `process.parentPort.postMessage({ type: 'ready' })`
   - Main process waits for this event-driven signal

4. **Initialization completes**
   - `initialized` flag set to true
   - Commands can now be executed

## Event-Driven Ready Detection

The worker readiness is detected through events, not arbitrary timeouts:

- **Success**: Worker sends `{ type: 'ready' }` message
- **Failure**: Worker exits/crashes during startup (detected via `exit` event)
- **Safety net**: 30-second timeout only for truly hung processes

This ensures:
- Slow startups work (no arbitrary timeout limit)
- Crashes are detected instantly
- Clear error messages for debugging

## Command Execution Flow

1. Consumer calls `execute(command, args, options)`
2. CLIBridge generates unique `callId`
3. Command sent to worker via `postMessage`
4. Worker spawns child process, captures output
5. Worker sends `{ type: 'complete', id, exitCode, data }` back
6. CLIBridge resolves the pending promise

## Error Handling

### Worker Crash During Startup
- Detected via `worker.on('exit')` event
- Rejects initialization with clear error message
- No 5-second wait for timeout

### Worker Crash During Operation
- Pending calls are rejected with error
- Auto-restart attempted if bridge was initialized

### Command Timeout
- Configurable per-command timeout
- Worker kills child process on timeout
- Returns error response

## Diagnostics (System Monitor)

The System Monitor provides a CLI Bridge tab with:

- **Status display**: Shows initialization state, worker PID, uptime
- **Initialize button**: Manually trigger initialization
- **Test Worker button**: Run echo command to verify responsiveness
- **Restart Worker button**: Kill and respawn worker

## Files

- `src/main/electron-cli-bridge/CLIBridge.ts` - Main orchestrator
- `src/main/electron-cli-bridge/ElectronCLI.ts` - High-level API
- `src/main/electron-cli-bridge/workers/universal-worker.cjs` - Worker process
- `src/main/services/ipc/cliBridgeHandlers.ts` - IPC handlers for diagnostics
- `src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx` - Diagnostics UI
