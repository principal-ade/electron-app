import { ipcMain } from 'electron';
import { SecureTokenStorage, TOKEN_KEYS } from './SecureTokenStorage';
import { SecureTokenAPIEvent } from '../../shared/main-process-api-interfaces/SecureTokenAPI';
import AuthStateManager from './AuthStateManager';

/**
 * IPC handlers for secure token storage
 * Provides a bridge between renderer process and secure storage in main process
 */
export class SecureTokenIPC {
  private storage: SecureTokenStorage | null = null;

  constructor() {
    // Don't initialize storage immediately, defer until first use
    this.setupHandlers();
    // Don't migrate on startup, wait for first actual use
  }

  public getStorage(): SecureTokenStorage {
    if (!this.storage) {
      this.storage = SecureTokenStorage.getInstance();
    }
    return this.storage;
  }

  private setupHandlers(): void {
    // Save GitHub auth token
    ipcMain.handle(
      SecureTokenAPIEvent.SAVE_GITHUB_AUTH,
      async (event, token: string, user: any) => {
        try {
          await this.getStorage().setToken(TOKEN_KEYS.ORBIT_AUTH, token, {
            user,
          });
          return { success: true };
        } catch (error) {
          console.error('Failed to save GitHub auth:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    );

    // Get GitHub auth token
    ipcMain.handle(SecureTokenAPIEvent.GET_GITHUB_AUTH, async () => {
      try {
        const data = await this.getStorage().getTokenWithMetadata(
          TOKEN_KEYS.ORBIT_AUTH,
        );
        if (!data) {
          // Ensure state is cleared if no credentials found
          AuthStateManager.getInstance().clearAuthentication();
          return { authenticated: false };
        }

        // Update AuthStateManager when credentials are successfully retrieved
        AuthStateManager.getInstance().setAuthenticated(
          data.metadata.user,
          data.token,
        );

        return {
          authenticated: true,
          token: data.token,
          user: data.metadata.user,
        };
      } catch (error) {
        console.error('Failed to get GitHub auth:', error);
        // Ensure state is cleared on error
        AuthStateManager.getInstance().clearAuthentication();
        return { authenticated: false };
      }
    });

    // Check if authenticated
    ipcMain.handle(SecureTokenAPIEvent.IS_AUTHENTICATED, async () => {
      return this.getStorage().hasToken(TOKEN_KEYS.ORBIT_AUTH);
    });

    // Clear GitHub auth
    ipcMain.handle(SecureTokenAPIEvent.CLEAR_GITHUB_AUTH, async () => {
      try {
        await this.getStorage().deleteToken(TOKEN_KEYS.ORBIT_AUTH);
        return { success: true };
      } catch (error) {
        console.error('Failed to clear GitHub auth:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Generic token operations
    ipcMain.handle(
      SecureTokenAPIEvent.SET,
      async (event, key: string, token: string, metadata?: any) => {
        try {
          await this.getStorage().setToken(key, token, metadata);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    );

    ipcMain.handle(SecureTokenAPIEvent.GET, async (event, key: string) => {
      try {
        const token = await this.getStorage().getToken(key);
        return { success: true, token };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle(SecureTokenAPIEvent.DELETE, async (event, key: string) => {
      try {
        await this.getStorage().deleteToken(key);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Migration helper - to be called once from renderer
    ipcMain.handle(
      SecureTokenAPIEvent.MIGRATE_FROM_LOCALSTORAGE,
      async (event, tokens: any[]) => {
        try {
          await this.getStorage().migrateFromLocalStorage(tokens);
          return { success: true };
        } catch (error) {
          console.error('Migration failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    );
  }

  // Migration will now happen on first actual use, not on startup
}

// Lazy initialization to avoid keychain access on startup
let _secureTokenIPC: SecureTokenIPC | null = null;

function getSecureTokenIPC(): SecureTokenIPC {
  if (!_secureTokenIPC) {
    _secureTokenIPC = new SecureTokenIPC();
  }
  return _secureTokenIPC;
}

// Register IPC handlers without creating the SecureTokenIPC instance
// The instance will be created lazily when the first IPC call is made
export function registerSecureTokenHandlers(): void {
  // Register handlers without creating the SecureTokenIPC instance
  const { ipcMain } = require('electron');
  const { TOKEN_KEYS } = require('./SecureTokenStorage');
  const {
    SecureTokenAPIEvent,
  } = require('../../shared/main-process-api-interfaces/SecureTokenAPI');
  const AuthStateManager = require('./AuthStateManager').default;

  // Save GitHub auth token
  ipcMain.handle(
    SecureTokenAPIEvent.SAVE_GITHUB_AUTH,
    async (event: any, token: string, user: any) => {
      try {
        await getSecureTokenIPC()
          .getStorage()
          .setToken(TOKEN_KEYS.ORBIT_AUTH, token, { user });
        return { success: true };
      } catch (error) {
        console.error('Failed to save GitHub auth:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get GitHub auth token
  ipcMain.handle(SecureTokenAPIEvent.GET_GITHUB_AUTH, async () => {
    try {
      const data = await getSecureTokenIPC()
        .getStorage()
        .getTokenWithMetadata(TOKEN_KEYS.ORBIT_AUTH);
      if (!data) {
        AuthStateManager.getInstance().clearAuthentication();
        return { authenticated: false };
      }

      AuthStateManager.getInstance().setAuthenticated(
        data.metadata.user,
        data.token,
      );

      return {
        authenticated: true,
        token: data.token,
        user: data.metadata.user,
      };
    } catch (error) {
      console.error('Failed to get GitHub auth:', error);
      AuthStateManager.getInstance().clearAuthentication();
      return { authenticated: false };
    }
  });

  // Check if authenticated
  ipcMain.handle(SecureTokenAPIEvent.IS_AUTHENTICATED, async () => {
    return getSecureTokenIPC().getStorage().hasToken(TOKEN_KEYS.ORBIT_AUTH);
  });

  // Clear GitHub auth
  ipcMain.handle(SecureTokenAPIEvent.CLEAR_GITHUB_AUTH, async () => {
    try {
      await getSecureTokenIPC().getStorage().deleteToken(TOKEN_KEYS.ORBIT_AUTH);
      return { success: true };
    } catch (error) {
      console.error('Failed to clear GitHub auth:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Generic token operations
  ipcMain.handle(
    SecureTokenAPIEvent.SET,
    async (event: any, key: string, token: string, metadata?: any) => {
      try {
        await getSecureTokenIPC().getStorage().setToken(key, token, metadata);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  ipcMain.handle(SecureTokenAPIEvent.GET, async (event: any, key: string) => {
    try {
      const token = await getSecureTokenIPC().getStorage().getToken(key);
      return { success: true, token };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(
    SecureTokenAPIEvent.DELETE,
    async (event: any, key: string) => {
      try {
        await getSecureTokenIPC().getStorage().deleteToken(key);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Migration helper
  ipcMain.handle(
    SecureTokenAPIEvent.MIGRATE_FROM_LOCALSTORAGE,
    async (event: any, tokens: any[]) => {
      try {
        await getSecureTokenIPC().getStorage().migrateFromLocalStorage(tokens);
        return { success: true };
      } catch (error) {
        console.error('Migration failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );
}

// Export for backward compatibility, but don't create instance yet
export const secureTokenIPC = new Proxy({} as SecureTokenIPC, {
  get(target, prop) {
    return getSecureTokenIPC()[prop as keyof SecureTokenIPC];
  },
});
