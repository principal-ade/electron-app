# UI Event Format Audit

## Executive Summary

This audit identifies all renderer code that depends on agent session events and the `NormalizedAgentSessionEvent` format. The UI has significant dependencies on the legacy event format that need careful migration.

## Data Flow Architecture

```
Main Process (IPC Handlers) → Renderer Services → React Hooks → UI Components
         ↓                           ↓                ↓              ↓
  AgentSessionAPI          AgentSessionService  useAgentSessions  Components
```

## Key Dependencies

### 1. Core Services (src/renderer/main-process-api/)

#### AgentSessionService.ts
- **Purpose**: Main interface for session operations in renderer
- **Event Dependencies**:
  - `getSessionEvents()`: Returns `NormalizedAgentSessionEvent[]`
  - Extracts file paths from events
  - Processes todo items from events
  - Builds file operation history
- **Critical Methods**:
  ```typescript
  static getSessionEvents(sessionId: string): Promise<NormalizedAgentSessionEvent[] | null>
  static extractFilesFromEvents(events: NormalizedAgentSessionEvent[]): FileOperation[]
  static getTodosFromEvents(events: NormalizedAgentSessionEvent[]): TodoItem[]
  ```

#### AgentSessionEventsService.ts
- Raw event access for debugging
- Processes both raw and normalized events

#### AgentSessionArchiveService.ts
- Archive operations that include event data
- Needs event format for archived sessions

### 2. React Hooks (src/renderer/hooks/)

#### useAgentSessions.ts
- **Purpose**: Primary hook for session management
- **Dependencies**:
  - Uses `DirectorySessions` format (directory-based grouping)
  - Expects `SessionSummary` with specific fields
  - Watches for session updates via IPC events

#### useSessionEventProcessor.ts
- **Purpose**: Real-time event processing in UI
- **Critical Dependency**: Directly uses `NormalizedAgentSessionEvent`
- **Processing**:
  - Updates session state from incoming events
  - Extracts metadata and counters
  - Tracks file operations and tool usage

### 3. Core Services (src/renderer/services/)

#### EventSegmenterService.ts
- **Purpose**: Groups events into logical segments
- **Direct Dependency**: `NormalizedAgentSessionEvent`
- **Operations**:
  - Segments events by todos or stop events
  - Creates timeline views
  - Analyzes event patterns

#### sessionContextService.ts
- Provides context for current session
- Uses event data for context building

#### sessionPathNormalization.ts
- Normalizes paths from events
- Critical for file operation display

### 4. UI Components

#### High-Impact Components (Direct Event Display)

1. **SessionEventsView.tsx**
   - Displays full event list
   - **Note**: Already using type alias for migration readiness
   ```typescript
   type NormalizedAgentSessionEvent = RepoNormalizedUniversalAgentSessionEvent;
   ```

2. **EventHistoryModal.tsx**
   - Shows detailed event history
   - Filters and searches events

3. **EventDetailsModal.tsx**
   - Shows individual event details
   - Displays tool input/output

4. **NormalizedEventCard.tsx**
   - Debug view for normalized events
   - Shows all event fields

#### Medium-Impact Components (Process Event Data)

1. **AgentSessionDetailView.tsx**
   - Displays session statistics from events
   - Shows file operations and tool usage

2. **FileActivityView.tsx**
   - Visualizes file access patterns
   - Groups files by operation type

3. **ToolUseView.tsx**
   - Shows tool usage statistics
   - Aggregates from event data

4. **SegmentedTimelineView.tsx**
   - Timeline visualization of events
   - Groups events into segments

#### Low-Impact Components (Use Processed Data)

1. **AgentSessionCard.tsx**
   - Shows session summary cards
   - Uses pre-processed statistics

2. **SessionDetailsPanel.tsx**
   - Summary panel
   - Uses aggregated data

## Type Dependencies

### Core Types Used Throughout UI

