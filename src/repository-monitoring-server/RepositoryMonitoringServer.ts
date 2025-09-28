/**
 * Repository Monitoring Server - Main coordinator
 * Milestone 1: Basic structure with FileTree building
 * Enhanced with Git FSMonitor-based watching
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { FileTreeBuilder } from './FileTreeBuilder';
import { PackageProcessor } from './PackageProcessor';
import { GitCore } from '../shared/repository-core/GitCore';
import { FSWatcher, watch } from 'chokidar';
import * as path from 'path';
import { spawn } from 'child_process';
import type { RepositoryState, CachedFileTree, GitStatus, PackageSummary, ToolExecutionResult } from './types';
import { MonitoringInternalEvent } from './types';

export class RepositoryMonitoringServer {
  private repositories: Map<string, RepositoryState> = new Map();
  private fileTreeCache: Map<string, CachedFileTree> = new Map();
  private fileTreeBuilder: FileTreeBuilder;
  private packageProcessor: PackageProcessor;
  private gitWatchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private fsMonitorStatus: Map<string, boolean> = new Map();
  private packageCache: Map<string, { packages: PackageLayer[]; summary: PackageSummary; timestamp: number }> = new Map();

  constructor() {
    this.fileTreeBuilder = new FileTreeBuilder();
    this.packageProcessor = new PackageProcessor();
  }

  /**
   * Register a repository for monitoring
   */
  async registerRepository(path: string): Promise<void> {
    if (!this.repositories.has(path)) {
      this.repositories.set(path, {
        path,
        lastUpdated: new Date(),
        isWatching: false,
      });
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
   * Refresh repository data (clear cache)
   */
  async refreshRepository(path: string): Promise<void> {
    this.fileTreeCache.delete(path);
    this.packageCache.delete(path);
    await this.getFileTree(path);
  }

  /**
   * Get git status for a repository
   */
  async getGitStatus(repoPath: string): Promise<GitStatus> {
    try {
      const detailedStatus = await GitCore.getDetailedStatus(repoPath);
      const state = this.repositories.get(repoPath);

      const status: GitStatus = {
        repoPath,
        branch: detailedStatus.branch,
        isDirty: detailedStatus.isDirty,
        hasUntracked: detailedStatus.hasUntracked,
        hasStaged: detailedStatus.hasStaged,
        ahead: detailedStatus.ahead,
        behind: detailedStatus.behind,
        watchingEnabled: state?.gitWatchingEnabled || false,
      };

      // Cache the status
      if (state) {
        state.lastGitStatus = status;
      }

      return status;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git status for ${repoPath}:`, error);
      return {
        repoPath,
        branch: 'unknown',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
        watchingEnabled: false,
      };
    }
  }

  /**
   * Get git status with file lists
   */
  async getGitStatusWithFiles(repoPath: string): Promise<any> {
    try {
      // Get basic status first
      const basicStatus = await this.getGitStatus(repoPath);

      // Get detailed file lists from git
      const fileStatus = await GitCore.getStatus(repoPath);

      // For now, we'll use the existing categories from getStatus
      // and derive created/deleted from the untracked/modified lists
      // In the future, we could enhance GitCore.getStatus to return more categories

      return {
        ...basicStatus,
        modifiedFiles: fileStatus.modified || [],
        untrackedFiles: fileStatus.not_added || [],
        stagedFiles: fileStatus.staged || [],
        // For now, treat untracked files as created (new files)
        createdFiles: fileStatus.not_added || [],
        // Deleted files would need additional parsing - leaving empty for now
        deletedFiles: [],
      };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git status with files for ${repoPath}:`, error);
      return {
        repoPath,
        branch: 'unknown',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
        watchingEnabled: false,
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
      // Try to enable FSMonitor first
      const fsMonitorEnabled = await GitCore.enableFSMonitor(repoPath);
      this.fsMonitorStatus.set(repoPath, fsMonitorEnabled);

      // Set up file watching based on FSMonitor availability
      if (fsMonitorEnabled) {
        // Minimal watching - just watch key git files
        await this.setupMinimalGitWatching(repoPath);
        state.watchingMode = 'minimal';
      } else {
        // Fallback to more comprehensive watching
        await this.setupFallbackGitWatching(repoPath);
        state.watchingMode = 'fallback';
      }

      state.gitWatchingEnabled = true;
      state.fsMonitorEnabled = fsMonitorEnabled;

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
    }

    // Clean up watcher
    const watcher = this.gitWatchers.get(repoPath);
    if (watcher) {
      await watcher.close();
      this.gitWatchers.delete(repoPath);
    }

    // Clear any pending debounce timers
    const timer = this.debounceTimers.get(repoPath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(repoPath);
    }
  }

  /**
   * Setup minimal git watching (when FSMonitor is enabled)
   * FSMonitor makes git status fast, but we still need to detect working dir changes
   */
  private async setupMinimalGitWatching(repoPath: string): Promise<void> {
    const gitDir = path.join(repoPath, '.git');

    // Get gitignore patterns to exclude from watching
    let gitignorePatterns: string[] = [];
    try {
      const gitignorePath = path.join(repoPath, '.gitignore');
      if (require('fs').existsSync(gitignorePath)) {
        const gitignoreContent = require('fs').readFileSync(gitignorePath, 'utf8');
        gitignorePatterns = gitignoreContent
          .split('\n')
          .filter((line: string) => line.trim() && !line.startsWith('#'))
          .map((pattern: string) => `**/${pattern.trim()}`);
      }
    } catch (error) {
      // Ignore .gitignore read errors
    }

    // Watch the repository directory (shallow) to detect any changes
    const watcher = watch(repoPath, {
      depth: 2, // Shallow watching to avoid too many file handles
      ignoreInitial: true,
      persistent: true,
      // Use a function for ignored to handle paths more precisely
      ignored: (path: string) => {
        // Ignore .git directory and everything in it
        if (path.includes('/.git/') || path.endsWith('/.git')) {
          return true;
        }
        // Ignore common large directories
        if (path.includes('/node_modules/') || path.endsWith('/node_modules')) {
          return true;
        }
        if (path.includes('/.next/') || path.includes('/dist/') || path.includes('/build/')) {
          return true;
        }
        // Check gitignore patterns
        for (const pattern of gitignorePatterns) {
          if (path.includes(pattern.replace('**/', '/'))) {
            return true;
          }
        }
        return false;
      },
      awaitWriteFinish: {
        stabilityThreshold: 300, // Fast since FSMonitor helps git status
        pollInterval: 100,
      },
    });

    watcher.on('all', (event, filePath) => {
      this.handleGitChange(repoPath, filePath, event);
    });

    this.gitWatchers.set(repoPath, watcher);
  }

  /**
   * Setup fallback git watching (when FSMonitor is not available)
   */
  private async setupFallbackGitWatching(repoPath: string): Promise<void> {
    // Watch the repository directory efficiently - just detect any changes, don't track individual files
    const watcher = watch(repoPath, {
      // Only watch directories, not individual files, and limit depth
      depth: 2, // Watch repo root + immediate subdirectories
      ignoreInitial: true,
      persistent: true,
      // Use a function for ignored to handle paths more precisely
      ignored: (path: string) => {
        // Ignore .git directory and everything in it
        if (path.includes('/.git/') || path.endsWith('/.git')) {
          return true;
        }
        // Ignore common large directories
        if (path.includes('/node_modules/') || path.endsWith('/node_modules')) {
          return true;
        }
        if (path.includes('/.next/') || path.includes('/dist/') || path.includes('/build/')) {
          return true;
        }
        if (path.includes('/target/') || path.includes('/venv/') || path.includes('/__pycache__/')) {
          return true;
        }
        return false;
      },
      // More aggressive debouncing for efficiency
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    watcher.on('all', (event, filePath) => {
      // Any change in the repo directory triggers a git status check
      // We don't care about the specific file, just that something changed
      this.handleGitChange(repoPath, filePath, event);
    });

    this.gitWatchers.set(repoPath, watcher);
  }

  /**
   * Handle file system changes
   */
  private handleGitChange(repoPath: string, filePath: string, event: string): void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(repoPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Determine debounce delay based on FSMonitor status and change type
    const hasFSMonitor = this.fsMonitorStatus.get(repoPath) || false;
    const delay = hasFSMonitor ? 800 : 2000; // Reduced delay but still prevent loops

    const timer = setTimeout(async () => {
      const status = await this.getGitStatus(repoPath);

      // Emit status change event to main process
      if (process.parentPort) {
        process.parentPort.postMessage({
          type: 'event',
          event: {
            name: MonitoringInternalEvent.GIT_STATUS_CHANGED,
            data: status,
          },
        });
      }

      this.debounceTimers.delete(repoPath);
    }, delay);

    this.debounceTimers.set(repoPath, timer);
  }

}