import { useState, useEffect, useCallback, useRef } from 'react';
import type { CityData } from '@principal-ai/file-city-react';
import {
  CodeCityBuilderWithGrid,
  getFilesFromGitHubTree,
  buildFileSystemTreeFromFileInfoList,
  type GitHubTreeResponse,
} from '@principal-ai/file-city-builder';
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
}

export interface UseActivityCitiesReturn {
  repositories: ActiveRepository[];
  onlineCount: number;
  loading: boolean;
  error: string | null;
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
  return cityBuilder.buildCityFromFileSystem(fileSystemTree, rootPath);
}

/**
 * Hook to aggregate presence data into active repositories with File City visualizations
 */
export function useActivityCities(): UseActivityCitiesReturn {
  const [repositories, setRepositories] = useState<ActiveRepository[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track ongoing fetches to avoid duplicates
  const fetchingRepos = useRef(new Set<string>());

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
          return {
            cityData: null,
            error: treeResult?.error || 'Failed to fetch file tree',
          };
        }

        const cityData = buildCityDataFromGitHubTree(
          treeResult.data as GitHubTreeResponse,
          `${owner}/${repo}`,
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
      // Group users by repository
      const repoUsersMap = new Map<
        string,
        { owner: string; repo: string; branch: string; users: UserPresence[] }
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
          const session = repoSession as { repoId?: string; branch?: string };
          const parsed = parseRepoId(session.repoId || '');
          if (!parsed) continue;

          const key = session.repoId!;
          const existing = repoUsersMap.get(key);

          if (existing) {
            existing.users.push(user);
          } else {
            repoUsersMap.set(key, {
              owner: parsed.owner,
              repo: parsed.repo,
              branch: session.branch || 'main',
              users: [user],
            });
          }
        }
      }

      // Initialize repositories with loading state
      const initialRepos: ActiveRepository[] = Array.from(repoUsersMap.entries()).map(
        ([repoId, data]) => ({
          owner: data.owner,
          repo: data.repo,
          repoId,
          branch: data.branch,
          users: data.users,
          cityData: null,
          loading: true,
          error: null,
        }),
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
        }),
      );
    },
    [fetchCityDataForRepo],
  );

  /**
   * Ensure presence is connected (connect if needed)
   */
  const ensurePresenceConnected = useCallback(async (): Promise<boolean> => {
    try {
      // Check if already have presence data (means we're connected)
      const initialData = await PresenceService.getUsers();
      if (initialData.users.length > 0 || initialData.stats.totalOnline > 0) {
        return true; // Already connected and have data
      }

      // Try to connect to presence
      console.log('[useActivityCities] Connecting to presence...');
      const authService = SecureAuthService.getInstance();
      const authResult = await authService.checkAuth();

      if (!authResult.authenticated || !authResult.token) {
        console.warn('[useActivityCities] Not authenticated, cannot connect to presence');
        return false;
      }

      const result = await PresenceService.connectToPresence(authResult.token);
      if (result.success) {
        console.log('[useActivityCities] Successfully connected to presence');
        // Give the WebSocket a moment to receive room state
        await new Promise((resolve) => setTimeout(resolve, 500));
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
      console.log('[useActivityCities] Presence data:', JSON.stringify({
        totalOnline: presenceData.stats.totalOnline,
        userCount: presenceData.users.length,
        users: presenceData.users.map((u) => ({
          userId: u.userId,
          status: u.status,
          openRepositories: u.openRepositories,
          openReposType: Array.isArray(u.openRepositories) ? 'array' : typeof u.openRepositories,
        })),
      }, null, 2));
      setOnlineCount(presenceData.stats.totalOnline);
      await processPresenceData(presenceData.users);
    } catch (err) {
      console.error('[useActivityCities] Error fetching presence data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch presence data');
    } finally {
      setLoading(false);
    }
  }, [processPresenceData, ensurePresenceConnected]);

  // Initial fetch and subscribe to presence updates
  useEffect(() => {
    void refresh();

    // Subscribe to presence events for real-time updates
    const unsubscribe = PresenceService.onPresenceEvent((event) => {
      // Refresh on relevant events
      if (
        event.type === 'presence:user_online' ||
        event.type === 'presence:user_offline' ||
        event.type === 'presence:repo_opened' ||
        event.type === 'presence:repo_closed'
      ) {
        void refresh();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  return {
    repositories,
    onlineCount,
    loading,
    error,
    refresh,
  };
}
