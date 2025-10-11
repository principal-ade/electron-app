import { FileTreeSourceService } from './FileTreeSourceService';
import { MonitoredFileTreeService } from './MonitoredFileTreeService';
import { CloneVisibilityService } from './CloneVisibilityService';
import { createFileTreeSource } from '../types/file-tree-source';
// Mock dependencies
jest.mock('./MonitoredFileTreeService');
jest.mock('./CloneVisibilityService');
jest.mock('../utils/loadFileSystemTree');
describe('FileTreeSourceService', () => {
  let service;
  let mockCacheService;
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheService = new MonitoredFileTreeService();
    service = new FileTreeSourceService(mockCacheService);
  });
  describe('initializeFromRepository', () => {
    const mockRepository = {
      id: 'repo-123',
      name: 'test-repo',
      owner: 'test-owner',
      remoteUrl: 'https://github.com/test-owner/test-repo.git',
      localClones: [
        {
          path: '/path/to/clone1',
          currentBranch: 'main',
          lastAccessed: new Date('2024-01-01'),
          isActive: true,
        },
        {
          path: '/path/to/clone2',
          currentBranch: 'develop',
          lastAccessed: new Date('2024-01-02'),
          isActive: false,
        },
      ],
      metadata: {
        defaultBranch: 'main',
        description: 'Test repository',
        language: 'TypeScript',
        stars: 100,
        forks: 10,
        openIssues: 5,
        lastUpdated: new Date('2024-01-01'),
      },
    };
    it('should create source for visible clone only by default', () => {
      // Mock visible clone selection
      jest
        .spyOn(CloneVisibilityService, 'getVisibleClonePath')
        .mockReturnValue('/path/to/clone1');
      const sources = service.initializeFromRepository(mockRepository);
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('local');
      expect(sources[0].location).toBe('/path/to/clone1');
      expect(sources[0].isDefault).toBe(true);
    });
    it('should create remote source when loadRemoteHead option is true', () => {
      jest
        .spyOn(CloneVisibilityService, 'getVisibleClonePath')
        .mockReturnValue('/path/to/clone1');
      const sources = service.initializeFromRepository(mockRepository, {
        loadRemoteHead: true,
      });
      expect(sources).toHaveLength(2);
      expect(sources[0].type).toBe('local');
      expect(sources[1].type).toBe('remote');
      expect(sources[1].location).toBe('main'); // default branch
    });
    it('should handle repository with no local clones', () => {
      const repoWithoutClones = {
        ...mockRepository,
        localClones: [],
      };
      const sources = service.initializeFromRepository(repoWithoutClones, {
        loadRemoteHead: true,
      });
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('remote');
      expect(sources[0].isDefault).toBe(true);
    });
    it('should prefetch trees for non-temporary sources', () => {
      jest
        .spyOn(CloneVisibilityService, 'getVisibleClonePath')
        .mockReturnValue('/path/to/clone1');
      mockCacheService.prefetchTrees = jest.fn();
      service.initializeFromRepository(mockRepository);
      expect(mockCacheService.prefetchTrees).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'local',
            isTemporary: false,
          }),
        ]),
      );
    });
  });
  describe('loadSourceTree', () => {
    it('should load tree from cache service', async () => {
      const mockSource = createFileTreeSource.localWorkingCopy(
        '/path/to/repo',
        'owner',
        'repo',
        'https://github.com/owner/repo.git',
        'main',
      );
      const mockLoadedTree = {
        source: mockSource,
        tree: {
          name: 'root',
          type: 'directory',
          children: [],
        },
        stats: {
          fileCount: 10,
          directoryCount: 5,
        },
      };
      service.addSource(mockSource);
      mockCacheService.loadFileTree = jest
        .fn()
        .mockResolvedValue(mockLoadedTree);
      const result = await service.loadSourceTree(mockSource.id);
      expect(mockCacheService.loadFileTree).toHaveBeenCalledWith(mockSource);
      expect(result).toEqual(mockLoadedTree);
    });
    it('should return null for non-existent source', async () => {
      const result = await service.loadSourceTree('non-existent-id');
      expect(result).toBeNull();
      expect(mockCacheService.loadFileTree).not.toHaveBeenCalled();
    });
  });
  describe('source management', () => {
    const mockSource = createFileTreeSource.localWorkingCopy(
      '/path/to/repo',
      'owner',
      'repo',
      'https://github.com/owner/repo.git',
      'main',
    );
    it('should add and retrieve sources', () => {
      service.addSource(mockSource);
      const retrieved = service.getSource(mockSource.id);
      expect(retrieved).toEqual(mockSource);
      const allSources = service.getAllSources();
      expect(allSources).toContain(mockSource);
    });
    it('should remove sources and invalidate cache', () => {
      mockCacheService.invalidateSource = jest.fn();
      service.addSource(mockSource);
      service.setActiveSource(mockSource.id);
      service.removeSource(mockSource.id);
      expect(service.getSource(mockSource.id)).toBeUndefined();
      expect(mockCacheService.invalidateSource).toHaveBeenCalledWith(
        mockSource.id,
      );
      expect(service.getActiveSource()).toBeNull();
    });
    it('should set and get active source', () => {
      service.addSource(mockSource);
      service.setActiveSource(mockSource.id);
      const active = service.getActiveSource();
      expect(active).toEqual(mockSource);
      expect(active?.lastAccessed).toBeDefined();
    });
    it('should filter sources by type', () => {
      const localSource = createFileTreeSource.localWorkingCopy(
        '/local/path',
        'owner',
        'repo',
        'url',
        'main',
      );
      const remoteSource = createFileTreeSource.remoteBranch(
        'owner',
        'repo',
        'url',
        'main',
      );
      service.addSource(localSource);
      service.addSource(remoteSource);
      const localSources = service.getSourcesByType('local');
      expect(localSources).toHaveLength(1);
      expect(localSources[0]).toEqual(localSource);
      const remoteSources = service.getSourcesByType('remote');
      expect(remoteSources).toHaveLength(1);
      expect(remoteSources[0]).toEqual(remoteSource);
    });
  });
  describe('package detection', () => {
    it('should detect packages for a source', async () => {
      const mockSource = createFileTreeSource.localWorkingCopy(
        '/path/to/repo',
        'owner',
        'repo',
        'https://github.com/owner/repo.git',
        'main',
      );
      const mockTree = {
        name: 'root',
        type: 'directory',
        children: [
          {
            name: 'package.json',
            type: 'file',
            children: [],
          },
        ],
      };
      const mockPackages = [
        {
          name: 'test-package',
          path: '/',
          version: '1.0.0',
        },
      ];
      service.addSource(mockSource);
      mockCacheService.loadFileTree = jest.fn().mockResolvedValue({
        source: mockSource,
        tree: mockTree,
        stats: { fileCount: 1, directoryCount: 0 },
      });
      mockCacheService.getAnalysis = jest.fn().mockReturnValue(null);
      mockCacheService.setAnalysis = jest.fn();
      // Mock the detectPackages method
      const detectPackagesSpy = jest
        .spyOn(service, 'detectPackages')
        .mockResolvedValue(mockPackages);
      const result = await service.detectPackagesForSource(mockSource.id);
      expect(result).toEqual(mockPackages);
      expect(mockCacheService.setAnalysis).toHaveBeenCalledWith(
        mockSource.id,
        expect.objectContaining({
          packageLayers: mockPackages,
        }),
      );
    });
    it('should return cached package analysis if available', async () => {
      const mockSource = createFileTreeSource.localWorkingCopy(
        '/path/to/repo',
        'owner',
        'repo',
        'https://github.com/owner/repo.git',
        'main',
      );
      const cachedPackages = [
        {
          name: 'cached-package',
          path: '/',
          version: '1.0.0',
        },
      ];
      service.addSource(mockSource);
      mockCacheService.getAnalysis = jest.fn().mockReturnValue({
        packageLayers: cachedPackages,
      });
      const result = await service.detectPackagesForSource(mockSource.id);
      expect(result).toEqual(cachedPackages);
      expect(mockCacheService.loadFileTree).not.toHaveBeenCalled();
    });
  });
});
