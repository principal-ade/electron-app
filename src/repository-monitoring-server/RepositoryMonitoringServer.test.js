/**
 * Tests for RepositoryMonitoringServer
 */
import { describe, it, expect, beforeEach, afterEach, jest, } from '@jest/globals';
import { RepositoryMonitoringServer } from './RepositoryMonitoringServer';
import { GitCore } from '../shared/repository-core/GitCore';
import { MonitoringInternalEvent } from './types';
const mockedGitCore = GitCore;
const gitWatcherAdapterInstances = [];
jest.mock('../shared/repository-core/GitCore');
jest.mock('./GitWatcherAdapter', () => {
    return {
        GitWatcherAdapter: jest.fn().mockImplementation(() => {
            const instance = {
                startWatching: jest.fn(),
                stopWatching: jest.fn(),
                on: jest.fn(),
            };
            gitWatcherAdapterInstances.push(instance);
            return instance;
        }),
    };
});
describe('RepositoryMonitoringServer', () => {
    let server;
    const getRepositoryState = (repoPath) => {
        return server.repositories.get(repoPath);
    };
    beforeEach(() => {
        jest.clearAllMocks();
        gitWatcherAdapterInstances.length = 0;
        server = new RepositoryMonitoringServer();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Git Status Operations', () => {
        const testRepoPath = '/test/repo';
        beforeEach(async () => {
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
            mockedGitCore.getDetailedStatus.mockResolvedValue(mockDetailedStatus);
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
                lastChangedAt: undefined,
            });
            expect(mockedGitCore.getDetailedStatus).toHaveBeenCalledWith(testRepoPath);
        });
        it('should handle git status errors gracefully', async () => {
            mockedGitCore.getDetailedStatus.mockRejectedValue(new Error('Git error'));
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
                lastChangedAt: undefined,
            });
        });
    });
    describe('Git Watching', () => {
        const testRepoPath = '/test/repo';
        beforeEach(async () => {
            await server.registerRepository(testRepoPath);
        });
        it('should enable git watching with FSMonitor when supported', async () => {
            mockedGitCore.enableFSMonitor.mockResolvedValue(true);
            mockedGitCore.getDetailedStatus.mockResolvedValue({
                branch: 'main',
                isDirty: false,
                hasUntracked: false,
                hasStaged: false,
                ahead: 0,
                behind: 0,
            });
            await server.enableGitWatching(testRepoPath);
            expect(mockedGitCore.enableFSMonitor).toHaveBeenCalledWith(testRepoPath);
            const gitWatcher = gitWatcherAdapterInstances[0];
            expect(gitWatcher.startWatching).toHaveBeenCalledWith(testRepoPath, 'minimal');
            const state = getRepositoryState(testRepoPath);
            expect(state?.gitWatchingEnabled).toBe(true);
            expect(state?.fsMonitorEnabled).toBe(true);
            expect(state?.watchingMode).toBe('minimal');
            expect(state?.isWatching).toBe(true);
        });
        it('should use fallback watching when FSMonitor is not available', async () => {
            mockedGitCore.enableFSMonitor.mockResolvedValue(false);
            mockedGitCore.getDetailedStatus.mockResolvedValue({
                branch: 'main',
                isDirty: false,
                hasUntracked: false,
                hasStaged: false,
                ahead: 0,
                behind: 0,
            });
            await server.enableGitWatching(testRepoPath);
            expect(mockedGitCore.enableFSMonitor).toHaveBeenCalledWith(testRepoPath);
            const gitWatcher = gitWatcherAdapterInstances[0];
            expect(gitWatcher.startWatching).toHaveBeenCalledWith(testRepoPath, 'fallback');
            const state = getRepositoryState(testRepoPath);
            expect(state?.gitWatchingEnabled).toBe(true);
            expect(state?.fsMonitorEnabled).toBe(false);
            expect(state?.watchingMode).toBe('fallback');
        });
        it('should not re-enable watching if already enabled', async () => {
            mockedGitCore.enableFSMonitor.mockResolvedValue(true);
            mockedGitCore.getDetailedStatus.mockResolvedValue({
                branch: 'main',
                isDirty: false,
                hasUntracked: false,
                hasStaged: false,
                ahead: 0,
                behind: 0,
            });
            await server.enableGitWatching(testRepoPath);
            const gitWatcher = gitWatcherAdapterInstances[0];
            mockedGitCore.enableFSMonitor.mockClear();
            gitWatcher.startWatching.mockClear();
            await server.enableGitWatching(testRepoPath);
            expect(mockedGitCore.enableFSMonitor).not.toHaveBeenCalled();
            expect(gitWatcher.startWatching).not.toHaveBeenCalled();
        });
        it('should disable git watching', async () => {
            mockedGitCore.enableFSMonitor.mockResolvedValue(true);
            mockedGitCore.getDetailedStatus.mockResolvedValue({
                branch: 'main',
                isDirty: false,
                hasUntracked: false,
                hasStaged: false,
                ahead: 0,
                behind: 0,
            });
            await server.enableGitWatching(testRepoPath);
            const gitWatcher = gitWatcherAdapterInstances[0];
            gitWatcher.stopWatching.mockClear();
            await server.disableGitWatching(testRepoPath);
            expect(gitWatcher.stopWatching).toHaveBeenCalledWith(testRepoPath);
            const state = getRepositoryState(testRepoPath);
            expect(state?.gitWatchingEnabled).toBe(false);
            expect(state?.isWatching).toBe(false);
            expect(state?.watchingMode).toBe('none');
        });
        it('should clear caches and refresh git status on workspace change events', async () => {
            jest.useFakeTimers();
            mockedGitCore.enableFSMonitor.mockResolvedValue(false);
            mockedGitCore.getDetailedStatus.mockResolvedValue({
                branch: 'main',
                isDirty: false,
                hasUntracked: false,
                hasStaged: false,
                ahead: 0,
                behind: 0,
            });
            await server.enableGitWatching(testRepoPath);
            const fileTreeCache = server.fileTreeCache;
            const packageCache = server.packageCache;
            fileTreeCache.set(testRepoPath, {
                tree: {},
                timestamp: Date.now(),
                sha: 'abc',
            });
            packageCache.set(testRepoPath, {
                packages: [],
                summary: {
                    isMonorepo: false,
                    totalPackages: 0,
                    workspacePackages: [],
                    totalDependencies: 0,
                    totalDevDependencies: 0,
                    availableScripts: [],
                },
                timestamp: Date.now(),
            });
            const gitWatcher = gitWatcherAdapterInstances[0];
            const workspaceHandler = gitWatcher.on.mock.calls.find(([eventName]) => eventName === MonitoringInternalEvent.WORKSPACE_CHANGED)?.[1];
            expect(typeof workspaceHandler).toBe('function');
            const gitStatusSpy = jest
                .spyOn(server, 'getGitStatus')
                .mockResolvedValue({
                repoPath: testRepoPath,
                branch: 'main',
                isDirty: false,
                hasUntracked: false,
                hasStaged: false,
                ahead: 0,
                behind: 0,
                watchingEnabled: true,
            });
            if (workspaceHandler) {
                workspaceHandler({ repoPath: testRepoPath, state: undefined });
            }
            expect(fileTreeCache.has(testRepoPath)).toBe(false);
            expect(packageCache.has(testRepoPath)).toBe(false);
            expect(gitStatusSpy).not.toHaveBeenCalled();
            await jest.runOnlyPendingTimersAsync();
            expect(gitStatusSpy).toHaveBeenCalledWith(testRepoPath);
            gitStatusSpy.mockRestore();
            jest.useRealTimers();
        });
        it('should throw when enabling watching for an unregistered repository', async () => {
            await expect(server.enableGitWatching('/unregistered/repo')).rejects.toThrow('Repository /unregistered/repo not registered');
        });
    });
});
