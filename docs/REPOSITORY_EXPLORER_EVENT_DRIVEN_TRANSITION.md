# RepositoryExplorer Event-Driven Transition Plan

## Overview
This document outlines the transition plan for moving the RepositoryExplorer view from polling-based data fetching to an event-driven architecture powered by the Repository Monitoring Server.

## Current Data Sources Analysis

### 1. Repository List Data
Currently fetched from multiple services on-demand:

#### AlexandriaService
- **Data**: Basic repository entries (name, path, registeredAt, bookColor, etc.)
- **Location**: `src/renderer/main-process-api/AlexandriaService.ts`
- **Methods**:
  - `getRepositories()` - Returns all registered repositories
  - `registerRepository()` - Adds new repository
  - `removeRepository()` - Removes repository
  - `onRepositoryChange()` - Event subscription for changes

#### GitService
- **Data**: Git status and branch information
- **Location**: `src/renderer/main-process-api/GitService.ts`
- **Per-repository calls**:
  - `execCommand()` - Get current branch
  - `getStatus()` - Get staged/unstaged/untracked files
  - `getBranchStatus()` - Get ahead/behind counts
  - `getCurrentBranch()` - Get current branch name
  - `isPushSafe()` - Check if push needs upstream

#### FileSystemService
- **Data**: File modification timestamps
- **Location**: `src/renderer/main-process-api/FileSystemService.ts`
- **Methods**:
  - `getFileStats()` - Get file modification times
  - `selectDirectory()` - Directory picker for adding repos

#### AlexandriaDocsService
- **Data**: Markdown documentation files
- **Location**: `src/renderer/main-process-api/AlexandriaDocsService.ts`
- **Methods**:
  - `getComprehensiveDocuments()` - Get all markdown files

### 2. Enhanced Repository Data
The `enhanceRepositoryWithGitInfo()` function in RepositoryExplorer.tsx:
- Combines Alexandria data with Git information
- Adds: `gitBranch`, `isDirty`, `dirtyFileCount`, `mostRecentChange`
- Called for each repository on load and refresh

### 3. Repository Details Panel Data
Additional data loaded when repository is selected:
- Markdown files with timestamps
- Git status details (staged/unstaged/untracked with file paths)
- Quality metrics (currently mock data)
- Repository notes (from RepositoryNotesPanel)

## Transition to Repository Monitoring Server

### Phase 1: Registration Architecture

#### App Startup Registration
```typescript
// In main process initialization (app.ts or similar)
class RepositoryRegistrationManager {
  async registerAllRepositories() {
    // 1. Get all Alexandria repositories
    const repos = await AlexandriaService.getRepositories();

    // 2. Register each with monitoring server
    for (const repo of repos) {
      await RepositoryMonitoringManager.registerRepository(repo.path);

      // 3. Enable git watching for active repos
      if (repo.isActive || repo.hasRecentActivity) {
        await RepositoryMonitoringManager.enableGitWatching(repo.path);
      }
    }

    // 4. Start monitoring
    await RepositoryMonitoringManager.startMonitoring();
  }
}
```

#### Repository Addition/Removal Hooks
```typescript
// Hook into Alexandria repository lifecycle
AlexandriaService.on('repository-added', async (repo) => {
  await RepositoryMonitoringManager.registerRepository(repo.path);
  await RepositoryMonitoringManager.enableGitWatching(repo.path);
});

AlexandriaService.on('repository-removed', async (repo) => {
  await RepositoryMonitoringManager.disableGitWatching(repo.path);
  await RepositoryMonitoringManager.unregisterRepository(repo.path);
});
```

### Phase 2: Data Migration Map

