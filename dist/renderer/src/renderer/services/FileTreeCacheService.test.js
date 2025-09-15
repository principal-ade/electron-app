import { FileTreeCacheService } from './FileTreeCacheService';
import { loadLocalFileSystemTree, loadGitHubFileSystemTree } from '../utils/loadFileSystemTree';
import { createFileTreeSource } from '../types/file-tree-source';
// Mock dependencies
jest.mock('../utils/loadFileSystemTree');
// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        })
    };
})();
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
});
describe('FileTreeCacheService', () => {
    let service;
    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.clear();
        service = new FileTreeCacheService();
    });
    describe('loadFileTree', () => {
        const mockTree = {
            name: 'root',
            type: 'directory',
            children: [
                {
                    name: 'file1.ts',
                    type: 'file',
                    children: []
                }
            ]
        };
        const mockTreeResult = {
            fileTree: mockTree,
            stats: {
                fileCount: 1,
                directoryCount: 0
            }
        };
        it('should load local file tree for local source', async () => {
            const localSource = createFileTreeSource.localWorkingCopy('/path/to/repo', 'owner', 'repo', 'https://github.com/owner/repo.git', 'main');
            loadLocalFileSystemTree.mockResolvedValue(mockTreeResult);
            const result = await service.loadFileTree(localSource);
            expect(loadLocalFileSystemTree).toHaveBeenCalledWith({
                localPath: '/path/to/repo',
                owner: 'owner',
                repo: 'repo',
                includeVCS: true
            });
            expect(result).toEqual({
                source: localSource,
                tree: mockTree,
                stats: mockTreeResult.stats
            });
        });
        it('should load GitHub file tree for remote source', async () => {
            const remoteSource = createFileTreeSource.remoteBranch('owner', 'repo', 'https://github.com/owner/repo.git', 'main');
            loadGitHubFileSystemTree.mockResolvedValue(mockTreeResult);
            const result = await service.loadFileTree(remoteSource);
            expect(loadGitHubFileSystemTree).toHaveBeenCalledWith({
                owner: 'owner',
                repo: 'repo',
                branch: 'main'
            });
            expect(result).toEqual({
                source: remoteSource,
                tree: mockTree,
                stats: mockTreeResult.stats
            });
        });
        it('should return cached tree if available and not expired', async () => {
            const localSource = createFileTreeSource.localWorkingCopy('/path/to/repo', 'owner', 'repo', 'https://github.com/owner/repo.git', 'main');
            const cachedTree = {
                source: localSource,
                tree: mockTree,
                stats: {
                    fileCount: 1,
                    directoryCount: 0,
                    loadedAt: Date.now()
                },
                size: 1000,
                expiresAt: Date.now() + 3600000 // 1 hour from now
            };
            localStorageMock.setItem(`filetree_cache_${localSource.id}`, JSON.stringify(cachedTree));
            const result = await service.loadFileTree(localSource);
            expect(loadLocalFileSystemTree).not.toHaveBeenCalled();
            expect(result).toEqual({
                source: localSource,
                tree: mockTree,
                stats: cachedTree.stats
            });
        });
        it('should reload if cached tree is expired', async () => {
            const localSource = createFileTreeSource.localWorkingCopy('/path/to/repo', 'owner', 'repo', 'https://github.com/owner/repo.git', 'main');
            const expiredCache = {
                source: localSource,
                tree: mockTree,
                stats: {
                    fileCount: 1,
                    directoryCount: 0,
                    loadedAt: Date.now() - 7200000 // 2 hours ago
                },
                size: 1000,
                expiresAt: Date.now() - 3600000 // Expired 1 hour ago
            };
            localStorageMock.setItem(`filetree_cache_${localSource.id}`, JSON.stringify(expiredCache));
            loadLocalFileSystemTree.mockResolvedValue(mockTreeResult);
            const result = await service.loadFileTree(localSource);
            expect(loadLocalFileSystemTree).toHaveBeenCalled();
            expect(result?.stats.loadedAt).toBeGreaterThan(expiredCache.stats.loadedAt);
        });
    });
    describe('cache management', () => {
        it('should store and retrieve analysis cache', () => {
            const sourceId = 'test-source-id';
            const analysis = {
                packageLayers: [{ name: 'package1', path: '/' }],
                frameworkLayers: [{ name: 'react' }]
            };
            service.setAnalysis(sourceId, analysis);
            const retrieved = service.getAnalysis(sourceId);
            expect(retrieved).toEqual(expect.objectContaining(analysis));
            expect(retrieved?.loadedAt).toBeDefined();
        });
        it('should invalidate source cache', () => {
            const sourceId = 'test-source-id';
            const analysis = {
                packageLayers: [{ name: 'package1', path: '/' }]
            };
            // Set both tree cache and analysis cache
            localStorageMock.setItem(`filetree_cache_${sourceId}`, JSON.stringify({ tree: {}, stats: {} }));
            service.setAnalysis(sourceId, analysis);
            // Invalidate
            service.invalidateSource(sourceId);
            // Check both are cleared
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(`filetree_cache_${sourceId}`);
            expect(service.getAnalysis(sourceId)).toBeNull();
        });
        it('should clear all caches', () => {
            const source1 = 'source1';
            const source2 = 'source2';
            localStorageMock.setItem(`filetree_cache_${source1}`, '{}');
            localStorageMock.setItem(`filetree_cache_${source2}`, '{}');
            localStorageMock.setItem('filetree_cache_index', JSON.stringify([source1, source2]));
            service.clearCache();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(`filetree_cache_${source1}`);
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(`filetree_cache_${source2}`);
            expect(localStorageMock.setItem).toHaveBeenCalledWith('filetree_cache_index', '[]');
        });
    });
    describe('prefetching', () => {
        it('should prefetch trees for multiple sources', async () => {
            const sources = [
                createFileTreeSource.localWorkingCopy('/path1', 'owner1', 'repo1', 'url1', 'main'),
                createFileTreeSource.remoteBranch('owner2', 'repo2', 'url2', 'develop')
            ];
            loadLocalFileSystemTree.mockResolvedValue({
                fileTree: { name: 'root1', type: 'directory', children: [] },
                stats: { fileCount: 1, directoryCount: 0 }
            });
            loadGitHubFileSystemTree.mockResolvedValue({
                fileTree: { name: 'root2', type: 'directory', children: [] },
                stats: { fileCount: 2, directoryCount: 1 }
            });
            await service.prefetchTrees(sources);
            expect(loadLocalFileSystemTree).toHaveBeenCalledTimes(1);
            expect(loadGitHubFileSystemTree).toHaveBeenCalledTimes(1);
        });
        it('should not prefetch temporary sources', async () => {
            const tempSource = createFileTreeSource.temporarySource('/temp/path', 'temp-owner', 'temp-repo', 'temp-url');
            await service.prefetchTrees([tempSource]);
            expect(loadLocalFileSystemTree).not.toHaveBeenCalled();
            expect(loadGitHubFileSystemTree).not.toHaveBeenCalled();
        });
    });
    describe('cache statistics', () => {
        it('should calculate cache size', () => {
            const source1 = 'source1';
            const source2 = 'source2';
            localStorageMock.setItem(`filetree_cache_${source1}`, JSON.stringify({ size: 1000 }));
            localStorageMock.setItem(`filetree_cache_${source2}`, JSON.stringify({ size: 2000 }));
            localStorageMock.setItem('filetree_cache_index', JSON.stringify([source1, source2]));
            const stats = service.getCacheStats();
            expect(stats.totalSize).toBe(3000);
            expect(stats.entryCount).toBe(2);
        });
        it('should get cache entries sorted by last accessed', () => {
            const now = Date.now();
            const source1 = 'source1';
            const source2 = 'source2';
            localStorageMock.setItem(`filetree_cache_${source1}`, JSON.stringify({
                source: { id: source1 },
                stats: { loadedAt: now - 1000 }
            }));
            localStorageMock.setItem(`filetree_cache_${source2}`, JSON.stringify({
                source: { id: source2 },
                stats: { loadedAt: now }
            }));
            localStorageMock.setItem('filetree_cache_index', JSON.stringify([source1, source2]));
            const entries = service.getCacheEntries();
            expect(entries[0].sourceId).toBe(source2); // Most recent first
            expect(entries[1].sourceId).toBe(source1);
        });
    });
});
