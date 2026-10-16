/**
 * githubProjectsStore
 *
 * Session-lived cache of the signed-in user's GitHub project graph: their
 * organizations, every repo they can reach grouped by owner, and (lazily) the
 * repos they've starred.
 *
 * Why it exists: the fan-out is ~N+4 GitHub REST calls (one 100-item page per
 * org). Without a cache, every mount re-ran all of them — the Projects list and
 * the Home rail each did their own copy. This keeps the last result so surfaces
 * paint instantly and revalidate in the background.
 *
 * Revalidation:
 *  - remount when the repos snapshot has aged out ({@link refreshIfStale})
 *  - a cadence while a session is active (the poll started in {@link setSession})
 *  - the explicit Refresh button ({@link refresh}, force)
 *  - opening a repository profile ({@link refreshIfStale})
 * Starred is lazy: it loads only when asked ({@link ensureStarred}) and then
 * rides the same staleness cadence.
 */
import { GithubService } from '../main-process-api/GithubService';
import type {
  GitHubOrganization,
  GitHubRepository,
} from '../../shared/main-process-api-interfaces/GitHubAPI';

export interface GithubProjectsSnapshot {
  /** The user's organizations (with display name + avatar for section headers). */
  orgs: GitHubOrganization[];
  /** Every reachable repo, grouped by its owner login (the user + each org). */
  reposByOwner: Map<string, GitHubRepository[]>;
  /** Flat, de-duplicated list across `reposByOwner` (owned repos first). */
  repos: GitHubRepository[];
  /** Starred repos, or null until lazily loaded. */
  starred: GitHubRepository[] | null;
  /** Lowercased `owner/name` for the loaded starred set. */
  starredKeys: Set<string>;
  fetchedAt: number | null;
  starredFetchedAt: number | null;
  loading: boolean;
  starredLoading: boolean;
  error: string | null;
}

/** How long a snapshot stays fresh before a consumer revalidates it. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

const EMPTY: GithubProjectsSnapshot = {
  orgs: [],
  reposByOwner: new Map(),
  repos: [],
  starred: null,
  starredKeys: new Set(),
  fetchedAt: null,
  starredFetchedAt: null,
  loading: false,
  starredLoading: false,
  error: null,
};

let snapshot: GithubProjectsSnapshot = EMPTY;
let login: string | null = null;
let reposInFlight: Promise<void> | null = null;
let starredInFlight: Promise<void> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current snapshot (stable reference until it changes) — for useSyncExternalStore. */
export function getSnapshot(): GithubProjectsSnapshot {
  return snapshot;
}

const keyOf = (repo: GitHubRepository): string =>
  (repo.full_name ?? `${repo.owner?.login ?? ''}/${repo.name}`).toLowerCase();

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => refreshIfStale(), STALE_AFTER_MS);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Point the cache at the signed-in login. A different user — or sign-out —
 * drops everything cached so we never show a previous session's repos.
 */
export function setSession(nextLogin: string | null): void {
  if (nextLogin === login) return;
  login = nextLogin;
  snapshot = nextLogin ? { ...EMPTY, loading: true } : EMPTY;
  if (nextLogin) startPolling();
  else stopPolling();
  emit();
}

export function isStale(): boolean {
  return (
    snapshot.fetchedAt === null ||
    Date.now() - snapshot.fetchedAt > STALE_AFTER_MS
  );
}

function isStarredStale(): boolean {
  if (snapshot.starred === null) return false;
  return (
    snapshot.starredFetchedAt === null ||
    Date.now() - snapshot.starredFetchedAt > STALE_AFTER_MS
  );
}

/** Force a full repos re-fetch (plus starred, if it's already been loaded). */
export function refresh(): Promise<void> {
  if (!login) {
    snapshot = EMPTY;
    emit();
    return Promise.resolve();
  }
  const jobs: Array<Promise<void>> = [refreshRepos()];
  if (snapshot.starred !== null) jobs.push(ensureStarred(true));
  return Promise.all(jobs).then(() => undefined);
}

