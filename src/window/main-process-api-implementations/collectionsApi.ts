/**
 * Collections API - Preload implementation for renderer process
 *
 * Exposes collection management functionality to React components via IPC.
 */

import { ipcRenderer } from 'electron';
import {
  CollectionsAPIEvent,
  type CollectionsAPI,
  type CollectionsState,
  type CreateCollectionInput,
  type UpdateCollectionInput,
  type AddRepositoryInput,
  type CollectionsResult,
  type GitHubSyncStatus,
  type PublicCollectionsResult,
} from '../../shared/main-process-api-interfaces/CollectionsAPI';
import type {
  Collection,
  CustomRegion,
  RepositoryLayoutData,
} from '@principal-ai/alexandria-collections';

export const collectionsAPI: CollectionsAPI = {
  // Core CRUD operations
  getCollections: (): Promise<CollectionsResult<CollectionsState>> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.GET_COLLECTIONS);
  },

  createCollection: (
    input: CreateCollectionInput,
  ): Promise<CollectionsResult<Collection>> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.CREATE_COLLECTION, input);
  },

  updateCollection: (
    id: string,
    input: UpdateCollectionInput,
  ): Promise<CollectionsResult<Collection>> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.UPDATE_COLLECTION, id, input);
  },

  deleteCollection: (id: string): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.DELETE_COLLECTION, id);
  },

  // Membership operations
  addRepository: (input: AddRepositoryInput): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.ADD_REPOSITORY, input);
  },

  removeRepository: (
    collectionId: string,
    repositoryId: string,
  ): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.REMOVE_REPOSITORY,
      collectionId,
      repositoryId,
    );
  },

  getCollectionRepositories: (
    collectionId: string,
  ): Promise<CollectionsResult<string[]>> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.GET_COLLECTION_REPOSITORIES,
      collectionId,
    );
  },

  // GitHub sync operations
  checkGitHubRepo: (): Promise<CollectionsResult<GitHubSyncStatus>> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.CHECK_GITHUB_REPO);
  },

  enableGitHubSync: (): Promise<CollectionsResult<{ repoUrl: string }>> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.ENABLE_GITHUB_SYNC);
  },

  syncToGitHub: (): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.SYNC_TO_GITHUB);
  },

  fetchFromGitHub: (): Promise<CollectionsResult<CollectionsState>> => {
    return ipcRenderer.invoke(CollectionsAPIEvent.FETCH_FROM_GITHUB);
  },

  // Public/shared collections
  getUserPublicCollections: (
    username: string,
  ): Promise<CollectionsResult<PublicCollectionsResult>> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.GET_USER_PUBLIC_COLLECTIONS,
      username,
    );
  },

  // Region management
  createRegion: (
    collectionId: string,
    region: Omit<CustomRegion, 'id'>,
  ): Promise<CollectionsResult<CustomRegion>> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.CREATE_REGION,
      collectionId,
      region,
    );
  },

  updateRegion: (
    collectionId: string,
    regionId: string,
    updates: Partial<Omit<CustomRegion, 'id'>>,
  ): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.UPDATE_REGION,
      collectionId,
      regionId,
      updates,
    );
  },

  deleteRegion: (
    collectionId: string,
    regionId: string,
  ): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.DELETE_REGION,
      collectionId,
      regionId,
    );
  },

  assignRepositoryToRegion: (
    collectionId: string,
    repositoryId: string,
    regionId: string,
  ): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.ASSIGN_REPOSITORY_TO_REGION,
      collectionId,
      repositoryId,
      regionId,
    );
  },

  updateRepositoryPosition: (
    collectionId: string,
    repositoryId: string,
    layout: RepositoryLayoutData,
  ): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.UPDATE_REPOSITORY_POSITION,
      collectionId,
      repositoryId,
      layout,
    );
  },

  batchInitializeLayout: (
    collectionId: string,
    updates: {
      regions?: CustomRegion[];
      assignments?: Array<{ repositoryId: string; regionId: string }>;
      positions?: Array<{ repositoryId: string; layout: RepositoryLayoutData }>;
    },
  ): Promise<CollectionsResult> => {
    return ipcRenderer.invoke(
      CollectionsAPIEvent.BATCH_INITIALIZE_LAYOUT,
      collectionId,
      updates,
    );
  },
};
