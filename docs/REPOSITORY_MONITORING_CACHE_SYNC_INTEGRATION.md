# Repository Monitoring Cache Sync Integration Plan

## Purpose
This plan captures the concrete engineering work required to integrate the new `RepositoryCacheRegistry` infrastructure into the repository monitoring pipeline so that renderer caches stay in sync with the worker’s authoritative data. It breaks down the effort across worker, main process, and renderer responsibilities and outlines verification and rollout considerations.

## Prerequisites
- Land the `RepositoryCacheRegistry` implementation and related type definitions in `src/repository-monitoring-server/cache`.
- Verify unit tests for the registry pass locally (`RepositoryCacheRegistry.test.ts`).
- Confirm telemetry/logging utilities used by repository monitoring are available in both worker and renderer environments.

## Worker Integration Tasks
1. **Instantiate the registry**
   - Create a singleton `RepositoryCacheRegistry` during worker boot (`RepositoryMonitoringServer` constructor or initialization path).
   - Ensure dependency injection allows builders (file tree, git status, packages) to be supplied to the registry.

2. **Refactor data fetch methods**
   - Update `getGitStatusWithFiles`, `getFileTree`, and package summary fetchers to call `cacheRegistry.getOrBuild(...)`.
   - Return `{ data, version, hash }` objects to callers; update RPC handlers to forward the augmented payloads.

3. **Schedule proactive rebuilds**
   - In workspace file system event handlers, debounce and call `cacheRegistry.scheduleRebuild(repoPath, 'fileTree' | 'packages', builder)`.
   - In git watcher event handlers, trigger immediate rebuilds for the `gitStatus` slice.
   - Implement slice-specific debounce timers (≈250 ms) and enforce a concurrency limit (e.g., 2 builds at a time).

4. **Emit cache sync events**
   - Subscribe to the registry’s `cacheUpdated` events.
   - Translate events into `MonitoringInternalEvent.CACHE_SYNC` payloads containing slice versions, hashes, data, and any serialized errors.
   - Forward events to the main process via the existing IPC channel.

5. **Expose snapshot RPC**
   - Add a `getRepositoryCacheSnapshot(repoPath: string)` handler that returns all slices currently registered.
   - Include last error metadata so callers can surface failure states without triggering redundant rebuilds.

## Main Process Tasks
1. **Forward cache sync events**
   - Extend `RepositoryMonitoringManager` to listen for worker `CACHE_SYNC` events and broadcast them to all renderer windows.

2. **Bridge snapshot requests**
   - Expose a new IPC request from renderer to main that proxies `getRepositoryCacheSnapshot` to the worker and returns its response.

3. **Backwards compatibility**
   - Maintain existing `getFileTree`/`getGitStatus`/`getPackages` IPC handlers temporarily, but mark them deprecated and ensure they internally rely on the registry-backed versions.

## Renderer Tasks
1. **Hydrate from snapshot**
   - Update `RepositoryDataCache` initialization to call the new snapshot API and populate local slices with `{ data, version, hash }` tuples.

2. **Store version metadata**
   - Extend renderer cache state to store versions/hashes alongside data.
   - Ensure selectors/components use cached data without issuing RPCs when versions match.

3. **Process cache sync events**
   - Subscribe to `CACHE_SYNC` IPC events.
   - For each slice payload:
     - Replace local data when the incoming version is newer.
     - Handle invalidations (payload lacking `data`) by scheduling background refetches and showing stale indicators.
     - Log and recover if hash changes without a version bump.

4. **UI feedback**
   - Surface stale/error states in repository detail views (e.g., badges, tooltips) based on registry metadata.

## Telemetry & Observability
- Track cache hit/miss metrics within the worker after each `getOrBuild` invocation.
- Emit timing metrics for rebuild durations and queue depth.
- Log renderer-side fallbacks when hashes mismatch or invalidations trigger manual refetches.

## Testing Strategy
- Extend worker unit tests to cover rebuild scheduling, debounce behavior, and cache sync emissions.
- Add integration tests (or high-level Jest tests) that simulate event flow from worker to renderer, verifying versions are respected.
- Manually QA by:
  - Registering multiple repositories and generating rapid file changes to confirm debouncing.
  - Observing renderer behavior when worker intentionally throws errors during rebuilds.

## Rollout Considerations
- Feature-flag the new cache sync pathway, allowing fallback to legacy behavior if issues arise.
- Stage deployment by enabling the feature for internal testers before rolling out broadly.
- Document rollback steps: disable the feature flag, flush in-memory caches, and restart worker/renderer processes.

## Timeline Estimate
1. Worker integration: 3–4 engineering days (including tests).
2. Main process bridge: 1 day.
3. Renderer cache updates & UI polish: 4–5 days.
4. Testing, telemetry, and rollout prep: 2 days.

Total: approximately 2 weeks elapsed time with parallel efforts across platform and frontend engineers.
