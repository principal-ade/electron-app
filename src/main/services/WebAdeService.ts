/**
 * Web-ADE Service
 *
 * Backend service for making HTTP requests to the Principal Web-ADE API.
 * Handles authentication using the same GitHub token from AuthService.
 */

import fetch from 'node-fetch';
import { authService } from './AuthService';
import { requireHostedFeature } from './FeatureAvailabilityService';
import type {
  GetTreeInput,
  GetTreeResponse,
  GetRepoContributionsInput,
  RepoContributionsResponse,
  StarredCollection,
  OwnerStarredCollectionsResponse,
  GetUserActivityInput,
  UserActivityResponse,
  ExplainCommitsInput,
  ExplainCommitsResponse,
  ExplainWorkingChangesInput,
  ExplainWorkingChangesResponse,
} from '../../shared/tipc/webAdeRouterTypes';

/**
 * Web-ADE API client service.
 * Makes authenticated requests to the web-ade API endpoints.
 */
export class WebAdeService {
  private baseUrl: string;

  constructor() {
    // Use environment variable or default to production
    this.baseUrl = process.env.WEB_ADE_API_URL || 'https://app.principal-ade.com/api';
    console.log('[WebADE] Initialized with base URL:', this.baseUrl);
  }

  /**
   * Check if user is authenticated (has a valid GitHub token)
   */
  async isAuthenticated(): Promise<boolean> {
    await requireHostedFeature('signIn');
    try {
      const token = await this.getToken();
      return token !== null;
    } catch (error) {
      console.error('[WebADE] Failed to check authentication:', error);
      return false;
    }
  }

  /**
   * Get GitHub token from AuthService
   * Web-ADE API accepts the same GitHub OAuth token
   */
  private async getToken(): Promise<string | null> {
    try {
      // Reuse the GitHub token from AuthService
      const token = await authService.getValidToken();
      return token;
    } catch (error) {
      console.error('[WebADE] Failed to get token:', error);
      return null;
    }
  }

  /**
   * Get repository file tree from GitHub via web-ade's cached endpoint
   * Uses web-ade's multi-layer caching (memory → Redis → S3 → GitHub)
   */
  async getGithubTree(input: GetTreeInput): Promise<GetTreeResponse> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    // Encode input for tRPC URL format
    // Note: GitHub router doesn't use the { json: {...} } wrapper like feed endpoints
    const params = encodeURIComponent(JSON.stringify({
      owner: input.owner,
      repo: input.repo,
      ref: input.ref || 'HEAD'
    }));
    const url = `${this.baseUrl}/trpc/github.getTree?input=${params}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tree: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: { data?: GetTreeResponse } };
      const tree = data?.result?.data;

      if (!tree || !tree.tree) {
        console.warn('[WebADE] Unexpected response format:', data);
        throw new Error('Invalid tree response from web-ade');
      }

      return tree;
    } catch (error) {
      console.error('[WebADE] Failed to fetch tree:', error);
      throw error;
    }
  }

  /**
   * Get repository contribution calendar from GitHub via web-ade
   * Fetches commits and aggregates them by day
   */
  async getRepoContributions(input: GetRepoContributionsInput): Promise<RepoContributionsResponse> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/github/repo/${input.owner}/${input.repo}/contributions`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch repository contributions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as RepoContributionsResponse;

      if (!data || !data.contributions) {
        console.warn('[WebADE] Unexpected response format:', data);
        throw new Error('Invalid contributions response from web-ade');
      }

