# Event Processing Server Build Architecture

## Overview
This document describes how the Event Processing Server is built and deployed in both development and production environments. The server runs as an Electron utility process, completely isolated from the main process, and receives HTTP requests directly from external agents.

## Architecture Components

### Source Files
```
src/
├── event-processing-server/
│   ├── worker-entry.ts          # Entry point for utility process
│   ├── HttpEventServer.ts       # Main HTTP server implementation
│   ├── EventProcessingServer.ts # Event processing logic
│   └── types/                   # TypeScript type definitions
│
└── main/
    └── agent-session-events/
        └── EventServerManager.ts # Main process manager for utility process
```

### Build Outputs
```
.erb/dll/                         # Development build
├── main.bundle.js                # Main process bundle
└── event-worker.bundle.js        # Event processing server bundle

dist/                             # Production build
├── main/
│   └── main.js                   # Main process (minified)
└── workers/
    └── event-worker.js           # Event processing server (minified)
```

## Build Configuration

### Webpack Configuration Changes

The event processing server requires its own webpack entry point to create a standalone bundle:

```javascript
// webpack.config.main.prod.js & webpack.config.main.dev.js
module.exports = {
  entry: {
    main: './src/main/main.ts',
    'event-worker': './src/event-processing-server/worker-entry.ts'
  },

  output: {
    path: path.join(__dirname, '../../.erb/dll'),
    filename: '[name].bundle.js',
  },

  // ... rest of config
}
```

### Key Build Characteristics

1. **Self-contained bundle**: The worker bundle includes ALL dependencies (Express, agent-monitoring, etc.)
2. **No shared modules**: The utility process cannot access the main process's node_modules
3. **Separate compilation**: Worker compiles independently from main process
4. **TypeScript support**: Full TypeScript compilation via webpack

## Development Environment

### Build Process
```
npm start
    ↓
webpack (development mode)
    ├── Compiles src/main/main.ts → .erb/dll/main.bundle.js
    └── Compiles src/event-processing-server/worker-entry.ts → .erb/dll/event-worker.bundle.js
    ↓
Electron starts
    ├── Main process loads .erb/dll/main.bundle.js
    └── EventServerManager spawns utility process with .erb/dll/event-worker.bundle.js
```

### File Resolution in Development
```javascript
// In EventServerManager.ts
if (!app.isPackaged) {
  // Development mode
  workerPath = path.join(__dirname, 'event-worker.bundle.js');
  // Resolves to: .erb/dll/event-worker.bundle.js
}
```

### Development Features
- **Hot reload**: Worker bundle rebuilds on file changes
- **Source maps**: Full debugging support with TypeScript source maps
- **Console output**: Worker stdout/stderr piped to main process console
- **Fast iteration**: Changes reflect immediately after rebuild

### Running in Development
```bash
# Start development server with both bundles
npm start

# The build system will:
# 1. Compile both entry points
# 2. Watch for changes
# 3. Rebuild affected bundles
# 4. Event server auto-restarts on crashes
```

## Production Environment

### Build Process
```
npm run build
    ↓
webpack (production mode)
    ├── Compiles & minifies main.ts → dist/main/main.js
    └── Compiles & minifies worker-entry.ts → dist/workers/event-worker.js
    ↓
electron-builder
    ├── Packages main process files
    ├── Packages worker bundle
    └── Creates installer with all assets
```

### File Resolution in Production
```javascript
// In EventServerManager.ts
if (app.isPackaged) {
  // Production mode
  workerPath = path.join(__dirname, '../workers/event-worker.js');
  // Resolves to: app.asar/dist/workers/event-worker.js
}
```

### Production Optimizations
- **Minification**: Both bundles are minified
- **Tree shaking**: Unused code eliminated
- **Compression**: Bundles are optimized for size
- **ASAR packaging**: Everything packaged in Electron ASAR archive

## Utility Process Lifecycle

### Startup Sequence
1. **Main process starts** → EventServerManager initializes
2. **Spawn utility process** → `utilityProcess.fork(workerPath)`
3. **Worker loads bundle** → Executes event-worker.bundle.js
4. **HTTP server starts** → Listens on port 3043
5. **Ready signal** → Worker sends ready message to main
6. **Operational** → Ready to receive HTTP requests

### Communication Flow
```
External Agent (HTTP POST :3043)
    ↓
Utility Process (event-worker.bundle.js)
    ├── Process event through pipeline
    ├── Request storage via IPC → Main Process
    └── Request window updates via IPC → Main Process

Main Process
    ├── Handle storage operations
    └── Broadcast to renderer windows
```

### Error Handling & Recovery
- **Crash detection**: Main process monitors utility process health
- **Auto-restart**: Automatic restart with exponential backoff
- **Max retries**: Configurable maximum restart attempts (default: 3)
- **Graceful shutdown**: Clean shutdown on app quit

