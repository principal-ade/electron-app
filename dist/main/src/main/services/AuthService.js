/**
 * AuthService - Handles OAuth authentication for the Electron app
 *
 * Uses Electron's safeStorage for secure credential storage without
 * keychain permission prompts. Communicates with code-city-landing
 * OAuth server for GitHub authentication.
 */
import { ipcMain, safeStorage, shell } from 'electron';
import Store from 'electron-store';
import { OAuthServerClient } from './OAuthServerClient';
import AuthStateManager from './AuthStateManager';
class AuthService {
    store;
    isAuthenticating = false;
    currentAuthController = null;
    constructor() {
        // Use electron-store for persistent storage
        this.store = new Store({
            name: 'dev-collab-auth',
            // Don't use encryption key here - we'll use safeStorage for encryption
        });
        this.setupHandlers();
        console.log('[AuthService] Initialized with Electron safeStorage');
        // Note: Calling safeStorage.isEncryptionAvailable() here triggers keychain access on macOS
    }
    setupHandlers() {
        // Check handler - reads from safeStorage
        ipcMain.handle('cli-auth:check', async () => {
            try {
                console.log('\n========================================');
                console.log('[AuthService] CHECK HANDLER INVOKED');
                console.log('[AuthService] Checking safeStorage for stored credentials...');
                console.log('========================================\n');
                const result = await this.getStoredAuth();
                console.log('[AuthService] getStoredAuth returned:', {
                    success: result.success,
                    hasToken: !!result.token,
                    hasUser: !!result.user,
                    error: result.error
                });
                if (result.success && result.token && result.user) {
                    console.log('[AuthService] SUCCESS: Found stored credentials for:', result.user?.login);
                    // Update AuthStateManager when credentials are successfully retrieved
                    AuthStateManager.getInstance().setAuthenticated(result.user, result.token);
                }
                else {
                    console.log('[AuthService] FAILURE: No stored credentials found');
                    // Ensure state is cleared if no credentials found
                    AuthStateManager.getInstance().clearAuthentication();
                }
                return result;
            }
            catch (error) {
                console.error('[AuthService] CHECK ERROR:', error);
                return { success: false, authenticated: false, error: error.message };
            }
        });
        // Status handler
        ipcMain.handle('cli-auth:status', async () => {
            try {
                const auth = await this.getStoredAuth();
                if (auth.success && auth.user) {
                    return {
                        authenticated: true,
                        user: auth.user.login,
                        email: auth.user.email,
                    };
                }
                return { authenticated: false };
            }
            catch (error) {
                return { authenticated: false, error: error.message };
            }
        });
        // Login handler - implements OAuth flow
        ipcMain.handle('cli-auth:login', async (event, options = {}) => {
            console.log('[AuthService] Login requested with options:', options);
            if (this.isAuthenticating && !options.forceNew) {
                console.log('[AuthService] Authentication already in progress');
                return { success: false, error: 'Authentication already in progress' };
            }
            if (options.forceNew && this.currentAuthController) {
                console.log('[AuthService] Force new auth - canceling existing authentication');
                this.cancelAuthentication();
                // Add a small delay to ensure cleanup
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            // Check if already authenticated
            if (!options.forceNew) {
                const existingAuth = await this.getStoredAuth();
                if (existingAuth.success) {
                    console.log('[AuthService] Already authenticated as:', existingAuth.user?.login);
                    return existingAuth;
                }
            }
            this.isAuthenticating = true;
            this.currentAuthController = new AbortController();
            try {
                // Use the OAuth client from dev-collab-cli
                const authClient = new OAuthServerClient({
                    serverUrl: process.env.AUTH_SERVER_URL || 'https://principle-md.com',
                    forceReauth: options.forceNew || false,
                });
                // Override the open function to use Electron's shell
                const originalOpen = global.open;
                global.open = (url) => shell.openExternal(url);
                try {
                    console.log('[AuthService] Starting OAuth flow...');
                    const result = await authClient.authenticate();
                    // Store the credentials securely
                    await this.storeAuth(result.token, result.user);
                    console.log('[AuthService] Authentication successful for:', result.user.login);
                    // Update AuthStateManager
                    AuthStateManager.getInstance().setAuthenticated(result.user, result.token);
                    return {
                        success: true,
                        authenticated: true,
                        token: result.token,
                        user: result.user,
                    };
                }
                finally {
                    // Restore original open function
                    global.open = originalOpen;
                }
            }
            catch (error) {
                if (error.name === 'AbortError') {
                    console.log('[AuthService] Authentication was canceled');
                    return { success: false, error: 'Authentication canceled' };
                }
                console.error('[AuthService] Authentication error:', error);
                // Provide more user-friendly error messages
                let errorMessage = error.message;
                if (error.message.includes('timeout')) {
                    errorMessage = 'Authentication timed out. Please try again.';
                }
                else if (error.message.includes('network')) {
                    errorMessage = 'Network error. Please check your connection.';
                }
                return { success: false, error: errorMessage };
            }
            finally {
                this.isAuthenticating = false;
                this.currentAuthController = null;
            }
        });
        // Logout handler
        ipcMain.handle('cli-auth:logout', async () => {
            try {
                await this.clearStoredAuth();
                // Clear AuthStateManager
                AuthStateManager.getInstance().clearAuthentication();
                return { success: true };
            }
            catch (error) {
                console.error('[AuthService] Logout error:', error);
                return { success: false, error: error.message };
            }
        });
    }
    cancelAuthentication() {
        if (this.currentAuthController) {
            this.currentAuthController.abort();
            this.currentAuthController = null;
            this.isAuthenticating = false;
        }
    }
    async getStoredAuth() {
        try {
            console.log('[AuthService] Reading from safeStorage...');
            // Get encrypted token from store
            const encryptedToken = this.store.get('github_token_encrypted');
            const userData = this.store.get('github_user');
            if (!encryptedToken || !userData) {
                console.log('[AuthService] No stored credentials found');
                return { success: false, authenticated: false };
            }
            // Decrypt the token
            let token;
            if (safeStorage.isEncryptionAvailable()) {
                try {
                    const buffer = Buffer.from(encryptedToken, 'base64');
                    token = safeStorage.decryptString(buffer);
                    console.log('[AuthService] Token decrypted successfully');
                }
                catch (error) {
                    console.error('[AuthService] Failed to decrypt token:', error);
                    return { success: false, authenticated: false, error: 'Failed to decrypt token' };
                }
            }
            else {
                // Fallback for development where encryption might not be available
                console.warn('[AuthService] Encryption not available, using unencrypted token');
                token = encryptedToken;
            }
            console.log('[AuthService] Successfully retrieved credentials for:', userData.login);
            return {
                success: true,
                authenticated: true,
                token,
                user: userData
            };
        }
        catch (error) {
            console.error('[AuthService] Failed to get stored auth:', error);
            return {
                success: false,
                authenticated: false,
                error: error.message
            };
        }
    }
    async storeAuth(token, user) {
        try {
            console.log('[AuthService] Storing credentials for:', user.login);
            // Encrypt the token using safeStorage
            let encryptedToken;
            if (safeStorage.isEncryptionAvailable()) {
                const buffer = safeStorage.encryptString(token);
                encryptedToken = buffer.toString('base64');
                console.log('[AuthService] Token encrypted successfully');
            }
            else {
                // Fallback for development
                console.warn('[AuthService] Encryption not available, storing unencrypted');
                encryptedToken = token;
            }
            // Store encrypted token and user data
            this.store.set('github_token_encrypted', encryptedToken);
            this.store.set('github_user', user);
            console.log('[AuthService] Credentials stored successfully');
        }
        catch (error) {
            console.error('[AuthService] Failed to store credentials:', error);
            throw error;
        }
    }
    async clearStoredAuth() {
        try {
            this.store.delete('github_token_encrypted');
            this.store.delete('github_user');
            console.log('[AuthService] Credentials cleared');
        }
        catch (error) {
            console.error('[AuthService] Failed to clear credentials:', error);
            // Don't throw - clearing non-existent credentials is fine
        }
    }
    /**
     * Initialize auth state on startup
     * Only checks if credentials exist without decrypting (to avoid keychain prompt)
     */
    async initializeAuthState() {
        try {
            console.log('[AuthService] Checking for existing authentication (without decryption)...');
            // Only check if credentials exist, don't decrypt yet
            const hasStoredAuth = this.hasStoredAuth();
            if (hasStoredAuth) {
                console.log('[AuthService] Found stored credentials (will decrypt on first use)');
                // Don't update AuthStateManager yet - wait for actual auth check
                // This avoids the keychain prompt on startup
            }
            else {
                console.log('[AuthService] No existing authentication found');
                // Ensure AuthStateManager is in unauthenticated state
                AuthStateManager.getInstance().clearAuthentication();
            }
        }
        catch (error) {
            console.error('[AuthService] Error initializing auth state:', error);
            // On error, ensure we're in unauthenticated state
            AuthStateManager.getInstance().clearAuthentication();
        }
    }
    /**
     * Check if stored auth exists without decrypting
     */
    hasStoredAuth() {
        try {
            const encryptedToken = this.store.get('github_token_encrypted');
            const userData = this.store.get('github_user');
            return !!(encryptedToken && userData);
        }
        catch {
            return false;
        }
    }
}
// Create and export singleton instance
export const authService = new AuthService();
