# NormalizedAgentSessionEvent Migration Audit

## Overview

This document provides a comprehensive audit of all files using `NormalizedAgentSessionEvent` that need to be migrated to `RepoNormalizedUniversalAgentSessionEvent`. The migration involves updating type imports, handling the new `provider` field requirement, and adapting to the new path normalization structure.

## Migration Summary

**From:** `NormalizedAgentSessionEvent` (old unified format)
**To:** `RepoNormalizedUniversalAgentSessionEvent` (repository-normalized with path context)

### Key Changes
- **Provider Field**: Now required on all events
- **Path Structure**: `normalizedPaths` → `files: NormalizedPathInfo[]`
- **Repository Context**: Added `repository?: EventRepositoryContext`
- **Working Directory**: `normalizedWorkingDirectory` for repository-relative paths

## Files Requiring Migration

### 🔴 Critical Priority (Week 1)

#### Core Processing Pipeline
- `src/main/agent-session-events/AgentSessionEventProcessorV2.ts`
  - Main event processing logic
  - Return type: `Promise<NormalizedAgentSessionEvent>` → `Promise<RepoNormalizedUniversalAgentSessionEvent>`
  - Impact: Breaks event processing pipeline

- `src/main/agent-session-events/BatchEventReprocessor.ts`
  - Batch event reprocessing
  - Uses `NormalizedAgentSessionEvent[]` for processing
  - Impact: Affects data migration and reprocessing

- `src/main/services/SessionViewService.ts`
  - Session segmentation and analysis
  - Multiple methods using `NormalizedAgentSessionEvent`
  - Impact: Affects session visualization

#### Storage & Persistence
- `src/main/storage-providers/typed-namespaces.ts`
  - Storage type definitions
  - `events: NormalizedAgentSessionEvent[]` → `events: RepoNormalizedUniversalAgentSessionEvent[]`
  - Impact: Database schema changes

### 🟡 High Priority (Week 2)

#### IPC Interfaces
- `src/shared/main-process-api-interfaces/AgentSessionAPI.ts`
  - `getSessionEvents(): Promise<NormalizedAgentSessionEvent[]>` → `Promise<RepoNormalizedUniversalAgentSessionEvent[]>`
  - Impact: Breaking API change for UI

- `src/shared/sessionViewTypes.ts`
  - `events: NormalizedAgentSessionEvent[]` → `events: RepoNormalizedUniversalAgentSessionEvent[]`
  - Impact: UI data structure changes

- `src/window/main-process-api-implementations/agentSessionEventsApi.ts`
  - IPC implementation
  - Event type handling in API responses

### 🟢 Medium Priority (Week 3)

#### UI Components (Main Process)
- `src/renderer/main-process-api/AgentSessionService.ts`
  - Service layer methods
  - `extractFilePath()`, `extractWrittenFiles()`, etc.
  - Impact: UI data extraction logic

- `src/renderer/hooks/useSessionEventProcessor.ts`
  - Event processing hook
  - Type definitions for event handling

#### UI Components (Renderer)
- `src/renderer/components/session-history/EventCarousel.tsx`
  - Event grouping and display
  - Type: `NormalizedAgentSessionEvent[]`

- `src/renderer/components/session-history/EventHistoryModal.tsx`
  - Event history display
  - Event loading and rendering

- `src/renderer/components/session-history/EventSegmentView.tsx`
  - Event segment visualization
  - Path quality analysis

- `src/renderer/components/agent-session-debug/NormalizedEventCard.tsx`
  - Event debugging UI
  - Event property display

- `src/renderer/components/agent-session-debug/AgentSessionDebugModal.tsx`
  - Debug modal interface
  - Event inspection tools

#### Repository Maps
- `src/renderer/components/repository-maps/ArchivedAgentSessionsPanel.tsx`
  - Archive session display
  - Event file path extraction

- `src/renderer/components/repository-maps/EventDetailsModal.tsx`
  - Event detail view
  - Event property inspection

### 🟣 Low Priority (Week 4)

#### Specialized Views
- `src/renderer/pages/MultiFileEditorWindow.tsx`
  - **Status**: Has type alias `type NormalizedAgentSessionEvent = RepoNormalizedUniversalAgentSessionEvent`
  - **Action**: Update import to use new type directly

- `src/renderer/repo-manager/LocalDevelopmentView.tsx` (removed)
  - Legacy session event handling (retired with Local Development panel)

- `src/renderer/components/repository-maps/SessionEventViewerModal.tsx`
  - **Status**: Has type alias
  - **Action**: Update import

