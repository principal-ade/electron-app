/**
 * Tests for RepositoryMonitoringManager
 * Tests the manager that controls the repository monitoring utility process
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import * as path from 'path';
// Mock electron modules
jest.mock('electron', () => ({
    app: {
        isReady: jest.fn(() => true),
        whenReady: jest.fn(() => Promise.resolve()),
    },
    utilityProcess: {
        fork: jest.fn(),
    },
    BrowserWindow: {
        getAllWindows: jest.fn(() => []),
    },
}));
// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid-123'),
}));
import { utilityProcess } from 'electron';
import { RepositoryMonitoringManager } from './RepositoryMonitoringManager';
describe('RepositoryMonitoringManager', () => {
    let manager;
    let mockWorker;
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        // Create mock worker
        mockWorker = new EventEmitter();
        mockWorker.postMessage = jest.fn();
        mockWorker.kill = jest.fn();
        mockWorker.stdout = new EventEmitter();
        mockWorker.stderr = new EventEmitter();
        // Setup utilityProcess.fork to return our mock
        utilityProcess.fork.mockReturnValue(mockWorker);
        // Create manager with autoStart disabled for testing
        manager = new RepositoryMonitoringManager({
            autoStart: false,
            restartOnCrash: false,
            maxRestartAttempts: 3,
            logLevel: 'error', // Reduce noise in tests
        });
    });
    afterEach(async () => {
        // Stop manager if running
        await manager.stop();
    });
    describe('start()', () => {
        it('should spawn worker process', async () => {
            const startPromise = manager.start();
            // Simulate worker ready
            mockWorker.emit('spawn');
            mockWorker.emit('message', { type: 'ready' });
            await startPromise;
            expect(utilityProcess.fork).toHaveBeenCalledWith(expect.stringContaining('worker-entry.js'), [], {
                serviceName: 'repository-monitoring-server',
                stdio: 'pipe',
            });
        });
        it('should wait for ready signal', async () => {
            const startPromise = manager.start();
            // Verify not ready yet
            expect(manager.getStatus().ready).toBe(false);
            // Emit spawn first
            mockWorker.emit('spawn');
            // Then emit ready
            mockWorker.emit('message', { type: 'ready' });
            await startPromise;
            expect(manager.getStatus().ready).toBe(true);
        });
        it('should handle multiple start calls gracefully', async () => {
            const start1 = manager.start();
            const start2 = manager.start();
            mockWorker.emit('spawn');
            mockWorker.emit('message', { type: 'ready' });
            await Promise.all([start1, start2]);
            // Should only fork once
            expect(utilityProcess.fork).toHaveBeenCalledTimes(1);
        });
    });
    describe('stop()', () => {
        it('should kill worker process', async () => {
            // Start first
            const startPromise = manager.start();
            mockWorker.emit('spawn');
            mockWorker.emit('message', { type: 'ready' });
            await startPromise;
            // Then stop
            await manager.stop();
            expect(mockWorker.kill).toHaveBeenCalled();
            expect(manager.getStatus().running).toBe(false);
        });
    });
    describe('IPC communication', () => {
        beforeEach(async () => {
            // Start manager for these tests
            const startPromise = manager.start();
            mockWorker.emit('spawn');
            mockWorker.emit('message', { type: 'ready' });
            await startPromise;
        });
        it('should send request and receive response', async () => {
            // Start request
            const resultPromise = manager.getFileTree('/test/repo');
            // Verify message was sent
            expect(mockWorker.postMessage).toHaveBeenCalledWith({
                id: 'test-uuid-123',
                type: 'getFileTree',
                path: '/test/repo',
            });
            // Simulate response
            const mockFileTree = { sha: 'abc123', root: {} };
            mockWorker.emit('message', {
                type: 'response',
                id: 'test-uuid-123',
                result: mockFileTree,
            });
            const result = await resultPromise;
            expect(result).toEqual(mockFileTree);
        });
        it('should handle error responses', async () => {
            const resultPromise = manager.getFileTree('/invalid/repo');
            // Simulate error response
            mockWorker.emit('message', {
                type: 'error',
                id: 'test-uuid-123',
                error: 'Repository not found',
            });
            await expect(resultPromise).rejects.toThrow('Repository not found');
        });
        it('should timeout long-running requests', async () => {
            // Mock setTimeout to run immediately
            jest.useFakeTimers();
            const resultPromise = manager.getFileTree('/slow/repo');
            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(31000);
            await expect(resultPromise).rejects.toThrow('Request timeout: getFileTree');
            jest.useRealTimers();
        });
    });
    describe('worker process management', () => {
        it('should handle worker crash without restart', async () => {
            // Create manager with restart disabled
            const noRestartManager = new RepositoryMonitoringManager({
                autoStart: false,
                restartOnCrash: false,
                logLevel: 'error',
            });
            // Start manager
            const startPromise = noRestartManager.start();
            mockWorker.emit('spawn');
            mockWorker.emit('message', { type: 'ready' });
            await startPromise;
            // Simulate crash
            mockWorker.emit('exit', 1);
            expect(noRestartManager.getStatus().running).toBe(false);
            expect(utilityProcess.fork).toHaveBeenCalledTimes(1); // No restart
            await noRestartManager.stop();
        });
        it('should restart worker on crash when enabled', async () => {
            // Create manager with restart enabled
            const restartManager = new RepositoryMonitoringManager({
                autoStart: false,
                restartOnCrash: true,
                maxRestartAttempts: 1,
                logLevel: 'error',
            });
            // Mock timers for restart delay
            jest.useFakeTimers();
            // Start manager
            const startPromise = restartManager.start();
            mockWorker.emit('spawn');
            mockWorker.emit('message', { type: 'ready' });
            await startPromise;
            // Clear previous calls
            jest.clearAllMocks();
            // Simulate crash
            mockWorker.emit('exit', 1);
            // Fast-forward restart delay
            jest.advanceTimersByTime(1000);
            // Process pending promises
            await Promise.resolve();
            // Should attempt restart
            expect(utilityProcess.fork).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
            await restartManager.stop();
        });
    });
    describe('public API methods', () => {
        beforeEach(async () => {
            const startPromise = manager.start();
            mockWorker.emit('spawn');
            mockWorker.emit('message', { type: 'ready' });
            await startPromise;
        });
        it('should handle getQualityMetrics', async () => {
            const metricsPromise = manager.getQualityMetrics('/test/repo');
            const mockMetrics = {
                packages: [],
                summary: null,
            };
            mockWorker.emit('message', {
                type: 'response',
                id: 'test-uuid-123',
                result: mockMetrics,
            });
            const result = await metricsPromise;
            expect(result).toMatchObject({
                ...mockMetrics,
                timestamp: expect.any(Date),
                repositoryPath: '/test/repo',
            });
        });
        it('should handle registerRepository', async () => {
            const registerPromise = manager.registerRepository('/new/repo');
            mockWorker.emit('message', {
                type: 'response',
                id: 'test-uuid-123',
                result: { success: true },
            });
            await expect(registerPromise).resolves.toBeUndefined();
        });
        it('should handle refreshRepository', async () => {
            const refreshPromise = manager.refreshRepository('/test/repo');
            mockWorker.emit('message', {
                type: 'response',
                id: 'test-uuid-123',
                result: { success: true },
            });
            await expect(refreshPromise).resolves.toBeUndefined();
        });
        it('should handle getGitStatus', async () => {
            const statusPromise = manager.getGitStatus('/test/repo');
            const mockStatus = {
                repoPath: '/test/repo',
                branch: 'main',
                isDirty: false,
                hasUntracked: false,
                hasStaged: false,
                ahead: 0,
                behind: 0,
                watchingEnabled: false,
            };
            mockWorker.emit('message', {
                type: 'response',
                id: 'test-uuid-123',
                result: mockStatus,
            });
            const result = await statusPromise;
            expect(result).toEqual(mockStatus);
        });
        it('should handle enableGitWatching', async () => {
            const enablePromise = manager.enableGitWatching('/test/repo');
            mockWorker.emit('message', {
                type: 'response',
                id: 'test-uuid-123',
                result: { success: true },
            });
            await expect(enablePromise).resolves.toBeUndefined();
            expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: 'enableGitWatching',
                path: '/test/repo',
            }));
        });
        it('should handle disableGitWatching', async () => {
            const disablePromise = manager.disableGitWatching('/test/repo');
            mockWorker.emit('message', {
                type: 'response',
                id: 'test-uuid-123',
                result: { success: true },
            });
            await expect(disablePromise).resolves.toBeUndefined();
            expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: 'disableGitWatching',
                path: '/test/repo',
            }));
        });
    });
    describe('worker path resolution', () => {
        it('should construct correct worker path', async () => {
            await manager.start();
            const expectedPath = path.join(path.dirname(__filename), '../repository-monitoring-server/worker-entry.js');
            expect(utilityProcess.fork).toHaveBeenCalledWith(expect.stringContaining('repository-monitoring-server/worker-entry.js'), expect.anything(), expect.anything());
        });
    });
    describe('getStatus()', () => {
        it('should return current status', async () => {
            expect(manager.getStatus()).toEqual({
                running: false,
                ready: false,
                restartAttempts: 0,
            });
            const startPromise = manager.start();
            mockWorker.emit('spawn');
            expect(manager.getStatus()).toEqual({
                running: true,
                ready: false,
                restartAttempts: 0,
            });
            mockWorker.emit('message', { type: 'ready' });
            await startPromise;
            expect(manager.getStatus()).toEqual({
                running: true,
                ready: true,
                restartAttempts: 0,
            });
        });
    });
});
