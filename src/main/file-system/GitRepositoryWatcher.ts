import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { GitRepositoryService } from './gitRepositoryService';
import { gitClientFactory } from '../utils/gitClientFactory';
// const ignore = require('ignore'); // Temporarily disabled
import { BrowserWindow } from 'electron';
import type { GitStatus, FileChangeEvent } from '../../shared/types/git.types';

interface WatcherInfo {
  gitWatcher: FSWatcher;
  workingWatcher?: FSWatcher;
  debounceTimer?: NodeJS.Timeout;
  lastStatus?: GitStatus;
}

export class GitRepositoryWatcher extends EventEmitter {
  private watchers = new Map<string, WatcherInfo>();
  private gitService: GitRepositoryService;
  // private gitignoreCache = new Map<string, ReturnType<typeof ignore>>();
  
  constructor() {
    super();
    this.gitService = new GitRepositoryService();
  }
  
  /**
   * Start watching a repository for git status changes
   */
  async watchRepository(repoPath: string): Promise<void> {
    // Don't double-watch
    if (this.watchers.has(repoPath)) {
      console.log(`[GitWatcher] Already watching ${repoPath}`);
      return;
    }
    
    console.log(`[GitWatcher] Starting watch for ${repoPath}`);
    
    try {
      // Check if directory exists before watching
      try {
        await fs.access(repoPath);
      } catch (error) {
        console.log(`[GitWatcher] Directory does not exist: ${repoPath}`);
        // Emit an event to notify that this local clone should be removed
        this.emit('local-clone-missing', { repoPath });
        
        // Send to all renderer windows
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('git:local-clone-missing', { repoPath });
        });
        return;
      }
      // Load gitignore patterns - disabled for now
      // const gitignore = await this.loadGitignore(repoPath);
      // this.gitignoreCache.set(repoPath, gitignore);
      
      // Watch critical git files for instant updates
      const gitWatcher = watch([
        path.join(repoPath, '.git', 'HEAD'),       // Branch changes
        path.join(repoPath, '.git', 'index'),      // Staging area
        path.join(repoPath, '.git', 'refs', 'heads'), // Local branches
        path.join(repoPath, '.git', 'FETCH_HEAD'), // Remote tracking
      ], {
        ignoreInitial: true,
        persistent: true,
        followSymlinks: false,
        depth: 3,
      });
      