```typescript
// From legacy-event.types.ts
interface NormalizedAgentSessionEvent {
  eventType: NormalizedEventType;
  sessionId: string;
  workingDirectory: string;
  normalizedWorkingDirectory?: string;
  timestamp: number;
  provider: SupportedAgent;
  toolName?: CommonToolName;
  toolInput?: unknown;
  toolOutput?: unknown;
  files?: NormalizedPathInfo[];
  data?: Record<string, unknown>;
  raw?: unknown;
  transcriptPath?: string;
}

// UI expects these derived types
interface DirectorySessions {
  directory: string;  // Directory-based grouping
  summaries: SessionSummary[];
}

interface SessionSummary {
  sessionId: string;
  directory: string;  // Directory, not repository
  // ... counters and metadata
}
```

## Critical Migration Challenges

### 1. Directory vs Repository Grouping
- **Current**: UI groups by working directory
- **Target**: SDK groups by repository root
- **Impact**: All session queries need translation

### 2. Path Normalization
- **Current**: `files?: NormalizedPathInfo[]` with mixed contexts
- **Target**: Repository-aware path normalization
- **Impact**: File display and operations

### 3. Event Format Fields
- **Current**: Uses `normalizedWorkingDirectory`, `files` array
- **Target**: Uses `repository`, different file structure
- **Impact**: All event processing logic

### 4. Real-time Updates
- **Current**: IPC events with `NormalizedAgentSessionEvent`
- **Target**: Need to convert SDK events for UI
- **Impact**: Live session updates

## Required Adapter Methods

Based on this audit, the EventFormatAdapter needs to provide:

### Query Methods
```typescript
// Session queries with directory → repository mapping
getActiveSessionsByDirectory(): Promise<DirectorySessions[]>
getArchivedSessionsByDirectory(): Promise<DirectorySessions[]>
getSessionsForDirectory(dir: string): Promise<SessionSummary[]>

// Event queries with format conversion
getSessionEvents(sessionId: string): Promise<NormalizedAgentSessionEvent[]>
getRawSessionEvents(sessionId: string): Promise<any[]>

// Statistics and aggregations
getSessionStatistics(sessionId: string): Promise<SessionStats>
getFileOperations(sessionId: string): Promise<FileOperation[]>
getTodos(sessionId: string): Promise<TodoItem[]>
```

### Real-time Methods
```typescript
// Event stream conversion
subscribeToSessionEvents(callback: (event: NormalizedAgentSessionEvent) => void)
convertIncomingEvent(sdkEvent: RepoNormalizedEvent): NormalizedAgentSessionEvent
```

### Migration Helpers
```typescript
// Directory ↔ Repository mapping
findRepositoryForDirectory(dir: string): Promise<string>
mapRepositoryToDirectory(repo: string): string

// Batch conversions
convertEventBatch(events: RepoNormalizedEvent[]): NormalizedAgentSessionEvent[]
convertSessionSummary(sdkSession: SDKSession): SessionSummary
```

## Migration Priority

### Phase 1: Core Services (Week 1)
1. Implement EventFormatAdapter
2. Update AgentSessionService to use adapter
3. Maintain IPC interface compatibility

### Phase 2: Non-Visual Components (Week 2)
1. Update hooks to handle both formats
2. Migrate services (EventSegmenterService, etc.)
3. Add format detection and auto-conversion

### Phase 3: Visual Components (Week 3-4)
1. Start with debug/admin components
2. Move to main session views
3. Update real-time components last

### Phase 4: Cleanup (Week 5)
1. Remove legacy type imports
2. Update to use SDK types directly
3. Remove adapter where possible

## Testing Requirements

1. **Format Conversion Tests**
   - Verify all event fields map correctly
   - Test path normalization
   - Validate repository detection

2. **UI Regression Tests**
   - Session list displays correctly
   - Event history shows all events
   - File operations tracked accurately
   - Statistics match expected values

3. **Performance Tests**
   - Event conversion performance
   - Large session handling
   - Real-time update latency

## Conclusion

The UI has extensive dependencies on the `NormalizedAgentSessionEvent` format, particularly around:
1. Directory-based session grouping
2. File path handling
3. Event field structure
4. Real-time updates

The migration requires a comprehensive adapter layer that can:
- Translate between directory and repository concepts
- Convert event formats bidirectionally
- Maintain UI performance
- Preserve all existing functionality

The phased approach allows gradual migration while maintaining a working UI throughout the process.