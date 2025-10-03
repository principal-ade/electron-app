/**
 * Parse a GitHub URL to extract owner and repository name
 * Supports various GitHub URL formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - git://github.com/owner/repo.git
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;

  try {
    // Remove .git suffix if present
    const cleanUrl = url.replace(/\.git$/, '');

    // Handle SSH URLs (git@github.com:owner/repo)
    const sshMatch = cleanUrl.match(/git@github\.com:([^/]+)\/(.+)/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2],
      };
    }

    // Handle HTTPS and git:// URLs
    const httpsMatch = cleanUrl.match(/(?:https?:\/\/|git:\/\/)?github\.com\/([^/]+)\/(.+)/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to parse GitHub URL:', url, error);
    return null;
  }
}
