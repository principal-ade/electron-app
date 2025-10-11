/**
 * Tests for PackageProcessor
 */
import { PackageProcessor } from './PackageProcessor';
import * as fs from 'fs/promises';
// Mock fs/promises
jest.mock('fs/promises');
describe('PackageProcessor', () => {
  let processor;
  beforeEach(() => {
    processor = new PackageProcessor();
    jest.clearAllMocks();
  });
  describe('extractPackages', () => {
    it('should extract packages from a simple repository', async () => {
      // Mock FileTree
      const mockFileTree = {
        sha: 'test-sha',
        root: {
          path: '/test/repo',
          name: 'repo',
          children: [
            {
              path: '/test/repo/package.json',
              name: 'package.json',
              extension: '.json',
              size: 100,
              lastModified: new Date(),
              isDirectory: false,
              relativePath: 'package.json',
            },
          ],
          fileCount: 1,
          totalSize: 100,
          depth: 0,
          relativePath: '',
        },
        allFiles: [
          {
            path: '/test/repo/package.json',
            name: 'package.json',
            extension: '.json',
            size: 100,
            lastModified: new Date(),
            isDirectory: false,
            relativePath: 'package.json',
          },
        ],
        allDirectories: [
          {
            path: '/test/repo',
            name: 'repo',
            children: [],
            fileCount: 1,
            totalSize: 100,
            depth: 0,
            relativePath: '',
          },
        ],
        stats: {
          totalFiles: 1,
          totalDirectories: 1,
          totalSize: 100,
          maxDepth: 1,
        },
        metadata: {
          id: 'test-id',
          timestamp: new Date(),
          sourceType: 'test',
          sourceInfo: {},
        },
      };
      // Mock package.json content
      const mockPackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
        },
        devDependencies: {
          jest: '^29.0.0',
        },
        scripts: {
          test: 'jest',
          build: 'tsc',
        },
      };
      // Mock fs.readFile
      fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      const packages = await processor.extractPackages(
        mockFileTree,
        '/test/repo',
      );
      // Should find at least one package
      expect(packages.length).toBeGreaterThan(0);
      // Check the root package was found
      const rootPackage = packages.find((p) => p.packageData.path === '');
      expect(rootPackage).toBeDefined();
      if (rootPackage) {
        expect(rootPackage.packageData.name).toBe('test-package');
        expect(rootPackage.packageData.dependencies).toHaveProperty('express');
        expect(rootPackage.packageData.devDependencies).toHaveProperty('jest');
      }
    });
    it('should handle monorepo with multiple packages', async () => {
      // Mock FileTree for monorepo
      const mockFileTree = {
        sha: 'monorepo-sha',
        root: {
          path: '/test/monorepo',
          name: 'monorepo',
          children: [
            {
              path: '/test/monorepo/packages',
              name: 'packages',
              children: [
                {
                  path: '/test/monorepo/packages/ui',
                  name: 'ui',
                  children: [
                    {
                      path: '/test/monorepo/packages/ui/package.json',
                      name: 'package.json',
                      extension: '.json',
                      size: 100,
                      lastModified: new Date(),
                      isDirectory: false,
                      relativePath: 'packages/ui/package.json',
                    },
                  ],
                  fileCount: 1,
                  totalSize: 100,
                  depth: 2,
                  relativePath: 'packages/ui',
                },
                {
                  path: '/test/monorepo/packages/api',
                  name: 'api',
                  children: [
                    {
                      path: '/test/monorepo/packages/api/package.json',
                      name: 'package.json',
                      extension: '.json',
                      size: 100,
                      lastModified: new Date(),
                      isDirectory: false,
                      relativePath: 'packages/api/package.json',
                    },
                  ],
                  fileCount: 1,
                  totalSize: 100,
                  depth: 2,
                  relativePath: 'packages/api',
                },
              ],
              fileCount: 2,
              totalSize: 200,
              depth: 1,
              relativePath: 'packages',
            },
            {
              path: '/test/monorepo/package.json',
              name: 'package.json',
              extension: '.json',
              size: 100,
              lastModified: new Date(),
              isDirectory: false,
              relativePath: 'package.json',
            },
          ],
          fileCount: 3,
          totalSize: 300,
          depth: 0,
          relativePath: '',
        },
        allFiles: [
          {
            path: '/test/monorepo/package.json',
            name: 'package.json',
            extension: '.json',
            size: 100,
            lastModified: new Date(),
            isDirectory: false,
            relativePath: 'package.json',
          },
          {
            path: '/test/monorepo/packages/ui/package.json',
            name: 'package.json',
            extension: '.json',
            size: 100,
            lastModified: new Date(),
            isDirectory: false,
            relativePath: 'packages/ui/package.json',
          },
          {
            path: '/test/monorepo/packages/api/package.json',
            name: 'package.json',
            extension: '.json',
            size: 100,
            lastModified: new Date(),
            isDirectory: false,
            relativePath: 'packages/api/package.json',
          },
        ],
        allDirectories: [],
        stats: {
          totalFiles: 3,
          totalDirectories: 4,
          totalSize: 300,
          maxDepth: 3,
        },
        metadata: {
          id: 'monorepo-id',
          timestamp: new Date(),
          sourceType: 'test',
          sourceInfo: {},
        },
      };
      // Mock different package.json contents
      fs.readFile.mockImplementation((path) => {
        if (path.includes('packages/ui')) {
          return Promise.resolve(
            JSON.stringify({
              name: '@monorepo/ui',
              version: '1.0.0',
              dependencies: { react: '^18.0.0' },
            }),
          );
        }
        if (path.includes('packages/api')) {
          return Promise.resolve(
            JSON.stringify({
              name: '@monorepo/api',
              version: '1.0.0',
              dependencies: { express: '^4.18.0' },
            }),
          );
        }
        // Root package.json
        return Promise.resolve(
          JSON.stringify({
            name: 'monorepo-root',
            version: '1.0.0',
            workspaces: ['packages/*'],
          }),
        );
      });
      const packages = await processor.extractPackages(
        mockFileTree,
        '/test/monorepo',
      );
      // Should find multiple packages
      expect(packages.length).toBeGreaterThan(1);
    });
  });
  describe('getPackageSummary', () => {
    it('should generate summary for single package', async () => {
      const mockPackages = [
        {
          id: 'pkg1',
          name: 'Test Package',
          type: 'package',
          enabled: true,
          packageData: {
            name: 'test-package',
            version: '1.0.0',
            path: '',
            manifestPath: '/test/repo/package.json',
            packageManager: 'npm',
            dependencies: {
              express: '^4.18.0',
              lodash: '^4.17.21',
            },
            devDependencies: {
              jest: '^29.0.0',
            },
            peerDependencies: {},
            isMonorepoRoot: false,
            isWorkspace: false,
            availableCommands: [
              { name: 'test', command: 'jest', type: 'script' },
              { name: 'build', command: 'tsc', type: 'script' },
            ],
          },
          derivedFrom: {
            fileSets: [],
            derivationType: 'presence',
            description: 'Package from package.json',
          },
        },
      ];
      const summary = await processor.getPackageSummary(mockPackages);
      expect(summary.isMonorepo).toBe(false);
      expect(summary.rootPackageName).toBe('test-package');
      expect(summary.totalPackages).toBe(1);
      expect(summary.workspacePackages).toHaveLength(0);
      expect(summary.totalDependencies).toBe(2);
      expect(summary.totalDevDependencies).toBe(1);
      expect(summary.availableScripts).toContain('test');
      expect(summary.availableScripts).toContain('build');
    });
    it('should detect monorepo', async () => {
      const mockPackages = [
        {
          id: 'root',
          name: 'Root',
          type: 'package',
          enabled: true,
          packageData: {
            name: 'monorepo-root',
            path: '',
            manifestPath: '/test/monorepo/package.json',
            packageManager: 'npm',
            dependencies: {},
            devDependencies: {},
            peerDependencies: {},
            isMonorepoRoot: true,
            isWorkspace: false,
          },
          derivedFrom: {
            fileSets: [],
            derivationType: 'presence',
            description: 'Root package',
          },
        },
        {
          id: 'ui',
          name: 'UI Package',
          type: 'package',
          enabled: true,
          packageData: {
            name: '@monorepo/ui',
            path: 'packages/ui',
            manifestPath: '/test/monorepo/packages/ui/package.json',
            packageManager: 'npm',
            dependencies: {
              react: '^18.0.0',
            },
            devDependencies: {},
            peerDependencies: {},
            isMonorepoRoot: false,
            isWorkspace: true,
          },
          derivedFrom: {
            fileSets: [],
            derivationType: 'presence',
            description: 'UI package',
          },
        },
      ];
      const summary = await processor.getPackageSummary(mockPackages);
      expect(summary.isMonorepo).toBe(true);
      expect(summary.workspacePackages).toHaveLength(1);
      expect(summary.workspacePackages[0].name).toBe('@monorepo/ui');
      expect(summary.workspacePackages[0].path).toBe('packages/ui');
    });
  });
});
