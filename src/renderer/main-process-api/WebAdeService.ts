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
  OwnerStarredCollectionsResponse,
  ExplainCommitsInput,
  ExplainCommitsResponse,
  ExplainWorkingChangesInput,
  ExplainWorkingChangesResponse,
  ListRecentlyVisitedTrailsResponse,
  GetInboxInput,
  ListInboxResponse,
  InboxUnreadCountResponse,
  DeleteInboxEntryInput,
  MarkInboxEntryReadInput,
  MarkInboxEntryReadResponse,
  SendTrailInput,
  SendTrailResponse,
  GetSentInput,
  ListSentResponse,
  GetTopicInboxInput,
  ListTopicInboxResponse,
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
  static async watchUser(login: string, type?: 'User' | 'Organization'): Promise<WatchUserResponse> {
    return webAdeClient.watchUser({ login, type });
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

  /**
   * Get the signed-in user's recently visited trails (newest first).
   */
  static async getRecentlyVisitedTrails(): Promise<ListRecentlyVisitedTrailsResponse> {
    return webAdeClient.getRecentlyVisitedTrails();
  }

  /**
   * Get the signed-in user's trail inbox (shared trails sent to them).
   */
  static async getInbox(input: GetInboxInput = {}): Promise<ListInboxResponse> {
    return webAdeClient.getInbox(input);
  }

  /**
   * Get just the unread inbox count.
   */
  static async getInboxUnreadCount(): Promise<InboxUnreadCountResponse> {
    return webAdeClient.getInboxUnreadCount();
  }

  /**
   * Remove one delivered trail from the signed-in user's inbox. Deletes only
   * the inbox row, not the underlying trail.
   */
  static async deleteInboxEntry(input: DeleteInboxEntryInput): Promise<void> {
    return webAdeClient.deleteInboxEntry(input);
  }

  /**
   * Mark one delivered trail in the signed-in user's inbox as read. Clears the
   * attention dot / "(N new)" badge server-side by stamping `readAt` and
   * advancing the notes watermark. Idempotent.
   */
  static async markInboxEntryRead(
    input: MarkInboxEntryReadInput,
  ): Promise<MarkInboxEntryReadResponse> {
    return webAdeClient.markInboxEntryRead(input);
  }

  /**
   * Send a shared trail to one or more GitHub-login recipients.
   * `shareId` is the web-ade share id (parsed from the share URL).
   */
  static async sendTrail(input: SendTrailInput): Promise<SendTrailResponse> {
    return webAdeClient.sendTrail(input);
  }

  /**
   * Get the signed-in user's sent trails (the outbox).
   */
  static async getSent(input: GetSentInput = {}): Promise<ListSentResponse> {
    return webAdeClient.getSent(input);
  }

  /**
   * Get the signed-in user's topic inbox (topics sent to them).
   */
  static async getTopicInbox(
    input: GetTopicInboxInput = {},
  ): Promise<ListTopicInboxResponse> {
    return webAdeClient.getTopicInbox(input);
  }

  /**
   * Get just the unread topic-inbox count.
   */
  static async getTopicInboxUnreadCount(): Promise<InboxUnreadCountResponse> {
    return webAdeClient.getTopicInboxUnreadCount();
  }
}
