# Shared Git Status Feature

## Overview

Enable users to see the git status of repositories that other users have open, displayed on the Activity Cities visualization.

## Current State

### What Works Now

| Feature | Status | API |
|---------|--------|-----|
| Know who is online | ✅ | `PresenceService.getUsers()` → `user.status` |
| Which repos users have open | ✅ | `user.openRepositories[]` |
| Branch per repo | ✅ | `repoSession.branch` |
| Current file (type exists) | ⚠️ | `repoSession.currentFile` - not populated |
| Has unsaved changes (type exists) | ⚠️ | `repoSession.hasUnsavedChanges` - not populated |

### Data Flow (Current)

```
User Opens Repo
      │
      ▼
reportRepositoryOpened(owner, repo, branch)
      │
      ▼
presence:repo_open { repoId, branch }  ← Only sends repoId + branch
      │
      ▼
Traffic Controller stores in RepositorySession
      │
      ▼
Other users receive presence_updated event
      │
      ▼
Activity Cities shows repo card (no git status)
```

## Proposed Enhancement

### Goal

Show on each Activity City card:
- Whether the repo has uncommitted changes (dirty indicator)
- Number of modified/staged files (optional)
- Ahead/behind remote counts (optional)

### Data Model

The `RepositorySession` type in `@principal-ai/control-tower-core` already supports:

```typescript
interface RepositorySession {
  repoId: string;
  branch: string;
  openedAt: number;
  lastActivity: number;
  currentFile?: string;           // ← Use this
  hasUnsavedChanges?: boolean;    // ← Use this
  permissions: { canRead, canWrite, canAdmin };
  agentId: string;
  clientType?: "desktop" | "web";
}
```

### Reuse Existing Type: `GitStatusWithFiles`

The codebase already has `GitStatusWithFiles` from `@principal-ai/repository-abstraction`:

```typescript
// From @principal-ai/repository-abstraction
interface GitStatusWithFiles extends GitStatusMetadata {
  modifiedFiles: string[];      // Modified but not staged
  untrackedFiles: string[];     // New untracked files
  stagedFiles: string[];        // Staged for commit
  createdFiles: string[];       // Newly created files
  deletedFiles: string[];       // Deleted files
  hash: string;                 // Content hash for React memoization
}

interface GitStatusMetadata {
  repoPath: string;             // Absolute path (local only)
  branch: string;               // Current branch
  isDirty: boolean;             // Has uncommitted changes
  hasUntracked: boolean;        // Has untracked files
  hasStaged: boolean;           // Has staged files
  ahead: number;                // Commits ahead of remote
  behind: number;               // Commits behind remote
  watchingEnabled: boolean;     // File watching enabled
  lastChangedAt?: string;       // ISO timestamp of last change
}
```

**For sharing over the wire**, we use a subset (omit `repoPath`, `watchingEnabled`):

```typescript
// What gets sent in presence:repo_status_update
type SharedGitStatus = Omit<GitStatusWithFiles, 'repoPath' | 'watchingEnabled'>;
```

### Update Strategy

- **Debounce:** 1 second after any file system change
- **Granularity:** Full file lists (not just counts)
- **Privacy:** No restrictions for now (all status shared)

## Implementation Plan

### Phase 1: Populate Existing Fields

**Files to modify:**

1. `src/main/services/GitSyncWebSocketManager.ts`
   - Update `reportRepositoryOpened()` to include `hasUnsavedChanges`
   - Add `reportRepositoryStatusUpdate()` method

2. `src/main/services/PresenceIPC.ts`
   - Expose new IPC handler for status updates

3. `src/renderer/main-process-api/PresenceService.ts`
   - Add `updateRepositoryStatus()` method

4. `src/renderer/hooks/useActivityCities.ts`
   - Consume `hasUnsavedChanges` from presence data
   - Pass to city card component

5. `src/renderer/components/ActivityCities/CityCard.tsx`
   - Display dirty indicator on city visualization

### Phase 2: Real-time Status Updates

**Trigger points for status updates:**

1. **On file change** - File created, modified, deleted (via chokidar watcher)
2. **On git operations** - Commit, checkout, pull, push, stash
3. **On window focus** - Refresh when user returns to app

**Debounce strategy:** 1 second debounce after any trigger

**New WebSocket messages:**

```typescript
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';

// Subset of GitStatusWithFiles for wire transport
type SharedGitStatus = Omit<GitStatusWithFiles, 'repoPath' | 'watchingEnabled'>;

// Client → Server
'presence:repo_status_update': {
  repoId: string;
  currentFile?: string;
  gitStatus: SharedGitStatus;
}

// Server → Clients (broadcast)
'presence:repo_status_changed': {
  userId: string;
  repoId: string;
  gitStatus: SharedGitStatus;
}
```

### Phase 3: City Visualization

**Visual indicators on Activity City cards:**

| State | Visual |
|-------|--------|
| Clean (no changes) | Normal city colors |
| Dirty (uncommitted) | Yellow/orange glow or badge |
| Ahead of remote | Up arrow indicator |
| Behind remote | Down arrow indicator |
| Conflicts | Red warning indicator |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User A's Desktop                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ File Watcher    │───►│ RepositoryMonitoringService  │   │
│  │ (chokidar)      │    │ - getGitStatus()             │   │
│  └─────────────────┘    └──────────────┬───────────────┘   │
│                                        │                    │
│                                        ▼                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PresenceService.updateRepositoryStatus()            │   │
│  │ - Calls presence:repo_status_update via WebSocket   │   │
│  └─────────────────────────────────────┬───────────────┘   │
└────────────────────────────────────────┼────────────────────┘
                                         │
                                         ▼
                    ┌────────────────────────────────────┐
                    │        Traffic Controller          │
                    │  - Stores status in UserPresence   │
                    │  - Broadcasts to subscribers       │
                    └────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     User B's Desktop                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ useActivityCities hook                              │   │
│  │ - Receives presence:repo_status_changed             │   │
│  │ - Updates repository state with git status          │   │
│  └─────────────────────────────────────┬───────────────┘   │
│                                        │                    │
│                                        ▼                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CityCard Component                                  │   │
│  │ - Renders dirty indicator if hasUnsavedChanges      │   │
│  │ - Shows ahead/behind badges                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `@principal-ai/repository-abstraction` | `GitStatusWithFiles` type definition |
| `@principal-ai/repository-monitoring-server` | Git status monitoring (file watcher) |
| `src/main/services/GitSyncWebSocketManager.ts` | WebSocket connection + presence requests |
| `src/renderer/main-process-api/RepositoryMonitoringService.ts` | Renderer API for git status |
| `src/renderer/hooks/useRepositoryGitStatus.ts` | Existing hook for local git status |
| `src/renderer/hooks/useActivityCities.ts` | Aggregates presence into city data |
| `src/renderer/components/ActivityCities/CityCard.tsx` | Renders individual city |

## OTEL Canvas Updates Required

1. **`git-sync.otel.canvas`** - Add events for:
   - `git_sync.status.update_sent` - Client sends status update
   - `git_sync.status.update_received` - Client receives peer status

2. **`activity-cities.otel.canvas`** - Add events for:
   - `activity_cities.status.received` - Status update applied to city
   - `activity_cities.status.rendered` - Dirty indicator displayed

## Design Decisions

| Decision | Choice |
|----------|--------|
| Granularity | Full file lists |
| Debounce | 1 second |
| Privacy | None for now (all shared) |
| Scope | Per-repo (branch included in session) |

## Open Questions

1. Should we show the current file someone is editing?
2. How to visualize multiple modified files on the city?
3. Should file paths be highlighted as buildings in the city?
