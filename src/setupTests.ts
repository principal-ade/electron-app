// Jest setup file for testing
// This file is run before all tests

// Mock ES module dependencies that cause issues with Jest
jest.mock('globby', () => ({
  globby: jest.fn().mockResolvedValue([]),
  globbySync: jest.fn().mockReturnValue([]),
}));

jest.mock('@principal-ai/repository-abstraction', () => ({
  GitFileTreeBuilder: class {
    build = jest.fn().mockReturnValue({
      sha: 'mock-sha',
      metadata: {},
      root: {},
      allFiles: [],
      allDirectories: [],
      stats: {},
    });
  },
  FileTree: {},
  GitSource: {},
}));

export {};
