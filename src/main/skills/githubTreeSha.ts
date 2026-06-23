/**
 * GitHub tree utilities for skill version tracking.
 *
 * Resolves a skill folder's tree SHA and per-file blob SHAs from the GitHub
 * Trees API, used to detect staleness by comparing the source's current blobs
 * against what's actually on disk.
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
