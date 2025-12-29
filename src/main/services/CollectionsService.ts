/**
 * CollectionsService - Manages user repository collections synced to GitHub
 *
 * This service provides collection management functionality that syncs to GitHub,
 * allowing users to organize repositories into collections that persist across devices.
 * Based on the pattern from web-ade.
 */

import { ipcMain } from 'electron';
import { authService } from './AuthService';
import type {
  Collection,
  CollectionMembership,
  CollectionsData,
  CollectionMembershipsData,
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

const REPO_NAME = 'web-ade-collections';
const COLLECTIONS_FILE = 'collections.json';
const MEMBERSHIPS_FILE = 'collection-memberships.json';

interface GitHubContentResponse {
  content: string;
  sha: string;
  encoding: string;
}

class CollectionsService {
  // In-memory cache of collections state
  private collections: Collection[] = [];
  private memberships: CollectionMembership[] = [];
  private gitHubRepoExists = false;
  private gitHubRepoUrl: string | null = null;

  // SHA tracking for GitHub file updates
  private collectionsSha: string | null = null;
  private membershipsSha: string | null = null;

  constructor() {
    this.setupHandlers();
    console.log('[CollectionsService] Initialized');
  }

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

    // GitHub sync operations
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
  }

  // Helper methods for GitHub API calls
  private async getToken(): Promise<string | null> {
    return authService.getValidToken();
  }

  private async getAuthenticatedUsername(): Promise<string | null> {
    const user = await authService.getCurrentUser();
    return user?.login || null;
  }

  private async checkRepoExists(
    token: string,
    owner: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${REPO_NAME}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private async createRepo(
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: REPO_NAME,
          description: 'My web-ade collections - synced repository collections',
          public: true,
          auto_init: true,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as { message?: string };
        return {
          success: false,
          error: errorBody.message || 'Failed to create repository',
        };
      }

      return { success: true };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  private async getFile<T>(
    token: string,
    owner: string,
    filename: string,
  ): Promise<{ data: T | null; sha: string | null; error?: string }> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${REPO_NAME}/contents/${filename}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (response.status === 404) {
        return { data: null, sha: null };
      }

      if (!response.ok) {
        return { data: null, sha: null, error: `Failed to fetch ${filename}` };
      }

      const content = (await response.json()) as GitHubContentResponse;

      try {
        const decoded = Buffer.from(content.content, 'base64').toString(
          'utf-8',
        );
        const data: T = JSON.parse(decoded);
        return { data, sha: content.sha };
      } catch {
        return {
          data: null,
          sha: content.sha,
          error: `Failed to parse ${filename}`,
        };
      }
    } catch (err) {
      const error = err as Error;
      return {
        data: null,
        sha: null,
        error: error.message || 'Unknown error',
      };
    }
  }

  private async saveFile(
    token: string,
    owner: string,
    filename: string,
    content: unknown,
    sha?: string | null,
    retries = 3,
  ): Promise<{ success: boolean; newSha?: string; error?: string }> {
    try {
      const encoded = Buffer.from(JSON.stringify(content, null, 2)).toString(
        'base64',
      );

      const body: Record<string, unknown> = {
        message: `Update ${filename} - ${new Date().toISOString()}`,
        content: encoded,
      };

      if (sha) {
        body.sha = sha;
      }

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${REPO_NAME}/contents/${filename}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const errorBody = (await response.json()) as { message?: string };

        // Handle SHA conflict (409) by refetching SHA and retrying
        if (response.status === 409 && retries > 0) {
          console.log(
            `[CollectionsService] SHA conflict for ${filename}, retrying...`,
          );
          const currentFile = await this.getFile<unknown>(
            token,
            owner,
            filename,
          );
          if (currentFile.sha) {
            return this.saveFile(
              token,
              owner,
              filename,
              content,
              currentFile.sha,
              retries - 1,
            );
          }
        }

        return {
          success: false,
          error: errorBody.message || `Failed to save ${filename}`,
        };
      }

      const result = (await response.json()) as { content?: { sha?: string } };
      return { success: true, newSha: result.content?.sha };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  // Generate unique collection ID
  private generateCollectionId(): string {
    return `col-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Core CRUD operations
  async getCollections(): Promise<CollectionsResult<CollectionsState>> {
    try {
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      // Check if repo exists
      const exists = await this.checkRepoExists(token, username);
      this.gitHubRepoExists = exists;

      if (!exists) {
        return {
          success: true,
          data: {
            collections: [],
            memberships: [],
            gitHubRepoExists: false,
            gitHubRepoUrl: null,
          },
        };
      }

      this.gitHubRepoUrl = `https://github.com/${username}/${REPO_NAME}`;

      // Fetch collections and memberships
      const [collectionsResult, membershipsResult] = await Promise.all([
        this.getFile<CollectionsData>(token, username, COLLECTIONS_FILE),
        this.getFile<CollectionMembershipsData>(
          token,
          username,
          MEMBERSHIPS_FILE,
        ),
      ]);

      if (collectionsResult.error) {
        return { success: false, error: collectionsResult.error };
      }

      this.collections = collectionsResult.data?.collections || [];
      this.memberships = membershipsResult.data?.memberships || [];
      this.collectionsSha = collectionsResult.sha;
      this.membershipsSha = membershipsResult.sha;

      return {
        success: true,
        data: {
          collections: this.collections,
          memberships: this.memberships,
          gitHubRepoExists: true,
          gitHubRepoUrl: this.gitHubRepoUrl,
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
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      // Check if repo exists, create if not
      if (!this.gitHubRepoExists) {
        const checkResult = await this.checkGitHubRepo();
        if (!checkResult.success || !checkResult.data?.exists) {
          const enableResult = await this.enableGitHubSync();
          if (!enableResult.success) {
            return { success: false, error: enableResult.error };
          }
        }
      }

      const now = Date.now();
      const newCollection: Collection = {
        id: this.generateCollectionId(),
        name: input.name,
        description: input.description,
        icon: input.icon,
        theme: input.theme,
        isDefault: input.isDefault || false,
        suggestedClonePath: input.suggestedClonePath,
        createdAt: now,
        updatedAt: now,
      };

      this.collections.push(newCollection);

      // Sync to GitHub
      const syncResult = await this.syncCollections(token, username);
      if (!syncResult.success) {
        // Rollback
        this.collections.pop();
        return { success: false, error: syncResult.error };
      }

      console.log(
        '[CollectionsService] Created collection:',
        newCollection.name,
      );
      return { success: true, data: newCollection };
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
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      const index = this.collections.findIndex((c) => c.id === id);
      if (index === -1) {
        return { success: false, error: 'Collection not found' };
      }

      const original = { ...this.collections[index] };
      const updated: Collection = {
        ...original,
        ...input,
        updatedAt: Date.now(),
      };

      this.collections[index] = updated;

      // Sync to GitHub
      const syncResult = await this.syncCollections(token, username);
      if (!syncResult.success) {
        // Rollback
        this.collections[index] = original;
        return { success: false, error: syncResult.error };
      }

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
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      const index = this.collections.findIndex((c) => c.id === id);
      if (index === -1) {
        return { success: false, error: 'Collection not found' };
      }

      const removed = this.collections.splice(index, 1)[0];

      // Also remove all memberships for this collection
      const removedMemberships = this.memberships.filter(
        (m) => m.collectionId === id,
      );
      this.memberships = this.memberships.filter((m) => m.collectionId !== id);

      // Sync to GitHub
      const syncResult = await this.syncAll(token, username);
      if (!syncResult.success) {
        // Rollback
        this.collections.splice(index, 0, removed);
        this.memberships.push(...removedMemberships);
        return { success: false, error: syncResult.error };
      }

      console.log('[CollectionsService] Deleted collection:', removed.name);
      return { success: true };
    } catch (error) {
      console.error('[CollectionsService] deleteCollection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Membership operations
  async addRepository(input: AddRepositoryInput): Promise<CollectionsResult> {
    try {
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      // Check if collection exists
      const collection = this.collections.find(
        (c) => c.id === input.collectionId,
      );
      if (!collection) {
        return { success: false, error: 'Collection not found' };
      }

      // Check if membership already exists
      const existing = this.memberships.find(
        (m) =>
          m.collectionId === input.collectionId &&
          m.repositoryId === input.repositoryId,
      );
      if (existing) {
        return { success: false, error: 'Repository already in collection' };
      }

      const newMembership: CollectionMembership = {
        collectionId: input.collectionId,
        repositoryId: input.repositoryId,
        addedAt: Date.now(),
        metadata: input.metadata,
      };

      this.memberships.push(newMembership);

      // Sync to GitHub
      const syncResult = await this.syncMemberships(token, username);
      if (!syncResult.success) {
        // Rollback
        this.memberships.pop();
        return { success: false, error: syncResult.error };
      }

      console.log(
        '[CollectionsService] Added repository to collection:',
        input.repositoryId,
        '->',
        collection.name,
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
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      const index = this.memberships.findIndex(
        (m) => m.collectionId === collectionId && m.repositoryId === repositoryId,
      );
      if (index === -1) {
        return { success: false, error: 'Membership not found' };
      }

      const removed = this.memberships.splice(index, 1)[0];

      // Sync to GitHub
      const syncResult = await this.syncMemberships(token, username);
      if (!syncResult.success) {
        // Rollback
        this.memberships.splice(index, 0, removed);
        return { success: false, error: syncResult.error };
      }

      console.log(
        '[CollectionsService] Removed repository from collection:',
        repositoryId,
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
      const repositories = this.memberships
        .filter((m) => m.collectionId === collectionId)
        .map((m) => m.repositoryId);

      return { success: true, data: repositories };
    } catch (error) {
      console.error(
        '[CollectionsService] getCollectionRepositories error:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // GitHub sync operations
  async checkGitHubRepo(): Promise<CollectionsResult<GitHubSyncStatus>> {
    try {
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      const exists = await this.checkRepoExists(token, username);
      this.gitHubRepoExists = exists;

      if (!exists) {
        return {
          success: true,
          data: {
            exists: false,
            repoUrl: null,
            collections: null,
            memberships: null,
          },
        };
      }

      this.gitHubRepoUrl = `https://github.com/${username}/${REPO_NAME}`;

      // Fetch current state
      const [collectionsResult, membershipsResult] = await Promise.all([
        this.getFile<CollectionsData>(token, username, COLLECTIONS_FILE),
        this.getFile<CollectionMembershipsData>(
          token,
          username,
          MEMBERSHIPS_FILE,
        ),
      ]);

      return {
        success: true,
        data: {
          exists: true,
          repoUrl: this.gitHubRepoUrl,
          collections: collectionsResult.data?.collections || [],
          memberships: membershipsResult.data?.memberships || [],
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
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      // Check if repo already exists
      const exists = await this.checkRepoExists(token, username);
      if (exists) {
        this.gitHubRepoExists = true;
        this.gitHubRepoUrl = `https://github.com/${username}/${REPO_NAME}`;
        return { success: true, data: { repoUrl: this.gitHubRepoUrl } };
      }

      // Create the repo
      const createResult = await this.createRepo(token);
      if (!createResult.success) {
        return { success: false, error: createResult.error };
      }

      // Wait for GitHub to initialize the repo
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.gitHubRepoExists = true;
      this.gitHubRepoUrl = `https://github.com/${username}/${REPO_NAME}`;

      // Initialize empty collections and memberships files
      await this.syncAll(token, username);

      console.log(
        '[CollectionsService] GitHub sync enabled:',
        this.gitHubRepoUrl,
      );
      return { success: true, data: { repoUrl: this.gitHubRepoUrl } };
    } catch (error) {
      console.error('[CollectionsService] enableGitHubSync error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncToGitHub(): Promise<CollectionsResult> {
    try {
      const token = await this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const username = await this.getAuthenticatedUsername();
      if (!username) {
        return { success: false, error: 'Could not get username' };
      }

      if (!this.gitHubRepoExists) {
        return { success: false, error: 'GitHub repo does not exist' };
      }

      return this.syncAll(token, username);
    } catch (error) {
      console.error('[CollectionsService] syncToGitHub error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async fetchFromGitHub(): Promise<CollectionsResult<CollectionsState>> {
    // Same as getCollections - fetches fresh state from GitHub
    return this.getCollections();
  }

  // Public collections
  async getUserPublicCollections(
    username: string,
  ): Promise<CollectionsResult<PublicCollectionsResult>> {
    try {
      // For public repos, we don't need authentication
      const response = await fetch(
        `https://api.github.com/repos/${username}/${REPO_NAME}`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
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

      // Fetch user info
      const userResponse = await fetch(
        `https://api.github.com/users/${username}`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      let userInfo: { login: string; avatarUrl?: string } | null = null;
      if (userResponse.ok) {
        const userData = (await userResponse.json()) as {
          login: string;
          avatar_url?: string;
        };
        userInfo = {
          login: userData.login,
          avatarUrl: userData.avatar_url,
        };
      }

      // Fetch collections file (no auth for public repos)
      const collectionsResponse = await fetch(
        `https://api.github.com/repos/${username}/${REPO_NAME}/contents/${COLLECTIONS_FILE}`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      let collections: Collection[] = [];
      if (collectionsResponse.ok) {
        const content =
          (await collectionsResponse.json()) as GitHubContentResponse;
        const decoded = Buffer.from(content.content, 'base64').toString(
          'utf-8',
        );
        const data: CollectionsData = JSON.parse(decoded);
        collections = data.collections || [];
      }

      // Fetch memberships file
      const membershipsResponse = await fetch(
        `https://api.github.com/repos/${username}/${REPO_NAME}/contents/${MEMBERSHIPS_FILE}`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      let memberships: CollectionMembership[] = [];
      if (membershipsResponse.ok) {
        const content =
          (await membershipsResponse.json()) as GitHubContentResponse;
        const decoded = Buffer.from(content.content, 'base64').toString(
          'utf-8',
        );
        const data: CollectionMembershipsData = JSON.parse(decoded);
        memberships = data.memberships || [];
      }

      return {
        success: true,
        data: {
          user: userInfo,
          exists: true,
          collections,
          memberships,
        },
      };
    } catch (error) {
      console.error(
        '[CollectionsService] getUserPublicCollections error:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Private helper methods for syncing
  private async syncCollections(
    token: string,
    owner: string,
  ): Promise<{ success: boolean; error?: string }> {
    const data: CollectionsData = {
      version: '1.0',
      collections: this.collections,
    };

    const result = await this.saveFile(
      token,
      owner,
      COLLECTIONS_FILE,
      data,
      this.collectionsSha,
    );

    if (result.success && result.newSha) {
      this.collectionsSha = result.newSha;
    }

    return result;
  }

  private async syncMemberships(
    token: string,
    owner: string,
  ): Promise<{ success: boolean; error?: string }> {
    const data: CollectionMembershipsData = {
      version: '1.0',
      memberships: this.memberships,
    };

    const result = await this.saveFile(
      token,
      owner,
      MEMBERSHIPS_FILE,
      data,
      this.membershipsSha,
    );

    if (result.success && result.newSha) {
      this.membershipsSha = result.newSha;
    }

    return result;
  }

  private async syncAll(
    token: string,
    owner: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Sync collections first
    const collectionsResult = await this.syncCollections(token, owner);
    if (!collectionsResult.success) {
      return collectionsResult;
    }

    // Then sync memberships
    const membershipsResult = await this.syncMemberships(token, owner);
    return membershipsResult;
  }
}

// Create and export singleton instance
export const collectionsService = new CollectionsService();

// Export registration function for initialization
export function registerCollectionsHandlers() {
  // The CollectionsService constructor already registers handlers
  // This function exists for consistency with other services
  console.log('[CollectionsService] Handlers registered');
}
