# Missing or Moved Symbols – Investigation Checklist

This document captures the primary TypeScript errors that remain after the recent lint/typecheck fixes. Each section lists the symbol that no longer resolves, where it is still referenced, and any immediate observations to help decide whether the symbol should be restored or the references removed.

## 1. MCP server filename

- **Status:** `APP_BRANDING.MCP_SERVER_FILENAME` references were removed. `mcp-integration.ts` now uses a local constant (`'principal-ai-mcp-server.cjs'`) when resolving the bundled server.

## 2. `AgentEventNamespaces`

- **Status:** References removed. Storage namespaces now rely solely on `StaticNamespaces`, so no further action is required unless agent-specific namespaces need to be reintroduced later.

## 3. `GitWatcherAPI` module & GitStatus Type Fragmentation

### Missing GitWatcherAPI References
- **References:**
  - `src/shared/main-process-api-interfaces/GitAPI.ts` (line 1)
  - ~~`src/renderer/utils/tagUtils.ts`~~ (DELETED)
  - `src/renderer/main-process-api/GitService.ts` (line 2)
  - `src/renderer/unused/RepositorySettingsModal.tsx`, ~~`RepositoryCard.tsx`~~ (DELETED)
- **Missing file:** `src/shared/main-process-api-interfaces/GitWatcherAPI.ts` no longer exists. Documentation (`docs/GIT_WATCHER_MIGRATION_COMPLETE.md`) indicates it was intentionally removed.

### GitStatus Interface Analysis
The codebase has **9 different GitStatus interface definitions** that fall into **4 distinct patterns**:

#### Pattern A: Repository-centric status (3 instances - IDENTICAL)
```typescript
interface GitStatus {
  repoPath: string;
  branch: string;
  isDirty: boolean;
  hasUntracked: boolean;
  hasStaged: boolean;
  ahead: number;
  behind: number;
  watchingEnabled?: boolean; // only in RepositoryMonitoringAPI
}
```
**Found in:**
- `src/shared/types/git.types.ts`
- `src/repository-monitoring-server/types.ts`
- `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts` (adds `watchingEnabled`)

#### Pattern B: Simple file arrays (3 instances - IDENTICAL)
```typescript
interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}
```
**Found in:**
- `src/main/electron-cli-bridge/executors/GitExecutor.ts`
- `src/window/main-process-api-implementations/gitApi.ts`
- `src/renderer/main-process-api/GitService.ts` (local definition)

#### Pattern C: File arrays with metadata (1 instance)
```typescript
interface GitStatus {
  staged: Array<{ path: string; lastModified?: string }>;
  unstaged: Array<{ path: string; lastModified?: string }>;
  untracked: Array<{ path: string; lastModified?: string }>;
  deleted: Array<{ path: string; lastModified?: string }>;
}
```
**Found in:**
- `src/shared/types/repository.types.ts`

#### Pattern D: Different property names (1 instance)
```typescript
interface GitStatus {
  staged: string[];
  modified: string[];    // Note: "modified" instead of "unstaged"
  not_added: string[];   // Note: "not_added" instead of "untracked"
  deleted: string[];
}
```
**Found in:**
- `src/shared/repository-core/GitCore.ts`

### Recommendations
1. **Centralize GitStatus**: Create a single canonical definition, likely in `src/shared/types/git.types.ts`
2. **Fix imports**: Update `GitAPI.ts` and `GitService.ts` to import from the centralized location
3. **Reconcile differences**: Decide between:
   - Repository-centric (Pattern A) for monitoring/status tracking
   - File-centric (Pattern B/C/D) for operations/commands
   - Or create separate types: `GitRepositoryStatus` vs `GitFileStatus`

## 4. Repository monitoring server gaps

- **Missing exports:** `src/repository-monitoring-server/RepositoryMonitoringServer.ts` imports `ToolExecutionResult` from `./types`, but `types.ts` no longer declares it.
- **Orphaned commands:** `src/repository-monitoring-server/worker-entry.ts` dispatches a `runTool` command and expects `RepositoryMonitoringServer.runTool`, yet the class does not implement the method.
- **Action:** Decide whether to reinstate the tool-execution plumbing or remove the dead `runTool` pathway from the worker/types.

## 5. `AgentSettings` shape regressions

- **References:** `src/main/agent-management/agentConfigHandlers.ts` reads `settings.hooks` and `settings.experimental.*` in multiple locations (lines ~240-270).
- **Current type:** `src/shared/types/legacy-event.types.ts` defines `AgentSettings` with only `{ provider, enabled, settings? }`, and `@principal-ai/agent-monitoring` no longer exports an `AgentSettings` interface.
- **Impact:** TypeScript now rejects access to `hooks`/`experimental`. Determine whether those fields should be added back to the shared type, or if the handler should be rewritten to consume the new configuration structure.

## 6. `IModernApplicationWindow.fileWatcher`

- **References:** `src/main/file-system/fileSystemHandlers.ts` (lines ~1115-1120) assigns to `window.fileWatcher`.
- **Issue:** The `IModernApplicationWindow` interface (check `src/main/window/types.ts`) no longer defines `fileWatcher`.
- **Next step:** Either restore the property to the interface or update the file-system handlers to track the watcher elsewhere.

## 7. Additional quick hits surfaced by `tsc`

- `src/shared/main-process-api-interfaces/AgentConfigAPI.ts` imports `AgentSettings` from `@principal-ai/agent-monitoring`, but that package no longer exports it.
- Several renderer tests (`src/renderer/services/MonitoredFileTreeService.test.ts`, etc.) still rely on helpers like `mockFileTree` and on enums such as `SourceType` values that may have moved.
- Multiple repository-monitoring tests reference directory/file info shapes (`DirectoryInfo`, `FileInfo`) with now-removed `type` fields and missing `manifestPath` entries.

---

Use this checklist to confirm which symbols should be reintroduced versus which consumer code must be updated. Once decisions are made, we can eliminate the remaining TypeScript diagnostics accordingly.
