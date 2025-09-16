# V2 Parallel Testing Guide

## Overview

The V2 processor now runs in parallel with V1 for safe testing. V1 continues to handle all storage and UI updates, while V2 processes events silently and logs results.

## How It Works

```
Raw Event
    ├── V1 Processor (main flow)
    │   ├── Process
    │   ├── Store
    │   └── Emit to UI
    │
    └── V2 Processor (test only)
        ├── Process through pipeline
        ├── Convert format
        └── Log success/failure
```

## Enabling Parallel Testing

```bash
# Enable V2 parallel testing
TEST_EVENT_PROCESSOR_V2=true npm start

# Or in .env file
TEST_EVENT_PROCESSOR_V2=true
```

## What You'll See in Logs

### On Startup
```
[AgentSessionEventsHttpBridge] Testing V2 processor in parallel (non-blocking)
```

### For Each Event
Success case:
```
[V2 TEST] ✅ Success: claude event processed in 45ms
```

Failure case:
```
[V2 TEST] ❌ Failed: gemini event after 12ms: Failed to normalize paths
```

## Key Points

1. **No Impact on Main Flow**
   - V1 handles all real work
   - V2 runs asynchronously
   - V2 failures don't affect V1

2. **Silent Testing**
   - V2 doesn't store events
   - V2 doesn't emit to UI
   - Only logs success/failure

3. **Performance Monitoring**
   - Processing time logged for each event
   - Can compare V1 vs V2 performance
   - Identify slow processing

## What to Monitor

### Success Indicators
- ✅ messages for all events
- Consistent processing times
- No V2 errors

### Issues to Watch For
- ❌ error messages
- Slow processing (>100ms)
- Missing processor for agent type

## Testing Workflow

### 1. Start with Parallel Testing
```bash
TEST_EVENT_PROCESSOR_V2=true npm start
```

### 2. Generate Events
- Use Claude, Gemini, or OpenCode normally
- Watch logs for V2 results

### 3. Monitor for Issues
```bash
# Watch V2 logs specifically
npm start | grep "V2 TEST"
```

### 4. Check Processing Times
Compare V1 vs V2:
- V1: `[EventProcessor] Tool ${toolName} accessed`
- V2: `[V2 TEST] ✅ Success: claude event processed in 45ms`

## Debugging V2 Issues

If you see failures:

1. **Check the error message**
   ```
   [V2 TEST] ❌ Failed: claude event after 12ms: <error details>
   ```

2. **Common issues**:
   - Missing `@principal-ai/agent-monitoring` package
   - Repository cache not initialized
   - Path normalization failures

3. **Enable verbose logging**:
   Check `AgentSessionEventProcessorV2.ts` for detailed pipeline logs

## Benefits of Parallel Testing

1. **Zero Risk** - V1 continues working normally
2. **Real Events** - Test with actual usage patterns
3. **Performance Data** - Compare processing times
4. **Gradual Validation** - Build confidence before switching

## Next Steps

Once V2 shows consistent success:
1. Run for extended period (full day)
2. Compare performance metrics
3. Review any error patterns
4. Plan full migration

## Rollback

To disable V2 testing, simply restart without the environment variable:
```bash
npm start  # V2 testing disabled
```