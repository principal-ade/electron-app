export enum RecentReposAPIEvent {
  GET_RECENT_REPOS = 'recent-repos:get-recent-repos',
  ADD_RECENT_REPO = 'recent-repos:add-recent-repo',
  REMOVE_RECENT_REPO = 'recent-repos:remove-recent-repo',
  CLEAR_RECENT_REPOS = 'recent-repos:clear-recent-repos',
}

export interface RecentRepo {
  url: string;
  owner: string;
  repo: string;
  branch: string;
  lastVisited: number;
}

export interface RecentReposAPI {
  getRecentRepos: () => Promise<RecentRepo[]>;
  addRecentRepo: (repo: Omit<RecentRepo, 'lastVisited'>) => Promise<{ success: boolean; error?: string }>;
  removeRecentRepo: (owner: string, repo: string) => Promise<{ success: boolean; error?: string }>;
  clearRecentRepos: () => Promise<{ success: boolean; error?: string }>;
}