## Bundle Contents

### What's Included in event-worker.bundle.js

```javascript
// Full dependency tree bundled:
{
  // Our code
  './src/event-processing-server/worker-entry.ts',
  './src/event-processing-server/HttpEventServer.ts',
  './src/event-processing-server/EventProcessingServer.ts',

  // Dependencies (all bundled in)
  'express',                          // ~500KB
  '@principal-ai/agent-monitoring',   // ~200KB
  'path', 'fs', 'http',               // Node built-ins (references only)

  // Total bundle size: ~2-3MB (development)
  // Total bundle size: ~800KB (production, minified)
}
```

### What's NOT Included
- Electron APIs (not available in utility process)
- Main process code
- Renderer process code
- Native modules (must be handled separately)

## Migration Path to Separate Package

### Current State (Bundled)
```
src/event-processing-server/
    ↓ webpack
.erb/dll/event-worker.bundle.js (includes everything)
```

### Future State (Package)
```
@your-app/event-processor (npm package)
    ↓ webpack (only bundles the package)
.erb/dll/event-worker.bundle.js (includes package with its deps)
```

### Benefits of This Architecture
1. **No wasted work**: Current webpack setup remains valid
2. **Gradual extraction**: Can extract when needed
3. **Same deployment**: Bundle stays self-contained
4. **Testability**: Can test independently when extracted

## Debugging

### Development Debugging
```bash
# Enable debug logging
DEBUG_EVENT_SERVER=true npm start

# Check worker output in main console
# All console.log from worker appears prefixed with [Server stdout]
```

### Production Debugging
```bash
# Run packaged app with console
/path/to/YourApp.app/Contents/MacOS/YourApp --enable-logging

# Check logs at:
# macOS: ~/Library/Logs/YourApp/
# Windows: %USERPROFILE%\AppData\Roaming\YourApp\logs\
# Linux: ~/.config/YourApp/logs/
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Worker bundle not found | Check webpack config has both entry points |
| Module not found errors | Dependencies not bundled - check webpack externals |
| Port already in use | Another process on 3043 - server will try next port |
| Worker crashes immediately | Check logs for missing dependencies |
| IPC timeout errors | Increase timeout in EventServerManager |

## Environment Variables

### Build Time
- `NODE_ENV`: Set to 'development' or 'production'
- `DEBUG`: Enable verbose webpack output

### Runtime
- `DEBUG_EVENT_SERVER`: Enable debug logging in worker
- `EVENT_SERVER_PORT`: Override default port (3043)
- `MAX_RESTART_ATTEMPTS`: Maximum worker restart attempts
- `WORKER_TIMEOUT`: IPC timeout in milliseconds

## Testing

### Unit Tests
```bash
# Test event processing logic
npm test src/event-processing-server

# Test main process manager
npm test src/main/agent-session-events/EventServerManager
```

### Integration Tests
```bash
# Test full flow with utility process
npm run test:integration

# Test production build
npm run build
npm run test:prod
```

### Manual Testing
```bash
# Test HTTP endpoint
curl http://localhost:3043/health

# Send test event
curl -X POST http://localhost:3043/claude-hook \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "event": "test-event"}'
```

## Performance Considerations

### Memory Usage
- **Main process**: ~100-200MB (unchanged)
- **Utility process**: ~50-100MB (Node + Express + processing)
- **Total overhead**: ~50-100MB additional

### CPU Usage
- Event processing offloaded from main process
- Main process remains responsive during heavy processing
- Utility process can use separate CPU core

### Throughput
- Can handle 100+ events/second
- Bottleneck is typically storage operations
- Consider batching for high-volume scenarios

## Security Considerations

1. **Process isolation**: Utility process has no access to main process memory
2. **Limited permissions**: Utility process cannot access Electron APIs
3. **Port binding**: Only localhost connections accepted
4. **Input validation**: All events validated before processing
5. **Error boundaries**: Crashes don't affect main application

## Future Enhancements

### Short Term
- [ ] Add request queuing for high load
- [ ] Implement event batching for storage
- [ ] Add metrics collection
- [ ] Enhance error recovery

### Long Term
- [ ] Extract to separate npm package
- [ ] Support multiple worker processes
- [ ] Add WebSocket support for real-time events
- [ ] Implement event replay capability
- [ ] Add OpenTelemetry integration

## Conclusion

This architecture provides:
- **Complete isolation** of event processing from main process
- **Direct HTTP reception** without main process involvement
- **Robust error handling** with automatic recovery
- **Clear migration path** to microservice architecture
- **Optimal performance** with minimal overhead

The webpack-based build system ensures the worker bundle is self-contained and works identically in development and production environments.