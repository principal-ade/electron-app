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
  UserActivityResponse,
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
   * Get user activity (recent commits + contribution heatmap) for a GitHub user.
   * @param username - GitHub username
   * @param contributionDays - Days of contribution heatmap data (default: 365)
   * @param activityDays - Days of recent commit activity (default: 1)
   */
  static async getUserActivity(
    username: string,
    contributionDays = 365,
    activityDays = 1,
  ): Promise<UserActivityResponse> {
    return webAdeClient.getUserActivity({ username, contributionDays, activityDays });
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
