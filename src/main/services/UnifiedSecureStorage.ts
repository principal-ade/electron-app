import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { TokenDomain } from './storage-domains/TokenDomain';
import {
  SecretsDomain,
  type StoredSecret,
  type SecretMetadata,
  type SecretValue,
} from './storage-domains/SecretsDomain';

const fsPromises = {
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  unlink: promisify(fs.unlink),
  access: promisify(fs.access),
};

// Keychain operation timeout (30 seconds)
const KEYCHAIN_TIMEOUT_MS = 30000;

/**
 * Custom error types for better error handling
 */
export class KeychainTimeoutError extends Error {
  constructor(operation: string) {
    super(
      `Keychain operation timed out after ${KEYCHAIN_TIMEOUT_MS / 1000} seconds during ${operation}. Please check System Preferences → Security & Privacy → Privacy → Keychain Access.`,
    );
    this.name = 'KeychainTimeoutError';
  }
}

export class KeychainPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeychainPermissionError';
  }
}

export class KeychainNotAvailableError extends Error {
  constructor() {
    super(
      'Keychain encryption is not available on this system. Please ensure your system keychain is unlocked.',
    );
    this.name = 'KeychainNotAvailableError';
  }
}

/**
 * Wraps a keychain operation with a timeout
 */
async function withKeychainTimeout<T>(
  operation: () => Promise<T> | T,
  operationName: string,
): Promise<T> {
  return Promise.race([
    Promise.resolve(operation()),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new KeychainTimeoutError(operationName)),
        KEYCHAIN_TIMEOUT_MS,
      ),
    ),
  ]);
}

export interface UnifiedStorageData {
  version: string;
  encrypted: string;
  metadata: {
    lastModified: number;
    tokenCount: number;
    secretsCount: Record<string, number>;
  };
}

interface DecryptedData {
  tokens: Record<string, { token: string; metadata?: Record<string, unknown>; savedAt: number }>;
  secrets: Record<string, StoredSecret>;
}

export class UnifiedSecureStorage {
  private static instance: UnifiedSecureStorage;
  private storageFilePath: string;
  private encryptionInitialized: boolean = false;
  private memoryCache: DecryptedData | null = null;
  private tokenDomain: TokenDomain;
  private secretsDomain: SecretsDomain;
  private readonly STORAGE_VERSION = '1.0.0';

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.storageFilePath = path.join(
      userDataPath,
      'unified-secure-storage.json',
    );

