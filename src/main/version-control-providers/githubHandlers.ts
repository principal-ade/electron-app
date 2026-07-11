import { BrowserWindow, ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import fetch from 'node-fetch';
import type { CommitActivityCard } from '../../shared/tipc/webAdeRouterTypes';
import type { IncomingMessage } from 'http';
import { electronCLI } from '../electron-cli-bridge';
import { UnifiedSecureStorage } from '../services/UnifiedSecureStorage';
import { authService } from '../services/AuthService';
import {
  GitHubAPIEvent,
  // DELETED: ConfigFetchRequest, ConfigFetchResponse, GitHubConfigRequest - unused after handler removal
  // DELETED: CreateIssueRequest, CreateIssueResponse, GitHubIssue, GitHubPullRequest - unused after adapter method removal
  GitHubCommit,
  GitHubRepository,
  GitHubOrganization,
  RepositoryFetchOptions,
  CreateRepositoryInput,
  GitHubRepositoryCreated,
  GitHubLicenseTemplate,
  InstallSkillOptions,
  InstallSkillResult,
  GitHubUser,
  GitHubSSHKey,
  SSHKeysResponse,
  ForkRepositoryOptions,
  GitHubOrgMember,
  GitHubRepositoryWithPermissions,
  SearchUsersResponse,
  SearchReposResponse,
} from '../../shared/main-process-api-interfaces/GitHubAPI';
import { getSkillLockFileService } from '../skills/skillLockFile';
import { normalizeGitHubSource, SkillLockAPIEvent } from '../../shared/main-process-api-interfaces/SkillLockAPI';
import { createSkillSymlink } from '../skills/symlinkUtils';
import { sendToAllWindows } from '../window/modernWindowManager';
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

// Named types for better readability of dynamic data
/** JSON payload sent in API request body */
type GitHubAPIRequestBody = unknown;
/** Response data from GitHub API (could be JSON object, array, or text) */
type GitHubAPIResponseData = unknown;
/** HTTP response headers as key-value pairs */
type GitHubAPIResponseHeaders = Record<string, string>;

/** Raw GitHub API repository response (before mapping to our types) */
interface RawGitHubRepositoryResponse {
  id: unknown;
  name: unknown;
  full_name: unknown;
  owner: {
    login: unknown;
    avatar_url: unknown;
  };
  private: unknown;
  html_url: unknown;
  description: unknown;
  fork: unknown;
  clone_url: unknown;
  updated_at: unknown;
  pushed_at: unknown;
  language: unknown;
  default_branch: unknown;
  stargazers_count?: unknown;
  license?: {
    spdx_id: string;
  } | null;
  permissions?: {
    admin: boolean;
    maintain?: boolean;
    push: boolean;
    triage?: boolean;
    pull: boolean;
  };
}

/** Raw GitHub API organization response */
interface RawGitHubOrganizationResponse {
  login: unknown;
  id: unknown;
  avatar_url: unknown;
  description: unknown;
}

/** Raw GitHub API license template response */
interface RawGitHubLicenseTemplateResponse {
  key: unknown;
  name: unknown;
  spdx_id: unknown;
  url: unknown;
}
/** Raw GitHub API commit info response (before type validation) */
type GitHubCommitInfoResponse = {
  commit?: {
    author?: {
      name?: string;
      email?: string;
      date?: string;
    };
    committer?: {
      name?: string;
      email?: string;
      date?: string;
    };
    message?: string;
  };
  author?: Record<string, unknown>;
} | null;

/** Markdown document file info (local or remote) */
interface MarkdownDocumentFile {
  path: string;
  name: string;
  size: number;
  lastModified: Date;
  gitLastModified?: Date;
  isTracked: boolean;
}

/** GitHub API tree response */
export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: Array<{
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url?: string;
  }>;
  truncated: boolean;
}

/** Partial tree entry for git tree building (before full tree response) */
interface PartialTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

interface CacheEntry {
  value: unknown;
  timestamp: number;
}

function buildActivityCards(
  owner: string,
  repoName: string,
  commits: Array<{ sha: string; message: string; authorLogin: string; authorAvatarUrl?: string; committedAt: string; url: string }>
): CommitActivityCard[] {
  const cardMap = new Map<string, CommitActivityCard>();

  for (const commit of commits) {
    const date = new Date(commit.committedAt);
    const dateStr = date.toISOString().split('T')[0];
    const hour = date.getUTCHours();
    const itemId = `${dateStr}:${hour.toString().padStart(2, '0')}:${owner}/${repoName}`;

    let card = cardMap.get(itemId);
    if (!card) {
      const hourBucket = new Date(date);
      hourBucket.setUTCMinutes(0, 0, 0);
      card = {
        itemId,
        repo: { owner, name: repoName },
        hour,
        hourBucket: hourBucket.toISOString(),
        commits: [],
        commitCount: 0,
        latestCommitAt: commit.committedAt,
      };
      cardMap.set(itemId, card);
    }
    if (!card.commits.some(c => c.sha === commit.sha)) {
      card.commits.push({
        sha: commit.sha,
        message: commit.message,
        author: { login: commit.authorLogin, avatarUrl: commit.authorAvatarUrl },
        committedAt: commit.committedAt,
        url: commit.url,
      });
      card.commitCount++;
      if (new Date(commit.committedAt) > new Date(card.latestCommitAt)) {
        card.latestCommitAt = commit.committedAt;
      }
    }
  }

  return Array.from(cardMap.values());
}

