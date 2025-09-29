/**
 * Tests for RepositoryMonitoringServer
 * Tests the git watching functionality in the utility process
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RepositoryMonitoringServer } from './RepositoryMonitoringServer';
import { GitCore } from '../shared/repository-core/GitCore';
import { MonitoringInternalEvent } from './types';
const gitWatcherAdapterInstances = [];
// Mock dependencies
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
const mockedGitCore = GitCore;
describe('RepositoryMonitoringServer', () => {
    let server;
    const getRepositoryState = (repoPath) => {
        return server.repositories.get(repoPath);
    };
    beforeEach(() => {
        // Clear all mocks
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
            expect(gitWatcher.startWatching).toHaveBeenCalledWith(testRepoPath);
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
            expect(gitWatcher.startWatching).toHaveBeenCalledWith(testRepoPath);
            const state = getRepositoryState(testRepoPath);
            expect(state?.gitWatchingEnabled).toBe(true);
            expect(state?.fsMonitorEnabled).toBe(false);
            expect(state?.watchingMode).toBe('fallback');
            expect(state?.isWatching).toBe(true);
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
            // Enable once
            await server.enableGitWatching(testRepoPath);
            const gitWatcher = gitWatcherAdapterInstances[0];
            mockedGitCore.enableFSMonitor.mockClear();
            gitWatcher.startWatching.mockClear();
            // Try to enable again
            await server.enableGitWatching(testRepoPath);
            // Should not call enableFSMonitor again
            expect(mockedGitCore.enableFSMonitor).not.toHaveBeenCalled();
            expect(gitWatcher.startWatching).not.toHaveBeenCalled();
        });
        it('should disable git watching', async () => {
            // Enable watching first
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
            // Now disable
            await server.disableGitWatching(testRepoPath);
            expect(gitWatcher.stopWatching).toHaveBeenCalledWith(testRepoPath);
            const state = getRepositoryState(testRepoPath);
            expect(state?.gitWatchingEnabled).toBe(false);
            expect(state?.isWatching).toBe(false);
            expect(state?.watchingMode).toBe('none');
            expect(watcher?.stop).toHaveBeenCalled();
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
                const repoState = getRepositoryState(testRepoPath);
                expect(repoState?.gitWatchingEnabled).toBe(true);
                // Seed caches so we can confirm they are cleared
                const fileTreeCache = server.fileTreeCache;
                const packageCache = server.packageCache;
                fileTreeCache.set(testRepoPath, {
                    tree: {},
                    timestamp: Date.now(),
                    sha: 'abc',
                });
                packageCache.set(testRepoPath, {
                    packages: [],
                    summary: { totalPackages: 0, workspacePackages: [], totalDependencies: 0, totalDevDependencies: 0, availableScripts: [], isMonorepo: false },
                    timestamp: Date.now(),
                });
                const gitWatcher = gitWatcherAdapterInstances[0];
                const workspaceHandler = gitWatcher.on.mock.calls.find(([eventName]) => eventName === MonitoringInternalEvent.WORKSPACE_CHANGED)?.[1];
                expect(typeof workspaceHandler).toBe('function');
                const gitStatusSpy = jest.spyOn(server, 'getGitStatus').mockResolvedValue({
                    repoPath: testRepoPath,
                    branch: 'main',
                    isDirty: false,
                    hasUntracked: false,
                    hasStaged: false,
                    ahead: 0,
                    behind: 0,
                    watchingEnabled: true,
                });
                workspaceHandler?.({ repoPath: testRepoPath, state: undefined });
                expect(fileTreeCache.has(testRepoPath)).toBe(false);
                expect(packageCache.has(testRepoPath)).toBe(false);
                expect(gitStatusSpy).not.toHaveBeenCalled();
                await jest.runOnlyPendingTimersAsync();
                expect(gitStatusSpy).toHaveBeenCalledWith(testRepoPath);
                gitStatusSpy.mockRestore();
                jest.useRealTimers();
            });
            // Check that watching is disabled
            const status = await server.getGitStatus(testRepoPath);
            expect(status.watchingEnabled).toBe(false);
        });
        it('falls back to comprehensive watcher when minimal watcher encounters a fatal error', async () => {
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
            const watcher = watchersByRepo.get(testRepoPath);
            expect(watcher).toBeDefined();
            expect(watcher?.start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'minimal' }));
            watcher?.options?.onFatalError?.(new Error('simulate failure'));
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(watcher?.start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'fallback' }));
        });
        it('clears caches when workspace files change', async () => {
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
            fileTreeCache.set(testRepoPath, { tree: { sha: 'abc' }, timestamp: Date.now() });
            packageCache.set(testRepoPath, { packages: [], summary: {}, timestamp: Date.now() });
            const watcher = watchersByRepo.get(testRepoPath);
            expect(mockedGitCore.getDetailedStatus).toHaveBeenCalledTimes(1);
            watcher?.options?.onFileChange?.('change', `${testRepoPath}/src/index.ts`);
            expect(fileTreeCache.has(testRepoPath)).toBe(false);
            expect(packageCache.has(testRepoPath)).toBe(false);
            jest.advanceTimersByTime(600);
            await Promise.resolve();
            expect(mockedGitCore.getDetailedStatus).toHaveBeenCalledTimes(2);
            jest.useRealTimers();
        });
        it('should throw error when enabling watching for unregistered repository', async () => {
            await expect(server.enableGitWatching('/unregistered/repo')).rejects.toThrow('Repository /unregistered/repo not registered');
        });
    });
});
