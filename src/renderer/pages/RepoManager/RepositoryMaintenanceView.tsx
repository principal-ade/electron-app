import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Container,
  Search,
  FileText,
  Brain,
  Rocket,
  Server,
  Cloud,
  ClipboardList,
  AlertTriangle,
  Wrench,
  BarChart3,
  FileCode,
  Zap,
  Palette,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { PackageLayer } from '@principal-ai/codebase-composition';
import { CityMapManager } from './shared/CityMapManager';

import type { Repository } from '../../../shared/types/repository.types';
import { RepositoryNote } from '../../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { RepositoryNotesService } from '../../main-process-api/RepositoryNotesService';
import { GitHubWebAdapters } from '../../adapters/GitHubWebAdapters';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { MonitoredFileTreeService } from '../../services/MonitoredFileTreeService';
import { FileTreeSource, FileTreeStats } from '../../types/file-tree-source';
import { WindowService } from '../../main-process-api/WindowService';
import {
  RepositoryViewSkeleton,
  TabConfig,
} from './shared/RepositoryViewSkeleton';
import type { ToolbarItem } from './shared/RepositoryToolbar';
import { RepoSourceArchitecturePanelSimple } from './shared/RepoSourceArchitecturePanelSimple';
import {
  NullContentProvider,
  GitHubContentProvider,
} from '../../services/ContentProviders';
import { RemoteFileViewerModal } from './shared/RemoteFileViewerModal';
import { HelpModal } from './shared/HelpModal';
import { ToolsTab } from './shared/ToolsTab';

interface RepositoryMaintenanceViewProps {
  repository: Repository;
  remoteData: {
    owner: string;
    repo: string;
    defaultBranch: string;
  };
  searchQuery?: string;

  // Shared tree data from parent
  fileTree?: FileTree | null;
  cityData?: CityData | null;
  activeFileTreeSource?: FileTreeSource | null;
  fileTreeSourceService?: FileTreeSourceService;
  cacheService?: MonitoredFileTreeService;
  cityDataCache?: unknown;
  treeStats?: FileTreeStats | null;


  // Package layers from parent
  packageLayers?: PackageLayer[] | null;
  onPackageLayersChange?: (layers: PackageLayer[] | null) => void;

  // File color highlight layers from parent
  fileColorHighlightLayers?: HighlightLayer[];

  // Callbacks
  onFileTreeLoaded?: (fileTree: FileTree | null) => void;
}

export const RepositoryMaintenanceView: React.FC<
  RepositoryMaintenanceViewProps
