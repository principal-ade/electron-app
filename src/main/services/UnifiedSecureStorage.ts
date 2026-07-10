import { app } from 'electron';
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
  rename: promisify(fs.rename),
  access: promisify(fs.access),
};

/**
 * Legacy error types kept for AuthService / IPC compatibility.
 * Plaintext storage no longer uses the OS keychain; these are unused at runtime.
 */
export class KeychainTimeoutError extends Error {
  constructor(operation: string) {
    super(`Keychain operation timed out during ${operation}.`);
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
    super('Keychain encryption is not available on this system.');
    this.name = 'KeychainNotAvailableError';
  }
}

/**
 * On-disk layout (v2): plaintext JSON, owner-only file mode (0o600).
 * Same approach as OpenCode's auth.json — no OS keychain / safeStorage.
 */
export interface UnifiedStorageData {
  version: string;
  tokens: Record<
    string,
    { token: string; metadata?: Record<string, unknown>; savedAt: number }
  >;
  secrets: Record<string, StoredSecret>;
  metadata: {
    lastModified: number;
    tokenCount: number;
    secretsCount: Record<string, number>;
  };
}

interface StoredData {
  tokens: Record<
    string,
    { token: string; metadata?: Record<string, unknown>; savedAt: number }
  >;
  secrets: Record<string, StoredSecret>;
}

export class UnifiedSecureStorage {
  private static instance: UnifiedSecureStorage;
  private storageFilePath: string;
  private memoryCache: StoredData | null = null;
  private tokenDomain: TokenDomain;
  private secretsDomain: SecretsDomain;
  /** Plaintext format version. v1 was safeStorage-encrypted. */
  private readonly STORAGE_VERSION = '2.0.0';

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

  private emptyData(): StoredData {
    return { tokens: {}, secrets: {} };
  }

  private buildMetadata(data: StoredData): UnifiedStorageData['metadata'] {
    return {
      lastModified: Date.now(),
      tokenCount: Object.keys(data.tokens).length,
      secretsCount: Object.entries(data.secrets).reduce(
        (acc, [repoId, storedSecret]) => {
          acc[repoId] = Object.keys(storedSecret.data).length;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  private isLegacyEncrypted(stored: Record<string, unknown>): boolean {
    return (
      typeof stored.encrypted === 'string' &&
      !Object.prototype.hasOwnProperty.call(stored, 'tokens')
    );
  }

  /**
   * Move unreadable legacy encrypted files aside so we never call safeStorage.
   * Users must re-login; recovering v1 data would reintroduce keychain prompts.
   */
  private async quarantineLegacyFile(): Promise<void> {
    const backupPath = `${this.storageFilePath}.legacy-encrypted.bak`;
    try {
      await fsPromises.rename(this.storageFilePath, backupPath);
      console.warn(
        '[UnifiedSecureStorage] Quarantined legacy keychain-encrypted storage at',
        backupPath,
        '— log in again to create plaintext credentials (0o600).',
      );
    } catch (error) {
      console.error(
        '[UnifiedSecureStorage] Failed to quarantine legacy storage file:',
        error,
      );
    }
  }

  private async loadFromDisk(): Promise<StoredData> {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    try {
      await fsPromises.access(this.storageFilePath, fs.constants.F_OK);
      const fileContent = await fsPromises.readFile(
        this.storageFilePath,
        'utf-8',
      );
      const stored = JSON.parse(fileContent) as Record<string, unknown>;

      // Never decrypt v1 files — that would hit macOS Keychain.
      if (this.isLegacyEncrypted(stored)) {
        await this.quarantineLegacyFile();
        const empty = this.emptyData();
        this.memoryCache = empty;
        return empty;
      }

      const tokens =
        stored.tokens && typeof stored.tokens === 'object'
          ? (stored.tokens as StoredData['tokens'])
          : {};
      const secrets =
        stored.secrets && typeof stored.secrets === 'object'
          ? (stored.secrets as StoredData['secrets'])
          : {};

      const data: StoredData = { tokens, secrets };
      this.memoryCache = data;
      return data;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        console.log(
          '[UnifiedSecureStorage] No existing storage file, starting empty',
        );
        const emptyData = this.emptyData();
        this.memoryCache = emptyData;
        return emptyData;
      }
      console.error('[UnifiedSecureStorage] Failed to load from disk:', error);
      throw error;
    }
  }

  private async saveToDisk(data: StoredData): Promise<void> {
    const storageData: UnifiedStorageData = {
      version: this.STORAGE_VERSION,
      tokens: data.tokens,
      secrets: data.secrets,
      metadata: this.buildMetadata(data),
    };

    await fsPromises.writeFile(
      this.storageFilePath,
      JSON.stringify(storageData, null, 2),
      { mode: 0o600 },
    );

    this.memoryCache = data;
    console.log('[UnifiedSecureStorage] Saved plaintext storage (mode 0o600)');
  }

  async getData(): Promise<StoredData> {
    return this.loadFromDisk();
  }

  async updateData(updater: (data: StoredData) => StoredData): Promise<void> {
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
  ): Promise<{
    data: Record<string, SecretValue>;
    metadata: SecretMetadata;
  } | null> {
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
    const data = await this.loadFromDisk();
    return {
      version: this.STORAGE_VERSION,
      tokens: data.tokens,
      secrets: data.secrets,
      metadata: this.buildMetadata(data),
    };
  }

  async importData(data: UnifiedStorageData): Promise<void> {
    if (this.isLegacyEncrypted(data as unknown as Record<string, unknown>)) {
      throw new Error(
        'Cannot import legacy keychain-encrypted storage without decryption. Use a v2 plaintext export.',
      );
    }

    await this.saveToDisk({
      tokens: data.tokens ?? {},
      secrets: data.secrets ?? {},
    });
    console.log('[UnifiedSecureStorage] Data imported successfully');
  }

  /**
   * Storage status for settings / diagnostics.
   * No longer touches the OS keychain.
   */
  async checkKeychainStatus(): Promise<{
    available: boolean;
    initialized: boolean;
    error?: string;
    errorType?: string;
    storageMode?: 'plaintext';
  }> {
    return {
      available: true,
      initialized: true,
      storageMode: 'plaintext',
    };
  }

  /**
   * Verifies the storage file can be read/written. Does not use keychain.
   */
  async testKeychainAccess(): Promise<{
    success: boolean;
    error?: string;
    errorType?: string;
  }> {
    try {
      const data = await this.loadFromDisk();
      // Round-trip write of current data (no-op content-wise) to verify perms
      await this.saveToDisk(data);
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'unknown',
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
