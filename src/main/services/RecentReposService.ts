import Store from 'electron-store';

export interface RecentRepo {
  url: string;
  owner: string;
  repo: string;
  branch: string;
  lastVisited: number;
}

interface RecentReposStore {
  recentRepos: RecentRepo[];
}

/**
 * Service for managing recently visited skill repositories
 * Uses electron-store for persistent storage
 */
export class RecentReposService {
  private store: Store<RecentReposStore>;
  private readonly MAX_RECENT = 10; // Maximum number of recent repos to store

  constructor() {
    this.store = new Store<RecentReposStore>({
      name: 'recent-skills-repos',
      defaults: {
        recentRepos: [],
      },
    });
  }

  /**
   * Get all recent repositories, sorted by most recent first
   */
  getRecentRepos(): RecentRepo[] {
    const repos = this.store.get('recentRepos', []);
    // Sort by lastVisited descending (most recent first)
    return repos.sort((a, b) => b.lastVisited - a.lastVisited);
  }

  /**
   * Add or update a repository in the recent list
   * If the repo already exists, updates the lastVisited timestamp
   * Maintains a maximum of MAX_RECENT repos
   */
  addRecentRepo(repo: Omit<RecentRepo, 'lastVisited'>): void {
    const repos = this.store.get('recentRepos', []);
    const now = Date.now();

    // Find if this repo already exists (match by owner/repo)
    const existingIndex = repos.findIndex(
      (r) => r.owner === repo.owner && r.repo === repo.repo,
    );

    if (existingIndex >= 0) {
      // Update existing entry
      repos[existingIndex] = {
        ...repo,
        lastVisited: now,
      };
    } else {
      // Add new entry
      repos.push({
        ...repo,
        lastVisited: now,
      });
    }

    // Sort by most recent first
    repos.sort((a, b) => b.lastVisited - a.lastVisited);

    // Keep only the most recent MAX_RECENT repos
    const trimmedRepos = repos.slice(0, this.MAX_RECENT);

    this.store.set('recentRepos', trimmedRepos);

    console.log(`[RecentReposService] Added/updated repo: ${repo.owner}/${repo.repo}`);
  }

  /**
   * Remove a repository from the recent list
   */
  removeRecentRepo(owner: string, repo: string): void {
    const repos = this.store.get('recentRepos', []);
    const filtered = repos.filter(
      (r) => !(r.owner === owner && r.repo === repo),
    );
    this.store.set('recentRepos', filtered);
    console.log(`[RecentReposService] Removed repo: ${owner}/${repo}`);
  }

  /**
   * Clear all recent repositories
   */
  clearRecentRepos(): void {
    this.store.set('recentRepos', []);
    console.log('[RecentReposService] Cleared all recent repos');
  }

  /**
   * Get the storage file path (for debugging)
   */
  getStoragePath(): string {
    return this.store.path;
  }
}
