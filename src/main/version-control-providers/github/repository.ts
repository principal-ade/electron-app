/**
 * GitHub Repository Operations
 *
 * Repository detection, CRUD operations, and metadata retrieval.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage } from 'http';
import type { GitHubAPICore } from './apiCore';
import type {
  GitRepositoryInfo,
  GitRemoteInfo,
  GitHubTreeResponse,
  CreateRepositoryInput,
  GitHubRepositoryCreated,
  GitHubLicenseTemplate,
  GitHubRepositoryWithPermissions,
  ForkRepositoryOptions,
  RawGitHubLicenseTemplateResponse,
} from './types';

// =============================================================================
// Repository Detection
// =============================================================================

/**
 * Detect if a directory is a Git repository and get its info
 */
export async function detectRepository(
  core: GitHubAPICore,
  directoryPath: string,
): Promise<GitRepositoryInfo | null> {
  console.log(`[GitHub] Detecting repository for: ${directoryPath}`);

  try {
    const gitPath = path.join(directoryPath, '.git');
    if (!fs.existsSync(gitPath)) {
      console.log(`[GitHub] No .git directory found in ${directoryPath}`);
      return null;
    }

    const remotes = await getGitRemotes(core, directoryPath);
    const githubRemote = remotes.find((remote) => remote.isGitHub);

    const branchResult = await core.executeCommand(
      ['git', 'branch', '--show-current'],
      { cwd: directoryPath },
    );
    const currentBranch = branchResult.success
      ? branchResult.stdout.trim()
      : undefined;

    let defaultBranch: string | undefined;
    if (githubRemote) {
      const defaultBranchResult = await core.executeCommand(
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

/**
 * Get Git remotes for a repository
 */
export async function getGitRemotes(
  core: GitHubAPICore,
  directoryPath: string,
): Promise<GitRemoteInfo[]> {
  const result = await core.executeCommand(['git', 'remote', '-v'], {
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
      const remote = parseGitRemoteUrl(name, url);
      if (!remotes.find((r) => r.name === remote.name)) {
        remotes.push(remote);
      }
    }
  }

  return remotes;
}

/**
 * Parse a Git remote URL to extract provider info
 */
export function parseGitRemoteUrl(name: string, url: string): GitRemoteInfo {
  const remote: GitRemoteInfo = {
    name,
    url,
    isGitHub: false,
    provider: 'other',
  };

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

// =============================================================================
// Repository Tree
// =============================================================================

/**
 * Get repository tree with authentication support for private repos
 */
export async function getTree(
  core: GitHubAPICore,
  owner: string,
  repo: string,
  ref: string,
): Promise<{ success: true; data: GitHubTreeResponse } | { success: false; error: string }> {
  console.log(`[GitHub] Getting tree for ${owner}/${repo} on branch ${ref}`);

  const result = await core.makeGitHubAPICall(
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

/**
 * Get repository default branch (unauthenticated, for public repos)
 */
export function getRepoDefaultBranch(
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

// =============================================================================
// Repository CRUD
// =============================================================================

/**
 * Get repository info including permissions
 */
export async function getRepository(
  core: GitHubAPICore,
  owner: string,
  repo: string,
): Promise<GitHubRepositoryWithPermissions | null> {
  console.log(`[GitHub] Fetching repository info for ${owner}/${repo}`);

  const endpoint = `/repos/${owner}/${repo}`;
  const apiResult = await core.makeGitHubAPICall(endpoint);

  if (apiResult.success && apiResult.data) {
    const repoData = apiResult.data as GitHubRepositoryWithPermissions;
    console.log(`[GitHub] Successfully fetched repository ${owner}/${repoData.name}`, {
      permissions: repoData.permissions,
      fork: repoData.fork,
    });
    return repoData;
  }

  // Fallback to CLI
  try {
    const result = await core.executeCommand(['gh', 'api', endpoint]);
    if (result.success && result.stdout) {
      const repoData = JSON.parse(result.stdout) as GitHubRepositoryWithPermissions;
      console.log(`[GitHub] Successfully fetched repository ${owner}/${repo} via CLI`);
      return repoData;
    }
  } catch (error) {
    console.error('[GitHub] Error getting repository info:', error);
  }

  console.warn(`[GitHub] Failed to fetch repository ${owner}/${repo}`);
  return null;
}

/**
 * Create a new GitHub repository
 */
export async function createRepository(
  core: GitHubAPICore,
  owner: string,
  input: CreateRepositoryInput,
  isOrganization: boolean,
): Promise<GitHubRepositoryCreated> {
  console.log(
    `[GitHub] Creating repository for ${isOrganization ? 'org' : 'user'}: ${owner}`,
    input,
  );

  const endpoint = isOrganization ? `/orgs/${owner}/repos` : '/user/repos';
  const apiResult = await core.makeGitHubAPICall(endpoint, {
    method: 'POST',
    body: input,
  });

  if (apiResult.success && apiResult.data) {
    const repoData = apiResult.data as GitHubRepositoryCreated;
    console.log(`[GitHub] Successfully created repository: ${repoData.full_name}`);
    return repoData;
  }

  // Fallback to CLI
  console.log('[GitHub] Attempting repository creation via gh CLI');
  try {
    const args = ['gh', 'repo', 'create'];

    if (isOrganization) {
      args.push(`${owner}/${input.name}`);
    } else {
      args.push(input.name);
    }

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

    const result = await core.executeCommand(args);

    if (result.success) {
      const repoName = isOrganization ? `${owner}/${input.name}` : input.name;
      const fetchResult = await core.executeCommand([
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
        (error instanceof Error ? error.message : 'Failed to create repository'),
    );
  }
}

/**
 * Fork a repository
 */
export async function forkRepository(
  core: GitHubAPICore,
  owner: string,
  repo: string,
  options?: {
    organization?: string;
    name?: string;
    default_branch_only?: boolean;
  },
  getCurrentUser?: () => Promise<{ login: string } | null>,
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

  const apiResult = await core.makeGitHubAPICall(endpoint, {
    method: 'POST',
    body: Object.keys(body).length > 0 ? body : undefined,
  });

  if (apiResult.success && apiResult.data) {
    const forkedRepo = apiResult.data as GitHubRepositoryCreated;
    console.log(`[GitHub] Successfully forked repository to ${forkedRepo.full_name}`);
    return forkedRepo;
  }

  // Fallback to CLI
  try {
    const args = ['gh', 'repo', 'fork', `${owner}/${repo}`, '--clone=false'];
    if (options?.organization) {
      args.push('--org', options.organization);
    }

    const result = await core.executeCommand(args);
    if (result.success && getCurrentUser) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const forkOwner = options?.organization || currentUser.login;
        const forkName = options?.name || repo;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return getRepository(core, forkOwner, forkName) as Promise<GitHubRepositoryCreated | null>;
      }
    }
  } catch (error) {
    console.error('[GitHub] Error forking repository:', error);
  }

  console.error(`[GitHub] Failed to fork repository ${owner}/${repo}`, apiResult.error);
  return null;
}

// =============================================================================
// Templates
// =============================================================================

/**
 * Get available .gitignore templates
 */
export async function getGitignoreTemplates(core: GitHubAPICore): Promise<string[]> {
  console.log('[GitHub] Fetching .gitignore templates');

  const endpoint = '/gitignore/templates';
  const apiResult = await core.makeGitHubAPICall(endpoint);

  if (apiResult.success && Array.isArray(apiResult.data)) {
    console.log(`[GitHub] Successfully fetched ${apiResult.data.length} .gitignore templates`);
    return apiResult.data;
  }

  // Fallback to CLI
  try {
    const result = await core.executeCommand(['gh', 'api', endpoint]);
    if (result.success && result.stdout) {
      const templates = JSON.parse(result.stdout);
      if (Array.isArray(templates)) {
        console.log(`[GitHub] Successfully fetched ${templates.length} .gitignore templates via CLI`);
        return templates;
      }
    }
  } catch (error) {
    console.error('[GitHub] Error getting .gitignore templates:', error);
  }

  console.warn('[GitHub] Failed to fetch .gitignore templates, returning empty array');
  return [];
}

/**
 * Get available license templates
 */
export async function getLicenseTemplates(core: GitHubAPICore): Promise<GitHubLicenseTemplate[]> {
  console.log('[GitHub] Fetching license templates');

  const endpoint = '/licenses';
  const apiResult = await core.makeGitHubAPICall(endpoint);

  if (apiResult.success && Array.isArray(apiResult.data)) {
    const licenses = (apiResult.data as RawGitHubLicenseTemplateResponse[]).map((license) => ({
      key: license.key as string,
      name: license.name as string,
      spdx_id: license.spdx_id as string,
      url: license.url as string,
    }));
    console.log(`[GitHub] Successfully fetched ${licenses.length} license templates`);
    return licenses;
  }

  // Fallback to CLI
  try {
    const result = await core.executeCommand(['gh', 'api', endpoint]);
    if (result.success && result.stdout) {
      const templates = JSON.parse(result.stdout) as RawGitHubLicenseTemplateResponse[];
      if (Array.isArray(templates)) {
        const licenses = templates.map((license) => ({
          key: license.key as string,
          name: license.name as string,
          spdx_id: license.spdx_id as string,
          url: license.url as string,
        }));
        console.log(`[GitHub] Successfully fetched ${licenses.length} license templates via CLI`);
        return licenses;
      }
    }
  } catch (error) {
    console.error('[GitHub] Error getting license templates:', error);
  }

  console.warn('[GitHub] Failed to fetch license templates, returning empty array');
  return [];
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Refresh data for a repository (clears cache)
 */
export function refreshData(core: GitHubAPICore, owner: string, repo: string): void {
  console.log(`[GitHub] Refreshing data for ${owner}/${repo}`);
  core.clearCache(`${owner}:${repo}`);
}
