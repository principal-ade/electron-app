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
  WatchUserResponse,
  UnwatchUserResponse,
  WatchRepoResponse,
  UnwatchRepoResponse,
  GetTreeResponse,
  RepoContributionsResponse,
  StarredCollection,
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

  /**
   * Watch a GitHub user
   * @param login - GitHub username to watch
   */
  static async watchUser(login: string): Promise<WatchUserResponse> {
    return webAdeClient.watchUser({ login });
  }

  /**
   * Unwatch a GitHub user
   * @param login - GitHub username to unwatch
   */
  static async unwatchUser(login: string): Promise<UnwatchUserResponse> {
    return webAdeClient.unwatchUser({ login });
  }

  /**
   * Watch a GitHub repository
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  static async watchRepo(owner: string, repo: string): Promise<WatchRepoResponse> {
    return webAdeClient.watchRepo({ owner, repo });
  }

  /**
   * Unwatch a GitHub repository
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  static async unwatchRepo(owner: string, repo: string): Promise<UnwatchRepoResponse> {
    return webAdeClient.unwatchRepo({ owner, repo });
  }

  /**
   * Get repository file tree from GitHub via web-ade's cached endpoint
   * Uses web-ade's multi-layer caching (memory → Redis → S3 → GitHub)
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param ref - Git ref (branch, tag, or commit SHA) - defaults to 'HEAD'
   */
  static async getGithubTree(owner: string, repo: string, ref = 'HEAD'): Promise<GetTreeResponse> {
    return webAdeClient.getGithubTree({ owner, repo, ref });
  }

  /**
   * Get repository contribution calendar from GitHub via web-ade
   * Fetches commits and aggregates them by day (up to 365 days)
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  static async getRepoContributions(owner: string, repo: string): Promise<RepoContributionsResponse> {
    return webAdeClient.getRepoContributions({ owner, repo });
  }

  /**
   * Get user's starred collections from web-ade API
   * @param includeItems - Whether to include items (repos and users) in collections (default: true)
   */
  static async getStarredCollections(includeItems = true): Promise<StarredCollection[]> {
    return webAdeClient.getStarredCollections({ includeItems });
  }

  /**
   * Create a new starred collection
   */
  static async createCollection(name: string, description?: string, icon?: string): Promise<StarredCollection> {
    return webAdeClient.createCollection({ name, description, icon });
  }

  /**
   * Add a repository to a starred collection
   */
  static async addRepoToCollection(collectionId: string, owner: string, repo: string): Promise<void> {
    return webAdeClient.addRepoToCollection({ collectionId, owner, repo });
  }

  /**
   * Remove a repository from a starred collection
   */
  static async removeRepoFromCollection(collectionId: string, owner: string, repo: string): Promise<void> {
    return webAdeClient.removeRepoFromCollection({ collectionId, owner, repo });
  }

  /**
   * Get pinned repositories for a user or organization
   * @param username - GitHub username or organization login
   */
  static async getPinnedRepositories(username: string): Promise<string[]> {
    return webAdeClient.getPinnedRepositories({ username });
  }
}
