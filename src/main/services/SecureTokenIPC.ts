import { ipcMain } from 'electron';
import { SecureTokenStorage, TOKEN_KEYS } from './SecureTokenStorage';
import AuthStateManager from './AuthStateManager';

/**
 * IPC handlers for secure token storage
 * Provides a bridge between renderer process and secure storage in main process
 */
export class SecureTokenIPC {
  private storage: SecureTokenStorage;

  constructor() {
    this.storage = SecureTokenStorage.getInstance();
    this.setupHandlers();
    this.migrateExistingTokens();
  }

  private setupHandlers(): void {
    // Save GitHub auth token
    ipcMain.handle('secure-token:save-github-auth', async (event, token: string, user: any) => {
      try {
        await this.storage.setToken(TOKEN_KEYS.ORBIT_AUTH, token, { user });
        return { success: true };
      } catch (error) {
        console.error('Failed to save GitHub auth:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Get GitHub auth token
    ipcMain.handle('secure-token:get-github-auth', async () => {
      try {
        const data = await this.storage.getTokenWithMetadata(TOKEN_KEYS.ORBIT_AUTH);
        if (!data) {
          // Ensure state is cleared if no credentials found
          AuthStateManager.getInstance().clearAuthentication();
          return { authenticated: false };
        }
        
        // Update AuthStateManager when credentials are successfully retrieved
        AuthStateManager.getInstance().setAuthenticated(data.metadata.user, data.token);
        
        return {
          authenticated: true,
          token: data.token,
          user: data.metadata.user
        };
      } catch (error) {
        console.error('Failed to get GitHub auth:', error);
        // Ensure state is cleared on error
        AuthStateManager.getInstance().clearAuthentication();
        return { authenticated: false };
      }
    });

    // Check if authenticated
    ipcMain.handle('secure-token:is-authenticated', async () => {
      return this.storage.hasToken(TOKEN_KEYS.ORBIT_AUTH);
    });

    // Clear GitHub auth
    ipcMain.handle('secure-token:clear-github-auth', async () => {
      try {
        await this.storage.deleteToken(TOKEN_KEYS.ORBIT_AUTH);
        return { success: true };
      } catch (error) {
        console.error('Failed to clear GitHub auth:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Generic token operations
    ipcMain.handle('secure-token:set', async (event, key: string, token: string, metadata?: any) => {
      try {
        await this.storage.setToken(key, token, metadata);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('secure-token:get', async (event, key: string) => {
      try {
        const token = await this.storage.getToken(key);
        return { success: true, token };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('secure-token:delete', async (event, key: string) => {
      try {
        await this.storage.deleteToken(key);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Migration helper - to be called once from renderer
    ipcMain.handle('secure-token:migrate-from-localstorage', async (event, tokens: any[]) => {
      try {
        await this.storage.migrateFromLocalStorage(tokens);
        return { success: true };
      } catch (error) {
        console.error('Migration failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
  }

  /**
   * Attempt to migrate existing tokens from localStorage (one-time)
   * This should be called on app startup
   */
  private async migrateExistingTokens(): Promise<void> {
    // This will be triggered from the renderer process
    // which has access to localStorage
    console.log('SecureTokenIPC initialized - ready for token migration');
  }
}

// Initialize on import
export const secureTokenIPC = new SecureTokenIPC();