| Current Source | Current Method | New Source | New Method/Event |
|---------------|---------------|------------|------------------|
| AlexandriaService | `getRepositories()` | AlexandriaService + Monitoring | Keep for initial list, enhance with monitoring data |
| GitService | `getStatus()` | RepositoryMonitoringAPI | `getGitStatusWithFiles()` |
| GitService | `getBranchStatus()` | RepositoryMonitoringAPI | `getGitStatus()` |
| GitService | `execCommand()` for branch | RepositoryMonitoringAPI | `getGitStatus()` (includes branch) |
| FileSystemService | `getFileStats()` | RepositoryMonitoringAPI | Include in FileTree data |
| AlexandriaDocsService | `getComprehensiveDocuments()` | RepositoryMonitoringAPI | Filter FileTree for .md files |
| QualityMetricsService | Mock data | RepositoryMonitoringAPI | `getPackages()` with embedded metrics |

### Phase 3: Event-Driven Architecture

#### Event Subscriptions
```typescript
// In RepositoryExplorer component
useEffect(() => {
  // Subscribe to git status changes
  const unsubscribeGit = RepositoryMonitoringService.onGitStatusChanged((status) => {
    // Update repository in state with new git status
    updateRepositoryGitStatus(status.repoPath, status);
  });

  // Subscribe to metrics updates
  const unsubscribeMetrics = RepositoryMonitoringService.onMetricsUpdated((metrics) => {
    // Update quality metrics in state
    updateRepositoryMetrics(metrics.repoPath, metrics);
  });

  return () => {
    unsubscribeGit();
    unsubscribeMetrics();
  };
}, []);
```

#### Initial Load Strategy
```typescript
const loadRepositories = async () => {
  // 1. Get repository list from Alexandria (source of truth)
  const repos = await AlexandriaService.getRepositories();

  // 2. Batch fetch monitoring data
  const monitoringData = await Promise.all(
    repos.map(async (repo) => {
      const [gitStatus, packages] = await Promise.all([
        RepositoryMonitoringService.getGitStatusWithFiles(repo.path),
        RepositoryMonitoringService.getPackages(repo.path)
      ]);
      return { repo, gitStatus, packages };
    })
  );

  // 3. Combine and set state
  const enhancedRepos = monitoringData.map(({ repo, gitStatus, packages }) => ({
    ...repo,
    gitBranch: gitStatus?.branch || 'main',
    isDirty: gitStatus?.isDirty || false,
    dirtyFileCount: (gitStatus?.modifiedFiles?.length || 0) +
                     (gitStatus?.untrackedFiles?.length || 0),
    mostRecentChange: packages?.summary?.lastModified || repo.registeredAt,
    qualityMetrics: packages?.packages[0]?.qualityMetrics
  }));

  setRepositories(enhancedRepos);
};
```

### Phase 4: Repository Details Panel Updates

#### Selected Repository Deep Dive
```typescript
const loadRepositoryDetails = async (repo: EnhancedAlexandriaEntry) => {
  // 1. Get file tree for documentation
  const fileTree = await RepositoryMonitoringService.getFileTree(repo.path);
  const markdownFiles = filterMarkdownFiles(fileTree);

  // 2. Git status is already available from monitoring
  const gitStatus = await RepositoryMonitoringService.getGitStatusWithFiles(repo.path);

  // 3. Quality metrics from packages
  const packages = await RepositoryMonitoringService.getPackages(repo.path);

  setRepositoryDetails({
    markdownFiles,
    gitStatus,
    qualityMetrics: packages?.packages[0]?.qualityMetrics
  });
};
```

### Phase 5: Performance Optimizations

#### Smart Git Watching
```typescript
class GitWatchingStrategy {
  // Enable watching for:
  // - Currently selected repository
  // - Repositories with recent activity (last 24h)
  // - Repositories marked as favorites

  async optimizeWatching(repos: Repository[]) {
    const selectedRepo = getCurrentSelectedRepository();
    const recentRepos = repos.filter(r => isRecent(r.lastActivity));
    const favoriteRepos = repos.filter(r => r.isFavorite);

    const watchList = new Set([
      selectedRepo?.path,
      ...recentRepos.map(r => r.path),
      ...favoriteRepos.map(r => r.path)
    ]);

    // Enable watching for active repos
    for (const path of watchList) {
      if (path) await RepositoryMonitoringService.enableGitWatching(path);
    }

    // Disable watching for inactive repos
    for (const repo of repos) {
      if (!watchList.has(repo.path)) {
        await RepositoryMonitoringService.disableGitWatching(repo.path);
      }
    }
  }
}
```

