# UI Service Function Usage Analysis

## Summary of AgentSessionService Methods Actually Used

Based on reviewing the UI files, here are the **ONLY** methods from AgentSessionService that are actually called:

### Core Query Methods (Most Used)

1. **`getActiveSessions()`** - Returns `DirectorySessions[]`
   - Used in: useAgentSessions hook, RepositoryManager, AgentSessionDebugModal
   - Critical for: Session list display

2. **`getSession(sessionId, directory)`** - Returns `SessionState | null`
   - Used in: useAgentSessions hook, TabbedTerminalPanel, StandaloneTerminal, AgentSessionDebugModal
   - Critical for: Getting full session details

3. **`getSessionEvents(sessionId)`** - Returns `NormalizedAgentSessionEvent[] | null`
   - Used in: SessionEventsView, EventHistoryModal, ArchivedAgentSessionsPanel, SessionEventViewerModal, MultiFileEditorWindow, AgentSessionCard, TabbedTerminalPanel
   - Critical for: Displaying event history

### Mutation Methods

4. **`updateSessionMetadata(sessionId, directory, metadata)`**
   - Previously used in: AgentSessionsTab (Local Development UI retired)
   - For: Renaming sessions

5. **`deleteFromActive(sessionId)`**
   - Used in: AgentSessionDebugModal
   - For: Removing from active sessions

6. **`reprocessSession(sessionId)`**
   - Used in: AgentSessionDebugModal
   - For: Debug/admin operations

### Debug/Admin Methods

7. **`getRawSessionEvents(sessionId)`**
   - Used in: AgentSessionDebugModal
   - For: Debug view of raw events

### Event Listeners (Real-time Updates)

8. **`onSessionUpdated(callback)`**
   - Previously used in: AgentSessionsTab (Local Development UI retired)
   - For: Real-time session updates

9. **`onCliProviderEvent(callback)`**
   - Used in: AgentConfigCards, MultiFileEditorWindow
   - For: Real-time CLI events

10. **`onProcessedEvent(callback)`**
    - Used in: AgentConfigCards, MultiFileEditorWindow
    - For: Real-time processed events

## Methods NOT Actually Used

These methods exist in the service but aren't called by any UI components:

- `getArchivedSessions()` - Not used, archive panel loads differently
- `getSessionsForDirectory()` - Not used, uses getActiveSessions instead
- `deleteSession()` - Not used directly
- `clearSessionsForDirectory()` - Not used
- `extractFilesFromEvents()` - Processing done locally
- `getTodosFromEvents()` - Processing done locally
- `getFileOperations()` - Processing done locally

## New SDK Types Needed

For the migration to SDK types, we need to create new versions that return:

```typescript
// Instead of DirectorySessions[]
interface ProjectSessions {
  repository: string;  // Repository root, not directory
  repositoryName?: string;
  summaries: SessionSummary[];
}

// Instead of NormalizedAgentSessionEvent[]
type RepoNormalizedUniversalAgentSessionEvent[] // Already in SDK

// Instead of SessionState
interface SDKSession {
  // SDK session format
}
```

## Migration Priority

Based on usage frequency:

### Phase 1 - Critical (Most Used)
1. `getActiveSessions()` → `getActiveSessionsByProject()`
2. `getSessionEvents()` → `getSDKSessionEvents()`
3. `getSession()` → `getSDKSession()`

### Phase 2 - Important
4. Event listeners (onSessionUpdated, onCliProviderEvent, onProcessedEvent)
5. `updateSessionMetadata()`

### Phase 3 - Admin/Debug
6. `getRawSessionEvents()`
7. `deleteFromActive()`
8. `reprocessSession()`

## Components That Need Updates

### High Priority (Core Functionality)
1. **useAgentSessions** hook - Main session management
2. **SessionEventsView** - Event display (already using type alias!)
3. **EventHistoryModal** - Event history
4. **AgentSessionsTab** - Session list (retired)

### Medium Priority (Features)
5. **TabbedTerminalPanel** - Terminal integration
6. **MultiFileEditorWindow** - Editor integration
7. **RepositoryManager** - Repository view
8. **LocalDevelopmentView** - Development view (retired)

### Low Priority (Debug/Admin)
9. **AgentSessionDebugModal** - Debug tools
10. **AgentConfigCards** - Configuration

## Key Insights

1. **Directory-based grouping is critical** - All session queries use directory, not repository
2. **Only 10 methods actually used** - Much simpler than the full API surface
3. **Event listeners are important** - Real-time updates are used in multiple places
4. **Local processing preferred** - Many operations (file extraction, todos) done client-side
5. **SessionEventsView already ready** - Uses type alias for easy migration

## Recommended Approach

1. Create `AgentSessionSDKService` with just the 10 methods we need
2. Use stub implementations that log calls and return mock data
3. Migrate components one by one, starting with SessionEventsView (already has type alias)
4. Track which stubs are actually invoked during testing
5. Implement only the methods that are confirmed to be needed