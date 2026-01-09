import { BrowserWindow, ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import fetch from 'node-fetch';
import { electronCLI } from '../electron-cli-bridge';
import { UnifiedSecureStorage } from '../services/UnifiedSecureStorage';
import { authService } from '../services/AuthService';
import {
  GitHubAPIEvent,
  ConfigFetchRequest,
  ConfigFetchResponse,
  GitHubConfigRequest,
  GitHubRepository,
  GitHubOrganization,
  RepositoryFetchOptions,
  CreateRepositoryInput,
  GitHubRepositoryCreated,
  GitHubLicenseTemplate,
  InstallSkillOptions,
  InstallSkillResult,
} from '../../shared/main-process-api-interfaces/GitHubAPI';
import type { IModernApplicationWindow } from '../window/types';

export interface GitRepositoryInfo {
  path: string;
  isGitRepository: boolean;
  remotes: GitRemoteInfo[];
  owner?: string;
  repo?: string;
  isGitHub: boolean;
  currentBranch?: string;
  defaultBranch?: string;
}

export interface GitRemoteInfo {
  name: string;
  url: string;
  owner?: string;
  repo?: string;
  isGitHub: boolean;
  provider?: 'github' | 'gitlab' | 'bitbucket' | 'other';
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  method: 'cli' | 'token' | 'none';
  username?: string;
  scope?: string[];
  rateLimit?: {
    remaining: number;
    total: number;
    resetTime: Date;
  };
}

export class GitHubAdapter {
  private cache: Map<string, any> = new Map();
  private storage: UnifiedSecureStorage;

  constructor() {
    this.storage = UnifiedSecureStorage.getInstance();
  }

  /**
   * Get a valid GitHub token with automatic refresh if expired
   * Uses AuthService for centralized token management with auto-refresh
   */
  private async getGitHubToken(): Promise<string | null> {
    try {
      // Use AuthService which handles token expiry and auto-refresh
      const token = await authService.getValidToken();
      return token;
    } catch (error) {
      console.error('[GitHub] Failed to get GitHub token:', error);
      return null;
    }
  }

  /**
   * Make an API call to GitHub using the stored token
   */
  private async makeGitHubAPICall(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {},
  ): Promise<{
    success: boolean;
    data?: any;
    headers?: any;
    status?: number;
    statusText?: string;
    error?: string;
  }> {
    console.log('[GitHub] makeGitHubAPICall: Requesting endpoint:', endpoint);

    const token = await this.getGitHubToken();
    if (!token) {
      console.error('[GitHub] makeGitHubAPICall: No GitHub token available');
      return { success: false, error: 'No GitHub token available' };
    }

    // Debug: Check token format (mask most of it for security)
    console.log('[GitHub] Token info:', {
      length: token.length,
      prefix: token.substring(0, 4),
      hasGho: token.startsWith('gho_'),
      hasGhp: token.startsWith('ghp_'),
    });

    // GitHub OAuth tokens (gho_) use "token" auth, not "Bearer"
    const authHeader = token.startsWith('gho_')
      ? `token ${token}`
      : `Bearer ${token}`;

    try {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github.v3+json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const errorDetail = {
          success: false,
          status: response.status,
          statusText: response.statusText,
          error: `GitHub API error: ${response.status} ${response.statusText}`,
        };

        // Log specific status codes that indicate token issues
        if (response.status === 401) {
          console.error(
            '[GitHub] makeGitHubAPICall: Authentication failed (401) - token may be expired or invalid',
          );
        } else if (response.status === 403) {
          console.error(
            '[GitHub] makeGitHubAPICall: Forbidden (403) - token may lack required permissions',
          );
        } else {
          console.error(
            '[GitHub] makeGitHubAPICall: Request failed',
            errorDetail,
          );
        }

        return errorDetail;
      }

      // Check if the response is raw content (e.g., application/vnd.github.v3.raw)
      const contentType = response.headers.get('content-type') || '';
      let data: any;

      if (
        contentType.includes('application/vnd.github.v3.raw') ||
        contentType.includes('text/plain') ||
        options.headers?.Accept?.includes('application/vnd.github.v3.raw')
      ) {
        // For raw content, return as text
        data = await response.text();
      } else {
        // For JSON responses, parse as JSON
        data = await response.json();
      }

      console.log(
        '[GitHub] makeGitHubAPICall: Request successful for endpoint:',
        endpoint,
      );
      return {
        success: true,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      console.error('[GitHub] API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Git repository detection
  async detectRepository(
    directoryPath: string,
  ): Promise<GitRepositoryInfo | null> {
    console.log(`[GitHub] Detecting repository for: ${directoryPath}`);

    try {
      // Check if .git directory exists
      const gitPath = path.join(directoryPath, '.git');
      if (!fs.existsSync(gitPath)) {
        console.log(`[GitHub] No .git directory found in ${directoryPath}`);
        return null;
      }

      // Get git remotes
      const remotes = await this.getGitRemotes(directoryPath);
      const githubRemote = remotes.find((remote) => remote.isGitHub);

      // Get current branch
      const branchResult = await this.executeCommand(
        ['git', 'branch', '--show-current'],
        { cwd: directoryPath },
      );
      const currentBranch = branchResult.success
        ? branchResult.stdout.trim()
        : undefined;

      // Get default branch (try to get from remote)
      let defaultBranch: string | undefined;
      if (githubRemote) {
        const defaultBranchResult = await this.executeCommand(
          ['git', 'symbolic-ref', 'refs/remotes/origin/HEAD'],
          { cwd: directoryPath },
        );
        if (defaultBranchResult.success) {
          defaultBranch = defaultBranchResult.stdout
            .trim()
            .replace('refs/remotes/origin/', '');
        }
      }

      const result: GitRepositoryInfo = {
        path: directoryPath,
        isGitRepository: true,
        remotes,
        isGitHub: !!githubRemote,
        owner: githubRemote?.owner,
        repo: githubRemote?.repo,
        currentBranch,
        defaultBranch,
      };

      console.log(`[GitHub] Repository detected:`, result);
      return result;
    } catch (error) {
      console.error(`[GitHub] Error detecting repository:`, error);
      return null;
    }
  }

  private async getGitRemotes(directoryPath: string): Promise<GitRemoteInfo[]> {
    const result = await this.executeCommand(['git', 'remote', '-v'], {
      cwd: directoryPath,
    });
    if (!result.success) {
      return [];
    }

    const remotes: GitRemoteInfo[] = [];
    const lines = result.stdout.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const match = line.match(/^(\w+)\s+(.+?)\s+\(fetch\)$/);
      if (match) {
        const [, name, url] = match;
        const remote = this.parseGitRemoteUrl(name, url);
        if (!remotes.find((r) => r.name === remote.name)) {
          remotes.push(remote);
        }
      }
    }

    return remotes;
  }

  private parseGitRemoteUrl(name: string, url: string): GitRemoteInfo {
    const remote: GitRemoteInfo = {
      name,
      url,
      isGitHub: false,
      provider: 'other',
    };

    // Parse GitHub URLs
    const githubPatterns = [
      /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    ];

    for (const pattern of githubPatterns) {
      const match = url.match(pattern);
      if (match) {
        remote.owner = match[1];
        remote.repo = match[2];
        remote.isGitHub = true;
        remote.provider = 'github';
        break;
      }
    }

    return remote;
  }

  // GitHub CLI operations
  async checkAuthStatus(): Promise<AuthStatus> {
    try {
      // First, check if gh cli is logged in
      const authStatusResult = await this.executeCommand([
        'gh',
        'auth',
        'status',
      ]);

      if (!authStatusResult.success) {
        return { isAuthenticated: false, method: 'none' };
      }

      // Then, make a test API call to verify the token is valid
      const userResult = await this.executeCommand(['gh', 'api', 'user']);

      if (userResult.success) {
        const userMatch = authStatusResult.stderr.match(
          /Logged in to github\.com as ([^\s]+)/,
        );
        return {
          isAuthenticated: true,
          method: 'cli',
          username: userMatch?.[1],
        };
      }

      // If the user call fails, the token is likely invalid
      console.warn('[GitHub] CLI auth check passed, but token is invalid.');
      return { isAuthenticated: false, method: 'none' };
    } catch (error) {
      console.log(`[GitHub] CLI auth check failed:`, error);
    }

    return {
      isAuthenticated: false,
      method: 'none',
    };
  }

  async refreshData(owner: string, repo: string): Promise<void> {
    console.log(`[GitHub] Refreshing data for ${owner}/${repo}`);

    // Clear cache for this repository
    for (const key of this.cache.keys()) {
      if (key.includes(`${owner}:${repo}`)) {
        this.cache.delete(key);
      }
    }
  }

  async getFileAges(
    directoryPath: string,
  ): Promise<
    Map<string, { lastCommitDate: Date; daysSinceLastCommit: number }>
  > {
    console.log(`[GitHub] Getting file ages for: ${directoryPath}`);

    try {
      // Get all tracked files and their last commit date
      const result = await this.executeCommand(
        ['git', 'ls-tree', '-r', '--name-only', 'HEAD'],
        { cwd: directoryPath },
      );

      if (!result.success) {
        console.warn(`[GitHub] Git ls-tree failed: ${result.stderr}`);
        return new Map();
      }

      const files = result.stdout.split('\n').filter((line) => line.trim());
      const fileAges = new Map<
        string,
        { lastCommitDate: Date; daysSinceLastCommit: number }
      >();
      const now = new Date();

      // Process files in batches to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (filePath) => {
            try {
              // Get the last commit date for this file
              const logResult = await this.executeCommand(
                ['git', 'log', '-1', '--format=%at', '--', filePath],
                { cwd: directoryPath },
              );

              if (logResult.success && logResult.stdout.trim()) {
                const timestamp = parseInt(logResult.stdout.trim(), 10);
                const lastCommitDate = new Date(timestamp * 1000);
                const daysSinceLastCommit = Math.floor(
                  (now.getTime() - lastCommitDate.getTime()) /
                    (1000 * 60 * 60 * 24),
                );

                fileAges.set(filePath, {
                  lastCommitDate,
                  daysSinceLastCommit,
                });
              }
            } catch (error) {
              console.warn(
                `[GitHub] Error getting commit date for ${filePath}:`,
                error,
              );
            }
          }),
        );
      }

      console.log(`[GitHub] Retrieved ages for ${fileAges.size} files`);
      return fileAges;
    } catch (error) {
      console.error(`[GitHub] Error getting file ages:`, error);
      return new Map();
    }
  }

  async getChangedFiles(directoryPath: string): Promise<
    {
      path: string;
      status: 'added' | 'modified' | 'deleted' | 'renamed';
      lastModified?: Date;
    }[]
  > {
    console.log(`[GitHub] Getting changed files for: ${directoryPath}`);

    try {
      // Run git status with porcelain format for machine-readable output
      const result = await this.executeCommand(
        ['git', 'status', '--porcelain'],
        { cwd: directoryPath },
      );

      if (result.success) {
        // Parse the output to get file paths and their status
        const changedFiles = await Promise.all(
          result.stdout
            .split('\n')
            .filter((line) => line.trim())
            .map(async (line) => {
              // Git status porcelain format: "XY filename"
              // X = staged status, Y = unstaged status
              const statusFlags = line.substring(0, 2);
              let filePath = line.substring(3).trim();

              // Git wraps filenames with special characters (spaces, quotes, etc.) in double quotes
              // and escapes special characters within them. Remove the quotes and unescape.
              if (filePath.startsWith('"') && filePath.endsWith('"')) {
                filePath = filePath.slice(1, -1); // Remove surrounding quotes
                // Unescape common git escape sequences
                filePath = filePath
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\')
                  .replace(/\\t/g, '\t')
                  .replace(/\\n/g, '\n')
                  .replace(/\\r/g, '\r');
              }

              // Determine the primary status based on the flags
              let status: 'added' | 'modified' | 'deleted' | 'renamed' =
                'modified';

              // Check staged status (first character)
              if (statusFlags[0] === 'A' || statusFlags[1] === 'A') {
                status = 'added';
              } else if (statusFlags[0] === 'D' || statusFlags[1] === 'D') {
                status = 'deleted';
              } else if (statusFlags[0] === 'R' || statusFlags[1] === 'R') {
                status = 'renamed';
              } else if (statusFlags[0] === 'M' || statusFlags[1] === 'M') {
                status = 'modified';
              }

              // Get file stats for last modified time (skip for deleted files)
              let lastModified: Date | undefined;
              if (status !== 'deleted') {
                try {
                  const fullPath = path.join(directoryPath, filePath);
                  const stats = fs.statSync(fullPath);
                  lastModified = stats.mtime;
                } catch (error) {
                  // File might not exist or be accessible, skip the timestamp
                  console.warn(
                    `[GitHub] Could not get stats for file: ${filePath}`,
                  );
                }
              }

              return {
                path: filePath,
                status,
                lastModified,
              };
            }),
        );

        // Sort by last modified time (most recent first), then by path
        const sortedFiles = changedFiles
          .filter((file) => file.path.length > 0)
          .sort((a, b) => {
            // If both have lastModified, sort by time (most recent first)
            if (a.lastModified && b.lastModified) {
              return b.lastModified.getTime() - a.lastModified.getTime();
            }
            // If only one has lastModified, prioritize it
            if (a.lastModified && !b.lastModified) return -1;
            if (!a.lastModified && b.lastModified) return 1;
            // If neither has lastModified, sort by path
            return a.path.localeCompare(b.path);
          });

        console.log(
          `[GitHub] Found ${sortedFiles.length} changed files (sorted by modification time)`,
        );
        return sortedFiles;
      }
      console.warn(`[GitHub] Git status failed: ${result.stderr}`);
      return [];
    } catch (error) {
      console.error(`[GitHub] Error getting changed files:`, error);
      return [];
    }
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null> {
    try {
      console.debug('[GitHub:getFileContent] request', {
        owner,
        repo,
        path,
        ref,
      });
      // Remote-first: try gh CLI without relying on local cwd
      const refSuffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const ghResult = await this.executeCommand([
        'gh',
        'api',
        `/repos/${owner}/${repo}/contents/${path}${refSuffix}`,
        '-H',
        'Accept: application/vnd.github.v3.raw',
      ]);

      if (ghResult.success && ghResult.stdout) {
        console.debug('[GitHub:getFileContent] gh api success', {
          bytes: ghResult.stdout.length,
        });
        return ghResult.stdout;
      }
      console.warn(
        '[GitHub:getFileContent] gh api failed, trying token-based API',
        ghResult.stderr,
      );

      // Try token-based API using stored credentials
      const apiEndpoint = `/repos/${owner}/${repo}/contents/${path}${refSuffix}`;
      const apiResult = await this.makeGitHubAPICall(apiEndpoint, {
        headers: {
          Accept: 'application/vnd.github.v3.raw',
        },
      });

      if (apiResult.success && apiResult.data) {
        // When using v3.raw, the data is returned as plain text
        const content =
          typeof apiResult.data === 'string'
            ? apiResult.data
            : JSON.stringify(apiResult.data);
        console.debug('[GitHub:getFileContent] token API success', {
          bytes: content.length,
        });
        return content;
      }

      console.error('[GitHub:getFileContent] Token API failed', {
        status: apiResult.status,
        error: apiResult.error,
      });

      return null;
    } catch (error) {
      console.error('[GitHub:getFileContent] Error:', error);
      return null;
    }
  }

  // Local-first helper: try local repo at provided cwd, then fall back to remote getFileContent
  async getFileContentLocalFirst(
    owner: string,
    repo: string,
    path: string,
    cwd: string,
    ref?: string,
  ): Promise<string | null> {
    try {
      // Verify this cwd matches the expected remote
      const remoteResult = await this.executeCommand(
        ['git', 'remote', 'get-url', 'origin'],
        { cwd },
      );
      if (remoteResult.success) {
        const remoteUrl = remoteResult.stdout.trim();
        if (remoteUrl.includes(`${owner}/${repo}`)) {
          try {
            const localPath = require('path').join(cwd, path);
            const content = fs.readFileSync(localPath, 'utf8');
            return content;
          } catch {
            // Ignore and fall through
          }
        }
      }
    } catch {
      // Ignore and fall through
    }

    // Fall back to remote
    return this.getFileContent(owner, repo, path, ref);
  }

  async getMarkdownDocuments(
    owner: string,
    repo: string,
    ref?: string,
  ): Promise<
    Array<{
      path: string;
      name: string;
      lastModified: Date;
      gitLastModified?: Date;
      size: number;
      isTracked: boolean;
    }>
  > {
    try {
      const defaultBranch =
        ref || (await this.getRepoDefaultBranch(owner, repo)) || 'main';
      console.debug('[GitHub:getMarkdownDocuments] request', {
        owner,
        repo,
        ref: defaultBranch,
      });

      const trackedFiles = new Map<string, { path: string; size?: number }>();

      // Try gh first
      const listResult = await this.executeCommand([
        'gh',
        'api',
        `/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        '--jq',
        '.tree[] | select(.type == "blob" and (.path | test("\\.md$|\\.markdown$"))) | {path, size}',
      ]);

      if (listResult.success && listResult.stdout.trim()) {
        console.debug('[GitHub:getMarkdownDocuments] gh tree success');
        const files = listResult.stdout
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean) as Array<{ path: string; size?: number }>;
        for (const file of files) trackedFiles.set(file.path, file);
      } else {
        console.warn(
          '[GitHub:getMarkdownDocuments] gh tree failed, falling back to HTTPS',
          { stderr: listResult.stderr },
        );
        const treeResult = await this.getTreeForPublicRepo(
          owner,
          repo,
          defaultBranch,
        );
        if (treeResult.success && treeResult.data?.tree) {
          console.debug('[GitHub:getMarkdownDocuments] https tree success', {
            entries: treeResult.data.tree.length,
          });
          for (const item of treeResult.data.tree) {
            if (item.type === 'blob' && /\.(md|markdown)$/.test(item.path)) {
              trackedFiles.set(item.path, { path: item.path, size: item.size });
            }
          }
        } else {
          console.warn('[GitHub:getMarkdownDocuments] https tree failed', {
            error: treeResult.error,
          });
        }
      }

      // Build list from tracked files only (remote-only version)
      const allFiles: Array<{
        path: string;
        name: string;
        size: number;
        lastModified: Date | null;
        isTracked: boolean;
      }> = [];

      for (const [p, file] of trackedFiles) {
        allFiles.push({
          path: p,
          name: p.split('/').pop() || p,
          size: file.size || 0,
          lastModified: null,
          isTracked: true,
        });
      }

      // Enrich with commit dates (gh first, HTTPS fallback)
      const documentsWithDates = await Promise.all(
        allFiles.map(async (file) => {
          try {
            const commitResult = await this.executeCommand([
              'gh',
              'api',
              `/repos/${owner}/${repo}/commits?path=${file.path}&sha=${defaultBranch}&per_page=1`,
              '--jq',
              '.[0] | {date: .commit.author.date, sha}',
            ]);

            let gitLastModified: Date | undefined;
            if (commitResult.success && commitResult.stdout.trim()) {
              try {
                const info = JSON.parse(commitResult.stdout);
                if (info?.date) gitLastModified = new Date(info.date);
              } catch {}
            } else {
              console.warn(
                '[GitHub:getMarkdownDocuments] gh commits failed for file, falling back to HTTPS',
                { file: file.path, stderr: commitResult.stderr },
              );
            }

            if (!gitLastModified) {
              const https = require('https');
              const options = {
                hostname: 'api.github.com',
                path: `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(file.path)}&sha=${encodeURIComponent(defaultBranch)}&per_page=1`,
                method: 'GET',
                headers: { 'User-Agent': 'Principle-MD' },
              };

              const info: any = await new Promise((resolve) => {
                const req = https.request(options, (res: any) => {
                  let data = '';
                  res.on('data', (chunk: any) => (data += chunk));
                  res.on('end', () => {
                    if (
                      res.statusCode &&
                      res.statusCode >= 200 &&
                      res.statusCode < 300
                    ) {
                      try {
                        const arr = JSON.parse(data);
                        resolve(Array.isArray(arr) ? arr[0] : null);
                      } catch {
                        resolve(null);
                      }
                    } else {
                      resolve(null);
                    }
                  });
                });
                req.on('error', () => resolve(null));
                req.end();
              });

              if (info?.commit?.author?.date) {
                gitLastModified = new Date(info.commit.author.date);
              }
            }

            const mostRecentDate = gitLastModified || new Date();
            return { ...file, lastModified: mostRecentDate, gitLastModified };
          } catch (error) {
            console.error('[GitHub:getMarkdownDocuments] commit info error', {
              file: file.path,
              error,
            });
            return {
              ...file,
              lastModified: file.lastModified || new Date(),
              gitLastModified: undefined,
            };
          }
        }),
      );

      const sorted = documentsWithDates.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );
      console.debug(
        '[GitHub:getMarkdownDocuments] result count',
        sorted.length,
      );

      return sorted.map((doc) => ({
        ...doc,
        lastModified: doc.lastModified,
        gitLastModified: doc.gitLastModified,
      }));
    } catch (error) {
      console.error('[GitHub:getMarkdownDocuments] Error:', error);
      return [];
    }
  }

  // Local-first helper for markdown: include untracked local files, then fall back to remote
  async getMarkdownDocumentsLocalFirst(
    owner: string,
    repo: string,
    cwd: string,
    ref?: string,
  ): Promise<
    Array<{
      path: string;
      name: string;
      lastModified: Date;
      gitLastModified?: Date;
      size: number;
      isTracked: boolean;
    }>
  > {
    try {
      const pathMod = require('path');
      const verifiedRemote = await this.executeCommand(
        ['git', 'remote', 'get-url', 'origin'],
        { cwd },
      );
      if (
        !verifiedRemote.success ||
        !verifiedRemote.stdout.includes(`${owner}/${repo}`)
      ) {
        return this.getMarkdownDocuments(owner, repo, ref);
      }

      // Start with remote tracked markdown
      const remoteDocs = await this.getMarkdownDocuments(owner, repo, ref);
      const remoteByPath = new Map(remoteDocs.map((d) => [d.path, d]));

      // Scan local for *.md and *.markdown
      const findResult = await this.executeCommand([
        'find',
        cwd,
        '(',
        '-name',
        '*.md',
        '-o',
        '-name',
        '*.markdown',
        ')',
        '-type',
        'f',
      ]);

      const localFiles: Array<any> = [];
      if (findResult.success) {
        for (const filePath of findResult.stdout
          .split('\n')
          .filter((l: string) => l.trim())) {
          const relativePath = filePath.replace(`${cwd}/`, '');
          if (relativePath.includes('.git/')) continue;
          try {
            const stats = fs.statSync(filePath);
            localFiles.push({
              path: relativePath,
              name: relativePath.split('/').pop() || relativePath,
              size: stats.size,
              lastModified: stats.mtime,
              isTracked: remoteByPath.has(relativePath),
            });
          } catch {}
        }
      }

      // Merge local files (prioritize local mtime) with remote commit dates if present
      const merged: Array<any> = [];
      for (const local of localFiles) {
        const remote = remoteByPath.get(local.path);
        if (remote && remote.lastModified) {
          try {
            const remoteDate = new Date(remote.lastModified as any);
            const lastModified =
              local.lastModified > remoteDate ? local.lastModified : remoteDate;
            merged.push({
              ...local,
              lastModified,
              gitLastModified: remote.gitLastModified
                ? new Date(remote.gitLastModified as any)
                : undefined,
            });
          } catch {
            merged.push(local);
          }
        } else {
          merged.push(local);
        }
      }

      // Add remote entries not present locally
      for (const remote of remoteDocs) {
        if (!merged.find((m) => m.path === remote.path)) {
          merged.push({
            path: remote.path,
            name: remote.name,
            size: remote.size,
            lastModified: new Date(remote.lastModified as any),
            gitLastModified: remote.gitLastModified
              ? new Date(remote.gitLastModified as any)
              : undefined,
            isTracked: true,
          });
        }
      }

      // Sort and serialize
      merged.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );
      return merged.map((doc) => ({
        ...doc,
        lastModified: doc.lastModified.toISOString(),
        gitLastModified: doc.gitLastModified
          ? doc.gitLastModified.toISOString()
          : undefined,
      }));
    } catch (error) {
      console.error('[GitHub] Error in getMarkdownDocumentsLocalFirst:', error);
      return this.getMarkdownDocuments(owner, repo, ref);
    }
  }

  async getRepoDefaultBranch(
    owner: string,
    repo: string,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const https = require('https');
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Principle-MD',
        },
      };

      const req = https.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const repoData = JSON.parse(data);
              resolve(repoData.default_branch || null);
            } catch (e) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });

      req.on('error', () => {
        resolve(null);
      });

      req.end();
    });
  }

  private async executeCommand(
    args: string[],
    options: { cwd?: string } = {},
  ): Promise<CommandResult> {
    try {
      // Ensure CLI is initialized
      await electronCLI.initialize();

      const [command, ...commandArgs] = args;

      // Execute command using electron-cli-bridge
      const result = await electronCLI.execute(command, commandArgs, {
        cwd: options.cwd || process.cwd(),
        env: {
          ...process.env,
          // Ensure PATH is properly set for git and gh commands
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        },
      });

      return {
        success: result.success,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  /**
   * Get repository tree (alias for getTreeForPublicRepo)
   */
  async getTree(owner: string, repo: string, ref: string) {
    return this.getTreeForPublicRepo(owner, repo, ref);
  }

  async getTreeForPublicRepo(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(
      `[GitHub] Making public API call for ${owner}/${repo} on branch ${ref}`,
    );
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
      method: 'GET',
      headers: {
        'User-Agent': 'Principle-MD',
      },
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ success: true, data: JSON.parse(data) });
            } catch (e: any) {
              resolve({
                success: false,
                error: `Failed to parse response: ${e.message}`,
              });
            }
          } else {
            const errorMessage = `Request failed with status code ${res.statusCode}`;
            console.error(`[GitHub] Public repo fetch failed: ${errorMessage}`);
            if (res.statusCode === 404) {
              // Specifically throw for 404 to be caught by the UI
              resolve({ success: false, error: 'Repository not found (404)' });
            } else {
              resolve({ success: false, error: errorMessage });
            }
          }
        });
      });

      req.on('error', (error: any) => {
        resolve({ success: false, error: error.message });
      });

      req.end();
    });
  }

  // Create a new GitHub issue
  async createIssue(owner: string, repo: string, issue: any): Promise<any> {
    console.log(`[GitHub] Creating issue for ${owner}/${repo}`, issue);

    try {
      // Try using gh CLI which handles authentication
      const issueData = {
        title: issue.title,
        body: issue.body || '',
        labels: issue.labels?.join(',') || '',
        assignees: issue.assignees?.join(',') || '',
      };

      // Build gh command args
      const args = [
        'gh',
        'issue',
        'create',
        '--repo',
        `${owner}/${repo}`,
        '--title',
        issueData.title,
      ];

      if (issueData.body) {
        args.push('--body', issueData.body);
      }

      if (issueData.labels) {
        args.push('--label', issueData.labels);
      }

      if (issueData.assignees) {
        args.push('--assignee', issueData.assignees);
      }

      const result = await this.executeCommand(args);

      if (result.success && result.stdout) {
        // Extract issue URL from output
        const urlMatch = result.stdout.match(
          /https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+/,
        );
        const numberMatch = result.stdout.match(/\/issues\/(\d+)/);

        if (urlMatch && numberMatch) {
          // Fetch the created issue details
          const issueNumber = numberMatch[1];
          const fetchResult = await this.executeCommand([
            'gh',
            'api',
            `/repos/${owner}/${repo}/issues/${issueNumber}`,
          ]);

          if (fetchResult.success && fetchResult.stdout) {
            const createdIssue = JSON.parse(fetchResult.stdout);
            return {
              success: true,
              issue: createdIssue,
            };
          }
        }

        return {
          success: true,
          issue: {
            html_url: urlMatch ? urlMatch[0] : null,
            title: issue.title,
          },
        };
      } else if (
        result.stderr?.includes('authentication') ||
        result.stderr?.includes('401')
      ) {
        return {
          success: false,
          error:
            'GitHub CLI authentication required. Please run "gh auth login" in your terminal.',
        };
      } else {
        return {
          success: false,
          error: result.stderr || 'Failed to create issue',
        };
      }
    } catch (error) {
      console.error('[GitHub] Error creating issue:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create issue',
      };
    }
  }

  // Fetch GitHub issues
  // Get user's repositories from GitHub
  async getUserRepositories(
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    // Build query parameters
    const params: string[] = [];
    if (options?.type) params.push(`type=${options.type}`);
    if (options?.sort) params.push(`sort=${options.sort}`);
    if (options?.direction) params.push(`direction=${options.direction}`);
    params.push(`per_page=${options?.perPage || 100}`);
    if (options?.page) params.push(`page=${options.page}`);

    const endpoint =
      params.length > 0 ? `/user/repos?${params.join('&')}` : '/user/repos';

    // Try token-based API first
    const apiResult = await this.makeGitHubAPICall(endpoint);
    if (apiResult.success && apiResult.data) {
      return apiResult.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description,
        fork: repo.fork,
        clone_url: repo.clone_url,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        language: repo.language,
        default_branch: repo.default_branch,
        stargazers_count: repo.stargazers_count,
        license: repo.license?.spdx_id || null,
      }));
    }

    // Fallback to CLI
    try {
      const args = ['gh', 'api', endpoint];
      const result = await this.executeCommand(args);

      if (result.success && result.stdout) {
        const repos = JSON.parse(result.stdout);
        // Return only the fields we need
        return repos.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: { login: repo.owner.login, avatar_url: repo.owner.avatar_url },
          private: repo.private,
          html_url: repo.html_url,
          description: repo.description,
          fork: repo.fork,
          clone_url: repo.clone_url,
          updated_at: repo.updated_at,
          pushed_at: repo.pushed_at,
          language: repo.language,
          default_branch: repo.default_branch,
          stargazers_count: repo.stargazers_count,
          license: repo.license?.spdx_id || null,
        }));
      }

      return [];
    } catch (error) {
      console.error('[GitHub] Error getting user repositories:', error);
      return [];
    }
  }

  async getUserStarredRepositories(
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    const params: string[] = [];
    if (options?.sort) params.push(`sort=${options.sort}`);
    if (options?.direction) params.push(`direction=${options.direction}`);
    params.push(`per_page=${options?.perPage || 100}`);
    if (options?.page) params.push(`page=${options.page}`);

    const endpoint =
      params.length > 0 ? `/user/starred?${params.join('&')}` : '/user/starred';

    const apiResult = await this.makeGitHubAPICall(endpoint);
    if (apiResult.success && apiResult.data) {
      return apiResult.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description,
        fork: repo.fork,
        clone_url: repo.clone_url,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        language: repo.language,
        default_branch: repo.default_branch,
        stargazers_count: repo.stargazers_count,
        license: repo.license?.spdx_id || null,
      }));
    }

    try {
      const args = ['gh', 'api', endpoint];
      const result = await this.executeCommand(args);

      if (result.success && result.stdout) {
        const repos = JSON.parse(result.stdout);
        return repos.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: { login: repo.owner.login, avatar_url: repo.owner.avatar_url },
          private: repo.private,
          html_url: repo.html_url,
          description: repo.description,
          fork: repo.fork,
          clone_url: repo.clone_url,
          updated_at: repo.updated_at,
          pushed_at: repo.pushed_at,
          language: repo.language,
          default_branch: repo.default_branch,
          stargazers_count: repo.stargazers_count,
          license: repo.license?.spdx_id || null,
        }));
      }

      return [];
    } catch (error) {
      console.error('[GitHub] Error getting starred repositories:', error);
      return [];
    }
  }

  // Get organization repositories
  async getOrgRepositories(
    org: string,
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    // Build query parameters
    const params: string[] = [];
    if (options?.type) params.push(`type=${options.type}`);
    if (options?.sort) params.push(`sort=${options.sort}`);
    if (options?.direction) params.push(`direction=${options.direction}`);
    params.push(`per_page=${options?.perPage || 100}`);
    if (options?.page) params.push(`page=${options.page}`);

    const endpoint =
      params.length > 0
        ? `/orgs/${org}/repos?${params.join('&')}`
        : `/orgs/${org}/repos`;

    // Try token-based API first
    const apiResult = await this.makeGitHubAPICall(endpoint);
    if (apiResult.success && apiResult.data) {
      return apiResult.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description,
        fork: repo.fork,
        clone_url: repo.clone_url,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        language: repo.language,
        default_branch: repo.default_branch,
        stargazers_count: repo.stargazers_count,
        license: repo.license?.spdx_id || null,
      }));
    }

    // Fallback to CLI
    try {
      const args = ['gh', 'api', endpoint];
      const result = await this.executeCommand(args);

      if (result.success && result.stdout) {
        const repos = JSON.parse(result.stdout);
        // Return only the fields we need
        return repos.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: { login: repo.owner.login, avatar_url: repo.owner.avatar_url },
          private: repo.private,
          html_url: repo.html_url,
          description: repo.description,
          fork: repo.fork,
          clone_url: repo.clone_url,
          updated_at: repo.updated_at,
          pushed_at: repo.pushed_at,
          language: repo.language,
          default_branch: repo.default_branch,
          stargazers_count: repo.stargazers_count,
          license: repo.license?.spdx_id || null,
        }));
      }

      return [];
    } catch (error) {
      console.error(
        `[GitHub] Error getting org repositories for ${org}:`,
        error,
      );
      return [];
    }
  }

  // Get user's organizations
  async getUserOrganizations(): Promise<GitHubOrganization[]> {
    // Try using token-based API first
    const apiResult = await this.makeGitHubAPICall('/user/orgs');
    if (apiResult.success && apiResult.data) {
      return apiResult.data.map((org: any) => ({
        login: org.login,
        id: org.id,
        avatar_url: org.avatar_url,
        description: org.description,
      }));
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', '/user/orgs']);

      if (result.success && result.stdout) {
        const orgs = JSON.parse(result.stdout);
        // Return only the fields we need
        return orgs.map((org: any) => ({
          login: org.login,
          id: org.id,
          avatar_url: org.avatar_url,
          description: org.description,
        }));
      }

      return [];
    } catch (error) {
      console.error('[GitHub] Error getting user organizations:', error);
      return [];
    }
  }

  /**
   * Get token scopes from GitHub API
   */
  async getTokenScopes(): Promise<string[]> {
    // First try with token-based API
    const apiResult = await this.makeGitHubAPICall('/user');
    if (apiResult.success && apiResult.headers) {
      const scopesHeader = apiResult.headers['x-oauth-scopes'];
      if (scopesHeader) {
        return scopesHeader.split(', ').filter((s: string) => s.length > 0);
      }
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand([
        'gh',
        'api',
        '/user',
        '--include',
      ]);
      if (result.success && result.stdout) {
        // Parse the headers from gh CLI output (includes headers when --include flag is used)
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().startsWith('x-oauth-scopes:')) {
            const scopes = line.substring('x-oauth-scopes:'.length).trim();
            return scopes.split(', ').filter((s: string) => s.length > 0);
          }
        }
      }
    } catch (error) {
      console.error('[GitHub] Error getting token scopes:', error);
    }

    return [];
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<any | null> {
    console.log('[GitHub] getCurrentUser: Fetching user info...');

    // First try with token-based API
    const apiResult = await this.makeGitHubAPICall('/user');

    console.log('[GitHub] getCurrentUser: API result', {
      success: apiResult.success,
      status: apiResult.status,
      hasData: !!apiResult.data,
      error: apiResult.error,
    });

    if (apiResult.success && apiResult.data) {
      console.log('[GitHub] getCurrentUser: Successfully fetched user via API');
      return apiResult.data;
    }

    // Log why API failed
    if (!apiResult.success) {
      console.warn('[GitHub] getCurrentUser: API call failed', {
        status: apiResult.status,
        statusText: apiResult.statusText,
        error: apiResult.error,
      });
    }

    // Fallback to CLI
    console.log('[GitHub] getCurrentUser: Attempting CLI fallback...');
    try {
      const result = await this.executeCommand(['gh', 'api', '/user']);
      if (result.success && result.stdout) {
        console.log(
          '[GitHub] getCurrentUser: Successfully fetched user via CLI',
        );
        return JSON.parse(result.stdout);
      }
      console.warn('[GitHub] getCurrentUser: CLI fallback failed');
    } catch (error) {
      console.error('[GitHub] Error getting current user via CLI:', error);
    }

    console.error('[GitHub] getCurrentUser: All methods failed');
    return null;
  }

  /**
   * Get user's SSH keys from GitHub
   * Requires 'read:public_key' or 'admin:public_key' scope
   */
  async getUserSSHKeys(): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
    needsPermission?: boolean;
  }> {
    // Try with token-based API first
    console.log('[GitHub] Attempting to fetch SSH keys from /user/keys...');
    const apiResult = await this.makeGitHubAPICall('/user/keys');

    console.log('[GitHub] API result:', {
      success: apiResult.success,
      status: apiResult.status,
      statusText: apiResult.statusText,
      hasData: !!apiResult.data,
      error: apiResult.error,
    });

    if (apiResult.success && apiResult.data) {
      console.log(
        '[GitHub] Successfully fetched SSH keys, count:',
        apiResult.data.length,
      );
      return { success: true, data: apiResult.data };
    }

    // Check if it's a permission error (403 or scope issue)
    if (apiResult.status === 403 || apiResult.status === 401) {
      console.warn(
        '[GitHub] Insufficient permissions to read SSH keys (status: ' +
          apiResult.status +
          '). Requires read:public_key scope.',
      );
      return {
        success: false,
        error:
          'Insufficient permissions. The GitHub token needs "read:public_key" or "admin:public_key" scope to view SSH keys.',
        needsPermission: true,
      };
    }

    // Fallback to CLI
    console.log('[GitHub] Trying CLI fallback for SSH keys...');
    try {
      const result = await this.executeCommand(['gh', 'api', '/user/keys']);
      if (result.success && result.stdout) {
        const keys = JSON.parse(result.stdout);
        console.log(
          '[GitHub] Successfully fetched SSH keys via CLI, count:',
          keys.length,
        );
        return { success: true, data: keys };
      }
      console.log('[GitHub] CLI command failed:', result.stderr);
    } catch (error) {
      console.error('[GitHub] Error getting SSH keys via CLI:', error);
    }

    console.error(
      '[GitHub] All methods failed to fetch SSH keys. API status:',
      apiResult.status,
      'API error:',
      apiResult.error,
    );
    return {
      success: false,
      error: apiResult.error || 'Failed to fetch SSH keys',
      data: [],
      needsPermission: apiResult.status === 403 || apiResult.status === 401,
    };
  }

  /**
   * Get complete token information including scopes, user, and organizations
   */
  async getTokenInfo(): Promise<{
    scopes: string[];
    organizations: GitHubOrganization[];
    user: any;
    rateLimit: {
      limit: number;
      remaining: number;
      reset: Date;
    };
  } | null> {
    try {
      console.log('[GitHub] getTokenInfo: Starting token info fetch...');

      // Make parallel requests for better performance
      const [user, scopes, organizations] = await Promise.all([
        this.getCurrentUser(),
        this.getTokenScopes(),
        this.getUserOrganizations(),
      ]);

      console.log('[GitHub] getTokenInfo: Results received', {
        hasUser: !!user,
        scopesCount: scopes.length,
        orgsCount: organizations.length,
      });

      if (!user) {
        console.warn(
          '[GitHub] getTokenInfo: getCurrentUser returned null - token may be expired or invalid',
        );
        return null;
      }

      // Get rate limit info from the last API call
      const rateLimit = {
        limit: 5000,
        remaining: 5000,
        reset: new Date(),
      };

      console.log(
        '[GitHub] getTokenInfo: Successfully fetched token info for user:',
        user.login,
      );
      return {
        scopes,
        organizations,
        user,
        rateLimit,
      };
    } catch (error) {
      console.error('[GitHub] Failed to get token info:', error);
      return null;
    }
  }

  async getIssues(owner: string, repo: string): Promise<any[]> {
    console.log(`[GitHub] Fetching issues for ${owner}/${repo}`);

    // First, try using gh CLI which handles authentication for private repos
    let cliAuthError = false;
    try {
      const ghResult = await this.executeCommand([
        'gh',
        'api',
        `/repos/${owner}/${repo}/issues`,
        '--method',
        'GET',
        '--field',
        'state=all',
        '--field',
        'per_page=100',
        '--jq',
        '.[] | select(.pull_request == null)',
      ]);

      if (ghResult.success && ghResult.stdout.trim()) {
        // Parse the JSON Lines output (one JSON object per line)
        const issues = ghResult.stdout
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              console.warn('[GitHub] Failed to parse line:', line);
              return null;
            }
          })
          .filter(Boolean);

        console.log(
          `[GitHub] Successfully fetched ${issues.length} issues via gh CLI`,
        );
        return issues;
      } else if (
        ghResult.stderr?.includes('authentication') ||
        ghResult.stderr?.includes('401')
      ) {
        // gh CLI is not authenticated
        cliAuthError = true;
        console.log(
          '[GitHub] gh CLI not authenticated, will attempt token-based API fallback',
        );
      } else {
        console.warn('[GitHub] gh CLI failed, falling back to HTTPS API', {
          stderr: ghResult.stderr,
        });
      }
    } catch (error) {
      console.warn('[GitHub] gh CLI error, falling back to HTTPS API:', error);
    }

    // Try token-based API using stored credentials
    const apiEndpoint = `/repos/${owner}/${repo}/issues?state=all&per_page=100`;
    const apiResult = await this.makeGitHubAPICall(apiEndpoint);

    if (apiResult.success && Array.isArray(apiResult.data)) {
      const issues = (
        apiResult.data as Array<{ pull_request?: unknown }>
      ).filter((issue) => !issue.pull_request);
      console.log(
        `[GitHub] Successfully fetched ${issues.length} issues via token-based API`,
      );
      return issues;
    }

    if (apiResult.status === 404) {
      console.log('[GitHub] Repository is private or not found (404) via API');
      return [
        {
          error: 'private_repo',
          message:
            'This repository is private. Please authenticate with GitHub (via "gh auth login" or by adding a personal access token) to continue.',
          requiresAuth: true,
        },
      ];
    }

    if (apiResult.status === 403) {
      console.log(
        '[GitHub] API rate limit or permissions issue (403) via token',
      );
      return [
        {
          error: 'rate_limit',
          message:
            'GitHub API rate limit exceeded. Please authenticate with GitHub (via "gh auth login" or by adding a personal access token) to increase your rate limit.',
          requiresAuth: true,
        },
      ];
    }

    if (!apiResult.success && apiResult.error) {
      console.warn('[GitHub] Token-based API request failed', {
        error: apiResult.error,
        status: apiResult.status,
      });
    }

    if (cliAuthError) {
      console.log(
        '[GitHub] gh CLI authentication required and token-based API unavailable',
      );
      return [
        {
          error: 'authentication_required',
          message:
            'GitHub authentication required. Please run "gh auth login" or add a personal access token in Principal to continue.',
          requiresAuth: true,
        },
      ];
    }

    // Fallback to HTTPS API for public repos
    console.log(
      '[GitHub] Attempting to fetch issues via HTTPS API (public repos only)',
    );
    const https = require('https');

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/issues?state=all&per_page=100`,
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Principal-AI',
        },
      };

      const req = https.request(options, (res: any) => {
        let data = '';

        res.on('data', (chunk: any) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const issues = JSON.parse(data);
              // Filter out pull requests (they have pull_request property)
              const issuesOnly = issues.filter(
                (issue: any) => !issue.pull_request,
              );
              console.log(
                `[GitHub] Found ${issuesOnly.length} issues via HTTPS`,
              );
              resolve(issuesOnly);
            } catch (error) {
              console.error('[GitHub] Failed to parse issues response:', error);
              resolve([]);
            }
          } else if (res.statusCode === 404) {
            // Repository not found or is private
            console.log('[GitHub] Repository is private or not found (404)');
            resolve([
              {
                error: 'private_repo',
                message:
                  'This repository is private. Please authenticate with GitHub CLI by running "gh auth login" in your terminal.',
                requiresAuth: true,
              },
            ]);
          } else if (res.statusCode === 403) {
            // Rate limited
            console.log('[GitHub] API rate limit exceeded');
            resolve([
              {
                error: 'rate_limit',
                message:
                  'GitHub API rate limit exceeded. Please authenticate with GitHub CLI by running "gh auth login" to increase your rate limit.',
                requiresAuth: true,
              },
            ]);
          } else {
            console.error(`[GitHub] Failed to fetch issues: ${res.statusCode}`);
            resolve([]);
          }
        });
      });

      req.on('error', (error: any) => {
        console.error('[GitHub] Error fetching issues:', error);
        resolve([]);
      });

      req.end();
    });
  }

  async getPullRequests(owner: string, repo: string): Promise<any[]> {
    console.log(`[GitHub] Fetching pull requests for ${owner}/${repo}`);

    try {
      const ghResult = await this.executeCommand([
        'gh',
        'api',
        `/repos/${owner}/${repo}/pulls`,
        '--method',
        'GET',
        '--field',
        'state=all',
        '--field',
        'per_page=100',
      ]);

      if (ghResult.success && ghResult.stdout.trim()) {
        try {
          const pullRequests = JSON.parse(ghResult.stdout);
          if (Array.isArray(pullRequests)) {
            console.log(
              `[GitHub] Successfully fetched ${pullRequests.length} pull requests via gh CLI`,
            );
            return pullRequests;
          }
        } catch (error) {
          console.warn('[GitHub] Failed to parse gh CLI pull requests output', {
            error,
            stdoutSample: ghResult.stdout.slice(0, 200),
          });
        }
      } else if (
        ghResult.stderr?.includes('authentication') ||
        ghResult.stderr?.includes('401')
      ) {
        console.log(
          '[GitHub] gh CLI not authenticated, user needs to run: gh auth login',
        );

        return [
          {
            error: 'authentication_required',
            message:
              'GitHub CLI authentication required. Please run "gh auth login" in your terminal to authenticate.',
            requiresAuth: true,
          },
        ];
      } else {
        console.warn(
          '[GitHub] gh CLI pull request fetch failed, falling back',
          {
            stderr: ghResult.stderr,
          },
        );
      }
    } catch (error) {
      console.warn('[GitHub] gh CLI error when fetching pull requests:', error);
    }

    console.log(
      '[GitHub] Attempting to fetch pull requests via HTTPS API (public repos only)',
    );
    const https = require('https');

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/pulls?state=all&per_page=100`,
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Principal-AI',
        },
      };

      const req = https.request(options, (res: any) => {
        let data = '';

        res.on('data', (chunk: any) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const pullRequests = JSON.parse(data);
              console.log(
                `[GitHub] Found ${pullRequests.length} pull requests via HTTPS`,
              );
              resolve(pullRequests);
            } catch (error) {
              console.error(
                '[GitHub] Failed to parse pull requests response:',
                error,
              );
              resolve([]);
            }
          } else if (res.statusCode === 404) {
            console.log('[GitHub] Repository is private or not found (404)');
            resolve([
              {
                error: 'private_repo',
                message:
                  'This repository is private. Please authenticate with GitHub CLI by running "gh auth login" in your terminal.',
                requiresAuth: true,
              },
            ]);
          } else if (res.statusCode === 403) {
            console.log('[GitHub] API rate limit exceeded');
            resolve([
              {
                error: 'rate_limit',
                message:
                  'GitHub API rate limit exceeded. Please authenticate with GitHub CLI by running "gh auth login" to increase your rate limit.',
                requiresAuth: true,
              },
            ]);
          } else {
            console.error(
              `[GitHub] Failed to fetch pull requests: ${res.statusCode}`,
            );
            resolve([]);
          }
        });
      });

      req.on('error', (error: any) => {
        console.error('[GitHub] Error fetching pull requests:', error);
        resolve([]);
      });

      req.end();
    });
  }

  async getRepositoryCommits(
    owner: string,
    repo: string,
    options?: { perPage?: number; page?: number },
  ): Promise<any[]> {
    const perPage = options?.perPage || 30;
    const page = options?.page || 1;
    console.log(
      `[GitHub] Fetching commits for ${owner}/${repo} (perPage: ${perPage}, page: ${page})`,
    );

    // Try using gh CLI first
    try {
      const ghResult = await this.executeCommand([
        'gh',
        'api',
        `/repos/${owner}/${repo}/commits`,
        '--method',
        'GET',
        '--field',
        `per_page=${perPage}`,
        '--field',
        `page=${page}`,
      ]);

      if (ghResult.success && ghResult.stdout.trim()) {
        try {
          const commits = JSON.parse(ghResult.stdout);
          if (Array.isArray(commits)) {
            console.log(
              `[GitHub] Successfully fetched ${commits.length} commits via gh CLI`,
            );
            return commits;
          }
        } catch (error) {
          console.warn('[GitHub] Failed to parse gh CLI commits output', {
            error,
            stdoutSample: ghResult.stdout.slice(0, 200),
          });
        }
      } else if (
        ghResult.stderr?.includes('authentication') ||
        ghResult.stderr?.includes('401')
      ) {
        console.log(
          '[GitHub] gh CLI not authenticated for commits, falling back to API',
        );
      } else {
        console.warn('[GitHub] gh CLI commits fetch failed, falling back', {
          stderr: ghResult.stderr,
        });
      }
    } catch (error) {
      console.warn('[GitHub] gh CLI error when fetching commits:', error);
    }

    // Fallback to HTTPS API
    console.log(
      '[GitHub] Attempting to fetch commits via HTTPS API (public repos only)',
    );
    const https = require('https');

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`,
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Principal-AI',
        },
      };

      const req = https.request(options, (res: any) => {
        let data = '';

        res.on('data', (chunk: any) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const commits = JSON.parse(data);
              console.log(
                `[GitHub] Successfully fetched ${commits.length} commits via HTTPS API`,
              );
              resolve(commits);
            } catch (error) {
              console.error(
                '[GitHub] Failed to parse commits response:',
                error,
              );
              resolve([]);
            }
          } else if (res.statusCode === 404) {
            console.log(
              '[GitHub] Repository commits not found or private (404)',
            );
            resolve([]);
          } else if (res.statusCode === 403) {
            console.log('[GitHub] API rate limit exceeded');
            resolve([]);
          } else {
            console.error(
              `[GitHub] Failed to fetch commits: ${res.statusCode}`,
            );
            resolve([]);
          }
        });
      });

      req.on('error', (error: any) => {
        console.error('[GitHub] Error fetching commits:', error);
        resolve([]);
      });

      req.end();
    });
  }

  /**
   * Get followers for a user (defaults to authenticated user)
   */
  async getUserFollowers(username?: string): Promise<any[]> {
    const endpoint = username
      ? `/users/${username}/followers`
      : '/user/followers';
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout);
      }
    } catch (error) {
      console.error('[GitHub] Error getting followers:', error);
    }

    return [];
  }

  /**
   * Get users that a user is following (defaults to authenticated user)
   */
  async getUserFollowing(username?: string): Promise<any[]> {
    const endpoint = username
      ? `/users/${username}/following`
      : '/user/following';
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout);
      }
    } catch (error) {
      console.error('[GitHub] Error getting following:', error);
    }

    return [];
  }

  /**
   * Get members of an organization
   */
  async getOrgMembers(org: string): Promise<any[]> {
    const endpoint = `/orgs/${org}/members`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout);
      }
    } catch (error) {
      console.error('[GitHub] Error getting org members:', error);
    }

    return [];
  }

  /**
   * Get a specific user's profile
   */
  async getUser(username: string): Promise<any | null> {
    const endpoint = `/users/${username}`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout);
      }
    } catch (error) {
      console.error('[GitHub] Error getting user:', error);
    }

    return null;
  }

  /**
   * Get a specific user's public organizations
   */
  async getUserOrganizationsForUser(username: string): Promise<any[]> {
    const endpoint = `/users/${username}/orgs`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout);
      }
    } catch (error) {
      console.error('[GitHub] Error getting user organizations:', error);
    }

    return [];
  }

  /**
   * Get a specific user's starred repositories
   */
  async getUserStarredRepositoriesForUser(
    username: string,
    options?: RepositoryFetchOptions,
  ): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (options?.sort) queryParams.set('sort', options.sort);
    if (options?.direction) queryParams.set('direction', options.direction);
    if (options?.perPage) queryParams.set('per_page', String(options.perPage));
    if (options?.page) queryParams.set('page', String(options.page));

    const endpoint = `/users/${username}/starred${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout);
      }
    } catch (error) {
      console.error('[GitHub] Error getting user starred repositories:', error);
    }

    return [];
  }

  /**
   * Create a new GitHub repository
   */
  async createRepository(
    owner: string,
    input: CreateRepositoryInput,
    isOrganization: boolean,
  ): Promise<GitHubRepositoryCreated> {
    console.log(
      `[GitHub] Creating repository for ${isOrganization ? 'org' : 'user'}: ${owner}`,
      input,
    );

    const endpoint = isOrganization ? `/orgs/${owner}/repos` : '/user/repos';
    const apiResult = await this.makeGitHubAPICall(endpoint, {
      method: 'POST',
      body: input,
    });

    if (apiResult.success && apiResult.data) {
      console.log(
        `[GitHub] Successfully created repository: ${apiResult.data.full_name}`,
      );
      return apiResult.data as GitHubRepositoryCreated;
    }

    // Fallback to CLI
    console.log('[GitHub] Attempting repository creation via gh CLI');
    try {
      const args = ['gh', 'repo', 'create'];

      // Add owner prefix for organizations
      if (isOrganization) {
        args.push(`${owner}/${input.name}`);
      } else {
        args.push(input.name);
      }

      // Add flags based on input
      if (input.description) {
        args.push('--description', input.description);
      }

      if (input.private) {
        args.push('--private');
      } else {
        args.push('--public');
      }

      if (input.gitignore_template) {
        args.push('--gitignore', input.gitignore_template);
      }

      if (input.license_template) {
        args.push('--license', input.license_template);
      }

      const result = await this.executeCommand(args);

      if (result.success) {
        // Fetch the created repository details
        const repoName = isOrganization ? `${owner}/${input.name}` : input.name;
        const fetchResult = await this.executeCommand([
          'gh',
          'api',
          `/repos/${repoName}`,
        ]);

        if (fetchResult.success && fetchResult.stdout) {
          const repo = JSON.parse(fetchResult.stdout);
          console.log('[GitHub] Successfully created repository via CLI');
          return repo as GitHubRepositoryCreated;
        }
      }

      throw new Error(
        result.stderr || result.stdout || 'Failed to create repository via CLI',
      );
    } catch (error) {
      console.error('[GitHub] Error creating repository:', error);
      throw new Error(
        apiResult.error ||
          (error instanceof Error
            ? error.message
            : 'Failed to create repository'),
      );
    }
  }

  /**
   * Get list of available .gitignore templates
   */
  async getGitignoreTemplates(): Promise<string[]> {
    console.log('[GitHub] Fetching .gitignore templates');

    const endpoint = '/gitignore/templates';
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && Array.isArray(apiResult.data)) {
      console.log(
        `[GitHub] Successfully fetched ${apiResult.data.length} .gitignore templates`,
      );
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        const templates = JSON.parse(result.stdout);
        if (Array.isArray(templates)) {
          console.log(
            `[GitHub] Successfully fetched ${templates.length} .gitignore templates via CLI`,
          );
          return templates;
        }
      }
    } catch (error) {
      console.error('[GitHub] Error getting .gitignore templates:', error);
    }

    console.warn(
      '[GitHub] Failed to fetch .gitignore templates, returning empty array',
    );
    return [];
  }

  /**
   * Get list of available license templates
   */
  async getLicenseTemplates(): Promise<GitHubLicenseTemplate[]> {
    console.log('[GitHub] Fetching license templates');

    const endpoint = '/licenses';
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && Array.isArray(apiResult.data)) {
      const licenses = apiResult.data.map((license: any) => ({
        key: license.key,
        name: license.name,
        spdx_id: license.spdx_id,
        url: license.url,
      }));
      console.log(
        `[GitHub] Successfully fetched ${licenses.length} license templates`,
      );
      return licenses;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        const templates = JSON.parse(result.stdout);
        if (Array.isArray(templates)) {
          const licenses = templates.map((license: any) => ({
            key: license.key,
            name: license.name,
            spdx_id: license.spdx_id,
            url: license.url,
          }));
          console.log(
            `[GitHub] Successfully fetched ${licenses.length} license templates via CLI`,
          );
          return licenses;
        }
      }
    } catch (error) {
      console.error('[GitHub] Error getting license templates:', error);
    }

    console.warn(
      '[GitHub] Failed to fetch license templates, returning empty array',
    );
    return [];
  }

  /**
   * Get repository info including permissions
   * Returns null if repo not found or user doesn't have access
   */
  async getRepository(owner: string, repo: string): Promise<any | null> {
    console.log(`[GitHub] Fetching repository info for ${owner}/${repo}`);

    const endpoint = `/repos/${owner}/${repo}`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      console.log(`[GitHub] Successfully fetched repository ${owner}/${repo}`, {
        permissions: apiResult.data.permissions,
        fork: apiResult.data.fork,
      });
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        const repoData = JSON.parse(result.stdout);
        console.log(
          `[GitHub] Successfully fetched repository ${owner}/${repo} via CLI`,
        );
        return repoData;
      }
    } catch (error) {
      console.error('[GitHub] Error getting repository info:', error);
    }

    console.warn(`[GitHub] Failed to fetch repository ${owner}/${repo}`);
    return null;
  }

  /**
   * Fork a repository to the authenticated user's account or an organization
   */
  async forkRepository(
    owner: string,
    repo: string,
    options?: {
      organization?: string;
      name?: string;
      default_branch_only?: boolean;
    },
  ): Promise<any | null> {
    console.log(`[GitHub] Forking repository ${owner}/${repo}`, options);

    const endpoint = `/repos/${owner}/${repo}/forks`;
    const body: any = {};

    if (options?.organization) {
      body.organization = options.organization;
    }
    if (options?.name) {
      body.name = options.name;
    }
    if (options?.default_branch_only !== undefined) {
      body.default_branch_only = options.default_branch_only;
    }

    const apiResult = await this.makeGitHubAPICall(endpoint, {
      method: 'POST',
      body: Object.keys(body).length > 0 ? body : undefined,
    });

    if (apiResult.success && apiResult.data) {
      console.log(
        `[GitHub] Successfully forked repository to ${apiResult.data.full_name}`,
      );
      return apiResult.data;
    }

    // Fallback to CLI
    try {
      const args = ['gh', 'repo', 'fork', `${owner}/${repo}`, '--clone=false'];
      if (options?.organization) {
        args.push('--org', options.organization);
      }
      // Note: gh CLI doesn't support custom name or default_branch_only directly

      const result = await this.executeCommand(args);
      if (result.success) {
        // gh fork doesn't return JSON by default, fetch the forked repo info
        const currentUser = await this.getCurrentUser();
        if (currentUser) {
          const forkOwner = options?.organization || currentUser.login;
          const forkName = options?.name || repo;
          // Wait a moment for GitHub to create the fork
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return this.getRepository(forkOwner, forkName);
        }
      }
    } catch (error) {
      console.error('[GitHub] Error forking repository:', error);
    }

    console.error(
      `[GitHub] Failed to fork repository ${owner}/${repo}`,
      apiResult.error,
    );
    return null;
  }
}

// Register IPC handlers
export function registerGitHubIpcHandlers(
  appWindows: Map<number, IModernApplicationWindow>,
) {
  console.log('[GitHub] Registering IPC handlers...');

  const getAdapterFromSender = (
    eventSender: Electron.WebContents,
  ): GitHubAdapter | null => {
    const senderWindow = BrowserWindow.fromWebContents(eventSender);
    if (!senderWindow) return null;
    const appWindow = appWindows.get(senderWindow.id);
    return appWindow?.githubAdapter || null;
  };

  ipcMain.handle(
    GitHubAPIEvent.DETECT_REPOSITORY,
    async (event, path: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for DETECT_REPOSITORY');
        return null;
      }
      return adapter.detectRepository(path);
    },
  );

  ipcMain.handle(GitHubAPIEvent.CHECK_AUTH_STATUS, async (event) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for CHECK_AUTH_STATUS');
      return { isAuthenticated: false, method: 'none' };
    }
    return adapter.checkAuthStatus();
  });

  ipcMain.handle(
    GitHubAPIEvent.REFRESH_DATA,
    async (event, owner: string, repo: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for REFRESH_DATA');
        return;
      }
      return adapter.refreshData(owner, repo);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_CHANGED_FILES,
    async (event, directoryPath: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_CHANGED_FILES');
        return [];
      }
      return adapter.getChangedFiles(directoryPath);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_MARKDOWN_DOCUMENTS,
    async (event, owner: string, repo: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_MARKDOWN_DOCUMENTS');
        return [];
      }
      return adapter.getMarkdownDocuments(owner, repo);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_FILE_CONTENT,
    async (event, owner: string, repo: string, path: string, ref?: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_FILE_CONTENT');
        return null;
      }
      return adapter.getFileContent(owner, repo, path, ref);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_FILE_AGES,
    async (event, directoryPath: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_FILE_AGES');
        return new Map();
      }
      const fileAges = await adapter.getFileAges(directoryPath);
      // Convert Map to array for IPC serialization
      return Array.from(fileAges.entries()).map(([path, data]) => ({
        path,
        lastCommitDate: data.lastCommitDate.toISOString(),
        daysSinceLastCommit: data.daysSinceLastCommit,
      }));
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_TREE,
    async (event, owner: string, repo: string, ref?: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_TREE');
        return { success: false, error: 'No GitHub adapter found' };
      }

      try {
        let treeRef = ref;
        if (!treeRef) {
          treeRef =
            (await adapter.getRepoDefaultBranch(owner, repo)) || undefined;
          if (!treeRef) {
            return {
              success: false,
              error: 'Could not determine default branch',
            };
          }
          console.log(`[GitHub] Using default branch: ${treeRef}`);
        }

        const result = await adapter.getTreeForPublicRepo(owner, repo, treeRef);

        if (result.success) {
          return result;
        }

        // Fallback: use git CLI (Option C: no checkout) with SSH preferred
        console.warn(
          `[GitHub] Public API failed (likely private). Falling back to git CLI (no checkout) for ${owner}/${repo}@${treeRef}`,
        );
        const os = require('os');
        const path = require('path');
        const fs = require('fs');
        const { spawn } = require('child_process');

        const tmpRoot = path.join(os.tmpdir(), 'principle-md-remote-cache');
        if (!fs.existsSync(tmpRoot)) fs.mkdirSync(tmpRoot, { recursive: true });
        const targetDir = path.join(tmpRoot, `${owner}__${repo}`);
        if (!fs.existsSync(targetDir))
          fs.mkdirSync(targetDir, { recursive: true });

        const run = (
          cmd: string,
          args: string[],
          cwd: string,
          extraEnv: Record<string, string> = {},
        ): Promise<{ code: number; stdout: string; stderr: string }> => {
          return new Promise((resolve) => {
            const env = {
              ...process.env,
              GIT_TERMINAL_PROMPT: '0',
              GIT_ASKPASS: 'echo',
              SSH_ASKPASS: 'echo',
              ...extraEnv,
            };
            const cp = spawn(cmd, args, { cwd, env });
            let stdout = '';
            let stderr = '';
            cp.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
            cp.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
            cp.on('close', (code: number) =>
              resolve({ code: code ?? 1, stdout, stderr }),
            );
            cp.on('error', (err: Error) =>
              resolve({ code: 1, stdout: '', stderr: err.message }),
            );
          });
        };

        const remoteSsh = `git@github.com:${owner}/${repo}.git`;
        const remoteHttps = `https://github.com/${owner}/${repo}.git`;

        // Ensure repo initialized
        const gitDir = path.join(targetDir, '.git');
        const isRepo = fs.existsSync(gitDir);
        if (!isRepo) {
          console.log(`[GitHub] Initializing git repo in ${targetDir}`);
          const initRes = await run('git', ['init'], targetDir);
          if (initRes.code !== 0) {
            console.error(
              `[GitHub] git init failed in ${targetDir}:`,
              initRes.stderr,
            );
            return {
              success: false,
              error: `git init failed: ${initRes.stderr || initRes.stdout}`,
            };
          }
        }

        // Pick remote by checking auth via ls-remote (SSH first)
        let chosenRemote = remoteSsh;
        let canUseSsh =
          (
            await run(
              'git',
              ['ls-remote', '--exit-code', '--heads', remoteSsh],
              targetDir,
            )
          ).code === 0;
        if (!canUseSsh) {
          const httpsOk =
            (
              await run(
                'git',
                ['ls-remote', '--exit-code', '--heads', remoteHttps],
                targetDir,
              )
            ).code === 0;
          if (httpsOk) chosenRemote = remoteHttps;
          else {
            return {
              success: false,
              error:
                'No non-interactive git access available (SSH/HTTPS failed)',
            };
          }
        }

        // Configure origin and fetch the branch (no checkout)
        // First check if origin exists and update or add as needed
        const remoteListRes = await run('git', ['remote'], targetDir);
        if (remoteListRes.stdout.includes('origin')) {
          // Origin exists, update it
          const setUrlRes = await run(
            'git',
            ['remote', 'set-url', 'origin', chosenRemote],
            targetDir,
          );
          if (setUrlRes.code !== 0) {
            console.error(
              `[GitHub] git remote set-url failed:`,
              setUrlRes.stderr,
            );
            return {
              success: false,
              error: `git remote set-url failed: ${setUrlRes.stderr || setUrlRes.stdout}`,
            };
          }
        } else {
          // Origin doesn't exist, add it
          const addRes = await run(
            'git',
            ['remote', 'add', 'origin', chosenRemote],
            targetDir,
          );
          if (addRes.code !== 0) {
            console.error(`[GitHub] git remote add failed:`, addRes.stderr);
            return {
              success: false,
              error: `git remote add failed: ${addRes.stderr || addRes.stdout}`,
            };
          }
        }
        const fetchRes = await run(
          'git',
          ['fetch', '--depth', '1', 'origin', treeRef!],
          targetDir,
        );
        if (fetchRes.code !== 0) {
          return {
            success: false,
            error: `git fetch failed: ${fetchRes.stderr || fetchRes.stdout}`,
          };
        }

        // List tree without checkout; use FETCH_HEAD
        const lsRes = await run(
          'git',
          ['ls-tree', '-lr', '--full-tree', 'FETCH_HEAD'],
          targetDir,
        );
        if (lsRes.code !== 0) {
          return {
            success: false,
            error: `git ls-tree failed: ${lsRes.stderr || lsRes.stdout}`,
          };
        }

        // Parse ls-tree output: lines like "100644 blob <sha> <size>\tpath"
        const fileEntries: Array<{ path: string; size: number }> = [];
        for (const line of lsRes.stdout.split('\n')) {
          if (!line.trim()) continue;
          const tabIdx = line.indexOf('\t');
          if (tabIdx === -1) continue;
          const meta = line.slice(0, tabIdx).split(/\s+/);
          const sizeStr = meta[3] || '0';
          const relPath = line.slice(tabIdx + 1);
          const size = parseInt(sizeStr, 10) || 0;
          // Only blobs will appear with -l -r
          fileEntries.push({ path: relPath, size });
        }

        // Build directory entries from file paths
        const dirSet = new Set<string>();
        for (const f of fileEntries) {
          const parts = f.path.split('/');
          for (let i = 1; i < parts.length; i++) {
            dirSet.add(parts.slice(0, i).join('/'));
          }
        }

        const entries: any[] = [];
        dirSet.forEach((d) => entries.push({ path: d, type: 'tree' }));
        fileEntries.forEach((f) =>
          entries.push({ path: f.path, type: 'blob', size: f.size }),
        );

        console.log(
          `[GitHub] Git CLI no-checkout built ${entries.length} entries`,
        );
        return { success: true, data: { tree: entries } };
      } catch (error) {
        console.error('[GitHub] Error in getTree:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        };
      }
    },
  );

  // Config API handlers
  ipcMain.handle(
    GitHubAPIEvent.FETCH_REMOTE_CONFIG,
    async (
      event,
      request: ConfigFetchRequest,
    ): Promise<ConfigFetchResponse> => {
      try {
        console.log(`[Config] Fetching remote config from: ${request.url}`);

        const response = await fetch(request.url);

        if (!response.ok) {
          return {
            content: null,
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        const content = await response.text();
        console.log(
          `[Config] Successfully fetched config, size: ${content.length} bytes`,
        );

        return {
          content,
        };
      } catch (error) {
        console.error('[Config] Error fetching remote config:', error);
        return {
          content: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.FETCH_GITHUB_CONFIG,
    async (
      event,
      request: GitHubConfigRequest,
    ): Promise<ConfigFetchResponse> => {
      const { owner, repo, branch, path } = request;
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

      try {
        console.log(
          `[Config] Fetching GitHub config: ${owner}/${repo}@${branch}/${path}`,
        );
        console.log(`[Config] Full URL: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
          console.log(
            `[Config] GitHub fetch failed with status ${response.status}`,
          );
          if (response.status === 404) {
            return {
              content: null,
              error: `File not found: ${path} in ${owner}/${repo}@${branch}`,
            };
          }
          return {
            content: null,
            error: `GitHub returned ${response.status}: ${response.statusText}`,
          };
        }

        const content = await response.text();
        console.log(
          `[Config] Successfully fetched GitHub config from ${path}, size: ${content.length} bytes`,
        );
        console.log(`[Config] First 200 chars:`, content.substring(0, 200));

        return {
          content,
        };
      } catch (error) {
        console.error('[Config] Error fetching GitHub config:', error);
        return {
          content: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_ISSUES,
    async (event, owner: string, repo: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_ISSUES');
        return [];
      }
      return adapter.getIssues(owner, repo);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_PULL_REQUESTS,
    async (event, owner: string, repo: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_PULL_REQUESTS');
        return [];
      }
      return adapter.getPullRequests(owner, repo);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_REPOSITORY_COMMITS,
    async (
      event,
      owner: string,
      repo: string,
      options?: { perPage?: number; page?: number },
    ) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_REPOSITORY_COMMITS');
        return [];
      }
      return adapter.getRepositoryCommits(owner, repo, options);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.CREATE_ISSUE,
    async (event, owner: string, repo: string, issue: any) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for CREATE_ISSUE');
        return { success: false, error: 'No adapter found' };
      }
      return adapter.createIssue(owner, repo, issue);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_USER_REPOSITORIES,
    async (event, options?: RepositoryFetchOptions) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_USER_REPOSITORIES');
        return [];
      }
      return adapter.getUserRepositories(options);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_USER_STARRED_REPOSITORIES,
    async (event, options?: RepositoryFetchOptions) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error(
          '[GitHub] No adapter found for GET_USER_STARRED_REPOSITORIES',
        );
        return [];
      }
      return adapter.getUserStarredRepositories(options);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_ORG_REPOSITORIES,
    async (event, org: string, options?: RepositoryFetchOptions) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_ORG_REPOSITORIES');
        return [];
      }
      return adapter.getOrgRepositories(org, options);
    },
  );

  ipcMain.handle(GitHubAPIEvent.GET_USER_ORGANIZATIONS, async (event) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_USER_ORGANIZATIONS');
      return [];
    }
    return adapter.getUserOrganizations();
  });

  ipcMain.handle(GitHubAPIEvent.GET_TOKEN_SCOPES, async (event) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_TOKEN_SCOPES');
      return [];
    }
    return adapter.getTokenScopes();
  });

  ipcMain.handle(GitHubAPIEvent.GET_CURRENT_USER, async (event) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_CURRENT_USER');
      return null;
    }
    return adapter.getCurrentUser();
  });

  ipcMain.handle(GitHubAPIEvent.GET_TOKEN_INFO, async (event) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_TOKEN_INFO');
      return null;
    }
    return adapter.getTokenInfo();
  });

  ipcMain.handle(GitHubAPIEvent.GET_USER_SSH_KEYS, async (event) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_USER_SSH_KEYS');
      return [];
    }
    return adapter.getUserSSHKeys();
  });

  ipcMain.handle(GitHubAPIEvent.GET_USER_FOLLOWERS, async (event, username) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_USER_FOLLOWERS');
      return [];
    }
    return adapter.getUserFollowers(username);
  });

  ipcMain.handle(GitHubAPIEvent.GET_USER_FOLLOWING, async (event, username) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_USER_FOLLOWING');
      return [];
    }
    return adapter.getUserFollowing(username);
  });

  ipcMain.handle(GitHubAPIEvent.GET_ORG_MEMBERS, async (event, org) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_ORG_MEMBERS');
      return [];
    }
    return adapter.getOrgMembers(org);
  });

  ipcMain.handle(GitHubAPIEvent.GET_USER, async (event, username) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_USER');
      return null;
    }
    return adapter.getUser(username);
  });

  ipcMain.handle(
    GitHubAPIEvent.GET_USER_ORGANIZATIONS_FOR_USER,
    async (event, username) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error(
          '[GitHub] No adapter found for GET_USER_ORGANIZATIONS_FOR_USER',
        );
        return [];
      }
      return adapter.getUserOrganizationsForUser(username);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_USER_STARRED_REPOSITORIES_FOR_USER,
    async (event, username, options) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error(
          '[GitHub] No adapter found for GET_USER_STARRED_REPOSITORIES_FOR_USER',
        );
        return [];
      }
      return adapter.getUserStarredRepositoriesForUser(username, options);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.CREATE_REPOSITORY,
    async (
      event,
      owner: string,
      input: CreateRepositoryInput,
      isOrganization: boolean,
    ) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for CREATE_REPOSITORY');
        throw new Error('No GitHub adapter found');
      }
      return adapter.createRepository(owner, input, isOrganization);
    },
  );

  ipcMain.handle(GitHubAPIEvent.GET_GITIGNORE_TEMPLATES, async (event) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_GITIGNORE_TEMPLATES');
      return [];
    }
    return adapter.getGitignoreTemplates();
  });

  ipcMain.handle(GitHubAPIEvent.GET_LICENSE_TEMPLATES, async (event) => {
    const adapter = getAdapterFromSender(event.sender);
    if (!adapter) {
      console.error('[GitHub] No adapter found for GET_LICENSE_TEMPLATES');
      return [];
    }
    return adapter.getLicenseTemplates();
  });

  ipcMain.handle(
    GitHubAPIEvent.GET_REPOSITORY,
    async (event, owner: string, repo: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_REPOSITORY');
        return null;
      }
      return adapter.getRepository(owner, repo);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.FORK_REPOSITORY,
    async (
      event,
      owner: string,
      repo: string,
      options?: {
        organization?: string;
        name?: string;
        default_branch_only?: boolean;
      },
    ) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for FORK_REPOSITORY');
        return null;
      }
      return adapter.forkRepository(owner, repo, options);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.INSTALL_SKILL,
    async (event, options: InstallSkillOptions): Promise<InstallSkillResult> => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for INSTALL_SKILL');
        return {
          success: false,
          error: 'GitHub adapter not available',
        };
      }

      try {
        const { githubUrl, skillPath, destination, repositoryPath, skillName } = options;

        console.log('[GitHub] installSkill called with:', {
          githubUrl,
          skillPath,
          destination,
          skillName,
        });

        // Parse GitHub URL
        const urlMatch = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!urlMatch) {
          return {
            success: false,
            error: 'Invalid GitHub URL format',
          };
        }

        const owner = urlMatch[1];
        const repo = urlMatch[2].replace(/\.git$/, '');

        // Get repository default branch
        const repoInfo = await adapter.getRepository(owner, repo);
        const branch = repoInfo?.default_branch || 'main';

        // Get file tree for the skill folder
        const treeResult = await adapter.getTree(owner, repo, branch);
        if (!treeResult?.success || !treeResult.data) {
          return {
            success: false,
            error: 'Failed to fetch repository tree',
          };
        }

        // Normalize skillPath to remove leading/trailing slashes and repo prefix
        let normalizedSkillPath = skillPath.trim();

        // Remove any leading repo path like "/owner/repo/"
        const repoPrefix = `/${owner}/${repo}/`;
        if (normalizedSkillPath.startsWith(repoPrefix)) {
          normalizedSkillPath = normalizedSkillPath.substring(repoPrefix.length);
        }

        // Remove leading slash
        normalizedSkillPath = normalizedSkillPath.replace(/^\/+/, '');

        console.log('[GitHub] Normalized skill path:', {
          original: skillPath,
          normalized: normalizedSkillPath,
        });

        // Filter files in skill folder
        const skillFiles = treeResult.data.tree.filter(
          (file) => file.path?.startsWith(normalizedSkillPath) && file.type === 'blob'
        );

        if (skillFiles.length === 0) {
          return {
            success: false,
            error: `No files found in skill path: ${skillPath}`,
          };
        }

        // Download each file
        const downloadedFiles: Array<{ path: string; content: string }> = [];
        for (const file of skillFiles) {
          if (file.path) {
            const content = await adapter.getFileContent(owner, repo, file.path, branch);
            if (content) {
              downloadedFiles.push({
                path: file.path,
                content,
              });
            }
          }
        }

        // Determine installation destination
        const homeDir = app.getPath('home');
        let destPath: string;

        const extractedSkillName = skillName || path.basename(skillPath);

        switch (destination) {
          case 'global-universal':
            destPath = path.join(homeDir, '.agent', 'skills', extractedSkillName);
            break;
          case 'global-claude':
            destPath = path.join(homeDir, '.claude', 'skills', extractedSkillName);
            break;
          case 'project-universal':
            if (!repositoryPath) {
              return {
                success: false,
                error: 'Repository path required for project installation',
              };
            }
            destPath = path.join(repositoryPath, '.agent', 'skills', extractedSkillName);
            break;
          case 'project-claude':
            if (!repositoryPath) {
              return {
                success: false,
                error: 'Repository path required for project installation',
              };
            }
            destPath = path.join(repositoryPath, '.claude', 'skills', extractedSkillName);
            break;
          default:
            return {
              success: false,
              error: `Invalid destination: ${destination}`,
            };
        }

        // Create destination directory
        await fsPromises.mkdir(destPath, { recursive: true });

        // Copy files to destination
        const installedFiles: string[] = [];
        for (const file of downloadedFiles) {
          // Calculate relative path by removing the skill path prefix
          let relativePath = file.path;

          console.log('[GitHub] Processing file:', {
            filePath: file.path,
            normalizedSkillPath,
          });

          // Ensure skill path ends with / for proper prefix matching
          const skillPathWithSlash = normalizedSkillPath.endsWith('/')
            ? normalizedSkillPath
            : normalizedSkillPath + '/';

          if (relativePath.startsWith(skillPathWithSlash)) {
            relativePath = relativePath.substring(skillPathWithSlash.length);
          } else if (relativePath === normalizedSkillPath) {
            // Handle case where file.path might be exactly skillPath (shouldn't happen with blobs)
            console.warn(`[GitHub] File path equals skill path, skipping: ${file.path}`);
            continue;
          } else {
            // This shouldn't happen since we filtered by startsWith, but handle it
            console.warn(`[GitHub] File path doesn't start with skill path: ${file.path}`);
            continue;
          }

          // Remove leading slash if present
          relativePath = relativePath.replace(/^\/+/, '');

          // Skip if no relative path (defensive check)
          if (!relativePath) {
            console.warn(`[GitHub] Skipping file with empty relative path: ${file.path}`);
            continue;
          }

          console.log('[GitHub] Calculated relative path:', relativePath);

          const fullPath = path.join(destPath, relativePath);

          // Create parent directories
          await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });

          // Write file
          await fsPromises.writeFile(fullPath, file.content, 'utf-8');
          installedFiles.push(relativePath);

          console.log(`[GitHub] Installed skill file: ${relativePath}`);
        }

        // Create metadata file for tracking provenance
        const metadata = {
          installedFrom: githubUrl,
          skillPath: normalizedSkillPath,
          owner,
          repo,
          branch,
          installedAt: new Date().toISOString(),
          destination,
          sha: treeResult.data.sha,
          files: installedFiles,
        };

        const metadataPath = path.join(destPath, '.metadata.json');
        await fsPromises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
        console.log(`[GitHub] Created metadata file: ${metadataPath}`);

        console.log(`[GitHub] Skill installed successfully to: ${destPath}`);

        return {
          success: true,
          installedPath: destPath,
          filesInstalled: installedFiles,
        };
      } catch (error) {
        console.error('[GitHub] Failed to install skill:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  console.log('[GitHub] IPC handlers registered');
  console.log('[Config] Configuration handlers registered');
}
