import { GitClientFactory } from './gitClientFactory';
import simpleGit from 'simple-git';

// Mock simple-git
jest.mock('simple-git');

describe('GitClientFactory', () => {
  const mockGit = {
    revparse: jest.fn(),
    version: jest.fn(),
    outputHandler: jest.fn(),
    status: jest.fn(),
    getRemotes: jest.fn(),
    branchLocal: jest.fn(),
    branch: jest.fn(),
    getConfig: jest.fn(),
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    GitClientFactory.clearCache();

    // Setup default mock implementation
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
  });

  describe('getClient', () => {
    it('should create a new git client for a directory', () => {
      const dir = '/test/directory';
      const client = GitClientFactory.getClient(dir);

      expect(simpleGit).toHaveBeenCalledWith(
        dir,
        expect.objectContaining({
          binary: 'git',
          maxConcurrentProcesses: 6,
          trimmed: true,
        }),
      );
      expect(client).toBe(mockGit);
    });

    it('should reuse cached client for the same directory', () => {
      const dir = '/test/directory';

      const client1 = GitClientFactory.getClient(dir);
      const client2 = GitClientFactory.getClient(dir);

      // Should only create one instance
      expect(simpleGit).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2);
    });

    it('should create different clients for different directories', () => {
      const dir1 = '/test/directory1';
      const dir2 = '/test/directory2';

      GitClientFactory.getClient(dir1);
      GitClientFactory.getClient(dir2);

      expect(simpleGit).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkGitAvailability', () => {
    it('should return available true when git is installed', async () => {
      mockGit.version.mockResolvedValue({
        installed: true,
        major: 2,
        minor: 34,
        patch: 1,
      });

      const result = await GitClientFactory.checkGitAvailability();

      expect(result).toEqual({
        available: true,
        version: '2.34.1',
      });
    });

    it('should return available false when git is not installed', async () => {
      mockGit.version.mockResolvedValue({
        installed: false,
      });

      const result = await GitClientFactory.checkGitAvailability();

      expect(result).toEqual({
        available: false,
        error: 'Git is not installed',
      });
    });

    it('should handle errors when checking git availability', async () => {
      mockGit.version.mockRejectedValue(new Error('Command not found'));

      const result = await GitClientFactory.checkGitAvailability();

      expect(result).toEqual({
        available: false,
        error: 'Command not found',
      });
    });
  });

  describe('findGitRoot', () => {
    it('should return git root path when in a git repository', async () => {
      const testPath = '/test/project/src/file.ts';
      const expectedRoot = '/test/project';

      mockGit.revparse.mockResolvedValue(`${expectedRoot}\n`);

      const result = await GitClientFactory.findGitRoot(testPath);

      expect(result).toBe(expectedRoot);
      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
    });

    it('should return null when not in a git repository', async () => {
      const testPath = '/not/a/git/repo';

      mockGit.revparse.mockRejectedValue(
        new Error('fatal: not a git repository'),
      );

      const result = await GitClientFactory.findGitRoot(testPath);

      expect(result).toBeNull();
    });

    it('should trim whitespace from git output', async () => {
      const testPath = '/test/project';
      const expectedRoot = '/test/project';

      mockGit.revparse.mockResolvedValue(`  ${expectedRoot}  \n\n`);

      const result = await GitClientFactory.findGitRoot(testPath);

      expect(result).toBe(expectedRoot);
    });
  });

  describe('isGitRepository', () => {
    it('should return true when directory is in a git repository', async () => {
      const directory = '/test/project';

      mockGit.revparse.mockResolvedValue('true\n');

      const result = await GitClientFactory.isGitRepository(directory);

      expect(result).toBe(true);
      expect(mockGit.revparse).toHaveBeenCalledWith(['--is-inside-work-tree']);
    });

    it('should return false when directory is not in a git repository', async () => {
      const directory = '/not/a/repo';

      mockGit.revparse.mockRejectedValue(
        new Error('fatal: not a git repository'),
      );

      const result = await GitClientFactory.isGitRepository(directory);

      expect(result).toBe(false);
    });

    it('should return false when git command returns non-true value', async () => {
      const directory = '/test/directory';

      mockGit.revparse.mockResolvedValue('false\n');

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
          refs: {
            fetch: 'https://github.com/user/repo.git',
            push: 'https://github.com/user/repo.git',
          },
        },
        {
          name: 'upstream',
          refs: {
            fetch: 'git@github.com:upstream/repo.git',
            push: 'git@github.com:upstream/repo.git',
          },
        },
      ];

      mockGit.getRemotes.mockResolvedValue(mockRemotes);

      const result = await GitClientFactory.getRemotes(directory);

      expect(result).toEqual([
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
      ]);
      expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
    });

    it('should handle non-GitHub remotes', async () => {
      const directory = '/test/project';
      const mockRemotes = [
        {
          name: 'origin',
          refs: {
            fetch: 'https://gitlab.com/user/repo.git',
            push: 'https://gitlab.com/user/repo.git',
          },
        },
      ];

      mockGit.getRemotes.mockResolvedValue(mockRemotes);

      const result = await GitClientFactory.getRemotes(directory);

      expect(result).toEqual([
        {
          name: 'origin',
          url: 'https://gitlab.com/user/repo.git',
          owner: undefined,
          repo: undefined,
        },
      ]);
    });

    it('should return empty array when git remotes fails', async () => {
      const directory = '/not/a/repo';

      mockGit.getRemotes.mockRejectedValue(new Error('Not a git repository'));

      const result = await GitClientFactory.getRemotes(directory);

      expect(result).toEqual([]);
    });

    it('should handle remotes with only push refs', async () => {
      const directory = '/test/project';
      const mockRemotes = [
        {
          name: 'origin',
          refs: {
            push: 'https://github.com/user/repo.git',
          },
        },
      ];

      mockGit.getRemotes.mockResolvedValue(mockRemotes);

      const result = await GitClientFactory.getRemotes(directory);

      expect(result).toEqual([
        {
          name: 'origin',
          url: 'https://github.com/user/repo.git',
          owner: 'user',
          repo: 'repo',
        },
      ]);
    });
  });

  describe('getGitStatus', () => {
    it('should return git status with staged, unstaged, and untracked files', async () => {
      const directory = '/test/project';
      const mockStatus = {
        staged: ['staged-file.ts'],
        modified: ['modified-file.ts'],
        deleted: ['deleted-file.ts'],
        not_added: ['untracked-file.ts'],
      };

      mockGit.status.mockResolvedValue(mockStatus);

      const result = await GitClientFactory.getGitStatus(directory);

      expect(result).toEqual({
        staged: ['staged-file.ts'],
        unstaged: ['modified-file.ts', 'deleted-file.ts'],
        untracked: ['untracked-file.ts'],
      });
      expect(mockGit.status).toHaveBeenCalledWith();
    });

    it('should return empty arrays when git status fails', async () => {
      const directory = '/not/a/repo';

      mockGit.status.mockRejectedValue(new Error('Not a git repository'));

      const result = await GitClientFactory.getGitStatus(directory);

      expect(result).toEqual({
        staged: [],
        unstaged: [],
        untracked: [],
      });
    });

    it('should handle empty git status', async () => {
      const directory = '/test/clean-repo';
      const mockStatus = {
        staged: [],
        modified: [],
        deleted: [],
        not_added: [],
      };

      mockGit.status.mockResolvedValue(mockStatus);

      const result = await GitClientFactory.getGitStatus(directory);

      expect(result).toEqual({
        staged: [],
        unstaged: [],
        untracked: [],
      });
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      const directory = '/test/project';
      const mockStatus = { current: 'main' };

      mockGit.status.mockResolvedValue(mockStatus);

      const result = await GitClientFactory.getCurrentBranch(directory);

      expect(result).toBe('main');
    });

    it('should return null when not on a branch', async () => {
      const directory = '/test/project';
      const mockStatus = { current: null };

      mockGit.status.mockResolvedValue(mockStatus);

      const result = await GitClientFactory.getCurrentBranch(directory);

      expect(result).toBeNull();
    });

    it('should return null when git command fails', async () => {
      const directory = '/not/a/repo';

      mockGit.status.mockRejectedValue(new Error('Not a git repository'));

      const result = await GitClientFactory.getCurrentBranch(directory);

      expect(result).toBeNull();
    });
  });

  describe('getLocalBranches', () => {
    it('should return list of local branches', async () => {
      const directory = '/test/project';
      const mockBranches = { all: ['main', 'develop', 'feature/test'] };

      mockGit.branchLocal.mockResolvedValue(mockBranches);

      const result = await GitClientFactory.getLocalBranches(directory);

      expect(result).toEqual(['main', 'develop', 'feature/test']);
    });

    it('should return empty array when git command fails', async () => {
      const directory = '/not/a/repo';

      mockGit.branchLocal.mockRejectedValue(new Error('Not a git repository'));

      const result = await GitClientFactory.getLocalBranches(directory);

      expect(result).toEqual([]);
    });
  });

  describe('getRemoteBranches', () => {
    it('should return list of remote branches', async () => {
      const directory = '/test/project';
      const mockBranches = {
        all: [
          'remotes/origin/main',
          'remotes/origin/develop',
          'remotes/origin/HEAD',
        ],
      };

      mockGit.branch.mockResolvedValue(mockBranches);

      const result = await GitClientFactory.getRemoteBranches(directory);

      expect(result).toEqual(['remotes/origin/main', 'remotes/origin/develop']);
      expect(mockGit.branch).toHaveBeenCalledWith(['-r']);
    });

    it('should return empty array when git command fails', async () => {
      const directory = '/not/a/repo';

      mockGit.branch.mockRejectedValue(new Error('Not a git repository'));

      const result = await GitClientFactory.getRemoteBranches(directory);

      expect(result).toEqual([]);
    });
  });

  describe('getCurrentCommit', () => {
    it('should return current commit hash', async () => {
      const directory = '/test/project';
      const commitHash = 'abc123def456';

      mockGit.revparse.mockResolvedValue(`${commitHash}\n`);

      const result = await GitClientFactory.getCurrentCommit(directory);

      expect(result).toBe(commitHash);
      expect(mockGit.revparse).toHaveBeenCalledWith(['HEAD']);
    });

    it('should return null when git command fails', async () => {
      const directory = '/not/a/repo';

      mockGit.revparse.mockRejectedValue(new Error('Not a git repository'));

      const result = await GitClientFactory.getCurrentCommit(directory);

      expect(result).toBeNull();
    });
  });

  describe('getConfig', () => {
    it('should return config value', async () => {
      const directory = '/test/project';
      const configValue = 'https://github.com/user/repo.git';

      mockGit.getConfig.mockResolvedValue({ value: configValue });

      const result = await GitClientFactory.getConfig(
        directory,
        'remote.origin.url',
      );

      expect(result).toBe(configValue);
      expect(mockGit.getConfig).toHaveBeenCalledWith('remote.origin.url');
    });

    it('should return null when config is not set', async () => {
      const directory = '/test/project';

      mockGit.getConfig.mockResolvedValue({ value: null });

      const result = await GitClientFactory.getConfig(
        directory,
        'remote.origin.url',
      );

      expect(result).toBeNull();
    });

    it('should return null when git command fails', async () => {
      const directory = '/not/a/repo';

      mockGit.getConfig.mockRejectedValue(new Error('Not a git repository'));

      const result = await GitClientFactory.getConfig(
        directory,
        'remote.origin.url',
      );

      expect(result).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached git clients', () => {
      const dir1 = '/test/dir1';
      const dir2 = '/test/dir2';

      // Create two cached clients
      GitClientFactory.getClient(dir1);
      GitClientFactory.getClient(dir2);
      expect(simpleGit).toHaveBeenCalledTimes(2);

      // Clear cache
      GitClientFactory.clearCache();

      // Creating clients again should create new instances
      GitClientFactory.getClient(dir1);
      GitClientFactory.getClient(dir2);
      expect(simpleGit).toHaveBeenCalledTimes(4);
    });
  });
});
