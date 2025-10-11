# Event Processing Server

A dedicated utility process for handling agent session event processing, designed to offload CPU-intensive operations from the main Electron process.

## Architecture

```
Main Process                    Event Processing Server (Utility Process)
├─ EventServerManager           ├─ HttpEventServer
├─ Storage API access           ├─ AgentEventPipeline
├─ Window/IPC management        ├─ Git repository detection
├─ Observability SDK            ├─ Path normalization
└─ UI event broadcasting        └─ HTTP server (port 3043)
```

## Configuration

The event processing server runs automatically when the app starts.

### Environment Variables

```bash
# Run both processors and compare results
EVENT_PROCESSOR_COMPARISON_MODE=true

# Gradual rollout mode (percentage of traffic to server)
EVENT_PROCESSOR_GRADUAL_ROLLOUT=true
EVENT_SERVER_ROLLOUT_PERCENTAGE=25  # 25% of events go to server

# Enable fallback to V2 on server errors (default: true)
EVENT_PROCESSOR_FALLBACK_ON_ERROR=true

# Logging level for event processing
EVENT_PROCESSOR_LOG_LEVEL=info  # debug, info, warn, error

# Server-specific settings
DEBUG_EVENT_SERVER=true  # Enable debug logging in server
MAX_CONCURRENT_EVENTS=10  # Max concurrent events in server
REQUEST_TIMEOUT_MS=30000  # Request timeout
STATS_REPORTING_INTERVAL_MS=60000  # Stats reporting interval
```

## Processing Modes

### 1. V2 Only (Default)

```bash
USE_EVENT_PROCESSING_SERVER=false
```

(Deprecated - no longer used)

### 2. Server Only

```bash
USE_EVENT_PROCESSING_SERVER=true
```

- All events processed by the server
- Main process acts as thin proxy
- Maximum performance improvement

### 3. Comparison Mode

```bash
EVENT_PROCESSOR_COMPARISON_MODE=true
```

- Runs both V2 and server processors
- Compares results and logs differences
- Returns server result if successful, falls back to V2
- Useful for validation during migration

### 4. Gradual Rollout

```bash
EVENT_PROCESSOR_GRADUAL_ROLLOUT=true
EVENT_SERVER_ROLLOUT_PERCENTAGE=50
```

- Splits traffic between V2 and server
- Percentage controls how much traffic goes to server
- Allows gradual migration with monitoring

## Files Structure

```
src/event-processing-server/
├── EventProcessingServer.ts    # Main server class
├── server.ts                   # Server exports
├── worker-entry.cjs           # CLIBridge worker entry point
├── types/
│   ├── messages.ts            # IPC message types
│   └── index.ts              # Shared types
└── README.md                 # This file
```

## How It Works

1. **Server starts automatically** when app launches (via EventServerManager)
2. **HTTP server** listens on port 3043 for agent events
3. **Events are processed** through AgentEventPipeline with git repository info
4. **Results sent to main** process for storage and observability SDK
5. **UI is notified** via IPC events

## Monitoring

### Statistics

```typescript
const stats = eventProcessor.getStats();
console.log(stats);
```

### Comparison Results (in comparison mode)

```typescript
const comparisons = eventProcessor.getComparisonResults(10);
comparisons.forEach((result) => {
  if (result.differencesFound.length > 0) {
    console.warn('Differences found:', result.differencesFound);
  }
});
```

### Event Listeners

```typescript
eventProcessor.on('comparison-result', (result) => {
  // Handle comparison results
});

eventProcessor.on('server-error', (error) => {
  // Handle server errors
});
```

## Testing

### Development Testing

```bash
# Test with comparison mode
EVENT_PROCESSOR_COMPARISON_MODE=true npm start

# Test server only mode
USE_EVENT_PROCESSING_SERVER=true npm start

# Test gradual rollout
EVENT_PROCESSOR_GRADUAL_ROLLOUT=true EVENT_SERVER_ROLLOUT_PERCENTAGE=10 npm start
```

### Performance Testing

```bash
# Enable debug logging to see timing information
EVENT_PROCESSOR_LOG_LEVEL=debug npm start
```

## Migration Strategy

1. **Phase 1: Setup (Zero Risk)**

   ```bash
   USE_EVENT_PROCESSING_SERVER=false  # Keep existing behavior
   ```

2. **Phase 2: Validation**

   ```bash
   EVENT_PROCESSOR_COMPARISON_MODE=true  # Run both, compare results
   ```

3. **Phase 3: Gradual Rollout**

   ```bash
   EVENT_PROCESSOR_GRADUAL_ROLLOUT=true
   EVENT_SERVER_ROLLOUT_PERCENTAGE=10  # Start with 10%
   ```

4. **Phase 4: Full Migration**

   ```bash
   USE_EVENT_PROCESSING_SERVER=true  # 100% server processing
   ```

5. **Phase 5: Cleanup**
   - Remove old V2 processor code
   - Remove feature flags

## Rollback Plan

If issues occur, simply change environment variable:

```bash
USE_EVENT_PROCESSING_SERVER=false
```

No code changes needed - the application will restart with the original V2 processor.

## Performance Benefits

Expected improvements:

- **Main process responsiveness**: 50-80% reduction in event loop blocking
- **Event processing throughput**: 30-50% increase in concurrent processing
- **Memory isolation**: Event processing memory usage isolated from main process
- **Crash resilience**: Server crashes don't affect main application

## Troubleshooting

### Server Won't Start

- Check that `worker-entry.cjs` exists and is executable
- Verify CLIBridge is properly initialized
- Check server logs for startup errors

### Events Not Processing

- Verify server is ready (check logs for "ready signal")
- Check for timeout errors in proxy logs
- Monitor pending request counts

### Performance Issues

- Enable debug logging to see processing times
- Monitor server statistics for bottlenecks
- Check memory usage in both processes

### Comparison Mode Differences

- Review comparison results for patterns
- Check if differences are acceptable
- Investigate specific event types that differ

## Dependencies

- `@principal-ai/agent-monitoring`: Event pipeline processing
- `electron`: Utility process and IPC
- Existing storage and repository cache systems
