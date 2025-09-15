import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Repository } from '../../shared/types/repository.types';
import { StaticNamespaces } from '../storage-providers/types';

// Mock all dependencies before importing the module under test
jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: jest.fn(),
  },
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getPath: jest.fn().mockReturnValue('/mock/user/data'),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  access: jest.fn(),
}));

jest.mock('../version-control-providers/gitBranchService', () => ({
  GitBranchService: jest.fn(),
}));

jest.mock('../version-control-providers/avatarStorageService', () => ({
  avatarStorageService: {
    saveRepositoryAvatar: jest.fn(),
    saveCloneAvatar: jest.fn(),
    removeRepositoryAvatar: jest.fn(),
    removeCloneAvatar: jest.fn(),
    getAvatarUrl: jest.fn(),
  },
}));

jest.mock('./initialization', () => ({
  getTypedStorageManagerInstance: jest.fn(),
}));

// Now import the modules after mocks are set up
import { BrowserWindow } from 'electron';
import { RepositoryApiEventHandler } from './RepositoryApiEventHandler';
import { GitBranchService } from '../version-control-providers/gitBranchService';
import { avatarStorageService } from '../version-control-providers/avatarStorageService';
import { getTypedStorageManagerInstance } from './initialization';

// Mock fetch for GitHub API calls
global.fetch = jest.fn();

