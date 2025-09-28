/**
 * Tests for RepositoryMonitoringServer
 * Tests the git watching functionality in the utility process
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RepositoryMonitoringServer } from './RepositoryMonitoringServer';
import { GitCore } from '../shared/repository-core/GitCore';
import { FSWatcher } from 'chokidar';

// Mock dependencies
jest.mock('../shared/repository-core/GitCore');
jest.mock('chokidar', () => ({
  watch: jest.fn(),
}));

const mockedGitCore = GitCore as jest.Mocked<typeof GitCore>;

describe('RepositoryMonitoringServer', () => {
  let server: RepositoryMonitoringServer;
  let mockWatcher: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock watcher
    mockWatcher = {
      on: jest.fn(),
      close: jest.fn(),
    };

    const chokidar = require('chokidar');
    (chokidar.watch as jest.Mock).mockReturnValue(mockWatcher);

    // Create server instance
    server = new RepositoryMonitoringServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Git Status Operations', () => {
    const testRepoPath = '/test/repo';

    beforeEach(async () => {
      // Register repository first
      await server.registerRepository(testRepoPath);
    });

    it('should get git status for a repository', async () => {
      const mockDetailedStatus = {
        branch: 'main',
        isDirty: true,
        hasUntracked: true,
        hasStaged: false,
        ahead: 2,
        behind: 1,
      };

      (mockedGitCore.getDetailedStatus as jest.Mock).mockResolvedValue(mockDetailedStatus);

      const status = await server.getGitStatus(testRepoPath);

      expect(status).toEqual({
        repoPath: testRepoPath,
        branch: 'main',
        isDirty: true,
        hasUntracked: true,
        hasStaged: false,
        ahead: 2,
        behind: 1,
        watchingEnabled: false,
      });

      expect(mockedGitCore.getDetailedStatus).toHaveBeenCalledWith(testRepoPath);
    });

    it('should handle git status errors gracefully', async () => {
      (mockedGitCore.getDetailedStatus as jest.Mock).mockRejectedValue(new Error('Git error'));

      const status = await server.getGitStatus(testRepoPath);

      expect(status).toEqual({
        repoPath: testRepoPath,
        branch: 'unknown',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
        watchingEnabled: false,
      });
    });
  });

  describe('Git Watching', () => {
    const testRepoPath = '/test/repo';

    beforeEach(async () => {
      await server.registerRepository(testRepoPath);
    });

    it('should enable git watching with FSMonitor when supported', async () => {
      (mockedGitCore.enableFSMonitor as jest.Mock).mockResolvedValue(true);
      (mockedGitCore.getDetailedStatus as jest.Mock).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
      });

      await server.enableGitWatching(testRepoPath);

      expect(mockedGitCore.enableFSMonitor).toHaveBeenCalledWith(testRepoPath);
      expect(require('chokidar').watch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('index'),
          expect.stringContaining('HEAD'),
        ]),
        expect.objectContaining({
          ignoreInitial: true,
          persistent: true,
        })
      );
    });

    it('should use fallback watching when FSMonitor is not available', async () => {
      (mockedGitCore.enableFSMonitor as jest.Mock).mockResolvedValue(false);
      (mockedGitCore.getDetailedStatus as jest.Mock).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
      });

      await server.enableGitWatching(testRepoPath);

      expect(mockedGitCore.enableFSMonitor).toHaveBeenCalledWith(testRepoPath);
      expect(require('chokidar').watch).toHaveBeenCalledWith(
        testRepoPath,
        expect.objectContaining({
          ignored: expect.arrayContaining([
            '**/node_modules/**',
            '**/.git/objects/**',
          ]),
          persistent: true,
        })
      );
    });

    it('should not re-enable watching if already enabled', async () => {
      (mockedGitCore.enableFSMonitor as jest.Mock).mockResolvedValue(true);
      (mockedGitCore.getDetailedStatus as jest.Mock).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
      });

      // Enable once
      await server.enableGitWatching(testRepoPath);
      jest.clearAllMocks();

      // Try to enable again
      await server.enableGitWatching(testRepoPath);

      // Should not call enableFSMonitor again
      expect(mockedGitCore.enableFSMonitor).not.toHaveBeenCalled();
      expect(require('chokidar').watch).not.toHaveBeenCalled();
    });

    it('should disable git watching', async () => {
      // Enable watching first
      (mockedGitCore.enableFSMonitor as jest.Mock).mockResolvedValue(true);
      (mockedGitCore.getDetailedStatus as jest.Mock).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
      });

      await server.enableGitWatching(testRepoPath);

      // Now disable
      await server.disableGitWatching(testRepoPath);

      expect(mockWatcher.close).toHaveBeenCalled();

      // Check that watching is disabled
      const status = await server.getGitStatus(testRepoPath);
      expect(status.watchingEnabled).toBe(false);
    });

    it('should throw error when enabling watching for unregistered repository', async () => {
      await expect(server.enableGitWatching('/unregistered/repo')).rejects.toThrow(
        'Repository /unregistered/repo not registered'
      );
    });
  });

  describe('File Change Handling', () => {
    it('should debounce file changes with FSMonitor', async () => {
      jest.useFakeTimers();

      const testRepoPath = '/test/repo';
      await server.registerRepository(testRepoPath);

      (mockedGitCore.enableFSMonitor as jest.Mock).mockResolvedValue(true);
      (mockedGitCore.getDetailedStatus as jest.Mock).mockResolvedValue({
        branch: 'main',
        isDirty: true,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
      });

      await server.enableGitWatching(testRepoPath);

      // Simulate file changes
      const changeHandler = mockWatcher.on.mock.calls.find(
        (call: any) => call[0] === 'all'
      )[1];

      // Trigger multiple changes
      changeHandler('change', '/test/repo/.git/index', {});
      changeHandler('change', '/test/repo/.git/HEAD', {});

      // Should not call getGitStatus immediately
      expect(mockedGitCore.getDetailedStatus).toHaveBeenCalledTimes(1); // Only initial call

      // Fast forward 500ms (FSMonitor debounce time)
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Should call getGitStatus once after debounce
      expect(mockedGitCore.getDetailedStatus).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should debounce file changes without FSMonitor (longer delay)', async () => {
      jest.useFakeTimers();

      const testRepoPath = '/test/repo';
      await server.registerRepository(testRepoPath);

      (mockedGitCore.enableFSMonitor as jest.Mock).mockResolvedValue(false);
      (mockedGitCore.getDetailedStatus as jest.Mock).mockResolvedValue({
        branch: 'main',
        isDirty: true,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
      });

      await server.enableGitWatching(testRepoPath);

      // Simulate file changes
      const changeHandler = mockWatcher.on.mock.calls.find(
        (call: any) => call[0] === 'all'
      )[1];

      // Trigger multiple changes
      changeHandler('change', '/test/repo/file1.ts', {});
      changeHandler('change', '/test/repo/file2.ts', {});

      // Should not call getGitStatus immediately
      expect(mockedGitCore.getDetailedStatus).toHaveBeenCalledTimes(1); // Only initial call

      // Fast forward 2000ms (fallback debounce time)
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      // Should call getGitStatus once after debounce
      expect(mockedGitCore.getDetailedStatus).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });
});