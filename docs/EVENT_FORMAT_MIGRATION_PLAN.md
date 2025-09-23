# Event Format Migration Plan: From NormalizedAgentSessionEvent to RepoNormalizedUniversalAgentSessionEvent

## Executive Summary

This document outlines the migration strategy from the legacy `NormalizedAgentSessionEvent` format to the new `RepoNormalizedUniversalAgentSessionEvent` format, while simultaneously deprecating local storage in favor of the SDK-based event pipeline.

## Current State Analysis

### Event Flow Architecture
```
Current Flow:
HTTP Events → EventServerManager → EventMigrationHelper → Local Storage (Primary)
                                                        ↘ ObservabilitySDK (Secondary)

Target Flow:
HTTP Events → EventServerManager → ObservabilitySDK (Primary) → UI
                                 ↘ Migration Adapter (Temporary)
```

### Key Components
1. **EventServerManager**: Processes events via utility process, converts RepoNormalized → Normalized
2. **Local Storage**: Stores `ProcessedSessionData` with `NormalizedAgentSessionEvent[]`
3. **ObservabilitySDK**: Already receiving RepoNormalized events but not used for reads
4. **UI Components**: Expect `NormalizedAgentSessionEvent` format

### Format Differences

#### NormalizedAgentSessionEvent (Legacy)
- Uses `files: NormalizedPathInfo[]` with mixed path contexts
- No repository grouping metadata
- Directory-based organization

#### RepoNormalizedUniversalAgentSessionEvent (Target)
- Repository-aware path normalization
- Built-in repository metadata
- Project-based organization
- Better file operation tracking

## Migration Strategy

### Phase 1: SDK Read Methods Implementation (Week 1)

**Goal**: Enhance SDK to provide all necessary query methods

**Tasks**:
1. Implement missing SDK methods:
   ```typescript
   // Priority 1: Essential for UI
   getSessionEvents(sessionId: string): Promise<SessionEvent[]>
   getSessionsByProject(repositoryRoot: string): Promise<Session[]>
   getActiveSessionsGroupedByProject(): Promise<ProjectSessions[]>
   getSessionStatistics(sessionId: string): Promise<SessionStatistics>

   // Priority 2: File operations
   getSessionFileOperations(sessionId: string): Promise<FileOperation[]>
   getSessionTodos(sessionId: string): Promise<TodoItem[]>
   ```

2. Add repository metadata to SDK schema:
   ```sql
   ALTER TABLE sessions ADD COLUMN repository_root TEXT;
   ALTER TABLE sessions ADD COLUMN repository_name TEXT;
   ALTER TABLE sessions ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
   ```

### Phase 2: Event Format Adapter Layer (Week 1-2)

**Goal**: Create bidirectional adapter for gradual migration

**Implementation**:
```typescript
class EventFormatAdapter {
  // Convert SDK events to UI format
  async getSessionEventsForUI(sessionId: string): Promise<NormalizedAgentSessionEvent[]> {
    const sdkEvents = await this.sdk.getSessionEvents(sessionId);
    return sdkEvents.map(e => EventMigrationHelper.fromRepoNormalizedFormat(e));
  }

  // Wrap SDK responses for UI compatibility
  wrapSDKResponse(repoEvents: RepoNormalizedEvent[]): NormalizedEvent[] {
    return EventMigrationHelper.batchToOldFormat(repoEvents);
  }
}
```

### Phase 3: Dual Write with SDK Primary (Week 2-3)

**Goal**: Start writing all events through SDK, maintain local storage for fallback

**Changes to EventServerManager**:
```typescript
private async handleProcessedEvent(msg: any): Promise<void> {
  const repoNormalizedEvent = msg.event;

  // Step 1: Write to SDK (PRIMARY)
  if (this.observability) {
    await this.observability.processRepoEvent(repoNormalizedEvent);

    // Step 2: Read back from SDK to verify
    const sessionData = await this.observability.getSession(event.sessionId);

    // Step 3: Broadcast to UI with adapter
    this.broadcastSessionUpdate(sessionData);
  }

  // Step 4: Keep local storage as fallback (DEPRECATED)
  // Remove after validation period
}
```

