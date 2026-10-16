import { useEffect, useSyncExternalStore } from 'react';
import type { GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';
import { useAuthUser } from '../providers/AuthProvider';
import {
  ensureStarred,
  getSnapshot,
  refresh,
  refreshIfStale,
  setSession,
  subscribe,
} from '../stores/githubProjectsStore';

export interface UseGithubProjectsResult {
  /** Deduped repositories the user can see across their account + all orgs */
  repos: GitHubRepository[];
  /** Starred repos (empty until loaded — see `starredLoaded` / `ensureStarred`). */
  starredRepos: GitHubRepository[];
  /** True once the lazy starred page has been fetched. */
  starredLoaded: boolean;
  starredLoading: boolean;
  /** Load the starred page on demand (Projects Starred filter, Home search). */
  ensureStarred: () => void;
  /** Current user's GitHub login, when authenticated */
  currentUser: string | null;
  /** Logins of the orgs the user belongs to */
  userOrgs: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Reads the cached GitHub project graph (owned repos + every org's repos,
 * lazily the starred set) from {@link githubProjectsStore}.
 *
 * Shared across consumers and survives mount/unmount, so the Projects list
 * paints from cache instantly on remount and only revalidates once the snapshot
 * has aged out (or on an explicit refresh). Signed out, the store is emptied and
 * no GitHub calls are made.
 */
export function useGithubProjects(): UseGithubProjectsResult {
  const { isAuthenticated, user } = useAuthUser();
  const login = user?.login ?? null;

  // Keep the store's session in sync with auth (a different user, or sign-out,
  // drops the cache so we never show a previous session's repos).
  useEffect(() => {
    setSession(isAuthenticated ? login : null);
  }, [isAuthenticated, login]);

  // Seed when the cache has aged out; the store owns the revalidation cadence.
  useEffect(() => {
    if (isAuthenticated && login) refreshIfStale();
  }, [isAuthenticated, login]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  return {
    repos: snapshot.repos,
    starredRepos: snapshot.starred ?? [],
    starredLoaded: snapshot.starred !== null,
    starredLoading: snapshot.starredLoading,
    // Stable store fn — idempotent, so it's safe in effect deps.
    ensureStarred,
    // Derived from auth state — available immediately, not after the fetch.
    currentUser: login,
    userOrgs: snapshot.orgs.map((org) => org.login),
    loading: snapshot.loading,
    error: snapshot.error,
    refresh,
  };
}
