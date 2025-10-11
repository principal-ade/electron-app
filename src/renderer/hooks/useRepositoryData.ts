/**
 * useRepositoryData - React hook for accessing cached repository data
 * Provides automatic subscription to cache updates and real-time data synchronization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RepositoryDataCache,
  type RepositoryCacheData,
} from '../services/RepositoryDataCache';
import type { AlexandriaEntry } from '@a24z/core-library';

/**
 * Generate a unique component ID for cache subscriptions
 */
function generateComponentId(): string {
  return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook options
 */
interface UseRepositoryDataOptions {
  /**
   * Whether to automatically load data if not in cache
   */
  autoLoad?: boolean;

  /**
   * Maximum cache age before considering data stale (ms)
   */
  maxAge?: number;

  /**
   * Whether to subscribe to real-time updates
   */
  subscribe?: boolean;
}

/**
 * Hook return value
 */
interface UseRepositoryDataResult {
  /**
   * The cached repository data
   */
  data: RepositoryCacheData | null;

  /**
   * Whether data is currently being loaded
   */
  loading: boolean;

  /**
   * Any error that occurred during loading
   */
  error: Error | null;

  /**
   * Manually refresh the data
   */
  refresh: () => Promise<void>;

  /**
   * Check if data needs refresh
   */
  isStale: boolean;

  /**
   * Last update timestamp
   */
  lastUpdated: number | null;
}

/**
 * React hook for accessing repository data from cache
 */
export function useRepositoryData(
  repoPath: string | null,
  options: UseRepositoryDataOptions = {},
): UseRepositoryDataResult {
  const { autoLoad = true, maxAge = 5 * 60 * 1000, subscribe = true } = options;

  const [data, setData] = useState<RepositoryCacheData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);

  const componentId = useRef(generateComponentId());
  const cache = useRef(RepositoryDataCache.getInstance());
  const loadingRef = useRef(false);

  /**
   * Load data from cache or fetch if needed
   */
  const loadData = useCallback(async () => {
    if (!repoPath || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Check if data exists in cache
      const cached = cache.current.get(repoPath, componentId.current);

      if (cached) {
        // Use cached data immediately
        setData(cached);
        setLastUpdated(Date.now());
        setIsStale(false);
        setLoading(false);
      } else if (autoLoad) {
        // Load data if not in cache
        const freshData = await cache.current.load(repoPath);
        setData(freshData);
        setLastUpdated(Date.now());
        setIsStale(false);
      } else {
        // No data and autoLoad is false
        setData(null);
      }
    } catch (err) {
      console.error(
        `[useRepositoryData] Error loading data for ${repoPath}:`,
        err,
      );
      setError(
        err instanceof Error
          ? err
          : new Error('Failed to load repository data'),
      );
      setData(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [repoPath, autoLoad]);

  /**
   * Manually refresh the data
   */
  const refresh = useCallback(async () => {
    if (!repoPath) return;

    setLoading(true);
    setError(null);

    try {
      // Force reload from server
      const freshData = await cache.current.load(repoPath);
      setData(freshData);
      setLastUpdated(Date.now());
      setIsStale(false);
    } catch (err) {
      console.error(
        `[useRepositoryData] Error refreshing data for ${repoPath}:`,
        err,
      );
      setError(
        err instanceof Error
          ? err
          : new Error('Failed to refresh repository data'),
      );
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  /**
   * Setup effect for initial load and subscription
   */
  useEffect(() => {
    if (!repoPath) {
      setData(null);
      setLastUpdated(null);
      setIsStale(false);
      return;
    }

    // Load initial data
    loadData();

    // Subscribe to updates if enabled
    let unsubscribe: (() => void) | null = null;

    if (subscribe) {
      unsubscribe = cache.current.subscribe(
        repoPath,
        componentId.current,
        (updatedData) => {
          setData(updatedData);
          setLastUpdated(Date.now());
          setIsStale(false);
        },
      );
    }

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      cache.current.unsubscribe(repoPath, componentId.current);
    };
  }, [repoPath, subscribe, loadData]);

  /**
   * Check if data is stale periodically
   */
  useEffect(() => {
    if (!lastUpdated || !maxAge) return;

    const checkStaleness = () => {
      const age = Date.now() - lastUpdated;
      setIsStale(age > maxAge);
    };

    // Check immediately
    checkStaleness();

    // Check periodically
    const interval = setInterval(checkStaleness, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [lastUpdated, maxAge]);

  return {
    data,
    loading,
    error,
    refresh,
    isStale,
    lastUpdated,
  };
}

/**
 * Hook for accessing multiple repositories at once
 */
export function useMultipleRepositoryData(
  repoPaths: string[],
  options: UseRepositoryDataOptions = {},
): Map<string, UseRepositoryDataResult> {
  const results = new Map<string, UseRepositoryDataResult>();

  // This is a simplified implementation
  // In a real app, you'd want to optimize this to batch requests
  repoPaths.forEach((path) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const result = useRepositoryData(path, options);
    results.set(path, result);
  });

  return results;
}

/**
 * Hook for accessing all repositories with caching
 */
export function useAllRepositories(options: UseRepositoryDataOptions = {}) {
  const [repositories, setRepositories] = useState<RepositoryCacheData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cache = useRef(RepositoryDataCache.getInstance());
  const componentId = useRef(generateComponentId());
  const alexandriaServiceRef = useRef<
    | typeof import('../main-process-api/AlexandriaService').AlexandriaService
    | null
  >(null);
  const subscriptionsRef = useRef(new Map<string, () => void>());

  const upsertRepositoryData = useCallback((repoData: RepositoryCacheData) => {
    setRepositories((prev) => {
      const index = prev.findIndex(
        (entry) => entry.repository.path === repoData.repository.path,
      );
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = repoData;
        return updated;
      }
      return [...prev, repoData];
    });
  }, []);

  const updateRepositoryInfo = useCallback((repo: AlexandriaEntry) => {
    const repoPath = repo.path as string | undefined;
    if (!repoPath) {
      return;
    }

    setRepositories((prev) => {
      const index = prev.findIndex(
        (entry) => entry.repository.path === repoPath,
      );
      if (index === -1) {
        // Repository not in array yet, add it with minimal cache data
        return [
          ...prev,
          {
            repository: repo,
            gitStatus: null,
            gitBranch: null,
            branchStatus: {
              ahead: 0,
              behind: 0,
              canFastForward: false,
              needsUpstream: false,
            },
            markdownFiles: [],
            lastFullRefresh: Date.now(),
          },
        ];
      }

      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        repository: {
          ...updated[index].repository,
          ...repo,
        },
      };
      return updated;
    });
  }, []);

  const ensureSubscription = useCallback(
    (repoPath: string) => {
      if (options.subscribe === false) {
        return;
      }

      if (subscriptionsRef.current.has(repoPath)) {
        return;
      }

      const subscriptionId = `${componentId.current}:${repoPath}`;
      const unsubscribe = cache.current.subscribe(
        repoPath,
        subscriptionId,
        (updatedData) => {
          upsertRepositoryData(updatedData);
        },
      );

      subscriptionsRef.current.set(repoPath, unsubscribe);
    },
    [options.subscribe, upsertRepositoryData],
  );

  const markRepoLoaded = useCallback(() => {
    setLoading((prev) => (prev ? false : prev));
  }, []);

  const loadAllRepositories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!alexandriaServiceRef.current) {
        const { AlexandriaService } = await import(
          '../main-process-api/AlexandriaService'
        );
        alexandriaServiceRef.current = AlexandriaService;
      }

      const repos = await alexandriaServiceRef.current.getRepositories();

      // Add all repos immediately and set loading to false so UI shows them
      repos.forEach((repo) => {
        const repoPath = repo.path as string | undefined;
        if (repoPath) {
          const cachedData = cache.current.get(repoPath, componentId.current);
          if (cachedData) {
            upsertRepositoryData(cachedData);
            updateRepositoryInfo(repo);
          } else {
            updateRepositoryInfo(repo);
          }
          ensureSubscription(repoPath);
        }
      });

      setLoading(false);

      // Load cache data in background if autoLoad is enabled
      if (options.autoLoad !== false) {
        Promise.all(
          repos.map(async (repo) => {
            const repoPath = repo.path as string | undefined;
            if (!repoPath) {
              return;
            }

            try {
              const cachedData = cache.current.get(
                repoPath,
                componentId.current,
              );
              if (cachedData) {
                // Already have cached data, skip
                return;
              }

              // Load cache data in background to enrich the repo
              const freshData = await cache.current.load(repoPath);
              upsertRepositoryData(freshData);
              updateRepositoryInfo(repo);
            } catch (err) {
              console.error(
                `[useAllRepositories] Failed to load repository ${repoPath}:`,
                err,
              );
            }
          }),
        ).catch((err) => {
          console.error('[useAllRepositories] Error loading cache data:', err);
        });
      }
    } catch (err) {
      console.error('[useAllRepositories] Error loading repositories:', err);
      setError(
        err instanceof Error ? err : new Error('Failed to load repositories'),
      );
    } finally {
      setLoading(false);
    }
  }, [
    options.autoLoad,
    upsertRepositoryData,
    updateRepositoryInfo,
    markRepoLoaded,
    ensureSubscription,
  ]);

  useEffect(() => {
    loadAllRepositories();

    // Subscribe to repository change events from Alexandria if subscribing is enabled
    let unsubscribeAlexandria: (() => void) | null = null;

    if (options.subscribe !== false) {
      import('../main-process-api/AlexandriaService').then(
        ({ AlexandriaService }) => {
          alexandriaServiceRef.current = AlexandriaService;

          unsubscribeAlexandria = AlexandriaService.onRepositoryChange(
            (event) => {
              console.log(
                '[useAllRepositories] Received repository change event:',
                event,
              );

              if (event.type === 'removed') {
                // Remove the repository from the list immediately
                setRepositories((prev) =>
                  prev.filter((r) => r.repository.name !== event.name),
                );
              } else if (event.type === 'added' && event.repository?.path) {
                const repoPath = event.repository.path as string;
                cache.current
                  .load(repoPath)
                  .then((data) => {
                    if (data) {
                      upsertRepositoryData(data);
                      ensureSubscription(repoPath);
                    }
                  })
                  .catch((err) => {
                    console.error(
                      '[useAllRepositories] Failed to load added repository:',
                      err,
                    );
                    updateRepositoryInfo(event.repository!);
                    ensureSubscription(repoPath);
                  });
              } else if (event.type === 'updated' && event.repository) {
                updateRepositoryInfo(event.repository);
                const repoPath = event.repository.path as string | undefined;
                if (repoPath) {
                  ensureSubscription(repoPath);
                }
              }
            },
          );
        },
      );
    }

    // Cleanup - capture refs in variables to avoid stale closure issues
    return () => {
      if (unsubscribeAlexandria) {
        unsubscribeAlexandria();
      }
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, [
    options.subscribe,
    loadAllRepositories,
    upsertRepositoryData,
    updateRepositoryInfo,
    ensureSubscription,
  ]);

  useEffect(() => {
    if (options.subscribe === false) {
      return;
    }

    const activePaths = new Set(
      repositories.map((entry) => entry.repository.path),
    );
    subscriptionsRef.current.forEach((unsubscribe, path) => {
      if (!activePaths.has(path)) {
        unsubscribe();
        subscriptionsRef.current.delete(path);
      }
    });
  }, [repositories, options.subscribe]);

  return {
    repositories,
    loading,
    error,
    refresh: loadAllRepositories,
  };
}
