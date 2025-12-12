# Archive Session Functionality Cleanup Plan

## Overview

This document outlines the plan to remove archived session functionality from the application and transition to using only the Turso-based observability SDK for fetching recent agent sessions (within the last 24 hours).

## Current State

The application currently has a hybrid approach:

* Local storage for archived sessions
* Observability SDK (`@principal-ai/observability-sdk`) for Turso-based session storage
* Mixed usage of both systems in the UI

## Goal

* Remove all local archive functionality
* Use only Turso (via observability SDK) for session data
* Only support fetching sessions from the last 24 hours

## Files to Modify/Remove

### 1. API Interface Layer

**Files to modify:**

* `src/shared/main-process-api-interfaces/AgentSessionAPI.ts`
  * Remove: `getArchivedSessions()` method
  * Remove: `GET_ARCHIVED_SESSIONS` event
  * Remove: `SESSION_ARCHIVED` event
  * Remove: `onSessionArchived()` listener
  * Keep: Active session methods only
* `src/window/main-process-api-implementations/agentSessionApi.ts`
  * Remove: `getArchivedSessions()` implementation
  * Remove: `onSessionArchived()` implementation
  * Remove: `deleteFromActive()` (archive-related)

### 2. Archive Configuration

**Files to remove entirely:**

* `src/main/stores/ArchiveConfiguration.ts` - Complete removal
* Remove any imports/references to `ArchiveConfigurationService` or `archiveConfigService`

### 3. UI Components

**Files to modify:**

* `src/renderer/repo-manager/shared/AgentSessionsTab.tsx` (removed)
  * Legacy archive UI retired with Local Development panel
* `src/renderer/repo-manager/shared/AgentSessionCard.tsx`
  * Remove: `onArchive` prop from interface
  * Remove: Any archive button/UI in the card
* `src/renderer/pages/StoreViewer.tsx`
  * Remove: Archive cleanup buttons (lines \~952-975)
  * Remove: `includeArchives` parameter from cleanup calls
  * Update: Storage metrics to not show archive-related stats
* `src/renderer/components/repository-maps/AgentSessionDetailView.tsx`
  * Remove: Any archive-related display logic

**Files to remove entirely (unused session details window):**

* `src/renderer/components/agent-overview/SessionDetailsPanel.tsx` - Unused component for archived sessions
* `src/renderer/components/agent-overview/SessionDetailsHeader.tsx` - Related header component
* `src/renderer/components/Titlebar/SessionDetailsTitlebar.tsx` - Titlebar for the unused window

### 4. Session Types

**Files to modify:**

* `src/renderer/types/session.types.ts`
  * Remove: `archivedAt` field if present
  * Remove: `isArchived` field if present
  * Remove: Any archive-related type definitions
* `src/shared/main-process-api-interfaces/AgentSessionAPI.ts`
  * Update `SessionSummary` interface to remove archive fields
  * Update `getSessionsForDirectory` to remove `archived` array from return type

### 5. Storage Namespaces

**Files to modify:**

* `src/main/storage-providers/typed-namespaces.ts`
  * Remove: `ARCHIVE_CONFIGURATION` namespace
  * Remove: Any archive-related type definitions

### 6. Session Fetching Logic

**Files to modify:**

* `src/renderer/main-process-api/AgentSessionSDKService.ts`
  * Ensure all methods use SDK only
  * Add 24-hour filter to session queries
* `src/renderer/hooks/useAgentSessions.ts`
  * Remove any archive-related logic
  * Ensure only fetching active sessions from last 24 hours

### 7. Observability Integration

**Files to modify:**

* `src/main/observability/ObservabilityIntegration.ts`
  * Update `getRecentSessions()` calls to include 24-hour filter
  * Remove any archive-related configuration

### 8. Window Handlers

**Files to modify:**

* `src/main/window/modernWindowHandlers.ts`
  * Remove: `OPEN_SESSION_DETAILS` handler (lines \~276-315)
  * Remove: Session details window creation logic
* `src/shared/ipc-events/WindowEvents.ts`
  * Remove: `OPEN_SESSION_DETAILS` enum value

## Implementation Steps

### Phase 1: Update Core APIs (Backend)

1. Modify `AgentSessionAPI.ts` interface to remove archive methods
2. Update main process handlers to remove archive implementations
3. Remove `ArchiveConfiguration.ts` and related services
4. Update storage namespaces to remove archive configuration

### Phase 2: Update Session Fetching

1. Modify `AgentSessionSDKService.ts` to add 24-hour filter
2. Update `ObservabilityIntegration.ts` to use time-filtered queries
3. Ensure all session fetching goes through Turso SDK

### Phase 3: Clean UI Components

1. Remove archive UI from `AgentSessionsTab.tsx` **(completed - component removed)**
2. Clean up session type definitions
3. Remove any archive-related state management
4. Update session cards to remove archive actions

### Phase 4: Testing & Validation

1. Test session fetching with 24-hour filter
2. Verify no archive-related code remains
3. Ensure UI properly displays only recent sessions
4. Check for any broken references

## Migration Notes

### Data Migration

* Existing archived sessions in local storage will become inaccessible
* Consider if any critical archived data needs to be migrated to Turso before cleanup

### API Compatibility

* This is a breaking change for any code expecting archive functionality
* Update any documentation referring to session archiving

### Performance Considerations

* Fetching from Turso may have different performance characteristics
* Consider implementing caching for frequently accessed sessions
* Monitor query performance with 24-hour filters

## Rollback Plan

If issues arise:

1. Keep the removed code in a separate branch initially
2. Document the commit where archive functionality was removed
3. Have a plan to quickly restore if critical issues are found

## Success Criteria

* [ ] All archive-related code removed
* [ ] Sessions only fetched from Turso for last 24 hours
* [ ] No UI references to archiving functionality
* [ ] All tests passing
* [ ] No console errors related to missing archive methods