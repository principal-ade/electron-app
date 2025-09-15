# Event Processing Abstraction Boundaries

## Overview
This document maps the clear boundaries between event processing, storage, and UI layers to enable safe migration with switchable implementations.

## Current Architecture Flow

```
1. Raw Hook Data (from agents)
      ↓
2. AgentSessionEventProcessor (main process)
      ↓
3. NormalizedAgentSessionEvent
      ↓
4. Storage Layer & IPC
      ↓
5. UI Components
```

## Key Abstraction Points

### 1. Event Processor Interface (Entry Point)
**Location**: `src/main/agent-session-events/AgentSessionEventProcessor.ts`

**Current Implementation**:
```typescript
class AgentSessionEventProcessor {
  async processRawEvent(provider: SupportedAgent, rawData: AgentHookInput): Promise<NormalizedAgentSessionEvent>
}
```

**Abstraction Opportunity**:
Create an interface that can switch between old and new processing:

```typescript
interface IEventProcessor {
  processRawEvent(provider: SupportedAgent, rawData: any): Promise<NormalizedAgentSessionEvent | UniversalAgentSessionEvent>;
}

// Implementation switcher
class EventProcessorAdapter implements IEventProcessor {
  constructor(private useNewImplementation: boolean = false) {}

  async processRawEvent(provider: SupportedAgent, rawData: any) {
    if (this.useNewImplementation) {
      // Use new @principal-ai/agent-monitoring processors
      const processor = getNewProcessor(provider);
      const universal = processor.normalize(rawData);
      // Convert to old format for compatibility
      return this.convertToNormalized(universal);
    } else {
      // Use existing implementation
      return this.legacyProcessor.processRawEvent(provider, rawData);
    }
  }
}
```

### 2. Storage Boundary
**Location**: `src/main/agent-session-events/AgentSessionEventProcessor.ts:122`

**Current Storage Call**:
```typescript
private async storeNormalizedEvent(event: NormalizedAgentSessionEvent): Promise<void>
```

**Key Storage Contract**:
- Storage expects `NormalizedAgentSessionEvent` type
- Uses `ProcessedSessionData` structure
- Stores in `StaticNamespaces.AGENT_SESSIONS`

**Abstraction Strategy**:
```typescript
interface IEventStorage {
  storeEvent(event: NormalizedAgentSessionEvent | UniversalAgentSessionEvent): Promise<void>;
  getEvents(sessionId: string): Promise<Array<NormalizedAgentSessionEvent | UniversalAgentSessionEvent>>;
}

class EventStorageAdapter implements IEventStorage {
  async storeEvent(event: any) {
    // Convert to storage format if needed
    const storageEvent = this.toStorageFormat(event);
    await this.storage.store(storageEvent);
  }
}
```

### 3. IPC Boundary (Critical for UI)
**Location**: `src/shared/main-process-api-interfaces/AgentSessionAPI.ts`

**Current IPC Contract**:
```typescript
interface AgentSessionAPI {
  getSessionEvents(sessionId: string): Promise<NormalizedAgentSessionEvent[] | null>;
  // ... other methods
}
```

**UI Consumption Points**:
- `src/renderer/main-process-api/AgentSessionService.ts` - Service layer
- `src/renderer/services/EventSegmenterService.ts` - Event segmentation
- `src/renderer/components/*` - Various UI components

**Abstraction Strategy**:
```typescript
// Create adapter at IPC boundary
class IPCEventAdapter {
  async getSessionEvents(sessionId: string): Promise<NormalizedAgentSessionEvent[]> {
    const events = await this.storage.getEvents(sessionId);

    // Convert new format to old for UI compatibility
    if (this.isNewFormat(events[0])) {
      return events.map(e => this.convertToNormalized(e as UniversalAgentSessionEvent));
    }

    return events as NormalizedAgentSessionEvent[];
  }
}
```

### 4. Session State Processing
**Location**: `src/shared/event-processing/SessionEventProcessor.ts`

**Current Processing**:
```typescript
class SessionEventProcessor {
  processEvent(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult
}
```

**This is shared between backend and frontend** - Critical abstraction point!

**Abstraction Strategy**:
```typescript
interface ISessionProcessor {
  processEvent(event: any, currentState: SessionState): ProcessingResult;
}

class SessionProcessorAdapter implements ISessionProcessor {
  processEvent(event: any, currentState: SessionState) {
    // Normalize event to common format
    const normalized = this.normalizeEvent(event);
    return this.processor.processEvent(normalized, currentState);
  }
}
```

