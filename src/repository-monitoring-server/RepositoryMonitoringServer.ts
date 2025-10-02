/**
 * Repository Monitoring Server - Main coordinator
 * Milestone 1: Basic structure with FileTree building
 * Enhanced with Git FSMonitor-based watching
 * Enhanced with @principal-ai/repository-monitoring library for git state events
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { FileTreeBuilder } from './FileTreeBuilder';
import { PackageProcessor } from './PackageProcessor';
import { GitCore } from '../shared/repository-core/GitCore';
import type {
  RepositoryState,
  CachedFileTree,
  GitStatusMetadata,
  GitStatusWithFiles,
  PackageSummary,
  GitStateEventPayload,
  WorkspaceChangeEventPayload,
  DependencyResolutionRequest,
  DependencyResolutionResult,
} from './types';
import { MonitoringInternalEvent } from './types';
import { GitWatcherAdapter } from './GitWatcherAdapter';

export class RepositoryMonitoringServer {
  private repositories: Map<string, RepositoryState> = new Map();
  private fileTreeCache: Map<string, CachedFileTree> = new Map();
  private fileTreeBuilder: FileTreeBuilder;
  private packageProcessor: PackageProcessor;
  private packageCache: Map<string, { packages: PackageLayer[]; summary: PackageSummary; timestamp: number }> = new Map();
  private gitWatcherAdapter: GitWatcherAdapter;
  private gitStatusRefreshTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.fileTreeBuilder = new FileTreeBuilder();
    this.packageProcessor = new PackageProcessor();

    // Initialize git watcher adapter
    this.gitWatcherAdapter = new GitWatcherAdapter(this, {
      debounceMs: parseInt(process.env.GIT_WATCHER_DEBOUNCE_MS || '500', 10),
    });

    // Subscribe to git state events from the library
    this.gitWatcherAdapter.on(MonitoringInternalEvent.GIT_STATE_EVENT, (payload: GitStateEventPayload) => {
      this.handleGitStateEvent(payload);
    });

    this.gitWatcherAdapter.on(MonitoringInternalEvent.WORKSPACE_CHANGED, (event: WorkspaceChangeEventPayload) => {
      this.handleWorkspaceChangeEvent(event);
    });
  }

  /**
   * Register a repository for monitoring
   */
  async registerRepository(path: string): Promise<void> {
    if (!this.repositories.has(path)) {
      const state: RepositoryState = {
        path,
        lastUpdated: new Date(),
        isWatching: false,
        gitWatchingEnabled: false,
        watchingMode: 'none',
        fsMonitorEnabled: false,
      };

      try {
        const lastCommit = await GitCore.getMostRecentCommitTimestamp(path);
        if (lastCommit) {
          state.lastLocalChange = lastCommit;
        }
      } catch (error) {
        console.warn(`[RepositoryMonitoring] Could not determine initial commit time for ${path}:`, error);
      }

      this.repositories.set(path, state);
    }
  }

  /**
   * Unregister a repository
   */
  async unregisterRepository(path: string): Promise<void> {
    this.repositories.delete(path);
    this.fileTreeCache.delete(path);
  }

  /**
   * Get or build FileTree for a repository
   */
  async getFileTree(path: string): Promise<FileTree | null> {
    // Check cache first
    const cached = this.fileTreeCache.get(path);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
      return cached.tree;
    }

    // Build new FileTree
    try {
      const fileTree = await this.fileTreeBuilder.buildFileTree(path);

      // Cache it
      this.fileTreeCache.set(path, {
        tree: fileTree,
        timestamp: Date.now(),
        sha: fileTree.sha,
      });

      // Update repository state
      const state = this.repositories.get(path);
      if (state) {
        state.lastUpdated = new Date();
        state.fileTree = fileTree;
      }

      return fileTree;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to build FileTree for ${path}:`, error);
      return null;
    }
  }

  /**
   * Get packages from a repository
   */
  async getPackages(repoPath: string): Promise<{ packages: PackageLayer[]; summary: PackageSummary } | null> {
    // Check cache first
    const cached = this.packageCache.get(repoPath);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
      return { packages: cached.packages, summary: cached.summary };
    }

    // Get or build FileTree first
    const fileTree = await this.getFileTree(repoPath);
    if (!fileTree) {
      console.error(`[RepositoryMonitoring] Failed to get FileTree for packages in ${repoPath}`);
      return null;
    }

    try {
      // Extract packages using PackageProcessor
      const packages = await this.packageProcessor.extractPackages(fileTree, repoPath);

      // Generate summary
      const summary = await this.packageProcessor.getPackageSummary(packages);

      // Cache the results
      this.packageCache.set(repoPath, {
        packages,
        summary,
        timestamp: Date.now(),
      });

      return { packages, summary };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to extract packages for ${repoPath}:`, error);
      return null;
    }
  }

  /**
   * Refresh repository data (clear cache and trigger git status update)
   */
  async refreshRepository(path: string): Promise<void> {
    this.fileTreeCache.delete(path);
    this.packageCache.delete(path);
    await this.getFileTree(path);

    // Also fetch fresh git status to update ahead/behind indicators
    try {
      const gitStatus = await this.getGitStatus(path);
      // Emit git status changed event to trigger cache update
      this.emit(MonitoringInternalEvent.GIT_STATUS_CHANGED, gitStatus);
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to refresh git status for ${path}:`, error);
    }
  }

  /**
   * Get git status for a repository
   */
  async getGitStatus(repoPath: string): Promise<GitStatusMetadata> {
    console.info(`[RepositoryMonitoring] getGitStatus called for ${repoPath}`);
    try {
      const state = this.repositories.get(repoPath);

      if (state && !state.lastLocalChange) {
        const initialCommit = await GitCore.getMostRecentCommitTimestamp(repoPath);
        if (initialCommit) {
          state.lastLocalChange = initialCommit;
        }
      }

      const detailedStatus = await GitCore.getDetailedStatus(repoPath);

      const status: GitStatusMetadata = {
        repoPath,
        branch: detailedStatus.branch,
        isDirty: detailedStatus.isDirty,
        hasUntracked: detailedStatus.hasUntracked,
        hasStaged: detailedStatus.hasStaged,
        ahead: detailedStatus.ahead,
        behind: detailedStatus.behind,
        watchingEnabled: state?.gitWatchingEnabled || false,
        lastChangedAt: state?.lastLocalChange || state?.lastGitStatus?.lastChangedAt,
      };

      // Cache the status
      if (state) {
        state.lastGitStatus = status;
      }

      return status;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git status for ${repoPath}:`, error);
      const state = this.repositories.get(repoPath);
      return {
        repoPath,
        branch: 'unknown',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
        watchingEnabled: false,
        lastChangedAt: state?.lastLocalChange,
      };
    }
  }

  /**
   * Get git status with file lists
   */
  async getGitStatusWithFiles(repoPath: string): Promise<GitStatusWithFiles> {
    console.info(`[RepositoryMonitoring] getGitStatusWithFiles called for ${repoPath}`);
    try {
      const state = this.repositories.get(repoPath);

      if (state && !state.lastLocalChange) {
        const initialCommit = await GitCore.getMostRecentCommitTimestamp(repoPath);
        if (initialCommit) {
          state.lastLocalChange = initialCommit;
        }
      }

      // Get all status information in a single call - detailedStatus now includes files
      const detailedStatus = await GitCore.getDetailedStatus(repoPath);

      // Use the file status from detailedStatus to avoid duplicate git calls
      const fileStatus = detailedStatus.files || { staged: [], unstaged: [], untracked: [], deleted: [] };

      // Build the complete status object
      return {
        repoPath,
        branch: detailedStatus.branch,
        isDirty: detailedStatus.isDirty,
        hasUntracked: detailedStatus.hasUntracked,
        hasStaged: detailedStatus.hasStaged,
        ahead: detailedStatus.ahead,
        behind: detailedStatus.behind,
        watchingEnabled: state?.gitWatchingEnabled || false,
        lastChangedAt: state?.lastLocalChange || state?.lastGitStatus?.lastChangedAt,
        modifiedFiles: fileStatus.unstaged?.map(f => f.path) || [],
        untrackedFiles: fileStatus.untracked?.map(f => f.path) || [],
        stagedFiles: fileStatus.staged?.map(f => f.path) || [],
        // For now, treat untracked files as created (new files)
        createdFiles: fileStatus.untracked?.map(f => f.path) || [],
        // Now properly returning deleted files from git status
        deletedFiles: fileStatus.deleted?.map(f => f.path) || [],
      };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git status with files for ${repoPath}:`, error);
      const state = this.repositories.get(repoPath);
      return {
        repoPath,
        branch: 'unknown',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
        watchingEnabled: false,
        lastChangedAt: state?.lastLocalChange,
        modifiedFiles: [],
        untrackedFiles: [],
        stagedFiles: [],
        createdFiles: [],
        deletedFiles: [],
      };
    }
  }

  /**
   * Enable git watching for a repository
   */
  async enableGitWatching(repoPath: string): Promise<void> {
    const state = this.repositories.get(repoPath);
    if (!state) {
      throw new Error(`Repository ${repoPath} not registered`);
    }

    if (state.gitWatchingEnabled) {
      return;
    }

    try {
      // Start library-based git state event watching
      console.info(`[RepositoryMonitoring] Starting git state event watching for ${repoPath}`);
      await this.gitWatcherAdapter.startWatching(repoPath);

      // Attempt to enable fsmonitor for improved performance information
      const fsMonitorEnabled = await GitCore.enableFSMonitor(repoPath);
      state.fsMonitorEnabled = fsMonitorEnabled;
      state.watchingMode = fsMonitorEnabled ? 'minimal' : 'fallback';
      state.gitWatchingEnabled = true;
      state.isWatching = true;

      // Do initial status check
      await this.getGitStatus(repoPath);
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to enable git watching for ${repoPath}:`, error);
      throw error;
    }
  }

  /**
   * Disable git watching for a repository
   */
  async disableGitWatching(repoPath: string): Promise<void> {
    const state = this.repositories.get(repoPath);
    if (state) {
      state.gitWatchingEnabled = false;
      state.isWatching = false;
      state.fsMonitorEnabled = false;
      state.watchingMode = 'none';
    }

    // Stop library-based watching
    await this.gitWatcherAdapter.stopWatching(repoPath);

    const refreshTimer = this.gitStatusRefreshTimers.get(repoPath);
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      this.gitStatusRefreshTimers.delete(repoPath);
    }
  }

  private handleWorkspaceChangeEvent(event: WorkspaceChangeEventPayload): void {
    const { repoPath, state: gitState } = event;

    this.fileTreeCache.delete(repoPath);
    this.packageCache.delete(repoPath);

    const state = this.repositories.get(repoPath);
    if (state) {
      state.lastUpdated = new Date();
      if (gitState?.lastCommitTime) {
        state.lastLocalChange = new Date(gitState.lastCommitTime).toISOString();
      }
      if (gitState?.timestamp) {
        state.lastLocalChange = new Date(gitState.timestamp).toISOString();
      }
    }

    if (process.parentPort) {
      process.parentPort.postMessage({
        type: 'event',
        event: {
          name: MonitoringInternalEvent.WORKSPACE_CHANGED,
          data: event,
        },
      });
    }

    const delay = state?.watchingMode === 'minimal' ? 300 : 500;
    this.scheduleGitStatusRefresh(repoPath, delay);
  }

  private scheduleGitStatusRefresh(repoPath: string, delay: number): void {
    const state = this.repositories.get(repoPath);
    if (!state?.gitWatchingEnabled) {
      return;
    }

    const existingTimer = this.gitStatusRefreshTimers.get(repoPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.gitStatusRefreshTimers.delete(repoPath);
      try {
        const status = await this.getGitStatus(repoPath);
        if (process.parentPort) {
          process.parentPort.postMessage({
            type: 'event',
            event: {
              name: MonitoringInternalEvent.GIT_STATUS_CHANGED,
              data: status,
            },
          });
        }
      } catch (error) {
        console.error(`[RepositoryMonitoring] Failed to refresh git status after workspace change for ${repoPath}:`, error);
      }
    }, delay);

    this.gitStatusRefreshTimers.set(repoPath, timer);
  }

  /**
   * Handle git state events from the library-based watcher
   * These are specific state transitions (commit, branch-switch, merge, etc.)
   */
  private async handleGitStateEvent(payload: GitStateEventPayload): Promise<void> {
    const { event, affectedCacheFields } = payload;

    console.info(`[RepositoryMonitoring] Git state event received:`, {
      type: event.type,
      repo: event.repoPath,
      branch: event.branch,
      sha: event.shortSha,
      affectedFields: affectedCacheFields,
    });

    // Clear affected caches based on event type
    if (affectedCacheFields.includes('fileTree')) {
      this.fileTreeCache.delete(event.repoPath);
    }
    if (affectedCacheFields.includes('packages')) {
      this.packageCache.delete(event.repoPath);
    }

    // Update repository state with latest info
    const state = this.repositories.get(event.repoPath);
    if (state) {
      state.lastLocalChange = new Date(event.timestamp).toISOString();
    }

    // Forward the git state event to main process
    if (process.parentPort) {
      process.parentPort.postMessage({
        type: 'event',
        event: {
          name: MonitoringInternalEvent.GIT_STATE_EVENT,
          data: payload,
        },
      });
    }

    // Also trigger a status update if needed for compatibility
    if (affectedCacheFields.includes('gitStatus')) {
      const status = await this.getGitStatus(event.repoPath);
      if (process.parentPort) {
        process.parentPort.postMessage({
          type: 'event',
          event: {
            name: MonitoringInternalEvent.GIT_STATUS_CHANGED,
            data: status,
          },
        });
      }
    }
  }

  /**
   * Resolve dependency information by checking registered repositories
   * Returns AlexandriaEntry-like information if the dependency is found as a registered repository
   */
  async resolveDependency(request: DependencyResolutionRequest): Promise<DependencyResolutionResult> {
    const { dependencyId, repositoryRoot } = request;
    
    console.info(`[RepositoryMonitoring] Resolving dependency: ${dependencyId}`);

    const result: DependencyResolutionResult = {
      dependencyId,
      found: false,
    };

    try {
      // First, check if the dependency exists in the current repository (if provided)
      if (repositoryRoot && this.repositories.has(repositoryRoot)) {
        const packageInfo = await this.checkDependencyInRepository(dependencyId, repositoryRoot);
        if (packageInfo) {
          result.found = true;
          result.packageInfo = packageInfo;
          
          // Generate installation suggestions based on package structure
          const suggestions = await this.generateInstallationSuggestions(dependencyId, repositoryRoot);
          if (suggestions) {
            result.suggestions = suggestions;
          }
        }
      }

      // Check if the dependency matches any registered repository by name
      const matchingRepo = await this.findRepositoryByDependencyId(dependencyId);
      if (matchingRepo) {
        result.found = true;
        result.alexandriaEntry = matchingRepo;
      }

      console.info(`[RepositoryMonitoring] Dependency resolution result:`, {
        dependencyId,
        found: result.found,
        hasPackageInfo: !!result.packageInfo,
        hasAlexandriaEntry: !!result.alexandriaEntry,
        hasSuggestions: !!result.suggestions,
      });

      return result;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error resolving dependency ${dependencyId}:`, error);
      return result;
    }
  }

  /**
   * Check if a dependency exists in a specific repository's packages
   */
  private async checkDependencyInRepository(
    dependencyId: string, 
    repositoryPath: string
  ): Promise<DependencyResolutionResult['packageInfo'] | null> {
    try {
      const packagesResult = await this.getPackages(repositoryPath);
      if (!packagesResult) return null;

      // Search through all packages for the dependency
      for (const pkg of packagesResult.packages) {
        const { dependencies, devDependencies } = pkg.packageData;
        
        // Check regular dependencies
        if (dependencies && dependencies[dependencyId]) {
          return {
            name: dependencyId,
            version: dependencies[dependencyId],
            packagePath: pkg.packageData.path,
            isDevDependency: false,
          };
        }

        // Check dev dependencies
        if (devDependencies && devDependencies[dependencyId]) {
          return {
            name: dependencyId,
            version: devDependencies[dependencyId],
            packagePath: pkg.packageData.path,
            isDevDependency: true,
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error checking dependency in repository:`, error);
      return null;
    }
  }

  /**
   * Find a registered repository that matches the dependency ID
   * This helps identify if the dependency is actually a local/internal package
   */
  private async findRepositoryByDependencyId(
    dependencyId: string
  ): Promise<DependencyResolutionResult['alexandriaEntry'] | null> {
    try {
      // Check all registered repositories
      for (const [repoPath, state] of this.repositories.entries()) {
        // Get package information for this repository
        const packagesResult = await this.getPackages(repoPath);
        if (!packagesResult) continue;

        // Check if any package in this repo matches the dependency ID
        for (const pkg of packagesResult.packages) {
          if (pkg.packageData.name === dependencyId) {
            // Found a matching package! Create AlexandriaEntry-like info
            const gitInfo = await this.getBasicGitInfo(repoPath);
            
            return {
              name: pkg.packageData.name || dependencyId,
              path: repoPath,
              description: `Local package: ${dependencyId}`,
              remoteUrl: gitInfo?.remoteUrl,
              lastCommit: gitInfo?.lastCommit,
              lastCommitMessage: gitInfo?.lastCommitMessage,
              lastCommitAuthor: gitInfo?.lastCommitAuthor,
              lastCommitHash: gitInfo?.lastCommitHash,
            };
          }
        }

        // Also check if the repository name/folder matches the dependency
        const repoName = repoPath.split('/').pop() || '';
        if (repoName === dependencyId || repoName.includes(dependencyId)) {
          const gitInfo = await this.getBasicGitInfo(repoPath);
          
          return {
            name: repoName,
            path: repoPath,
            description: `Repository: ${repoName}`,
            remoteUrl: gitInfo?.remoteUrl,
            lastCommit: gitInfo?.lastCommit,
            lastCommitMessage: gitInfo?.lastCommitMessage,
            lastCommitAuthor: gitInfo?.lastCommitAuthor,
            lastCommitHash: gitInfo?.lastCommitHash,
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error finding repository by dependency ID:`, error);
      return null;
    }
  }

  /**
   * Generate installation suggestions based on repository structure
   */
  private async generateInstallationSuggestions(
    dependencyId: string,
    repositoryPath: string
  ): Promise<DependencyResolutionResult['suggestions'] | null> {
    try {
      const packagesResult = await this.getPackages(repositoryPath);
      if (!packagesResult) return null;

      const { packages, summary } = packagesResult;
      
      // Determine package manager from available scripts
      let packageManager = 'npm'; // default
      if (summary.availableScripts.some(script => script.includes('yarn'))) {
        packageManager = 'yarn';
      } else if (summary.availableScripts.some(script => script.includes('pnpm'))) {
        packageManager = 'pnpm';
      }

      // Generate install commands
      const installCommands: string[] = [];
      
      if (summary.isMonorepo && packages.length > 1) {
        // For monorepos, suggest workspace-specific installation
        const workspacePackages = packages.filter(p => p.packageData.path !== '');
        
        if (workspacePackages.length > 0) {
          // Suggest the first workspace package as target
          const targetPackage = workspacePackages[0];
          installCommands.push(`${packageManager} add ${dependencyId} --workspace=${targetPackage.packageData.name || targetPackage.packageData.path}`);
        }
        
        // Also suggest root installation
        installCommands.push(`${packageManager} add ${dependencyId}`);
      } else {
        // Single package repository
        installCommands.push(`${packageManager} add ${dependencyId}`);
      }

      // Add dev dependency option
      installCommands.push(`${packageManager} add ${dependencyId} --save-dev`);

      return {
        installCommands,
        targetPackage: summary.isMonorepo ? packages.find(p => p.packageData.path !== '')?.packageData.name : undefined,
        packageManager,
      };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error generating installation suggestions:`, error);
      return null;
    }
  }

  /**
   * Get basic git information for a repository
   */
  private async getBasicGitInfo(repoPath: string): Promise<{
    remoteUrl?: string;
    lastCommit?: string;
    lastCommitMessage?: string;
    lastCommitAuthor?: string;
    lastCommitHash?: string;
  } | null> {
    try {
      const gitCore = new GitCore(repoPath);
      
      // Get remote URL
      const remotes = await gitCore.getRemotes();
      const originRemote = remotes.find(r => r.name === 'origin');
      
      // Get last commit info
      const commitInfo = await gitCore.getLastCommitInfo();
      
      return {
        remoteUrl: originRemote?.url,
        lastCommit: commitInfo?.date,
        lastCommitMessage: commitInfo?.message,
        lastCommitAuthor: commitInfo?.author,
        lastCommitHash: commitInfo?.shortHash || commitInfo?.hash,
      };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error getting git info for ${repoPath}:`, error);
      return null;
    }
  }

}