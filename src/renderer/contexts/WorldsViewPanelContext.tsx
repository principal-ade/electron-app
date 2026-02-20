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
  Collection,
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
import type { CollectionMembership } from '@principal-ai/alexandria-collections';
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
  // CollectionMapPanel slice (not full DataSlice - simplified structure)
  selectedCollectionView: {
    data: {
      collection: Collection | null;
      memberships: CollectionMembership[];
      repositories: AlexandriaEntry[];
      dependencies?: Record<string, string[]>;
    };
    loading: boolean;
    error: string | null;
  };
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

  // Create simplified slice for CollectionMapPanel (it doesn't use full DataSlice interface)
  const selectedCollectionViewSlice = useMemo(
    () => ({
      data: selectedCollection
        ? {
            collection: selectedCollection,
            memberships: selectedCollectionMemberships,
            repositories: selectedCollectionRepositories,
            dependencies: {}, // TODO: Add dependency graph support
          }
        : {
            collection: null,
            memberships: [],
            repositories: [],
            dependencies: {},
          },
      loading: collectionsLoading || localRepositoriesLoading,
      error: collectionsError?.message || null,
    }),
    [
      selectedCollection,
      selectedCollectionMemberships,
      selectedCollectionRepositories,
      collectionsLoading,
      localRepositoriesLoading,
      collectionsError,
    ],
  );

  // Full DataSlice version for the slices Map (backward compat)
  const selectedCollectionViewDataSlice: DataSlice<unknown> = useMemo(
    () => ({
      scope: 'global' as const,
      name: 'selectedCollectionView',
      data: selectedCollectionViewSlice.data,
      loading: selectedCollectionViewSlice.loading,
      error: selectedCollectionViewSlice.error
        ? new Error(selectedCollectionViewSlice.error)
        : null,
      refresh: async () => {
        await fetchCollections();
      },
    }),
    [selectedCollectionViewSlice, fetchCollections],
  );

  const slices = useMemo<Map<string, DataSlice<unknown>>>(() => {
    console.info('[WorldsViewPanelProvider] 🔄 Recomputing slices with', collectionMemberships.length, 'memberships');
    console.info('[WorldsViewPanelProvider] 🔄 Selected collection:', selectedCollection?.name, 'has', selectedCollectionMemberships.length, 'memberships');

    return new Map([
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
              error: collectionsError?.message, // UserCollectionsSlice expects string
              gitHubRepoExists: collectionsGitHubRepoExists,
              gitHubRepoUrl: collectionsGitHubRepoUrl,
            },
            loading: collectionsLoading,
            error: null,
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
        ['selectedCollectionView', selectedCollectionViewDataSlice as DataSlice<unknown>],
      ]);
  }, [
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
        region: Omit<CustomRegion, 'id' | 'createdAt'>,
      ): Promise<CustomRegion> => {
        console.info('[WorldsViewPanelProvider] Creating region:', region.name);

        const collection = collections.find((c) => c.id === collectionId);
        if (!collection) {
          throw new Error('Collection not found');
        }

        const newRegion: CustomRegion = {
          ...region,
          id: `region-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          createdAt: Date.now(),
        };

        // If currently in auto mode, switch to manual when user adds a region
        const currentLayoutMode = collection.metadata?.layoutMode || 'auto';
        const updatedMetadata = {
          ...(collection.metadata || {}),
          customRegions: [
            ...((collection.metadata?.customRegions as CustomRegion[]) || []),
            newRegion,
          ],
          // Auto-switch to manual mode when user manually creates a region
          layoutMode: currentLayoutMode === 'auto' ? 'manual' : currentLayoutMode,
        };

        // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
        const optimisticCollections = collections.map((c) =>
          c.id === collectionId
            ? { ...c, metadata: updatedMetadata, updatedAt: Date.now() }
            : c,
        );

        console.info('[WorldsViewPanelProvider] Optimistic update - new region:', newRegion);
        console.info('[WorldsViewPanelProvider] Updated metadata:', updatedMetadata);
        console.info('[WorldsViewPanelProvider] Updated collection:', optimisticCollections.find(c => c.id === collectionId));

        setCollections(optimisticCollections);

        // Background sync to GitHub (with error handling)
        CollectionsService.updateCollection(collectionId, {
          metadata: updatedMetadata,
        })
          .then(() => {
            console.info('[WorldsViewPanelProvider] Region synced to GitHub:', newRegion.id);
          })
          .catch((error) => {
            console.error('[WorldsViewPanelProvider] Failed to sync region to GitHub:', error);
            // On error, refetch from GitHub to get truth
            fetchCollections();
          });

        return newRegion;
      },

      onRegionUpdated: async (
        collectionId: string,
        regionId: string,
        updates: Partial<CustomRegion>,
      ): Promise<void> => {
        console.info('[WorldsViewPanelProvider] Updating region:', regionId);

        const collection = collections.find((c) => c.id === collectionId);
        if (!collection) {
          throw new Error('Collection not found');
        }

        const customRegions = (collection.metadata?.customRegions as CustomRegion[]) || [];
        const updatedRegions = customRegions.map((r) =>
          r.id === regionId ? { ...r, ...updates } : r,
        );

        // If currently in auto mode, switch to manual when user updates a region
        const currentLayoutMode = collection.metadata?.layoutMode || 'auto';
        const updatedMetadata = {
          ...(collection.metadata || {}),
          customRegions: updatedRegions,
          // Auto-switch to manual mode when user manually updates a region
          layoutMode: currentLayoutMode === 'auto' ? 'manual' : currentLayoutMode,
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
          console.error('[WorldsViewPanelProvider] Failed to sync region update to GitHub:', error);
          fetchCollections(); // Rollback on error
        });
      },

      onRegionDeleted: async (
        collectionId: string,
        regionId: string,
      ): Promise<void> => {
        console.info('[WorldsViewPanelProvider] Deleting region:', regionId);

        const collection = collections.find((c) => c.id === collectionId);
        if (!collection) {
          throw new Error('Collection not found');
        }

        const customRegions = (collection.metadata?.customRegions as CustomRegion[]) || [];
        const updatedRegions = customRegions.filter((r) => r.id !== regionId);

        // If currently in auto mode, switch to manual when user deletes a region
        const currentLayoutMode = collection.metadata?.layoutMode || 'auto';
        const updatedMetadata = {
          ...(collection.metadata || {}),
          customRegions: updatedRegions,
          // Auto-switch to manual mode when user manually deletes a region
          layoutMode: currentLayoutMode === 'auto' ? 'manual' : currentLayoutMode,
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
          console.error('[WorldsViewPanelProvider] Failed to sync region deletion to GitHub:', error);
          fetchCollections(); // Rollback on error
        });
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

        const membership = collectionMemberships.find(
          (m) => m.collectionId === collectionId && m.repositoryId === repositoryId,
        );

        if (!membership) {
          throw new Error('Membership not found');
        }

        // Update membership metadata with regionId
        const updatedMetadata = {
          ...(membership.metadata || {}),
          regionId,
        };

        // OPTIMISTIC UPDATE: Update local memberships immediately
        setCollectionMemberships((prev) =>
          prev.map((m) =>
            m.collectionId === collectionId && m.repositoryId === repositoryId
              ? { ...m, metadata: updatedMetadata }
              : m,
          )
        );

        // Background sync to GitHub (remove and re-add)
        CollectionsService.removeRepository(collectionId, repositoryId)
          .then(() =>
            CollectionsService.addRepository({
              collectionId,
              repositoryId,
              metadata: updatedMetadata,
            }),
          )
          .catch((error) => {
            console.error('[WorldsViewPanelProvider] Failed to sync repository assignment to GitHub:', error);
            fetchCollections(); // Rollback on error
          });
      },

      onRepositoryPositionUpdated: async (
        collectionId: string,
        repositoryId: string,
        layout: RepositoryLayoutData,
      ): Promise<void> => {
        // Look up repository name for better logging
        const repo = localRepositories.find(r => {
          const repoId = (r as any).github?.id || r.name;
          return repoId === repositoryId;
        });
        const repoName = repo?.name || repositoryId;

        console.info(
          '[WorldsViewPanelProvider] 🎯 START: Moving',
          repoName,
          'to',
          layout,
        );

        const membership = collectionMemberships.find(
          (m) => m.collectionId === collectionId && m.repositoryId === repositoryId,
        );

        if (!membership) {
          throw new Error(`Membership not found for ${repoName}`);
        }

        console.info('[WorldsViewPanelProvider] 📄 Current position:', membership.metadata?.layout || 'none');

        // Update membership metadata with layout
        const updatedMetadata = {
          ...(membership.metadata || {}),
          layout,
        };

        console.info('[WorldsViewPanelProvider] 📝 New position:', layout, 'for', repoName);
        console.info('[WorldsViewPanelProvider] 🔍 Region for this repo:', membership.metadata?.regionId || 'none');

        // OPTIMISTIC UPDATE: Update local memberships immediately
        console.info('[WorldsViewPanelProvider] ⚡ OPTIMISTIC UPDATE: Applying local state change');
        setCollectionMemberships((prev) => {
          const updated = prev.map((m) =>
            m.collectionId === collectionId && m.repositoryId === repositoryId
              ? { ...m, metadata: updatedMetadata }
              : m,
          );
          console.info('[WorldsViewPanelProvider] ⚡ OPTIMISTIC UPDATE: New memberships state:', updated);
          return updated;
        });

        console.info('[WorldsViewPanelProvider] 🌐 Starting GitHub sync...');
        // Background sync to GitHub (remove and re-add)
        CollectionsService.removeRepository(collectionId, repositoryId)
          .then(() => {
            console.info('[WorldsViewPanelProvider] 🌐 Removed from GitHub, now re-adding...');
            return CollectionsService.addRepository({
              collectionId,
              repositoryId,
              metadata: updatedMetadata,
            });
          })
          .then(() => {
            console.info('[WorldsViewPanelProvider] ✅ GitHub sync completed successfully');
          })
          .catch((error) => {
            console.error('[WorldsViewPanelProvider] ❌ Failed to sync repository position to GitHub:', error);
            console.info('[WorldsViewPanelProvider] 🔄 Rolling back via fetchCollections...');
            fetchCollections(); // Rollback on error
          });
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

        const collection = collections.find((c) => c.id === collectionId);
        if (!collection) {
          throw new Error('Collection not found');
        }

        // Build optimistic updates in one pass
        let optimisticCollections = collections;
        let optimisticMemberships = collectionMemberships;

        // Update collection with regions if provided
        if (updates.regions && updates.regions.length > 0) {
          const updatedMetadata = {
            ...(collection.metadata || {}),
            customRegions: updates.regions,
          };

          optimisticCollections = collections.map((c) =>
            c.id === collectionId
              ? { ...c, metadata: updatedMetadata, updatedAt: Date.now() }
              : c,
          );
        }

        // Update memberships with assignments and positions
        if (updates.assignments || updates.positions) {
          optimisticMemberships = collectionMemberships.map((m) => {
            if (m.collectionId !== collectionId) return m;

            const assignment = updates.assignments?.find(
              (a) => a.repositoryId === m.repositoryId,
            );
            const position = updates.positions?.find(
              (p) => p.repositoryId === m.repositoryId,
            );

            if (!assignment && !position) return m;

            const updatedMetadata = {
              ...(m.metadata || {}),
              ...(assignment ? { regionId: assignment.regionId } : {}),
              ...(position ? { layout: position.layout } : {}),
            };

            return { ...m, metadata: updatedMetadata };
          });
        }

        // Single state update for all changes - 1 re-render!
        setCollections(optimisticCollections);
        setCollectionMemberships(optimisticMemberships);

        // Background sync to GitHub
        if (updates.regions && updates.regions.length > 0) {
          const updatedMetadata = {
            ...(collection.metadata || {}),
            customRegions: updates.regions,
          };

          CollectionsService.updateCollection(collectionId, {
            metadata: updatedMetadata,
          }).catch((error) => {
            console.error('[WorldsViewPanelProvider] Failed to sync regions to GitHub:', error);
            fetchCollections(); // Rollback on error
          });
        }

        // Sync membership updates (assignments + positions)
        if (updates.assignments || updates.positions) {
          const membershipUpdates = collectionMemberships
            .filter((m) => m.collectionId === collectionId)
            .map((m) => {
              const assignment = updates.assignments?.find(
                (a) => a.repositoryId === m.repositoryId,
              );
              const position = updates.positions?.find(
                (p) => p.repositoryId === m.repositoryId,
              );

              if (!assignment && !position) return null;

              const updatedMetadata = {
                ...(m.metadata || {}),
                ...(assignment ? { regionId: assignment.regionId } : {}),
                ...(position ? { layout: position.layout } : {}),
              };

              return {
                collectionId,
                repositoryId: m.repositoryId,
                metadata: updatedMetadata,
              };
            })
            .filter((update): update is { collectionId: string; repositoryId: string; metadata: any } => update !== null);

          // Batch sync all membership updates
          Promise.all(
            membershipUpdates.map((update) =>
              CollectionsService.removeRepository(update.collectionId, update.repositoryId)
                .then(() => CollectionsService.addRepository(update)),
            ),
          ).catch((error) => {
            console.error('[WorldsViewPanelProvider] Failed to sync membership updates to GitHub:', error);
            fetchCollections(); // Rollback on error
          });
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

        const collection = collections.find((c) => c.id === collectionId);
        if (!collection) {
          throw new Error('Collection not found');
        }

        const updatedMetadata = {
          ...(collection.metadata || {}),
          customRegions: regions,
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
          console.error('[WorldsViewPanelProvider] Failed to sync default regions to GitHub:', error);
          fetchCollections(); // Rollback on error
        });
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
      // Custom state properties
      selectedCollection,
      setSelectedCollection,
      // Typed slice properties from slices map
      userCollections: slices.get('userCollections') as DataSlice<UserCollectionsSlice>,
      alexandriaRepositories: slices.get('alexandriaRepositories') as DataSlice<{
        repositories: AlexandriaEntry[];
        discoveredRepositories: DiscoveredRepository[];
        loading: boolean;
      }>,
      // CollectionMapPanel slice (not full DataSlice - simplified structure)
      selectedCollectionView: selectedCollectionViewSlice,
    };
  }, [slices, selectedCollection, selectedCollectionViewSlice]);

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
