/**
 * Web-ADE Service (Renderer)
 *
 * High-level service wrapper for Web-ADE API operations.
 * Follows the same pattern as GithubService.
 */

import { webAdeClient } from '../tipc/webAdeClient';
import type {
  CommitActivityCard,
  FeedWatches,
  ActivityHeatmapResponse,
} from '../../shared/tipc/webAdeRouterTypes';

/**
 * Web-ADE service for renderer process.
 * Provides high-level methods for accessing watched activity data.
 */
export class WebAdeService {
  /**
   * Check if user is authenticated (has valid GitHub token)
   */
  static async isAuthenticated(): Promise<boolean> {
    return webAdeClient.isAuthenticated();
  }

  /**
   * Get commit queue from watched repositories
   * @param limit - Maximum number of commit activity cards to return (default: 50)
   */
  static async getCommitQueue(limit = 50): Promise<CommitActivityCard[]> {
    return webAdeClient.getCommitQueue({ limit });
  }

  /**
   * Get user's watched users and repositories
   */
  static async getWatches(): Promise<FeedWatches> {
    return webAdeClient.getWatches();
  }

  /**
   * Get activity heatmap for watched items
   * @param hoursBack - Number of hours to look back (default: 24)
   * @param options - Optional filters for authors and repos
   */
  static async getActivityHeatmap(
    hoursBack = 24,
    options?: {
      authorLogins?: string[];
      repoIds?: string[];
    }
  ): Promise<ActivityHeatmapResponse> {
    return webAdeClient.getActivityHeatmap({
      hoursBack,
      ...options,
    });
  }
}
