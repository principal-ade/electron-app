# Repository Monitoring Cache Synchronization Design

## Context
The Repository Explorer UI currently depends on the renderer-side `RepositoryDataCache` to minimize redundant requests for git status, file trees, and package metadata. However, the worker process (`repository-monitoring-server`) only exposes five-minute TTL caches with no versioning. Whenever workspace or git events arrive, the worker drops its cache entry and emits a generic change event. The renderer has no way to know if its cached payload is still valid, so it must re-fetch large payloads (tree/package data) after each event. This produces unnecessary IPC round-trips, repeated filesystem traversal, and noticeable UI stalls when multiple repositories are being watched.

## Goals
- Provide a shared cache contract that lets the worker and renderer agree on freshness without redundant fetches.
- Allow the worker to proactively rebuild cached payloads after events and stream deltas to the renderer.
- Maintain compatibility with existing repository registration and git watching flows.
- Keep cache rebuilds bounded so a noisy repo cannot block other work.

## Non-Goals
- Replacing existing `RepositoryDataCache` subscription semantics in the renderer.
- Changing the business logic for building file trees, packages, or git status payloads.
- Implementing persistence of cache data across process restarts (in-memory only).
- Reworking Alexandria indexing or other services that currently consume repository data via separate APIs.

## Success Metrics
- Renderer avoids re-fetching file tree/package/git status payloads when version has not changed (target: ≥80% fewer duplicate RPC calls during repository activity).
- Cache rebuild latency remains under 750ms for median repositories (measured from event receipt to cache-sync emission).
- No increase in failed git/tree/package requests attributable to the new cache coordination.

## Integration Alignment
- The implementation work for this design is captured in [REPOSITORY_MONITORING_CACHE_SYNC_INTEGRATION.md](./REPOSITORY_MONITORING_CACHE_SYNC_INTEGRATION.md). Use that document to translate these architectural requirements into concrete worker, main process, and renderer tasks.
- Main/renderer owners should cross-check the phased efforts in the integration plan against their existing Repository Monitoring milestones to avoid duplicate tracking.
- Observability additions described below tie into the telemetry checklist contained in the integration plan’s “Telemetry & Observability” section.

## Proposed Architecture

### 1. Repository Cache Registry
Introduce a `RepositoryCacheRegistry` singleton within the worker process that tracks per-repository cache entries for the three core payloads today (`gitStatus`, `fileTree`, `packages`) and future slices (quality metrics, markdown indices).

```ts
interface CacheEntry<T> {
  data: T;
  version: number;       // monotonic per repo+slice
  hash: string;          // stable hash for structural comparisons
  timestamp: number;     // last mutation time
  inflight?: Promise<T>; // optional build promise to dedupe concurrent builds
}

interface RepositoryCacheSnapshot {
  repoPath: string;
  slices: {
    gitStatus?: CacheEntry<GitStatusWithFiles>;
    fileTree?: CacheEntry<FileTree>;
    packages?: CacheEntry<PackageSummaryPayload>;
  };
}
```

Key behaviors:
- `getOrBuild(repoPath, slice, builder)` returns cached data if present; otherwise stores the in-flight promise and version increments once the build resolves.
- `update(repoPath, slice, data, hash)` increments version, updates timestamp, and emits a registry-level `cacheUpdated` event.
- `invalidate(repoPath, slice)` bumps version without data when we must force the renderer to drop entries (e.g., fatal build error).

### 2. Versioning & Hashing Strategy
- Maintain a per-repo counter map `Map<string, Map<CacheSlice, number>>` seeded at zero.
- Increment the relevant counter every time data is mutated, including explicit invalidations.
- Compute a fast hash (e.g., xxhash or stable JSON hash) from the canonical payload serialization. Hash protects against version skew bugs where data changes but version fails to increment; renderer can fall back to full refetch if it observes same version with different hash.
- Include both `version` and `hash` in all RPC responses and cache-sync events.

### 3. Cache Build Pipeline
Rework `RepositoryMonitoringServer` methods to delegate to the registry:
- `getFileTree(path)` becomes `return this.cacheRegistry.getOrBuild(path, 'fileTree', () => this.fileTreeBuilder.buildFileTree(path))` and returns `{ data, version, hash }`.
- Similar treatment for `getPackages` (wrapping both `packages` and `summary` into a single payload) and `getGitStatusWithFiles`.
- Registry exposes helper `scheduleRebuild(repoPath, slice, builder, options)` that enqueues build tasks. Use a shared async queue to ensure only `n` builds run concurrently (default `n = 2` to avoid FS thrash).

### 4. Proactive Rebuilds on Events
Modify event handlers to rebuild caches when the worker learns about changes:
- `handleWorkspaceChangeEvent` schedules debounced rebuilds for `fileTree` and `packages` (packages only when file changes include `package.json` or lockfiles). Debounce per repo/slice (e.g., 250ms) to combine bursts.
- `handleGitStateEvent` schedules a git status rebuild immediately (since these are already debounced by the git watcher) and updates repository metadata (ahead/behind, last commit, etc.).
- When a rebuild finishes and data differs (hash changed), registry emits a `cacheUpdated` event that downstream listeners convert into IPC payloads.

