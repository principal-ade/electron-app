# Repository Monitoring Server - Package Extraction Plan

## Overview

This document outlines the plan to extract the Repository Monitoring Server into a standalone npm package (`@principal-ade/repository-monitoring-server`). The package will be published to npm as a private package in a separate repository. The approach uses feature flags to enable gradual migration and testing before fully removing the legacy implementation.

## Migration Strategy

### Phase 1: Package Creation & Publishing
Create and publish `@principal-ade/repository-monitoring-server` as a standalone package in a separate repository.

### Phase 2: Parallel Implementation
Add the new package as a dependency alongside the existing implementation, controlled by a feature flag.

### Phase 3: Testing & Validation
Test the new package implementation in production with the feature flag enabled.

### Phase 4: Legacy Removal
Once validated, remove the old implementation and the feature flag.

---

## Current Architecture

### Process Architecture
The system uses a multi-process architecture:

```
┌─────────────────────┐
│  Renderer Process   │
│  (UI Layer)         │
└──────────┬──────────┘
           │ IPC
┌──────────▼──────────┐
│   Main Process      │
│  (Electron Main)    │
└──────────┬──────────┘
           │ Utility Process Fork
┌──────────▼──────────┐
│  Repository         │
│  Monitoring Server  │
│  (Worker Process)   │
└─────────────────────┘
```

### Current File Locations

**Core Server Implementation (Utility Process)**
- Location: `src/repository-monitoring-server/`
- Components:
  - `RepositoryMonitoringServer.ts` - Main coordinator class
  - `GitWatcherAdapter.ts` - Bridges with `@principal-ai/repository-monitoring`
  - `worker-entry.ts` - Utility process entry point
  - `types.ts` - IPC message type definitions
  - `FileTreeBuilder.ts` - Creates FileTree structures
  - `PackageProcessor.ts` - Extracts package information
  - `GitRemoteService.ts` - Handles git remote info
  - `QualityScoreEnrichment.ts` - Enriches packages with quality metrics
  - `cache/RepositoryCacheRegistry.ts` - Centralized cache registry

**Main Process Integration**
- Location: `src/main/repository-monitoring/`
- Components:
  - `RepositoryMonitoringManager.ts` - Manages utility process
  - `ipcHandlers.ts` - IPC handler registration
  - `RepositoryRegistrationManager.ts` - Auto-registers repositories

**Renderer Process API**
- Location: `src/renderer/`
- Components:
  - `main-process-api/RepositoryMonitoringService.ts` - Renderer-side IPC service
  - `services/RepositoryDataCache.ts` - Event-driven cache
  - `contexts/GitChangesContext.tsx` - React context for git changes

**Shared Interfaces**
- Location: `src/shared/main-process-api-interfaces/`
- Components:
  - `RepositoryMonitoringAPI.ts` - Shared type definitions and IPC event names

### Communication Flow

1. **Renderer → Main**: Uses `window.mainProcess.repositoryMonitoring.*` API
2. **Main → Worker**: Uses `UtilityProcess.postMessage()` for requests
3. **Worker → Main**: Uses `process.parentPort.postMessage()` for responses/events
4. **Main → Renderer**: Broadcasts events via `webContents.send()`

### Core Responsibilities

1. **File Tree Management**
   - Builds git-aware FileTree structures
   - Respects .gitignore patterns
   - Includes file stats (size, lastModified)
   - Uses SHA-based caching

2. **Git Watching and Events**
   - Monitors git state transitions (commit, branch-switch, merge, dirty-state-change)
   - Watches workspace file changes (add, change, unlink)
   - Supports "minimal" (fsmonitor) and "fallback" (chokidar) modes
   - Debounces events to prevent thrashing

3. **Package Detection and Analysis**
   - Discovers packages in monorepos and single-package repos
   - Extracts package.json metadata
   - Generates package summaries
   - On-demand quality enrichment

4. **Cache Management**
   - 4 Cache Slices: gitStatus, fileTree, packages, gitRemote
   - Event-driven updates via `RepositoryCacheRegistry`
   - Version-based invalidation with SHA hashing
   - Concurrent rebuild limiting (max 2 simultaneous)

