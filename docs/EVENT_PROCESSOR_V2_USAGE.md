# Event Processor V2 - Usage Guide

## Overview

We've implemented a parallel V2 event processor that uses the new `@principal-ai/agent-monitoring` pipeline while maintaining full compatibility with existing storage and UI systems.

## Architecture

```
Raw Hook Data
    ↓
[V1 or V2 Processor] ← Controlled by Environment Variable
    ↓
V2: Pipeline → Convert to Old Format
V1: Legacy Processing
    ↓
Same Storage Format (NormalizedAgentSessionEvent)
    ↓
Same IPC Interface
    ↓
UI (unchanged)
```

## Enabling V2 Processor

### Method 1: Environment Variable (Recommended for Testing)

```bash
# Enable V2 processor
USE_EVENT_PROCESSOR_V2=true npm start

# Or in .env file
USE_EVENT_PROCESSOR_V2=true
```

### Method 2: Launch Script

```bash
# Create a launch script
#!/bin/bash
export USE_EVENT_PROCESSOR_V2=true
npm start
```

## What's Different in V2?

### Internal Changes
1. **Uses new pipeline** from `@principal-ai/agent-monitoring`
2. **Cleaner architecture** - Single pipeline handles all processing
3. **Better error handling** - Wrapped errors with context
4. **Metrics collection** - Built-in performance monitoring
5. **No redundant enrichment** - Pipeline handles all normalization

### What Stays the Same
1. **Storage format** - Still stores `NormalizedAgentSessionEvent`
2. **IPC interface** - UI receives same event format
3. **Session management** - Same session tracking logic
4. **Event broadcasting** - Same real-time updates

## Testing the Migration

### 1. Start with V1 (Default)
```bash
npm start
# Check logs: "[AgentSessionEventsHttpBridge] Using V1 event processor (legacy)"
```

### 2. Test with V2
```bash
USE_EVENT_PROCESSOR_V2=true npm start
# Check logs: "[AgentSessionEventsHttpBridge] Using V2 event processor (new pipeline)"
```

### 3. Verify Functionality
- Generate events from agents (Claude, Gemini, OpenCode)
- Check that events appear in UI
- Verify file paths are normalized correctly
- Check session counters update properly

### 4. Monitor Performance
V2 logs performance metrics:
```
[EventProcessorV2] Slow processing: 150ms for claude event
```

## Rollback

If issues occur with V2, simply restart without the environment variable:
```bash
npm start  # Uses V1 by default
```

## Files Involved

### New Files (V2 Implementation)
- `src/main/agent-session-events/AgentSessionEventProcessorV2.ts` - V2 processor
- `src/main/agent-monitoring-pipeline/AgentEventPipeline.ts` - Pipeline implementation
- `src/main/agent-monitoring-pipeline/EventMigrationHelper.ts` - Format conversion

### Modified Files
- `src/main/agent-session-events/AgentSessionEventsHttpBridge.ts` - Added V2 switching logic

### Unchanged Files
- All UI components - No changes needed
- Storage layer - Same format
- IPC interfaces - Same contracts

## Migration Status

- [x] V2 processor implemented
- [x] Pipeline integrated
- [x] Format conversion working
- [x] Environment variable switching
- [x] Parallel implementation (V1 and V2 coexist)
- [ ] Production testing
- [ ] Performance benchmarking
- [ ] Full migration to V2

## Next Steps

1. **Test in development** - Run with V2 for a day
2. **Monitor metrics** - Check processing times and errors
3. **Gradual rollout** - Enable for specific users
4. **Full migration** - Make V2 the default
5. **Remove V1** - Clean up old code after stability confirmed

## Troubleshooting

### V2 Not Being Used
Check that:
1. Environment variable is set: `echo $USE_EVENT_PROCESSOR_V2`
2. Logs show V2 initialization
3. No TypeScript compilation errors

### Events Not Processing
1. Check console for pipeline errors
2. Verify `@principal-ai/agent-monitoring` is installed
3. Check that repository cache is initialized

### Performance Issues
1. V2 logs slow events (>100ms)
2. Check repository cache performance
3. Monitor memory usage

## Benefits of V2

1. **Cleaner code** - Single pipeline vs scattered processing
2. **Better maintainability** - Clear separation of concerns
3. **Future-proof** - Ready for new agent-monitoring features
4. **Consistent processing** - All agents use same pipeline
5. **Easy to extend** - Just update pipeline configuration