## Git Watcher Behavior Notes

### Implemented Enhancements
- `FileSystemCore.getWatchIgnoreGlobs(repoPath)` now returns chokidar-ready globs that merge universal ignore directories, repository `.gitignore` entries, and absolute `.git` paths (including `fsmonitor--daemon.ipc`).
- `FileSystemCore.createWatchIgnorePredicate(repoPath, patterns)` wraps the glob list in a predicate that evaluates both absolute and repo-relative matches using `minimatch`, ensuring `.git` internals are skipped while real workspace files remain visible.
- `RepositoryMonitoringServer` wires the predicate into both minimal and fallback chokidar watchers, enables `ignorePermissionErrors`, and restarts watchers automatically on recoverable failures or `.gitignore` edits.

### Expected Runtime Effects
- Watchers observe the full repository depth with `.gitignore` + universal exclusions applied, so nested docs (e.g., `docs/design/mcp-integration-plan.md`) trigger `handleFileChange` invalidation immediately.
- `.git/fsmonitor--daemon.ipc` and other ignored artifacts no longer surface `UNKNOWN` watcher errors; these are filtered before chokidar registers the path or are explicitly ignored when reported.
- Editing or deleting `.gitignore` forces a watcher restart within ~300 ms so new patterns take effect without manual intervention.

### Suggested Library Test Coverage
1. **Deep file change**: Simulate creating and deleting a nested Markdown file under `docs/` and assert a git status change event (or cache invalidation call) occurs without depth limits.
2. **.gitignore update**: Modify `.gitignore`, confirm the watcher restarts, and verify the updated patterns are honored on subsequent file changes.
3. **fsmonitor socket resilience**: Emit an artificial `UNKNOWN` error targeting `.git/fsmonitor--daemon.ipc` and ensure it is swallowed without disabling the watcher.
4. **Universal ignore enforcement**: Place activity in `node_modules/` or other universal directories and assert no watcher events fire.
