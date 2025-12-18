# Git Status Architecture Consolidation

## Summary

Investigation revealed that the "duplicate systems" were actually **dead code** that was never cleaned up. The app exclusively uses Repository Monitoring for git status - the legacy systems had no callers.

## What Was Removed

### Deleted Files
- `src/main/services/GitStatusService.ts` - Dead service with its own cache, never imported
- `src/main/version-control-providers/GitService.ts` - Dead service, never imported
- `src/main/version-control-providers/gitBranchService.ts` - Only used by the two dead services above

### Removed IPC Handlers (gitHandlers.ts)
- `GitEvents.GET_STATUS` - Never called
- `GitEvents.GET_DETAILED_CHANGES` - Never called
- `GitEvents.GET_UNCOMMITTED_CHANGES` - Never called

### Removed API Methods
**renderer/main-process-api/GitService.ts:**
- `getStatus()` - Never called
- `getDetailedChanges()` - Never called
- `getUncommittedChanges()` - Never called
- `onStatusUpdate()` - Never called

**window/main-process-api-implementations/gitApi.ts:**
- `getStatus` - Never called
- `getDetailedChanges` - Never called
- `getUncommittedChanges` - Never called
- `onStatusUpdate` - Never called

**shared/main-process-api-interfaces/GitAPI.ts:**
- Removed `GET_STATUS`, `GET_DETAILED_CHANGES`, `GET_UNCOMMITTED_CHANGES` from enum
- Removed corresponding method signatures from `GitAPI` interface
- Removed `onStatusUpdate` method signature

## Current Architecture (Clean)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CURRENT ARCHITECTURE (Single Source of Truth)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                    ┌─────────────────────────────────────┐                  │
│                    │   Repository Monitoring Server       │                  │
│                    │   (@principal-ai/repository-        │                  │
│                    │    monitoring-server)               │                  │
│                    │                                      │                  │
│                    │   • File watching (chokidar)        │                  │
│                    │   • Git status cache                │                  │
│                    │   • Smart window broadcasting       │                  │
│                    │   • Event-driven updates            │                  │
│                    └─────────────────┬───────────────────┘                  │
│                                      │                                       │
│              ┌───────────────────────┼───────────────────────┐              │
│              │                       │                       │              │
│              ▼                       ▼                       ▼              │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐       │
│   │ IPC Handlers     │   │ Renderer Service │   │   React Hooks    │       │
│   │ (ipcHandlers.ts) │   │ (Monitoring      │   │ (useRepository   │       │
│   │                  │   │  Service.ts)     │   │  GitStatus)      │       │
│   └──────────────────┘   └──────────────────┘   └──────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Remaining Git APIs (gitHandlers.ts)

These are still active and used:
- `GET_REPOSITORY_INFO` - Get repo metadata (root, remotes)
- `CHECK_IF_PRIVATE_REPO` - Check if GitHub repo is private
- `GET_COMMIT_HISTORY` - Get commit log
- `EXECUTE_COMMAND` - Raw git command execution
- `CLONE_REPOSITORY` - Clone a repository
- `CHECK_AUTH_METHODS` - Check SSH/HTTPS auth availability
- `DELETE_GIT_REPOSITORY` / `FORCE_DELETE_GIT_REPOSITORY` - Delete repos

## Completed Optimizations

### Hook Double-Fetch (Fixed)
**Files:**
- `src/renderer/hooks/useRepositoryGitStatus.ts`
- `src/renderer/contexts/RepositoryPanelContext.tsx`

Previously, the hook and context made redundant IPC calls:
- On initial load: 2 IPC calls (`getGitStatus` + `getGitStatusWithFiles`)
- On status change event: 1 IPC call to re-fetch since event only had metadata

**Solution:** Modified `@principal-ai/repository-monitoring-server` (v2.1.5) to:
1. Emit `GitStatusWithFiles` instead of `GitStatusMetadata` in events
2. Add handler to forward `GIT_STATUS_CHANGED` events via `parentPort.postMessage()`

Now the flow is:
- On initial load: 1 IPC call (`getGitStatusWithFiles` only)
- On status change event: 0 IPC calls (event includes full data)

### GitRepositoryService Methods
**File:** `src/main/file-system/gitRepositoryService.ts`

The `getGitStatus()`, `getUncommittedChanges()`, and `getDetailedChanges()` methods still exist but are no longer called via IPC. They could be removed or kept for internal use by other main-process code.

## Package Versions

- `@principal-ai/repository-monitoring-server`: 2.1.5

## Verification

Typecheck passes with no new errors introduced by these changes.