#### Caching Strategy
```typescript
interface CachedRepositoryData {
  gitStatus: GitStatusWithFiles;
  packages: PackageLayer[];
  fileTree: FileTree;
  timestamp: number;
}

class RepositoryDataCache {
  private cache = new Map<string, CachedRepositoryData>();
  private maxAge = 5 * 60 * 1000; // 5 minutes

  async getData(repoPath: string): Promise<CachedRepositoryData> {
    const cached = this.cache.get(repoPath);

    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached;
    }

    // Fetch fresh data
    const [gitStatus, packages, fileTree] = await Promise.all([
      RepositoryMonitoringService.getGitStatusWithFiles(repoPath),
      RepositoryMonitoringService.getPackages(repoPath),
      RepositoryMonitoringService.getFileTree(repoPath)
    ]);

    const data = {
      gitStatus,
      packages: packages?.packages || [],
      fileTree,
      timestamp: Date.now()
    };

    this.cache.set(repoPath, data);
    return data;
  }

  invalidate(repoPath: string) {
    this.cache.delete(repoPath);
  }
}
```

## Implementation Phases

### Phase 1: Infrastructure (Week 1)
- [ ] Implement app startup registration manager
- [ ] Add repository lifecycle hooks
- [ ] Create monitoring service event subscriptions
- [ ] Set up caching layer

### Phase 2: Data Migration (Week 2)
- [ ] Replace GitService calls with RepositoryMonitoringAPI
- [ ] Migrate file stats to FileTree data
- [ ] Update markdown file discovery
- [ ] Integrate quality metrics from packages

### Phase 3: Event Integration (Week 3)
- [ ] Implement git status change handlers
- [ ] Add metrics update handlers
- [ ] Create smart git watching strategy
- [ ] Test event flow end-to-end

### Phase 4: UI Updates (Week 4)
- [ ] Update RepositoryExplorer component
- [ ] Update RepositoryDetailsPanel
- [ ] Add real-time status indicators
- [ ] Implement optimistic updates

### Phase 5: Performance & Polish (Week 5)
- [ ] Optimize initial load performance
- [ ] Implement progressive loading
- [ ] Add error recovery
- [ ] Performance monitoring

## Benefits of Event-Driven Architecture

1. **Real-time Updates**: Git status changes appear immediately
2. **Reduced API Calls**: Single monitoring service vs multiple service calls
3. **Better Performance**: Cached data and smart watching
4. **Unified Data Source**: All repository data from one service
5. **Resource Efficiency**: Only watch active repositories
6. **Quality Metrics Integration**: Embedded in package data

## Migration Checklist

### Pre-Migration
- [ ] Document current data flow
- [ ] Identify all data dependencies
- [ ] Create fallback mechanisms
- [ ] Set up monitoring metrics

### During Migration
- [ ] Maintain backward compatibility
- [ ] Implement feature flags
- [ ] Add comprehensive logging
- [ ] Test each phase independently

### Post-Migration
- [ ] Remove deprecated code
- [ ] Update documentation
- [ ] Performance benchmarking
- [ ] User acceptance testing

## Risk Mitigation

### Potential Issues
1. **Initial Load Performance**: Batch requests might be slower
   - *Mitigation*: Progressive loading, show cached data first

2. **Event Subscription Memory**: Too many listeners
   - *Mitigation*: Proper cleanup, event debouncing

3. **Git Watching Resource Usage**: Too many watchers
   - *Mitigation*: Smart watching strategy, limit active watchers

4. **Data Consistency**: Events might arrive out of order
   - *Mitigation*: Timestamp validation, event sequencing

## Success Metrics

- Initial repository list load time < 500ms
- Git status updates reflected in < 100ms
- Memory usage reduced by 30%
- API calls reduced by 60%
- User-reported performance improvements

## Next Steps

1. Review and approve this transition plan
2. Create detailed technical specifications for each phase
3. Set up feature flags for gradual rollout
4. Begin Phase 1 implementation