describe('RepositoryApiEventHandler', () => {
  let handler: RepositoryApiEventHandler;
  let mockStorageManager: any;
  let mockBranchService: any;
  let mockWindow: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock branch service BEFORE creating the handler
    mockBranchService = {
      getBranchInfo: jest.fn(),
    };
    (GitBranchService as jest.Mock).mockImplementation(() => mockBranchService);
    
    // Create instance (this will use the mocked GitBranchService)
    handler = new RepositoryApiEventHandler();
    
    // Setup mock storage manager
    mockStorageManager = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn(),
    };
    (getTypedStorageManagerInstance as jest.Mock).mockResolvedValue(mockStorageManager);
    
    // Setup mock window for broadcasting
    mockWindow = {
      isDestroyed: jest.fn().mockReturnValue(false),
      webContents: {
        send: jest.fn(),
      },
    };
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow]);
    
    // Setup default fetch mock
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        name: 'test-repo',
        owner: { login: 'test-owner', avatar_url: 'https://github.com/test-owner.png' },
        description: 'Test repository',
        language: 'TypeScript',
        stargazers_count: 100,
        default_branch: 'main',
        topics: ['test', 'repository'],
        private: false,
        fork: false,
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Repository Addition Tests', () => {
    describe('addRepository()', () => {
      it('should create a new repository with GitHub metadata', async () => {
        const params = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          owner: 'test-owner',
          name: 'test-repo',
          localPath: '/path/to/repo',
        };

        mockStorageManager.get.mockResolvedValue({ success: false });
        mockBranchService.getBranchInfo.mockResolvedValue({
          currentBranch: 'main',
          defaultBranch: 'main',
        });

        const result = await handler.addRepository(params);

        expect(result).toMatchObject({
          remoteUrl: params.remoteUrl,
          owner: 'test-owner',
          name: 'test-repo',
          vcsType: 'github',
          description: 'Test repository',
          avatarUrl: 'https://github.com/test-owner.png',
          localClones: [{
            path: '/path/to/repo',
            currentBranch: 'main',
          }],
          metadata: {
            language: 'TypeScript',
            stars: 100,
            defaultBranch: 'main',
            topics: ['test', 'repository'],
            isPrivate: false,
            isFork: false,
          },
        });

        expect(mockStorageManager.set).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:repository-added', expect.any(Object));
      });

      it('should handle non-GitHub repositories', async () => {
        const params = {
          remoteUrl: 'https://gitlab.com/test-owner/test-repo',
          owner: 'test-owner',
          name: 'test-repo',
        };

        mockStorageManager.get.mockResolvedValue({ success: false });

        const result = await handler.addRepository(params);

        expect(result.vcsType).toBe('gitlab');
        expect(fetch).not.toHaveBeenCalled(); // Should not fetch GitHub metadata
      });

      it('should handle private GitHub repositories', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 404,
        });

        const params = {
          remoteUrl: 'https://github.com/test-owner/private-repo',
          owner: 'test-owner',
          name: 'private-repo',
        };

        mockStorageManager.get.mockResolvedValue({ success: false });

        const result = await handler.addRepository(params);

        expect(result.metadata?.isPrivate).toBe(true);
        expect(result.avatarUrl).toBe('https://github.com/test-owner.png');
      });

      it('should update existing repository when adding duplicate', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          vcsType: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          localClones: [{ path: '/existing/path', addedAt: Date.now(), lastAccessed: Date.now() }],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: ['existing-tag'],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const params = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          owner: 'test-owner',
          name: 'test-repo',
          localPath: '/new/path',
        };

        const result = await handler.addRepository(params);

        expect(result.localClones).toHaveLength(2);
        expect(result.localClones.some(c => c.path === '/new/path')).toBe(true);
        expect(result.localClones.some(c => c.path === '/existing/path')).toBe(true);
        expect(result.tags).toEqual(['existing-tag']); // Preserve existing tags
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:repository-updated', expect.any(Object));
      });

      it('should not add duplicate local paths', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          vcsType: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          localClones: [{ path: '/existing/path', addedAt: Date.now(), lastAccessed: Date.now() }],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const params = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          owner: 'test-owner',
          name: 'test-repo',
          localPath: '/existing/path', // Same path
        };

        const result = await handler.addRepository(params);

        expect(result.localClones).toHaveLength(1); // Should not duplicate
      });

      it('should handle malformed URLs gracefully', async () => {
        const params = {
          remoteUrl: 'not-a-valid-url',
          owner: 'test-owner',
          name: 'test-repo',
        };

        mockStorageManager.get.mockResolvedValue({ success: false });

        const result = await handler.addRepository(params);

        expect(result.vcsType).toBe('generic');
        expect(fetch).not.toHaveBeenCalled();
      });

      it('should normalize repository URLs correctly', async () => {
        const params1 = {
          remoteUrl: 'https://github.com/Test-Owner/Test-Repo.git',
          owner: 'Test-Owner',
          name: 'Test-Repo',
        };

        const params2 = {
          remoteUrl: 'https://github.com/test-owner/test-repo/',
          owner: 'test-owner',
          name: 'test-repo',
        };

        mockStorageManager.get.mockResolvedValue({ success: false });

        await handler.addRepository(params1);
        const firstCallKey = (mockStorageManager.set as jest.Mock).mock.calls[0][0];

        jest.clearAllMocks();
        mockStorageManager.get.mockResolvedValue({ success: false });

        await handler.addRepository(params2);
        const secondCallKey = (mockStorageManager.set as jest.Mock).mock.calls[0][0];

        expect(firstCallKey).toBe(secondCallKey); // Should generate same key for normalized URLs
      });

      it('should handle network failures during GitHub metadata fetch', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        const params = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          owner: 'test-owner',
          name: 'test-repo',
        };

        mockStorageManager.get.mockResolvedValue({ success: false });

        const result = await handler.addRepository(params);

        expect(result).toBeDefined();
        expect(result.owner).toBe('test-owner');
        expect(result.name).toBe('test-repo');
        expect(result.avatarUrl).toBe('https://github.com/test-owner.png'); // Fallback avatar
      });

      it('should handle invalid local path for branch info', async () => {
        mockBranchService.getBranchInfo.mockRejectedValue(new Error('Not a git repository'));

        const params = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          owner: 'test-owner',
          name: 'test-repo',
          localPath: '/invalid/path',
        };

        mockStorageManager.get.mockResolvedValue({ success: false });

        const result = await handler.addRepository(params);

        expect(result.localClones[0].currentBranch).toBeUndefined();
      });
    });

    describe('addLocalClone()', () => {
      it('should add a new local clone to existing repository', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          vcsType: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          localClones: [{ path: '/existing/path', addedAt: Date.now(), lastAccessed: Date.now() }],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });
        mockBranchService.getBranchInfo.mockResolvedValue({
          currentBranch: 'feature-branch',
          defaultBranch: 'main',
        });

        const result = await handler.addLocalClone(
          'https://github.com/test-owner/test-repo',
          '/new/clone/path'
        );

        expect(result?.localClones).toHaveLength(2);
        expect(result?.localClones.some(c => c.path === '/new/clone/path')).toBe(true);
        expect(result?.localClones.find(c => c.path === '/new/clone/path')?.currentBranch).toBe('feature-branch');
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:clone-added', expect.any(Object));
      });

      it('should not add duplicate clone paths', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          vcsType: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          localClones: [{ path: '/existing/path', addedAt: Date.now(), lastAccessed: Date.now() }],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const result = await handler.addLocalClone(
          'https://github.com/test-owner/test-repo',
          '/existing/path'
        );

        expect(result?.localClones).toHaveLength(1);
        expect(mockStorageManager.set).not.toHaveBeenCalled();
      });

      it('should return undefined for non-existent repository', async () => {
        mockStorageManager.get.mockResolvedValue({ success: false });

        const result = await handler.addLocalClone(
          'https://github.com/non-existent/repo',
          '/some/path'
        );

        expect(result).toBeUndefined();
      });
    });
  });

  describe('Repository Removal Tests', () => {
    describe('removeRepository()', () => {
      it('should completely remove repository from storage', async () => {
        const result = await handler.removeRepository('https://github.com/test-owner/test-repo');

        expect(result).toBe(true);
        expect(mockStorageManager.delete).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith(
          'repository:repository-removed',
          { remoteUrl: 'https://github.com/test-owner/test-repo' }
        );
      });

      it('should handle removal of non-existent repository', async () => {
        mockStorageManager.delete.mockResolvedValue(undefined);

        const result = await handler.removeRepository('https://github.com/non-existent/repo');

        expect(result).toBe(true);
        expect(mockStorageManager.delete).toHaveBeenCalled();
      });

      it('should handle storage errors gracefully', async () => {
        mockStorageManager.delete.mockRejectedValue(new Error('Storage error'));

        const result = await handler.removeRepository('https://github.com/test-owner/test-repo');

        expect(result).toBe(false);
      });
    });

    describe('removeLocalClone()', () => {
      it('should remove specific clone while keeping others', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          vcsType: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          localClones: [
            { path: '/clone/one', addedAt: Date.now(), lastAccessed: Date.now() },
            { path: '/clone/two', addedAt: Date.now(), lastAccessed: Date.now() },
            { path: '/clone/three', addedAt: Date.now(), lastAccessed: Date.now() },
          ],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const result = await handler.removeLocalClone(
          'https://github.com/test-owner/test-repo',
          '/clone/two'
        );

        expect(result).toBe(true);
        
        const savedRepo = (mockStorageManager.set as jest.Mock).mock.calls[0][1];
        expect(savedRepo.localClones).toHaveLength(2);
        expect(savedRepo.localClones.some((c: any) => c.path === '/clone/one')).toBe(true);
        expect(savedRepo.localClones.some((c: any) => c.path === '/clone/three')).toBe(true);
        expect(savedRepo.localClones.some((c: any) => c.path === '/clone/two')).toBe(false);
        
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:clone-removed', expect.any(Object));
      });

      it('should remove entire repository when last clone is removed', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          vcsType: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          localClones: [
            { path: '/last/clone', addedAt: Date.now(), lastAccessed: Date.now() },
          ],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const result = await handler.removeLocalClone(
          'https://github.com/test-owner/test-repo',
          '/last/clone'
        );

        expect(result).toBe(true);
        expect(mockStorageManager.delete).toHaveBeenCalled();
        expect(mockStorageManager.set).not.toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith(
          'repository:repository-removed',
          { remoteUrl: 'https://github.com/test-owner/test-repo' }
        );
      });

      it('should handle non-existent local path', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          vcsType: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          localClones: [
            { path: '/existing/clone', addedAt: Date.now(), lastAccessed: Date.now() },
          ],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const result = await handler.removeLocalClone(
          'https://github.com/test-owner/test-repo',
          '/non-existent/path'
        );

        expect(result).toBe(false);
        expect(mockStorageManager.set).not.toHaveBeenCalled();
        expect(mockStorageManager.delete).not.toHaveBeenCalled();
      });

      it('should handle non-existent repository', async () => {
        mockStorageManager.get.mockResolvedValue({ success: false });

        const result = await handler.removeLocalClone(
          'https://github.com/non-existent/repo',
          '/some/path'
        );

        expect(result).toBe(false);
      });

      it('should handle storage errors gracefully', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/test-owner/test-repo',
          vcsType: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          localClones: [
            { path: '/last/clone', addedAt: Date.now(), lastAccessed: Date.now() },
          ],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });
        mockStorageManager.delete.mockRejectedValue(new Error('Storage error'));

        const result = await handler.removeLocalClone(
          'https://github.com/test-owner/test-repo',
          '/last/clone'
        );

        expect(result).toBe(false);
      });
    });
  });

  describe('Storage & Broadcasting Tests', () => {
    describe('Storage Key Generation', () => {
      it('should generate consistent keys for same URL', async () => {
        // We'll test this by adding the same repo twice and checking the key
        mockStorageManager.get.mockResolvedValue({ success: false });

        await handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo',
          owner: 'owner',
          name: 'repo',
        });

        const firstKey = (mockStorageManager.set as jest.Mock).mock.calls[0][0];

        jest.clearAllMocks();
        mockStorageManager.get.mockResolvedValue({ success: false });

        await handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo.git',
          owner: 'owner',
          name: 'repo',
        });

        const secondKey = (mockStorageManager.set as jest.Mock).mock.calls[0][0];

        expect(firstKey).toBe(secondKey);
        expect(firstKey).toMatch(/^repos_[a-f0-9]{16}$/);
      });

      it('should use correct namespace for all operations', async () => {
        mockStorageManager.get.mockResolvedValue({ success: false });

        await handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo',
          owner: 'owner',
          name: 'repo',
        });

        expect(mockStorageManager.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          StaticNamespaces.REPOSITORIES
        );
      });
    });

    describe('Event Broadcasting', () => {
      it('should broadcast to all windows', async () => {
        const window1 = {
          isDestroyed: jest.fn().mockReturnValue(false),
          webContents: { send: jest.fn() },
        };
        const window2 = {
          isDestroyed: jest.fn().mockReturnValue(false),
          webContents: { send: jest.fn() },
        };

        (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([window1, window2]);
        mockStorageManager.get.mockResolvedValue({ success: false });

        await handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo',
          owner: 'owner',
          name: 'repo',
        });

        expect(window1.webContents.send).toHaveBeenCalledWith('repository:repository-added', expect.any(Object));
        expect(window2.webContents.send).toHaveBeenCalledWith('repository:repository-added', expect.any(Object));
      });

      it('should skip destroyed windows', async () => {
        const window1 = {
          isDestroyed: jest.fn().mockReturnValue(true),
          webContents: { send: jest.fn() },
        };
        const window2 = {
          isDestroyed: jest.fn().mockReturnValue(false),
          webContents: { send: jest.fn() },
        };

        (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([window1, window2]);
        mockStorageManager.get.mockResolvedValue({ success: false });

        await handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo',
          owner: 'owner',
          name: 'repo',
        });

        expect(window1.webContents.send).not.toHaveBeenCalled();
        expect(window2.webContents.send).toHaveBeenCalled();
      });

      it('should send correct event types and data', async () => {
        mockStorageManager.get.mockResolvedValue({ success: false });

        // Test repository-added event
        await handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo',
          owner: 'owner',
          name: 'repo',
        });

        expect(mockWindow.webContents.send).toHaveBeenCalledWith(
          'repository:repository-added',
          expect.objectContaining({
            remoteUrl: 'https://github.com/owner/repo',
            owner: 'test-owner', // GitHub API returns this
            name: 'test-repo', // GitHub API returns this
          })
        );

        jest.clearAllMocks();

        // Test repository-removed event
        await handler.removeRepository('https://github.com/owner/repo');

        expect(mockWindow.webContents.send).toHaveBeenCalledWith(
          'repository:repository-removed',
          { remoteUrl: 'https://github.com/owner/repo' }
        );
      });
    });

    describe('Storage Manager Initialization', () => {
      it('should handle storage manager initialization failure', async () => {
        (getTypedStorageManagerInstance as jest.Mock).mockRejectedValue(new Error('Init failed'));

        await expect(handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo',
          owner: 'owner',
          name: 'repo',
        })).rejects.toThrow('Init failed');
      });

      it('should handle concurrent storage operations', async () => {
        mockStorageManager.get.mockResolvedValue({ success: false });

        const promises = [
          handler.addRepository({
            remoteUrl: 'https://github.com/owner/repo1',
            owner: 'owner',
            name: 'repo1',
          }),
          handler.addRepository({
            remoteUrl: 'https://github.com/owner/repo2',
            owner: 'owner',
            name: 'repo2',
          }),
          handler.addRepository({
            remoteUrl: 'https://github.com/owner/repo3',
            owner: 'owner',
            name: 'repo3',
          }),
        ];

        const results = await Promise.all(promises);

        expect(results).toHaveLength(3);
        expect(mockStorageManager.set).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Data Integrity Tests', () => {
    describe('Immutable Fields Protection', () => {
      it('should not allow changing remoteUrl via updateRepository', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/owner/repo',
          vcsType: 'github',
          owner: 'owner',
          name: 'repo',
          localClones: [],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const result = await handler.updateRepository(
          'https://github.com/owner/repo',
          { remoteUrl: 'https://github.com/different/repo' } as any
        );

        expect(result?.remoteUrl).toBe('https://github.com/owner/repo');
      });

      it('should not allow changing owner, name, or vcsType', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/owner/repo',
          vcsType: 'github',
          owner: 'owner',
          name: 'repo',
          localClones: [],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const result = await handler.updateRepository(
          'https://github.com/owner/repo',
          { 
            owner: 'different-owner',
            name: 'different-name',
            vcsType: 'gitlab',
          } as any
        );

        expect(result?.owner).toBe('owner');
        expect(result?.name).toBe('repo');
        expect(result?.vcsType).toBe('github');
      });

      it('should properly merge metadata', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/owner/repo',
          vcsType: 'github',
          owner: 'owner',
          name: 'repo',
          localClones: [],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
          metadata: {
            language: 'TypeScript',
            stars: 100,
          },
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const result = await handler.updateRepository(
          'https://github.com/owner/repo',
          { 
            metadata: {
              defaultBranch: 'main',
              topics: ['test'],
            },
          }
        );

        expect(result?.metadata).toEqual({
          language: 'TypeScript',
          stars: 100,
          defaultBranch: 'main',
          topics: ['test'],
        });
      });
    });

    describe('Backward Compatibility', () => {
      it('should handle repositories without tags array', async () => {
        const oldRepo: any = {
          remoteUrl: 'https://github.com/owner/repo',
          vcsType: 'github',
          owner: 'owner',
          name: 'repo',
          localClones: [],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          // No tags field
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: oldRepo });

        const result = await handler.getRepository('https://github.com/owner/repo');

        expect(result?.tags).toEqual([]);
      });

      it('should preserve tags during updates', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/owner/repo',
          vcsType: 'github',
          owner: 'owner',
          name: 'repo',
          localClones: [],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: ['important', 'work'],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });

        const result = await handler.updateRepository(
          'https://github.com/owner/repo',
          { description: 'Updated description' }
        );

        expect(result?.tags).toEqual(['important', 'work']);
      });
    });
  });

  describe('Integration Tests', () => {
    describe('Full Repository Lifecycle', () => {
      it('should handle add → update → remove flow', async () => {
        // Add repository
        mockStorageManager.get.mockResolvedValue({ success: false });
        
        const addResult = await handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo',
          owner: 'owner',
          name: 'repo',
          localPath: '/path/one',
        });

        expect(addResult).toBeDefined();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:repository-added', expect.any(Object));

        // Update repository
        jest.clearAllMocks();
        mockStorageManager.get.mockResolvedValue({ success: true, data: addResult });

        const updateResult = await handler.updateRepository(
          'https://github.com/owner/repo',
          { description: 'Updated' }
        );

        expect(updateResult?.description).toBe('Updated');

        // Remove repository
        jest.clearAllMocks();
        const removeResult = await handler.removeRepository('https://github.com/owner/repo');

        expect(removeResult).toBe(true);
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:repository-removed', expect.any(Object));
      });
    });

    describe('Multiple Clones Scenario', () => {
      it('should handle multiple clone additions and removals correctly', async () => {
        // Add repository with first clone
        mockStorageManager.get.mockResolvedValue({ success: false });
        
        const repo1 = await handler.addRepository({
          remoteUrl: 'https://github.com/owner/repo',
          owner: 'owner',
          name: 'repo',
          localPath: '/clone/one',
        });

        expect(repo1.localClones).toHaveLength(1);

        // Add second clone
        jest.clearAllMocks();
        mockStorageManager.get.mockResolvedValue({ success: true, data: repo1 });

        const repo2 = await handler.addLocalClone(
          'https://github.com/owner/repo',
          '/clone/two'
        );

        expect(repo2?.localClones).toHaveLength(2);
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:clone-added', expect.any(Object));

        // Remove first clone
        jest.clearAllMocks();
        mockStorageManager.get.mockResolvedValue({ success: true, data: repo2 });

        const removeResult1 = await handler.removeLocalClone(
          'https://github.com/owner/repo',
          '/clone/one'
        );

        expect(removeResult1).toBe(true);
        expect(mockStorageManager.set).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:clone-removed', expect.any(Object));

        // Remove second clone (should remove entire repository)
        // After first removal, only /clone/two should remain
        const updatedRepo = { 
          ...repo2, 
          localClones: [{ path: '/clone/two', addedAt: Date.now(), lastAccessed: Date.now() }] 
        };
        jest.clearAllMocks();
        mockStorageManager.get.mockResolvedValue({ success: true, data: updatedRepo });

        const removeResult2 = await handler.removeLocalClone(
          'https://github.com/owner/repo',
          '/clone/two'
        );

        expect(removeResult2).toBe(true);
        expect(mockStorageManager.delete).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('repository:repository-removed', expect.any(Object));
      });
    });

    describe('Error Recovery', () => {
      it('should handle partial operation failures gracefully', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/owner/repo',
          vcsType: 'github',
          owner: 'owner',
          name: 'repo',
          localClones: [],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });
        mockStorageManager.set.mockRejectedValue(new Error('Storage write failed'));

        const result = await handler.updateRepository(
          'https://github.com/owner/repo',
          { description: 'This will fail' }
        );

        expect(result).toBeUndefined();
      });

      it('should not corrupt data on storage failures', async () => {
        const existingRepo: Repository = {
          remoteUrl: 'https://github.com/owner/repo',
          vcsType: 'github',
          owner: 'owner',
          name: 'repo',
          localClones: [
            { path: '/clone/one', addedAt: Date.now(), lastAccessed: Date.now() },
            { path: '/clone/two', addedAt: Date.now(), lastAccessed: Date.now() },
          ],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          tags: [],
        };

        mockStorageManager.get.mockResolvedValue({ success: true, data: existingRepo });
        
        // Simulate a failure during the set operation
        mockStorageManager.set.mockRejectedValue(new Error('Storage write failed'));

        const result = await handler.removeLocalClone(
          'https://github.com/owner/repo',
          '/clone/one'
        );

        expect(result).toBe(false);
        // Verify that no data was deleted
        expect(mockStorageManager.delete).not.toHaveBeenCalled();
      });
    });
  });

  describe('Helper Method Tests', () => {
    describe('getRepositories()', () => {
      it('should return all repositories sorted by last accessed', async () => {
        const now = Date.now();
        const repos = [
          { remoteUrl: 'repo1', lastAccessed: now - 3000 },
          { remoteUrl: 'repo2', lastAccessed: now - 1000 },
          { remoteUrl: 'repo3', lastAccessed: now - 2000 },
        ];

        mockStorageManager.keys.mockResolvedValue(['repos_1', 'repos_2', 'repos_3']);
        mockStorageManager.get
          .mockResolvedValueOnce({ success: true, data: repos[0] })
          .mockResolvedValueOnce({ success: true, data: repos[1] })
          .mockResolvedValueOnce({ success: true, data: repos[2] });

        const result = await handler.getRepositories();

        expect(result).toHaveLength(3);
        expect(result[0].remoteUrl).toBe('repo2'); // Most recent
        expect(result[1].remoteUrl).toBe('repo3');
        expect(result[2].remoteUrl).toBe('repo1'); // Oldest
      });

      it('should filter out non-repository keys', async () => {
        mockStorageManager.keys.mockResolvedValue(['repos_1', 'other_key', 'repos_2', 'config']);
        mockStorageManager.get
          .mockResolvedValueOnce({ success: true, data: { remoteUrl: 'repo1' } })
          .mockResolvedValueOnce({ success: true, data: { remoteUrl: 'repo2' } });

        const result = await handler.getRepositories();

        expect(result).toHaveLength(2);
        expect(mockStorageManager.get).toHaveBeenCalledTimes(2);
      });
    });

    describe('getRepositoryByLocalPath()', () => {
      it('should find repository by local clone path', async () => {
        const repos = [
          {
            remoteUrl: 'repo1',
            localClones: [{ path: '/path/one' }, { path: '/path/two' }],
          },
          {
            remoteUrl: 'repo2',
            localClones: [{ path: '/path/three' }],
          },
        ];

        mockStorageManager.keys.mockResolvedValue(['repos_1', 'repos_2']);
        mockStorageManager.get
          .mockResolvedValueOnce({ success: true, data: repos[0] })
          .mockResolvedValueOnce({ success: true, data: repos[1] });

        const result = await handler.getRepositoryByLocalPath('/path/three');

        expect(result?.remoteUrl).toBe('repo2');
      });

      it('should return undefined for non-existent path', async () => {
        mockStorageManager.keys.mockResolvedValue([]);

        const result = await handler.getRepositoryByLocalPath('/non-existent');

        expect(result).toBeUndefined();
      });
    });
  });
});