5. **Git Status and Remote Info**
   - Real-time git status with file lists
   - Branch ahead/behind tracking
   - Remote URL and branch information

6. **Quality Metrics (On-Demand)**
   - Executes quality lenses for packages
   - Detects available tools (tests, linting, types)
   - Prevents build artifact feedback loops

---

## Target Package Structure

### Package Information
- **Package Name**: `@principal-ade/repository-monitoring-server`
- **Repository**: Separate git repository (not in desktop-app monorepo)
- **Publishing**: Private npm package on npmjs.com
- **Scope**: `@principal-ade` (organization scope)

### Directory Structure

```
@principal-ade/repository-monitoring-server/
├── src/
│   ├── worker/                      # Worker process implementation
│   │   ├── RepositoryMonitoringServer.ts
│   │   ├── GitWatcherAdapter.ts
│   │   ├── FileTreeBuilder.ts
│   │   ├── PackageProcessor.ts
│   │   ├── GitRemoteService.ts
│   │   ├── QualityScoreEnrichment.ts
│   │   ├── cache/
│   │   │   └── RepositoryCacheRegistry.ts
│   │   ├── worker-entry.ts
│   │   └── types.ts
│   │
│   ├── main/                        # Main process integration
│   │   ├── RepositoryMonitoringManager.ts
│   │   ├── ipcHandlers.ts
│   │   └── RepositoryRegistrationManager.ts
│   │
│   ├── renderer/                    # Renderer process API
│   │   ├── RepositoryMonitoringService.ts
│   │   ├── RepositoryDataCache.ts
│   │   └── GitChangesContext.tsx
│   │
│   ├── shared/                      # Shared types and interfaces
│   │   └── RepositoryMonitoringAPI.ts
│   │
│   └── index.ts                     # Main export file
│
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

### Main Exports

```typescript
// Main process
export { RepositoryMonitoringManager } from './main/RepositoryMonitoringManager';
export { registerRepositoryMonitoringHandlers } from './main/ipcHandlers';
export { RepositoryRegistrationManager } from './main/RepositoryRegistrationManager';

// Renderer process
export { RepositoryMonitoringService } from './renderer/RepositoryMonitoringService';
export { RepositoryDataCache } from './renderer/RepositoryDataCache';
export { GitChangesContext, GitChangesProvider, useGitChanges } from './renderer/GitChangesContext';

// Worker entry (for Electron.UtilityProcess)
export { workerEntry } from './worker/worker-entry';

// Shared types
export * from './shared/RepositoryMonitoringAPI';
```

---

## Dependencies

### External Dependencies (to be included in package.json)

```json
{
  "name": "@principal-ade/repository-monitoring-server",
  "version": "1.0.0-beta.1",
  "private": true,
  "description": "Electron-based repository monitoring server with git watching and package detection",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@principal-ai/repository-monitoring": "^0.1.4",
    "@principal-ai/repository-abstraction": "latest",
    "@principal-ai/codebase-composition": "latest",
    "@principal-ai/codebase-quality-lenses": "latest"
  },
  "peerDependencies": {
    "electron": ">=28.0.0",
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "publishConfig": {
    "access": "restricted"
  }
}
```

### Critical Issue: Shared Code Dependencies

The current implementation depends on app-specific shared utilities:
- `src/shared/repository-core/GitCore` - Git operations without Electron
- `src/shared/repository-core/FileSystemCore` - File system operations

**Resolution for Separate Repository Approach:**

Since the package will be in a separate repository and published to npm, you must choose:

**Option 1: Include in Package (Recommended for Initial Release)**
- Copy GitCore and FileSystemCore into `@principal-ade/repository-monitoring-server`
- Create duplication during migration period
- Simpler to manage during Phase 1-3
- Can extract later if needed

**Option 2: Extract to Separate Packages (Long-term Solution)**
- Create `@principal-ade/git-core` and `@principal-ade/fs-core` packages first
- Publish these as separate packages
- Use in both old implementation and new package
- More upfront work, but cleaner long-term
- Requires managing 3 packages instead of 1

**Recommendation**: Start with Option 1 (include in package) for faster initial delivery. Once the migration is complete and legacy code is removed, you can optionally extract shared utilities to separate packages if they're needed elsewhere.

### App Service Dependencies

The current implementation tightly couples with these app-specific services:
- `QualityLensService` (src/main/services)
- `AlexandriaRegistryService` (src/main/services)
- `UserPreferencesHandler` (src/main/services)

**Resolution: Dependency Injection**

The new package must accept these as constructor parameters:

```typescript
interface RepositoryMonitoringDependencies {
  qualityLensService?: QualityLensService;
  registryService?: AlexandriaRegistryService;
  preferencesHandler?: UserPreferencesHandler;
  // ... other services
}

