/**
 * Tests for PackageProcessor
 */

import { PackageProcessor } from './PackageProcessor';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import * as fs from 'fs/promises';

// Mock fs/promises
jest.mock('fs/promises');

describe('PackageProcessor', () => {
  let processor: PackageProcessor;

  beforeEach(() => {
    processor = new PackageProcessor();
    jest.clearAllMocks();
  });

  describe('extractPackages', () => {
    it('should extract packages from a simple repository', async () => {
      // Mock FileTree
      const mockFileTree: FileTree = {
        sha: 'test-sha',
        root: {
          path: '/test/repo',
          name: 'repo',
          type: 'directory',
          directories: [],
          files: [
            {
              path: '/test/repo/package.json',
              name: 'package.json',
              type: 'file',
            },
          ],
        },
        allFiles: [
          {
            path: '/test/repo/package.json',
            name: 'package.json',
            type: 'file',
            relativePath: 'package.json',
          },
        ],
        allDirectories: [
          {
            path: '/test/repo',
            name: 'repo',
            type: 'directory',
            relativePath: '',
          },
        ],
        stats: {
          totalFiles: 1,
          totalDirectories: 1,
          totalSize: 100,
          maxDepth: 1,
        },
      };

      // Mock package.json content
      const mockPackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.0',
        },
        devDependencies: {
          'jest': '^29.0.0',
        },
        scripts: {
          'test': 'jest',
          'build': 'tsc',
        },
      };

      // Mock fs.readFile
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPackageJson));

      const packages = await processor.extractPackages(mockFileTree, '/test/repo');

      // Should find at least one package
      expect(packages.length).toBeGreaterThan(0);

      // Check the root package was found
      const rootPackage = packages.find(p => p.packageData.path === '');
      expect(rootPackage).toBeDefined();

      if (rootPackage) {
        expect(rootPackage.packageData.name).toBe('test-package');
        expect(rootPackage.packageData.dependencies).toHaveProperty('express');
        expect(rootPackage.packageData.devDependencies).toHaveProperty('jest');
      }
    });

    it('should handle monorepo with multiple packages', async () => {
      // Mock FileTree for monorepo
      const mockFileTree: FileTree = {
        sha: 'monorepo-sha',
        root: {
          path: '/test/monorepo',
          name: 'monorepo',
          type: 'directory',
          directories: [
            {
              path: '/test/monorepo/packages',
              name: 'packages',
              type: 'directory',
              directories: [
                {
                  path: '/test/monorepo/packages/ui',
                  name: 'ui',
                  type: 'directory',
                  files: [],
                  directories: [],
                },
                {
                  path: '/test/monorepo/packages/api',
                  name: 'api',
                  type: 'directory',
                  files: [],
                  directories: [],
                },
              ],
              files: [],
            },
          ],
          files: [
            {
              path: '/test/monorepo/package.json',
              name: 'package.json',
              type: 'file',
            },
          ],
        },
        allFiles: [
          {
            path: '/test/monorepo/package.json',
            name: 'package.json',
            type: 'file',
            relativePath: 'package.json',
          },
          {
            path: '/test/monorepo/packages/ui/package.json',
            name: 'package.json',
            type: 'file',
            relativePath: 'packages/ui/package.json',
          },
          {
            path: '/test/monorepo/packages/api/package.json',
            name: 'package.json',
            type: 'file',
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
      };

      // Mock different package.json contents
      (fs.readFile as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('packages/ui')) {
          return Promise.resolve(JSON.stringify({
            name: '@monorepo/ui',
            version: '1.0.0',
            dependencies: { 'react': '^18.0.0' },
          }));
        }
        if (path.includes('packages/api')) {
          return Promise.resolve(JSON.stringify({
            name: '@monorepo/api',
            version: '1.0.0',
            dependencies: { 'express': '^4.18.0' },
          }));
        }
        // Root package.json
        return Promise.resolve(JSON.stringify({
          name: 'monorepo-root',
          version: '1.0.0',
          workspaces: ['packages/*'],
        }));
      });

      const packages = await processor.extractPackages(mockFileTree, '/test/monorepo');

      // Should find multiple packages
      expect(packages.length).toBeGreaterThan(1);
    });
  });

  describe('getPackageSummary', () => {
    it('should generate summary for single package', async () => {
      const mockPackages: PackageLayer[] = [
        {
          id: 'pkg1',
          name: 'Test Package',
          type: 'package',
          enabled: true,
          packageData: {
            name: 'test-package',
            version: '1.0.0',
            path: '',
            packageManager: 'npm',
            dependencies: {
              'express': '^4.18.0',
              'lodash': '^4.17.21',
            },
            devDependencies: {
              'jest': '^29.0.0',
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
      const mockPackages: PackageLayer[] = [
        {
          id: 'root',
          name: 'Root',
          type: 'package',
          enabled: true,
          packageData: {
            name: 'monorepo-root',
            path: '',
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
            packageManager: 'npm',
            dependencies: {
              'react': '^18.0.0',
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