function refreshRepos(): Promise<void> {
  if (!login) return Promise.resolve();
  if (reposInFlight) return reposInFlight;

  snapshot = { ...snapshot, loading: true, error: null };
  emit();

  const currentLogin = login;
  reposInFlight = (async () => {
    try {
      const [orgs, userRepos, ownedRepos] = await Promise.all([
        GithubService.getUserOrganizations(),
        GithubService.getUserRepositories({
          perPage: 100,
          sort: 'updated',
          direction: 'desc',
        }),
        // The broad affiliation list is capped at 100 and sorted by recency, so
        // for users in many orgs their own repos can fall past the cutoff; fetch
        // owned repos explicitly so the "you" section is always present.
        GithubService.getUserRepositories({
          type: 'owner',
          perPage: 100,
          sort: 'updated',
          direction: 'desc',
        }),
      ]);

      const orgRepoLists = await Promise.all(
        orgs.map(async (org) => {
          try {
            const repos = await GithubService.getOrgRepositories(org.login, {
              perPage: 100,
              sort: 'updated',
              direction: 'desc',
            });
            return { login: org.login, repos };
          } catch (err) {
            console.warn(
              `[githubProjectsStore] Failed to fetch repos for org ${org.login}:`,
              err,
            );
            return { login: org.login, repos: [] as GitHubRepository[] };
          }
        }),
      );

      // Group by owner login (owned repos first so nothing is crowded out).
      const reposByOwner = new Map<string, GitHubRepository[]>();
      const seen = new Set<string>();
      const flat: GitHubRepository[] = [];
      const addRepo = (repo: GitHubRepository) => {
        const owner = repo.owner?.login ?? 'unknown';
        const list = reposByOwner.get(owner);
        if (list) list.push(repo);
        else reposByOwner.set(owner, [repo]);
        const key = keyOf(repo);
        if (!seen.has(key)) {
          seen.add(key);
          flat.push(repo);
        }
      };
      for (const repo of ownedRepos) addRepo(repo);
      for (const repo of userRepos) addRepo(repo);
      for (const { repos } of orgRepoLists)
        for (const repo of repos) addRepo(repo);

      snapshot = {
        ...snapshot,
        orgs,
        reposByOwner,
        repos: flat,
        // Guard against a session change mid-flight.
        fetchedAt: login === currentLogin ? Date.now() : snapshot.fetchedAt,
        loading: false,
        error: null,
      };
    } catch (err) {
      console.error(
        '[githubProjectsStore] Failed to fetch GitHub projects:',
        err,
      );
      snapshot = {
        ...snapshot,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch projects',
      };
    } finally {
      reposInFlight = null;
      emit();
    }
  })();

  return reposInFlight;
}

/**
 * Load the starred page once (lazy), or re-fetch it when `force` or stale.
 * Shares one request across concurrent callers.
 */
export function ensureStarred(force = false): Promise<void> {
  if (!login) return Promise.resolve();
  if (starredInFlight) return starredInFlight;
  if (snapshot.starred !== null && !force && !isStarredStale()) {
    return Promise.resolve();
  }

  snapshot = { ...snapshot, starredLoading: true };
  emit();

  const currentLogin = login;
  starredInFlight = (async () => {
    try {
      const starred = await GithubService.getUserStarredRepositories({
        perPage: 100,
      });
      if (login !== currentLogin) return; // session changed mid-flight
      snapshot = {
        ...snapshot,
        starred,
        starredKeys: new Set(starred.map(keyOf)),
        starredFetchedAt: Date.now(),
        starredLoading: false,
      };
    } catch (err) {
      console.error(
        '[githubProjectsStore] Failed to fetch starred repos:',
        err,
      );
      snapshot = { ...snapshot, starredLoading: false };
    } finally {
      starredInFlight = null;
      emit();
    }
  })();

  return starredInFlight;
}

/** Revalidate whatever has aged out (repos always eligible; starred only if loaded). */
export function refreshIfStale(): void {
  if (isStale()) void refreshRepos();
  if (isStarredStale()) void ensureStarred(true);
}

/**
 * Cached org repos (undefined when the org isn't in the graph — caller may
 * fetch on demand). Non-hook accessor for action callbacks.
 */
export function getOrgReposFromCache(
  org: string,
): GitHubRepository[] | undefined {
  return snapshot.reposByOwner.get(org);
}

/** Cached starred answer, or undefined when starred hasn't been loaded. */
export function isStarredFromCache(
  owner: string,
  repo: string,
): boolean | undefined {
  if (snapshot.starred === null) return undefined;
  return snapshot.starredKeys.has(`${owner}/${repo}`.toLowerCase());
}