class RepositoryMonitoringManager {
  constructor(
    private dependencies: RepositoryMonitoringDependencies
  ) {}
}
```

This allows the package to work standalone while the app can inject its services.

---

## Components That Depend on Repository Monitoring

### Renderer Components
The following components currently consume repository monitoring data and must work with both implementations:

1. **RepositoryDataCache** (src/renderer/services/RepositoryDataCache.ts)
   - Maintains centralized cache
   - Subscribes to CACHE_SYNC events
   - **Impact**: Must subscribe to events from either old or new implementation

2. **GitChangesContext** (src/renderer/contexts/GitChangesContext.tsx)
   - Monitors git status changes
   - **Impact**: Must work with both service implementations

3. **RepositoryWorkspace** - Displays file trees and package information
4. **QualityHexagonPanel** - Shows quality metrics
5. **ToolsPanel** - Executes quality tools
6. **DependenciesPanel** - Shows package dependencies
7. **TitlebarGitChanges** - Displays git status
8. **SystemMonitor** - Shows monitoring server resource usage

### Main Process Services

1. **PrincipalMCPBridge** - Uses for dependency resolution
2. **DocumentIndexingService** - Watches for file changes
3. **AlexandriaApiEventHandler** - Integrates with repository lifecycle

**Requirement**: All these components must work transparently regardless of which implementation is active.

---

## Feature Flag Implementation

### Configuration

Add to user preferences or environment variables:

```typescript
// In src/shared/types/UserPreferences.ts (or equivalent)
interface ExperimentalFeatures {
  useNewRepositoryMonitoring?: boolean;
}

// Environment variable fallback
const USE_NEW_REPO_MONITORING =
  process.env.USE_NEW_REPO_MONITORING === 'true';
```

### Main Process Integration

```typescript
// src/main/initialization.ts (or equivalent)
import { RepositoryMonitoringManager as LegacyManager } from './repository-monitoring';
import {
  RepositoryMonitoringManager as NewManager,
  registerRepositoryMonitoringHandlers as registerNewHandlers
} from '@principal-ade/repository-monitoring-server';

async function initializeRepositoryMonitoring() {
  const useNew = getUserPreference('experimentalFeatures.useNewRepositoryMonitoring')
    || process.env.USE_NEW_REPO_MONITORING === 'true';

  if (useNew) {
    console.log('Using new repository monitoring package');

    const manager = NewManager.getInstance();
    await manager.start();

    registerNewHandlers();

    // Auto-register repositories
    const registrationManager = new RepositoryRegistrationManager(manager);
    await registrationManager.initialize();
  } else {
    console.log('Using legacy repository monitoring implementation');

    // Existing implementation
    const manager = LegacyManager.getInstance();
    await manager.start();

    registerRepositoryMonitoringHandlers();

    const registrationManager = RepositoryRegistrationManager.getInstance(manager);
    await registrationManager.initialize();
  }
}
```

### Renderer Process Integration

The renderer should not need changes if the IPC interface remains identical:

```typescript
// src/renderer/main-process-api/RepositoryMonitoringService.ts
// No changes needed - IPC interface should be identical

// Both implementations must emit the same IPC events:
// - REPO_MONITORING_GIT_STATUS_CHANGED
// - REPO_MONITORING_CACHE_SYNC
// - REPO_MONITORING_GIT_STATE_EVENT
// - REPO_MONITORING_WORKSPACE_CHANGED
// etc.
```

### UI Toggle (Optional)

Add a toggle in settings for easier testing:

```typescript
// In settings/preferences UI
<Toggle
  label="Use New Repository Monitoring Package (Experimental)"
  checked={preferences.experimentalFeatures?.useNewRepositoryMonitoring}
  onChange={(checked) => updatePreference(
    'experimentalFeatures.useNewRepositoryMonitoring',
    checked
  )}