      return data;
    } catch (error) {
      console.error('[WebADE] Failed to fetch repository contributions:', error);
      throw error;
    }
  }

  /**
   * Get user's starred collections from web-ade API
   * Returns collections with optional items (repos and users)
   */
  async getStarredCollections(includeItems: boolean = true): Promise<StarredCollection[]> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/starred-collections${includeItems ? '?include_items=true' : ''}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        throw new Error(`Failed to fetch starred collections: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { collections?: StarredCollection[] };

      if (!Array.isArray(data?.collections)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return [];
      }

      return data.collections;
    } catch (error) {
      console.error('[WebADE] Failed to fetch starred collections:', error);
      throw error;
    }
  }

  /**
   * Get the public starred collections owned by a specific GitHub user or org.
   * Backed by GET /api/github/owner/[owner]/starred-collections — public endpoint.
   */
  async getOwnerStarredCollections(
    owner: string,
    includeItems = true,
  ): Promise<OwnerStarredCollectionsResponse> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    const params = includeItems ? '' : '?include_items=false';
    const url = `${this.baseUrl}/github/owner/${encodeURIComponent(owner)}/starred-collections${params}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Owner "${owner}" not found`);
        }
        throw new Error(
          `Failed to fetch collections for ${owner}: ${response.status} ${response.statusText}`,
        );
      }
      return (await response.json()) as OwnerStarredCollectionsResponse;
    } catch (error) {
      console.error(`[WebADE] Failed to fetch starred collections for ${owner}:`, error);
      throw error;
    }
  }

  /**
   * Create a new starred collection
   */
  async createCollection(name: string, description?: string, icon?: string): Promise<StarredCollection> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/starred-collections`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description, icon }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        if (response.status === 409) {
          throw new Error('A collection with this name already exists');
        }
        throw new Error(`Failed to create collection: ${response.status} ${response.statusText}`);
      }

      return await response.json() as StarredCollection;
    } catch (error) {
      console.error('[WebADE] Failed to create collection:', error);
      throw error;
    }
  }

  /**
   * Add a repository to a starred collection
   */
  async addRepoToCollection(collectionId: string, owner: string, repo: string): Promise<void> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/starred-collections/${collectionId}/repos`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, repo }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        if (response.status === 404) {
          throw new Error('Collection not found');
        }
        if (response.status === 409) {
          return; // Already in collection, treat as success
        }
        throw new Error(`Failed to add repository to collection: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('[WebADE] Failed to add repo to collection:', error);
      throw error;
    }
  }

  /**
   * Remove a repository from a starred collection
   */
  async removeRepoFromCollection(collectionId: string, owner: string, repo: string): Promise<void> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/starred-collections/${collectionId}/repos/${owner}/${repo}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        if (response.status === 404) {
          return; // Not in collection, treat as success
        }
        throw new Error(`Failed to remove repository from collection: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('[WebADE] Failed to remove repo from collection:', error);
      throw error;
    }
  }

  /**
   * Get pinned repositories for a user or organization
   * Returns array of "owner/repo" strings
   */
  async getPinnedRepositories(username: string): Promise<string[]> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/github/user/${username}/pinned`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        throw new Error(`Failed to fetch pinned repositories: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { pinnedRepos?: string[] };
      return data.pinnedRepos || [];
    } catch (error) {
      console.error('[WebADE] Failed to fetch pinned repositories:', error);
      throw error;
    }
  }

  /**
   * Get user activity (recent commits and contribution heatmap)
   * Fetches recent commit activity and contribution calendar for a GitHub user
   */
  async getUserActivity(input: GetUserActivityInput): Promise<UserActivityResponse> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const { username, contributionDays = 365, activityDays = 1 } = input;
    const url = `${this.baseUrl}/github/user/${username}/activity?contributionDays=${contributionDays}&activityDays=${activityDays}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error(`Failed to fetch user activity: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as UserActivityResponse;

      if (!data || !data.user || !Array.isArray(data.recentCommits) || !Array.isArray(data.contributions)) {
        console.warn('[WebADE] Unexpected response format:', data);
        throw new Error('Invalid user activity response from web-ade');
      }

      return data;
    } catch (error) {
      console.error('[WebADE] Failed to fetch user activity:', error);
      throw error;
    }
  }

  async explainCommits(input: ExplainCommitsInput): Promise<ExplainCommitsResponse> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    return this.postSseExplain('/api/explain-commits', input, 'explain-commits');
  }

  async explainWorkingChanges(
    input: ExplainWorkingChangesInput,
  ): Promise<ExplainWorkingChangesResponse> {
    await requireHostedFeature('repositoryInsightsAndCollections');
    return this.postSseExplain(
      '/api/explain-working-changes',
      input,
      'explain-working-changes',
    );
  }

  private async postSseExplain<T>(
    path: string,
    input: T,
    label: string,
  ): Promise<{ text: string }> {
    const token = await this.getToken();

    const apiBase = this.baseUrl.endsWith('/api')
      ? this.baseUrl.slice(0, -4)
      : this.baseUrl;
    const url = `${apiBase}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`${label} failed: ${response.status}`);
    }

    const raw = await response.text();
    let text = '';
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6)) as { type: string; content?: string };
        if (event.type === 'text' && event.content) {
          text += event.content;
        }
      } catch {
        // ignore malformed SSE lines
      }
    }

    return { text };
  }

}
