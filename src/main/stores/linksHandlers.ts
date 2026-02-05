/**
 * IPC handlers for Links Management
 * Manages repository links and bookmarks
 */

import { ipcMain, IpcMainInvokeEvent, shell, clipboard } from 'electron';
import {
  LinksEvents,
  LinkStoreRequest,
  LinkOperationResult,
  LinkMetadata,
  RepositoryLink,
} from '../../shared/main-process-api-interfaces/LinksAPI';
import { LinksDomain } from '../services/storage-domains/LinksDomain';
import { getTypedStorageManager } from '../storage-providers';

/**
 * Register links management IPC handlers
 */
export async function registerLinksHandlers(): Promise<void> {
  // Initialize LinksDomain with typed storage provider
  const typedStore = await getTypedStorageManager();
  const linksDomain = new LinksDomain(typedStore);

  // Store/update links for a repository
  ipcMain.handle(
    LinksEvents.STORE,
    async (
      event: IpcMainInvokeEvent,
      request: LinkStoreRequest,
    ): Promise<LinkOperationResult> => {
      try {
        console.log(
          '[LinksHandlers] Storing links for repository:',
          request.repoId,
        );

        // Validate the request comes from our app
        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        // Validate inputs
        if (!request.repoId || !request.repoPath || !request.links) {
          return { success: false, error: 'Missing required parameters' };
        }

        return await linksDomain.storeLinks(
          request.repoId,
          request.repoPath,
          request.links,
        );
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error storing links:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  // Delete all links for a repository
  ipcMain.handle(
    LinksEvents.DELETE,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
    ): Promise<LinkOperationResult> => {
      try {
        console.log('[LinksHandlers] Deleting links for repository:', repoId);

        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        if (!repoId) {
          return { success: false, error: 'Repository ID is required' };
        }

        await linksDomain.deleteLinks(repoId);
        return { success: true };
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error deleting links:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  // Check if links exist for a repository
  ipcMain.handle(
    LinksEvents.EXISTS,
    async (event: IpcMainInvokeEvent, repoId: string): Promise<boolean> => {
      try {
        if (!validateSource(event)) {
          return false;
        }

        return await linksDomain.hasLinks(repoId);
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error checking links:', error);
        return false;
      }
    },
  );

  // Get metadata for all stored links
  ipcMain.handle(
    LinksEvents.LIST,
    async (event: IpcMainInvokeEvent): Promise<LinkMetadata[]> => {
      try {
        console.log('[LinksHandlers] Listing all link metadata');

        if (!validateSource(event)) {
          throw new Error('Unauthorized source');
        }

        return await linksDomain.getAllMetadata();
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error listing links:', error);
        return [];
      }
    },
  );

  // Get all links for a repository
  ipcMain.handle(
    LinksEvents.GET,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
    ): Promise<RepositoryLink[]> => {
      try {
        console.log('[LinksHandlers] Getting links for repository:', repoId);

        if (!validateSource(event)) {
          throw new Error('Unauthorized source');
        }

        if (!repoId) {
          throw new Error('Repository ID is required');
        }

        return await linksDomain.getLinks(repoId);
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error getting links:', error);
        return [];
      }
    },
  );

  // Add a single link
  ipcMain.handle(
    LinksEvents.ADD_LINK,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
      link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<LinkOperationResult> => {
      try {
        console.log('[LinksHandlers] Adding link to repository:', repoId);

        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        if (!repoId || !link) {
          return {
            success: false,
            error: 'Repository ID and link are required',
          };
        }

        return await linksDomain.addLink(repoId, link);
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error adding link:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  // Update a single link
  ipcMain.handle(
    LinksEvents.UPDATE_LINK,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
      linkId: string,
      updates: Partial<RepositoryLink>,
    ): Promise<LinkOperationResult> => {
      try {
        console.log(
          '[LinksHandlers] Updating link:',
          linkId,
          'in repository:',
          repoId,
        );

        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        if (!repoId || !linkId || !updates) {
          return {
            success: false,
            error: 'Repository ID, link ID, and updates are required',
          };
        }

        return await linksDomain.updateLink(repoId, linkId, updates);
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error updating link:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  // Remove a single link
  ipcMain.handle(
    LinksEvents.REMOVE_LINK,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
      linkId: string,
    ): Promise<LinkOperationResult> => {
      try {
        console.log(
          '[LinksHandlers] Removing link:',
          linkId,
          'from repository:',
          repoId,
        );

        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        if (!repoId || !linkId) {
          return {
            success: false,
            error: 'Repository ID and link ID are required',
          };
        }

        return await linksDomain.removeLink(repoId, linkId);
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error removing link:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  // Open a link in the default browser
  ipcMain.handle(
    LinksEvents.OPEN_LINK,
    async (
      event: IpcMainInvokeEvent,
      url: string,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        if (!url) {
          return { success: false, error: 'URL is required' };
        }

        // Validate URL format
        try {
          new URL(url);
        } catch {
          return { success: false, error: 'Invalid URL format' };
        }

        await shell.openExternal(url);
        console.log('[LinksHandlers] Opened link in browser:', url);
        return { success: true };
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error opening link:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  // Copy a link to clipboard
  ipcMain.handle(
    LinksEvents.COPY_LINK,
    async (
      event: IpcMainInvokeEvent,
      url: string,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        if (!url) {
          return { success: false, error: 'URL is required' };
        }

        clipboard.writeText(url);
        console.log('[LinksHandlers] Copied link to clipboard:', url);
        return { success: true };
      } catch (error: unknown) {
        console.error('[LinksHandlers] Error copying link:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  console.log('[LinksHandlers] All handlers registered successfully');
}

/**
 * Validate that the IPC request comes from our application
 */
function validateSource(event: IpcMainInvokeEvent): boolean {
  try {
    const url = event.sender.getURL();
    // Accept from file:// protocol (production) or localhost (development)
    const isValid =
      url.startsWith('file://') ||
      url.startsWith('http://localhost') ||
      url.includes('localhost:1212'); // Common Electron dev port

    if (!isValid) {
      console.warn('[LinksHandlers] Rejected request from URL:', url);
    }

    return isValid;
  } catch (error) {
    console.error('[LinksHandlers] Error validating source:', error);
    return false;
  }
}
