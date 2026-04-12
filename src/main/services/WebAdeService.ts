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
  async watchUser(login: string): Promise<WatchUserResponse> {
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
        body: JSON.stringify({ login }),
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
}