## Migration Strategy with Switchable Implementations

### Phase 1: Create Adapter Layer
1. **EventProcessorAdapter** - Switches between old/new event processing
2. **StorageAdapter** - Handles format conversion for storage
3. **IPCAdapter** - Maintains UI contract while backend changes

### Phase 2: Implementation Points

#### A. Main Process Entry (Minimal Change)
```typescript
// src/main/agent-session-events/AgentSessionEventProcessor.ts
class AgentSessionEventProcessor {
  private adapter: EventProcessorAdapter;

  constructor() {
    // Feature flag or config
    const useNewImplementation = process.env.USE_NEW_EVENT_PROCESSING === 'true';
    this.adapter = new EventProcessorAdapter(useNewImplementation);
  }

  async processRawEvent(provider: SupportedAgent, rawData: any) {
    return this.adapter.processRawEvent(provider, rawData);
  }
}
```

#### B. Storage Layer (Transparent)
```typescript
// src/main/storage-providers/EventStorageAdapter.ts
class EventStorageAdapter {
  async store(event: any) {
    // Convert to ProcessedSessionData regardless of input format
    const sessionData = this.toSessionData(event);
    await this.typedStore.set(sessionData);
  }
}
```

#### C. IPC Layer (UI Protection)
```typescript
// src/window/main-process-api-implementations/agentSessionApi.ts
async function getSessionEvents(sessionId: string) {
  const events = await eventStorage.getEvents(sessionId);

  // Always return NormalizedAgentSessionEvent[] to UI
  return adapter.toNormalizedFormat(events);
}
```

### Phase 3: Testing Strategy

#### Test Points:
1. **Unit Tests** - Test adapters with both formats
2. **Integration Tests** - Test full pipeline with feature flag
3. **UI Tests** - Ensure UI receives expected format

#### Rollout:
1. Deploy with feature flag OFF
2. Test with flag ON in development
3. Gradual rollout with monitoring
4. Full migration when stable

## Critical Interfaces to Maintain

### 1. Event Type Fields (UI Dependencies)
The UI expects these fields on `NormalizedAgentSessionEvent`:
- `eventType`: string
- `sessionId`: string
- `workingDirectory`: string
- `timestamp`: number
- `provider`: SupportedAgent
- `toolName?`: string
- `files?`: NormalizedPathInfo[]

### 2. SessionState Fields (Processing Dependencies)
`SessionEventProcessor` expects to update:
- `fileAccesses`: Record<string, Array>
- `fileWrites`: Record<string, Array>
- `filesRead`: string[]
- `filesWritten`: string[]
- `toolCalls`: Array
- Event counters

### 3. Storage Structure (ProcessedSessionData)
Storage expects:
- `events`: Array of events
- `counters`: File/tool/web access counts
- `metadata`: Extensible metadata object

## Implementation Checklist

### Immediate (Safe to implement now)
- [ ] Create `IEventProcessor` interface
- [ ] Create `EventProcessorAdapter` with feature flag
- [ ] Create format conversion utilities
- [ ] Add logging for format detection

### With Testing
- [ ] Implement new processor path
- [ ] Add conversion at storage boundary
- [ ] Test with both formats in parallel

### Final Migration
- [ ] Update IPC contracts
- [ ] Update UI types
- [ ] Remove adapters
- [ ] Clean up old code

## Benefits of This Approach

1. **Zero Breaking Changes Initially** - UI continues to work unchanged
2. **Testable Migration** - Can run old and new in parallel
3. **Rollback Capability** - Feature flag allows instant rollback
4. **Clear Boundaries** - Each layer has defined conversion points
5. **Incremental Migration** - Can migrate one component at a time

## Risk Mitigation

### Performance
- Conversion overhead is minimal (< 1ms per event)
- Can be optimized with caching if needed

### Data Integrity
- Both formats stored during transition
- Can replay events if needed

### UI Stability
- UI always receives expected format
- No UI changes required initially

## Next Steps

1. **Create adapter implementations** in separate files
2. **Add feature flag** to configuration
3. **Implement parallel processing** for testing
4. **Monitor performance** metrics
5. **Plan UI migration** separately