export class GitHubAdapter {
  private cache: Map<string, CacheEntry> = new Map();
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
      body?: GitHubAPIRequestBody;
    } = {},
  ): Promise<{
    success: boolean;
    data?: GitHubAPIResponseData;
    headers?: GitHubAPIResponseHeaders;
    status?: number;
    statusText?: string;
    error?: string;
  }> {
    console.log('[GitHub] makeGitHubAPICall: Requesting endpoint:', endpoint);

    const token = await this.getGitHubToken();
    if (!token) {
      const method = options.method || 'GET';
      if (method === 'GET') {
        console.log(
          '[GitHub] makeGitHubAPICall: No token, falling back to gh CLI for endpoint:',
          endpoint,
        );
        const ghResult = await this.makeGitHubAPICallViaGh(endpoint, options);
        if (ghResult.success) return ghResult;

        console.log(
          '[GitHub] makeGitHubAPICall: gh CLI unavailable, trying unauthenticated request:',
          endpoint,
        );
        return this.makeGitHubAPICallUnauthenticated(endpoint, options);
      }
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
      let data: GitHubAPIResponseData;

      if (
        contentType.includes('application/vnd.github.v3.raw') ||
        contentType.includes('application/vnd.github.v3.diff') ||
        contentType.includes('application/vnd.github.v3.patch') ||
        contentType.includes('text/plain') ||
        options.headers?.Accept?.includes('application/vnd.github.v3.raw') ||
        options.headers?.Accept?.includes('application/vnd.github.v3.diff') ||
        options.headers?.Accept?.includes('application/vnd.github.v3.patch')
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

  /**
   * Fallback path for GET requests when no in-app GitHub token is available.
   * Shells out to the user's `gh` CLI, which reads its own auth from
   * `gh auth login`. Returns the same shape as makeGitHubAPICall so callers
   * don't need to branch.
   */
  private async makeGitHubAPICallViaGh(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: GitHubAPIRequestBody;
    } = {},
  ): Promise<{
    success: boolean;
    data?: GitHubAPIResponseData;
    headers?: GitHubAPIResponseHeaders;
    status?: number;
    statusText?: string;
    error?: string;
  }> {
    const args = ['gh', 'api'];
    const accept = options.headers?.Accept;
    if (accept) {
      args.push('-H', `Accept: ${accept}`);
    }
    args.push(endpoint);

    const isRaw =
      !!accept &&
      (accept.includes('application/vnd.github.v3.raw') ||
        accept.includes('application/vnd.github.v3.diff') ||
        accept.includes('application/vnd.github.v3.patch'));

    // Raw content (file bodies, diffs, patches) must keep exact bytes; trimming
    // would drop trailing newlines. JSON/other responses still want trimming.
    const result = await this.executeCommand(args, { raw: isRaw });
    if (!result.success) {
      const stderr = result.stderr || '';
      const looksUnauthed =
        /not logged|authentication required|gh auth login/i.test(stderr);
      const looksMissing = /command not found|ENOENT|not found/i.test(stderr);
      const error = looksMissing
        ? 'gh CLI is not installed'
        : looksUnauthed
          ? 'gh CLI is not authenticated (run `gh auth login`)'
          : stderr || 'gh CLI fallback failed';
      console.error('[GitHub] gh fallback failed:', error);
      return { success: false, error };
    }

    let data: GitHubAPIResponseData;
    if (isRaw) {
      data = result.stdout;
    } else {
      try {
        data = JSON.parse(result.stdout);
      } catch {
        data = result.stdout;
      }
    }

    return {
      success: true,
      data,
      headers: {},
      status: 200,
      statusText: 'OK',
    };
  }

  /**
   * Last-resort fallback for GET requests when neither the in-app token nor
   * the `gh` CLI is available. Makes an unauthenticated HTTP request to
   * GitHub — works for search endpoints with a 10 req/min rate limit.
   */
  private async makeGitHubAPICallUnauthenticated(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: GitHubAPIRequestBody;
    } = {},
  ): Promise<{
    success: boolean;
    data?: GitHubAPIResponseData;
    headers?: GitHubAPIResponseHeaders;
    status?: number;
    statusText?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const error = `GitHub API error (unauthenticated): ${response.status} ${response.statusText}`;
        console.error('[GitHub]', error);
        return { success: false, error, status: response.status, statusText: response.statusText };
      }

      const data = await response.json();
      return {
        success: true,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      console.error('[GitHub] Unauthenticated request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // DELETED: detectRepository, getGitRemotes, parseGitRemoteUrl - unused (0 calls)

  async checkAuthStatus(): Promise<{ isAuthenticated: boolean; method: string; username?: string }> {
    try {
      const authStatusResult = await this.executeCommand(['gh', 'auth', 'status']);
      if (!authStatusResult.success) {
        return { isAuthenticated: false, method: 'none' };
      }
      const userResult = await this.executeCommand(['gh', 'api', '/user']);
      if (userResult.success) {
        try {
          const userData = JSON.parse(userResult.stdout);
          return { isAuthenticated: true, method: 'cli', username: userData.login };
        } catch {
          return { isAuthenticated: true, method: 'cli' };
        }
      }
    } catch {
      // gh not installed or not authenticated
    }
    return { isAuthenticated: false, method: 'none' };
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
                } catch (_error) {
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
      const ghResult = await this.executeCommand(
        [
          'gh',
          'api',
          `/repos/${owner}/${repo}/contents/${path}${refSuffix}`,
          '-H',
          'Accept: application/vnd.github.v3.raw',
        ],
        { raw: true },
      );

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
          '[GitHub:getMarkdownDocuments] gh tree failed, falling back to authenticated API',
          { stderr: listResult.stderr },
        );
        const treeResult = await this.getTree(
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
            error: !treeResult.success ? treeResult.error : 'No tree data',
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

              const info: GitHubCommitInfoResponse = await new Promise((resolve) => {
                const req = https.request(options, (res: IncomingMessage) => {
                  let data = '';
                  res.on('data', (chunk: Buffer) => (data += chunk));
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

      const localFiles: MarkdownDocumentFile[] = [];
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
      const merged: MarkdownDocumentFile[] = [];
      for (const local of localFiles) {
        const remote = remoteByPath.get(local.path);
        if (remote && remote.lastModified) {
          try {
            const remoteDate = new Date(remote.lastModified);
            const lastModified =
              local.lastModified > remoteDate ? local.lastModified : remoteDate;
            merged.push({
              ...local,
              lastModified,
              gitLastModified: remote.gitLastModified
                ? new Date(remote.gitLastModified)
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
            lastModified: new Date(remote.lastModified),
            gitLastModified: remote.gitLastModified
              ? new Date(remote.gitLastModified)
              : undefined,
            isTracked: true,
          });
        }
      }

      // Sort and return
      merged.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );
      return merged;
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

      const req = https.request(options, (res: IncomingMessage) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const repoData = JSON.parse(data);
              resolve(repoData.default_branch || null);
            } catch (_e) {
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
    options: { cwd?: string; raw?: boolean } = {},
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
        // Preserve exact stdout bytes for raw fetches (e.g. file content), where
        // trimming would drop the trailing newline and corrupt the written file.
        // Other callers parse SHAs/JSON/status and rely on the trimmed form.
        stdout: options.raw ? result.stdout : result.stdout.trim(),
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
   * Get repository tree with authentication support for private repos
   */
  async getTree(owner: string, repo: string, ref: string): Promise<
    | { success: true; data: GitHubTreeResponse }
    | { success: false; error: string }
  > {
    console.log(
      `[GitHub] Getting tree for ${owner}/${repo} on branch ${ref}`,
    );

    // Always use authenticated API call (works for both public and private repos)
    const result = await this.makeGitHubAPICall(
      `/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    );

    if (result.success) {
      return { success: true, data: result.data as GitHubTreeResponse };
    }

    return {
      success: false,
      error: result.error || 'Failed to fetch repository tree',
    };
  }


  // DELETED: createIssue - unused (0 calls)

  // Get user's repositories from GitHub
  async getUserRepositories(
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    // Build query parameters. `/user/repos` defaults to only the repos GitHub
    // feels like returning; without an explicit `affiliation` the caller's own
    // personal repos can be dropped, which is why the "My Projects" panel showed
    // org repos but no "you" section. Mirror the proven JWTService call and ask
    // for owner + collaborator + org-member repos. GitHub returns a 422 if
    // `affiliation` is combined with `type`, so only one is sent.
    const params: string[] = [];
    if (options?.type) {
      params.push(`type=${options.type}`);
    } else {
      params.push(
        `affiliation=${options?.affiliation || 'owner,collaborator,organization_member'}`,
      );
    }
    if (options?.sort) params.push(`sort=${options.sort}`);
    if (options?.direction) params.push(`direction=${options.direction}`);
    params.push(`per_page=${options?.perPage || 100}`);
    if (options?.page) params.push(`page=${options.page}`);

    const endpoint =
      params.length > 0 ? `/user/repos?${params.join('&')}` : '/user/repos';

    // Try token-based API first
    const apiResult = await this.makeGitHubAPICall(endpoint);
    if (apiResult.success && apiResult.data) {
      return (apiResult.data as RawGitHubRepositoryResponse[]).map((repo) => ({
        id: repo.id as number,
        name: repo.name as string,
        full_name: repo.full_name as string,
        owner: {
          login: repo.owner.login as string,
          avatar_url: repo.owner.avatar_url as string,
        },
        private: repo.private as boolean,
        html_url: repo.html_url as string,
        description: repo.description as string | null,
        fork: repo.fork as boolean,
        clone_url: repo.clone_url as string,
        updated_at: repo.updated_at as string,
        pushed_at: repo.pushed_at as string,
        language: repo.language as string | null,
        default_branch: repo.default_branch as string,
        stargazers_count: repo.stargazers_count as number | undefined,
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
        return (repos as RawGitHubRepositoryResponse[]).map((repo) => ({
          id: repo.id as number,
          name: repo.name as string,
          full_name: repo.full_name as string,
          owner: { login: repo.owner.login as string, avatar_url: repo.owner.avatar_url as string },
          private: repo.private as boolean,
          html_url: repo.html_url as string,
          description: repo.description as string | null,
          fork: repo.fork as boolean,
          clone_url: repo.clone_url as string,
          updated_at: repo.updated_at as string,
          pushed_at: repo.pushed_at as string,
          language: repo.language as string | null,
          default_branch: repo.default_branch as string,
          stargazers_count: repo.stargazers_count as number | undefined,
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
      return (apiResult.data as RawGitHubRepositoryResponse[]).map((repo) => ({
        id: repo.id as number,
        name: repo.name as string,
        full_name: repo.full_name as string,
        owner: {
          login: repo.owner.login as string,
          avatar_url: repo.owner.avatar_url as string,
        },
        private: repo.private as boolean,
        html_url: repo.html_url as string,
        description: repo.description as string | null,
        fork: repo.fork as boolean,
        clone_url: repo.clone_url as string,
        updated_at: repo.updated_at as string,
        pushed_at: repo.pushed_at as string,
        language: repo.language as string | null,
        default_branch: repo.default_branch as string,
        stargazers_count: repo.stargazers_count as number | undefined,
        license: repo.license?.spdx_id || null,
      }));
    }

    try {
      const args = ['gh', 'api', endpoint];
      const result = await this.executeCommand(args);

      if (result.success && result.stdout) {
        const repos = JSON.parse(result.stdout);
        return (repos as RawGitHubRepositoryResponse[]).map((repo) => ({
          id: repo.id as number,
          name: repo.name as string,
          full_name: repo.full_name as string,
          owner: { login: repo.owner.login as string, avatar_url: repo.owner.avatar_url as string },
          private: repo.private as boolean,
          html_url: repo.html_url as string,
          description: repo.description as string | null,
          fork: repo.fork as boolean,
          clone_url: repo.clone_url as string,
          updated_at: repo.updated_at as string,
          pushed_at: repo.pushed_at as string,
          language: repo.language as string | null,
          default_branch: repo.default_branch as string,
          stargazers_count: repo.stargazers_count as number | undefined,
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
      return (apiResult.data as RawGitHubRepositoryResponse[]).map((repo) => ({
        id: repo.id as number,
        name: repo.name as string,
        full_name: repo.full_name as string,
        owner: {
          login: repo.owner.login as string,
          avatar_url: repo.owner.avatar_url as string,
        },
        private: repo.private as boolean,
        html_url: repo.html_url as string,
        description: repo.description as string | null,
        fork: repo.fork as boolean,
        clone_url: repo.clone_url as string,
        updated_at: repo.updated_at as string,
        pushed_at: repo.pushed_at as string,
        language: repo.language as string | null,
        default_branch: repo.default_branch as string,
        stargazers_count: repo.stargazers_count as number | undefined,
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
        return (repos as RawGitHubRepositoryResponse[]).map((repo) => ({
          id: repo.id as number,
          name: repo.name as string,
          full_name: repo.full_name as string,
          owner: { login: repo.owner.login as string, avatar_url: repo.owner.avatar_url as string },
          private: repo.private as boolean,
          html_url: repo.html_url as string,
          description: repo.description as string | null,
          fork: repo.fork as boolean,
          clone_url: repo.clone_url as string,
          updated_at: repo.updated_at as string,
          pushed_at: repo.pushed_at as string,
          language: repo.language as string | null,
          default_branch: repo.default_branch as string,
          stargazers_count: repo.stargazers_count as number | undefined,
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
      return (apiResult.data as RawGitHubOrganizationResponse[]).map((org) => ({
        login: org.login as string,
        id: org.id as number,
        avatar_url: org.avatar_url as string,
        description: org.description as string | null,
      }));
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', '/user/orgs']);

      if (result.success && result.stdout) {
        const orgs = JSON.parse(result.stdout);
        // Return only the fields we need
        return (orgs as RawGitHubOrganizationResponse[]).map((org) => ({
          login: org.login as string,
          id: org.id as number,
          avatar_url: org.avatar_url as string,
          description: org.description as string | null,
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
  async getCurrentUser(): Promise<GitHubUser | null> {
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
      return apiResult.data as GitHubUser;
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
        return JSON.parse(result.stdout) as GitHubUser;
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
  async getUserSSHKeys(): Promise<SSHKeysResponse> {
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
        (apiResult.data as GitHubSSHKey[]).length,
      );
      return { success: true, data: apiResult.data as GitHubSSHKey[] };
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
    user: GitHubUser;
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

  // DELETED: getIssues - unused (0 calls)
  // DELETED: getPullRequests - unused (0 calls)

  /**
   * Get repository commits with author avatar URLs
   */
  async getRepositoryCommits(
    owner: string,
    repo: string,
    options?: { perPage?: number; page?: number },
  ): Promise<GitHubCommit[]> {
    const perPage = options?.perPage || 30;
    const page = options?.page || 1;
    const endpoint = `/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`;

    console.log(`[GitHub] Fetching commits for ${owner}/${repo}`);
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      const commits = apiResult.data as GitHubCommit[];
      console.log(`[GitHub] Successfully fetched ${commits.length} commits for ${owner}/${repo}`);
      return commits;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        const commits = JSON.parse(result.stdout) as GitHubCommit[];
        console.log(`[GitHub] Successfully fetched ${commits.length} commits via CLI for ${owner}/${repo}`);
        return commits;
      }
    } catch (error) {
      console.error('[GitHub] Error getting repository commits:', error);
    }

    return [];
  }

  /**
   * Get repository contributors
   * Returns a list of contributors with their commit counts
   */
  async getRepositoryContributors(
    owner: string,
    repo: string,
  ): Promise<Array<{ login: string; contributions: number; avatar_url: string }>> {
    const endpoint = `/repos/${owner}/${repo}/contributors`;

    console.log(`[GitHub] Fetching contributors for ${owner}/${repo}`);
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      const contributors = apiResult.data as Array<{ login: string; contributions: number; avatar_url: string }>;
      console.log(`[GitHub] Successfully fetched ${contributors.length} contributors for ${owner}/${repo}`);
      return contributors;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        const contributors = JSON.parse(result.stdout) as Array<{ login: string; contributions: number; avatar_url: string }>;
        console.log(`[GitHub] Successfully fetched ${contributors.length} contributors via CLI for ${owner}/${repo}`);
        return contributors;
      }
    } catch (error) {
      console.error('[GitHub] Error getting repository contributors:', error);
    }

    return [];
  }

  /**
   * Get repository collaborators (people with access to the repo).
   *
   * GitHub gates this endpoint behind write/maintain/admin access — a
   * reader (pull-only) gets a 403. We surface that as `forbidden: true`
   * rather than an empty list so the caller can distinguish "no
   * collaborators" from "you're not allowed to enumerate them" and fall
   * back to manual recipient entry.
   */
  async getRepositoryCollaborators(
    owner: string,
    repo: string,
  ): Promise<{
    collaborators: Array<{ login: string; avatar_url: string }>;
    forbidden: boolean;
  }> {
    const endpoint = `/repos/${owner}/${repo}/collaborators?per_page=100`;

    console.log(`[GitHub] Fetching collaborators for ${owner}/${repo}`);
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      const raw = apiResult.data as Array<{ login: string; avatar_url: string }>;
      const collaborators = raw.map((c) => ({
        login: c.login,
        avatar_url: c.avatar_url,
      }));
      console.log(
        `[GitHub] Fetched ${collaborators.length} collaborators for ${owner}/${repo}`,
      );
      return { collaborators, forbidden: false };
    }

    // 403 (no push access) / 404 (no read access) → can't enumerate.
    if (apiResult.status === 403 || apiResult.status === 404) {
      return { collaborators: [], forbidden: true };
    }

    // Fallback to CLI for transient API failures.
    try {
      const result = await this.executeCommand(['gh', 'api', `/repos/${owner}/${repo}/collaborators`]);
      if (result.success && result.stdout) {
        const raw = JSON.parse(result.stdout) as Array<{ login: string; avatar_url: string }>;
        return {
          collaborators: raw.map((c) => ({ login: c.login, avatar_url: c.avatar_url })),
          forbidden: false,
        };
      }
    } catch (error) {
      console.error('[GitHub] Error getting repository collaborators:', error);
    }

    return { collaborators: [], forbidden: false };
  }

  /**
   * Get followers for a user (defaults to authenticated user)
   */
  async getUserFollowers(username?: string): Promise<GitHubUser[]> {
    const endpoint = username
      ? `/users/${username}/followers`
      : '/user/followers';
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data as GitHubUser[];
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout) as GitHubUser[];
      }
    } catch (error) {
      console.error('[GitHub] Error getting followers:', error);
    }

    return [];
  }

  /**
   * Get users that a user is following (defaults to authenticated user)
   */
  async getUserFollowing(username?: string): Promise<GitHubUser[]> {
    const endpoint = username
      ? `/users/${username}/following`
      : '/user/following';
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data as GitHubUser[];
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout) as GitHubUser[];
      }
    } catch (error) {
      console.error('[GitHub] Error getting following:', error);
    }

    return [];
  }

  async isFollowingUser(username: string): Promise<boolean> {
    const token = await this.getGitHubToken();
    if (!token) return false;
    const authHeader = token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`;
    try {
      const response = await fetch(
        `https://api.github.com/user/following/${username}`,
        { headers: { Authorization: authHeader, Accept: 'application/vnd.github.v3+json' } },
      );
      return response.status === 204;
    } catch (err) {
      console.error('[GitHub] Failed to check follow status:', err);
      return false;
    }
  }

  async followUser(username: string): Promise<void> {
    const token = await this.getGitHubToken();
    if (!token) throw new Error('No GitHub token available');
    const authHeader = token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`;
    const response = await fetch(
      `https://api.github.com/user/following/${username}`,
      {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github.v3+json',
          'Content-Length': '0',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to follow user: ${response.status}`);
    }
  }

  async unfollowUser(username: string): Promise<void> {
    const token = await this.getGitHubToken();
    if (!token) throw new Error('No GitHub token available');
    const authHeader = token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`;
    const response = await fetch(
      `https://api.github.com/user/following/${username}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to unfollow user: ${response.status}`);
    }
  }

  /**
   * Get members of an organization
   */
  async getOrgMembers(org: string): Promise<GitHubOrgMember[]> {
    const endpoint = `/orgs/${org}/members`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data as GitHubOrgMember[];
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout) as GitHubOrgMember[];
      }
    } catch (error) {
      console.error('[GitHub] Error getting org members:', error);
    }

    return [];
  }

  /**
   * Get a specific user's profile
   */
  async getUser(username: string): Promise<GitHubUser | null> {
    const endpoint = `/users/${username}`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data as GitHubUser;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout) as GitHubUser;
      }
    } catch (error) {
      console.error('[GitHub] Error getting user:', error);
    }

    return null;
  }

  /**
   * Search for GitHub users
   */
  async searchUsers(query: string, options?: { perPage?: number }): Promise<SearchUsersResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('q', query);
    if (options?.perPage) {
      queryParams.set('per_page', String(options.perPage));
    }

    const endpoint = `/search/users?${queryParams.toString()}`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      const data = apiResult.data as { total_count: number; items: GitHubUser[] };
      return {
        users: data.items || [],
        totalCount: data.total_count || 0,
      };
    }

    return { users: [], totalCount: 0 };
  }

  /**
   * Search for GitHub repositories
   */
  async searchRepos(query: string, options?: { perPage?: number }): Promise<SearchReposResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('q', query);
    if (options?.perPage) {
      queryParams.set('per_page', String(options.perPage));
    }

    const endpoint = `/search/repositories?${queryParams.toString()}`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      const data = apiResult.data as { total_count: number; items: GitHubRepository[] };
      return {
        repos: data.items || [],
        totalCount: data.total_count || 0,
      };
    }

    return { repos: [], totalCount: 0 };
  }

  /**
   * Get a specific user's public organizations
   */
  async getUserOrganizationsForUser(username: string): Promise<GitHubOrganization[]> {
    const endpoint = `/users/${username}/orgs`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data as GitHubOrganization[];
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout) as GitHubOrganization[];
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
  ): Promise<GitHubRepository[]> {
    const queryParams = new URLSearchParams();
    if (options?.sort) queryParams.set('sort', options.sort);
    if (options?.direction) queryParams.set('direction', options.direction);
    if (options?.perPage) queryParams.set('per_page', String(options.perPage));
    if (options?.page) queryParams.set('page', String(options.page));

    const endpoint = `/users/${username}/starred${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      return apiResult.data as GitHubRepository[];
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        return JSON.parse(result.stdout) as GitHubRepository[];
      }
    } catch (error) {
      console.error('[GitHub] Error getting user starred repositories:', error);
    }

    return [];
  }

  async isRepositoryStarred(owner: string, repo: string): Promise<boolean> {
    const token = await this.getGitHubToken();
    if (!token) return false;
    const authHeader = token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`;
    try {
      const response = await fetch(
        `https://api.github.com/user/starred/${owner}/${repo}`,
        { headers: { Authorization: authHeader, Accept: 'application/vnd.github.v3+json' } },
      );
      return response.status === 204;
    } catch (err) {
      console.error('[GitHub] Failed to check star status:', err);
      return false;
    }
  }

  async starRepository(owner: string, repo: string): Promise<void> {
    const token = await this.getGitHubToken();
    if (!token) throw new Error('No GitHub token available');
    const authHeader = token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`;
    const response = await fetch(
      `https://api.github.com/user/starred/${owner}/${repo}`,
      {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github.v3+json',
          'Content-Length': '0',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to star repository: ${response.status}`);
    }
  }

  async unstarRepository(owner: string, repo: string): Promise<void> {
    const token = await this.getGitHubToken();
    if (!token) throw new Error('No GitHub token available');
    const authHeader = token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`;
    const response = await fetch(
      `https://api.github.com/user/starred/${owner}/${repo}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to unstar repository: ${response.status}`);
    }
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
      const repoData = apiResult.data as GitHubRepositoryCreated;
      console.log(
        `[GitHub] Successfully created repository: ${repoData.full_name}`,
      );
      return repoData;
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
      const licenses = (apiResult.data as RawGitHubLicenseTemplateResponse[]).map((license) => ({
        key: license.key as string,
        name: license.name as string,
        spdx_id: license.spdx_id as string,
        url: license.url as string,
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
          const licenses = (templates as RawGitHubLicenseTemplateResponse[]).map((license) => ({
            key: license.key as string,
            name: license.name as string,
            spdx_id: license.spdx_id as string,
            url: license.url as string,
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
  async getRepository(owner: string, repo: string): Promise<GitHubRepositoryWithPermissions | null> {
    console.log(`[GitHub] Fetching repository info for ${owner}/${repo}`);

    const endpoint = `/repos/${owner}/${repo}`;
    const apiResult = await this.makeGitHubAPICall(endpoint);

    if (apiResult.success && apiResult.data) {
      const repo = apiResult.data as GitHubRepositoryWithPermissions;
      console.log(`[GitHub] Successfully fetched repository ${owner}/${repo.name}`, {
        permissions: repo.permissions,
        fork: repo.fork,
      });
      return repo;
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand(['gh', 'api', endpoint]);
      if (result.success && result.stdout) {
        const repoData = JSON.parse(result.stdout) as GitHubRepositoryWithPermissions;
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
  ): Promise<GitHubRepositoryCreated | null> {
    console.log(`[GitHub] Forking repository ${owner}/${repo}`, options);

    const endpoint = `/repos/${owner}/${repo}/forks`;
    const body: Partial<ForkRepositoryOptions> = {};

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
      const forkedRepo = apiResult.data as GitHubRepositoryCreated;
      console.log(
        `[GitHub] Successfully forked repository to ${forkedRepo.full_name}`,
      );
      return forkedRepo;
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
          return this.getRepository(forkOwner, forkName) as Promise<GitHubRepositoryCreated | null>;
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

  // ============================================================================
  // Commit Data Methods for ProjectInfoPanel
  // ============================================================================

  /**
   * Cache for commit heat map data
   * Key: `${owner}/${repo}`, Value: { data, timestamp }
   */
  private commitHeatMapCache = new Map<
    string,
    { data: { date: string; count: number }[]; timestamp: number }
  >();
  private readonly HEATMAP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Cache for file trees at commits (immutable, indefinite TTL)
   * Key: `${owner}/${repo}/${sha}`, Value: string[]
   */
  private fileTreeCache = new Map<string, string[]>();

  /**
   * Cache for changed files at commits (immutable, indefinite TTL)
   * Key: `${owner}/${repo}/${sha}`, Value: Map<path, ChangedFileInfo>
   */
  private changedFilesCache = new Map<
    string,
    Map<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>
  >();

  /**
   * Get commit dates aggregated by day for heat map visualization
   */
  async getCommitDatesForHeatMap(
    owner: string,
    repo: string,
    days: number = 365,
  ): Promise<{ date: string; count: number }[]> {
    const cacheKey = `${owner}/${repo}`;
    const cached = this.commitHeatMapCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.HEATMAP_CACHE_TTL) {
      console.log(`[GitHub] Returning cached heat map data for ${cacheKey}`);
      return cached.data;
    }

    console.log(`[GitHub] Fetching commit heat map for ${owner}/${repo} (${days} days)`);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const since = sinceDate.toISOString();

    // Aggregate commits by date
    const commitsByDate = new Map<string, number>();
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore && page <= 50) {
      // Max 5000 commits
      const endpoint = `/repos/${owner}/${repo}/commits?since=${since}&per_page=${perPage}&page=${page}`;
      const result = await this.makeGitHubAPICall(endpoint);

      if (!result.success || !Array.isArray(result.data)) {
        console.error(`[GitHub] Failed to fetch commits page ${page}:`, result.error);
        break;
      }

      const commits = result.data as Array<{
        commit: { author: { date: string } };
      }>;

      if (commits.length === 0) {
        hasMore = false;
        break;
      }

      for (const commit of commits) {
        const date = commit.commit.author.date.split('T')[0]; // YYYY-MM-DD
        commitsByDate.set(date, (commitsByDate.get(date) || 0) + 1);
      }

      if (commits.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Convert to array sorted by date
    const data = Array.from(commitsByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Cache the result
    this.commitHeatMapCache.set(cacheKey, { data, timestamp: Date.now() });
    console.log(`[GitHub] Cached heat map data: ${data.length} days with commits`);

    return data;
  }

  /**
   * Get all commits in a date range (for playback)
   */
  async getCommitsInDateRange(
    owner: string,
    repo: string,
    startDate: string,
    endDate: string,
  ): Promise<GitHubCommit[]> {
    console.log(
      `[GitHub] Fetching commits for ${owner}/${repo} from ${startDate} to ${endDate}`,
    );

    // GitHub API uses ISO 8601 format, add time component
    const since = `${startDate}T00:00:00Z`;
    const until = `${endDate}T23:59:59Z`;

    const commits: GitHubCommit[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const endpoint = `/repos/${owner}/${repo}/commits?since=${since}&until=${until}&per_page=${perPage}&page=${page}`;
      const result = await this.makeGitHubAPICall(endpoint);

      if (!result.success || !Array.isArray(result.data)) {
        console.error(`[GitHub] Failed to fetch commits page ${page}:`, result.error);
        break;
      }

      const pageCommits = result.data as GitHubCommit[];

      if (pageCommits.length === 0) {
        hasMore = false;
        break;
      }

      commits.push(...pageCommits);

      if (pageCommits.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // GitHub returns newest first, reverse for chronological playback
    commits.reverse();
    console.log(`[GitHub] Found ${commits.length} commits in date range`);
    return commits;
  }

  /**
   * Get the most recent commit
   */
  async getLatestCommit(
    owner: string,
    repo: string,
  ): Promise<GitHubCommit | null> {
    console.log(`[GitHub] Fetching latest commit for ${owner}/${repo}`);

    const endpoint = `/repos/${owner}/${repo}/commits?per_page=1`;
    const result = await this.makeGitHubAPICall(endpoint);

    if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
      console.error(`[GitHub] Failed to fetch latest commit:`, result.error);
      return null;
    }

    return result.data[0] as GitHubCommit;
  }

  /**
   * Get file tree at a specific commit (for historical File City)
   */
  async getFileTreeAtCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<string[]> {
    const cacheKey = `${owner}/${repo}/${sha}`;
    const cached = this.fileTreeCache.get(cacheKey);
    if (cached) {
      console.log(`[GitHub] Returning cached file tree for ${cacheKey}`);
      return cached;
    }

    console.log(`[GitHub] Fetching file tree at commit ${sha} for ${owner}/${repo}`);

    const endpoint = `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
    const result = await this.makeGitHubAPICall(endpoint);

    if (!result.success || !result.data) {
      console.error(`[GitHub] Failed to fetch file tree:`, result.error);
      return [];
    }

    const treeData = result.data as {
      tree: Array<{ path: string; type: string }>;
      truncated?: boolean;
    };

    if (treeData.truncated) {
      console.warn(`[GitHub] File tree was truncated for ${sha}`);
    }

    // Extract only file paths (blobs), not directories (trees)
    const filePaths = treeData.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);

    // Cache indefinitely (commits are immutable)
    this.fileTreeCache.set(cacheKey, filePaths);
    console.log(`[GitHub] Cached file tree: ${filePaths.length} files`);

    return filePaths;
  }

  /**
   * Get changed files for a specific commit (for highlight layers)
   * Returns file info including status and line counts
   */
  async getChangedFilesForCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<Map<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>> {
    const cacheKey = `${owner}/${repo}/${sha}`;
    const cached = this.changedFilesCache.get(cacheKey);
    if (cached) {
      console.log(`[GitHub] Returning cached changed files for ${cacheKey}`);
      return cached;
    }

    console.log(`[GitHub] Fetching changed files for commit ${sha} in ${owner}/${repo}`);

    // Fetch the full commit info which includes files
    const endpoint = `/repos/${owner}/${repo}/commits/${sha}`;
    const result = await this.makeGitHubAPICall(endpoint);

    if (!result.success || !result.data) {
      console.error(`[GitHub] Failed to fetch commit:`, result.error);
      return new Map();
    }

    const commitData = result.data as {
      files?: Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        previous_filename?: string;
      }>;
    };

    const changedFiles = new Map<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>();

    if (commitData.files) {
      for (const file of commitData.files) {
        // Map GitHub status to our types
        let status: 'added' | 'modified' | 'deleted' | 'renamed';
        switch (file.status) {
          case 'added':
            status = 'added';
            break;
          case 'modified':
          case 'changed':
            status = 'modified';
            break;
          case 'removed':
            status = 'deleted';
            break;
          case 'renamed':
            status = 'renamed';
            break;
          default:
            status = 'modified'; // Default to modified for unknown statuses
        }
        changedFiles.set(file.filename, {
          status,
          additions: file.additions || 0,
          deletions: file.deletions || 0,
        });
      }
    }

    // Cache indefinitely (commits are immutable)
    this.changedFilesCache.set(cacheKey, changedFiles);
    console.log(`[GitHub] Cached changed files: ${changedFiles.size} files`);

    return changedFiles;
  }

  async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    console.log(`[GitHub] Fetching diff for commit ${sha} in ${owner}/${repo}`);
    const result = await this.makeGitHubAPICall(`/repos/${owner}/${repo}/commits/${sha}`, {
      headers: { Accept: 'application/vnd.github.v3.diff' },
    });
    if (!result.success || typeof result.data !== 'string') {
      console.error('[GitHub] Failed to fetch commit diff:', result.error);
      return '';
    }
    return result.data;
  }

  async getRepoActivity(owner: string, repo: string, days = 7): Promise<CommitActivityCard[]> {
    const token = await this.getGitHubToken();
    const authHeader = token
      ? token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`
      : undefined;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&per_page=100`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (!response.ok) return [];

    const commits = await response.json() as Array<{
      sha: string;
      commit: { message: string; author: { date: string } };
      author: { login: string; avatar_url: string } | null;
      html_url: string;
    }>;

    return buildActivityCards(owner, repo, commits.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      authorLogin: c.author?.login ?? 'unknown',
      authorAvatarUrl: c.author?.avatar_url,
      committedAt: c.commit.author.date,
      url: c.html_url,
    })));
  }

  async getOwnerActivity(login: string, type: 'User' | 'Organization', days = 7): Promise<CommitActivityCard[]> {
    const token = await this.getGitHubToken();
    const authHeader = token
      ? token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`
      : undefined;

    const headers = {
      Accept: 'application/vnd.github.v3+json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    };

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    if (type === 'Organization') {
      return this._getOrgActivityViaEvents(login, headers, since);
    }

    // For users: GraphQL contributionsCollection → per-repo REST commits
    return this._getUserActivityViaGraphQL(login, token, since);
  }

  private async _getOrgActivityViaEvents(
    login: string,
    headers: Record<string, string>,
    since: string,
  ): Promise<CommitActivityCard[]> {
    const response = await fetch(`https://api.github.com/orgs/${login}/events?per_page=100`, { headers });
    if (!response.ok) return [];

    const cutoff = new Date(since);
    const events = await response.json() as Array<{
      type: string;
      repo: { name: string };
      payload: {
        commits?: Array<{ sha: string; message: string }>;
        action?: string;
        pull_request?: {
          number: number;
          title: string;
          html_url: string;
          head: { sha: string };
          user: { login: string; avatar_url: string };
        };
      };
      actor: { login: string; avatar_url: string };
      created_at: string;
    }>;

    const repoCommits = new Map<string, Array<{ sha: string; message: string; authorLogin: string; authorAvatarUrl?: string; committedAt: string; url: string }>>();

    for (const event of events) {
      if (event.type !== 'PushEvent' && event.type !== 'PullRequestEvent') continue;
      if (new Date(event.created_at) < cutoff) continue;

      const [repoOwner, repoName] = event.repo.name.split('/');
      if (!repoOwner || !repoName) continue;

      const key = `${repoOwner}/${repoName}`;
      let commits = repoCommits.get(key);
      if (!commits) {
        commits = [];
        repoCommits.set(key, commits);
      }

      if (event.type === 'PushEvent') {
        for (const commit of event.payload.commits ?? []) {
          commits.push({
            sha: commit.sha,
            message: commit.message,
            authorLogin: event.actor.login,
            authorAvatarUrl: event.actor.avatar_url,
            committedAt: event.created_at,
            url: `https://github.com/${repoOwner}/${repoName}/commit/${commit.sha}`,
          });
        }
      } else if (event.type === 'PullRequestEvent') {
        const pr = event.payload.pull_request;
        const action = event.payload.action;
        if (!pr || (action !== 'opened' && action !== 'synchronize')) continue;
        commits.push({
          sha: pr.head.sha,
          message: `PR #${pr.number}: ${pr.title}`,
          authorLogin: pr.user.login,
          authorAvatarUrl: pr.user.avatar_url,
          committedAt: event.created_at,
          url: pr.html_url,
        });
      }
    }

    const allCards: CommitActivityCard[] = [];
    for (const [key, commits] of repoCommits) {
      const [repoOwner, repoName] = key.split('/');
      if (!repoOwner || !repoName) continue;
      allCards.push(...buildActivityCards(repoOwner, repoName, commits));
    }
    return allCards.sort((a, b) =>
      new Date(b.latestCommitAt).getTime() - new Date(a.latestCommitAt).getTime()
    );
  }

  private async _getUserActivityViaGraphQL(
    login: string,
    token: string | null,
    since: string,
  ): Promise<CommitActivityCard[]> {
    if (!token) return [];

    const authHeader = token.startsWith('gho_') ? `token ${token}` : `Bearer ${token}`;

    // Step 1: GraphQL to find which repos the user committed to
    const query = `
      query UserContributions($login: String!, $from: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from) {
            commitContributionsByRepository(maxRepositories: 25) {
              repository {
                nameWithOwner
              }
            }
          }
        }
      }
    `;

    const gqlResponse = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { login, from: since } }),
    });

    if (!gqlResponse.ok) return [];

    const gqlData = await gqlResponse.json() as {
      data?: {
        user?: {
          contributionsCollection?: {
            commitContributionsByRepository?: Array<{
              repository: { nameWithOwner: string };
            }>;
          };
        };
      };
      errors?: unknown[];
    };

    const repos = gqlData.data?.user?.contributionsCollection?.commitContributionsByRepository ?? [];
    if (repos.length === 0) return [];

    // Step 2: Fetch actual commits per repo filtered by author
    const restHeaders = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: authHeader,
    };

    const fetchRepoCommits = async (nameWithOwner: string) => {
      const [owner, repo] = nameWithOwner.split('/');
      if (!owner || !repo) return [];

      const url = `https://api.github.com/repos/${owner}/${repo}/commits?author=${login}&since=${since}&per_page=50`;
      const res = await fetch(url, { headers: restHeaders });
      if (!res.ok) return [];

      const commits = await res.json() as Array<{
        sha: string;
        commit: { message: string; author: { date: string } };
        author: { login: string; avatar_url: string } | null;
        html_url: string;
      }>;

      return buildActivityCards(owner, repo, commits.map(c => ({
        sha: c.sha,
        message: c.commit.message,
        authorLogin: c.author?.login ?? login,
        authorAvatarUrl: c.author?.avatar_url,
        committedAt: c.commit.author.date,
        url: c.html_url,
      })));
    };

    const results = await Promise.all(repos.map(r => fetchRepoCommits(r.repository.nameWithOwner)));
    const allCards = results.flat();

    return allCards.sort((a, b) =>
      new Date(b.latestCommitAt).getTime() - new Date(a.latestCommitAt).getTime()
    );
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

  // DELETED: DETECT_REPOSITORY - unused (0 calls in renderer)

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

        const result = await adapter.getTree(owner, repo, treeRef);

        if (result.success) {
          return result;
        }

        // Don't fallback for 404 (not found) or 403 (forbidden) - user doesn't have access
        if ('status' in result && (result.status === 404 || result.status === 403)) {
          const statusText = 'statusText' in result ? result.statusText : undefined;
          console.warn(
            `[GitHub] Skipping git CLI fallback for ${owner}/${repo}@${treeRef}: ${result.status} ${statusText || 'Access denied'}`,
          );
          return result;
        }

        // Fallback: use git CLI (Option C: no checkout) with SSH preferred
        console.warn(
          `[GitHub] API failed. Falling back to git CLI (no checkout) for ${owner}/${repo}@${treeRef}`,
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
        if (!treeRef) {
          return {
            success: false,
            error: 'treeRef is not defined',
          };
        }
        const fetchRes = await run(
          'git',
          ['fetch', '--depth', '1', 'origin', treeRef],
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

        const entries: PartialTreeEntry[] = [];
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

  // DELETED: FETCH_REMOTE_CONFIG - unused (0 calls in renderer)
  // DELETED: FETCH_GITHUB_CONFIG - unused (0 calls in renderer)

  // DELETED: GET_ISSUES - unused (0 calls in renderer)
  // DELETED: GET_PULL_REQUESTS - unused (0 calls in renderer)
  // DELETED: CREATE_ISSUE - unused (0 calls in renderer)

  ipcMain.handle(
    GitHubAPIEvent.GET_REPOSITORY_COMMITS,
    async (event, owner: string, repo: string, options?: { perPage?: number; page?: number }) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_REPOSITORY_COMMITS');
        return [];
      }
      return adapter.getRepositoryCommits(owner, repo, options);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_REPOSITORY_CONTRIBUTORS,
    async (event, owner: string, repo: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_REPOSITORY_CONTRIBUTORS');
        return [];
      }
      return adapter.getRepositoryContributors(owner, repo);
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

  // DELETED: GET_TOKEN_SCOPES - unused (0 calls in renderer)

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
        const { githubUrl, skillPath, destination, repositoryPath, skillName, fileList, skillTreeSha } = options;

        console.log('[GitHub] installSkill called with:', {
          githubUrl,
          skillPath,
          destination,
          skillName,
          fileListProvided: !!fileList,
          fileCount: fileList?.length,
          skillTreeSha,
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

        // File list is required - the renderer has the expertise to know what files belong to a skill
        if (!fileList || fileList.length === 0) {
          return {
            success: false,
            error: 'File list is required for skill installation. The main process does not have the expertise to determine skill structure.',
          };
        }

        console.log('[GitHub] Using provided file list:', {
          totalFiles: fileList.length,
          files: fileList,
        });

        // Download each file
        const downloadedFiles: Array<{ path: string; content: string }> = [];
        for (const filePath of fileList) {
          const content = await adapter.getFileContent(owner, repo, filePath, branch);
          if (content) {
            downloadedFiles.push({
              path: filePath,
              content,
            });
          } else {
            console.warn(`[GitHub] Failed to download file: ${filePath}`);
          }
        }

        // Determine installation destination
        const homeDir = app.getPath('home');
        const extractedSkillName = skillName || path.basename(skillPath);
        const isGlobalInstall = destination.startsWith('global-');

        // Canonical path is always ~/.agents/skills/{skillName} for global installs
        const canonicalPath = path.join(homeDir, '.agents', 'skills', extractedSkillName);

        let destPath: string;
        let agentSymlinkPath: string | undefined;

        if (isGlobalInstall) {
          // GLOBAL INSTALL: Use canonical + symlink approach
          // Files always go to canonical location
          destPath = canonicalPath;

          // Determine if we need to create a symlink to an agent directory
          if (destination !== 'global-universal') {
            switch (destination) {
              case 'global-claude':
                agentSymlinkPath = path.join(homeDir, '.claude', 'skills', extractedSkillName);
                break;
              case 'global-opencode':
                agentSymlinkPath = path.join(homeDir, '.config', 'opencode', 'skill', extractedSkillName);
                break;
              case 'global-cursor':
                agentSymlinkPath = path.join(homeDir, '.cursor', 'skills', extractedSkillName);
                break;
              case 'global-windsurf':
                agentSymlinkPath = path.join(homeDir, '.windsurf', 'skills', extractedSkillName);
                break;
              default:
                return {
                  success: false,
                  error: `Invalid global destination: ${destination}`,
                };
            }
          }
        } else {
          // PROJECT INSTALL: Direct copy (no symlinks for git portability)
          if (!repositoryPath) {
            return {
              success: false,
              error: 'Repository path required for project installation',
            };
          }

          switch (destination) {
            case 'project-universal':
              destPath = path.join(repositoryPath, '.agents', 'skills', extractedSkillName);
              break;
            case 'project-claude':
              destPath = path.join(repositoryPath, '.claude', 'skills', extractedSkillName);
              break;
            default:
              return {
                success: false,
                error: `Invalid project destination: ${destination}`,
              };
          }
        }

        // Create destination directory (canonical for global, direct for project)
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

        // Create symlink from agent directory to canonical (for global installs)
        if (isGlobalInstall && agentSymlinkPath) {
          console.log(`[GitHub] Creating symlink: ${agentSymlinkPath} -> ${canonicalPath}`);
          await createSkillSymlink(canonicalPath, agentSymlinkPath);
          console.log(`[GitHub] Symlink created successfully`);
        }

        // Add skill to centralized lock file (replaces per-skill .metadata.json)
        // Following add-skill convention: https://github.com/vercel-labs/add-skill
        const skillLockService = getSkillLockFileService();
        await skillLockService.addSkill({
          name: extractedSkillName,
          entry: {
            source: normalizeGitHubSource(githubUrl),
            sourceType: 'github',
            sourceUrl: githubUrl,
            skillPath: normalizedSkillPath,
            skillFolderHash: skillTreeSha || '',
            // Track canonical path for global installs
            canonicalPath: isGlobalInstall ? canonicalPath : undefined,
            // Track branch for editing
            branch,
          },
        });
        console.log(`[GitHub] Added skill to lock file: ${extractedSkillName}`);

        console.log(`[GitHub] Skill installed successfully to: ${destPath}`);
        if (agentSymlinkPath) {
          console.log(`[GitHub] Symlinked to agent directory: ${agentSymlinkPath}`);
        }

        // Broadcast to all windows that a skill was installed
        sendToAllWindows(SkillLockAPIEvent.SKILL_INSTALLED, {
          skillName: extractedSkillName,
          destination,
          installedPath: agentSymlinkPath || destPath,
          filesInstalled: installedFiles,
        });
        console.log(`[GitHub] Broadcasted skill:installed to all windows`);

        return {
          success: true,
          installedPath: agentSymlinkPath || destPath,
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

  // ============================================================================
  // Commit Data Handlers for ProjectInfoPanel
  // ============================================================================

  ipcMain.handle(
    GitHubAPIEvent.GET_COMMIT_DATES_FOR_HEATMAP,
    async (event, owner: string, repo: string, days?: number) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_COMMIT_DATES_FOR_HEATMAP');
        return [];
      }
      return adapter.getCommitDatesForHeatMap(owner, repo, days);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_COMMITS_IN_DATE_RANGE,
    async (event, owner: string, repo: string, startDate: string, endDate: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_COMMITS_IN_DATE_RANGE');
        return [];
      }
      return adapter.getCommitsInDateRange(owner, repo, startDate, endDate);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_LATEST_COMMIT,
    async (event, owner: string, repo: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_LATEST_COMMIT');
        return null;
      }
      return adapter.getLatestCommit(owner, repo);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_FILE_TREE_AT_COMMIT,
    async (event, owner: string, repo: string, sha: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_FILE_TREE_AT_COMMIT');
        return [];
      }
      return adapter.getFileTreeAtCommit(owner, repo, sha);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_CHANGED_FILES_FOR_COMMIT,
    async (event, owner: string, repo: string, sha: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_CHANGED_FILES_FOR_COMMIT');
        return {};
      }
      // Convert Map to plain object for IPC serialization
      const changedFilesMap = await adapter.getChangedFilesForCommit(owner, repo, sha);
      return Object.fromEntries(changedFilesMap);
    },
  );

  ipcMain.handle(
    GitHubAPIEvent.GET_COMMIT_DIFF,
    async (event, owner: string, repo: string, sha: string) => {
      const adapter = getAdapterFromSender(event.sender);
      if (!adapter) {
        console.error('[GitHub] No adapter found for GET_COMMIT_DIFF');
        return '';
      }
      return adapter.getCommitDiff(owner, repo, sha);
    },
  );

  console.log('[GitHub] IPC handlers registered');
  console.log('[Config] Configuration handlers registered');
}
