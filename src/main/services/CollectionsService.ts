/**
 * CollectionsService - Manages user repository collections using CollectionStorageAdapter
 *
 * This service wraps CollectionStorageAdapter from @principal-ai/alexandria-collections
 * and exposes collection management functionality via IPC to the renderer process.
 *
 * Replaces the previous ~1000 lines of custom GitHub sync code with a clean
 * adapter-based implementation.
 */

import { ipcMain } from 'electron';
import { CollectionStorageAdapter } from '@principal-ai/alexandria-collections';
import { GitHubFileSystemAdapter } from '../adapters/GitHubFileSystemAdapter';
import type {
  Collection,
  CollectionMembership,
  CustomRegion,
  RepositoryLayoutData,
} from '@principal-ai/alexandria-collections';
import {
  CollectionsAPIEvent,
  type CollectionsState,
  type CreateCollectionInput,
  type UpdateCollectionInput,
  type AddRepositoryInput,
  type CollectionsResult,
  type GitHubSyncStatus,
  type PublicCollectionsResult,
} from '../../shared/main-process-api-interfaces/CollectionsAPI';

class CollectionsService {
  private adapter: CollectionStorageAdapter;
  private fsAdapter: GitHubFileSystemAdapter;
  private initialized = false;

  constructor() {
    console.log('[CollectionsService] Initializing with CollectionStorageAdapter');
    this.fsAdapter = new GitHubFileSystemAdapter();
    this.adapter = new CollectionStorageAdapter('/', this.fsAdapter, {
      collectionsDir: 'collections',
      telemetry: { enabled: true },
    });
    this.setupHandlers();
  }

