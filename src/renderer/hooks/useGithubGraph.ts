/**
 * useGithubGraph — selectors over {@link githubProjectsStore} for surfaces that
 * need the GitHub project graph but not the whole Projects-list shape.
 *
 * Each selector keeps the store's session in sync with auth and triggers a
 * stale-if-needed revalidation on mount; the store owns the cadence.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
  GitHubOrganization,
  GitHubRepository,
} from '../../shared/main-process-api-interfaces/GitHubAPI';
import type { ProjectSection } from '../panels/home-panel/HomeSearch';
import { useAuthUser } from '../providers/AuthProvider';
import {
  ensureStarred,
  getSnapshot,
  refreshIfStale,
  setSession,
  subscribe,
} from '../stores/githubProjectsStore';

type Snapshot = ReturnType<typeof getSnapshot>;

/** Session sync + stale revalidation + the shared snapshot. */
function useGraphSnapshot(): { snapshot: Snapshot; login: string | null } {
  const { isAuthenticated, user } = useAuthUser();
  const login = user?.login ?? null;

  useEffect(() => {
    setSession(isAuthenticated ? login : null);
  }, [isAuthenticated, login]);

  useEffect(() => {
    if (isAuthenticated && login) refreshIfStale();
  }, [isAuthenticated, login]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return { snapshot, login };
}

/**
 * Repos grouped for the Home rail's search sections: the user's own repos first,
 * then one section per org (with its display name + avatar).
 */
export function useGithubProjectSections(): ProjectSection[] | null {
  const { snapshot, login } = useGraphSnapshot();

  return useMemo(() => {
    if (!login) return null;

    const sections: ProjectSection[] = [];

    const userRepos = snapshot.reposByOwner.get(login);
    if (userRepos && userRepos.length > 0) {
      sections.push({
        key: login,
        label: 'Your repositories',
        repos: userRepos,
      });
    }

    for (const org of snapshot.orgs) {
      const repos = snapshot.reposByOwner.get(org.login);
      if (repos && repos.length > 0) {
        sections.push({
          key: org.login,
          label: (org.name && org.name.trim()) || org.login,
          avatar_url: org.avatar_url,
          repos,
        });
      }
    }

    return sections;
  }, [snapshot, login]);
}

/** The user's organizations (for clone/fork/new-repo target pickers). */
export function useGithubOrganizations(): {
  orgs: GitHubOrganization[];
  loading: boolean;
} {
  const { snapshot } = useGraphSnapshot();
  return { orgs: snapshot.orgs, loading: snapshot.loading };
}

/** Cached repos for one org, or undefined when it isn't in the graph. */
export function useOrgRepos(org: string): GitHubRepository[] | undefined {
  return useGraphSnapshot().snapshot.reposByOwner.get(org);
}

/**
 * The starred set, lazily loaded. `ensure()` is stable and idempotent — call it
 * when the Starred filter/search is used.
 */
export function useGithubStarred(): {
  starredRepos: GitHubRepository[];
  loaded: boolean;
  loading: boolean;
  ensure: () => void;
} {
  const { snapshot } = useGraphSnapshot();
  return {
    starredRepos: snapshot.starred ?? [],
    loaded: snapshot.starred !== null,
    loading: snapshot.starredLoading,
    // Stable store fn — idempotent, safe in effect deps.
    ensure: ensureStarred,
  };
}