> = ({
  repository,
  remoteData,
  searchQuery,
  fileTree: sharedFileTree,
  cityData: _sharedCityData,
  activeFileTreeSource: sharedActiveSource,
  fileTreeSourceService: sharedFileTreeService,
  cacheService: sharedCacheService,
  cityDataCache,
  treeStats: sharedTreeStats,
  packageLayers: packageLayersProp,
  onPackageLayersChange,
  fileColorHighlightLayers = [],
  onFileTreeLoaded,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('tools');

  // Services - use shared if provided, otherwise create local
  const fileTreeSourceService = useMemo(
    () => sharedFileTreeService || new FileTreeSourceService(),
    [sharedFileTreeService],
  );
  const cacheService = useMemo(
    () => sharedCacheService || new MonitoredFileTreeService(),
    [sharedCacheService],
  );

  // Data loading state
  const [loading, setLoading] = useState(!sharedFileTree);
  const [error, setError] = useState<string | null>(null);

  // Sources state
  const [fileTreeSources, setFileTreeSources] = useState<FileTreeSource[]>([]);
  const [activeFileTreeSource, setActiveFileTreeSource] =
    useState<FileTreeSource | null>(sharedActiveSource || null);

  // Repository data - use shared if provided
  const [treeStats, setTreeStats] = useState<FileTreeStats | null>(
    sharedTreeStats || null,
  );
  const [fileTree, setFileTree] = useState<FileTree | null>(
    sharedFileTree || null,
  );

  // Update local state when shared data changes
  useEffect(() => {
    if (sharedFileTree !== undefined) {
      setFileTree(sharedFileTree);
      setLoading(false);
    }
  }, [sharedFileTree]);

  useEffect(() => {
    if (sharedActiveSource !== undefined) {
      setActiveFileTreeSource(sharedActiveSource);
    }
  }, [sharedActiveSource]);

  useEffect(() => {
    if (sharedTreeStats !== undefined) {
      setTreeStats(sharedTreeStats);
    }
  }, [sharedTreeStats]);

  // Runbook state
  const [_runbookLoading, _setRunbookLoading] = useState(false);

  // Notes state
  const [tribalKnowledgeNotes, setTribalKnowledgeNotes] = useState<
    RepositoryNote[]
  >([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const [noteHighlightLayers, setNoteHighlightLayers] = useState<
    HighlightLayer[]
  >([]);


  // Search state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchHighlightLayer, setSearchHighlightLayer] =
    useState<HighlightLayer | null>(null);
  const [selectedFileLayer, setSelectedFileLayer] =
    useState<HighlightLayer | null>(null);
  const [hoveredSearchResult, _setHoveredSearchResult] = useState<
    string | null
  >(null);
  const [hoveredSearchLayer, setHoveredSearchLayer] =
    useState<HighlightLayer | null>(null);

  // File viewer modal state
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [viewerFilePath, setViewerFilePath] = useState<string | null>(null);
  const [viewerRelativePath, setViewerRelativePath] = useState<string | null>(
    null,
  );

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Multi-file editor state
  const [openedFiles, setOpenedFiles] = useState<Set<string>>(new Set());

  // Package data state - use props or local state
  const [localPackageLayers, setLocalPackageLayers] = useState<
    PackageLayer[] | null
  >(null);
  const packageLayers = packageLayersProp ?? localPackageLayers;
  const setPackageLayers = useCallback(
    (layers: PackageLayer[] | null) => {
      setLocalPackageLayers(layers);
      onPackageLayersChange?.(layers);
    },
    [onPackageLayersChange],
  );

  // Package highlight state
  const [highlightedPackages, setHighlightedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [packageHighlightLayers, setPackageHighlightLayers] = useState<
    HighlightLayer[]
  >([]);

  // Dependency analysis highlight state
  const [analyzingPackagePath, setAnalyzingPackagePath] = useState<
    string | null
  >(null);
  const [
    dependencyAnalysisHighlightLayer,
    setDependencyAnalysisHighlightLayer,
  ] = useState<HighlightLayer[]>([]);


  // Test coverage state
  const [testCoverageLayers, setTestCoverageLayers] = useState<
    HighlightLayer[]
  >([]);
  const [selectedPackageForCoverage, setSelectedPackageForCoverage] =
    useState<string>('');

  // Tools highlight layers state
  const [toolsHighlightLayers, setToolsHighlightLayers] = useState<
    HighlightLayer[]
  >([]);



  // Toolbar state
  const [toolbarExpanded, setToolbarExpanded] = useState(false);

  // File color state - default to showing file colors
  const [showFileColors, setShowFileColors] = useState(true);

  // Create toolbar items
  const toolbarItems = useMemo<ToolbarItem[]>(() => {
    const items: ToolbarItem[] = [];

    // File colors toggle - always show this first
    items.push({
      id: 'file-colors',
      label: 'File Colors',
      shortLabel: 'Colors',
      icon: <Palette />,
      color: '#6366f1',
      active: showFileColors,
      onClick: () => {
        setShowFileColors(!showFileColors);
      },
      tooltip: `${showFileColors ? 'Hide' : 'Show'} file type colors`,
    });

    // Search results
    if (searchResults.length > 0) {
      items.push({
        id: 'search-results',
        label: 'Search Results',
        shortLabel: 'Search',
        icon: <Search />,
        count: searchResults.length,
        color: '#3b82f6',
        active: true,
        onClick: () => {
          setSearchResults([]);
          setSearchHighlightLayer(null);
        },
        tooltip: `Clear search results (${searchResults.length} files)`,
      });
    }

    // Tribal knowledge notes
    if (selectedNoteIds.size > 0) {
      items.push({
        id: 'tribal-notes',
        label: 'Tribal Notes',
        shortLabel: 'Notes',
        icon: <FileText />,
        count: selectedNoteIds.size,
        color: '#8b5cf6',
        active: true,
        onClick: () => {
          setSelectedNoteIds(new Set());
        },
        tooltip: `Clear selected notes (${selectedNoteIds.size} selected)`,
      });
    }

    return items;
  }, [
    showFileColors,
    searchResults.length,
    selectedNoteIds.size,
    activeFileTreeSource,
  ]);

  // Handle file click to open in multi-tab viewer
  const handleFileClick = useCallback(
    (filePath: string) => {
      // Add file to opened files set
      setOpenedFiles((prev) => new Set(prev).add(filePath));

      // Open multi-file editor window
      const openMultiFileEditor = async () => {
        try {
          // Check if this is a local or remote source
          if (activeFileTreeSource?.type === 'local') {
            // For local sources, convert relative path to absolute path
            const absolutePath = filePath.startsWith('/')
              ? filePath
              : `${activeFileTreeSource.location}/${filePath}`;

            // Prepare file info for the multi-file editor
            const files = [
              {
                path: absolutePath,
                relativePath: filePath,
                lastModified: Date.now(),
              },
            ];

            // Include any previously opened files
            openedFiles.forEach((openedFile) => {
              if (openedFile !== filePath) {
                const absPath = openedFile.startsWith('/')
                  ? openedFile
                  : `${activeFileTreeSource.location}/${openedFile}`;
                files.push({
                  path: absPath,
                  relativePath: openedFile,
                  lastModified: Date.now(),
                });
              }
            });

            await WindowService.openLocalFiles({
              windowId: `maintenance-local-${activeFileTreeSource.id}`,
              windowTitle: `Maintenance - ${activeFileTreeSource.name}`,
              files,
            });
          } else {
            // For remote sources, use the existing remote flow
            const files = [
              {
                path: filePath,
                relativePath: filePath,
                lastModified: Date.now(),
              },
            ];

            // Include any previously opened files
            openedFiles.forEach((openedFile) => {
              if (openedFile !== filePath) {
                files.push({
                  path: openedFile,
                  relativePath: openedFile,
                  lastModified: Date.now(),
                });
              }
            });

            // Pass remote repository information for the multi-file editor
            const branch =
              activeFileTreeSource?.metadata?.currentBranch ||
              remoteData.defaultBranch;

            await WindowService.openRemoteFiles({
              windowId: `maintenance-${remoteData.owner}-${remoteData.repo}`,
              windowTitle: `Maintenance - ${remoteData.owner}/${remoteData.repo}`,
              files,
              owner: remoteData.owner,
              repo: remoteData.repo,
              branch,
            });
          }
        } catch (error) {
          console.error(
            '[RepositoryMaintenanceView] Failed to open multi-file editor:',
            error,
          );
        }
      };

      openMultiFileEditor();
    },
    [remoteData, openedFiles, activeFileTreeSource],
  );

  // Right pane mode: for remote exploration we default to city and do not show terminal toggle
  const [rightPaneMode] = useState<'city' | 'terminal'>('city');

  // Create content provider for remote repositories
  const _contentProvider = useMemo(() => {
    // For search, we should NOT use GitHubContentProvider for content search
    // as it would make API calls for every file. Use NullContentProvider for search,
    // but we'll create a separate provider for viewing individual files
    return new NullContentProvider();
  }, []);

  // Handle dependency analysis highlighting
  const handlePackageAnalysisStart = useCallback(
    (packagePath: string, packageName: string) => {
      if (!fileTree) return;

      setAnalyzingPackagePath(packagePath);

      // Clear selection highlights when analysis starts
      setPackageHighlightLayers([]);

      // Create highlight layer for the package being analyzed
      const highlightLayer: HighlightLayer = {
        id: 'dependency-analysis',
        name: `Analyzing ${packageName}`,
        color: '#0ea5e9', // Bright blue color for analysis
        opacity: 0.9,
        items: [
          { path: packagePath, type: 'directory' as const }, // Highlight the entire package directory
        ],
        enabled: true,
        priority: 10,
      };

      setDependencyAnalysisHighlightLayer([highlightLayer]);
    },
    [fileTree],
  );

  const handlePackageAnalysisEnd = useCallback(() => {
    const prevAnalyzingPath = analyzingPackagePath;
    setAnalyzingPackagePath(null);
    setDependencyAnalysisHighlightLayer([]);

    // If there was a package being analyzed, restore its selection highlight
    if (prevAnalyzingPath && fileTree && packageLayers) {
      const packageData = packageLayers.find(
        (pkg) => pkg.packageData.path === prevAnalyzingPath,
      );
      if (packageData) {
        const highlightLayer: HighlightLayer = {
          id: 'package-selection',
          name: `Selected ${packageData.packageData.name}`,
          color: '#22c55e', // Bright green color for selection
          opacity: 0.9,
          items: [
            { path: prevAnalyzingPath, type: 'directory' as const }, // Highlight the entire package directory
            {
              path: packageData.packageData.manifestPath,
              type: 'file' as const,
            }, // Highlight the package manifest file
          ],
          enabled: true,
          priority: 5,
        };
        setPackageHighlightLayers([highlightLayer]);
      }
    }
  }, [analyzingPackagePath, fileTree, packageLayers]);

  // Handle package selection highlighting
  const handlePackageSelected = useCallback(
    (packagePath: string, packageName: string) => {
      if (!fileTree) return;

      // Don't show selection highlight if we're currently analyzing this package
      if (analyzingPackagePath === packagePath) return;

      // Create highlight layer for the selected package
      const highlightLayer: HighlightLayer = {
        id: 'package-selection',
        name: `Selected ${packageName}`,
        color: '#22c55e', // Bright green color for selection
        opacity: 0.9,
        priority: 10,
        items: [
          { path: packagePath, type: 'directory' as const }, // Highlight the entire package directory
        ],
        enabled: true,
      };

      setPackageHighlightLayers([highlightLayer]);
    },
    [fileTree, analyzingPackagePath],
  );

  const handlePackageDeselected = useCallback(() => {
    // Only clear selection highlights if we're not currently analyzing
    if (!analyzingPackagePath) {
      setPackageHighlightLayers([]);
    }
  }, [analyzingPackagePath]);

  // Simple file tree search without indexing for better performance
  const performSimpleSearch = useCallback(
    (query: string): string[] => {
      if (!fileTree || !query.trim()) return [];

      const lowerQuery = query.toLowerCase();
      const results: string[] = [];

      // Search through all files
      for (const file of fileTree.allFiles || []) {
        // Check if filename or path contains the query
        if (
          file.name.toLowerCase().includes(lowerQuery) ||
          file.relativePath.toLowerCase().includes(lowerQuery)
        ) {
          results.push(file.relativePath);

          // Limit results for performance
          if (results.length >= 100) break;
        }
      }

      return results;
    },
    [fileTree],
  );

  // Handle search from header
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      setSearchHighlightLayer(null);
      return;
    }

    // Perform simple search for instant feedback
    const results = performSimpleSearch(searchQuery);
    setSearchResults(results);

    // Create highlight layer for search results
    if (results.length > 0) {
      const layer: HighlightLayer = {
        id: 'search-results',
        name: 'Search Results',
        color: '#FFD700',
        opacity: 0.6,
        priority: 10,
        items: results.map((path) => ({ path, type: 'file' as const })),
        enabled: true,
      };
      setSearchHighlightLayer(layer);
    } else {
      setSearchHighlightLayer(null);
    }

    console.info(
      '[ExploreView] Search results for "' + searchQuery + '":',
      results.length,
      'files found',
    );
  }, [searchQuery, performSimpleSearch]);

  // Separate provider for viewing individual files (not for search)
  const fileViewerContentProvider = useMemo(() => {
    return new GitHubContentProvider(
      remoteData.owner,
      remoteData.repo,
      activeFileTreeSource?.metadata?.currentBranch || remoteData.defaultBranch,
    );
  }, [
    remoteData.owner,
    remoteData.repo,
    remoteData.defaultBranch,
    activeFileTreeSource?.metadata?.currentBranch,
  ]);

  // Initialize sources only if not using shared service
  useEffect(() => {
    if (sharedFileTreeService || sharedActiveSource) {
      // Skip initialization if using shared data
      return;
    }

    const initialSources =
      fileTreeSourceService.initializeFromRepository(repository);

    // Filter to only remote sources for exploration view
    // Local clones should be explored through LocalDevelopmentView
    const remoteSources = initialSources.filter(
      (source) => source.type === 'remote',
    );

    console.info('[RepositoryMaintenanceView] Initialized sources:', {
      all: initialSources.map((s) => ({
        id: s.id,
        type: s.type,
        label: s.label,
      })),
      remote: remoteSources.map((s) => ({
        id: s.id,
        type: s.type,
        label: s.label,
      })),
    });

    setFileTreeSources(remoteSources);

    // Set the first remote source as active (should be the default branch)
    const defaultRemoteSource =
      remoteSources.find((s) => s.isDefault) || remoteSources[0];
    if (defaultRemoteSource) {
      fileTreeSourceService.setActiveSource(defaultRemoteSource.id);
      setActiveFileTreeSource(defaultRemoteSource);
    }
  }, [
    repository,
    fileTreeSourceService,
    sharedFileTreeService,
    sharedActiveSource,
  ]);

  // Create adapters for active source
  const _adapters = useMemo(() => {
    if (!activeFileTreeSource) return null;
    const branch =
      activeFileTreeSource.metadata?.currentBranch || remoteData.defaultBranch;
    return new GitHubWebAdapters(remoteData.owner, remoteData.repo, branch);
  }, [
    activeFileTreeSource,
    remoteData.owner,
    remoteData.repo,
    remoteData.defaultBranch,
  ]);

  // RepositoryMaintenanceView should never load its own tree - always use the one from RepositoryManager
  useEffect(() => {
    if (!sharedFileTree) {
      setLoading(false);
      setError('File tree not provided by RepositoryManager');
      console.error(
        '[RepositoryMaintenance] No file tree provided by RepositoryManager',
      );
    } else {
      setLoading(false);
      setError(null);
      // Call onFileTreeLoaded if provided
      if (onFileTreeLoaded) {
        onFileTreeLoaded(sharedFileTree);
      }
    }
  }, [sharedFileTree, onFileTreeLoaded]);

  // Fetch repository notes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!repository.remoteUrl) return;
      try {
        const notes = await RepositoryNotesService.getNotesForRepository(
          repository.remoteUrl,
        );
        setTribalKnowledgeNotes(notes);
      } catch (error) {
        console.error('Failed to fetch repository notes:', error);
      }
    };
    fetchNotes();
  }, [repository.remoteUrl]);


  // Create search highlight layer
  useEffect(() => {
    if (searchResults.length === 0) {
      setSearchHighlightLayer(null);
      return;
    }

    const layer: HighlightLayer = {
      id: 'search-results',
      name: `Search Results (${searchResults.length})`,
      enabled: true,
      color: '#3b82f6', // Blue for search results
      priority: 25, // Higher than most layers
      items: searchResults.map((path) => ({
        path,
        type: 'file' as const,
      })),
    };

    setSearchHighlightLayer(layer);
  }, [searchResults]);

  // Create hover highlight layer for search results
  useEffect(() => {
    if (!hoveredSearchResult) {
      setHoveredSearchLayer(null);
      return;
    }

    const layer: HighlightLayer = {
      id: 'hovered-search-result',
      name: 'Hovered Result',
      enabled: true,
      color: '#fbbf24', // Amber/yellow for hover
      priority: 40, // Higher priority than other layers
      borderWidth: 3, // Thicker border for visibility
      items: [
        {
          path: hoveredSearchResult,
          type: 'file' as const,
          renderStrategy: 'fill', // Just outline for hover
        },
      ],
    };

    console.info(
      '[RepositoryMaintenanceView] Created hover layer for:',
      hoveredSearchResult,
    );
    setHoveredSearchLayer(layer);
  }, [hoveredSearchResult]);

  // Create selected file fill layer
  useEffect(() => {
    if (!selectedFile) {
      setSelectedFileLayer(null);
      return;
    }

    // Extract relative path from the selected file
    // The selectedFile might be an absolute path, so we need to convert it
    let relativePath = selectedFile;
    if (selectedFile.includes('/')) {
      // If it's an absolute path, try to find the relative part
      const parts = selectedFile.split('/');
      const repoNameIndex = parts.findIndex((part) => part === repository.name);
      if (repoNameIndex !== -1 && repoNameIndex < parts.length - 1) {
        relativePath = parts.slice(repoNameIndex + 1).join('/');
      } else {
        // Fallback: just use the last part after the last slash
        relativePath = selectedFile.substring(
          selectedFile.lastIndexOf('/') + 1,
        );
      }
    }

    const layer: HighlightLayer = {
      id: 'selected-file',
      name: 'Selected File',
      enabled: true,
      color: '#10b981', // Green for selected file
      priority: 30, // Higher priority than search results
      items: [
        {
          path: relativePath,
          type: 'file' as const,
          renderStrategy: 'fill', // Fill the building instead of just outline
        },
      ],
    };

    console.info(
      '[RepositoryMaintenanceView] Created selected file layer for:',
      relativePath,
    );
    setSelectedFileLayer(layer);
  }, [selectedFile, repository.name]);

  // Create note highlight layers
  useEffect(() => {
    if (selectedNoteIds.size === 0) {
      setNoteHighlightLayers([]);
      return;
    }

    const layers: HighlightLayer[] = [];
    const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
    let colorIndex = 0;

    for (const noteId of selectedNoteIds) {
      const note = tribalKnowledgeNotes.find((n) => n.id === noteId);
      if (!note) continue;

      const color = colors[colorIndex % colors.length];
      colorIndex++;

      const items: Array<{ path: string; type: 'file' | 'directory' }> = [];
      if (note.relativePath) {
        items.push({ path: note.relativePath, type: 'directory' as const });
      }
      if (note.anchors) {
        for (const anchor of note.anchors) {
          items.push({ path: anchor, type: 'file' as const });
        }
      }

      if (items.length > 0) {
        layers.push({
          id: `note-${noteId}`,
          name: `Note: ${note.note.substring(0, 30)}...`,
          enabled: true,
          color,
          priority: 20 + colorIndex,
          items,
        });
      }
    }

    setNoteHighlightLayers(layers);
  }, [selectedNoteIds, tribalKnowledgeNotes]);

  // Create package highlight layers
  useEffect(() => {
    if (highlightedPackages.size === 0) {
      setPackageHighlightLayers([]);
      return;
    }

    if (!packageLayers) {
      setPackageHighlightLayers([]);
      return;
    }

    const layers: HighlightLayer[] = [];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']; // Green, Blue, Orange, Purple, Pink
    let colorIndex = 0;

    for (const packageId of highlightedPackages) {
      // Find the package data
      const pkg = packageLayers.find((p) => p.id === packageId);
      if (!pkg) continue;

      const items: Array<{
        path: string;
        type: 'file' | 'directory';
        renderStrategy?: 'fill' | 'border';
      }> = [];

      console.info(
        '[RepositoryMaintenanceView] Package path:',
        JSON.stringify(pkg.packageData.path),
      );

      // Handle root package - check for various root indicators including "package.json" itself
      const isRootPackage =
        !pkg.packageData.path ||
        pkg.packageData.path === '.' ||
        pkg.packageData.path === 'root' ||
        pkg.packageData.path === '' ||
        pkg.packageData.path === 'package.json';

      console.info(
        '[RepositoryMaintenanceView] Is root package:',
        isRootPackage,
      );

      if (isRootPackage) {
        // For root packages, highlight both the root directory and package.json file
        items.push({
          path: '',
          type: 'directory' as const,
          renderStrategy: 'fill',
        });
        // Use manifestPath if available, otherwise use package.json
        const manifestFile = pkg.packageData.manifestPath || 'package.json';
        items.push({
          path: manifestFile,
          type: 'file' as const,
          renderStrategy: 'fill',
        });
      } else {
        // For non-root packages, highlight both the directory and package.json
        items.push({
          path: pkg.packageData.path,
          type: 'directory' as const,
          renderStrategy: 'fill',
        });
        // Use manifestPath if available
        if (pkg.packageData.manifestPath) {
          items.push({
            path: pkg.packageData.manifestPath,
            type: 'file' as const,
            renderStrategy: 'fill',
          });
        }
      }

      const layer: HighlightLayer = {
        id: `package-highlight-${packageId}`,
        name: `Package: ${pkg.packageData.name}`,
        enabled: true,
        color: colors[colorIndex % colors.length],
        priority: 35 + colorIndex, // Slightly different priorities to ensure all show
        items,
      };

      layers.push(layer);
      colorIndex++;
    }

    console.info(
      '[RepositoryMaintenanceView] Created package highlight layers:',
      layers,
    );
    setPackageHighlightLayers(layers);
  }, [highlightedPackages, packageLayers]);

  // Handle source change
  const handleSourceChange = (sourceId: string) => {
    const source = fileTreeSourceService.getSource(sourceId);
    if (source) {
      fileTreeSourceService.setActiveSource(sourceId);
      setActiveFileTreeSource(source);
    }
  };

  // Add a new branch source
  const _handleAddBranch = (branchName: string) => {
    const newSource = fileTreeSourceService.createBranchSource(branchName);
    if (newSource) {
      setFileTreeSources(fileTreeSourceService.getAllSources());
      handleSourceChange(newSource.id);
    }
  };

  // Handle package highlighting (toggle)
  const _handleHighlightPackage = (
    packagePath: string,
    packageName: string,
  ) => {
    console.info(
      '[RepositoryMaintenanceView] Toggling package:',
      packageName,
      'at path:',
      packagePath,
    );

    // Find the package by path and name to get its ID
    const pkg = packageLayers?.find(
      (p) =>
        p.packageData.path === packagePath &&
        p.packageData.name === packageName,
    );

    if (!pkg) {
      console.warn(
        '[RepositoryMaintenanceView] Could not find package:',
        packageName,
        packagePath,
      );
      return;
    }

    setHighlightedPackages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pkg.id)) {
        console.info(
          '[RepositoryMaintenanceView] Removing package from highlights:',
          packageName,
        );
        newSet.delete(pkg.id);
      } else {
        console.info(
          '[RepositoryMaintenanceView] Adding package to highlights:',
          packageName,
        );
        newSet.add(pkg.id);
      }
      return newSet;
    });
  };

  // Check if knip.json exists at root
  const hasKnipConfig = useMemo(() => {
    if (!fileTree) return false;

    // Check for knip.json at root
    return fileTree.allFiles.some((file) => {
      const fileName = file.name.toLowerCase();
      const isAtRoot = !file.relativePath.includes('/');
      return isAtRoot && fileName === 'knip.json';
    });
  }, [fileTree]);

  // Create tabs configuration
  const tabs: TabConfig[] = [
    {
      id: 'tools',
      label: 'Tools',
      icon: <Wrench size={14} />,
      visible: true,
      content: <ToolsTab
        packageLayers={packageLayers}
        repositoryPath={activeFileTreeSource?.type === 'local' ? activeFileTreeSource.location : ''}
        onHighlightLayersChange={setToolsHighlightLayers}
      />,
    },
    {
      id: 'runbook',
      label: 'Runbook',
      icon: <ClipboardList size={14} />,
      visible: true,
      content: (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              textAlign: 'center',
            }}
          >
            {/* Icon Container */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '20px',
                marginBottom: '32px',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '20px',
                  background: `linear-gradient(135deg, ${theme.colors.primary}20, ${theme.colors.primary}10)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 8px 24px ${theme.colors.primary}15`,
                  animation: 'float 3s ease-in-out infinite',
                }}
              >
                <Rocket size={40} color={theme.colors.primary} />
              </div>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '20px',
                  background: `linear-gradient(135deg, #10b98120, #10b98110)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px #10b98115',
                  animation: 'float 3s ease-in-out infinite',
                  animationDelay: '0.5s',
                }}
              >
                <Server size={40} color="#10b981" />
              </div>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '20px',
                  background: `linear-gradient(135deg, #3b82f620, #3b82f610)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px #3b82f615',
                  animation: 'float 3s ease-in-out infinite',
                  animationDelay: '1s',
                }}
              >
                <Cloud size={40} color="#3b82f6" />
              </div>
            </div>

            {/* Title */}
            <h2
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: theme.colors.text,
                marginBottom: '16px',
                letterSpacing: '-0.5px',
              }}
            >
              Runbook Information
            </h2>

            {/* Subtitle */}
            <p
              style={{
                fontSize: '16px',
                color: theme.colors.textSecondary,
                marginBottom: '32px',
                lineHeight: '1.6',
              }}
            >
              Access operational procedures, deployment guides, and incident
              response playbooks. Documentation for maintaining and operating
              your services will be available here.
            </p>

            {/* Coming Soon Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.primary}05)`,
                border: `1px solid ${theme.colors.primary}30`,
                marginBottom: '32px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: theme.colors.primary,
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.primary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Coming Soon
              </span>
            </div>

            {/* Feature Preview */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                marginTop: '40px',
              }}
            >
              {[
                { Icon: ClipboardList, label: 'Procedures' },
                { Icon: AlertTriangle, label: 'Incident Response' },
                { Icon: Wrench, label: 'Maintenance' },
                { Icon: BarChart3, label: 'Monitoring' },
              ].map((feature) => (
                <div
                  key={feature.label}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background:
                      theme.colors.backgroundSecondary ||
                      theme.colors.background,
                    border: `1px solid ${theme.colors.border}`,
                    opacity: 0.6,
                  }}
                >
                  <div
                    style={{
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <feature.Icon
                      size={24}
                      color={theme.colors.textSecondary}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {feature.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <style>{`
            @keyframes float {
              0%, 100% {
                transform: translateY(0px);
              }
              50% {
                transform: translateY(-10px);
              }
            }
            
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
              }
              50% {
                opacity: 0.5;
              }
            }
          `}</style>
        </div>
      ),
    },
    {
      id: 'layers',
      label: 'Dependencies',
      icon: <Layers size={14} />,
      visible: true,
      content: activeFileTreeSource ? (
        <RepoSourceArchitecturePanelSimple
          source={activeFileTreeSource}
          cacheService={cacheService}
          packageLayers={packageLayers}
          onError={(error) => {
            console.error('Architecture panel error:', error);
          }}
          onPackageLayersChanged={setPackageLayers}
          onPackageAnalysisStart={handlePackageAnalysisStart}
          onPackageAnalysisEnd={handlePackageAnalysisEnd}
          onPackageSelected={handlePackageSelected}
          onPackageDeselected={handlePackageDeselected}
        />
      ) : (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: theme.colors.textSecondary,
          }}
        >
          No source selected
        </div>
      ),
    },
  ];

  // Additional badge content for sources
  const renderAdditionalBadges = () => {
    if (fileTreeSources.length <= 1) return null;

    return (
      <button
        onClick={() => {
          // TODO: Open source selector modal
          console.info('Open source selector');
        }}
        style={{
          padding: '3px 8px',
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {fileTreeSources.length} sources
      </button>
    );
  };

  // Error handling
  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          color: theme.colors.textSecondary,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: theme.colors.text, marginBottom: '8px' }}>
            Failed to Load Repository
          </h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CityMapManager
        fileTree={fileTree}
        activeSource={activeFileTreeSource}
        viewMode="maintain"
        renderCustomBadges={renderAdditionalBadges}
      >
        {({ cityData, sourceBadges, isBuilding }) => (
          <RepositoryViewSkeleton
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            cityData={cityData}
            onFileClick={handleFileClick}
            highlightLayers={(() => {
              const layers = [
                ...(showFileColors ? fileColorHighlightLayers : []), // Conditionally add file colors
                ...noteHighlightLayers,
                ...(searchHighlightLayer ? [searchHighlightLayer] : []),
                ...(hoveredSearchLayer ? [hoveredSearchLayer] : []),
                ...(selectedFileLayer ? [selectedFileLayer] : []),
                ...dependencyAnalysisHighlightLayer,
                ...packageHighlightLayers,
                ...testCoverageLayers,
                ...toolsHighlightLayers,
              ];
              return layers;
            })()}
            loading={loading || isBuilding}
            treeStats={treeStats}
            sourceBadges={sourceBadges}
            onHelpClick={() => setShowHelpModal(true)}
            cityHeaderExtra={undefined}
            loadingMessage="Loading repository structure"
            emptyMessage="Select a branch to explore"
            rightPaneMode={rightPaneMode}
            showViewSwitcher={false} // Hide terminal/notes switcher in explore mode
            // No terminalDirectory passed for remote view
            toolbarItems={toolbarItems}
            toolbarExpanded={toolbarExpanded}
            onToolbarExpandedChange={setToolbarExpanded}
          />
        )}
      </CityMapManager>

      {/* File Viewer Modal */}
      {showFileViewer && viewerFilePath && viewerRelativePath && (
        <RemoteFileViewerModal
          filePath={viewerFilePath}
          relativePath={viewerRelativePath}
          contentProvider={fileViewerContentProvider}
          onClose={() => {
            setShowFileViewer(false);
            setViewerFilePath(null);
            setViewerRelativePath(null);
          }}
          repository={{
            owner: remoteData.owner,
            repo: remoteData.repo,
            branch:
              activeFileTreeSource?.metadata?.currentBranch ||
              remoteData.defaultBranch,
          }}
        />
      )}

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        mode="explore"
      />
    </>
  );
};
