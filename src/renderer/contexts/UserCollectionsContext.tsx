/**
 * UserCollectionsContext - React context for managing user repository collections
 *
 * Provides state management for collections synced to GitHub, with support for
 * CRUD operations and real-time sync status.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  Collection,
  CollectionMembership,
} from '@principal-ai/alexandria-collections';
import { CollectionsService } from '../main-process-api/CollectionsService';
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
} from '../../shared/main-process-api-interfaces/CollectionsAPI';

// ========================================
// Types
// ========================================

export interface UserCollectionsState {
  collections: Collection[];
  memberships: CollectionMembership[];
  loading: boolean;
  error: Error | null;
  saving: boolean;
  gitHubRepoExists: boolean;
  gitHubRepoUrl: string | null;
}

export interface UserCollectionsActions {
  // Collection CRUD
  createCollection: (
    name: string,
    description?: string,
    icon?: string,
  ) => Promise<Collection | null>;
  updateCollection: (
    id: string,
    updates: UpdateCollectionInput,
  ) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;

  // Membership management
  addRepository: (
    collectionId: string,
    repositoryId: string,
    metadata?: { pinned?: boolean; notes?: string },
  ) => Promise<void>;
  removeRepository: (
    collectionId: string,
    repositoryId: string,
  ) => Promise<void>;

  // GitHub integration
  enableGitHub: () => Promise<void>;
  refresh: () => Promise<void>;

  // Utility functions
  getCollectionRepositories: (collectionId: string) => string[];
  getCollection: (id: string) => Collection | undefined;
  isRepositoryInCollection: (
    collectionId: string,
    repositoryId: string,
  ) => boolean;
}

export interface UserCollectionsContextValue {
  state: UserCollectionsState;
  actions: UserCollectionsActions;
}

// ========================================
// Context
// ========================================

const UserCollectionsContext =
  createContext<UserCollectionsContextValue | null>(null);

// ========================================
// Provider
// ========================================

interface UserCollectionsProviderProps {
  children: ReactNode;
}

export const UserCollectionsProvider: React.FC<
  UserCollectionsProviderProps
> = ({ children }) => {
  // State
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberships, setMemberships] = useState<CollectionMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [gitHubRepoExists, setGitHubRepoExists] = useState(false);
  const [gitHubRepoUrl, setGitHubRepoUrl] = useState<string | null>(null);

  // Fetch collections on mount
  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CollectionsService.getCollections();
      if (result.success && result.data) {
        setCollections(result.data.collections);
        setMemberships(result.data.memberships);
        setGitHubRepoExists(result.data.gitHubRepoExists);
        setGitHubRepoUrl(result.data.gitHubRepoUrl);
      } else if (result.error) {
        setError(new Error(result.error));
      }
    } catch (err) {
      console.error('[UserCollectionsContext] Failed to fetch collections:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch collections'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Actions
  const createCollection = useCallback(
    async (
      name: string,
      description?: string,
      icon?: string,
    ): Promise<Collection | null> => {
      setSaving(true);
      setError(null);
      try {
        const input: CreateCollectionInput = { name, description, icon };
        const result = await CollectionsService.createCollection(input);
        if (result.success && result.data) {
          setCollections((prev) => [...prev, result.data!]);
          return result.data;
        } else if (result.error) {
          setError(new Error(result.error));
        }
        return null;
      } catch (err) {
        console.error('[UserCollectionsContext] Failed to create collection:', err);
        setError(err instanceof Error ? err : new Error('Failed to create collection'));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const updateCollection = useCallback(
    async (id: string, updates: UpdateCollectionInput): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        const result = await CollectionsService.updateCollection(id, updates);
        if (result.success && result.data) {
          setCollections((prev) =>
            prev.map((c) => (c.id === id ? result.data! : c)),
          );
        } else if (result.error) {
          setError(new Error(result.error));
        }
      } catch (err) {
        console.error('[UserCollectionsContext] Failed to update collection:', err);
        setError(err instanceof Error ? err : new Error('Failed to update collection'));
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const deleteCollection = useCallback(async (id: string): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const result = await CollectionsService.deleteCollection(id);
      if (result.success) {
        setCollections((prev) => prev.filter((c) => c.id !== id));
        setMemberships((prev) => prev.filter((m) => m.collectionId !== id));
      } else if (result.error) {
        setError(new Error(result.error));
      }
    } catch (err) {
      console.error('[UserCollectionsContext] Failed to delete collection:', err);
      setError(err instanceof Error ? err : new Error('Failed to delete collection'));
    } finally {
      setSaving(false);
    }
  }, []);

  const addRepository = useCallback(
    async (
      collectionId: string,
      repositoryId: string,
      metadata?: { pinned?: boolean; notes?: string },
    ): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        const result = await CollectionsService.addRepository({
          collectionId,
          repositoryId,
          metadata,
        });
        if (result.success) {
          const newMembership: CollectionMembership = {
            collectionId,
            repositoryId,
            addedAt: Date.now(),
            metadata,
          };
          setMemberships((prev) => [...prev, newMembership]);
        } else if (result.error) {
          setError(new Error(result.error));
        }
      } catch (err) {
        console.error('[UserCollectionsContext] Failed to add repository:', err);
        setError(err instanceof Error ? err : new Error('Failed to add repository'));
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const removeRepository = useCallback(
    async (collectionId: string, repositoryId: string): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        const result = await CollectionsService.removeRepository(
          collectionId,
          repositoryId,
        );
        if (result.success) {
          setMemberships((prev) =>
            prev.filter(
              (m) =>
                !(m.collectionId === collectionId && m.repositoryId === repositoryId),
            ),
          );
        } else if (result.error) {
          setError(new Error(result.error));
        }
      } catch (err) {
        console.error('[UserCollectionsContext] Failed to remove repository:', err);
        setError(err instanceof Error ? err : new Error('Failed to remove repository'));
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const enableGitHub = useCallback(async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const result = await CollectionsService.enableGitHubSync();
      if (result.success && result.data) {
        setGitHubRepoExists(true);
        setGitHubRepoUrl(result.data.repoUrl);
      } else if (result.error) {
        setError(new Error(result.error));
      }
    } catch (err) {
      console.error('[UserCollectionsContext] Failed to enable GitHub sync:', err);
      setError(err instanceof Error ? err : new Error('Failed to enable GitHub sync'));
    } finally {
      setSaving(false);
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchCollections();
  }, [fetchCollections]);

  // Utility functions
  const getCollectionRepositories = useCallback(
    (collectionId: string): string[] => {
      return memberships
        .filter((m) => m.collectionId === collectionId)
        .map((m) => m.repositoryId);
    },
    [memberships],
  );

  const getCollection = useCallback(
    (id: string): Collection | undefined => {
      return collections.find((c) => c.id === id);
    },
    [collections],
  );

  const isRepositoryInCollection = useCallback(
    (collectionId: string, repositoryId: string): boolean => {
      return memberships.some(
        (m) => m.collectionId === collectionId && m.repositoryId === repositoryId,
      );
    },
    [memberships],
  );

  // Memoized state
  const state: UserCollectionsState = useMemo(
    () => ({
      collections,
      memberships,
      loading,
      error,
      saving,
      gitHubRepoExists,
      gitHubRepoUrl,
    }),
    [collections, memberships, loading, error, saving, gitHubRepoExists, gitHubRepoUrl],
  );

  // Memoized actions
  const actions: UserCollectionsActions = useMemo(
    () => ({
      createCollection,
      updateCollection,
      deleteCollection,
      addRepository,
      removeRepository,
      enableGitHub,
      refresh,
      getCollectionRepositories,
      getCollection,
      isRepositoryInCollection,
    }),
    [
      createCollection,
      updateCollection,
      deleteCollection,
      addRepository,
      removeRepository,
      enableGitHub,
      refresh,
      getCollectionRepositories,
      getCollection,
      isRepositoryInCollection,
    ],
  );

  // Context value
  const value: UserCollectionsContextValue = useMemo(
    () => ({ state, actions }),
    [state, actions],
  );

  return (
    <UserCollectionsContext.Provider value={value}>
      {children}
    </UserCollectionsContext.Provider>
  );
};

// ========================================
// Hook
// ========================================

export const useUserCollections = (): UserCollectionsContextValue => {
  const context = useContext(UserCollectionsContext);
  if (!context) {
    throw new Error(
      'useUserCollections must be used within a UserCollectionsProvider',
    );
  }
  return context;
};

// Convenience hooks
export const useCollectionsState = (): UserCollectionsState => {
  const { state } = useUserCollections();
  return state;
};

export const useCollectionsActions = (): UserCollectionsActions => {
  const { actions } = useUserCollections();
  return actions;
};

export default UserCollectionsContext;
