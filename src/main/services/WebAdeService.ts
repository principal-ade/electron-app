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
    console.log('[WebADE] Fetching commit queue with limit:', limit);

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

      const data = await response.json() as { result?: { data?: { json?: CommitActivityCard[] } } };

      // tRPC response format: { result: { data: { json: actualData } } }
      const cards = data?.result?.data?.json;

      if (!Array.isArray(cards)) {
        console.warn('[WebADE] Unexpected response format:', data);
        return [];
      }

      console.log('[WebADE] Fetched', cards.length, 'commit activity cards');
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
    console.log('[WebADE] Fetching watched items');

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

      const data = await response.json() as { result?: { data?: { json?: FeedWatches } } };
      const watches = data?.result?.data?.json;

      if (!watches || typeof watches !== 'object') {
        console.warn('[WebADE] Unexpected response format:', data);
        return { watchedUsers: [], watchedRepos: [] };
      }

      console.log('[WebADE] Fetched watches:', {
        users: watches.watchedUsers?.length || 0,
        repos: watches.watchedRepos?.length || 0,
      });

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
    console.log('[WebADE] Fetching activity heatmap with options:', options);

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

      const data = await response.json() as { result?: { data?: { json?: ActivityHeatmapResponse } } };
      const heatmap = data?.result?.data?.json;

      if (!heatmap || typeof heatmap !== 'object') {
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

      console.log('[WebADE] Fetched activity heatmap:', {
        commits: heatmap.commits?.length || 0,
        authors: heatmap.authors?.length || 0,
        repos: heatmap.repos?.length || 0,
      });

      return heatmap;
    } catch (error) {
      console.error('[WebADE] Failed to fetch activity heatmap:', error);
      throw error;
    }
  }
}
