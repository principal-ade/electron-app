/**
 * Collections API - Manages user repository collections synced to GitHub
 *
 * Uses @principal-ai/alexandria-collections types for collection management.
 * Collections are stored in a user's `web-ade-collections` GitHub repository
 * for cross-device sync and sharing.
 */

import type {
  Collection,
  CollectionMembership,
  CustomRegion,
  RepositoryLayoutData,
} from '@principal-ai/alexandria-collections';

export enum CollectionsAPIEvent {
  // Core CRUD operations
  GET_COLLECTIONS = 'collections:get-collections',
  CREATE_COLLECTION = 'collections:create-collection',
  UPDATE_COLLECTION = 'collections:update-collection',
  DELETE_COLLECTION = 'collections:delete-collection',

  // Membership operations
  ADD_REPOSITORY = 'collections:add-repository',
  REMOVE_REPOSITORY = 'collections:remove-repository',
  GET_COLLECTION_REPOSITORIES = 'collections:get-collection-repositories',

  // GitHub sync operations
  CHECK_GITHUB_REPO = 'collections:check-github-repo',
  ENABLE_GITHUB_SYNC = 'collections:enable-github-sync',
  SYNC_TO_GITHUB = 'collections:sync-to-github',
  FETCH_FROM_GITHUB = 'collections:fetch-from-github',

  // Public/shared collections
  GET_USER_PUBLIC_COLLECTIONS = 'collections:get-user-public-collections',

  // Region management
  CREATE_REGION = 'collections:create-region',
  UPDATE_REGION = 'collections:update-region',
  DELETE_REGION = 'collections:delete-region',
  ASSIGN_REPOSITORY_TO_REGION = 'collections:assign-repository-to-region',
  UPDATE_REPOSITORY_POSITION = 'collections:update-repository-position',
  BATCH_INITIALIZE_LAYOUT = 'collections:batch-initialize-layout',
}

export interface CollectionsState {
  collections: Collection[];
  memberships: CollectionMembership[];
  gitHubRepoExists: boolean;
  gitHubRepoUrl: string | null;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  icon?: string;
  theme?: string;
  isDefault?: boolean;
  suggestedClonePath?: string;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
  icon?: string;
  theme?: string;
  isDefault?: boolean;
  suggestedClonePath?: string;
  metadata?: Record<string, unknown>;
}

export interface AddRepositoryInput {
  collectionId: string;
  repositoryId: string; // Format: "owner/repo"
  metadata?: {
    pinned?: boolean;
    notes?: string;
    [key: string]: unknown;
  };
}

export interface CollectionsResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GitHubSyncStatus {
  exists: boolean;
  repoUrl: string | null;
  collections: Collection[] | null;
  memberships: CollectionMembership[] | null;
}

export interface PublicCollectionsResult {
  user: {
    login: string;
    avatarUrl?: string;
  } | null;
  exists: boolean;
  collections: Collection[];
  memberships: CollectionMembership[];
}

export interface CollectionsAPI {
  // Core CRUD operations
  getCollections: () => Promise<CollectionsResult<CollectionsState>>;
  createCollection: (
    input: CreateCollectionInput,
  ) => Promise<CollectionsResult<Collection>>;
  updateCollection: (
    id: string,
    input: UpdateCollectionInput,
  ) => Promise<CollectionsResult<Collection>>;
  deleteCollection: (id: string) => Promise<CollectionsResult>;

  // Membership operations
  addRepository: (input: AddRepositoryInput) => Promise<CollectionsResult>;
  removeRepository: (
    collectionId: string,
    repositoryId: string,
  ) => Promise<CollectionsResult>;
  getCollectionRepositories: (
    collectionId: string,
  ) => Promise<CollectionsResult<string[]>>;

  // GitHub sync operations
  checkGitHubRepo: () => Promise<CollectionsResult<GitHubSyncStatus>>;
  enableGitHubSync: () => Promise<CollectionsResult<{ repoUrl: string }>>;
  syncToGitHub: () => Promise<CollectionsResult>;
  fetchFromGitHub: () => Promise<CollectionsResult<CollectionsState>>;

  // Public/shared collections
  getUserPublicCollections: (
    username: string,
  ) => Promise<CollectionsResult<PublicCollectionsResult>>;

  // Region management
  createRegion: (
    collectionId: string,
    region: Omit<CustomRegion, 'id'>,
  ) => Promise<CollectionsResult<CustomRegion>>;

  updateRegion: (
    collectionId: string,
    regionId: string,
    updates: Partial<Omit<CustomRegion, 'id'>>,
  ) => Promise<CollectionsResult>;

  deleteRegion: (
    collectionId: string,
    regionId: string,
  ) => Promise<CollectionsResult>;

  assignRepositoryToRegion: (
    collectionId: string,
    repositoryId: string,
    regionId: string,
  ) => Promise<CollectionsResult>;

  updateRepositoryPosition: (
    collectionId: string,
    repositoryId: string,
    layout: RepositoryLayoutData,
  ) => Promise<CollectionsResult>;

  batchInitializeLayout: (
    collectionId: string,
    updates: {
      regions?: CustomRegion[];
      assignments?: Array<{ repositoryId: string; regionId: string }>;
      positions?: Array<{ repositoryId: string; layout: RepositoryLayoutData }>;
    },
  ) => Promise<CollectionsResult>;
}
