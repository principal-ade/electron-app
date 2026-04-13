import { useState, useEffect, useCallback, useRef } from 'react';
import type { CityData } from '@principal-ai/file-city-react';
import {
  CodeCityBuilderWithGrid,
  getFilesFromGitHubTree,
  buildFileSystemTreeFromFileInfoList,
  type GitHubTreeResponse,
} from '@principal-ai/file-city-builder';
import type { SharedGitStatus } from '@principal-ai/control-tower-core';
import { PresenceService } from '../main-process-api/PresenceService';
import { GithubService } from '../main-process-api/GithubService';
import { SecureAuthService } from '../services/SecureAuthService';
import type { UserPresence } from '../../shared/main-process-api-interfaces/PresenceAPI';

export interface ActiveRepository {
  owner: string;
  repo: string;
  repoId: string; // "owner/repo" format
  branch: string;
  users: UserPresence[];
  cityData: CityData | null;
  loading: boolean;
  error: string | null;
  /** Aggregated git status from all users in this repo */
  gitStatus?: {
    /** Map of userId to their git status */
    byUser: Map<string, SharedGitStatus>;
    /** Whether any user has uncommitted changes */
    anyDirty: boolean;
    /** Total number of users with dirty status */
    dirtyCount: number;
  };
  /** Current device ID for highlighting "this device" */
  currentDeviceId?: string | null;
  /** Timestamp information for this repository */
  timestamps?: {
    /** Earliest time any session was opened for this repo (Unix timestamp in ms) */
    earliestOpenedAt?: number;
    /** Most recent activity across all sessions (Unix timestamp in ms) */
    mostRecentActivity?: number;
    /** Most recent git status change across all users (Unix timestamp in ms) */
    mostRecentGitChange?: number;
  };
}

export interface UseActivityCitiesReturn {
  repositories: ActiveRepository[];
  onlineCount: number;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
}

