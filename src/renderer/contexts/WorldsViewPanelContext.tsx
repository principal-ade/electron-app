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
  PanelActions,
  DataSlice,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  UserCollectionsSlice,
  UserCollectionsPanelActions,
  Collection,
  LocalProjectsPanelActions,
} from '@industry-theme/alexandria-panels';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { CollectionsService } from '../main-process-api/CollectionsService';
import { WindowService } from '../main-process-api/WindowService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import type { CollectionMembership } from '@principal-ai/alexandria-collections';
import type { DiscoveredRepository } from '@industry-theme/alexandria-panels';

/**
 * Extended actions for WorldsViewPanelProvider
 * Combines collection actions with local repository actions
 */
interface WorldsViewPanelActions
  extends PanelActions,
    Omit<UserCollectionsPanelActions, 'removeRepository'>,
    Pick<LocalProjectsPanelActions, 'openRepository' | 'registerRepository' | 'trackRepository'> {
  // Collections-specific removeRepository (named differently to avoid conflict)
  removeCollectionRepository?: (
    collectionId: string,
    repositoryId: string,
  ) => Promise<void>;
  // Add a repository to a collection (for drag-drop integration)
  addRepositoryToCollection?: (
    collectionId: string,
    repositoryPath: string,
    repositoryMetadata: any,
  ) => Promise<void>;
  // Copy to clipboard helper
  copyToClipboard?: (text: string) => Promise<void>;
}

/**
 * Extended context interface for WorldsView panels
 */
interface WorldsViewPanelContextValue extends PanelContextValue {
  // Selected collection (for coordination between panels)
  selectedCollection: Collection | null;
  setSelectedCollection: (collection: Collection | null) => void;
}

/**
 * Provider value containing context, actions, and events
 */
interface WorldsViewPanelProviderValue {
  context: WorldsViewPanelContextValue;
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
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
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
        const repos = await AlexandriaService.listLocalRepositories();
        setLocalRepositories(repos);

