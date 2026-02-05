import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { UnifiedSecureStorage, TOKEN_KEYS } from './UnifiedSecureStorage';
import { SecureTokenAPIEvent } from '../../shared/main-process-api-interfaces/SecureTokenAPI';
import type { AuthUser } from '../../shared/main-process-api-interfaces/AuthenticationAPI';
import AuthStateManager from './AuthStateManager';
import { authService } from './AuthService';

// Named types for better readability of dynamic data
/** Dynamic metadata attached to stored tokens (e.g., user info, timestamps) */
type TokenMetadata = unknown;
/** Legacy token data from localStorage migration (unvalidated) */
type LegacyTokenData = unknown;

/**
 * IPC handlers for secure token storage
 * Provides a bridge between renderer process and secure storage in main process
 */
export class SecureTokenIPC {
  private storage: UnifiedSecureStorage | null = null;

  constructor() {
    // Don't initialize storage immediately, defer until first use
    // Don't register handlers here - they should be registered once via registerSecureTokenHandlers()
    // Don't migrate on startup, wait for first actual use
  }

  public getStorage(): UnifiedSecureStorage {
    if (!this.storage) {
      this.storage = UnifiedSecureStorage.getInstance();
    }
    return this.storage;
  }

  private setupHandlers(): void {
    // Save GitHub auth token
    ipcMain.handle(
      SecureTokenAPIEvent.SAVE_GITHUB_AUTH,
      async (event: IpcMainInvokeEvent, token: string, user: AuthUser) => {
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
        // Try GITHUB_TOKEN first (current auth system)
        let data = await this.getStorage().getTokenWithMetadata(
          TOKEN_KEYS.GITHUB_TOKEN,
        );

        // Fallback to ORBIT_AUTH for legacy/P2P
        if (!data) {
          data = await this.getStorage().getTokenWithMetadata(
            TOKEN_KEYS.ORBIT_AUTH,
          );
        }

        if (!data) {
          // No tokens found
          return { authenticated: false };
        }

        return {
          authenticated: true,
          token: data.token,
          user: data.metadata?.user,
        };
      } catch (error) {
        console.error('Failed to get GitHub auth:', error);
        return { authenticated: false };
      }
    });

    // Check if authenticated
    ipcMain.handle(SecureTokenAPIEvent.IS_AUTHENTICATED, async () => {
      const token = await this.getStorage().getToken(TOKEN_KEYS.ORBIT_AUTH);
      return token !== null;
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
      async (event: IpcMainInvokeEvent, key: string, token: string, metadata?: TokenMetadata) => {
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
      async (event: IpcMainInvokeEvent, tokens: LegacyTokenData[]) => {
        try {
          // Migration no longer needed with unified storage
          console.log('Migration skipped - using unified storage');
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
  const { TOKEN_KEYS } = require('./UnifiedSecureStorage');
  const {
    SecureTokenAPIEvent,
  } = require('../../shared/main-process-api-interfaces/SecureTokenAPI');
  const AuthStateManager = require('./AuthStateManager').default;

  // Save GitHub auth token
  ipcMain.handle(
    SecureTokenAPIEvent.SAVE_GITHUB_AUTH,
    async (event: IpcMainInvokeEvent, token: string, user: AuthUser) => {
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
      console.log('[SecureTokenIPC] GET_GITHUB_AUTH called');

      // Use AuthService to get a valid token with automatic refresh
      const token = await authService.getValidToken();
      console.log(
        '[SecureTokenIPC] authService.getValidToken() returned:',
        !!token,
      );

      if (token) {
        // Get user info from AuthStateManager
        const authState = AuthStateManager.getInstance().getFullState();
        console.log('[SecureTokenIPC] AuthStateManager state:', {
          isAuthenticated: authState.isAuthenticated,
          hasUser: !!authState.user,
          user: authState.user?.login,
        });

        if (authState.isAuthenticated && authState.user) {
          console.log(
            '[SecureTokenIPC] Returning authenticated with token from AuthService',
          );
          return {
            authenticated: true,
            token,
            user: authState.user,
          };
        } else {
          console.warn(
            '[SecureTokenIPC] Have token but AuthStateManager not authenticated',
          );
        }
      }

      // Fallback to ORBIT_AUTH for legacy/P2P
      console.log('[SecureTokenIPC] Trying ORBIT_AUTH fallback');
      const orbitData = await getSecureTokenIPC()
        .getStorage()
        .getTokenWithMetadata(TOKEN_KEYS.ORBIT_AUTH);

      if (orbitData) {
        console.log('[SecureTokenIPC] Found ORBIT_AUTH token');
        return {
          authenticated: true,
          token: orbitData.token,
          user: orbitData.metadata?.user,
        };
      }

      // No tokens found
      console.warn(
        '[SecureTokenIPC] No tokens found, returning authenticated: false',
      );
      return { authenticated: false };
    } catch (error) {
      console.error('[SecureTokenIPC] Failed to get GitHub auth:', error);
      return { authenticated: false };
    }
  });

  // Check if authenticated
  ipcMain.handle(SecureTokenAPIEvent.IS_AUTHENTICATED, async () => {
    const token = await getSecureTokenIPC()
      .getStorage()
      .getToken(TOKEN_KEYS.ORBIT_AUTH);
    return token !== null;
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
    async (event: IpcMainInvokeEvent, key: string, token: string, metadata?: TokenMetadata) => {
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

  ipcMain.handle(SecureTokenAPIEvent.GET, async (event: IpcMainInvokeEvent, key: string) => {
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
    async (event: IpcMainInvokeEvent, key: string) => {
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
    async (event: IpcMainInvokeEvent, tokens: LegacyTokenData[]) => {
      try {
        // Migration no longer needed with unified storage
        console.log('Migration skipped - using unified storage');
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