- `src/renderer/components/repository-maps/SessionEventsView.tsx`
  - **Status**: Has type alias
  - **Action**: Update import

- `src/renderer/components/agent-session-debug/EventProcessingTestView.tsx`
  - **Status**: Has type alias
  - **Action**: Update import

- `src/renderer/components/agent-session-debug/ArchiveTestView.tsx`
  - **Status**: Has type alias
  - **Action**: Update import

#### Shared Processing Logic
- `src/shared/event-processing/SessionEventProcessor.ts`
  - Shared event processing interfaces
  - `IEventProcessor.process(event: NormalizedAgentSessionEvent)`

#### Observability
- `src/main/observability/ObservabilityIntegration.ts`
  - Observability event processing
  - May need adapter for external systems

## Migration Strategy (Pre-release Clean Break)

### Phase 1: Core Infrastructure (Week 1)
1. **BREAKING**: Update all core processing pipeline to use `RepoNormalizedUniversalAgentSessionEvent`
2. **BREAKING**: Modify storage interfaces - no migration of existing data needed
3. **BREAKING**: Update IPC contracts immediately
4. Implement path normalization service

### Phase 2: Complete Type Migration (Week 2)
1. **BREAKING**: Update all IPC implementations
2. **BREAKING**: Replace all `NormalizedAgentSessionEvent` imports with `RepoNormalizedUniversalAgentSessionEvent`
3. Remove all type aliases and temporary compatibility code
4. Update shared type definitions

### Phase 3: UI Component Updates (Week 3)
1. Update all component imports
2. Handle new `provider` field in UI logic
3. Update event property access patterns
4. Update file path extraction logic
5. Test all UI functionality

### Phase 4: Testing & Polish (Week 4)
1. Comprehensive testing with new types
2. Performance validation
3. Documentation updates
4. Remove any remaining old type references

## No Backward Compatibility (Pre-release)

Since this is pre-release, we can make clean breaking changes:
- **No gradual migration** - Update everything at once
- **No compatibility adapters** - Direct replacement of types
- **Clean break** - All components must be updated simultaneously
- **No legacy support** - Remove old type definitions entirely

## Testing Requirements

### Unit Tests
- Test event processing pipeline with new types
- Verify path normalization works correctly
- Test IPC interfaces with new event structures

### Integration Tests
- End-to-end event processing from agent to UI
- Data persistence and retrieval
- Cross-platform path handling (Windows/Mac/Linux)

### UI Tests
- Event display components render correctly
- File path extraction works
- Session segmentation logic

## Risk Assessment (Pre-release Clean Break)

### High Risk (All Changes Breaking)
- **Complete type replacement** - All files must be updated simultaneously
- **IPC contract changes** - UI and main process must be updated together
- **Storage schema changes** - No migration path for existing data
- **Path normalization dependency** - Must be implemented before migration

### Medium Risk
- **UI component updates** - Many files need import and logic changes
- **Event processing logic** - Path extraction and provider field handling
- **Testing scope** - All functionality must be re-tested

### Low Risk
- **Type-only changes** - Most updates are import/type replacements
- **No legacy code** - Clean removal of old types
- **Well-defined interfaces** - New types are clearly specified

## Success Criteria

- [ ] All core processing uses `RepoNormalizedUniversalAgentSessionEvent`
- [ ] Storage persists events with repository context
- [ ] UI displays events with proper provider information
- [ ] Path normalization provides accurate repository-relative paths
- [ ] Backward compatibility maintained during transition
- [ ] All tests pass with new event structure
- [ ] Performance impact minimal (<5% degradation)

## Rollback Plan (Pre-release)

Since this is a clean break migration:

1. **Immediate**: Revert all changes as a single commit
2. **Short-term**: Restore from backup or previous commit
3. **Prevention**: Ensure comprehensive testing before merge
4. **No partial migration**: Either all changes work or none do

## Dependencies

- `@principal-ai/agent-monitoring` package must be updated
- Path normalization service must be implemented
- Repository detection logic must be available
- UI team coordination for breaking API changes

## Timeline

- **Week 1**: Core infrastructure migration
- **Week 2**: API and storage updates
- **Week 3**: UI component updates
- **Week 4**: Testing, cleanup, and documentation

## Contacts

- **Lead**: [Migration lead]
- **UI Team**: [UI team contact]
- **Testing**: [QA contact]
- **DevOps**: [Infrastructure contact]

---

*This audit was generated on 2025-09-21 based on comprehensive codebase search. File counts and priorities may change as migration progresses.*