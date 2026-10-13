/**
 * TIPC Client for Web-ADE Operations
 *
 * Type-safe RPC for Web-ADE API interactions, replacing direct HTTP calls.
 * Follows the same pattern as githubClient.
 */

import { createClient } from '@egoist/tipc/renderer';
import type {
  WebAdeRouterType,
  GetTreeInput,
  GetTreeResponse,
  GetRepoContributionsInput,
  RepoContributionsResponse,
  GetUserActivityInput,
  UserActivityResponse,
  GetPinnedRepositoriesInput,
  ExplainCommitsInput,
  ExplainCommitsResponse,
  ExplainWorkingChangesInput,
  ExplainWorkingChangesResponse,
} from '../../shared/tipc/webAdeRouterTypes';

// =============================================================================
// Client Interface
// =============================================================================

/**
 * Web-ADE TIPC Client interface matching the router implementation.
 * This provides typed access to all Web-ADE operations.
 */
export interface WebAdeClient {
  // GitHub Tree API (via web-ade)
  getGithubTree: (input: GetTreeInput) => Promise<GetTreeResponse>;

  // GitHub Repository Contributions (via web-ade)
  getRepoContributions: (input: GetRepoContributionsInput) => Promise<RepoContributionsResponse>;

  // User Activity
  getUserActivity: (input: GetUserActivityInput) => Promise<UserActivityResponse>;

  // Pinned Repositories
  getPinnedRepositories: (input: GetPinnedRepositoriesInput) => Promise<string[]>;

  // AI Explain Commits
  explainCommits: (input: ExplainCommitsInput) => Promise<ExplainCommitsResponse>;
  explainWorkingChanges: (
    input: ExplainWorkingChangesInput,
  ) => Promise<ExplainWorkingChangesResponse>;

}

// =============================================================================
// Lazy-initialized Client
// =============================================================================

/**
 * Lazy-initialized TIPC client for Web-ADE operations.
 * We use lazy initialization because window.electron is injected by the preload
 * script and isn't available at module load time.
 */
let _webAdeClient: WebAdeClient | null = null;

function getWebAdeClient(): WebAdeClient {
  if (!_webAdeClient) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error(
        'WebADE client not available - window.electron not initialized',
      );
    }
    _webAdeClient = createClient<WebAdeRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as WebAdeClient;
  }
  return _webAdeClient;
}

// =============================================================================
// Exported Proxy Client
// =============================================================================

/**
 * Web-ADE TIPC client instance.
 * This is a Proxy that lazily accesses the actual client on first use.
 */
export const webAdeClient: WebAdeClient = new Proxy({} as WebAdeClient, {
  get(_target, prop: keyof WebAdeClient) {
    const client = getWebAdeClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// =============================================================================
// Re-export Types for Convenience
// =============================================================================

export type {
  CommitActivityCard,
  CommitInfo,
  CommitAuthor,
  GetTreeInput,
  GetTreeResponse,
  TreeEntry,
  GetRepoContributionsInput,
  RepoContributionsResponse,
  DailyContribution,
  GetUserActivityInput,
  UserActivityResponse,
  GetPinnedRepositoriesInput,
  ExplainCommitsInput,
  ExplainCommitsResponse,
  ExplainCommitData,
} from '../../shared/tipc/webAdeRouterTypes';
