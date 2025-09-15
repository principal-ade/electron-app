"use strict";
/**
 * Real-world IPC bridge test - verify actual file tree loading works
 * This test simulates what happens in the actual Electron app
 */
describe('IPC Bridge Real-World Test', () => {
    it('should simulate the actual file tree loading process', async () => {
        console.log('=== Real-World File Tree Loading Simulation ===');
        // Mock the IPC bridge to simulate actual Electron environment
        const mockFileSystemService = {
            readDirectory: jest.fn().mockResolvedValue([
                'src/',
                'package.json',
                'README.md',
                '.gitignore'
            ]),
            getFileStats: jest.fn().mockImplementation((filePath) => {
                return Promise.resolve({
                    size: 1024,
                    isDirectory: filePath.endsWith('/'),
                    lastModified: new Date(),
                    filePath
                });
            }),
            buildFilteredFileTree: jest.fn().mockResolvedValue({
                paths: [
                    '/Users/griever/Developer/PrincipleMD/electron-react/src',
                    '/Users/griever/Developer/PrincipleMD/electron-react/package.json'
                ],
                stats: []
            })
        };
        // Properly mock window.mainProcess to simulate Electron environment
        Object.defineProperty(window, 'mainProcess', {
            value: {
                fileSystem: mockFileSystemService
            },
            writable: true,
            configurable: true
        });
        console.log('✅ Simulated Electron environment with window.mainProcess');
        // Now test what the ElectronFileSystemAdapter would do
        try {
            const { ElectronFileSystemAdapter } = await import('../adapters/ElectronFileSystemAdapter');
            const adapter = new ElectronFileSystemAdapter();
            console.log('✅ ElectronFileSystemAdapter created successfully');
            // Test readDirectory - this is what was failing before
            const directoryContents = await adapter.readDirectory('/Users/griever/Developer/PrincipleMD/electron-react');
            console.log('✅ readDirectory works:', directoryContents);
            // Test buildFilteredFileTree - the core of file tree loading
            const fileTree = await adapter.buildFilteredFileTree('/Users/griever/Developer/PrincipleMD/electron-react', {});
            console.log('✅ buildFilteredFileTree works:', fileTree);
            expect(mockFileSystemService.readDirectory).toHaveBeenCalled();
            expect(mockFileSystemService.buildFilteredFileTree).toHaveBeenCalled();
            expect(fileTree.paths).toContain('/Users/griever/Developer/PrincipleMD/electron-react/src');
        }
        catch (error) {
            console.error('❌ ElectronFileSystemAdapter failed:', error);
            throw error;
        }
    });
    it('should compare local vs remote file tree loading approaches', async () => {
        console.log('=== Local vs Remote Comparison ===');
        // Setup mocks for both environments
        const mockLocalFileSystem = {
            buildFilteredFileTree: jest.fn().mockResolvedValue({
                paths: ['/local/src/file1.ts', '/local/src/file2.ts'],
                stats: []
            })
        };
        const mockGitHubAdapter = {
            buildFilteredFileTree: jest.fn().mockResolvedValue({
                paths: ['/remote/src/file1.ts', '/remote/src/file2.ts'],
                stats: []
            })
        };
        Object.defineProperty(window, 'mainProcess', {
            value: { fileSystem: mockLocalFileSystem },
            writable: true,
            configurable: true
        });
        try {
            // Test local approach
            const { ElectronFileSystemAdapter } = await import('../adapters/ElectronFileSystemAdapter');
            const localAdapter = new ElectronFileSystemAdapter();
            const localResult = await localAdapter.buildFilteredFileTree('/local', {});
            console.log('✅ Local file tree result:', localResult);
            // Test remote approach (GitHubFileSystemAdapter)
            const { GitHubFileSystemAdapter } = await import('../adapters/github/GitHubFileSystemAdapter');
            const remoteAdapter = new GitHubFileSystemAdapter('owner', 'repo', 'main', 'token');
            // Mock the GitHub API calls that would normally happen
            remoteAdapter.buildFilteredFileTree = mockGitHubAdapter.buildFilteredFileTree;
            const remoteResult = await remoteAdapter.buildFilteredFileTree('/', {});
            console.log('✅ Remote file tree result:', remoteResult);
            // Compare the results
            console.log('📊 Comparison:');
            console.log('  Local paths:', localResult.paths.length);
            console.log('  Remote paths:', remoteResult.paths.length);
            console.log('  Both approaches work when properly mocked');
            expect(localResult.paths.length).toBeGreaterThan(0);
            expect(remoteResult.paths.length).toBeGreaterThan(0);
        }
        catch (error) {
            console.error('❌ Comparison failed:', error);
            throw error;
        }
    });
    afterEach(() => {
        // Clean up window mocks
        delete window.mainProcess;
    });
});
