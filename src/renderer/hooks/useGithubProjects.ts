import { useState, useEffect, useCallback } from 'react';
import { GithubService } from '../main-process-api/GithubService';
import type { GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';

export interface UseGithubProjectsResult {
  /** Deduped repositories the user can see across their account + all orgs */
  repos: GitHubRepository[];
  /** Current user's GitHub login, when authenticated */
  currentUser: string | null;
  /** Logins of the orgs the user belongs to */
  userOrgs: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches every GitHub repository the signed-in user can reach: their own
 * repos plus the repos of all organizations they belong to. Results are
 * deduped by `full_name`. Fails silently (empty list) when unauthenticated.
 */
export function useGithubProjects(): UseGithubProjectsResult {
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userOrgs, setUserOrgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [user, orgs, userRepos, ownedRepos] = await Promise.all([
        GithubService.getCurrentUser(),
        GithubService.getUserOrganizations(),
        GithubService.getUserRepositories({ perPage: 100, sort: 'updated', direction: 'desc' }),
        // The broad affiliation list above is capped at 100 and sorted by
        // recent activity, so for users with many collaborator/org repos their
        // own repos can fall past the cutoff and the "you" section disappears.
        // Fetch owned repos explicitly so they're always present.
        GithubService.getUserRepositories({
          type: 'owner',
          perPage: 100,
          sort: 'updated',
          direction: 'desc',
        }),
      ]);

      setCurrentUser(user?.login ?? null);
      setUserOrgs(orgs.map((org) => org.login));

      // Fetch repos for every org in parallel; a failing org shouldn't sink the rest.
      const orgRepoLists = await Promise.all(
        orgs.map(async (org) => {
          try {
            return await GithubService.getOrgRepositories(org.login, {
              perPage: 100,
              sort: 'updated',
              direction: 'desc',
            });
          } catch (err) {
            console.warn(`[useGithubProjects] Failed to fetch repos for org ${org.login}:`, err);
            return [] as GitHubRepository[];
          }
        })
      );

      // Dedupe by full_name (owner/name), keeping first occurrence. Owned repos
      // go first so they're never crowded out by the capped affiliation list.
      const byFullName = new Map<string, GitHubRepository>();
      for (const repo of [ownedRepos, userRepos, ...orgRepoLists].flat()) {
        if (!byFullName.has(repo.full_name)) {
          byFullName.set(repo.full_name, repo);
        }
      }

      setRepos(Array.from(byFullName.values()));
    } catch (err) {
      console.error('[useGithubProjects] Failed to fetch GitHub projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      setRepos([]);
      setCurrentUser(null);
      setUserOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { repos, currentUser, userOrgs, loading, error, refresh: fetchData };
}
