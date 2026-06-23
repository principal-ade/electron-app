/**
 * GitHub Tree SHA utilities for skill version tracking
 *
 * Fetches Git tree SHAs from GitHub to track skill folder versions.
 * Used for update detection by comparing installed hash vs current hash.
 */

export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

export interface FetchTreeShaOptions {
  owner: string;
  repo: string;
  branch: string;
  skillPath: string;
  token?: string;
}

export interface FetchTreeShaResult {
  success: boolean;
  sha?: string;
  error?: string;
}

/**
 * Fetch the tree SHA for a specific skill folder in a GitHub repository
 *
 * Uses the GitHub Trees API: GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
 * Then extracts the SHA for the specific skill folder path
 */
export async function fetchSkillFolderHash(options: FetchTreeShaOptions): Promise<FetchTreeShaResult> {
  const { owner, repo, branch, skillPath, token } = options;

  // Normalize the skill path (remove leading/trailing slashes)
  const normalizedPath = skillPath.replace(/^\/+|\/+$/g, '');

  console.log(`[GitHubTreeSha] Fetching tree SHA for ${owner}/${repo}/${normalizedPath}@${branch}`);

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Principal-Desktop-App',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      // Handle rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining === '0') {
          return {
            success: false,
            error: 'GitHub API rate limit exceeded. Please try again later.',
          };
        }
      }

      // Handle private repo without auth
      if (response.status === 404) {
        return {
          success: false,
          error: 'Repository not found or requires authentication',
        };
      }

      return {
        success: false,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as GitHubTreeResponse;

    // Find the tree entry for the skill folder
    const treeEntry = data.tree.find(
      (entry) => entry.path === normalizedPath && entry.type === 'tree'
    );

    if (!treeEntry) {
      console.log(`[GitHubTreeSha] Skill folder not found in tree: ${normalizedPath}`);
      return {
        success: false,
        error: `Skill folder not found: ${normalizedPath}`,
      };
    }

    console.log(`[GitHubTreeSha] Found tree SHA: ${treeEntry.sha}`);
    return {
      success: true,
      sha: treeEntry.sha,
    };
  } catch (error) {
    console.error('[GitHubTreeSha] Error fetching tree:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching tree SHA',
    };
  }
}

/**
 * Batch fetch tree SHAs for multiple skill folders
 * More efficient than individual calls when checking updates for many skills
 */
export async function fetchMultipleSkillFolderHashes(
  options: {
    owner: string;
    repo: string;
    branch: string;
    skillPaths: string[];
    token?: string;
  }
): Promise<Map<string, FetchTreeShaResult>> {
  const { owner, repo, branch, skillPaths, token } = options;
  const results = new Map<string, FetchTreeShaResult>();

  console.log(`[GitHubTreeSha] Batch fetching ${skillPaths.length} skill folder SHAs`);

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Principal-Desktop-App',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = `GitHub API error: ${response.status} ${response.statusText}`;
      for (const skillPath of skillPaths) {
        results.set(skillPath, { success: false, error });
      }
      return results;
    }

    const data = (await response.json()) as GitHubTreeResponse;

    // Build a map of paths to SHAs for quick lookup
    const treeMap = new Map<string, string>();
    for (const entry of data.tree) {
      if (entry.type === 'tree') {
        treeMap.set(entry.path, entry.sha);
      }
    }

    // Look up each skill path
    for (const skillPath of skillPaths) {
      const normalizedPath = skillPath.replace(/^\/+|\/+$/g, '');
      const sha = treeMap.get(normalizedPath);

      if (sha) {
        results.set(skillPath, { success: true, sha });
      } else {
        results.set(skillPath, {
          success: false,
          error: `Skill folder not found: ${normalizedPath}`,
        });
      }
    }

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    for (const skillPath of skillPaths) {
      results.set(skillPath, { success: false, error: errorMessage });
    }
    return results;
  }
}

/**
 * Result of resolving a skill folder's remote tree, including per-file blob SHAs.
 */
export interface SkillTreeResult {
  success: boolean;
  /** Git tree SHA of the skill folder itself */
  folderSha?: string;
  /**
   * Map of path-relative-to-the-skill-folder -> git blob SHA for every file
   * under the folder. Undefined when the GitHub tree response was truncated,
   * in which case callers should fall back to folder-SHA comparison.
   */
  blobs?: Map<string, string>;
  error?: string;
}

/**
 * Batch fetch each skill folder's tree SHA *and* its per-file blob SHAs in a
 * single recursive Trees API call. Used to detect staleness by comparing the
 * blobs on disk against what the source currently has, rather than trusting the
 * (corruptible) recorded folder hash.
 */
export async function fetchMultipleSkillTrees(
  options: {
    owner: string;
    repo: string;
    branch: string;
    skillPaths: string[];
    token?: string;
  }
): Promise<Map<string, SkillTreeResult>> {
  const { owner, repo, branch, skillPaths, token } = options;
  const results = new Map<string, SkillTreeResult>();

  console.log(`[GitHubTreeSha] Batch fetching ${skillPaths.length} skill trees`);

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Principal-Desktop-App',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = `GitHub API error: ${response.status} ${response.statusText}`;
      for (const skillPath of skillPaths) {
        results.set(skillPath, { success: false, error });
      }
      return results;
    }

    const data = (await response.json()) as GitHubTreeResponse;

    // When the tree is truncated we cannot trust a "missing file" signal, so we
    // omit blobs and let callers fall back to folder-SHA comparison.
    const truncated = data.truncated === true;
    if (truncated) {
      console.warn('[GitHubTreeSha] Tree response truncated; blob-level check unavailable');
    }

    const folderShaByPath = new Map<string, string>();
    for (const entry of data.tree) {
      if (entry.type === 'tree') {
        folderShaByPath.set(entry.path, entry.sha);
      }
    }

    for (const skillPath of skillPaths) {
      const normalizedPath = skillPath.replace(/^\/+|\/+$/g, '');
      const folderSha = folderShaByPath.get(normalizedPath);

      if (!folderSha) {
        results.set(skillPath, {
          success: false,
          error: `Skill folder not found: ${normalizedPath}`,
        });
        continue;
      }

      if (truncated) {
        results.set(skillPath, { success: true, folderSha });
        continue;
      }

      const prefix = `${normalizedPath}/`;
      const blobs = new Map<string, string>();
      for (const entry of data.tree) {
        if (entry.type === 'blob' && entry.path.startsWith(prefix)) {
          blobs.set(entry.path.slice(prefix.length), entry.sha);
        }
      }

      results.set(skillPath, { success: true, folderSha, blobs });
    }

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    for (const skillPath of skillPaths) {
      results.set(skillPath, { success: false, error: errorMessage });
    }
    return results;
  }
}

/**
 * Compare two skill folder hashes to determine if an update is available
 */
export function hasSkillUpdate(installedHash: string, currentHash: string): boolean {
  return installedHash !== currentHash;
}

/**
 * Parse a GitHub URL to extract owner, repo, and optional path
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string; path?: string } | null {
  // Handle various GitHub URL formats
  const patterns = [
    // https://github.com/owner/repo/tree/branch/path
    /github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.+))?/,
    // https://github.com/owner/repo
    /github\.com\/([^/]+)\/([^/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        path: match[3],
      };
    }
  }

  return null;
}
