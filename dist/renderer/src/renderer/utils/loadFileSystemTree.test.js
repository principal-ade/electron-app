import { loadLocalFileSystemTree, loadGitHubFileSystemTree } from './loadFileSystemTree';
import { FileSystemModule } from "@principal-ai/codebase-composition";
import { ElectronPlatformAdapters } from '../adapters';
import { GitHubWebAdapters } from '../adapters/GitHubWebAdapters';
// Mock dependencies
jest.mock('core/layers');
jest.mock('../adapters');
jest.mock('../adapters/GitHubWebAdapters');
describe('loadFileSystemTree', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('loadLocalFileSystemTree', () => {
        const mockFileTree = {
            name: 'root',
            type: 'directory',
            children: [
                {
                    name: 'src',
                    type: 'directory',
                    children: [
                        {
                            name: 'index.ts',
                            type: 'file',
                            children: []
                        }
                    ]
                },
                {
                    name: 'package.json',
                    type: 'file',
                    children: []
                }
            ]
        };
        it('should load file tree from local filesystem', async () => {
            const mockAdapters = {
                fileSystem: {},
                config: {},
                git: {},
                shell: {}
            };
            ElectronPlatformAdapters.mockImplementation(() => mockAdapters);
            const mockLoadFileSystemTree = jest.fn().mockResolvedValue({
                fileSystemTree: mockFileTree,
                filterLayers: []
            });
            FileSystemModule.mockImplementation(() => ({
                loadFileSystemTree: mockLoadFileSystemTree
            }));
            const result = await loadLocalFileSystemTree({
                localPath: '/path/to/repo',
                owner: 'test-owner',
                repo: 'test-repo',
                includeVCS: true
            });
            expect(result.fileTree).toEqual(mockFileTree);
            expect(result.stats).toEqual({
                fileCount: 2,
                directoryCount: 2
            });
            expect(FileSystemModule).toHaveBeenCalledWith(expect.objectContaining({
                directoryPath: '/path/to/repo'
            }));
        });
        it('should include version control when requested', async () => {
            const mockAdapters = {
                fileSystem: {},
                config: {},
                git: {},
                shell: {}
            };
            ElectronPlatformAdapters.mockImplementation(() => mockAdapters);
            let capturedConfig;
            FileSystemModule.mockImplementation((config) => {
                capturedConfig = config;
                return {
                    loadFileSystemTree: jest.fn().mockResolvedValue({
                        fileSystemTree: mockFileTree,
                        filterLayers: []
                    })
                };
            });
            await loadLocalFileSystemTree({
                localPath: '/path/to/repo',
                owner: 'test-owner',
                repo: 'test-repo',
                includeVCS: true
            });
            expect(capturedConfig.versionControlLayerFactory).toBeDefined();
        });
        it('should handle file tree loading errors', async () => {
            ElectronPlatformAdapters.mockImplementation(() => ({
                fileSystem: {},
                config: {},
                git: {},
                shell: {}
            }));
            FileSystemModule.mockImplementation(() => ({
                loadFileSystemTree: jest.fn().mockResolvedValue({
                    fileSystemTree: null,
                    filterLayers: []
                })
            }));
            await expect(loadLocalFileSystemTree({
                localPath: '/path/to/repo',
                owner: 'test-owner',
                repo: 'test-repo'
            })).rejects.toThrow('Failed to load filesystem tree from /path/to/repo');
        });
        it('should calculate correct statistics', async () => {
            const complexTree = {
                name: 'root',
                type: 'directory',
                children: [
                    {
                        name: 'dir1',
                        type: 'directory',
                        children: [
                            {
                                name: 'dir2',
                                type: 'directory',
                                children: [
                                    { name: 'file1.ts', type: 'file', children: [] },
                                    { name: 'file2.ts', type: 'file', children: [] }
                                ]
                            },
                            { name: 'file3.ts', type: 'file', children: [] }
                        ]
                    },
                    { name: 'file4.ts', type: 'file', children: [] }
                ]
            };
            ElectronPlatformAdapters.mockImplementation(() => ({
                fileSystem: {},
                config: {},
                git: {},
                shell: {}
            }));
            FileSystemModule.mockImplementation(() => ({
                loadFileSystemTree: jest.fn().mockResolvedValue({
                    fileSystemTree: complexTree,
                    filterLayers: []
                })
            }));
            const result = await loadLocalFileSystemTree({
                localPath: '/path',
                owner: 'owner',
                repo: 'repo'
            });
            expect(result.stats.fileCount).toBe(4);
            expect(result.stats.directoryCount).toBe(3); // root, dir1, dir2
        });
    });
    describe('loadGitHubFileSystemTree', () => {
        const mockGitHubTree = {
            name: 'repo',
            type: 'directory',
            children: [
                {
                    name: 'README.md',
                    type: 'file',
                    children: []
                }
            ]
        };
        it('should load file tree from GitHub', async () => {
            const mockAdapters = {
                fileSystem: {
                    readDirectory: jest.fn().mockResolvedValue(['README.md']),
                    getStats: jest.fn().mockResolvedValue({ isDirectory: false, isFile: true })
                },
                config: {},
                git: {},
                github: {}
            };
            GitHubWebAdapters.mockImplementation(() => mockAdapters);
            const mockLoadFileSystemTree = jest.fn().mockResolvedValue({
                fileSystemTree: mockGitHubTree,
                filterLayers: []
            });
            FileSystemModule.mockImplementation(() => ({
                loadFileSystemTree: mockLoadFileSystemTree
            }));
            const result = await loadGitHubFileSystemTree({
                owner: 'test-owner',
                repo: 'test-repo',
                branch: 'main'
            });
            expect(result.fileTree).toEqual(mockGitHubTree);
            expect(result.stats).toEqual({
                fileCount: 1,
                directoryCount: 1
            });
            expect(GitHubWebAdapters).toHaveBeenCalledWith('test-owner', 'test-repo', 'main');
        });
        it('should handle GitHub API errors gracefully', async () => {
            GitHubWebAdapters.mockImplementation(() => {
                throw new Error('GitHub API rate limit exceeded');
            });
            await expect(loadGitHubFileSystemTree({
                owner: 'test-owner',
                repo: 'test-repo',
                branch: 'main'
            })).rejects.toThrow('GitHub API rate limit exceeded');
        });
        it('should cache adapter instances for same repository', async () => {
            const mockAdapters = {
                fileSystem: {},
                config: {},
                git: {},
                github: {}
            };
            GitHubWebAdapters.mockImplementation(() => mockAdapters);
            FileSystemModule.mockImplementation(() => ({
                loadFileSystemTree: jest.fn().mockResolvedValue({
                    fileSystemTree: mockGitHubTree,
                    filterLayers: []
                })
            }));
            // Load twice for the same repo
            await loadGitHubFileSystemTree({
                owner: 'test-owner',
                repo: 'test-repo',
                branch: 'main'
            });
            await loadGitHubFileSystemTree({
                owner: 'test-owner',
                repo: 'test-repo',
                branch: 'develop'
            });
            // Should create adapters twice (once for each branch)
            expect(GitHubWebAdapters).toHaveBeenCalledTimes(2);
        });
    });
    describe('legacy interface compatibility', () => {
        it('should support legacy local tree loading', async () => {
            const mockTree = {
                name: 'root',
                type: 'directory',
                children: []
            };
            ElectronPlatformAdapters.mockImplementation(() => ({
                fileSystem: {},
                config: {},
                git: {},
                shell: {}
            }));
            FileSystemModule.mockImplementation(() => ({
                loadFileSystemTree: jest.fn().mockResolvedValue({
                    fileSystemTree: mockTree,
                    filterLayers: []
                })
            }));
            // Use the legacy TreeLoadOptions interface
            const { loadFileSystemTree: loadTree } = await import('./loadFileSystemTree');
            const result = await loadTree({
                type: 'local',
                localPath: '/path/to/repo',
                owner: 'owner',
                repo: 'repo',
                includeVCS: false
            });
            expect(result.fileTree).toEqual(mockTree);
        });
        it('should support legacy GitHub tree loading', async () => {
            const mockTree = {
                name: 'repo',
                type: 'directory',
                children: []
            };
            GitHubWebAdapters.mockImplementation(() => ({
                fileSystem: {},
                config: {},
                git: {},
                github: {}
            }));
            FileSystemModule.mockImplementation(() => ({
                loadFileSystemTree: jest.fn().mockResolvedValue({
                    fileSystemTree: mockTree,
                    filterLayers: []
                })
            }));
            const { loadFileSystemTree: loadTree } = await import('./loadFileSystemTree');
            const result = await loadTree({
                type: 'github',
                owner: 'owner',
                repo: 'repo',
                branch: 'main'
            });
            expect(result.fileTree).toEqual(mockTree);
        });
    });
});
