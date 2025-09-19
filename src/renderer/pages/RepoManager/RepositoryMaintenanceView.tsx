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
  Activity,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { PackageLayer } from '@principal-ai/codebase-composition';
import { CityMapManager } from './shared/CityMapManager';

import type { Repository } from '../../../shared/types/repository.types';
import type { A24zNote } from '../../../shared/main-process-api-interfaces/A24zAPI';
import { RepositoryNote } from '../../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { RepositoryNotesService } from '../../main-process-api/RepositoryNotesService';
import { GitHubWebAdapters } from '../../adapters/GitHubWebAdapters';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { FileTreeCacheService } from '../../services/FileTreeCacheService';
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
import { ValidationsTab } from './shared/ValidationsTab';
import { useViolationMonitoring } from '../../hooks/useViolationMonitoring';

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
  cacheService?: FileTreeCacheService;
  cityDataCache?: unknown;
  treeStats?: FileTreeStats | null;

  // a24z notes from parent (already loaded)
  a24zNotes?: A24zNote[];

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
  a24zNotes: a24zNotesProp = [],
  packageLayers: packageLayersProp,
  onPackageLayersChange,
  fileColorHighlightLayers = [],
  onFileTreeLoaded,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('validations');

  // Services - use shared if provided, otherwise create local
  const fileTreeSourceService = useMemo(
    () => sharedFileTreeService || new FileTreeSourceService(),
    [sharedFileTreeService],
  );
  const cacheService = useMemo(
    () => sharedCacheService || new FileTreeCacheService(),
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

  // a24z memory state - notes come from props, only manage the layer locally
  const a24zNotes = a24zNotesProp; // Use the prop instead of local state
  const [a24zHighlightLayer, setA24zHighlightLayer] =
    useState<HighlightLayer | null>(null);
  const [showA24zLayer, setShowA24zLayer] = useState(true);

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

  // Knip analysis state
  const [knipHighlightLayers, setKnipHighlightLayers] = useState<
    HighlightLayer[]
  >([]);

  // Violation monitoring state
  // Removed - using violationLayer from hook instead

  // Test coverage state
  const [testCoverageLayers, setTestCoverageLayers] = useState<
    HighlightLayer[]
  >([]);
  const [selectedPackageForCoverage, setSelectedPackageForCoverage] =
    useState<string>('');

  // Use violation monitoring hook for local sources
  const _fileTreeForMonitoring = useMemo(() => {
    if (!fileTree) return null;
    // Convert FileTree to FileTree format if needed
    return fileTree as unknown; // Type casting for now
  }, [fileTree]);

  // State for controlled violation monitoring
  const [selectedPackageForAnalysis, setSelectedPackageForAnalysis] = useState<
    string | null
  >(null);
  const [shouldMonitor, setShouldMonitor] = useState(false);

  // Filter packageLayers to only the selected package when monitoring
  const packagesForMonitoring = useMemo(() => {
    if (!shouldMonitor || !selectedPackageForAnalysis || !packageLayers) {
      return null;
    }
    // Filter to only the selected package
    const filtered = packageLayers.filter(
      (pkg) => pkg.packageData.path === selectedPackageForAnalysis,
    );
    console.log(
      '[RepositoryMaintenanceView] Packages for monitoring updated:',
      {
        selectedPackage: selectedPackageForAnalysis,
        filteredCount: filtered.length,
        filteredPackages: filtered.map((p) => ({
          name: p.packageData?.name,
          path: p.packageData?.path,
        })),
      },
    );
    return filtered;
  }, [shouldMonitor, selectedPackageForAnalysis, packageLayers]);

  // Track what validation types to include (controlled by ValidationsTab)
  const [includeTypescript, setIncludeTypescript] = useState(false);
  const [includeEslint, setIncludeEslint] = useState(true); // Default to ESLint to match ValidationsTab

  // Violation monitoring - only runs when shouldMonitor is true and has selected package
  const {
    violationResult,
    violationLayer,
    isMonitoring,
    error: _violationError,
    refresh: refreshViolationsInternal,
    toggleTypeScript: _toggleTypeScript,
    toggleESLint: _toggleESLint,
    getSummaryForFile: _getSummaryForFile,
  } = useViolationMonitoring(activeFileTreeSource, packagesForMonitoring, {
    enabled: shouldMonitor && !!selectedPackageForAnalysis, // Only enable when explicitly requested
    includeTypescript,
    includeEslint,
    useCache: false, // No caching - run on demand
    autoRefresh: false,
  });

  // Manual refresh for violations - ValidationsTab controls what gets run
  const refreshViolations = useCallback(
    (packagePath?: string, validationType?: string) => {
      console.log('[RepositoryMaintenanceView] Manual refresh triggered:', {
        packagePath,
        validationType,
        currentSelectedPackage: selectedPackageForAnalysis,
      });

      if (packagePath) {
        // Update the selected package if provided
        setSelectedPackageForAnalysis(packagePath);
      }

      // Set which validation types to run based on ValidationsTab's selection
      if (validationType === 'eslint') {
        setIncludeEslint(true);
        setIncludeTypescript(false);
      } else if (validationType === 'typescript') {
        setIncludeEslint(false);
        setIncludeTypescript(true);
      } else {
        // If no specific type, don't run anything
        return;
      }

      // Enable monitoring and trigger refresh
      setShouldMonitor(true);
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        refreshViolationsInternal();
      }, 100);
    },
    [refreshViolationsInternal, selectedPackageForAnalysis],
  );

  // No automatic refresh - only manual triggers

  // Toolbar state
  const [toolbarExpanded, setToolbarExpanded] = useState(false);

  // Create toolbar items
  const toolbarItems = useMemo<ToolbarItem[]>(() => {
    const items: ToolbarItem[] = [];

    // a24z memory tool (for local sources from parent)
    if (activeFileTreeSource?.type === 'local' && a24zNotes.length > 0) {
      items.push({
        id: 'a24z-memory',
        label: 'a24z Memory',
        shortLabel: 'a24z',
        icon: <Brain />,
        count: a24zNotes.length,
        color: '#9333ea',
        active: showA24zLayer,
        onClick: () => setShowA24zLayer(!showA24zLayer),
        tooltip: `${showA24zLayer ? 'Hide' : 'Show'} a24z memory coverage (${a24zNotes.length} notes)`,
      });
    }

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

    // Knip issues
    if (knipHighlightLayers.length > 0) {
      const issueCount = knipHighlightLayers.reduce(
        (acc, layer) => acc + (layer.items?.length || 0),
        0,
      );
      if (issueCount > 0) {
        items.push({
          id: 'knip-issues',
          label: 'Knip Issues',
          shortLabel: 'Knip',
          icon: <Container />,
          count: issueCount,
          color: '#ef4444',
          active: true,
          onClick: () => {
            setKnipHighlightLayers([]);
          },
          tooltip: `Clear knip issues (${issueCount} issues)`,
        });
      }
    }

    return items;
  }, [
    searchResults.length,
    selectedNoteIds.size,
    knipHighlightLayers,
    a24zNotes.length,
    showA24zLayer,
    activeFileTreeSource,
  ]);

  // Handle file click to open in multi-tab viewer
  const handleFileClick = useCallback(
    (filePath: string) => {
      console.info('[RepositoryMaintenanceView] File clicked:', filePath);

      // Add file to opened files set
      setOpenedFiles((prev) => new Set(prev).add(filePath));

      // Open multi-file editor window
      const openMultiFileEditor = async () => {
        try {
          // Prepare file info for the multi-file editor
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
          console.info(
            '[RepositoryMaintenanceView] Opening multi-file editor with:',
            {
              owner: remoteData.owner,
              repo: remoteData.repo,
              branch,
              files,
              activeFileTreeSource: activeFileTreeSource?.metadata,
            },
          );

          await WindowService.openMultiFileEditor({
            sessionId: `explore-${remoteData.owner}-${remoteData.repo}`,
            sessionName: `Explore ${remoteData.owner}/${remoteData.repo}`,
            files,
            repositoryPath: remoteData.owner + '/' + remoteData.repo,
            // Add remote repository info so the editor knows to use remote content provider
            isRemote: true,
            remoteInfo: {
              owner: remoteData.owner,
              repo: remoteData.repo,
              branch,
            },
          });
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
          { path: packagePath + '/package.json', type: 'file' as const }, // Also highlight the package.json file
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
              path: prevAnalyzingPath + '/package.json',
              type: 'file' as const,
            }, // Also highlight the package.json file
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
          { path: packagePath + '/package.json', type: 'file' as const }, // Also highlight the package.json file
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

  // a24z notes are now loaded in RepositoryManager and passed as props

  // Create a24z highlight layer from anchors
  useEffect(() => {
    if (!showA24zLayer || a24zNotes.length === 0) {
      setA24zHighlightLayer(null);
      return;
    }

    console.info(
      '[MaintenanceView] Processing a24z notes for highlight layer:',
      a24zNotes.length,
      'notes',
    );

    // Collect all unique file paths from anchors
    const filePaths = new Set<string>();
    for (const note of a24zNotes) {
      console.info('[MaintenanceView] Processing note:', {
        id: note.id,
        anchors: note.anchors,
        type: note.type,
        tags: note.tags,
      });

      if (note.anchors && Array.isArray(note.anchors)) {
        for (const anchor of note.anchors) {
          if (anchor && typeof anchor === 'string') {
            // Remove leading slash if present
            const cleanPath = anchor.startsWith('/')
              ? anchor.substring(1)
              : anchor;
            filePaths.add(cleanPath);
            console.info('[MaintenanceView] Added anchor path:', cleanPath);
          }
        }
      }
    }

    console.info(
      '[MaintenanceView] Total unique file paths from a24z notes:',
      filePaths.size,
    );

    if (filePaths.size === 0) {
      setA24zHighlightLayer(null);
      return;
    }

    // Create highlight layer
    const layer: HighlightLayer = {
      id: 'a24z-memory',
      name: `a24z Memory (${a24zNotes.length} notes)`,
      enabled: true,
      color: '#9333ea', // Purple color for a24z
      priority: 15, // Lower priority than search/selection
      items: Array.from(filePaths).map((path) => ({
        path,
        type: 'file' as const,
        renderStrategy: 'border' as const, // Use border to not interfere with other highlights
      })),
    };

    console.info(
      '[MaintenanceView] Created a24z highlight layer with',
      layer.items.length,
      'items',
    );
    setA24zHighlightLayer(layer);
  }, [a24zNotes, showA24zLayer]);

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
        items.push({
          path: 'package.json',
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
        items.push({
          path: `${pkg.packageData.path}/package.json`,
          type: 'file' as const,
          renderStrategy: 'fill',
        });
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
      id: 'validations',
      label: 'Validations',
      icon: <Wrench size={14} />,
      visible: true,
      content: (
        <ValidationsTab
          repository={repository}
          fileTree={fileTree}
          packageLayers={packageLayers}
          violationResult={violationResult}
          isMonitoring={isMonitoring}
          selectedPackage={selectedPackageForAnalysis}
          onPackageSelect={(packagePath) => {
            console.log(
              '[RepositoryMaintenanceView] Package selected in ValidationsTab:',
              packagePath,
            );
            setSelectedPackageForAnalysis(packagePath);
          }}
          onRefresh={(packagePath?: string, validationType?: string) =>
            refreshViolations(
              packagePath || (selectedPackageForAnalysis ?? undefined),
              validationType,
            )
          }
          onHighlightChange={setKnipHighlightLayers}
        />
      ),
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
                ...fileColorHighlightLayers,
                ...noteHighlightLayers,
                ...(a24zHighlightLayer ? [a24zHighlightLayer] : []),
                ...(searchHighlightLayer ? [searchHighlightLayer] : []),
                ...(hoveredSearchLayer ? [hoveredSearchLayer] : []),
                ...(selectedFileLayer ? [selectedFileLayer] : []),
                ...dependencyAnalysisHighlightLayer,
                ...packageHighlightLayers,
                ...knipHighlightLayers,
                ...(violationLayer ? [violationLayer] : []),
                ...testCoverageLayers,
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
