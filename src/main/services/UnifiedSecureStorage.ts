import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { TokenDomain } from './storage-domains/TokenDomain';
import { SecretsDomain } from './storage-domains/SecretsDomain';

const fsPromises = {
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  unlink: promisify(fs.unlink),
  access: promisify(fs.access),
};

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
  tokens: Record<string, any>;
  secrets: Record<string, any>;
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

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system');
    }

    this.encryptionInitialized = true;
    console.log('[UnifiedSecureStorage] Encryption initialized');
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
      const decrypted = safeStorage.decryptString(encryptedBuffer);
      const data: DecryptedData = JSON.parse(decrypted);

      this.memoryCache = data;
      return data;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
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
    const encrypted = safeStorage.encryptString(dataJson);

    const storageData: UnifiedStorageData = {
      version: this.STORAGE_VERSION,
      encrypted: encrypted.toString('base64'),
      metadata: {
        lastModified: Date.now(),
        tokenCount: Object.keys(data.tokens).length,
        secretsCount: Object.entries(data.secrets).reduce(
          (acc, [repoId, secrets]) => {
            acc[repoId] = Object.keys(secrets as any).length;
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

  async setToken(key: string, token: string, metadata?: any): Promise<void> {
    return this.tokenDomain.setToken(key, token, metadata);
  }

  async getToken(key: string): Promise<string | null> {
    return this.tokenDomain.getToken(key);
  }

  async getTokenWithMetadata(
    key: string,
  ): Promise<{ token: string; metadata: any } | null> {
    return this.tokenDomain.getTokenWithMetadata(key);
  }

  async deleteToken(key: string): Promise<void> {
    return this.tokenDomain.deleteToken(key);
  }

  async getAllTokenKeys(): Promise<string[]> {
    return this.tokenDomain.getAllKeys();
  }

  async storeSecrets(
    repoId: string,
    repoPath: string,
    secrets: Record<string, any>,
  ): Promise<{ success: boolean; error?: string; metadata?: any }> {
    return this.secretsDomain.storeSecrets(repoId, repoPath, secrets);
  }

  async getSecrets(repoId: string): Promise<Record<string, any> | null> {
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
  ): Promise<{ data: Record<string, any>; metadata: any } | null> {
    return this.secretsDomain.getSecretsWithMetadata(repoId);
  }

  async getAllSecretsMetadata(): Promise<any[]> {
    return this.secretsDomain.getAllMetadata();
  }

  async clearAll(): Promise<void> {
    const emptyData: DecryptedData = { tokens: {}, secrets: {} };
    await this.saveToDisk(emptyData);
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
    const decrypted = safeStorage.decryptString(encryptedBuffer);
    const decryptedData: DecryptedData = JSON.parse(decrypted);

    await this.saveToDisk(decryptedData);
    console.log('[UnifiedSecureStorage] Data imported successfully');
  }
}

export const TOKEN_KEYS = {
  ORBIT_AUTH: 'orbit_auth',
  GIT_SYNC_AUTH: 'git-sync-auth',
  GITHUB_TOKEN: 'github_token',
} as const;
