import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type {
  PanelContextValue,
  DataSlice,
  PanelEventEmitter,
  RepositoryMetadata,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  UserCollectionsPanelActions,
  UserCollectionsSlice,
  LocalProjectsPanelActions,
} from '@industry-theme/alexandria-panels';
import type {
  CustomRegion,
  CollectionMapPanelActions,
  RepositoryLayoutData,
} from '@industry-theme/repository-composition-panels';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { CollectionsService } from '../main-process-api/CollectionsService';
import { WindowService } from '../main-process-api/WindowService';
import type { Collection, CollectionMembership } from '@principal-ai/alexandria-collections';
import type { DiscoveredRepository } from '@industry-theme/alexandria-panels';

/**
 * Extended actions for WorldsViewPanelProvider
 * Combines collection actions with local repository actions and region management
 */
interface WorldsViewPanelActions
  extends CollectionMapPanelActions,
    UserCollectionsPanelActions,
    Omit<
      LocalProjectsPanelActions,
      'selectDirectory' | 'removeLocalRepository' | 'focusRepository' | 'getRepositoryWindowState'
    > {
  // Add a repository to a collection (for drag-drop integration)
  addRepositoryToCollection?: (
    collectionId: string,
    repositoryPath: string,
    repositoryMetadata: RepositoryMetadata,
  ) => Promise<void>;
  // Copy to clipboard helper
  copyToClipboard?: (text: string) => Promise<void>;
}

/**
 * Worlds view context type - contains only slice properties and custom state
 * Following the web-ade pattern
 */
export interface WorldsViewPanelContextType {
  // UserCollectionsPanelContext
  userCollections: DataSlice<UserCollectionsSlice>;
  // LocalProjectsPanelContext
  alexandriaRepositories: DataSlice<{
    repositories: AlexandriaEntry[];
    discoveredRepositories: DiscoveredRepository[];
    loading: boolean;
  }>;
  // CollectionMapPanelContext slice
  selectedCollectionView: DataSlice<{
    collection: Collection | null;
    repositories: AlexandriaEntry[];
    dependencies?: Record<string, string[]>;
  }>;
  // Custom state properties
  selectedCollection: Collection | null;
  setSelectedCollection: (collection: Collection | null) => void;
}

/**
 * Provider value containing context, actions, and events
 */
interface WorldsViewPanelProviderValue {
  context: PanelContextValue<WorldsViewPanelContextType>;
  actions: WorldsViewPanelActions;
  events: PanelEventEmitter;
}

const WorldsViewPanelContext =
  createContext<WorldsViewPanelProviderValue | null>(null);

interface WorldsViewPanelProviderProps {
  children: ReactNode;
}

export const WorldsViewPanelProvider: React.FC<
  WorldsViewPanelProviderProps
