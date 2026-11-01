import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { UnifiedSecureStorage } from './UnifiedSecureStorage';
import { SecureTokenAPIEvent } from '../../shared/main-process-api-interfaces/SecureTokenAPI';
import { authService } from './AuthService';
import type { TokenMetadata } from './storage-domains/TokenDomain';

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
  const AuthStateManager = require('./AuthStateManager').default;

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
    const token = await authService.getValidToken();
    return token !== null;
  });

  // Generic token operations
  ipcMain.handle(
    SecureTokenAPIEvent.SET,
    async (
      event: IpcMainInvokeEvent,
      key: string,
      token: string,
      metadata?: unknown,
    ) => {
      try {
        await getSecureTokenIPC()
          .getStorage()
          .setToken(key, token, metadata as TokenMetadata | undefined);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  ipcMain.handle(
    SecureTokenAPIEvent.GET,
    async (event: IpcMainInvokeEvent, key: string) => {
      try {
        const token = await getSecureTokenIPC().getStorage().getToken(key);
        return { success: true, token };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

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
}

// Export for backward compatibility, but don't create instance yet
export const secureTokenIPC = new Proxy({} as SecureTokenIPC, {
  get(target, prop) {
    return getSecureTokenIPC()[prop as keyof SecureTokenIPC];
  },
});
