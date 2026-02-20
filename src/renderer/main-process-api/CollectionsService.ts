/**
 * Service layer for Collections management functionality
 * ALL window.mainProcess.collections calls MUST be encapsulated here
 */

import type {
  Collection,
  CollectionMembership,
  CustomRegion,
  RepositoryLayoutData,
} from '@principal-ai/alexandria-collections';
import type {
  CollectionsState,
  CreateCollectionInput,
  UpdateCollectionInput,
  AddRepositoryInput,
  CollectionsResult,
  GitHubSyncStatus,
  PublicCollectionsResult,
} from '../../shared/main-process-api-interfaces/CollectionsAPI';

export class CollectionsService {
  // ========================================
  // Core CRUD Operations
  // ========================================

  /**
   * Get all collections and memberships for the current user
   */
  static async getCollections(): Promise<CollectionsResult<CollectionsState>> {
    return window.mainProcess.collections.getCollections();
  }

  /**
   * Create a new collection
   */
  static async createCollection(
    input: CreateCollectionInput,
  ): Promise<CollectionsResult<Collection>> {
    return window.mainProcess.collections.createCollection(input);
  }

  /**
   * Update an existing collection
   */
  static async updateCollection(
    id: string,
    input: UpdateCollectionInput,
  ): Promise<CollectionsResult<Collection>> {
    return window.mainProcess.collections.updateCollection(id, input);
  }

  /**
   * Delete a collection and all its memberships
   */
  static async deleteCollection(id: string): Promise<CollectionsResult> {
    return window.mainProcess.collections.deleteCollection(id);
  }

  // ========================================
  // Membership Operations
  // ========================================

  /**
   * Add a repository to a collection
   */
  static async addRepository(
    input: AddRepositoryInput,
  ): Promise<CollectionsResult> {
    return window.mainProcess.collections.addRepository(input);
  }

  /**
   * Remove a repository from a collection
   */
  static async removeRepository(
    collectionId: string,
    repositoryId: string,
  ): Promise<CollectionsResult> {
    return window.mainProcess.collections.removeRepository(
      collectionId,
      repositoryId,
    );
  }

  /**
   * Get all repository IDs in a collection
   */
  static async getCollectionRepositories(
    collectionId: string,
  ): Promise<CollectionsResult<string[]>> {
    return window.mainProcess.collections.getCollectionRepositories(
      collectionId,
    );
  }

  // ========================================
  // GitHub Sync Operations
  // ========================================

  /**
   * Check if the user's GitHub collections repo exists
   */
  static async checkGitHubRepo(): Promise<
    CollectionsResult<GitHubSyncStatus>
  > {
    return window.mainProcess.collections.checkGitHubRepo();
  }

  /**
   * Enable GitHub sync by creating the collections repo
   */
  static async enableGitHubSync(): Promise<
    CollectionsResult<{ repoUrl: string }>
  > {
    return window.mainProcess.collections.enableGitHubSync();
  }

  /**
   * Manually trigger sync to GitHub
   */
  static async syncToGitHub(): Promise<CollectionsResult> {
    return window.mainProcess.collections.syncToGitHub();
  }

  /**
   * Fetch fresh data from GitHub
   */
  static async fetchFromGitHub(): Promise<
    CollectionsResult<CollectionsState>
  > {
    return window.mainProcess.collections.fetchFromGitHub();
  }

  // ========================================
  // Public/Shared Collections
  // ========================================

  /**
   * Get another user's public collections
   */
  static async getUserPublicCollections(
    username: string,
  ): Promise<CollectionsResult<PublicCollectionsResult>> {
    return window.mainProcess.collections.getUserPublicCollections(username);
  }

  // ========================================
  // Region Management
  // ========================================

  /**
   * Create a new custom region in a collection
   */
  static async createRegion(
    collectionId: string,
    region: Omit<CustomRegion, 'id'>,
  ): Promise<CollectionsResult<CustomRegion>> {
    return window.mainProcess.collections.createRegion(collectionId, region);
  }

  /**
   * Update an existing custom region
   */
  static async updateRegion(
    collectionId: string,
    regionId: string,
    updates: Partial<Omit<CustomRegion, 'id'>>,
  ): Promise<CollectionsResult> {
    return window.mainProcess.collections.updateRegion(
      collectionId,
      regionId,
      updates,
    );
  }

  /**
   * Delete a custom region
   */
  static async deleteRegion(
    collectionId: string,
    regionId: string,
  ): Promise<CollectionsResult> {
    return window.mainProcess.collections.deleteRegion(collectionId, regionId);
  }

  /**
   * Assign a repository to a custom region
   */
  static async assignRepositoryToRegion(
    collectionId: string,
    repositoryId: string,
    regionId: string,
  ): Promise<CollectionsResult> {
    return window.mainProcess.collections.assignRepositoryToRegion(
      collectionId,
      repositoryId,
      regionId,
    );
  }

  /**
   * Update repository position on the overworld map
   */
  static async updateRepositoryPosition(
    collectionId: string,
    repositoryId: string,
    layout: RepositoryLayoutData,
  ): Promise<CollectionsResult> {
    return window.mainProcess.collections.updateRepositoryPosition(
      collectionId,
      repositoryId,
      layout,
    );
  }

  /**
   * Batch initialize layout (regions + assignments + positions)
   */
  static async batchInitializeLayout(
    collectionId: string,
    updates: {
      regions?: CustomRegion[];
      assignments?: Array<{ repositoryId: string; regionId: string }>;
      positions?: Array<{ repositoryId: string; layout: RepositoryLayoutData }>;
    },
  ): Promise<CollectionsResult> {
    return window.mainProcess.collections.batchInitializeLayout(
      collectionId,
      updates,
    );
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Get a collection by ID from a state object
   */
  static getCollectionById(
    state: CollectionsState,
    id: string,
  ): Collection | undefined {
    return state.collections.find((c) => c.id === id);
  }

  /**
   * Get all memberships for a collection from a state object
   */
  static getCollectionMemberships(
    state: CollectionsState,
    collectionId: string,
  ): CollectionMembership[] {
    return state.memberships.filter((m) => m.collectionId === collectionId);
  }

  /**
   * Get all repository IDs in a collection from a state object
   */
  static getRepositoryIds(
    state: CollectionsState,
    collectionId: string,
  ): string[] {
    return state.memberships
      .filter((m) => m.collectionId === collectionId)
      .map((m) => m.repositoryId);
  }

  /**
   * Check if a repository is in a collection
   */
  static isRepositoryInCollection(
    state: CollectionsState,
    collectionId: string,
    repositoryId: string,
  ): boolean {
    return state.memberships.some(
      (m) => m.collectionId === collectionId && m.repositoryId === repositoryId,
    );
  }
}
