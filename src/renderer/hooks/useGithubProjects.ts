import { useState, useEffect, useCallback } from 'react';
import { GithubService } from '../main-process-api/GithubService';
import { useAuthUser } from '../providers/AuthProvider';
import type { GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';

export interface UseGithubProjectsResult {
  /** Deduped repositories the user can see across their account + all orgs */
  repos: GitHubRepository[];
  /**
   * Repositories the user has starred. May include repos outside their account
   * and orgs (third-party repos), so callers merge these separately.
   */
  starredRepos: GitHubRepository[];
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
 * repos plus the repos of all organizations they belong to, plus their starred
 * repos. Results are deduped by `full_name`. Fails silently (empty list) when
 * unauthenticated.
 */
export function useGithubProjects(): UseGithubProjectsResult {
  const { isAuthenticated, user } = useAuthUser();
  const userLogin = user?.login ?? null;
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [starredRepos, setStarredRepos] = useState<GitHubRepository[]>([]);
  const [userOrgs, setUserOrgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Signed out → only local clones are reachable and every GitHub call would
    // just fail. Skip the fan-out and report the empty state immediately so the
    // Projects panel never waits on the network to learn there's no session.
    if (!isAuthenticated || !userLogin) {
      setRepos([]);
      setStarredRepos([]);
      setUserOrgs([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [orgs, userRepos, ownedRepos, starred] = await Promise.all([
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
        // Starred repos can be third-party; a failure here shouldn't sink the rest.
        GithubService.getUserStarredRepositories({ perPage: 100 }).catch(
          () => [] as GitHubRepository[]
        ),
      ]);

      setUserOrgs(orgs.map((org) => org.login));
      setStarredRepos(starred);

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
      setUserOrgs([]);
      setStarredRepos([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userLogin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    repos,
    starredRepos,
    // Derived from auth state (available immediately) rather than set after the
    // fetch, so callers can gate UI on the session without waiting on network.
    currentUser: userLogin,
    userOrgs,
    loading,
    error,
    refresh: fetchData,
  };
}
