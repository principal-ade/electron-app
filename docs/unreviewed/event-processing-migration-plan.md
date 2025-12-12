# Event Processing Server Migration Plan

## Overview
This document outlines the plan to migrate event processing from the main process to a dedicated utility process using electron-cli-bridge, improving application performance by offloading CPU-intensive operations.

## Current Architecture Problems
- Heavy event processing in main process blocks UI operations
- Path normalization and repository lookups are CPU-intensive
- Event pipeline processing can slow down window responsiveness
- Storage serialization queues can create bottlenecks

## Proposed Architecture

### Process Separation
```
Main Process (Thin Relay)          Event Processing Server (Utility Process)
├─ Receives hook events             ├─ Long-running server process
├─ Simple forwarding                ├─ Complete event processing pipeline
├─ Storage API proxy                ├─ Event queue management
├─ Window IPC management            ├─ Repository cache
└─ Server lifecycle management      └─ Observability integration
```

## Migration Strategy: Parallel Implementation

### Phase 1: Create Infrastructure (No Breaking Changes)
1. Create new folder structure alongside existing code
2. Implement event processing server as utility process
3. Add feature flag to control which processor to use
4. Both implementations coexist, switchable via environment variable

### Phase 2: Gradual Migration
1. Run both processors in parallel for testing
2. Compare outputs to ensure consistency
3. Monitor performance metrics
4. Gradually shift traffic to new processor

### Phase 3: Cleanup
1. Remove old implementation
2. Remove feature flags
3. Optimize communication protocols

## Implementation Plan

### 1. Folder Structure
```
src/
├── main/
│   └── agent-session-events/
│       ├── AgentSessionEventProcessorV2.ts  # KEEP (for now)
│       ├── EventProcessorProxy.ts           # NEW (thin relay)
│       └── EventProcessorSelector.ts        # NEW (feature flag logic)
│
└── event-processing-server/                 # NEW FOLDER
    ├── server.ts                            # Main server entry
    ├── EventProcessingServer.ts             # Core server class
    ├── handlers/
    │   ├── EventHandler.ts                  # Process events
    │   ├── StorageHandler.ts                # Handle storage requests
    │   └── ObservabilityHandler.ts         # Observability forwarding
    ├── services/
    │   ├── EventProcessor.ts                # Migrated from V2
    │   ├── EventQueue.ts                    # Migrated queue logic
    │   └── RepositoryCache.ts              # Local cache
    ├── types/
    │   ├── messages.ts                      # IPC message types
    │   └── index.ts                         # Shared types
    └── worker-entry.cjs                     # CLIBridge entry point
```

### 2. Communication Protocol

#### Message Types
```typescript
// Main → Server
interface ProcessEventMessage {
  type: 'PROCESS_EVENT';
  id: string;
  provider: SupportedAgent;
  rawData: unknown;
  timestamp: number;
}

// Server → Main
interface StorageRequest {
  type: 'STORAGE_REQUEST';
  id: string;
  operation: 'GET' | 'SET';
  key: string;
  data?: any;
  namespace: string;
}

interface WindowBroadcast {
  type: 'WINDOW_BROADCAST';
  event: string;
  data: any;
}

interface ProcessingComplete {
  type: 'PROCESSING_COMPLETE';
  id: string;
  success: boolean;
  error?: string;
}

// Main → Server
interface StorageResponse {
  type: 'STORAGE_RESPONSE';
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}
```

### 3. Feature Flag Configuration

```typescript
// In main process initialization
const USE_EVENT_SERVER = process.env.USE_EVENT_PROCESSING_SERVER === 'true';

if (USE_EVENT_SERVER) {
  // Initialize EventProcessorProxy (new)
  eventProcessor = new EventProcessorProxy();
} else {
  // Use existing AgentSessionEventProcessorV2
  eventProcessor = new AgentSessionEventProcessorV2();
}
```

### 4. Implementation Steps

#### Step 1: Create Server Infrastructure
- [ ] Create `src/event-processing-server/` folder
- [ ] Implement basic server.ts with CLIBridge integration
- [ ] Set up message handling infrastructure
- [ ] Create type definitions

#### Step 2: Migrate Core Logic
- [ ] Copy EventQueue logic to server
- [ ] Adapt AgentEventPipeline for server context
- [ ] Implement storage proxy handlers
- [ ] Set up observability forwarding

#### Step 3: Create Main Process Proxy
- [ ] Implement EventProcessorProxy class
- [ ] Set up CLIBridge communication
- [ ] Handle storage API calls
- [ ] Manage window broadcasts

#### Step 4: Add Feature Toggle
- [ ] Create EventProcessorSelector
- [ ] Add environment variable checking
- [ ] Ensure both paths work correctly
- [ ] Add logging for debugging

#### Step 5: Testing Infrastructure
- [ ] Create comparison testing mode
- [ ] Log differences between implementations
- [ ] Performance benchmarking
- [ ] Memory usage monitoring

### 5. Testing Plan

#### Parallel Testing Mode
```typescript
// Run both processors and compare results
class EventProcessorComparator {
  async processEvent(provider, rawData) {
    const [v2Result, serverResult] = await Promise.all([
      this.v2Processor.processRawEvent(provider, rawData),
      this.serverProcessor.processRawEvent(provider, rawData)
    ]);

    // Compare and log differences
    this.compareResults(v2Result, serverResult);

    // Return one result (configurable)
    return USE_EVENT_SERVER ? serverResult : v2Result;
  }
}
```

#### Performance Metrics
- Main process event loop latency
- Event processing throughput
- Memory usage (main vs server)
- Storage operation timing

### 6. Rollback Plan
If issues arise during migration:
1. Set `USE_EVENT_PROCESSING_SERVER=false`
2. Server process will idle/shutdown
3. Original implementation continues working
4. No code changes needed for rollback

### 7. Success Criteria
- [ ] Event processing latency reduced by >50%
- [ ] Main process remains responsive during heavy processing
- [ ] No event data loss during migration
- [ ] Storage operations maintain consistency
- [ ] Observability data flow uninterrupted

### 8. Timeline
- **Week 1**: Infrastructure setup, basic server implementation
- **Week 2**: Core logic migration, testing infrastructure
- **Week 3**: Parallel testing, performance validation
- **Week 4**: Gradual rollout, monitoring
- **Week 5**: Full migration, old code removal

## Benefits of This Approach
1. **Zero downtime migration**: Both implementations run side-by-side
2. **Safe rollback**: Simple environment variable change
3. **Gradual validation**: Can compare outputs in production
4. **Performance monitoring**: Can measure improvements before full switch
5. **Code cleanliness**: Old code remains untouched until proven unnecessary

## Configuration
```bash
# Development
USE_EVENT_PROCESSING_SERVER=false  # Use existing implementation
USE_EVENT_PROCESSING_SERVER=true   # Use new server implementation

# Testing mode
EVENT_PROCESSOR_COMPARISON_MODE=true  # Run both and compare
```

## Monitoring
The migration will be monitored through:
- Application performance metrics
- Event processing latency histograms
- Memory usage graphs
- Error rates and types
- Storage operation timings

## Next Steps
1. Review and approve this plan
2. Create feature branch for implementation
3. Begin with Phase 1 infrastructure
4. Set up testing environment
5. Implement gradual migration