        // Also fetch discovered repositories
        const discovered = await AlexandriaService.discoverRepositories();
        setDiscoveredRepositories(discovered);
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
    try {
      setCollectionsLoading(true);
      setCollectionsError(null);

      const [collectionsData, membershipsData, repoStatus] = await Promise.all([
        CollectionsService.listCollections(),
        CollectionsService.listMemberships(),
        CollectionsService.getGitHubRepoStatus(),
      ]);

      setCollections(collectionsData);
      setCollectionMemberships(membershipsData);
      setCollectionsGitHubRepoExists(repoStatus.exists);
      setCollectionsGitHubRepoUrl(repoStatus.url);
    } catch (error) {
      console.error('[WorldsViewPanelProvider] Failed to fetch collections:', error);
      setCollectionsError((error as Error).message);
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
  const slices = useMemo(
    () =>
      new Map<string, DataSlice>([
        [
          'alexandriaRepositories',
          {
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
                const repos = await AlexandriaService.listLocalRepositories();
                setLocalRepositories(repos);
                const discovered = await AlexandriaService.discoverRepositories();
                setDiscoveredRepositories(discovered);
              } catch (error) {
                console.error(
                  '[WorldsViewPanelProvider] Failed to refresh local repositories:',
                  error,
                );
              } finally {
                setLocalRepositoriesLoading(false);
              }
            },
          },
        ],
        [
          'userCollections',
          {
            scope: 'global' as const,
            name: 'userCollections',
            data: {
              collections,
              memberships: collectionMemberships,
              loading: collectionsLoading,
              saving: collectionsSaving,
              error: collectionsError,
              gitHubRepoExists: collectionsGitHubRepoExists,
              gitHubRepoUrl: collectionsGitHubRepoUrl,
            } as UserCollectionsSlice,
            loading: collectionsLoading,
            error: (collectionsError ?? null) as string | null,
            refresh: fetchCollections,
          },
        ],
        [
          'collectionRepositories',
          {
            scope: 'global' as const,
            name: 'collectionRepositories',
            data: {
              collection: selectedCollection,
              // Get repository IDs for the selected collection
              repositoryIds: selectedCollection
                ? collectionMemberships
                    .filter((m) => m.collectionId === selectedCollection.id)
                    .map((m) => m.repositoryId)
                : [],
            },
            loading: collectionsLoading,
            error: null,
            refresh: fetchCollections,
          },
        ],
      ]) as Map<string, DataSlice>,
    [
      localRepositories,
      localRepositoriesLoading,
      discoveredRepositories,
      collections,
      collectionMemberships,
      collectionsLoading,
      collectionsSaving,
      collectionsError,
      collectionsGitHubRepoExists,
      collectionsGitHubRepoUrl,
      selectedCollection,
    ],
  );

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
          const collection = await CollectionsService.createCollection({
            name,
            description,
            icon,
          });
          await fetchCollections();
          return collection;
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
        setCollectionsSaving(true);
        try {
          await CollectionsService.deleteCollection(collectionId);
          await fetchCollections();

          // If the deleted collection was selected, clear selection
          if (selectedCollection?.id === collectionId) {
            setSelectedCollection(null);
          }

          events.emit({
            type: 'industry-theme.user-collections:collection:deleted',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: { collectionId },
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to delete collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      updateCollection: async (
        collectionId: string,
        updates: Partial<Collection>,
      ) => {
        console.info(
          '[WorldsViewPanelProvider] Updating collection:',
          collectionId,
        );
        setCollectionsSaving(true);
        try {
          await CollectionsService.updateCollection(collectionId, updates);
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:collection:updated',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: { collectionId, updates },
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to update collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
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

      removeCollectionRepository: async (
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
          await CollectionsService.removeRepository({
            collectionId,
            repositoryId,
          });
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

      disableGitHubSync: async () => {
        console.info('[WorldsViewPanelProvider] Disabling GitHub sync');
        setCollectionsSaving(true);
        try {
          await CollectionsService.disableGitHubSync();
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:github-sync-disabled',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: {},
          });
        } catch (error) {
          console.error(
            '[WorldsViewPanelProvider] Failed to disable GitHub sync:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

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

      // Local repository actions
      openRepository: async (entry: AlexandriaEntry) => {
        console.info(
          '[WorldsViewPanelProvider] Opening repository:',
          entry.name,
        );

        try {
          await WindowService.openDevWorkspace(entry.path);

          // Update lastOpenedAt timestamp
          await AlexandriaService.updateRepository(entry.name, {
            lastOpenedAt: new Date().toISOString(),
          });

          // Refresh repositories to update the list
          await slices.get('alexandriaRepositories')?.refresh();

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
          await FileSystemService.copyToClipboard(text);
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

  // Build context
  const context = useMemo<WorldsViewPanelContextValue>(
    () => ({
      scope: {},
      slices,
      adapters: {},
      getSlice: <T = unknown,>(name: string): DataSlice<T> | undefined => {
        return slices.get(name) as DataSlice<T> | undefined;
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
      hasSlice: (name: string, scope?: 'workspace' | 'repository'): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        return scope ? slice.scope === scope : true;
      },
      isSliceLoading: (
        name: string,
        scope?: 'workspace' | 'repository',
      ): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        if (scope && slice.scope !== scope) return false;
        return slice.loading;
      },
      refresh: async (
        scope?: 'workspace' | 'repository',
        sliceName?: string,
      ): Promise<void> => {
        const slicesToRefresh = Array.from(slices.values()).filter((slice) => {
          if (scope && slice.scope !== scope) return false;
          if (sliceName && slice.name !== sliceName) return false;
          return true;
        });

        await Promise.all(slicesToRefresh.map((slice) => slice.refresh()));
      },
      // Extended properties
      selectedCollection,
      setSelectedCollection,
    }),
    [slices, selectedCollection],
  );

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
