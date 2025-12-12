## Git Watcher Enhancement Plan

### Goal
Monitor repository changes at full depth while respecting `.gitignore` so that nested markdown/doc updates immediately refresh UI timestamps without the current depth limit.

### Proposed Steps
1. **Expose ignore patterns**  
   - File: `src/shared/repository-core/FileSystemCore.ts`  
   - Add a helper (e.g., `getWatchIgnoreGlobs`) that returns the same glob list used by `buildFilteredFileTree`, combining universal ignores and `.gitignore` entries without building the entire tree.

2. **Reconfigure chokidar watchers**  
   - File: `src/repository-monitoring-server/RepositoryMonitoringServer.ts`  
   - Update `setupMinimalGitWatching` and `setupFallbackGitWatching` to:  
     - Remove the `depth` option so chokidar observes the full directory tree.  
     - Call the new helper for ignore globs and feed them to chokidar’s `ignored` option (alongside our explicit `.git`, `node_modules`, etc. exclusions).  
     - Ensure watchers rebuild their ignore list when initialization fails or `.gitignore` changes.

3. **Maintain cache consistency**  
   - File: `src/repository-monitoring-server/RepositoryMonitoringServer.ts` (`handleGitChange`)  
   - Clear `fileTreeCache` / `packageCache` (already done) and consider restarting the watcher if `.gitignore` itself changes so new patterns take effect.

4. **Verification**  
   - Manual: edit/delete deeply nested files (e.g., `docs/subdir/file.md`) and confirm the repository list’s timestamps update immediately.  
   - Optional test: extend `src/repository-monitoring-server/RepositoryMonitoringServer.test.ts` to simulate a deep path change and assert a git-status event fires.
