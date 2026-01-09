import { GithubService } from '../../../main-process-api/GithubService';

/**
 * GitHubFileSystemAdapter - Adapter to read files from GitHub repositories
 *
 * Implements the same interface as the local FileSystem adapter but fetches
 * content from GitHub API instead of reading local files.
 */
export class GitHubFileSystemAdapter {
  private owner: string;
  private repo: string;
  private branch: string;

  constructor(owner: string, repo: string, branch: string = 'main') {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
  }

  /**
   * Read file content from GitHub
   * @param path - Can be either:
   *   - "owner/repo/path/to/file.md" (full GitHub path)
   *   - "path/to/file.md" (relative path)
   */
  async readFile(path: string): Promise<string> {
    try {
      // Strip owner/repo prefix if present
      let relativePath = path;
      const prefix = `${this.owner}/${this.repo}/`;
      if (path.startsWith(prefix)) {
        relativePath = path.substring(prefix.length);
      }

      console.log('[GitHubFileSystemAdapter] Reading file:', {
        originalPath: path,
        relativePath,
        owner: this.owner,
        repo: this.repo,
        branch: this.branch,
      });

      // Fetch from GitHub API
      const content = await GithubService.getFileContent(
        this.owner,
        this.repo,
        relativePath,
        this.branch,
      );

      if (content === null) {
        throw new Error(`Failed to fetch file: ${relativePath}`);
      }

      console.log('[GitHubFileSystemAdapter] Successfully read file:', {
        path: relativePath,
        contentLength: content.length,
      });

      return content;
    } catch (error) {
      console.error(`[GitHubFileSystemAdapter] Failed to read ${path}:`, error);
      throw error;
    }
  }

  /**
   * Update the repository being accessed
   */
  setRepository(owner: string, repo: string, branch: string = 'main') {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
  }

  /**
   * Get current repository info
   */
  getRepositoryInfo() {
    return {
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
    };
  }
}