    this.tokenDomain = new TokenDomain(this);
    this.secretsDomain = new SecretsDomain(this);
  }

  static getInstance(): UnifiedSecureStorage {
    if (!UnifiedSecureStorage.instance) {
      UnifiedSecureStorage.instance = new UnifiedSecureStorage();
    }
    return UnifiedSecureStorage.instance;
  }

  private async ensureEncryptionAvailable(): Promise<void> {
    if (this.encryptionInitialized) return;

    try {
      console.log(
        '[UnifiedSecureStorage] Checking keychain encryption availability...',
      );

      // Wrap the encryption check in a timeout
      const isAvailable = await withKeychainTimeout(
        () => safeStorage.isEncryptionAvailable(),
        'checking encryption availability',
      );

      if (!isAvailable) {
        throw new KeychainNotAvailableError();
      }

      this.encryptionInitialized = true;
      console.log('[UnifiedSecureStorage] Encryption initialized successfully');
    } catch (error: unknown) {
      // Re-throw custom errors as-is
      if (
        error instanceof KeychainTimeoutError ||
        error instanceof KeychainNotAvailableError
      ) {
        throw error;
      }

      // Wrap other errors in KeychainPermissionError
      console.error(
        '[UnifiedSecureStorage] Failed to initialize encryption:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new KeychainPermissionError(
        `Failed to access keychain: ${errorMessage}. Please grant keychain access in System Preferences.`,
      );
    }
  }

  private async loadFromDisk(): Promise<DecryptedData> {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    try {
      await fsPromises.access(this.storageFilePath, fs.constants.F_OK);
      const fileContent = await fsPromises.readFile(
        this.storageFilePath,
        'utf-8',
      );
      const stored: UnifiedStorageData = JSON.parse(fileContent);

      if (stored.version !== this.STORAGE_VERSION) {
        console.warn(
          `[UnifiedSecureStorage] Version mismatch: ${stored.version} vs ${this.STORAGE_VERSION}`,
        );
      }

      await this.ensureEncryptionAvailable();

      const encryptedBuffer = Buffer.from(stored.encrypted, 'base64');
      const decrypted = await withKeychainTimeout(
        () => safeStorage.decryptString(encryptedBuffer),
        'decrypting stored data',
      );
      const data: DecryptedData = JSON.parse(decrypted);

      this.memoryCache = data;

      return data;
    } catch (error: unknown) {
      // Check if it's a file not found error (ENOENT)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        console.log(
          '[UnifiedSecureStorage] No existing storage file, creating new',
        );
        const emptyData: DecryptedData = { tokens: {}, secrets: {} };
        this.memoryCache = emptyData;
        return emptyData;
      }
      console.error('[UnifiedSecureStorage] Failed to load from disk:', error);
      throw error;
    }
  }

  private async saveToDisk(data: DecryptedData): Promise<void> {
    await this.ensureEncryptionAvailable();

    const dataJson = JSON.stringify(data);
    const encrypted = await withKeychainTimeout(
      () => safeStorage.encryptString(dataJson),
      'encrypting data for storage',
    );

    const storageData: UnifiedStorageData = {
      version: this.STORAGE_VERSION,
      encrypted: encrypted.toString('base64'),
      metadata: {
        lastModified: Date.now(),
        tokenCount: Object.keys(data.tokens).length,
        secretsCount: Object.entries(data.secrets).reduce(
          (acc, [repoId, storedSecret]) => {
            acc[repoId] = Object.keys(storedSecret.data).length;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };

    await fsPromises.writeFile(
      this.storageFilePath,
      JSON.stringify(storageData, null, 2),
      { mode: 0o600 },
    );

    this.memoryCache = data;
    console.log('[UnifiedSecureStorage] Saved to disk');
  }

  async getData(): Promise<DecryptedData> {
    return this.loadFromDisk();
  }

  async updateData(
    updater: (data: DecryptedData) => DecryptedData,
  ): Promise<void> {
    const data = await this.loadFromDisk();
    const updated = updater(data);
    await this.saveToDisk(updated);
  }

  async setToken(
    key: string,
    token: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    return this.tokenDomain.setToken(key, token, metadata);
  }

  async getToken(key: string): Promise<string | null> {
    return this.tokenDomain.getToken(key);
  }

  async getTokenWithMetadata(
    key: string,
  ): Promise<{ token: string; metadata?: Record<string, unknown> } | null> {
    return this.tokenDomain.getTokenWithMetadata(key);
  }

  async deleteToken(key: string): Promise<boolean> {
    await this.tokenDomain.deleteToken(key);
    return true;
  }

  async getAllTokenKeys(): Promise<string[]> {
    return this.tokenDomain.getAllKeys();
  }

  async storeSecrets(
    repoId: string,
    repoPath: string,
    secrets: Record<string, SecretValue>,
  ): Promise<{ success: boolean; error?: string; metadata?: SecretMetadata }> {
    return this.secretsDomain.storeSecrets(repoId, repoPath, secrets);
  }

  async getSecrets(repoId: string): Promise<Record<string, SecretValue> | null> {
    return this.secretsDomain.getSecrets(repoId);
  }

  async deleteSecrets(repoId: string): Promise<void> {
    return this.secretsDomain.deleteSecrets(repoId);
  }

  async getAllSecretRepoIds(): Promise<string[]> {
    return this.secretsDomain.getAllRepoIds();
  }

  async getSecretsWithMetadata(
    repoId: string,
  ): Promise<{ data: Record<string, SecretValue>; metadata: SecretMetadata } | null> {
    return this.secretsDomain.getSecretsWithMetadata(repoId);
  }

  async getAllSecretsMetadata(): Promise<SecretMetadata[]> {
    return this.secretsDomain.getAllMetadata();
  }

  async clearAll(): Promise<void> {
    await this.tokenDomain.clearAll();
    await this.secretsDomain.clearAll();
    console.log('[UnifiedSecureStorage] Cleared all data');
  }

  async exportData(): Promise<UnifiedStorageData> {
    const fileContent = await fsPromises.readFile(
      this.storageFilePath,
      'utf-8',
    );
    return JSON.parse(fileContent);
  }

  async importData(data: UnifiedStorageData): Promise<void> {
    await this.ensureEncryptionAvailable();

    const encryptedBuffer = Buffer.from(data.encrypted, 'base64');
    const decrypted = await withKeychainTimeout(
      () => safeStorage.decryptString(encryptedBuffer),
      'decrypting imported data',
    );
    const decryptedData: DecryptedData = JSON.parse(decrypted);

    await this.saveToDisk(decryptedData);
    console.log('[UnifiedSecureStorage] Data imported successfully');
  }

  /**
   * Check keychain access status without triggering permission prompts
   * Returns information about encryption availability and initialization state
   */
  async checkKeychainStatus(): Promise<{
    available: boolean;
    initialized: boolean;
    error?: string;
    errorType?: string;
  }> {
    try {
      // First check if already initialized (no keychain access needed)
      if (this.encryptionInitialized) {
        return {
          available: true,
          initialized: true,
        };
      }

      // Try to check availability with timeout
      const isAvailable = await withKeychainTimeout(
        () => safeStorage.isEncryptionAvailable(),
        'checking keychain status',
      );

      return {
        available: isAvailable,
        initialized: false,
      };
    } catch (error: unknown) {
      let errorType = 'unknown';
      let errorMessage = 'Unknown error';

      if (error instanceof KeychainTimeoutError) {
        errorType = 'timeout';
        errorMessage = error.message;
      } else if (error instanceof KeychainNotAvailableError) {
        errorType = 'not_available';
        errorMessage = error.message;
      } else if (error instanceof KeychainPermissionError) {
        errorType = 'permission_denied';
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        available: false,
        initialized: false,
        error: errorMessage,
        errorType,
      };
    }
  }

  /**
   * Test keychain access by attempting a simple encrypt/decrypt operation
   */
  async testKeychainAccess(): Promise<{
    success: boolean;
    error?: string;
    errorType?: string;
  }> {
    try {
      await this.ensureEncryptionAvailable();

      // Test encrypt/decrypt
      const testData = 'test';
      const encrypted = await withKeychainTimeout(
        () => safeStorage.encryptString(testData),
        'testing keychain access (encrypt)',
      );

      const decrypted = await withKeychainTimeout(
        () => safeStorage.decryptString(encrypted),
        'testing keychain access (decrypt)',
      );

      if (decrypted !== testData) {
        throw new Error(
          'Encryption test failed: decrypted data does not match',
        );
      }

      return { success: true };
    } catch (error: unknown) {
      let errorType = 'unknown';
      let errorMessage = 'Unknown error';

      if (error instanceof KeychainTimeoutError) {
        errorType = 'timeout';
        errorMessage = error.message;
      } else if (error instanceof KeychainNotAvailableError) {
        errorType = 'not_available';
        errorMessage = error.message;
      } else if (error instanceof KeychainPermissionError) {
        errorType = 'permission_denied';
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        errorType,
      };
    }
  }
}

export const TOKEN_KEYS = {
  ORBIT_AUTH: 'orbit_auth',
  GIT_SYNC_AUTH: 'git-sync-auth',
  GITHUB_TOKEN: 'github_token',
  WORKOS_TOKEN: 'workos_token',
} as const;
