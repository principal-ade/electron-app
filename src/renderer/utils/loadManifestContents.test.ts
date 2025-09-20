// @ts-nocheck
const { loadManifestContents } = require('./loadManifestContents');

// Mock the module
jest.mock('@principal-ai/codebase-composition', () => ({
  FileSystemTree: jest.fn(),
  PackageLayerModule: jest.fn().mockImplementation(() => ({
    parsers: []
  }))
}));

describe('loadManifestContents', () => {
  let mockFileSystemAdapter: any;
  let mockFileSystemTree: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock file system adapter
    mockFileSystemAdapter = {
      readFile: jest.fn(),
    };

    // Mock file system tree
    mockFileSystemTree = {
      allFiles: [],
      directoriesWithFiles: new Map(),
      rootPath: '/test',
    } as FileSystemTree;
  });

  describe('package.json filtering', () => {
    it('should exclude config-only package.json files with just "type"', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: '.erb/package.json' },
        { path: 'package.json' },
      ];

      mockFileSystemAdapter.readFile
        .mockResolvedValueOnce({
          content: JSON.stringify({ type: 'commonjs' }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            name: 'my-app',
            version: '1.0.0',
            type: 'module',
          }),
        });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('package.json')).toBe(true);
      expect(result.has('.erb/package.json')).toBe(false);

      const mainPackage = result.get('package.json');
      expect(mainPackage).toEqual({
        name: 'my-app',
        version: '1.0.0',
        type: 'module',
      });
    });

    it('should exclude config-only package.json with "type" and "private"', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'config/package.json' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: JSON.stringify({ type: 'module', private: true }),
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(0);
    });

    it('should include package.json with name but no version', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'package.json' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: JSON.stringify({ name: 'my-package', type: 'commonjs' }),
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('package.json')).toBe(true);

      const pkg = result.get('package.json');
      expect(pkg.name).toBe('my-package');
    });

    it('should include package.json with version but no name', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'package.json' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: JSON.stringify({ version: '0.1.0', type: 'commonjs' }),
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('package.json')).toBe(true);

      const pkg = result.get('package.json');
      expect(pkg.version).toBe('0.1.0');
    });

    it('should include package.json with dependencies only', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'package.json' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: JSON.stringify({
          dependencies: {
            'react': '^18.0.0',
          },
        }),
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('package.json')).toBe(true);

      const pkg = result.get('package.json');
      expect(pkg.dependencies).toEqual({ react: '^18.0.0' });
    });

    it('should include package.json with scripts only', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'package.json' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: JSON.stringify({
          scripts: {
            'test': 'vitest',
          },
        }),
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('package.json')).toBe(true);

      const pkg = result.get('package.json');
      expect(pkg.scripts).toEqual({ test: 'vitest' });
    });

    it('should handle invalid JSON gracefully', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'package.json' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: 'not valid json',
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('package.json')).toBe(true);

      // Should return raw content when JSON parsing fails
      const content = result.get('package.json');
      expect(content).toBe('not valid json');
    });

    it('should create fallback for package.json when file cannot be read', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'my-app/package.json' },
      ];

      mockFileSystemAdapter.readFile.mockRejectedValueOnce(
        new Error('File not found'),
      );

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('my-app/package.json')).toBe(true);

      // Should create fallback with directory name
      const fallback = result.get('my-app/package.json');
      expect(fallback).toEqual({
        name: 'my-app',
        version: '0.0.0',
        dependencies: {},
        devDependencies: {},
      });
    });
  });

  describe('other manifest files', () => {
    it('should process pyproject.toml files', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'pyproject.toml' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: '[project]\nname = "my-python-app"\nversion = "1.0.0"',
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('pyproject.toml')).toBe(true);

      const manifest = result.get('pyproject.toml');
      expect(manifest.project).toEqual({
        name: 'my-python-app',
        version: '1.0.0',
      });
    });

    it('should process Cargo.toml files', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'Cargo.toml' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: '[package]\nname = "my-rust-app"\nversion = "0.1.0"',
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('Cargo.toml')).toBe(true);

      const manifest = result.get('Cargo.toml');
      expect(manifest.package).toEqual({
        name: 'my-rust-app',
        version: '0.1.0',
      });
    });

    it('should process requirements.txt files', async () => {
      // Arrange
      mockFileSystemTree.allFiles = [
        { path: 'requirements.txt' },
      ];

      mockFileSystemAdapter.readFile.mockResolvedValueOnce({
        content: 'django==4.2.0\nrequests>=2.28.0',
      });

      // Act
      const result = await loadManifestContents({
        fileSystemTree: mockFileSystemTree,
        fileSystemAdapter: mockFileSystemAdapter,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has('requirements.txt')).toBe(true);

      const content = result.get('requirements.txt');
      expect(content).toBe('django==4.2.0\nrequests>=2.28.0');
    });
  });
});