### Phase 4: UI Migration (Week 3-4)

**Goal**: Update UI components to use SDK through adapter

**Implementation Steps**:
1. Replace direct storage calls with SDK adapter:
   ```typescript
   // Before
   const sessions = await typedStore.get(key, AGENT_SESSIONS);

   // After
   const sessions = await eventAdapter.getSessionsForProject(projectRoot);
   ```

2. Update React hooks to use new data source:
   ```typescript
   // useAgentSessions.ts
   const fetchSessions = async () => {
     // Use SDK with format adapter
     const sdkSessions = await window.api.agentSession.getProjectSessions(repoRoot);
     const uiSessions = adapter.convertToUIFormat(sdkSessions);
     setSessions(uiSessions);
   };
   ```

### Phase 5: Storage Deprecation (Week 4-5)

**Goal**: Remove local storage dependencies entirely

**Steps**:
1. Remove EventMigrationHelper conversion in EventServerManager
2. Delete local storage read/write code
3. Remove `ProcessedSessionData` type
4. Clean up unused storage namespaces
5. Update tests to use SDK

## Implementation Roadmap

### Week 1: Foundation
- [ ] Implement core SDK query methods
- [ ] Add repository metadata to SDK schema
- [ ] Create EventFormatAdapter class
- [ ] Set up feature flags for migration control

### Week 2: Dual Write
- [ ] Modify EventServerManager for SDK-first writes
- [ ] Implement SDK read verification
- [ ] Add monitoring for write success rates
- [ ] Create data consistency validation tools

### Week 3: UI Integration
- [ ] Update agentSessionService to use SDK
- [ ] Modify React hooks for SDK data source
- [ ] Test UI with adapter layer
- [ ] Handle edge cases and errors

### Week 4: Validation
- [ ] Run parallel reads comparing SDK vs local storage
- [ ] Fix data inconsistencies
- [ ] Performance testing
- [ ] User acceptance testing

### Week 5: Cleanup
- [ ] Remove local storage code
- [ ] Delete deprecated types
- [ ] Update documentation
- [ ] Final testing and deployment

## Risk Mitigation

### Data Loss Prevention
- Maintain dual write during migration
- Implement data validation checks
- Keep backups of local storage
- Add comprehensive error logging

### Performance Concerns
- Cache frequently accessed data
- Implement pagination for large datasets
- Optimize SDK queries with indexes
- Monitor query performance

### Rollback Strategy
- Feature flag to switch between SDK and local storage
- Keep local storage code isolated in separate modules
- Maintain data export functionality
- Document rollback procedures

## Success Metrics

1. **Data Integrity**: 100% of events readable from SDK
2. **Performance**: Query response time < 100ms for common operations
3. **Reliability**: < 0.1% error rate for SDK operations
4. **Migration Completion**: All components using SDK within 5 weeks

## Technical Debt Addressed

1. **Event Format Confusion**: Single source of truth (RepoNormalized format)
2. **Storage Duplication**: One storage system (SDK/Turso)
3. **Path Normalization**: Centralized in SDK
4. **Repository Grouping**: Native support in SDK
5. **Scalability**: Turso database vs local storage limits

## Dependencies

- SDK team must implement Priority 1 methods
- Turso database must be properly configured
- UI team awareness of migration timeline
- Testing environment with production-like data

## Conclusion

This migration plan provides a safe, gradual transition from the legacy event format and local storage to the modern SDK-based architecture. The phased approach ensures data integrity while minimizing disruption to users. The adapter layer allows the UI to continue functioning during the migration, while the dual-write phase provides a safety net for rollback if needed.