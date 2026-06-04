/**
 * Web-ADE Service
 *
 * Backend service for making HTTP requests to the Principal Web-ADE API.
 * Handles authentication using the same GitHub token from AuthService.
 */

import fetch from 'node-fetch';
import { authService } from './AuthService';
import type {
  CommitActivityCard,
  FeedWatches,
  ActivityHeatmapResponse,
  GetActivityHeatmapInput,
  WatchUserResponse,
  UnwatchUserResponse,
  WatchRepoResponse,
  UnwatchRepoResponse,
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
  ListRecentlyVisitedTrailsResponse,
  GetInboxInput,
  ListInboxResponse,
  InboxUnreadCountResponse,
  SendTrailInput,
  SendTrailResponse,
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
   * Fetch commit queue from web-ade API
   * Returns watched activity cards grouped by repo + hour
   */
  async getCommitQueue(limit: number): Promise<CommitActivityCard[]> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    // Encode input for tRPC URL format
    const input = encodeURIComponent(JSON.stringify({ json: { limit } }));
    const url = `${this.baseUrl}/trpc/feed.getCommitQueue?input=${input}`;

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
        throw new Error(`Failed to fetch commit queue: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: { data?: { cards: CommitActivityCard[], hasMore: boolean } } };

      // tRPC response format: { result: { data: { cards, hasMore } } }
      const result = data?.result?.data;
      const cards = result?.cards;

      if (!Array.isArray(cards)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return [];
      }

      return cards;
    } catch (error) {
      console.error('[WebADE] Failed to fetch commit queue:', error);
      throw error;
    }
  }

  /**
   * Fetch watched items (users and repos) from web-ade API
   */
  async getWatches(): Promise<FeedWatches> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/trpc/feed.getWatches`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch watches: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: { data?: FeedWatches } };
      const watches = data?.result?.data;

      if (!watches || !('watchedUsers' in watches) || !('watchedRepos' in watches)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return { watchedUsers: [], watchedRepos: [] };
      }

      return watches;
    } catch (error) {
      console.error('[WebADE] Failed to fetch watches:', error);
      throw error;
    }
  }

  /**
   * Fetch activity heatmap from web-ade API
   * Returns commits, authors, and repos for a time range
   */
  async getActivityHeatmap(options: GetActivityHeatmapInput): Promise<ActivityHeatmapResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    // Encode input for tRPC URL format
    const input = encodeURIComponent(JSON.stringify({ json: options }));
    const url = `${this.baseUrl}/trpc/feed.getActivityHeatmap?input=${input}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch activity heatmap: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: { data?: ActivityHeatmapResponse } };
      const heatmap = data?.result?.data;

      if (!heatmap || !('commits' in heatmap)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return {
          commits: [],
          authors: [],
          repos: [],
          timeRange: {
            start: new Date(Date.now() - options.hoursBack * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        };
      }

      return heatmap;
    } catch (error) {
      console.error('[WebADE] Failed to fetch activity heatmap:', error);
      throw error;
    }
  }

  /**
   * Watch a GitHub user
   * Adds user to watched list for activity feed
   */
  async watchUser(login: string, type?: 'User' | 'Organization'): Promise<WatchUserResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/trpc/feed.watchUser`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login, ...(type && { type }) }),
      });

      if (!response.ok) {
        throw new Error(`Failed to watch user: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: { data?: FeedWatches } };
      const watches = data?.result?.data;

      if (!watches || !('watchedUsers' in watches)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return { success: false, watchedUsers: [] };
      }

      return { success: true, watchedUsers: watches.watchedUsers };
    } catch (error) {
      console.error('[WebADE] Failed to watch user:', error);
      throw error;
    }
  }

  /**
   * Unwatch a GitHub user
   * Removes user from watched list
   */
  async unwatchUser(login: string): Promise<UnwatchUserResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/trpc/feed.unwatchUser`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login }),
      });

      if (!response.ok) {
        throw new Error(`Failed to unwatch user: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: { data?: FeedWatches } };
      const watches = data?.result?.data;

      if (!watches || !('watchedUsers' in watches)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return { success: false, watchedUsers: [] };
      }

      return { success: true, watchedUsers: watches.watchedUsers };
    } catch (error) {
      console.error('[WebADE] Failed to unwatch user:', error);
      throw error;
    }
  }

  /**
   * Watch a GitHub repository
   * Adds repo to watched list for activity feed
   */
  async watchRepo(owner: string, repo: string): Promise<WatchRepoResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/trpc/feed.watchRepo`;

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
        throw new Error(`Failed to watch repo: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: { data?: FeedWatches } };
      const watches = data?.result?.data;

      if (!watches || !('watchedRepos' in watches)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return { success: false, watchedRepos: [] };
      }

      return { success: true, watchedRepos: watches.watchedRepos };
    } catch (error) {
      console.error('[WebADE] Failed to watch repo:', error);
      throw error;
    }
  }

  /**
   * Unwatch a GitHub repository
   * Removes repo from watched list
   */
  async unwatchRepo(owner: string, repo: string): Promise<UnwatchRepoResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/trpc/feed.unwatchRepo`;

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
        throw new Error(`Failed to unwatch repo: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { result?: { data?: FeedWatches } };
      const watches = data?.result?.data;

      if (!watches || !('watchedRepos' in watches)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return { success: false, watchedRepos: [] };
      }

      return { success: true, watchedRepos: watches.watchedRepos };
    } catch (error) {
      console.error('[WebADE] Failed to unwatch repo:', error);
      throw error;
    }
  }

  /**
   * Get repository file tree from GitHub via web-ade's cached endpoint
   * Uses web-ade's multi-layer caching (memory → Redis → S3 → GitHub)
   */
  async getGithubTree(input: GetTreeInput): Promise<GetTreeResponse> {
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
    return this.postSseExplain('/api/explain-commits', input, 'explain-commits');
  }

  async explainWorkingChanges(
    input: ExplainWorkingChangesInput,
  ): Promise<ExplainWorkingChangesResponse> {
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

  /**
   * Fetch the signed-in user's "recently visited" trails.
   * The web-ade route keys on the numeric GitHub id (not the token), so we
   * resolve it from AuthService. Returns empty if we can't (signed out / no id).
   */
  async getRecentlyVisitedTrails(): Promise<ListRecentlyVisitedTrailsResponse> {
    const token = await this.getToken();
    const user = await authService.getCurrentUser();
    const githubId = user?.id;
    if (!githubId) {
      // Not signed in, or the stored auth predates id capture.
      return { entries: [] };
    }

    const url = `${this.baseUrl}/trails/recently-visited/by-user/${githubId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch recently-visited trails: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as Partial<ListRecentlyVisitedTrailsResponse>;
      return { entries: Array.isArray(data?.entries) ? data.entries : [] };
    } catch (error) {
      console.error('[WebADE] Failed to fetch recently-visited trails:', error);
      throw error;
    }
  }

  /**
   * Fetch the signed-in user's trail inbox (shared trails sent to them).
   * Auth'd by the GitHub token; the server resolves the recipient.
   */
  async getInbox(input: GetInboxInput = {}): Promise<ListInboxResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const params = new URLSearchParams();
    if (input.limit != null) params.set('limit', String(input.limit));
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.unreadOnly) params.set('unreadOnly', 'true');
    const query = params.toString();
    const url = `${this.baseUrl}/trails/inbox${query ? `?${query}` : ''}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        throw new Error(`Failed to fetch inbox: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as Partial<ListInboxResponse>;
      return {
        entries: Array.isArray(data?.entries) ? data.entries : [],
        unreadCount: typeof data?.unreadCount === 'number' ? data.unreadCount : 0,
        ...(data?.cursor ? { cursor: data.cursor } : {}),
      };
    } catch (error) {
      console.error('[WebADE] Failed to fetch inbox:', error);
      throw error;
    }
  }

  /**
   * Fetch just the unread inbox count — cheap badge poll.
   */
  async getInboxUnreadCount(): Promise<InboxUnreadCountResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/trails/inbox/unread-count`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        throw new Error(
          `Failed to fetch inbox unread count: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as Partial<InboxUnreadCountResponse>;
      return { count: typeof data?.count === 'number' ? data.count : 0 };
    } catch (error) {
      console.error('[WebADE] Failed to fetch inbox unread count:', error);
      throw error;
    }
  }

  /**
   * Send a shared trail to one or more GitHub-login recipients. Auth'd by
   * the GitHub token; the server resolves owner/repo from the share id and
   * gates on the sender's repo read access. Partial delivery is non-fatal —
   * unknown/invalid logins come back in `failed[]`.
   */
  async sendTrail(input: SendTrailInput): Promise<SendTrailResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated - no GitHub token available');
    }

    const url = `${this.baseUrl}/trails/by-id/${encodeURIComponent(input.shareId)}/send`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: input.recipients,
          ...(input.comment ? { comment: input.comment } : {}),
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - token may be invalid or expired');
        }
        let detail = `${response.status} ${response.statusText}`;
        try {
          const err = (await response.json()) as { error?: string };
          if (err?.error) detail = err.error;
        } catch {
          // Non-JSON error body — keep the status line.
        }
        throw new Error(`Failed to send trail: ${detail}`);
      }

      const data = (await response.json()) as Partial<SendTrailResponse>;
      return {
        delivered: Array.isArray(data?.delivered) ? data.delivered : [],
        failed: Array.isArray(data?.failed) ? data.failed : [],
      };
    } catch (error) {
      console.error('[WebADE] Failed to send trail:', error);
      throw error;
    }
  }
}
