/**
 * Tests for SecretManager
 */
import { SecretManager } from './SecretManager';
import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getTypedStorageManagerInstance } from './initialization';
// Mock electron modules
jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: jest.fn(),
    encryptString: jest.fn(),
    decryptString: jest.fn(),
  },
  app: {
    getPath: jest.fn(),
  },
}));
// Mock file system
jest.mock('fs');
// Mock storage manager
jest.mock('./initialization', () => ({
  getTypedStorageManagerInstance: jest.fn(),
}));
describe('SecretManager', () => {
  let secretManager;
  let mockStorageManager;
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // Setup default mock behaviors
    safeStorage.isEncryptionAvailable.mockReturnValue(true);
    safeStorage.encryptString.mockImplementation((str) =>
      Buffer.from(str, 'utf-8'),
    );
    safeStorage.decryptString.mockImplementation((buffer) =>
      buffer.toString('utf-8'),
    );
    app.getPath.mockReturnValue('/mock/user/data');
    // Mock storage manager
    mockStorageManager = {
      setToNamespace: jest.fn().mockResolvedValue(undefined),
      removeFromNamespace: jest.fn().mockResolvedValue(undefined),
      getNamespace: jest.fn().mockResolvedValue({}),
    };
    getTypedStorageManagerInstance.mockResolvedValue(mockStorageManager);
    // Mock fs functions
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.writeFileSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue('{}');
    fs.unlinkSync.mockReturnValue(undefined);
    // Create instance
    secretManager = SecretManager.getInstance();
  });
  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });
  describe('storeSecrets', () => {
    it('should store secrets successfully', async () => {
      const repoId = 'test-repo';
      const repoPath = '/path/to/repo';
      const secrets = {
        API_KEY: 'test-key',
        DATABASE_URL: 'postgres://localhost',
      };
      const result = await secretManager.storeSecrets(
        repoId,
        repoPath,
        secrets,
      );
      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.repoId).toBe(repoId);
      expect(result.metadata?.repoPath).toBe(repoPath);
      expect(result.metadata?.secretCount).toBe(2);
      // Verify encryption was called
      expect(safeStorage.encryptString).toHaveBeenCalledWith(
        JSON.stringify(secrets),
      );
      // Verify storage manager was called
      expect(mockStorageManager.setToNamespace).toHaveBeenCalled();
    });
    it('should fail when encryption is not available', async () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);
      const result = await secretManager.storeSecrets('test', '/path', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Encryption not available on this system');
    });
    it('should validate repository ID', async () => {
      const invalidIds = ['', null, 'repo with spaces', 'repo@invalid'];
      for (const id of invalidIds) {
        const result = await secretManager.storeSecrets(id, '/path', {
          KEY: 'value',
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid repository ID');
      }
    });
    it('should validate secret keys and values', async () => {
      const invalidSecrets = [
        { '123_INVALID': 'value' }, // Invalid key (starts with number)
        { KEY: 123 }, // Invalid value (not string)
        { KEY: 'value\0' }, // Contains null byte
      ];
      for (const secrets of invalidSecrets) {
        const result = await secretManager.storeSecrets(
          'test-repo',
          '/path',
          secrets,
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid secrets format');
      }
    });
  });
  describe('getSecrets', () => {
    it('should retrieve stored secrets', async () => {
      const repoId = 'test-repo';
      const secrets = { API_KEY: 'test-key' };
      // Store secrets first
      await secretManager.storeSecrets(repoId, '/path', secrets);
      // Retrieve secrets
      const retrieved = await secretManager.getSecrets(repoId);
      expect(retrieved).toEqual(secrets);
    });
    it('should return null for non-existent repository', async () => {
      const result = await secretManager.getSecrets('non-existent');
      expect(result).toBeNull();
    });
    it('should use memory cache on subsequent calls', async () => {
      const repoId = 'test-repo';
      const secrets = { API_KEY: 'test-key' };
      // Store secrets
      await secretManager.storeSecrets(repoId, '/path', secrets);
      // Clear mock counts
      jest.clearAllMocks();
      // First retrieval - should read from disk
      await secretManager.getSecrets(repoId);
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      // Second retrieval - should use cache
      await secretManager.getSecrets(repoId);
      expect(fs.readFileSync).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });
  describe('deleteSecrets', () => {
    it('should delete secrets successfully', async () => {
      const repoId = 'test-repo';
      // Store secrets first
      await secretManager.storeSecrets(repoId, '/path', { KEY: 'value' });
      // Delete secrets
      const result = await secretManager.deleteSecrets(repoId);
      expect(result.success).toBe(true);
      expect(mockStorageManager.removeFromNamespace).toHaveBeenCalled();
      // Verify secrets are gone
      const retrieved = await secretManager.getSecrets(repoId);
      expect(retrieved).toBeNull();
    });
    it("should succeed even if secrets don't exist", async () => {
      const result = await secretManager.deleteSecrets('non-existent');
      expect(result.success).toBe(true);
    });
  });
  describe('withEnvFile', () => {
    it('should create and cleanup env file', async () => {
      const repoId = 'test-repo';
      const workDir = '/work/dir';
      const secrets = { API_KEY: 'test-key' };
      // Store secrets
      await secretManager.storeSecrets(repoId, '/path', secrets);
      // Mock file operations
      const writeFileMock = jest.fn().mockResolvedValue(undefined);
      const unlinkMock = jest.fn().mockResolvedValue(undefined);
      // Replace promisified functions
      secretManager.fsPromises = {
        writeFile: writeFileMock,
        unlink: unlinkMock,
      };
      let callbackExecuted = false;
      const result = await secretManager.withEnvFile(
        repoId,
        workDir,
        async () => {
          callbackExecuted = true;
          return 'success';
        },
      );
      expect(result).toBe('success');
      expect(callbackExecuted).toBe(true);
      // Verify env file was created
      expect(writeFileMock).toHaveBeenCalledWith(
        path.join(workDir, '.env'),
        'API_KEY="test-key"',
        expect.any(Object),
      );
      // Verify cleanup
      expect(unlinkMock).toHaveBeenCalled();
    });
    it('should cleanup env file even if callback throws', async () => {
      const repoId = 'test-repo';
      const workDir = '/work/dir';
      await secretManager.storeSecrets(repoId, '/path', { KEY: 'value' });
      const unlinkMock = jest.fn().mockResolvedValue(undefined);
      secretManager.fsPromises = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        unlink: unlinkMock,
      };
      await expect(
        secretManager.withEnvFile(repoId, workDir, async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');
      // Verify cleanup was still called
      expect(unlinkMock).toHaveBeenCalled();
    });
  });
  describe('getAllMetadata', () => {
    it('should return metadata for all stored secrets', async () => {
      // Store multiple secrets
      await secretManager.storeSecrets('repo1', '/path1', { KEY1: 'value1' });
      await secretManager.storeSecrets('repo2', '/path2', { KEY2: 'value2' });
      // Mock storage manager response
      mockStorageManager.getNamespace.mockResolvedValue({
        key1: {
          repoId: 'repo1',
          repoPath: '/path1',
          secretCount: 1,
        },
        key2: {
          repoId: 'repo2',
          repoPath: '/path2',
          secretCount: 1,
        },
      });
      const metadata = await secretManager.getAllMetadata();
      expect(metadata).toHaveLength(2);
      expect(metadata.find((m) => m.repoId === 'repo1')).toBeDefined();
      expect(metadata.find((m) => m.repoId === 'repo2')).toBeDefined();
    });
    it('should return empty array when no secrets exist', async () => {
      mockStorageManager.getNamespace.mockResolvedValue(null);
      const metadata = await secretManager.getAllMetadata();
      expect(metadata).toEqual([]);
    });
  });
  describe('clearCache', () => {
    it('should clear memory cache', async () => {
      const repoId = 'test-repo';
      const secrets = { KEY: 'value' };
      // Store and retrieve to populate cache
      await secretManager.storeSecrets(repoId, '/path', secrets);
      await secretManager.getSecrets(repoId);
      // Clear mocks
      jest.clearAllMocks();
      // Clear cache
      secretManager.clearCache();
      // Next retrieval should read from disk again
      await secretManager.getSecrets(repoId);
      expect(fs.readFileSync).toHaveBeenCalled();
    });
  });
  describe('Security', () => {
    it('should never log secret values', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const secrets = { PASSWORD: 'secret123' };
      await secretManager.storeSecrets('repo', '/path', secrets);
      // Check that secret value was never logged
      const allLogs = consoleSpy.mock.calls.flat().join(' ');
      expect(allLogs).not.toContain('secret123');
      expect(allLogs).not.toContain('PASSWORD');
    });
    it('should escape quotes in environment values', async () => {
      const secrets = {
        KEY_WITH_QUOTES: 'value with "quotes"',
      };
      await secretManager.storeSecrets('repo', '/path', secrets);
      const writeFileMock = jest.fn().mockResolvedValue(undefined);
      secretManager.fsPromises = {
        writeFile: writeFileMock,
        unlink: jest.fn(),
      };
      await secretManager.withEnvFile('repo', '/dir', async () => {});
      expect(writeFileMock).toHaveBeenCalledWith(
        expect.any(String),
        'KEY_WITH_QUOTES="value with \\"quotes\\""',
        expect.any(Object),
      );
    });
  });
});