### 5. IPC Contract Changes
Extend shared IPC types (`MonitoringInternalEvent` and `ServerToMainMessage`) with new message shapes:

```ts
type CacheSyncMessage = {
  type: MonitoringInternalEvent.CACHE_SYNC;
  repoPath: string;
  slices: {
    [K in CacheSlice]?: {
      version: number;
      hash: string;
      data?: CacheDataForSlice<K>;
      error?: SerializedError;
    };
  };
};
```

- Worker sends `CACHE_SYNC` events whenever registry emits `cacheUpdated` with `data` for successful builds or `error` for failed builds.
- Main process simply forwards these payloads to all renderer windows via `RepositoryMonitoringManager.broadcastToWindows`.
- Add an IPC request `getRepositoryCacheSnapshot(repoPath: string)` that returns `RepositoryCacheSnapshot`. Renderer uses this for initial hydration instead of calling `getFileTree/getPackages/getGitStatus` sequentially.

### 6. Renderer Cache Integration
Adapt `RepositoryDataCache` to align with worker versions:
- Store `{ version, hash }` alongside existing data slices.
- During initialization, call `getRepositoryCacheSnapshot` and hydrate each slice.
- Subscribe to `CACHE_SYNC` events; when an event arrives, compare versions:
  - If the incoming version is newer, update local data with payload (when provided) and emit the cache's usual update events.
  - If only `version` changed and `data` is absent (indicating invalidation), schedule a background RPC to fetch the slice (fallback path).
  - If version is equal but hash differs (should not happen), log warning and refetch to recover.
- Renderer should avoid re-fetching slices if its version matches the worker's version when components request data.

### 7. Error Handling & Resilience
- Registry records build errors per slice and exposes `lastError` metadata so renderer can show actionable messages instead of silent failures.
- Failed rebuilds still increment versions but carry `error` and omit `data`. Renderer will surface the error and optionally retry on user action.
- Introduce timeout + cancellation support for rebuild tasks (configurable via env) to prevent hung operations.

## Sequence Flow
1. Renderer registers repository `R` and calls `getRepositoryCacheSnapshot(R)`.
2. Worker ensures caches exist by invoking registry builders as needed, returning snapshot with versions/hashes/data.
3. Renderer hydrates `RepositoryDataCache` with snapshot and renders UI without additional RPC calls.
4. Workspace event fires; worker schedules rebuild of `fileTree` (debounced).
5. Rebuild finishes; registry updates entry (version `n+1`, new hash), emits `cacheUpdated`.
6. Worker sends `CACHE_SYNC` with slice payload to main; main forwards to renderer windows.
7. Renderer receives event, updates local cache in constant time, and UI re-renders using new data without issuing RPCs.

## Implementation Plan
1. **Infrastructure (Week 1)**
   - Create `RepositoryCacheRegistry` with unit tests covering version increments, inflight dedupe, and error recording.
   - Update worker types (`src/repository-monitoring-server/types.ts`) with `CacheSlice`, metadata interfaces, and IPC payload definitions.

2. **Server Integration (Week 2)**
   - Refactor `RepositoryMonitoringServer` methods to use the registry.
   - Implement debounced rebuild scheduling in workspace/git event handlers.
   - Emit `CACHE_SYNC` messages and ensure `RepositoryMonitoringManager` forwards them.

3. **Renderer Integration (Week 3)**
   - Add new IPC handler in main process for `getRepositoryCacheSnapshot` and expose via `RepositoryMonitoringService`.
   - Extend `RepositoryDataCache` to store versions/hashes, process `CACHE_SYNC`, and rely on snapshot hydration.
   - Update dependent components to consume new cache metadata if necessary (e.g., status badges showing “stale” state).

4. **Validation (Week 4)**
   - Instrument worker logs to measure rebuild durations and registry hits/misses.
   - Add renderer metrics (optional devtools panel logging) to verify reduction in duplicate RPC calls.
   - Run integration tests covering cache hydration and update flows.

## Risks & Mitigations
- **Version skew due to missed increments**: Mitigated by computing hashes and verifying in renderer; discrepancies trigger fallback refetch and telemetry warning.
- **Worker overload from rebuild storms**: Debounce timers plus concurrency limit protect against thrash; also consider per-repo queue if needed.
- **IPC payload size**: File tree data can be large; debouncing ensures we only send when data actually changes. Additional compression can be explored if measurements show issues.
- **Backward compatibility**: Keep legacy RPC methods temporarily, but mark as deprecated and have them proxy to the registry so older code paths still function until migrations finish.

## Open Questions
- Do we need to persist cache registry state to disk to survive worker restarts? (Currently out of scope, but telemetry may indicate need.)
- Should we allow the renderer to request partial nodes of the file tree instead of entire payloads if size becomes problematic?
- What telemetry hooks are required to monitor cache hit ratios and rebuild error rates post-launch?

