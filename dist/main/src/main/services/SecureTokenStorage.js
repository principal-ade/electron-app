import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
/**
 * Secure token storage using Electron's safeStorage API
 * Encrypts tokens using the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
 */
export class SecureTokenStorage {
    static instance;
    storageFilePath;
    cache = new Map();
    constructor() {
        // Store encrypted tokens in userData directory
        const userDataPath = app.getPath('userData');
        this.storageFilePath = path.join(userDataPath, 'secure-tokens.json');
        this.loadFromDisk();
    }
    static getInstance() {
        if (!SecureTokenStorage.instance) {
            SecureTokenStorage.instance = new SecureTokenStorage();
        }
        return SecureTokenStorage.instance;
    }
    /**
     * Store a token securely
     */
    async setToken(key, token, metadata) {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Encryption is not available on this system');
        }
        try {
            // Encrypt the token
            const encryptedToken = safeStorage.encryptString(token);
            // Store with metadata
            const data = {
                token: encryptedToken.toString('base64'),
                metadata: metadata || {},
                savedAt: Date.now()
            };
            this.cache.set(key, data);
            await this.saveToDisk();
        }
        catch (error) {
            console.error('Failed to store token securely:', error);
            throw error;
        }
    }
    /**
     * Retrieve a token
     */
    async getToken(key) {
        try {
            const data = this.cache.get(key);
            if (!data) {
                return null;
            }
            // Decrypt the token
            const encryptedBuffer = Buffer.from(data.token, 'base64');
            const decrypted = safeStorage.decryptString(encryptedBuffer);
            return decrypted;
        }
        catch (error) {
            console.error('Failed to retrieve token:', error);
            return null;
        }
    }
    /**
     * Get token with metadata
     */
    async getTokenWithMetadata(key) {
        try {
            const data = this.cache.get(key);
            if (!data) {
                return null;
            }
            const encryptedBuffer = Buffer.from(data.token, 'base64');
            const decrypted = safeStorage.decryptString(encryptedBuffer);
            return {
                token: decrypted,
                metadata: data.metadata
            };
        }
        catch (error) {
            console.error('Failed to retrieve token with metadata:', error);
            return null;
        }
    }
    /**
     * Delete a token
     */
    async deleteToken(key) {
        this.cache.delete(key);
        await this.saveToDisk();
    }
    /**
     * Check if a token exists
     */
    hasToken(key) {
        return this.cache.has(key);
    }
    /**
     * Clear all tokens
     */
    async clearAll() {
        this.cache.clear();
        await this.saveToDisk();
    }
    /**
     * Load encrypted tokens from disk
     */
    loadFromDisk() {
        try {
            if (fs.existsSync(this.storageFilePath)) {
                const data = fs.readFileSync(this.storageFilePath, 'utf-8');
                const parsed = JSON.parse(data);
                this.cache = new Map(Object.entries(parsed));
            }
        }
        catch (error) {
            console.error('Failed to load tokens from disk:', error);
            this.cache = new Map();
        }
    }
    /**
     * Save encrypted tokens to disk
     */
    async saveToDisk() {
        try {
            const data = Object.fromEntries(this.cache);
            fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.error('Failed to save tokens to disk:', error);
            throw error;
        }
    }
    /**
     * Migrate from localStorage (one-time migration)
     */
    async migrateFromLocalStorage(entries) {
        for (const entry of entries) {
            try {
                if (entry.value.token) {
                    await this.setToken(entry.key, entry.value.token, entry.value);
                    console.log(`Migrated token: ${entry.key}`);
                }
            }
            catch (error) {
                console.error(`Failed to migrate token ${entry.key}:`, error);
            }
        }
    }
}
// Token storage keys
export const TOKEN_KEYS = {
    ORBIT_AUTH: 'orbit_auth',
    GIT_SYNC_AUTH: 'git-sync-auth',
    GITHUB_TOKEN: 'github_token'
};
