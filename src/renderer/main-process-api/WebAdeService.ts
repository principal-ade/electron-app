/**
 * Web-ADE Service (Renderer)
 *
 * High-level service wrapper for Web-ADE API operations.
 * Follows the same pattern as GithubService.
 */

import { webAdeClient } from '../tipc/webAdeClient';
import type {
  GetTreeResponse,
  RepoContributionsResponse,
  StarredCollection,
  OwnerStarredCollectionsResponse,
  ExplainCommitsInput,
  ExplainCommitsResponse,
  ExplainWorkingChangesInput,
  ExplainWorkingChangesResponse,
} from '../../shared/tipc/webAdeRouterTypes';

/**
 * Web-ADE service for renderer process.
 * Provides high-level methods for web-ade API operations.
 */
export class WebAdeService {
  /**
   * Check if user is authenticated (has valid GitHub token)
   */
  static async isAuthenticated(): Promise<boolean> {
    return webAdeClient.isAuthenticated();
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
   * Get the public starred collections owned by a specific GitHub user or org.
   * @param owner - GitHub login of the user or organization
   * @param includeItems - Whether to include items (repos and users) in collections (default: true)
   */
  static async getOwnerStarredCollections(
    owner: string,
    includeItems = true,
  ): Promise<OwnerStarredCollectionsResponse> {
    return webAdeClient.getOwnerStarredCollections({ owner, includeItems });
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

  static async explainCommits(input: ExplainCommitsInput): Promise<ExplainCommitsResponse> {
    return webAdeClient.explainCommits(input);
  }

  static async explainWorkingChanges(
    input: ExplainWorkingChangesInput,
  ): Promise<ExplainWorkingChangesResponse> {
    return webAdeClient.explainWorkingChanges(input);
  }

}
