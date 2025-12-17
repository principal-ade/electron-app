/**
 * IPC handlers for SecretManager - Core storage operations
 * Focused on store, get, and delete operations
 */

import { ipcMain, IpcMainInvokeEvent, clipboard } from 'electron';
import {
  SecretsEvents,
  SecretStoreRequest,
  SecretOperationResult,
  SecretMetadata,
  SecretMetadataOnly,
  CopyResult,
} from '../../shared/main-process-api-interfaces/SecretsAPI';
import { UnifiedSecureStorage } from '../services/UnifiedSecureStorage';

/**
 * Register core secret management IPC handlers
 */
export function registerSecretHandlers(): void {
  // Lazy initialization of UnifiedSecureStorage to defer keychain access
  let storage: UnifiedSecureStorage | null = null;
  const getStorage = () => {
    if (!storage) {
      storage = UnifiedSecureStorage.getInstance();
    }
    return storage;
  };

  // Store secrets for a repository
  ipcMain.handle(
    SecretsEvents.STORE,
    async (
      event: IpcMainInvokeEvent,
      request: SecretStoreRequest,
    ): Promise<SecretOperationResult> => {
      try {
        console.log(
          '[SecretHandlers] Storing secrets for repository:',
          request.repoId,
        );

        // Validate the request comes from our app
        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        // Validate inputs
        if (!request.repoId || !request.repoPath || !request.secrets) {
          return { success: false, error: 'Missing required parameters' };
        }

        return await getStorage().storeSecrets(
          request.repoId,
          request.repoPath,
          request.secrets,
        );
      } catch (error: any) {
        console.error('[SecretHandlers] Error storing secrets:', error);
        return { success: false, error: error.message };
      }
    },
  );

  // Delete secrets for a repository
  ipcMain.handle(
    SecretsEvents.DELETE,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
    ): Promise<SecretOperationResult> => {
      try {
        console.log(
          '[SecretHandlers] Deleting secrets for repository:',
          repoId,
        );

        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        if (!repoId) {
          return { success: false, error: 'Repository ID is required' };
        }

        await getStorage().deleteSecrets(repoId);
        return { success: true };
      } catch (error: any) {
        console.error('[SecretHandlers] Error deleting secrets:', error);
        return { success: false, error: error.message };
      }
    },
  );

  // Check if secrets exist for a repository
  ipcMain.handle(
    SecretsEvents.EXISTS,
    async (event: IpcMainInvokeEvent, repoId: string): Promise<boolean> => {
      try {
        if (!validateSource(event)) {
          return false;
        }

        const secrets = await getStorage().getSecrets(repoId);
        return secrets !== null && Object.keys(secrets).length > 0;
      } catch (error: any) {
        console.error('[SecretHandlers] Error checking secrets:', error);
        return false;
      }
    },
  );

  // Get metadata for all stored secrets
  ipcMain.handle(
    SecretsEvents.LIST,
    async (event: IpcMainInvokeEvent): Promise<SecretMetadata[]> => {
      try {
        console.log('[SecretHandlers] Listing all secret metadata');

        if (!validateSource(event)) {
          throw new Error('Unauthorized source');
        }

        return await getStorage().getAllSecretsMetadata();
      } catch (error: any) {
        console.error('[SecretHandlers] Error listing secrets:', error);
        return [];
      }
    },
  );

  // Update existing secrets (merge with existing)
  ipcMain.handle(
    SecretsEvents.UPDATE,
    async (
      event: IpcMainInvokeEvent,
      request: SecretStoreRequest,
    ): Promise<SecretOperationResult> => {
      try {
        console.log(
          '[SecretHandlers] Updating secrets for repository:',
          request.repoId,
        );

        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        // Get existing secrets
        const existing = (await getStorage().getSecrets(request.repoId)) || {};

        // Merge with new secrets
        const merged = { ...existing, ...request.secrets };

        // Store merged secrets
        return await getStorage().storeSecrets(
          request.repoId,
          request.repoPath,
          merged,
        );
      } catch (error: any) {
        console.error('[SecretHandlers] Error updating secrets:', error);
        return { success: false, error: error.message };
      }
    },
  );

  // Remove specific secrets from a repository
  ipcMain.handle(
    SecretsEvents.REMOVE_KEYS,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
      keys: string[],
    ): Promise<SecretOperationResult> => {
      try {
        console.log(
          '[SecretHandlers] Removing keys from repository:',
          repoId,
          keys,
        );

        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        // Get existing secrets
        const existing = await getStorage().getSecrets(repoId);

        if (!existing) {
          return { success: false, error: 'No secrets found for repository' };
        }

        // Remove specified keys
        for (const key of keys) {
          delete existing[key];
        }

        // Store updated secrets - we'll need to pass a placeholder path
        // Since we're just updating existing secrets, the path shouldn't matter
        return await getStorage().storeSecrets(
          repoId,
          '', // Empty path for now - the storage should handle this
          existing,
        );
      } catch (error: any) {
        console.error('[SecretHandlers] Error removing keys:', error);
        return { success: false, error: error.message };
      }
    },
  );

  // Clear all caches
  ipcMain.handle(
    SecretsEvents.CLEAR_CACHE,
    async (event: IpcMainInvokeEvent): Promise<void> => {
      try {
        if (!validateSource(event)) {
          throw new Error('Unauthorized source');
        }

        // UnifiedSecureStorage doesn't have a clearCache method, but we can log that we attempted it
        console.log(
          '[SecretHandlers] Cache clear requested (no-op in unified storage)',
        );
      } catch (error: any) {
        console.error('[SecretHandlers] Error clearing cache:', error);
      }
    },
  );

  // Get only metadata without values
  ipcMain.handle(
    SecretsEvents.GET_METADATA,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
    ): Promise<SecretMetadataOnly | null> => {
      try {
        console.log(
          '[SecretHandlers] Getting metadata for repository:',
          repoId,
        );

        if (!validateSource(event)) {
          throw new Error('Unauthorized source');
        }

        if (!repoId) {
          throw new Error('Repository ID is required');
        }

        const secrets = await getStorage().getSecrets(repoId);

        if (!secrets) {
          return null;
        }

        // Get metadata from storage
        const allMetadata = await getStorage().getAllSecretsMetadata();
        const repoMetadata = allMetadata.find((m) => m.repoId === repoId);

        // Return only metadata, not values
        return {
          keys: Object.keys(secrets),
          count: Object.keys(secrets).length,
          updatedAt: repoMetadata?.updatedAt || Date.now(),
          repoId,
        };
      } catch (error: any) {
        console.error('[SecretHandlers] Error getting metadata:', error);
        return null;
      }
    },
  );

  // Get a single secret value
  ipcMain.handle(
    SecretsEvents.GET_SINGLE,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
      key: string,
    ): Promise<string | null> => {
      try {
        if (!validateSource(event)) {
          throw new Error('Unauthorized source');
        }

        if (!repoId || !key) {
          throw new Error('Repository ID and key are required');
        }

        const secrets = await getStorage().getSecrets(repoId);

        if (!secrets || !secrets[key]) {
          return null;
        }

        // Log access for audit
        console.log(`[SecretHandlers] Secret accessed: ${repoId}/${key}`);

        return secrets[key];
      } catch (error: any) {
        console.error('[SecretHandlers] Error getting single secret:', error);
        return null;
      }
    },
  );

  // Get multiple specific secret values
  ipcMain.handle(
    SecretsEvents.GET_MULTIPLE,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
      keys: string[],
    ): Promise<Record<string, string>> => {
      try {
        if (!validateSource(event)) {
          throw new Error('Unauthorized source');
        }

        if (!repoId || !keys || keys.length === 0) {
          return {};
        }

        const secrets = await getStorage().getSecrets(repoId);

        if (!secrets) {
          return {};
        }

        // Return only requested keys
        const result: Record<string, string> = {};
        for (const key of keys) {
          if (secrets[key]) {
            result[key] = secrets[key];
          }
        }

        // Log access for audit
        console.log(
          `[SecretHandlers] Multiple secrets accessed: ${repoId}/${keys.join(', ')}`,
        );

        return result;
      } catch (error: any) {
        console.error(
          '[SecretHandlers] Error getting multiple secrets:',
          error,
        );
        return {};
      }
    },
  );

  // Copy secret directly to clipboard without exposing to renderer
  ipcMain.handle(
    SecretsEvents.COPY_TO_CLIPBOARD,
    async (
      event: IpcMainInvokeEvent,
      repoId: string,
      key: string,
    ): Promise<CopyResult> => {
      try {
        if (!validateSource(event)) {
          return { success: false, error: 'Unauthorized source' };
        }

        if (!repoId || !key) {
          return {
            success: false,
            error: 'Repository ID and key are required',
          };
        }

        const secrets = await getStorage().getSecrets(repoId);

        if (!secrets || !secrets[key]) {
          return { success: false, error: 'Secret not found' };
        }

        // Copy to clipboard
        clipboard.writeText(secrets[key]);

        // Log access for audit
        console.log(
          `[SecretHandlers] Secret copied to clipboard: ${repoId}/${key}`,
        );

        return { success: true };
      } catch (error: any) {
        console.error('[SecretHandlers] Error copying to clipboard:', error);
        return { success: false, error: error.message };
      }
    },
  );

  console.log('[SecretHandlers] All handlers registered successfully');
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
      console.warn('[SecretHandlers] Rejected request from URL:', url);
    }

    return isValid;
  } catch (error) {
    console.error('[SecretHandlers] Error validating source:', error);
    return false;
  }
}

/**
 * Cleanup handler for app shutdown
 */
export async function cleanupSecretHandlers(): Promise<void> {
  // Only cleanup if SecretManager was actually initialized
  // This avoids unnecessary keychain access during shutdown
  console.log('[SecretHandlers] Cleanup complete');
}
