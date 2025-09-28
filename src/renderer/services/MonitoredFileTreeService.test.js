/**
 * Tests for MonitoredFileTreeService
 * Verifies the service correctly uses repository-monitoring without fallback
 */
import { MonitoredFileTreeService } from './MonitoredFileTreeService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
// Mock the RepositoryMonitoringService
jest.mock('../main-process-api/RepositoryMonitoringService');
describe('MonitoredFileTreeService', () => {
    let service;
    beforeEach(() => {
        jest.clearAllMocks();
        service = new MonitoredFileTreeService();
    });
    describe('loadFileTree', () => {
        const mockFileTree = {
            sha: 'abc123',
            root: {},
            allFiles: [
                { path: '/test/file1.ts', name: 'file1.ts', size: 100 },
                { path: '/test/file2.ts', name: 'file2.ts', size: 200 },
            ],
            allDirectories: [
                { path: '/test', name: 'test' },
            ],
            statistics: {
                totalFiles: 2,
                totalDirectories: 1,
                totalSize: 300,
                maxDepth: 1,
            },
            metadata: {},
        };
        const localSource = {
            id: 'test-source',
            name: 'test-repo',
            type: 'local',
            location: '/path/to/repo',
            owner: 'test-owner',
            repo: 'test-repo',
            remoteUrl: 'https://github.com/test-owner/test-repo',
            isDefault: true,
            locationType: 'path',
        };
        it('should load file tree from monitoring service for local source', async () => {
            RepositoryMonitoringService.getFileTree.mockResolvedValue(mockFileTree);
            const result = await service.loadFileTree(localSource);
            expect(RepositoryMonitoringService.getFileTree).toHaveBeenCalledWith('/path/to/repo');
            expect(result.tree).toEqual(mockFileTree);
            expect(result.treeStats).toEqual({
                fileCount: 2,
                directoryCount: 1,
                loadedAt: expect.any(Number),
            });
        });
        it('should throw error when monitoring service returns null', async () => {
            RepositoryMonitoringService.getFileTree.mockResolvedValue(null);
            await expect(service.loadFileTree(localSource)).rejects.toThrow('No FileTree available from monitoring service for /path/to/repo');
        });
        it('should throw error for non-local sources', async () => {
            const githubSource = {
                ...localSource,
                type: 'github',
                location: 'main',
                locationType: 'branch',
            };
            await expect(service.loadFileTree(githubSource)).rejects.toThrow('MonitoredFileTreeService only supports local sources. Got type: github');
        });
        it('should use memory cache for repeated calls', async () => {
            RepositoryMonitoringService.getFileTree.mockResolvedValue(mockFileTree);
            // First call - should hit monitoring service
            await service.loadFileTree(localSource);
            expect(RepositoryMonitoringService.getFileTree).toHaveBeenCalledTimes(1);
            // Second call - should use cache
            const result = await service.loadFileTree(localSource);
            expect(RepositoryMonitoringService.getFileTree).toHaveBeenCalledTimes(1);
            expect(result.tree).toEqual(mockFileTree);
        });
        it('should evict oldest cache entries when limit exceeded', async () => {
            RepositoryMonitoringService.getFileTree.mockResolvedValue(mockFileTree);
            // Load 4 different sources (MAX_MEMORY_TREES = 3)
            for (let i = 0; i < 4; i++) {
                const source = {
                    ...localSource,
                    id: `source-${i}`,
                    location: `/path/to/repo-${i}`,
                };
                await service.loadFileTree(source);
            }
            // Check cache stats
            const stats = service.getCacheStats();
            expect(stats.memoryCacheSize).toBe(3); // Only 3 should remain
            expect(stats.memoryCacheEntries).not.toContain('source-0'); // First should be evicted
        });
    });
    describe('registerRepository', () => {
        it('should call monitoring service to register repository', async () => {
            RepositoryMonitoringService.registerRepository.mockResolvedValue({ success: true });
            await service.registerRepository('/path/to/repo');
            expect(RepositoryMonitoringService.registerRepository).toHaveBeenCalledWith('/path/to/repo');
        });
        it('should throw error if registration fails', async () => {
            RepositoryMonitoringService.registerRepository.mockRejectedValue(new Error('Registration failed'));
            await expect(service.registerRepository('/path/to/repo')).rejects.toThrow('Registration failed');
        });
    });
    describe('refreshRepository', () => {
        it('should invalidate cache and refresh via monitoring service', async () => {
            RepositoryMonitoringService.getFileTree.mockResolvedValue(mockFileTree);
            RepositoryMonitoringService.refreshRepository.mockResolvedValue({ success: true });
            // Load and cache a tree
            const source = {
                id: 'test-source',
                name: 'test-repo',
                type: 'local',
                location: '/path/to/repo',
                owner: 'test-owner',
                repo: 'test-repo',
                remoteUrl: 'https://github.com/test-owner/test-repo',
                isDefault: true,
                locationType: 'path',
            };
            await service.loadFileTree(source);
            // Refresh should invalidate cache
            await service.refreshRepository('/path/to/repo');
            expect(RepositoryMonitoringService.refreshRepository).toHaveBeenCalledWith('/path/to/repo');
            // Next load should hit monitoring service again (cache was invalidated)
            await service.loadFileTree(source);
            expect(RepositoryMonitoringService.getFileTree).toHaveBeenCalledTimes(2);
        });
    });
    describe('prefetchTrees', () => {
        it('should register all local sources', async () => {
            RepositoryMonitoringService.registerRepository.mockResolvedValue({ success: true });
            const sources = [
                {
                    id: 'local-1',
                    name: 'repo1',
                    type: 'local',
                    location: '/path/to/repo1',
                    owner: 'owner',
                    repo: 'repo1',
                    remoteUrl: 'https://github.com/owner/repo1',
                    isDefault: true,
                    locationType: 'path',
                },
                {
                    id: 'local-2',
                    name: 'repo2',
                    type: 'local',
                    location: '/path/to/repo2',
                    owner: 'owner',
                    repo: 'repo2',
                    remoteUrl: 'https://github.com/owner/repo2',
                    isDefault: false,
                    locationType: 'path',
                },
                {
                    id: 'github-1',
                    name: 'repo3',
                    type: 'github',
                    location: 'main',
                    owner: 'owner',
                    repo: 'repo3',
                    remoteUrl: 'https://github.com/owner/repo3',
                    isDefault: false,
                    locationType: 'branch',
                },
            ];
            await service.prefetchTrees(sources);
            // Should only register local sources
            expect(RepositoryMonitoringService.registerRepository).toHaveBeenCalledTimes(2);
            expect(RepositoryMonitoringService.registerRepository).toHaveBeenCalledWith('/path/to/repo1');
            expect(RepositoryMonitoringService.registerRepository).toHaveBeenCalledWith('/path/to/repo2');
        });
    });
});