/>
```

---

## Migration Phases

### Phase 1: Package Creation (Week 1-2)

**Tasks:**
- [ ] Create new git repository for `@principal-ade/repository-monitoring-server`
- [ ] Set up package.json with private: true for npm private package
- [ ] Configure tsconfig.json and build configuration (TypeScript compilation)
- [ ] Copy source code from desktop-app `src/repository-monitoring-server/`, `src/main/repository-monitoring/`, `src/renderer/` (monitoring parts), `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts`
- [ ] Resolve shared code dependencies (GitCore, FileSystemCore) - **Decision needed**: Extract to separate packages or include in this package
- [ ] Implement dependency injection for app services (QualityLensService, AlexandriaRegistryService, UserPreferencesHandler)
- [ ] Update all imports and paths to work in standalone package
- [ ] Create comprehensive README with:
  - Installation instructions
  - Usage examples for main, renderer, and worker processes
  - API documentation
  - Configuration options
  - Dependency injection examples
- [ ] Set up automated tests (unit tests for core logic)
- [ ] Configure GitHub Actions or CI pipeline for testing
- [ ] Set up npm organization `@principal-ade` if not already created
- [ ] Configure npm authentication for private package publishing
- [ ] Publish to npm as private package: `@principal-ade/repository-monitoring-server@1.0.0-beta.1`

**Deliverables:**
- Separate git repository with package code
- Published private package `@principal-ade/repository-monitoring-server@1.0.0-beta.1` on npm
- Comprehensive README with usage documentation
- Unit tests passing
- CI/CD pipeline configured

### Phase 2: Integration (Week 3)

**Tasks:**
- [ ] Authenticate npm in desktop-app for private package access
- [ ] Install package in desktop-app: `npm install @principal-ade/repository-monitoring-server`
- [ ] Add feature flag to user preferences schema (src/shared/types/UserPreferences.ts or equivalent)
- [ ] Add environment variable support: `USE_NEW_REPO_MONITORING`
- [ ] Implement conditional initialization in main process (src/main/initialization.ts):
  - Import both legacy and new implementations
  - Check feature flag or environment variable
  - Initialize appropriate implementation based on flag
- [ ] Inject required app services into new package (QualityLensService, AlexandriaRegistryService, UserPreferencesHandler)
- [ ] Add logging to identify which implementation is active (console.log on startup)
- [ ] Test that old implementation still works (default behavior, flag off)
- [ ] Test that new implementation works when flag enabled
- [ ] Add UI toggle in settings for easier testing (optional but recommended)
- [ ] Update .gitignore if needed for package build artifacts
- [ ] Document the feature flag in internal docs

**Deliverables:**
- Both implementations working side-by-side
- Feature flag functional and documented
- No regressions in existing functionality
- Clear logging indicates which implementation is active

### Phase 3: Testing & Validation (Week 4-6)

**Tasks:**
- [ ] Enable flag for internal testing
- [ ] Test all dependent components:
  - [ ] RepositoryDataCache
  - [ ] GitChangesContext
  - [ ] RepositoryWorkspace
  - [ ] QualityHexagonPanel
  - [ ] ToolsPanel
  - [ ] DependenciesPanel
  - [ ] TitlebarGitChanges
  - [ ] SystemMonitor
- [ ] Test git watching in both modes (minimal/fallback)
- [ ] Test with multiple repositories
- [ ] Test with monorepos
- [ ] Test quality lens execution
- [ ] Test cache invalidation
- [ ] Monitor performance and resource usage
- [ ] Fix any bugs found
- [ ] Gradually roll out to more users (if applicable)

**Deliverables:**
- Validation that new package works identically to legacy
- Bug fixes in new package
- Performance benchmarks comparing old vs new

### Phase 4: Legacy Removal (Week 7-8)

**Tasks:**
- [ ] Set default to use new implementation
- [ ] Remove feature flag from UI
- [ ] Delete legacy implementation files:
  - [ ] `src/repository-monitoring-server/`
  - [ ] `src/main/repository-monitoring/`
  - [ ] Legacy parts of `src/renderer/main-process-api/RepositoryMonitoringService.ts`
  - [ ] Legacy parts of `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts`
- [ ] Remove feature flag code
- [ ] Update imports throughout codebase
- [ ] Update documentation
- [ ] Update tests
- [ ] Final validation

**Deliverables:**
- Clean codebase using only new package
- Updated documentation
- All tests passing

---

## Testing Strategy

### Unit Tests (in new package)

Test each component in isolation:
- `FileTreeBuilder` - Test tree building logic
- `PackageProcessor` - Test package detection
- `GitWatcherAdapter` - Test event handling
- `RepositoryCacheRegistry` - Test cache updates and version management
- `GitRemoteService` - Test remote info extraction

### Integration Tests (in new package)

Test worker ↔ main ↔ renderer communication:
- Mock IPC boundaries
- Test event flow
- Test error handling
- Test worker restart logic

### End-to-End Tests (in desktop-app)

With feature flag enabled:
- Repository registration
- File tree updates on git changes
- Package discovery in monorepos
- Quality metrics execution
- Cache invalidation and rebuilds
- Multiple repository handling

### Performance Tests

Compare old vs new:
- Memory usage of worker process
- CPU usage during file watching
- Event processing latency
- Cache rebuild times

### Manual Testing Checklist

- [ ] Create new repository - verify auto-registration
- [ ] Make git commit - verify cache updates
- [ ] Switch branches - verify file tree refresh
- [ ] Modify files - verify workspace change events
- [ ] Add new package to monorepo - verify package detection
- [ ] Run quality lens - verify metrics update
- [ ] Delete repository - verify cleanup
- [ ] Test with git fsmonitor enabled
- [ ] Test with chokidar fallback
- [ ] Test with 10+ repositories open

---

## Risks and Mitigation

### Risk 1: Shared Code Duplication
**Risk**: GitCore and FileSystemCore duplication leads to diverging implementations and bugs.
**Mitigation**:
- Copy code into package initially (accept duplication during migration)
- Freeze changes to shared code in desktop-app during migration
- After legacy removal, optionally extract to separate packages
- Document that shared code is duplicated and where it lives in both places

### Risk 2: Breaking IPC Contract
**Risk**: New package emits different IPC events, breaking renderer.
**Mitigation**:
- Comprehensive integration tests
- Strict type checking on IPC messages
- Parallel testing during Phase 3

### Risk 3: Performance Regression
**Risk**: New package is slower or uses more memory.
**Mitigation**:
- Performance benchmarks before/after
- Monitor resource usage in System Monitor
- Load test with many repositories

### Risk 4: App Service Coupling
**Risk**: Tight coupling with QualityLensService, etc. makes injection complex.
**Mitigation**:
- Design clear service interfaces
- Mock services for package testing
- Document required service contracts

### Risk 5: npm Publishing Issues
**Risk**: Package publishing fails, private package access issues, or version conflicts.
**Mitigation**:
- Set up `@principal-ade` npm organization before Phase 1
- Test private package publishing in beta versions first (1.0.0-beta.1)
- Document npm authentication process for desktop-app team
- Use scoped package name (`@principal-ade/repository-monitoring-server`)
- Document versioning strategy (semantic versioning)
- Create .npmrc with registry configuration if needed
- Ensure all developers have access to the private package

### Risk 6: Regression in Edge Cases
**Risk**: Edge cases (build artifact feedback loops, concurrent rebuilds) break.
**Mitigation**:
- Extensive edge case testing
- Feature flag allows quick rollback
- Monitor logs during Phase 3

---

## Success Criteria

The migration is successful when:

1. **Functionality**: New package provides 100% feature parity with legacy implementation
2. **Performance**: No significant performance degradation (< 5% slower acceptable)
3. **Stability**: No crashes or IPC communication failures after 2 weeks of testing
4. **Compatibility**: All dependent components work without modification
5. **Testing**: 80%+ code coverage in new package
6. **Documentation**: Complete README with integration examples
7. **Cleanup**: Legacy code fully removed from codebase

---

## Rollback Plan

If critical issues are found during Phase 3:

1. **Immediate**: Toggle feature flag to `false` for affected users
2. **Investigation**: Debug issues in new package
3. **Fix**: Publish patch version to npm
4. **Re-enable**: Test fix and re-enable flag
5. **If unfixable**: Keep legacy implementation, reassess extraction plan

The feature flag approach ensures we can rollback instantly without code changes.

---

## Decisions Made

Based on your requirements, the following decisions have been made:

1. **Repository Location**: ✅ **Separate git repository** (not in desktop-app monorepo)
2. **Package Name**: ✅ `@principal-ade/repository-monitoring-server`
3. **Publishing**: ✅ **Private npm package** on npmjs.com
4. **Scope**: ✅ `@principal-ade` organization

## Open Questions (Needs Team Decision)

1. **GitCore/FileSystemCore**: Extract to packages or include in new package?
   - **Include in Package** (Recommended): Copy into package, accept duplication during migration, faster to ship
   - **Extract to Packages**: Create `@principal-ade/git-core` and `@principal-ade/fs-core`, cleaner long-term, more upfront work

2. **Versioning**: Semantic versioning strategy for the package?
   - **Recommended**: Start with `1.0.0-beta.1` during Phase 1-3
   - Promote to `1.0.0` stable after Phase 3 validation completes
   - Use standard semver for updates: MAJOR.MINOR.PATCH

3. **Worker Entry Point**: How should consumers specify the worker entry point?
   - **Option A**: Export a `getWorkerPath()` function that returns the path to worker-entry.js
   - **Option B**: Document the path in README: `node_modules/@principal-ade/repository-monitoring-server/dist/worker/worker-entry.js`
   - **Option C**: Export the worker entry as a separate subpath: `@principal-ade/repository-monitoring-server/worker`

4. **npm Organization Setup**: Who will create and manage the `@principal-ade` npm organization?
   - Need to identify organization owner
   - Need to add all developers who will publish/install the package

5. **CI/CD**: What CI/CD platform for the new repository?
   - GitHub Actions (recommended if using GitHub)
   - GitLab CI
   - Other?

6. **License**: What license for the package?
   - Proprietary (private package, no external use)
   - MIT/Apache if potentially open-sourcing later

---

## Appendix: Key Code Patterns to Preserve

### Event-Driven Cache Synchronization

The new package must maintain this pattern:

```typescript
// In worker
cacheRegistry.on('cacheUpdated', (event) => {
  // Send to main process
  process.parentPort.postMessage({
    type: 'CACHE_SYNC',
    payload: event
  });
});