// Cache for file trees to avoid repeated fetches
const fileTreeCache = new Map<string, { cityData: CityData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// City builder instance (reusable)
const cityBuilder = new CodeCityBuilderWithGrid();

/**
 * Parse repoId (owner/repo) into owner and repo parts
 */
function parseRepoId(repoId: string): { owner: string; repo: string } | null {
  const parts = repoId.split('/');
  if (parts.length !== 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Build CityData from a GitHub tree response
 */
function buildCityDataFromGitHubTree(
  treeResponse: GitHubTreeResponse,
  rootPath: string,
): CityData {
  // Filter to only files (blobs), not directories (trees)
  const blobsOnly = {
    ...treeResponse,
    tree: treeResponse.tree.filter((item) => item.type === 'blob'),
  };

  const files = getFilesFromGitHubTree(blobsOnly);
  const fileSystemTree = buildFileSystemTreeFromFileInfoList(files, treeResponse.sha);
  const cityData = cityBuilder.buildCityFromFileSystem(fileSystemTree, rootPath);

  return cityData;
}

/**
 * Hook to aggregate presence data into active repositories with File City visualizations
 */
export function useActivityCities(): UseActivityCitiesReturn {
  const [repositories, setRepositories] = useState<ActiveRepository[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  // Track ongoing fetches to avoid duplicates
  const fetchingRepos = useRef(new Set<string>());

  // Fetch current device ID on mount
  useEffect(() => {
    PresenceService.getDeviceId()
      .then(setCurrentDeviceId)
      .catch((err: unknown) => console.error('[useActivityCities] Failed to get device ID:', err));
  }, []);

  /**
   * Fetch city data for a single repository
   */
  const fetchCityDataForRepo = useCallback(
    async (
      owner: string,
      repo: string,
      branch: string,
    ): Promise<{ cityData: CityData | null; error: string | null }> => {
      const cacheKey = `${owner}/${repo}:${branch}`;

      // Check cache first
      const cached = fileTreeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { cityData: cached.cityData, error: null };
      }

      // Avoid duplicate fetches
      if (fetchingRepos.current.has(cacheKey)) {
        return { cityData: null, error: null };
      }

      fetchingRepos.current.add(cacheKey);

      try {
        const treeResult = await GithubService.getTree(owner, repo, branch);

        if (!treeResult?.success || !treeResult.data) {
          console.warn(`[useActivityCities] Failed to get tree for ${owner}/${repo}:`, treeResult?.error);
          return {
            cityData: null,
            error: treeResult?.error || 'Failed to fetch file tree',
          };
        }

        const cityData = buildCityDataFromGitHubTree(
          treeResult.data as GitHubTreeResponse,
          '', // Empty rootPath so building paths match git status paths
        );

        // Cache the result
        fileTreeCache.set(cacheKey, { cityData, timestamp: Date.now() });

        return { cityData, error: null };
      } catch (err) {
        console.error(`[useActivityCities] Error fetching tree for ${owner}/${repo}:`, err);
        return {
          cityData: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      } finally {
        fetchingRepos.current.delete(cacheKey);
      }
    },
    [],
  );

  /**
   * Process presence data into active repositories
   */
  const processPresenceData = useCallback(
    async (users: UserPresence[]) => {
      // Group users by repository, also collect git status and timestamps
      const repoUsersMap = new Map<
        string,
        {
          owner: string;
          repo: string;
          branch: string;
          users: UserPresence[];
          gitStatusByUser: Map<string, SharedGitStatus>;
          openedAtTimes: number[];
          lastActivityTimes: number[];
        }
      >();

      for (const user of users) {
        if (user.status === 'offline') continue;

        // openRepositories can be at user.openRepositories or user.extended.openRepositories
        const extendedUser = user as { extended?: { openRepositories?: unknown[] } };
        const rawRepos = user.openRepositories || extendedUser.extended?.openRepositories;

        // Handle openRepositories being an object (keyed by repoId) or array
        const repoSessions = Array.isArray(rawRepos)
          ? rawRepos
          : rawRepos && typeof rawRepos === 'object'
            ? Object.values(rawRepos)
            : [];

        for (const repoSession of repoSessions) {
          if (!repoSession || typeof repoSession !== 'object') continue;

          const session = repoSession as {
            repoId?: string;
            branch?: string;
            gitStatus?: SharedGitStatus;
            openedAt?: number;
            lastActivity?: number;
          };
          const parsed = parseRepoId(session.repoId || '');
          if (!parsed) continue;

          const key = session.repoId!;
          const existing = repoUsersMap.get(key);

          if (existing) {
            existing.users.push(user);
            // Add git status if available
            if (session.gitStatus) {
              existing.gitStatusByUser.set(user.userId, session.gitStatus);
            }
            // Track timestamps
            if (session.openedAt) {
              existing.openedAtTimes.push(session.openedAt);
            }
            if (session.lastActivity) {
              existing.lastActivityTimes.push(session.lastActivity);
            }
          } else {
            const gitStatusByUser = new Map<string, SharedGitStatus>();
            if (session.gitStatus) {
              gitStatusByUser.set(user.userId, session.gitStatus);
            }
            repoUsersMap.set(key, {
              owner: parsed.owner,
              repo: parsed.repo,
              branch: session.branch || 'main',
              users: [user],
              gitStatusByUser,
              openedAtTimes: session.openedAt ? [session.openedAt] : [],
              lastActivityTimes: session.lastActivity ? [session.lastActivity] : [],
            });
          }
        }
      }

      // Initialize repositories with loading state
      const initialRepos: ActiveRepository[] = Array.from(repoUsersMap.entries()).map(
        ([repoId, data]) => {
          // Aggregate git status
          const dirtyCount = Array.from(data.gitStatusByUser.values()).filter(s => s.isDirty).length;

          // Aggregate timestamps
          const earliestOpenedAt = data.openedAtTimes.length > 0
            ? Math.min(...data.openedAtTimes)
            : undefined;
          const mostRecentActivity = data.lastActivityTimes.length > 0
            ? Math.max(...data.lastActivityTimes)
            : undefined;

          // Find most recent git change timestamp across all users
          // Convert ISO strings to Unix timestamps for consistency
          const gitChangeTimes = Array.from(data.gitStatusByUser.values())
            .map(s => s.lastChangedAt)
            .filter((t): t is string => t !== undefined && t !== null)
            .map(isoString => new Date(isoString).getTime());
          const mostRecentGitChange = gitChangeTimes.length > 0
            ? Math.max(...gitChangeTimes)
            : undefined;

          return {
            owner: data.owner,
            repo: data.repo,
            repoId,
            branch: data.branch,
            users: data.users,
            cityData: null,
            loading: true,
            error: null,
            gitStatus: data.gitStatusByUser.size > 0
              ? {
                  byUser: data.gitStatusByUser,
                  anyDirty: dirtyCount > 0,
                  dirtyCount,
                }
              : undefined,
            currentDeviceId,
            timestamps: (earliestOpenedAt || mostRecentActivity || mostRecentGitChange)
              ? {
                  earliestOpenedAt,
                  mostRecentActivity,
                  mostRecentGitChange,
                }
              : undefined,
          };
        },
      );

      setRepositories(initialRepos);

      // Fetch city data for each repository in parallel
      const fetchPromises = initialRepos.map(async (repo) => {
        const { cityData, error } = await fetchCityDataForRepo(
          repo.owner,
          repo.repo,
          repo.branch,
        );
        return { repoId: repo.repoId, cityData, error };
      });

      const results = await Promise.all(fetchPromises);

      // Update repositories with fetched data
      setRepositories((prev) =>
        prev.map((repo) => {
          const result = results.find((r) => r.repoId === repo.repoId);
          if (result) {
            return {
              ...repo,
              cityData: result.cityData,
              loading: false,
              error: result.error,
            };
          }
          return repo;
        })
      );
    },
    [fetchCityDataForRepo, currentDeviceId],
  );

  /**
   * Ensure presence is connected (connect if needed)
   */
  const ensurePresenceConnected = useCallback(async (): Promise<boolean> => {
    try {
      // Get auth status first
      const authService = SecureAuthService.getInstance();
      const authResult = await authService.checkAuth();

      if (!authResult.authenticated || !authResult.token) {
        console.warn('[useActivityCities] Not authenticated, cannot connect to presence');
        setIsAuthenticated(false);
        return false;
      }

      setIsAuthenticated(true);

      // Try to connect to presence (will return success if already connected)
      const result = await PresenceService.connectToPresence(authResult.token);
      if (result.success) {
        return true;
      } else {
        console.warn('[useActivityCities] Failed to connect to presence:', result.error);
        return false;
      }
    } catch (err) {
      console.error('[useActivityCities] Error connecting to presence:', err);
      return false;
    }
  }, []);

  /**
   * Fetch and process presence data
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Ensure presence is connected first
      await ensurePresenceConnected();

      const presenceData = await PresenceService.getUsers();
      setOnlineCount(presenceData.stats.totalOnline);
      await processPresenceData(presenceData.users);
    } catch (err) {
      console.error('[useActivityCities] Error fetching presence data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch presence data');
    } finally {
      setLoading(false);
    }
  }, [processPresenceData, ensurePresenceConnected]);

  // Store refresh in a ref to avoid effect re-runs
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Initial fetch and subscribe to presence updates
  useEffect(() => {
    void refreshRef.current();

    // Subscribe to presence events for real-time updates
    const unsubscribe = PresenceService.onPresenceEvent((event) => {
      // Refresh on relevant events
      if (
        event.type === 'presence:user_online' ||
        event.type === 'presence:user_offline' ||
        event.type === 'presence:repo_opened' ||
        event.type === 'presence:repo_closed'
      ) {
        void refreshRef.current();
      }

      // Handle git status updates incrementally (no full refresh needed)
      if (event.type === 'presence:repo_status_changed') {
        const payload = event.payload as {
          userId: string;
          repoId: string;
          gitStatus: SharedGitStatus;
        };

        setRepositories((prev) =>
          prev.map((repo) => {
            if (repo.repoId !== payload.repoId) return repo;

            // Update the git status for this user
            const newByUser = new Map(repo.gitStatus?.byUser || new Map());
            newByUser.set(payload.userId, payload.gitStatus);

            const dirtyCount = Array.from(newByUser.values()).filter(s => s.isDirty).length;

            // Update timestamp based on new git status
            const updatedRepo = {
              ...repo,
              gitStatus: {
                byUser: newByUser,
                anyDirty: dirtyCount > 0,
                dirtyCount,
              },
            };

            // Also update mostRecentGitChange if needed
            if (payload.gitStatus.lastChangedAt && updatedRepo.timestamps) {
              const gitChangeTimes = Array.from(newByUser.values())
                .map(s => s.lastChangedAt)
                .filter((t): t is string => t !== undefined && t !== null)
                .map(isoString => new Date(isoString).getTime());
              const mostRecentGitChange = gitChangeTimes.length > 0
                ? Math.max(...gitChangeTimes)
                : undefined;

              updatedRepo.timestamps = {
                ...updatedRepo.timestamps,
                mostRecentGitChange,
              };
            }

            return updatedRepo;
          }),
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, []); // Empty deps - only run once on mount

  return {
    repositories,
    onlineCount,
    loading,
    error,
    isAuthenticated,
    refresh,
  };
}