  /**
   * Initialize the service (must be called before first use)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.fsAdapter.initialize();
      this.initialized = true;
      console.log('[CollectionsService] Initialized successfully');
    } catch (error) {
      console.error('[CollectionsService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup IPC handlers for renderer process
   */
  private setupHandlers() {
    // Core CRUD operations
    ipcMain.handle(CollectionsAPIEvent.GET_COLLECTIONS, async () => {
      return this.getCollections();
    });

    ipcMain.handle(
      CollectionsAPIEvent.CREATE_COLLECTION,
      async (_, input: CreateCollectionInput) => {
        return this.createCollection(input);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.UPDATE_COLLECTION,
      async (_, id: string, input: UpdateCollectionInput) => {
        return this.updateCollection(id, input);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.DELETE_COLLECTION,
      async (_, id: string) => {
        return this.deleteCollection(id);
      },
    );

    // Membership operations
    ipcMain.handle(
      CollectionsAPIEvent.ADD_REPOSITORY,
      async (_, input: AddRepositoryInput) => {
        return this.addRepository(input);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.REMOVE_REPOSITORY,
      async (_, collectionId: string, repositoryId: string) => {
        return this.removeRepository(collectionId, repositoryId);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.GET_COLLECTION_REPOSITORIES,
      async (_, collectionId: string) => {
        return this.getCollectionRepositories(collectionId);
      },
    );

    // GitHub sync operations (simplified)
    ipcMain.handle(CollectionsAPIEvent.CHECK_GITHUB_REPO, async () => {
      return this.checkGitHubRepo();
    });

    ipcMain.handle(CollectionsAPIEvent.ENABLE_GITHUB_SYNC, async () => {
      return this.enableGitHubSync();
    });

    ipcMain.handle(CollectionsAPIEvent.SYNC_TO_GITHUB, async () => {
      return this.syncToGitHub();
    });

    ipcMain.handle(CollectionsAPIEvent.FETCH_FROM_GITHUB, async () => {
      return this.fetchFromGitHub();
    });

    // Public collections
    ipcMain.handle(
      CollectionsAPIEvent.GET_USER_PUBLIC_COLLECTIONS,
      async (_, username: string) => {
        return this.getUserPublicCollections(username);
      },
    );

    // Region management (NEW)
    ipcMain.handle(
      CollectionsAPIEvent.CREATE_REGION,
      async (_, collectionId: string, region: Omit<CustomRegion, 'id'>) => {
        return this.createRegion(collectionId, region);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.UPDATE_REGION,
      async (_, collectionId: string, regionId: string, updates: Partial<Omit<CustomRegion, 'id'>>) => {
        return this.updateRegion(collectionId, regionId, updates);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.DELETE_REGION,
      async (_, collectionId: string, regionId: string) => {
        return this.deleteRegion(collectionId, regionId);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.ASSIGN_REPOSITORY_TO_REGION,
      async (_, collectionId: string, repositoryId: string, regionId: string) => {
        return this.assignRepositoryToRegion(collectionId, repositoryId, regionId);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.UPDATE_REPOSITORY_POSITION,
      async (_, collectionId: string, repositoryId: string, layout: RepositoryLayoutData) => {
        return this.updateRepositoryPosition(collectionId, repositoryId, layout);
      },
    );

    ipcMain.handle(
      CollectionsAPIEvent.BATCH_INITIALIZE_LAYOUT,
      async (_, collectionId: string, updates: {
        regions?: CustomRegion[];
        assignments?: Array<{ repositoryId: string; regionId: string }>;
        positions?: Array<{ repositoryId: string; layout: RepositoryLayoutData }>;
      }) => {
        return this.batchInitializeLayout(collectionId, updates);
      },
    );

    console.log('[CollectionsService] IPC handlers registered');
  }

  // ============================================================================
  // Collection CRUD Operations
  // ============================================================================

  async getCollections(): Promise<CollectionsResult<CollectionsState>> {
    try {
      await this.ensureInitialized();

      const collections = await this.adapter.getCollections();
      const memberships = await this.adapter.getAllMemberships();

      return {
        success: true,
        data: {
          collections,
          memberships,
          gitHubRepoExists: true,
          gitHubRepoUrl: `https://github.com/${this.fsAdapter.getOwner()}/web-ade-collections`,
        },
      };
    } catch (error) {
      console.error('[CollectionsService] getCollections error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createCollection(
    input: CreateCollectionInput,
  ): Promise<CollectionsResult<Collection>> {
    try {
      await this.ensureInitialized();

      const collection = await this.adapter.createCollection({
        name: input.name,
        description: input.description,
        icon: input.icon,
        theme: input.theme,
        isDefault: input.isDefault,
        suggestedClonePath: input.suggestedClonePath,
      });

      console.log('[CollectionsService] Created collection:', collection.name);
      return { success: true, data: collection };
    } catch (error) {
      console.error('[CollectionsService] createCollection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateCollection(
    id: string,
    input: UpdateCollectionInput,
  ): Promise<CollectionsResult<Collection>> {
    try {
      await this.ensureInitialized();

      const updated = await this.adapter.updateCollection(id, input);

      console.log('[CollectionsService] Updated collection:', updated.name);
      return { success: true, data: updated };
    } catch (error) {
      console.error('[CollectionsService] updateCollection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteCollection(id: string): Promise<CollectionsResult> {
    try {
      await this.ensureInitialized();

      await this.adapter.deleteCollection(id);

      console.log('[CollectionsService] Deleted collection:', id);
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] deleteCollection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Membership Operations
  // ============================================================================

  async addRepository(input: AddRepositoryInput): Promise<CollectionsResult> {
    try {
      await this.ensureInitialized();

      await this.adapter.addRepository(
        input.collectionId,
        input.repositoryId,
        input.metadata,
      );

      console.log(
        '[CollectionsService] Added repository:',
        input.repositoryId,
        'to collection:',
        input.collectionId,
      );
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] addRepository error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async removeRepository(
    collectionId: string,
    repositoryId: string,
  ): Promise<CollectionsResult> {
    try {
      await this.ensureInitialized();

      await this.adapter.removeRepository(collectionId, repositoryId);

      console.log(
        '[CollectionsService] Removed repository:',
        repositoryId,
        'from collection:',
        collectionId,
      );
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] removeRepository error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getCollectionRepositories(
    collectionId: string,
  ): Promise<CollectionsResult<string[]>> {
    try {
      await this.ensureInitialized();

      const memberships = await this.adapter.getCollectionMemberships(collectionId);
      const repositories = memberships.map((m) => m.repositoryId);

      return { success: true, data: repositories };
    } catch (error) {
      console.error('[CollectionsService] getCollectionRepositories error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // GitHub Sync Operations (Simplified)
  // ============================================================================

  async checkGitHubRepo(): Promise<CollectionsResult<GitHubSyncStatus>> {
    try {
      await this.ensureInitialized();

      const collections = await this.adapter.getCollections();
      const memberships = await this.adapter.getAllMemberships();

      return {
        success: true,
        data: {
          exists: true,
          repoUrl: `https://github.com/${this.fsAdapter.getOwner()}/web-ade-collections`,
          collections,
          memberships,
        },
      };
    } catch (error) {
      console.error('[CollectionsService] checkGitHubRepo error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async enableGitHubSync(): Promise<CollectionsResult<{ repoUrl: string }>> {
    try {
      await this.ensureInitialized();

      const repoUrl = `https://github.com/${this.fsAdapter.getOwner()}/web-ade-collections`;

      console.log('[CollectionsService] GitHub sync enabled:', repoUrl);
      return { success: true, data: { repoUrl } };
    } catch (error) {
      console.error('[CollectionsService] enableGitHubSync error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncToGitHub(): Promise<CollectionsResult> {
    // With the adapter, every write automatically syncs to GitHub
    // This is a no-op but kept for API compatibility
    return { success: true };
  }

  async fetchFromGitHub(): Promise<CollectionsResult<CollectionsState>> {
    // Clear cache and re-fetch
    this.fsAdapter.clearCache();
    return this.getCollections();
  }

  // ============================================================================
  // Region Management (NEW - from CollectionStorageAdapter)
  // ============================================================================

  async createRegion(
    collectionId: string,
    region: Omit<CustomRegion, 'id'>,
  ): Promise<CollectionsResult<CustomRegion>> {
    try {
      await this.ensureInitialized();

      const created = await this.adapter.createRegion(collectionId, region);

      console.log('[CollectionsService] Created region:', created.name);
      return { success: true, data: created };
    } catch (error) {
      console.error('[CollectionsService] createRegion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateRegion(
    collectionId: string,
    regionId: string,
    updates: Partial<Omit<CustomRegion, 'id'>>,
  ): Promise<CollectionsResult> {
    try {
      await this.ensureInitialized();

      await this.adapter.updateRegion(collectionId, regionId, updates);

      console.log('[CollectionsService] Updated region:', regionId);
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] updateRegion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteRegion(
    collectionId: string,
    regionId: string,
  ): Promise<CollectionsResult> {
    try {
      await this.ensureInitialized();

      await this.adapter.deleteRegion(collectionId, regionId);

      console.log('[CollectionsService] Deleted region:', regionId);
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] deleteRegion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async assignRepositoryToRegion(
    collectionId: string,
    repositoryId: string,
    regionId: string,
  ): Promise<CollectionsResult> {
    try {
      await this.ensureInitialized();

      await this.adapter.assignRepositoryToRegion(
        collectionId,
        repositoryId,
        regionId,
      );

      console.log(
        '[CollectionsService] Assigned repository:',
        repositoryId,
        'to region:',
        regionId,
      );
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] assignRepositoryToRegion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateRepositoryPosition(
    collectionId: string,
    repositoryId: string,
    layout: RepositoryLayoutData,
  ): Promise<CollectionsResult> {
    try {
      await this.ensureInitialized();

      await this.adapter.updateRepositoryPosition(
        collectionId,
        repositoryId,
        layout,
      );

      console.log(
        '[CollectionsService] Updated repository position:',
        repositoryId,
      );
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] updateRepositoryPosition error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async batchInitializeLayout(
    collectionId: string,
    updates: {
      regions?: CustomRegion[];
      assignments?: Array<{ repositoryId: string; regionId: string }>;
      positions?: Array<{ repositoryId: string; layout: RepositoryLayoutData }>;
    },
  ): Promise<CollectionsResult> {
    try {
      await this.ensureInitialized();

      await this.adapter.batchInitializeLayout(collectionId, updates);

      console.log('[CollectionsService] Batch initialized layout for:', collectionId);
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] batchInitializeLayout error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Public Collections (Stub - Not Yet Implemented)
  // ============================================================================

  async getUserPublicCollections(
    _username: string,
  ): Promise<CollectionsResult<PublicCollectionsResult>> {
    // TODO: Implement fetching public collections from other users
    return {
      success: true,
      data: {
        user: null,
        exists: false,
        collections: [],
        memberships: [],
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Create and export singleton instance
export const collectionsService = new CollectionsService();

// Export registration function for initialization
export function registerCollectionsHandlers() {
  // The CollectionsService constructor already registers handlers
  // This function exists for consistency with other services
  console.log('[CollectionsService] Handlers registered (using CollectionStorageAdapter)');
}