// In main process
utilityProcess.on('message', (message) => {
  if (message.type === 'CACHE_SYNC') {
    // Broadcast to all renderer processes
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('REPO_MONITORING_CACHE_SYNC', message.payload);
    });
  }
});
```

### Feedback Loop Prevention

Quality lens execution must not trigger recursive rebuilds:

```typescript
// Track rebuilds in progress
private rebuildInProgress: Map<string, Set<CacheSlice>>

// During workspace change
if (this.rebuildInProgress.get(repoPath)?.has('packages')) {
  // Track build artifacts but don't rebuild
  return;
}
```

### Automatic Repository Registration

On app startup, must auto-register repositories:

```typescript
class RepositoryRegistrationManager {
  async initialize() {
    const repos = await this.registryService.getAllRepositories();

    for (const repo of repos) {
      await this.manager.registerRepository(repo.path);

      if (this.shouldEnableWatching(repo)) {
        await this.manager.startWatching(repo.path);
      }
    }
  }
}
```

---

## Contact and Support

For questions about this migration:
- **Technical Questions**: [Team lead or architect]
- **Package Development**: [Developer assigned to Phase 1]
- **Testing Coordination**: [QA lead]
- **Timeline/Priority**: [Project manager]

---

**Document Version**: 1.0
**Last Updated**: 2025-11-15
**Author**: Claude Code
**Status**: Planning
