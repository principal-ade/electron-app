import { GitClientFactory } from './gitClientFactory';
// Mock electron-cli-bridge and GitLens adapter
jest.mock('../electron-cli-bridge');
jest.mock('../quality-lenses/GitLensAdapter');
// Import mocked modules
import { electronCLI } from '../electron-cli-bridge';
import { gitLensAdapter } from '../quality-lenses/GitLensAdapter';
describe('GitClientFactory', () => {
  const mockGitExecutor = {
    checkAvailability: jest.fn(),
    findGitRoot: jest.fn(),
    isGitRepository: jest.fn(),
    getRemotes: jest.fn(),
    getLocalBranches: jest.fn(),
    getRemoteBranches: jest.fn(),
    getConfig: jest.fn(),
    getCurrentBranch: jest.fn(),
    getCurrentCommit: jest.fn(),
    getStatus: jest.fn(),
    raw: jest.fn(),
  };
  const mockElectronCLI = {
    initialize: jest.fn(),
    git: mockGitExecutor,
  };
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    GitClientFactory.clearCache();
    // Setup default mock implementations
    electronCLI.initialize = mockElectronCLI.initialize;
    electronCLI.git = mockElectronCLI.git;
    mockElectronCLI.initialize.mockResolvedValue(undefined);
  });
  describe('getClient', () => {
    it('should create a git client for a directory', async () => {
      const dir = '/test/directory';
      const client = await GitClientFactory.getClient(dir);
      expect(mockElectronCLI.initialize).toHaveBeenCalled();
      expect(client).toBeDefined();
      expect(client).toHaveProperty('revparse');
      expect(client).toHaveProperty('status');
      expect(client).toHaveProperty('branchLocal');
      expect(client).toHaveProperty('getRemotes');
    });
    it('should initialize only once for multiple calls', async () => {
      const dir1 = '/test/directory1';
      const dir2 = '/test/directory2';
      // Clear the private gitExecutor to ensure we start fresh
      GitClientFactory.gitExecutor = null;
      await GitClientFactory.getClient(dir1);
      await GitClientFactory.getClient(dir2);
      // Should only initialize once
      expect(mockElectronCLI.initialize).toHaveBeenCalledTimes(1);
    });
  });
  describe('checkGitAvailability', () => {
    it('should return available true when git is installed', async () => {
      mockGitExecutor.checkAvailability.mockResolvedValue({
        available: true,
        version: '2.34.1',
      });
      const result = await GitClientFactory.checkGitAvailability();
      expect(result).toEqual({
        available: true,
        version: '2.34.1',
      });
      expect(mockGitExecutor.checkAvailability).toHaveBeenCalled();
    });
    it('should return available false when git is not installed', async () => {
      mockGitExecutor.checkAvailability.mockResolvedValue({
        available: false,
        error: 'Git is not installed',
      });
      const result = await GitClientFactory.checkGitAvailability();
      expect(result).toEqual({
        available: false,
        error: 'Git is not installed',
      });
    });
    it('should handle errors when checking git availability', async () => {
      mockGitExecutor.checkAvailability.mockRejectedValue(
        new Error('Command not found'),
      );
      await expect(GitClientFactory.checkGitAvailability()).rejects.toThrow(
        'Command not found',
      );
    });
  });
  describe('findGitRoot', () => {
    it('should return git root path when in a git repository', async () => {
      const testPath = '/test/project/src/file.ts';
      const expectedRoot = '/test/project';
      mockGitExecutor.findGitRoot.mockResolvedValue(expectedRoot);
      const result = await GitClientFactory.findGitRoot(testPath);
      expect(result).toBe(expectedRoot);
      expect(mockGitExecutor.findGitRoot).toHaveBeenCalledWith(testPath);
    });
    it('should return null when not in a git repository', async () => {
      const testPath = '/not/a/git/repo';
      mockGitExecutor.findGitRoot.mockResolvedValue(null);
      const result = await GitClientFactory.findGitRoot(testPath);
      expect(result).toBeNull();
    });
  });
  describe('isGitRepository', () => {
    it('should return true when directory is in a git repository', async () => {
      const directory = '/test/project';
      mockGitExecutor.isGitRepository.mockResolvedValue(true);
      const result = await GitClientFactory.isGitRepository(directory);
      expect(result).toBe(true);
      expect(mockGitExecutor.isGitRepository).toHaveBeenCalledWith(directory);
    });
    it('should return false when directory is not in a git repository', async () => {
      const directory = '/not/a/repo';
      mockGitExecutor.isGitRepository.mockResolvedValue(false);
      const result = await GitClientFactory.isGitRepository(directory);
      expect(result).toBe(false);
    });
  });
  describe('getRemotes', () => {
    it('should return git remotes with GitHub parsing', async () => {
      const directory = '/test/project';
      const mockRemotes = [
        {
          name: 'origin',
          url: 'https://github.com/user/repo.git',
          owner: 'user',
          repo: 'repo',
        },
        {
          name: 'upstream',
          url: 'git@github.com:upstream/repo.git',
          owner: 'upstream',
          repo: 'repo',
        },
      ];
      mockGitExecutor.getRemotes.mockResolvedValue(mockRemotes);
      const result = await GitClientFactory.getRemotes(directory);
      expect(result).toEqual(mockRemotes);
      expect(mockGitExecutor.getRemotes).toHaveBeenCalledWith(directory);
    });
    it('should handle non-GitHub remotes', async () => {
      const directory = '/test/project';
      const mockRemotes = [
        {
          name: 'origin',
          url: 'https://gitlab.com/user/repo.git',
          owner: undefined,
          repo: undefined,
        },
      ];
      mockGitExecutor.getRemotes.mockResolvedValue(mockRemotes);
      const result = await GitClientFactory.getRemotes(directory);
      expect(result).toEqual(mockRemotes);
    });
    it('should handle errors gracefully', async () => {
      const directory = '/not/a/repo';
      mockGitExecutor.getRemotes.mockRejectedValue(
        new Error('Not a git repository'),
      );
      await expect(GitClientFactory.getRemotes(directory)).rejects.toThrow(
        'Not a git repository',
      );
    });
  });
  describe('getGitStatus', () => {
    it('should return git status with staged, unstaged, and untracked files', async () => {
      const directory = '/test/project';
      const mockStatus = {
        staged: ['staged-file.ts'],
        unstaged: ['modified-file.ts', 'deleted-file.ts'],
        untracked: ['untracked-file.ts'],
      };
      gitLensAdapter.getGitStatus.mockResolvedValue(mockStatus);
      const result = await GitClientFactory.getGitStatus(directory);
      expect(result).toEqual(mockStatus);
      expect(gitLensAdapter.getGitStatus).toHaveBeenCalledWith(directory);
    });
    it('should handle errors gracefully', async () => {
      const directory = '/not/a/repo';
      gitLensAdapter.getGitStatus.mockRejectedValue(
        new Error('Not a git repository'),
      );
      await expect(GitClientFactory.getGitStatus(directory)).rejects.toThrow(
        'Not a git repository',
      );
    });
    it('should handle empty git status', async () => {
      const directory = '/test/clean-repo';
      const mockStatus = {
        staged: [],
        unstaged: [],
        untracked: [],
      };
      gitLensAdapter.getGitStatus.mockResolvedValue(mockStatus);
      const result = await GitClientFactory.getGitStatus(directory);
      expect(result).toEqual(mockStatus);
    });
  });
  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      const directory = '/test/project';
      gitLensAdapter.getCurrentBranch.mockResolvedValue('main');
      const result = await GitClientFactory.getCurrentBranch(directory);
      expect(result).toBe('main');
      expect(gitLensAdapter.getCurrentBranch).toHaveBeenCalledWith(directory);
    });
    it('should return null when not on a branch', async () => {
      const directory = '/test/project';
      gitLensAdapter.getCurrentBranch.mockResolvedValue(null);
      const result = await GitClientFactory.getCurrentBranch(directory);
      expect(result).toBeNull();
    });
    it('should handle errors gracefully', async () => {
      const directory = '/not/a/repo';
      gitLensAdapter.getCurrentBranch.mockRejectedValue(
        new Error('Not a git repository'),
      );
      await expect(
        GitClientFactory.getCurrentBranch(directory),
      ).rejects.toThrow('Not a git repository');
    });
  });
  describe('getLocalBranches', () => {
    it('should return list of local branches', async () => {
      const directory = '/test/project';
      const mockBranches = ['main', 'develop', 'feature/test'];
      mockGitExecutor.getLocalBranches.mockResolvedValue(mockBranches);
      const result = await GitClientFactory.getLocalBranches(directory);
      expect(result).toEqual(mockBranches);
      expect(mockGitExecutor.getLocalBranches).toHaveBeenCalledWith(directory);
    });
    it('should handle errors gracefully', async () => {
      const directory = '/not/a/repo';
      mockGitExecutor.getLocalBranches.mockRejectedValue(
        new Error('Not a git repository'),
      );
      await expect(
        GitClientFactory.getLocalBranches(directory),
      ).rejects.toThrow('Not a git repository');
    });
  });
  describe('getRemoteBranches', () => {
    it('should return list of remote branches', async () => {
      const directory = '/test/project';
      const mockBranches = ['remotes/origin/main', 'remotes/origin/develop'];
      mockGitExecutor.getRemoteBranches.mockResolvedValue(mockBranches);
      const result = await GitClientFactory.getRemoteBranches(directory);
      expect(result).toEqual(mockBranches);
      expect(mockGitExecutor.getRemoteBranches).toHaveBeenCalledWith(directory);
    });
    it('should handle errors gracefully', async () => {
      const directory = '/not/a/repo';
      mockGitExecutor.getRemoteBranches.mockRejectedValue(
        new Error('Not a git repository'),
      );
      await expect(
        GitClientFactory.getRemoteBranches(directory),
      ).rejects.toThrow('Not a git repository');
    });
  });
  describe('getCurrentCommit', () => {
    it('should return current commit hash', async () => {
      const directory = '/test/project';
      const commitHash = 'abc123def456';
      gitLensAdapter.getCurrentCommit.mockResolvedValue(commitHash);
      const result = await GitClientFactory.getCurrentCommit(directory);
      expect(result).toBe(commitHash);
      expect(gitLensAdapter.getCurrentCommit).toHaveBeenCalledWith(directory);
    });
    it('should return null when not in a repository', async () => {
      const directory = '/not/a/repo';
      gitLensAdapter.getCurrentCommit.mockResolvedValue(null);
      const result = await GitClientFactory.getCurrentCommit(directory);
      expect(result).toBeNull();
    });
  });
  describe('getConfig', () => {
    it('should return config value', async () => {
      const directory = '/test/project';
      const configValue = 'https://github.com/user/repo.git';
      mockGitExecutor.getConfig.mockResolvedValue(configValue);
      const result = await GitClientFactory.getConfig(
        directory,
        'remote.origin.url',
      );
      expect(result).toBe(configValue);
      expect(mockGitExecutor.getConfig).toHaveBeenCalledWith(
        directory,
        'remote.origin.url',
      );
    });
    it('should return null when config is not set', async () => {
      const directory = '/test/project';
      mockGitExecutor.getConfig.mockResolvedValue(null);
      const result = await GitClientFactory.getConfig(
        directory,
        'remote.origin.url',
      );
      expect(result).toBeNull();
    });
    it('should handle errors gracefully', async () => {
      const directory = '/not/a/repo';
      mockGitExecutor.getConfig.mockRejectedValue(
        new Error('Not a git repository'),
      );
      await expect(
        GitClientFactory.getConfig(directory, 'remote.origin.url'),
      ).rejects.toThrow('Not a git repository');
    });
  });
  describe('clearCache', () => {
    it('should clear cache (no-op for compatibility)', () => {
      // clearCache is now a no-op for compatibility
      // Just verify it doesn't throw
      expect(() => GitClientFactory.clearCache()).not.toThrow();
    });
  });
  describe('getLastCommitInfo', () => {
    it('should return last commit info', async () => {
      const directory = '/test/project';
      const mockCommitInfo = {
        hash: 'abc123',
        author: 'Test User',
        email: 'test@example.com',
        date: new Date('2024-01-01'),
        message: 'Test commit',
      };
      gitLensAdapter.getLastCommitInfo.mockResolvedValue(mockCommitInfo);
      const result = await GitClientFactory.getLastCommitInfo(directory);
      expect(result).toEqual(mockCommitInfo);
      expect(gitLensAdapter.getLastCommitInfo).toHaveBeenCalledWith(directory);
    });
    it('should return null when no commits exist', async () => {
      const directory = '/test/empty-repo';
      gitLensAdapter.getLastCommitInfo.mockResolvedValue(null);
      const result = await GitClientFactory.getLastCommitInfo(directory);
      expect(result).toBeNull();
    });
  });
});
