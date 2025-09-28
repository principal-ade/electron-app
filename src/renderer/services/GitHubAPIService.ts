/**
 * GitHubAPIService - Service for fetching GitHub token permissions and organization access
 *
 * This service provides methods to query GitHub's API for:
 * - Token scopes/permissions
 * - User's organization memberships
 * - Repository access counts
 */

export interface GitHubOrganization {
  login: string;
  id: number;
  node_id: string;
  url: string;
  avatar_url: string;
  description: string | null;
  name: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  public_repos?: number;
  public_gists?: number;
  followers?: number;
  following?: number;
  created_at: string;
  updated_at: string;
  type?: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  private_repos?: number;
  total_private_repos?: number;
  owned_private_repos?: number;
  collaborators?: number;
  two_factor_authentication?: boolean;
}

export interface TokenInfo {
  scopes: string[];
  organizations: GitHubOrganization[];
  user: GitHubUser;
  rateLimit: {
    limit: number;
    remaining: number;
    reset: Date;
  };
}

// Mapping of GitHub scopes to human-readable descriptions
export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  // Repository scopes
  'repo': 'Full control of private repositories',
  'repo:status': 'Access commit status',
  'repo_deployment': 'Access deployment status',
  'public_repo': 'Access public repositories',
  'repo:invite': 'Access repository invitations',
  'security_events': 'Read and write security events',
  'delete_repo': 'Delete repositories',

  // Workflow scope
  'workflow': 'Update GitHub Actions workflows',

  // Package scopes
  'write:packages': 'Upload packages to GitHub Package Registry',
  'read:packages': 'Download packages from GitHub Package Registry',
  'delete:packages': 'Delete packages from GitHub Package Registry',

  // Organization scopes
  'admin:org': 'Full control of organizations',
  'write:org': 'Read and write organization data',
  'read:org': 'Read organization data',
  'manage_runners:org': 'Manage organization runners',

  // User scopes
  'user': 'Update all user data',
  'read:user': 'Read all user profile data',
  'user:email': 'Access user email addresses',
  'user:follow': 'Follow and unfollow users',

  // GPG key scopes
  'admin:gpg_key': 'Full control of user GPG keys',
  'write:gpg_key': 'Write user GPG keys',
  'read:gpg_key': 'Read user GPG keys',

  // SSH key scopes
  'admin:ssh_signing_key': 'Full control of user SSH signing keys',
  'write:ssh_signing_key': 'Write user SSH signing keys',
  'read:ssh_signing_key': 'Read user SSH signing keys',

  // Gist scope
  'gist': 'Create gists',

  // Notifications scope
  'notifications': 'Access notifications',

  // Project scopes
  'admin:project': 'Full control of projects',
  'read:project': 'Read projects',
  'write:project': 'Write projects',

  // Discussion scopes
  'read:discussion': 'Read discussions',
  'write:discussion': 'Write discussions',
};

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

export class GitHubAPIService {
  private token: string;
  private baseUrl = 'https://api.github.com';
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Get token scopes from GitHub API
   * GitHub returns scopes in the X-OAuth-Scopes header
   */
  async getTokenScopes(): Promise<string[]> {
    const cacheKey = 'token_scopes';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const scopesHeader = response.headers.get('X-OAuth-Scopes');
      const scopes = scopesHeader ? scopesHeader.split(', ').filter(s => s.length > 0) : [];

      this.setCache(cacheKey, scopes);
      return scopes;
    } catch (error) {
      console.error('Failed to get token scopes:', error);
      return [];
    }
  }

  /**
   * Get user's organization memberships
   */
  async getUserOrganizations(): Promise<GitHubOrganization[]> {
    const cacheKey = 'user_organizations';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/user/orgs`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const orgs: GitHubOrganization[] = await response.json();

      // Fetch additional details for each org if we have read:org scope
      const detailedOrgs = await Promise.all(
        orgs.map(async (org) => {
          try {
            const detailResponse = await fetch(`${this.baseUrl}/orgs/${org.login}`, {
              headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            });

            if (detailResponse.ok) {
              return await detailResponse.json();
            }
          } catch (error) {
            console.warn(`Failed to fetch details for org ${org.login}:`, error);
          }
          return org;
        })
      );

      this.setCache(cacheKey, detailedOrgs);
      return detailedOrgs;
    } catch (error) {
      console.error('Failed to get user organizations:', error);
      return [];
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    const cacheKey = 'current_user';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const user: GitHubUser = await response.json();
      this.setCache(cacheKey, user);

      // Also store rate limit info
      this.updateRateLimit(response);

      return user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Get count of accessible repositories for an organization
   */
  async getRepositoryCount(org?: string): Promise<number> {
    try {
      const url = org
        ? `${this.baseUrl}/orgs/${org}/repos?per_page=1`
        : `${this.baseUrl}/user/repos?per_page=1`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        return 0;
      }

      // Parse the Link header to get total count
      const linkHeader = response.headers.get('Link');
      if (!linkHeader) {
        // If no Link header, there's only one page
        const data = await response.json();
        return Array.isArray(data) ? data.length : 0;
      }

      // Extract the last page number from Link header
      const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      if (lastPageMatch) {
        // Last page number gives us an approximation of total repos
        return parseInt(lastPageMatch[1], 10);
      }

      return 0;
    } catch (error) {
      console.error(`Failed to get repository count for ${org || 'user'}:`, error);
      return 0;
    }
  }

  /**
   * Get all token information in one call
   */
  async getTokenInfo(): Promise<TokenInfo | null> {
    try {
      // Fetch all data in parallel
      const [user, scopes, organizations] = await Promise.all([
        this.getCurrentUser(),
        this.getTokenScopes(),
        this.getUserOrganizations()
      ]);

      if (!user) {
        return null;
      }

      // Get rate limit from cache (was set by getCurrentUser)
      const rateLimit = this.getRateLimit();

      return {
        scopes,
        organizations,
        user,
        rateLimit
      };
    } catch (error) {
      console.error('Failed to get token info:', error);
      return null;
    }
  }

  /**
   * Format scope for display
   */
  static formatScope(scope: string): string {
    return SCOPE_DESCRIPTIONS[scope] || scope;
  }

  /**
   * Check if token has a specific scope
   */
  async hasScope(scope: string): Promise<boolean> {
    const scopes = await this.getTokenScopes();
    return scopes.includes(scope);
  }

  // Cache management
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.cacheTimeout;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    // Type assertion is safe here because we control both setCache and getFromCache
    // and each cache key corresponds to a specific data type
    return cached.data as T;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private updateRateLimit(response: Response): void {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      this.setCache('rate_limit', {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: new Date(parseInt(reset, 10) * 1000)
      });
    }
  }

  private getRateLimit(): TokenInfo['rateLimit'] {
    const cached = this.getFromCache('rate_limit');
    return cached || {
      limit: 5000,
      remaining: 5000,
      reset: new Date()
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}