      // Option A: Minimal working directory watching (simplified without gitignore for now)
      const workingWatcher = watch(repoPath, {
        ignored: (filePath: string) => {
          // Always ignore .git directory
          if (filePath.includes('.git')) return true;
          
          // Common ignores for performance
          if (filePath.includes('node_modules') || 
              filePath.includes('dist') || 
              filePath.includes('build') ||
              filePath.includes('.next') ||
              filePath.includes('coverage')) {
            return true;
          }
          
          return false;
        },
        persistent: true,
        ignoreInitial: true,
        depth: 10, // Reasonable depth limit
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100
        }
      });
      
      const watcherInfo: WatcherInfo = {
        gitWatcher,
        workingWatcher,
      };
      
      // Debounced status check
      const handleChange = (source: string) => {
        if (watcherInfo.debounceTimer) {
          clearTimeout(watcherInfo.debounceTimer);
        }
        
        watcherInfo.debounceTimer = setTimeout(() => {
          this.checkStatus(repoPath, source);
        }, 500);
      };
      
      // Set up event handlers for git status changes
      gitWatcher.on('change', () => handleChange('git'));
      gitWatcher.on('add', () => handleChange('git'));
      gitWatcher.on('unlink', () => handleChange('git'));
      
      // Set up event handlers for file changes - emit file-specific events
      workingWatcher.on('change', (filePath, stats) => {
        handleChange('working');
        this.emitFileChange(repoPath, 'change', filePath, stats);
      });
      workingWatcher.on('add', (filePath, stats) => {
        handleChange('working');
        this.emitFileChange(repoPath, 'add', filePath, stats);
      });
      workingWatcher.on('unlink', (filePath) => {
        handleChange('working');
        this.emitFileChange(repoPath, 'unlink', filePath, undefined);
      });
      
      this.watchers.set(repoPath, watcherInfo);
      
      // Initial status check
      await this.checkStatus(repoPath, 'initial');
      
    } catch (error) {
      console.error(`[GitWatcher] Failed to watch ${repoPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Stop watching a repository
   */
  async unwatchRepository(repoPath: string): Promise<void> {
    const watcherInfo = this.watchers.get(repoPath);
    if (!watcherInfo) {
      return;
    }
    
    console.log(`[GitWatcher] Stopping watch for ${repoPath}`);
    
    if (watcherInfo.debounceTimer) {
      clearTimeout(watcherInfo.debounceTimer);
    }
    
    await watcherInfo.gitWatcher.close();
    if (watcherInfo.workingWatcher) {
      await watcherInfo.workingWatcher.close();
    }
    
    this.watchers.delete(repoPath);
    // this.gitignoreCache.delete(repoPath);
  }
  
  /**
   * Stop watching all repositories
   */
  async destroy(): Promise<void> {
    console.log('[GitWatcher] Destroying all watchers');
    
    for (const repoPath of this.watchers.keys()) {
      await this.unwatchRepository(repoPath);
    }
  }
  
  /**
   * Check git status and emit if changed
   */
  private async checkStatus(repoPath: string, source: string): Promise<void> {
    try {
      const watcherInfo = this.watchers.get(repoPath);
      if (!watcherInfo) return;
      
      // Get current status
      const status = await this.getGitStatus(repoPath);
      
      // Check if status changed
      const lastStatus = watcherInfo.lastStatus;
      if (!lastStatus || this.hasStatusChanged(lastStatus, status)) {
        console.log(`[GitWatcher] Status changed for ${repoPath} (source: ${source})`);
        watcherInfo.lastStatus = status;
        
        // Emit to main process listeners
        this.emit('status-changed', status);
        
        // Send to all renderer windows
        // Ensure the status is a plain object (no class instances or functions)
        const plainStatus = JSON.parse(JSON.stringify(status));
        
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('git:status-update', plainStatus);
        });
      }
    } catch (error) {
      console.error(`[GitWatcher] Failed to check status for ${repoPath}:`, error);
    }
  }
  
  /**
   * Get comprehensive git status
   */
  private async getGitStatus(repoPath: string): Promise<GitStatus> {
    try {
      // Check if directory exists before trying to get git status
      try {
        await fs.access(repoPath);
      } catch (error) {
        console.log(`[GitWatcher] Failed to get git status for ${repoPath}: Directory does not exist`);
        // Emit an event to notify that this local clone should be removed
        this.emit('local-clone-missing', { repoPath });
        
        // Send to all renderer windows
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('git:local-clone-missing', { repoPath });
        });
        
        // Return a default status to avoid throwing
        return {
          repoPath,
          branch: 'unknown',
          isDirty: false,
          hasUntracked: false,
          hasStaged: false,
          ahead: 0,
          behind: 0
        };
      }
      
      const git = await gitClientFactory.getClient(repoPath);
      
      // Run commands in parallel for efficiency
      const [branchResult, statusResult, aheadResult, behindResult] = await Promise.all([
        // Current branch
        git.raw(['symbolic-ref', '--short', 'HEAD'])
          .then((result: string) => result.trim())
          .catch((error: Error) => {
            console.log(`[GitWatcher] Branch command failed: ${error.message}, falling back to HEAD`);
            return 'HEAD';
          }),
        
        // Working tree status
        git.raw(['status', '--porcelain', '-uall'])
          .then((result: string) => result)
          .catch((error: Error) => {
            console.log(`[GitWatcher] Status command failed: ${error.message}`);
            return '';
          }),
        
        // Commits ahead
        git.raw(['rev-list', '--count', '@{u}..HEAD'])
          .then((result: string) => parseInt(result.trim(), 10))
          .catch((error: any) => {
            console.log(`[GitWatcher] Ahead command failed: ${error.message}`);
            return 0;
          }),
        
        // Commits behind
        git.raw(['rev-list', '--count', 'HEAD..@{u}'])
          .then((result: string) => parseInt(result.trim(), 10))
          .catch((error: any) => {
            console.log(`[GitWatcher] Behind command failed: ${error.message}`);
            return 0;
          }),
      ]);
      
      const branch = branchResult;
      const statusOutput = statusResult;
      const ahead = aheadResult;
      const behind = behindResult;
      
      // Parse status output
      const lines = statusOutput.split('\n').filter(Boolean);
      let hasStaged = false;
      let hasUntracked = false;
      let hasModified = false;
      
      for (const line of lines) {
        const status = line.substring(0, 2);
        if (status[0] !== ' ' && status[0] !== '?') hasStaged = true;
        if (status[0] === '?' || status[1] === '?') hasUntracked = true;
        if (status[1] !== ' ' && status[1] !== '?') hasModified = true;
      }
      
      return {
        repoPath,
        branch: branch,
        isDirty: lines.length > 0,
        hasUntracked,
        hasStaged,
        ahead,
        behind,
      };
    } catch (error) {
      console.error(`[GitWatcher] Failed to get git status for ${repoPath}:`, error);
      // Repository might not be initialized
      return {
        repoPath,
        branch: 'unknown',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
      };
    }
  }
  
  /**
   * Load and parse gitignore file - disabled for now
   */
  // private async loadGitignore(repoPath: string): Promise<ReturnType<typeof ignore>> {
  //   const ig = ignore();
  //   
  //   try {
  //     // Load .gitignore
  //     const gitignorePath = path.join(repoPath, '.gitignore');
  //     const content = await fs.readFile(gitignorePath, 'utf-8');
  //     ig.add(content);
  //   } catch {
  //     // No gitignore or can't read - that's ok
  //   }
  //   
  //   // Always ignore .git directory
  //   ig.add('.git');
  //   
  //   return ig;
  // }
  
  /**
   * Check if status has changed
   */
  private hasStatusChanged(oldStatus: GitStatus, newStatus: GitStatus): boolean {
    return (
      oldStatus.branch !== newStatus.branch ||
      oldStatus.isDirty !== newStatus.isDirty ||
      oldStatus.hasUntracked !== newStatus.hasUntracked ||
      oldStatus.hasStaged !== newStatus.hasStaged ||
      oldStatus.ahead !== newStatus.ahead ||
      oldStatus.behind !== newStatus.behind
    );
  }
  
  /**
   * Get current status for a repository (if watching)
   */
  getCurrentStatus(repoPath: string): GitStatus | undefined {
    return this.watchers.get(repoPath)?.lastStatus;
  }
  
  /**
   * Get all watched repositories
   */
  getWatchedRepositories(): string[] {
    return Array.from(this.watchers.keys());
  }
  
  /**
   * Emit file change event
   */
  private emitFileChange(repoPath: string, type: 'add' | 'change' | 'unlink', filePath: string, stats: any): void {
    // Convert absolute path to relative path
    const relativePath = path.relative(repoPath, filePath);
    
    // Skip if it's a git internal file
    if (relativePath.startsWith('.git')) return;
    
    const event: FileChangeEvent = {
      repoPath,
      type,
      path: relativePath,
      isDirectory: stats ? stats.isDirectory() : false
    };
    
    // Emit to main process listeners
    this.emit('file-changed', event);
    
    // Send to all renderer windows
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('git:file-changed', event);
    });
  }

  /**
   * Manually refresh status for a repository
   */
  async refreshStatus(repoPath: string): Promise<GitStatus | null> {
    try {
      console.log(`[GitWatcher] Manual refresh requested for ${repoPath}`);
      
      // Check if we're watching this repository
      const watcherInfo = this.watchers.get(repoPath);
      console.log(`[GitWatcher] Watcher exists for ${repoPath}: ${!!watcherInfo}`);
      
      if (!watcherInfo) {
        console.log(`[GitWatcher] No watcher found, getting status directly for ${repoPath}`);
        // Not watching, but we can still get the status
        const status = await this.getGitStatus(repoPath);
        console.log(`[GitWatcher] Direct status result:`, JSON.stringify(status, null, 2));
        return status;
      }
      
      // Force immediate status check
      console.log(`[GitWatcher] Forcing status check for ${repoPath}`);
      await this.checkStatus(repoPath, 'manual-refresh');
      
      // Return the updated status
      const finalStatus = watcherInfo.lastStatus || null;
      console.log(`[GitWatcher] Final status for ${repoPath}:`, JSON.stringify(finalStatus, null, 2));
      return finalStatus;
    } catch (error) {
      console.error(`[GitWatcher] Failed to refresh status for ${repoPath}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const gitRepositoryWatcher = new GitRepositoryWatcher();