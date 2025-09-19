/**
 * Tests for file system handlers - especially the critical filtering logic
 */
import { ElectronFileSystemAdapter as FileSystemHandlerService } from './fileSystemHandlers';
import fs from 'fs';
import path from 'path';
// Mock the imports
jest.mock('fdir');
jest.mock('ignore');
jest.mock('fs');
describe('FileSystemHandlerService', () => {
  let service;
  beforeEach(() => {
    service = new FileSystemHandlerService();
  });
  describe('buildFilteredFileTree', () => {
    it('should properly filter out node_modules directories', async () => {
      const mockFdir = {
        withPathSeparator: jest.fn().mockReturnThis(),
        withRelativePaths: jest.fn().mockReturnThis(),
        withDirs: jest.fn().mockReturnThis(),
        withFullPaths: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        crawl: jest.fn().mockReturnThis(),
        withPromise: jest.fn().mockResolvedValue([
          '/test/src/file.js',
          '/test/package.json',
          '/test/node_modules/package/file.js', // This should be filtered out
          '/test/dist/build.js', // This should be filtered out
          '/test/.git/config', // This should be filtered out
        ]),
      };
      const mockIgnore = {
        add: jest.fn(),
        ignores: jest.fn((path) => {
          // Simulate gitignore behavior
          return (
            path.includes('node_modules') ||
            path.includes('dist/') ||
            path.includes('.git')
          );
        }),
      };
      // Mock imports
      const { fdir } = require('fdir');
      const ignore = require('ignore');
      fdir.mockImplementation(() => mockFdir);
      ignore.default.mockReturnValue(mockIgnore);
      // Mock fs.promises.stat
      const mockStat = jest.fn().mockImplementation((filePath) => ({
        size: 1024,
        isDirectory: () =>
          filePath.includes('node_modules') || filePath.includes('src'),
        mtime: new Date('2023-01-01'),
      }));
      fs.promises.stat = mockStat;
      const patterns = ['node_modules/', 'dist/', '.git'];
      const result = await service.buildFilteredFileTree('/test', patterns);
      // Check that filter was called with the right patterns
      expect(mockIgnore.add).toHaveBeenCalledWith(patterns);
      expect(mockFdir.filter).toHaveBeenCalled();
      // The filter function should have been used
      const filterFn = mockFdir.filter.mock.calls[0][0];
      // Test the filter function directly
      expect(filterFn('/test/src/file.js')).toBe(true); // Should include
      expect(filterFn('/test/node_modules/package/file.js')).toBe(false); // Should exclude
      expect(filterFn('/test/dist/build.js')).toBe(false); // Should exclude
    });
    it('should handle relative path conversion correctly', async () => {
      const mockFdir = {
        withPathSeparator: jest.fn().mockReturnThis(),
        withRelativePaths: jest.fn().mockReturnThis(),
        withDirs: jest.fn().mockReturnThis(),
        withFullPaths: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        crawl: jest.fn().mockReturnThis(),
        withPromise: jest
          .fn()
          .mockResolvedValue(['/test/src/file.js', '/test/package.json']),
      };
      const mockIgnore = {
        add: jest.fn(),
        ignores: jest.fn().mockReturnValue(false), // Don't ignore anything for this test
      };
      const { fdir } = require('fdir');
      const ignore = require('ignore');
      fdir.mockImplementation(() => mockFdir);
      ignore.default.mockReturnValue(mockIgnore);
      // Mock fs.promises.stat
      const mockStat = jest.fn().mockImplementation((filePath) => ({
        size: 1024,
        isDirectory: () => false,
        mtime: new Date('2023-01-01'),
      }));
      fs.promises.stat = mockStat;
      const result = await service.buildFilteredFileTree('/test', []);
      // Should return relative paths
      expect(result.paths).toContain('src/file.js');
      expect(result.paths).toContain('package.json');
      expect(result.paths).not.toContain('/test/src/file.js'); // No absolute paths
    });
    it('should handle sourceDirectory scoping correctly', async () => {
      const mockFdir = {
        withPathSeparator: jest.fn().mockReturnThis(),
        withRelativePaths: jest.fn().mockReturnThis(),
        withDirs: jest.fn().mockReturnThis(),
        withFullPaths: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        crawl: jest.fn().mockReturnThis(),
        withPromise: jest
          .fn()
          .mockResolvedValue(['/test/src/file.js', '/test/docs/readme.md']),
      };
      const mockIgnore = {
        add: jest.fn(),
        ignores: jest.fn().mockReturnValue(false),
      };
      const { fdir } = require('fdir');
      const ignore = require('ignore');
      fdir.mockImplementation(() => mockFdir);
      ignore.default.mockReturnValue(mockIgnore);
      const mockStat = jest.fn().mockImplementation(() => ({
        size: 1024,
        isDirectory: () => false,
        mtime: new Date('2023-01-01'),
      }));
      fs.promises.stat = mockStat;
      const patterns = ['docs/'];
      const result = await service.buildFilteredFileTree(
        '/test',
        patterns,
        'src',
      );
      // Get the filter function that was passed to fdir
      const filterFn = mockFdir.filter.mock.calls[0][0];
      // Test that files outside sourceDirectory are included (not filtered)
      expect(filterFn('/test/docs/readme.md')).toBe(true); // Outside 'src' scope, so included
      expect(filterFn('/test/src/file.js')).toBe(true); // Inside 'src' scope, should be processed normally
    });
    it('should handle errors gracefully and continue processing', async () => {
      const mockFdir = {
        withPathSeparator: jest.fn().mockReturnThis(),
        withRelativePaths: jest.fn().mockReturnThis(),
        withDirs: jest.fn().mockReturnThis(),
        withFullPaths: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        crawl: jest.fn().mockReturnThis(),
        withPromise: jest.fn().mockResolvedValue([
          '/test/good-file.js',
          '.alexandria/', // This will cause a stat error (relative path)
          '/test/another-good-file.js',
        ]),
      };
      const { fdir } = require('fdir');
      fdir.mockImplementation(() => mockFdir);
      // Mock fs.promises.stat to fail on relative paths
      const mockStat = jest.fn().mockImplementation((filePath) => {
        if (!path.isAbsolute(filePath)) {
          const error = new Error('ENOENT: no such file or directory');
          error.code = 'ENOENT';
          throw error;
        }
        return {
          size: 1024,
          isDirectory: () => false,
          mtime: new Date('2023-01-01'),
        };
      });
      fs.promises.stat = mockStat;
      const result = await service.buildFilteredFileTree('/test', []);
      // Should still return results for good files, skipping the problematic one
      expect(result.paths).toContain('good-file.js');
      expect(result.paths).toContain('another-good-file.js');
      expect(result.paths).not.toContain('.alexandria/'); // Should be skipped due to error
    });
    it('should return empty result when directory crawl fails completely', async () => {
      const mockFdir = {
        withPathSeparator: jest.fn().mockReturnThis(),
        withRelativePaths: jest.fn().mockReturnThis(),
        withDirs: jest.fn().mockReturnThis(),
        withFullPaths: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        crawl: jest.fn().mockReturnThis(),
        withPromise: jest
          .fn()
          .mockRejectedValue(new Error('Permission denied')),
      };
      const { fdir } = require('fdir');
      fdir.mockImplementation(() => mockFdir);
      const result = await service.buildFilteredFileTree('/test', []);
      expect(result.paths).toEqual([]);
      expect(result.stats).toBeUndefined();
    });
    it('should add trailing slashes to directory paths', async () => {
      const mockFdir = {
        withPathSeparator: jest.fn().mockReturnThis(),
        withRelativePaths: jest.fn().mockReturnThis(),
        withDirs: jest.fn().mockReturnThis(),
        withFullPaths: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        crawl: jest.fn().mockReturnThis(),
        withPromise: jest
          .fn()
          .mockResolvedValue(['/test/src', '/test/file.js']),
      };
      const { fdir } = require('fdir');
      fdir.mockImplementation(() => mockFdir);
      // Mock fs.promises.stat to return directory for 'src', file for 'file.js'
      const mockStat = jest.fn().mockImplementation((filePath) => ({
        size: filePath.includes('src') ? 0 : 1024,
        isDirectory: () => filePath.includes('src'),
        mtime: new Date('2023-01-01'),
      }));
      fs.promises.stat = mockStat;
      const result = await service.buildFilteredFileTree('/test', []);
      expect(result.paths).toContain('src/'); // Directory with trailing slash
      expect(result.paths).toContain('file.js'); // File without trailing slash
    });
  });
});