> = ({ children }) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // State for selected collection
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);

  // State for local repositories
  const [localRepositories, setLocalRepositories] = useState<AlexandriaEntry[]>(
    [],
  );
  const [localRepositoriesLoading, setLocalRepositoriesLoading] =
    useState(true);
  const [discoveredRepositories, setDiscoveredRepositories] = useState<
    DiscoveredRepository[]
  >([]);

  // State for collections
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionMemberships, setCollectionMemberships] = useState<
    CollectionMembership[]
  >([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionsSaving, setCollectionsSaving] = useState(false);
  const [collectionsError, setCollectionsError] = useState<Error | null>(null);
  const [collectionsGitHubRepoExists, setCollectionsGitHubRepoExists] =
    useState(false);
  const [collectionsGitHubRepoUrl, setCollectionsGitHubRepoUrl] = useState<
    string | null
  >(null);

  // Fetch local repositories on mount
  useEffect(() => {
    const fetchLocalRepositories = async () => {
      try {
        setLocalRepositoriesLoading(true);
        const repos = await AlexandriaService.getRepositories();
        setLocalRepositories(repos);

        // Note: Discovered repositories would require GitService and basePath
        // For now, WorldsView doesn't support discovered repos
        setDiscoveredRepositories([]);
      } catch (error) {
        console.error(
          '[WorldsViewPanelProvider] Failed to fetch local repositories:',
          error,
        );
      } finally {
        setLocalRepositoriesLoading(false);
      }
    };

    void fetchLocalRepositories();
  }, []);

  // Fetch collections on mount
  const fetchCollections = useCallback(async () => {
    console.info('[WorldsViewPanelProvider] 🔄 fetchCollections called');
    console.info('[WorldsViewPanelProvider] 🔍 Stack trace:');
    try {
      setCollectionsLoading(true);
      setCollectionsError(null);

      // Check if GitHub repo exists first
      const repoStatusResult = await CollectionsService.checkGitHubRepo();
      if (repoStatusResult.success && repoStatusResult.data) {
        setCollectionsGitHubRepoExists(repoStatusResult.data.exists);
        setCollectionsGitHubRepoUrl(repoStatusResult.data.repoUrl);
      }

      // Load collections
      const collectionsResult = await CollectionsService.getCollections();
      if (collectionsResult.success && collectionsResult.data) {
        setCollections(collectionsResult.data.collections as Collection[]);
        setCollectionMemberships(collectionsResult.data.memberships);
      } else {
        // No collections yet - start empty
        setCollections([]);
        setCollectionMemberships([]);
      }
    } catch (error) {
      console.error('[WorldsViewPanelProvider] Failed to fetch collections:', error);
      setCollectionsError(
        error instanceof Error
          ? error
          : new Error('Failed to load collections.'),
      );
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCollections();
  }, [fetchCollections]);

  // Listen for collection selection events from UserCollectionsPanel
  useEffect(() => {
    const unsubscribe = events.on<{ collection: Collection }>(
      'industry-theme.user-collections:collection:selected',
      (event) => {
        const collection = event.payload?.collection;
        if (collection) {
          console.info(
            '[WorldsViewPanelProvider] Collection selected:',
            collection.name,
          );
          setSelectedCollection(collection);
        } else {
          console.info('[WorldsViewPanelProvider] Collection deselected');
          setSelectedCollection(null);
        }
      },
    );

    return unsubscribe;
  }, [events]);

  // Build slices map
  // Create direct slice objects first for type-safe access by new v0.3.0+ panels
  const selectedCollectionMemberships = selectedCollection
    ? collectionMemberships.filter(m => m.collectionId === selectedCollection.id)
    : [];

  const selectedCollectionRepositoryIds = new Set(selectedCollectionMemberships.map(m => m.repositoryId));
  const selectedCollectionRepositories = localRepositories.filter(r => {
    const repoId = (r as any).github?.id || r.name;
    return selectedCollectionRepositoryIds.has(repoId);
  });

  // Create DataSlice for CollectionMapPanel
  const selectedCollectionViewSlice = useMemo<DataSlice<{
    collection: Collection | null;
    repositories: AlexandriaEntry[];
    dependencies?: Record<string, string[]>;
  }>>(
    () => ({
      scope: 'workspace' as const,
      name: 'selectedCollectionView',
      data: {
        collection: selectedCollection,
        repositories: selectedCollectionRepositories,
        dependencies: {}, // TODO: Add dependency graph support
      },
      loading: collectionsLoading || localRepositoriesLoading,
      error: collectionsError || null,
      refresh: fetchCollections,
    }),
    [
      selectedCollection,
      selectedCollectionRepositories,
      collectionsLoading,
      localRepositoriesLoading,
      collectionsError,
      fetchCollections,
    ],
  );

  // Explicit DataSlice: alexandriaRepositories
  const alexandriaRepositoriesSlice = useMemo<DataSlice<{
    repositories: AlexandriaEntry[];
    discoveredRepositories: DiscoveredRepository[];
    loading: boolean;
  }>>(
    () => ({
      scope: 'global' as const,
      name: 'alexandriaRepositories',
      data: {
        repositories: localRepositories,
        discoveredRepositories,
        loading: localRepositoriesLoading,
      },
      loading: localRepositoriesLoading,
      error: null,
      refresh: async () => {
        setLocalRepositoriesLoading(true);
        try {
          const repos = await AlexandriaService.getRepositories();
          setLocalRepositories(repos);
          // Note: Discovered repositories would require GitService and basePath
          setDiscoveredRepositories([]);
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to refresh local repositories:',
            error,
          );
        } finally {
          setLocalRepositoriesLoading(false);
        }
      },
    }),
    [localRepositories, discoveredRepositories, localRepositoriesLoading],
  );

  // Explicit DataSlice: userCollections
  const userCollectionsSlice = useMemo<DataSlice<UserCollectionsSlice>>(
    () => ({
      scope: 'global' as const,
      name: 'userCollections',
      data: {
        collections,
        memberships: collectionMemberships,
        loading: collectionsLoading,
        saving: collectionsSaving,
        error: collectionsError?.message, // UserCollectionsSlice expects string
        gitHubRepoExists: collectionsGitHubRepoExists,
        gitHubRepoUrl: collectionsGitHubRepoUrl,
      },
      loading: collectionsLoading,
      error: null,
      refresh: fetchCollections,
    }),
    [
      collections,
      collectionMemberships,
      collectionsLoading,
      collectionsSaving,
      collectionsError,
      collectionsGitHubRepoExists,
      collectionsGitHubRepoUrl,
      fetchCollections,
    ],
  );

  // Empty slices Map for backward compatibility with PanelContextValue interface
  const slices = useMemo<Map<string, DataSlice<unknown>>>(() => new Map(), []);

  // Define actions
  const actions = useMemo<WorldsViewPanelActions>(
    () => ({
      // Collection actions
      createCollection: async (
        name: string,
        description?: string,
        icon?: string,
      ) => {
        console.info('[WorldsViewPanelProvider] Creating collection:', name);
        setCollectionsSaving(true);
        try {
          const result = await CollectionsService.createCollection({
            name,
            description,
            icon,
          });
          await fetchCollections();
          return result.success && result.data ? result.data : null;
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to create collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      deleteCollection: async (collectionId: string) => {
        console.info(
          '[WorldsViewPanelProvider] Deleting collection:',
          collectionId,
        );

        // If the deleted collection was selected, clear selection
        if (selectedCollection?.id === collectionId) {
          setSelectedCollection(null);
        }

        // OPTIMISTIC UPDATE: Remove from local state immediately
        const optimisticCollections = collections.filter((c) => c.id !== collectionId);
        const optimisticMemberships = collectionMemberships.filter(
          (m) => m.collectionId !== collectionId,
        );
        setCollections(optimisticCollections);
        setCollectionMemberships(optimisticMemberships);

        events.emit({
          type: 'industry-theme.user-collections:collection:deleted',
          source: 'worlds-view',
          timestamp: Date.now(),
          payload: { collectionId },
        });

        // Background sync to GitHub
        setCollectionsSaving(true);
        CollectionsService.deleteCollection(collectionId)
          .then(() => {
            console.info('[WorldsViewPanelProvider] Collection deleted from GitHub:', collectionId);
          })
          .catch((error) => {
            console.error('[WorldsViewPanelProvider] Failed to delete collection from GitHub:', error);
            fetchCollections(); // Rollback on error
          })
          .finally(() => {
            setCollectionsSaving(false);
          });
      },

      updateCollection: async (
        collectionId: string,
        updates: Partial<Collection>,
      ) => {
        console.info(
          '[WorldsViewPanelProvider] Updating collection:',
          collectionId,
        );

        // OPTIMISTIC UPDATE: Update local state immediately
        const optimisticCollections = collections.map((c) =>
          c.id === collectionId
            ? { ...c, ...updates, updatedAt: Date.now() }
            : c,
        );
        setCollections(optimisticCollections);

        events.emit({
          type: 'industry-theme.user-collections:collection:updated',
          source: 'worlds-view',
          timestamp: Date.now(),
          payload: { collectionId, updates },
        });

        // Background sync to GitHub
        setCollectionsSaving(true);
        CollectionsService.updateCollection(collectionId, updates)
          .then(() => {
            console.info('[WorldsViewPanelProvider] Collection synced to GitHub:', collectionId);
          })
          .catch((error) => {
            console.error('[WorldsViewPanelProvider] Failed to update collection on GitHub:', error);
            fetchCollections(); // Rollback on error
          })
          .finally(() => {
            setCollectionsSaving(false);
          });
      },

      selectCollection: async (collection: Collection | null) => {
        console.info(
          '[WorldsViewPanelProvider] Selecting collection:',
          collection?.name,
        );
        setSelectedCollection(collection);

        events.emit({
          type: 'industry-theme.user-collections:collection:selected',
          source: 'worlds-view',
          timestamp: Date.now(),
          payload: { collection },
        });
      },

      removeRepositoryFromCollection: async (
        collectionId: string,
        repositoryId: string,
      ) => {
        console.info(
          '[WorldsViewPanelProvider] Removing repository from collection:',
          repositoryId,
          collectionId,
        );
        setCollectionsSaving(true);
        try {
          await CollectionsService.removeRepository(
            collectionId,
            repositoryId,
          );
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:collection:repository-removed',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: { collectionId, repositoryId },
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to remove repository from collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      addRepositoryToCollection: async (
        collectionId: string,
        repositoryPath: string,
        repositoryMetadata: any,
      ) => {
        console.info(
          '[WorldsViewPanelProvider] Adding repository to collection:',
          repositoryPath,
          collectionId,
          repositoryMetadata,
        );
        setCollectionsSaving(true);
        try {
          // Determine repository ID from metadata
          // Format: "owner/repo" or just "name"
          const repositoryId =
            repositoryMetadata?.github?.owner && repositoryMetadata?.name
              ? `${repositoryMetadata.github.owner}/${repositoryMetadata.name}`
              : repositoryMetadata?.name || repositoryPath;

          await CollectionsService.addRepository({
            collectionId,
            repositoryId,
            metadata: repositoryMetadata,
          });
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:collection:repository-added',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: { collectionId, repositoryId, repositoryPath },
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to add repository to collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      enableGitHubSync: async () => {
        console.info('[WorldsViewPanelProvider] Enabling GitHub sync');
        setCollectionsSaving(true);
        try {
          await CollectionsService.enableGitHubSync();
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:github-sync-enabled',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: {},
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to enable GitHub sync:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      // Note: disableGitHubSync is not available in CollectionsService
      // Users can manually delete the GitHub repo if needed

      syncCollectionsToGitHub: async () => {
        console.info('[WorldsViewPanelProvider] Syncing collections to GitHub');
        setCollectionsSaving(true);
        try {
          await CollectionsService.syncToGitHub();
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:synced-to-github',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: {},
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to sync to GitHub:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      // Region management actions (with optimistic updates)
      onRegionCreated: async (
        collectionId: string,
        region: Omit<CustomRegion, 'id'>,
      ): Promise<CustomRegion> => {
        console.info('[WorldsViewPanelProvider] Creating region:', region.name);

        const result = await CollectionsService.createRegion(collectionId, region);
        if (result.success && result.data) {
          await fetchCollections(); // Refresh from source
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to create region');
        }
      },

      onRegionUpdated: async (
        collectionId: string,
        regionId: string,
        updates: Partial<Omit<CustomRegion, 'id'>>,
      ): Promise<void> => {
        console.info('[WorldsViewPanelProvider] Updating region:', regionId);

        const result = await CollectionsService.updateRegion(collectionId, regionId, updates);
        if (result.success) {
          await fetchCollections(); // Refresh from source
        } else {
          throw new Error(result.error || 'Failed to update region');
        }
      },

      onRegionDeleted: async (
        collectionId: string,
        regionId: string,
      ): Promise<void> => {
        console.info('[WorldsViewPanelProvider] Deleting region:', regionId);

        const result = await CollectionsService.deleteRegion(collectionId, regionId);
        if (result.success) {
          await fetchCollections(); // Refresh from source
        } else {
          throw new Error(result.error || 'Failed to delete region');
        }
      },

      onRepositoryAssigned: async (
        collectionId: string,
        repositoryId: string,
        regionId: string,
      ): Promise<void> => {
        console.info(
          '[WorldsViewPanelProvider] Assigning repository to region:',
          repositoryId,
          regionId,
        );

        const result = await CollectionsService.assignRepositoryToRegion(
          collectionId,
          repositoryId,
          regionId,
        );
        if (result.success) {
          await fetchCollections(); // Refresh from source
        } else {
          throw new Error(result.error || 'Failed to assign repository to region');
        }
      },

      onRepositoryPositionUpdated: async (
        collectionId: string,
        repositoryId: string,
        layout: RepositoryLayoutData,
      ): Promise<void> => {
        console.info(
          '[WorldsViewPanelProvider] Updating repository position:',
          repositoryId,
          layout,
        );

        const result = await CollectionsService.updateRepositoryPosition(
          collectionId,
          repositoryId,
          layout,
        );
        if (result.success) {
          await fetchCollections(); // Refresh from source
        } else {
          throw new Error(result.error || 'Failed to update repository position');
        }
      },

      onBatchLayoutInitialized: async (
        collectionId: string,
        updates: {
          regions?: CustomRegion[];
          assignments?: Array<{ repositoryId: string; regionId: string }>;
          positions?: Array<{ repositoryId: string; layout: RepositoryLayoutData }>;
        },
      ): Promise<void> => {
        console.info(
          '[WorldsViewPanelProvider] Batch initializing layout for collection:',
          collectionId,
          updates,
        );

        const result = await CollectionsService.batchInitializeLayout(collectionId, updates);
        if (result.success) {
          await fetchCollections(); // Refresh from source
        } else {
          throw new Error(result.error || 'Failed to batch initialize layout');
        }
      },

      onInitializeDefaultRegions: async (
        collectionId: string,
        regions: CustomRegion[],
      ): Promise<void> => {
        console.info(
          '[WorldsViewPanelProvider] Initializing default regions for collection:',
          collectionId,
        );

        const result = await CollectionsService.batchInitializeLayout(collectionId, { regions });
        if (result.success) {
          await fetchCollections(); // Refresh from source
        } else {
          throw new Error(result.error || 'Failed to initialize default regions');
        }
      },

      onSwitchLayoutMode: async (
        collectionId: string,
        mode: 'auto' | 'manual',
      ): Promise<void> => {
        console.info(
          '[WorldsViewPanelProvider] Switching layout mode:',
          collectionId,
          mode,
        );

        const collection = collections.find((c) => c.id === collectionId);
        if (!collection) {
          throw new Error('Collection not found');
        }

        const updatedMetadata = {
          ...(collection.metadata || {}),
          layoutMode: mode,
        };

        // OPTIMISTIC UPDATE: Update local state immediately
        const optimisticCollections = collections.map((c) =>
          c.id === collectionId
            ? { ...c, metadata: updatedMetadata, updatedAt: Date.now() }
            : c,
        );
        setCollections(optimisticCollections);

        // Background sync to GitHub
        CollectionsService.updateCollection(collectionId, {
          metadata: updatedMetadata,
        }).catch((error) => {
          console.error('[WorldsViewPanelProvider] Failed to sync layout mode to GitHub:', error);
          fetchCollections(); // Rollback on error
        });
      },

      // Local repository actions
      openLocalRepository: async (entry: AlexandriaEntry) => {
        console.info(
          '[WorldsViewPanelProvider] Opening local repository:',
          entry.name,
        );

        try {
          await WindowService.openDevWorkspace({ alexandriaEntry: entry });

          // Update lastOpenedAt timestamp
          await AlexandriaService.updateLastOpened(entry.name);

          // Note: We don't refresh repositories here to avoid unnecessary rerenders
          // The lastOpenedAt update is just metadata and doesn't need immediate UI refresh

          events.emit({
            type: 'repository:opened',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: { entry },
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to open repository:',
            error,
          );
          throw error;
        }
      },

      registerRepository: async (name: string, path: string) => {
        console.info(
          '[WorldsViewPanelProvider] Registering repository:',
          name,
          path,
        );

        try {
          await AlexandriaService.registerRepository(name, path);
          await slices.get('alexandriaRepositories')?.refresh();

          events.emit({
            type: 'repository:registered',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: { name, path },
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to register repository:',
            error,
          );
          throw error;
        }
      },

      trackRepository: async (name: string, path: string) => {
        console.info(
          '[WorldsViewPanelProvider] Tracking repository:',
          name,
          path,
        );

        try {
          await AlexandriaService.registerRepository(name, path);
          await slices.get('alexandriaRepositories')?.refresh();

          events.emit({
            type: 'repository:tracked',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: { name, path },
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to track repository:',
            error,
          );
          throw error;
        }
      },

      // Utility actions
      copyToClipboard: async (text: string) => {
        try {
          // Use browser clipboard API instead
          await navigator.clipboard.writeText(text);
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to copy to clipboard:',
            error,
          );
          throw error;
        }
      },
    }),
    [
      events,
      slices,
      selectedCollection,
      collections,
      collectionMemberships,
      fetchCollections,
    ],
  );

  // Build context with typed slice properties for typed panels
  // Create context value following web-ade pattern
  const context = useMemo<PanelContextValue<WorldsViewPanelContextType>>(() => {
    return {
      // PanelContextValue core properties
      currentScope: {
        type: 'workspace' as const,
      },
      slices,
      adapters: {},
      // Legacy slice getter methods - kept for PanelContextValue interface compatibility
      getSlice: <T = unknown,>(_name: string): DataSlice<T> | undefined => {
        // No-op: Moving away from dynamic Map-based slices
        // Panels should access typed properties directly (context.userCollections)
        return undefined;
      },
      getWorkspaceSlice: <T = unknown,>(
        _name: string,
      ): DataSlice<T> | undefined => {
        return undefined; // No workspace scope in this context
      },
      getRepositorySlice: <T = unknown,>(
        _name: string,
      ): DataSlice<T> | undefined => {
        return undefined; // No repository scope in this context
      },
      // Legacy helper methods - kept for PanelContextValue interface compatibility
      // No-op stubs: actions handle their own refreshing, React handles reactivity
      hasSlice: (_name: string, _scope?: 'workspace' | 'repository'): boolean => {
        // No-op: Moving away from dynamic slice checking
        // Panels should access typed properties directly (context.userCollections)
        return false;
      },
      isSliceLoading: (
        _name: string,
        _scope?: 'workspace' | 'repository',
      ): boolean => {
        // No-op: Moving away from dynamic slice checking
        // Panels should access typed properties directly (context.userCollections.loading)
        return false;
      },
      refresh: async (
        _scope?: 'workspace' | 'repository',
        _sliceName?: string,
      ): Promise<void> => {
        // No-op: Actions handle their own data refreshing
        // React's reactivity handles UI updates automatically
        // Any actual refresh should be triggered via actions, not context.refresh()
      },
      // Custom state properties
      selectedCollection,
      setSelectedCollection,
      // Explicit typed slice properties
      userCollections: userCollectionsSlice,
      alexandriaRepositories: alexandriaRepositoriesSlice,
      // CollectionMapPanel slice (not full DataSlice - simplified structure)
      selectedCollectionView: selectedCollectionViewSlice,
    };
  }, [
    slices,
    selectedCollection,
    userCollectionsSlice,
    alexandriaRepositoriesSlice,
    selectedCollectionViewSlice,
  ]);

  // Combine into provider value
  const value: WorldsViewPanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
    }),
    [context, actions, events],
  );

  return (
    <WorldsViewPanelContext.Provider value={value}>
      {children}
    </WorldsViewPanelContext.Provider>
  );
};

export const useWorldsViewPanelProvider = (): WorldsViewPanelProviderValue => {
  const value = useContext(WorldsViewPanelContext);
  if (!value) {
    throw new Error(
      'useWorldsViewPanelProvider must be used within a WorldsViewPanelProvider',
    );
  }
  return value;
};

export default WorldsViewPanelContext;

/**
 * TODO: Quality Metrics Loading for Collections
 *
 * This pattern was removed from ProjectsPanelContext.tsx and can be adapted
 * for loading quality metrics for repositories in collections.
 *
 * Reference implementation:
 *
 * ```typescript
 * // State for quality metrics (keyed by repository path)
 * const [qualityDataByRepo, setQualityDataByRepo] = useState<
 *   Record<string, {
 *     packages: Array<{
 *       name: string;
 *       version?: string;
 *       metrics: Record<string, number>;
 *     }>;
 *     lastUpdated: string;
 *   }>
 * >({});
 * const [qualityLoading, setQualityLoading] = useState(false);
 *
 * // Fetch quality metrics when collection repositories change
 * useEffect(() => {
 *   let isCurrent = true;
 *
 *   const fetchQualityForCollectionRepos = async () => {
 *     const repositories = selectedCollectionView.data.repositories;
 *     if (!selectedCollection || repositories.length === 0) {
 *       return;
 *     }
 *
 *     setQualityLoading(true);
 *     const newQualityData: typeof qualityDataByRepo = {};
 *
 *     // Fetch quality for each repository in parallel
 *     await Promise.all(
 *       repositories.map(async (repo) => {
 *         try {
 *           if (!repo.path) return;
 *
 *           // Get git remote info
 *           const remoteInfo = await RepositoryMonitoringService.getGitRemoteInfo(repo.path);
 *           if (!remoteInfo?.remoteUrl) return;
 *
 *           const githubInfo = parseGitHubRemote(remoteInfo.remoteUrl);
 *           if (!githubInfo) return;
 *
 *           // Get current branch
 *           const gitStatus = await RepositoryMonitoringService.getGitStatus(repo.path);
 *           const branch = gitStatus?.branch || 'main';
 *
 *           // Fetch quality metrics
 *           const artifactData = await GitHubArtifactService.getLatestQualityMetrics(
 *             githubInfo.owner,
 *             githubInfo.repo,
 *             branch,
 *           );
 *
 *           if (artifactData) {
 *             const packages = artifactData.qualityMetrics.packages.map((pkg) => ({
 *               name: pkg.name,
 *               metrics: pkg.hexagon as unknown as Record<string, number>,
 *             }));
 *
 *             newQualityData[repo.path] = {
 *               packages,
 *               lastUpdated: artifactData.timestamp,
 *             };
 *           }
 *         } catch (error) {
 *           console.error(`Failed to fetch quality for ${repo.name}:`, error);
 *         }
 *       }),
 *     );
 *
 *     if (isCurrent) {
 *       setQualityDataByRepo(newQualityData);
 *       setQualityLoading(false);
 *     }
 *   };
 *
 *   fetchQualityForCollectionRepos();
 *
 *   return () => {
 *     isCurrent = false;
 *   };
 * }, [selectedCollection?.id, selectedCollectionView.data.repositories]);
 *
 * // Then expose via a slice for RepositoryQualityGridPanel:
 * const repositoriesQualitySlice = useMemo<DataSlice<unknown>>(
 *   () => ({
 *     scope: 'workspace' as const,
 *     name: 'repositoriesQuality',
 *     data: {
 *       repositories: Object.entries(qualityDataByRepo).map(
 *         ([repoPath, repoData]) => ({
 *           id: repoPath,
 *           name: repoPath.split('/').pop() || repoPath,
 *           path: repoPath,
 *           packages: repoData.packages.map((pkg) => ({
 *             name: pkg.name,
 *             version: pkg.version,
 *             metrics: pkg.metrics,
 *           })),
 *         }),
 *       ),
 *     },
 *     loading: qualityLoading,
 *     error: null,
 *     refresh: async () => { ... },
 *   }),
 *   [qualityDataByRepo, qualityLoading],
 * );
 * ```
 */
