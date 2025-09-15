/**
 * IPC handlers for SecretManager - Core storage operations
 * Focused on store, get, and delete operations
 */
import { ipcMain } from 'electron';
import { SecretsEvents } from '../../shared/main-process-api-interfaces/SecretsAPI';
import { SecretManager } from './SecretManager';
/**
 * Register core secret management IPC handlers
 */
export function registerSecretHandlers() {
    const secretManager = SecretManager.getInstance();
    // Store secrets for a repository
    ipcMain.handle(SecretsEvents.STORE, async (event, request) => {
        try {
            console.log('[SecretHandlers] Storing secrets for repository:', request.repoId);
            // Validate the request comes from our app
            if (!validateSource(event)) {
                return { success: false, error: 'Unauthorized source' };
            }
            // Validate inputs
            if (!request.repoId || !request.repoPath || !request.secrets) {
                return { success: false, error: 'Missing required parameters' };
            }
            return await secretManager.storeSecrets(request.repoId, request.repoPath, request.secrets);
        }
        catch (error) {
            console.error('[SecretHandlers] Error storing secrets:', error);
            return { success: false, error: error.message };
        }
    });
    // Get secrets for a repository
    ipcMain.handle(SecretsEvents.GET, async (event, repoId) => {
        try {
            console.log('[SecretHandlers] Getting secrets for repository:', repoId);
            if (!validateSource(event)) {
                throw new Error('Unauthorized source');
            }
            if (!repoId) {
                throw new Error('Repository ID is required');
            }
            return await secretManager.getSecrets(repoId);
        }
        catch (error) {
            console.error('[SecretHandlers] Error getting secrets:', error);
            return null;
        }
    });
    // Delete secrets for a repository
    ipcMain.handle(SecretsEvents.DELETE, async (event, repoId) => {
        try {
            console.log('[SecretHandlers] Deleting secrets for repository:', repoId);
            if (!validateSource(event)) {
                return { success: false, error: 'Unauthorized source' };
            }
            if (!repoId) {
                return { success: false, error: 'Repository ID is required' };
            }
            return await secretManager.deleteSecrets(repoId);
        }
        catch (error) {
            console.error('[SecretHandlers] Error deleting secrets:', error);
            return { success: false, error: error.message };
        }
    });
    // Check if secrets exist for a repository
    ipcMain.handle(SecretsEvents.EXISTS, async (event, repoId) => {
        try {
            if (!validateSource(event)) {
                return false;
            }
            const secrets = await secretManager.getSecrets(repoId);
            return secrets !== null && Object.keys(secrets).length > 0;
        }
        catch (error) {
            console.error('[SecretHandlers] Error checking secrets:', error);
            return false;
        }
    });
    // Get metadata for all stored secrets
    ipcMain.handle(SecretsEvents.LIST, async (event) => {
        try {
            console.log('[SecretHandlers] Listing all secret metadata');
            if (!validateSource(event)) {
                throw new Error('Unauthorized source');
            }
            return await secretManager.getAllMetadata();
        }
        catch (error) {
            console.error('[SecretHandlers] Error listing secrets:', error);
            return [];
        }
    });
    // Update existing secrets (merge with existing)
    ipcMain.handle(SecretsEvents.UPDATE, async (event, request) => {
        try {
            console.log('[SecretHandlers] Updating secrets for repository:', request.repoId);
            if (!validateSource(event)) {
                return { success: false, error: 'Unauthorized source' };
            }
            // Get existing secrets
            const existing = await secretManager.getSecrets(request.repoId) || {};
            // Merge with new secrets
            const merged = { ...existing, ...request.secrets };
            // Store merged secrets
            return await secretManager.storeSecrets(request.repoId, request.repoPath, merged);
        }
        catch (error) {
            console.error('[SecretHandlers] Error updating secrets:', error);
            return { success: false, error: error.message };
        }
    });
    // Remove specific secrets from a repository
    ipcMain.handle(SecretsEvents.REMOVE_KEYS, async (event, repoId, keys) => {
        try {
            console.log('[SecretHandlers] Removing keys from repository:', repoId, keys);
            if (!validateSource(event)) {
                return { success: false, error: 'Unauthorized source' };
            }
            // Get existing secrets
            const existing = await secretManager.getSecrets(repoId);
            if (!existing) {
                return { success: false, error: 'No secrets found for repository' };
            }
            // Remove specified keys
            for (const key of keys) {
                delete existing[key];
            }
            // Get metadata to find repo path
            const metadata = await secretManager.getAllMetadata();
            const repoMeta = metadata.find(m => m.repoId === repoId);
            if (!repoMeta) {
                return { success: false, error: 'Repository metadata not found' };
            }
            // Store updated secrets
            return await secretManager.storeSecrets(repoId, repoMeta.repoPath, existing);
        }
        catch (error) {
            console.error('[SecretHandlers] Error removing keys:', error);
            return { success: false, error: error.message };
        }
    });
    // Clear all caches
    ipcMain.handle(SecretsEvents.CLEAR_CACHE, async (event) => {
        try {
            if (!validateSource(event)) {
                throw new Error('Unauthorized source');
            }
            secretManager.clearCache();
            console.log('[SecretHandlers] Cache cleared');
        }
        catch (error) {
            console.error('[SecretHandlers] Error clearing cache:', error);
        }
    });
    console.log('[SecretHandlers] All handlers registered successfully');
}
/**
 * Validate that the IPC request comes from our application
 */
function validateSource(event) {
    try {
        const url = event.sender.getURL();
        // Only accept from file:// protocol (our app)
        return url.startsWith('file://');
    }
    catch {
        return false;
    }
}
/**
 * Cleanup handler for app shutdown
 */
export async function cleanupSecretHandlers() {
    const secretManager = SecretManager.getInstance();
    await secretManager.shutdown();
    console.log('[SecretHandlers] Cleanup complete');
}
