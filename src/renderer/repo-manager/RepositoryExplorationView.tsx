import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  GitBranch,
  Layers,
  Search,
  FileText,
  Book,
  PanelLeft,
  PanelLeftClose,
  Palette,
  Wrench,
  FolderTree,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { HighlightLayer } from '@principal-ai/code-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { PackageLayer } from '@principal-ai/codebase-composition';
import {
  ConfigurablePanelLayout,
  type PanelDefinitionWithContent,
  type PanelLayout,
  type PanelTabDefinition,
} from '@a24z/panels';
import '@a24z/panels/panels.css';
import { CityMapManager } from './shared/CityMapManager';
import { AlexandriaDocsPanel } from './shared/AlexandriaDocsPanel';
import { MarkdownDocumentViewer } from './shared/MarkdownDocumentViewer';
import { ExcalidrawWrapper } from '../components/shared/ExcalidrawWrapper';
import { FileSystemService } from '../main-process-api/FileSystemService';
import TerminalPanel from '../components/Terminal/TerminalPanel';

import type { Repository } from '../../shared/types/repository.types';
import { RightPaneMode } from '../../shared/types/userPreferences.types';
import { RepositoryNote } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { RepositoryNotesService } from '../main-process-api/RepositoryNotesService';
import { FileTreeSourceService } from '../services/FileTreeSourceService';
import { MonitoredFileTreeService } from '../services/MonitoredFileTreeService';
// import { SourceSelectionService } from '../services/SourceSelectionService'; // TODO: Re-enable when needed
import { FileTreeSource, FileTreeStats } from '../types/file-tree-source';
import { usePanelsTheme } from '../theme/panelsTheme';
import type { ToolbarItem } from './shared/RepositoryToolbar';
import { RepoSourceArchitecturePanelSimple } from './shared/RepoSourceArchitecturePanelSimple';
import {
  NullContentProvider,
  GitHubContentProvider,
  ContentProvider,
  LocalFileSystemProvider,
} from '../services/ContentProviders';
import { RemoteFileViewerModal } from './shared/RemoteFileViewerModal';
import { HelpModal } from './shared/HelpModal';
import { useGitChanges } from '../contexts/GitChangesContext';
import { useRepositoryGitStatus } from '../hooks/useRepositoryGitStatus';
import { RepositorySearchTab } from '../components/repository-maps/RepositorySearchTab';
import { RepoManagerCodePreview } from './shared/RepoManagerCodePreview';
import { ToolsTab } from './shared/ToolsTab';
import {
  RightPaneContainer,
  RightPaneView,
} from '../components/repository-maps/RightPaneContainer';
import { FileTreeTab } from './shared/FileTreeTab';

type PanelTabConfig = PanelTabDefinition & { visible?: boolean };
type TabbedPanelDefinition = PanelDefinitionWithContent & {
  tabs?: PanelTabDefinition[];
  activeTab?: string;
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  onActiveTabChange?: (tabId: string) => void;
};

interface RepositoryExplorationViewProps {
  repository: Repository;
  remoteData: {
    owner: string;
    repo: string;
    defaultBranch: string;
  };
  searchQuery?: string;

  // Shared tree data from parent
  fileTree?: FileTree | null;
  activeFileTreeSource?: FileTreeSource | null;
  fileTreeSourceService?: FileTreeSourceService;
  cacheService?: MonitoredFileTreeService;
  cityDataCache?: unknown;
  treeStats?: FileTreeStats | null;


  // Package layers shared from parent
  packageLayers?: PackageLayer[] | null;
  onPackageLayersChange?: (layers: PackageLayer[] | null) => void;


  // File color highlight layers from parent
  fileColorHighlightLayers?: HighlightLayer[];

  // Callbacks
  onFileTreeLoaded?: (fileTree: FileTree | null) => void;

  // Panel layout state
  leftPanelCollapsed?: boolean;
  onLeftPanelCollapsedChange?: (collapsed: boolean) => void;
  rightPanelCollapsed?: boolean;
  onRightPanelCollapsedChange?: (collapsed: boolean) => void;
  panelLayout?: PanelLayout;
}

export const RepositoryExplorationView: React.FC<
  RepositoryExplorationViewProps
> = ({
  repository,
  remoteData,
  searchQuery,
  fileTree: sharedFileTree,
  activeFileTreeSource: sharedActiveSource,
  fileTreeSourceService: sharedFileTreeService,
  cacheService: sharedCacheService,
  cityDataCache: _cityDataCache,
  treeStats: sharedTreeStats,
  packageLayers: sharedPackageLayers,
  onPackageLayersChange,
  fileColorHighlightLayers = [],
  onFileTreeLoaded,
  leftPanelCollapsed: controlledLeftPanelCollapsed,
  onLeftPanelCollapsedChange,
  rightPanelCollapsed: controlledRightPanelCollapsed,
  onRightPanelCollapsedChange,
  panelLayout,
}) => {
  const { theme } = useTheme();
  const panelsTheme = usePanelsTheme();
  const [activeTab, setActiveTab] = useState<string>('fileTree');
  const [internalLeftPanelCollapsed, setInternalLeftPanelCollapsed] =
    useState(false);
  const [internalRightPanelCollapsed, setInternalRightPanelCollapsed] =
    useState(false);

  const isLeftPanelCollapsed =
    controlledLeftPanelCollapsed ?? internalLeftPanelCollapsed;
  const isRightPanelCollapsed =
    controlledRightPanelCollapsed ?? internalRightPanelCollapsed;

  useEffect(() => {
    if (controlledLeftPanelCollapsed !== undefined) {
      setInternalLeftPanelCollapsed(controlledLeftPanelCollapsed);
    }
  }, [controlledLeftPanelCollapsed]);

  useEffect(() => {
    if (controlledRightPanelCollapsed !== undefined) {
      setInternalRightPanelCollapsed(controlledRightPanelCollapsed);
    }
  }, [controlledRightPanelCollapsed]);

  const setLeftPanelCollapsed = useCallback(
    (collapsed: boolean) => {
      if (onLeftPanelCollapsedChange) {
        onLeftPanelCollapsedChange(collapsed);
      } else {
        setInternalLeftPanelCollapsed(collapsed);
      }
    },
    [onLeftPanelCollapsedChange],
  );

  const setRightPanelCollapsed = useCallback(
    (collapsed: boolean) => {
      if (onRightPanelCollapsedChange) {
        onRightPanelCollapsedChange(collapsed);
      } else {
        setInternalRightPanelCollapsed(collapsed);
      }
    },
    [onRightPanelCollapsedChange],
  );

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
  const [hoveredSearchResult, setHoveredSearchResult] = useState<string | null>(null);
  const [hoveredSearchLayer, setHoveredSearchLayer] =
    useState<HighlightLayer | null>(null);

  // Folder filter state
  const [folderFilterHighlightLayers, setFolderFilterHighlightLayers] = useState<HighlightLayer[]>([]);

  // File viewer modal state
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [viewerFilePath, setViewerFilePath] = useState<string | null>(null);
  const [viewerRelativePath, setViewerRelativePath] = useState<string | null>(
    null,
  );

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // File viewer in right panel state
  const [selectedCodeFile, setSelectedCodeFile] = useState<string | null>(null);
  const [selectedCodeFileAbsolutePath, setSelectedCodeFileAbsolutePath] =
    useState<string | null>(null);
  const [codeFileContent, setCodeFileContent] = useState<string | null>(null);
  const [loadingCodeFile, setLoadingCodeFile] = useState(false);

  // Package data state
  const [packageLayers, setPackageLayersState] = useState<
    PackageLayer[] | null
  >(sharedPackageLayers ?? null);

  useEffect(() => {
    if (sharedPackageLayers !== undefined) {
      setPackageLayersState(sharedPackageLayers);
    }
  }, [sharedPackageLayers]);

  const handlePackageLayersChange = useCallback(
    (layers: PackageLayer[] | null) => {
      setPackageLayersState(layers);
      onPackageLayersChange?.(layers);
    },
    [onPackageLayersChange],
  );

  // Toolbar state
  const [toolbarExpanded, setToolbarExpanded] = useState(false);

  // File color state - default to showing file colors
  const [showFileColors, setShowFileColors] = useState(true);

  // Package highlight state
  const [highlightedPackages, setHighlightedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [packageHighlightLayers, setPackageHighlightLayers] = useState<
    HighlightLayer[]
  >([]);
  const [toolsHighlightLayers, setToolsHighlightLayers] = useState<
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

  // Documentation state
  const [selectedDocPath, setSelectedDocPath] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<
    'markdown' | 'excalidraw'
  >('markdown');
  const [docContent, setDocContent] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docViewMode, setDocViewMode] = useState<'slides' | 'document'>(
    'document',
  );
  const [preferredDocViewMode, setPreferredDocViewMode] = useState<
    'slides' | 'document'
  >('document');
  const [currentSlide, setCurrentSlide] = useState(0);

  // Git changes from context (for highlight layers)
  const {
    getGitHighlightLayers,
    checkGitStatus,
    getGitState,
    initializeLocalSource,
    setGitChangesVisible,
  } = useGitChanges();
  const [gitHighlightLayers, setGitHighlightLayers] = useState<
    HighlightLayer[]
  >([]);

  // New git status with file lists from monitoring service
  const {
    gitStatusWithFiles,
    allModifiedFiles,
  } = useRepositoryGitStatus(
    activeFileTreeSource?.type === 'local' ? activeFileTreeSource.location : null
  );

  // Auto-initialize git state for local sources (loads HEAD tree)
  useEffect(() => {
    if (activeFileTreeSource?.type === 'local') {
      // Auto-initializing git state for local source
      initializeLocalSource(activeFileTreeSource);
    }
  }, [activeFileTreeSource, initializeLocalSource]);

  // Check git status and get layers when source changes
  useEffect(() => {
    if (activeFileTreeSource && activeFileTreeSource.type === 'local') {
      // Check git status for this source
      checkGitStatus(activeFileTreeSource).then(() => {
        // Get highlight layers
        const layers = getGitHighlightLayers(
          activeFileTreeSource.id,
          fileTree as FileTree | undefined,
        );
        setGitHighlightLayers(layers);
      });
    } else {
      setGitHighlightLayers([]);
    }
  }, [activeFileTreeSource, fileTree, checkGitStatus, getGitHighlightLayers]);

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

  // Track the current loading file to prevent race conditions
  const loadingFileRef = useRef<string | null>(null);

  const openFileInRightPane = useCallback(
    async (filePath: string) => {
      loadingFileRef.current = filePath;

      setSelectedFile(filePath);
      setSelectedCodeFile(filePath);

      const absolutePath =
        activeFileTreeSource?.type === 'local'
          ? filePath.startsWith('/')
            ? filePath
            : `${activeFileTreeSource.location}/${filePath}`
          : null;

      setSelectedCodeFileAbsolutePath(absolutePath);
      setLoadingCodeFile(true);
      setCodeFileContent(null);

      setRightPaneMode('document');

      try {
        let content: string | null = null;

        if (absolutePath) {
          const result = await FileSystemService.readFile(absolutePath);
          content = result?.content ?? null;
        } else {
          const relativePath = filePath.startsWith('/')
            ? filePath.substring(1)
            : filePath;
          content = await fileViewerContentProvider.readFileContent(relativePath);
        }

        if (loadingFileRef.current === filePath) {
          setCodeFileContent(content);
          setLoadingCodeFile(false);
        }
      } catch (error) {
        if (loadingFileRef.current === filePath) {
          console.error('[RepositoryExplorationView] Failed to load file:', error);
          setCodeFileContent(null);
          setLoadingCodeFile(false);
        }
      }
    },
    [activeFileTreeSource, fileViewerContentProvider],
  );

  const handleFileClick = useCallback(
    (filePath: string) => {
      void openFileInRightPane(filePath);
    },
    [openFileInRightPane],
  );

  const handleSearchFileSelect = useCallback(
    async (filePath: string, _lineNumbers?: number[], _searchQuery?: string) => {
      await openFileInRightPane(filePath);
    },
    [openFileInRightPane],
  );

  // Handle search results change for highlighting
  const handleSearchResultsChange = useCallback((results: string[]) => {
    setSearchResults(results);
  }, []);

  // Handle search result hover for highlighting
  const handleSearchResultHover = useCallback((filePath: string | null) => {
    setHoveredSearchResult(filePath);
  }, []);

  // Handle folder filter changes to create highlight layers
  const handleFolderFiltersChange = useCallback(
    (filters: Array<{ id: string; path: string; mode: 'include' | 'exclude' }>) => {
      if (filters.length === 0) {
        setFolderFilterHighlightLayers([]);
        return;
      }

      // Only create layers for included directories
      const includedFilters = filters.filter(f => f.mode === 'include');

      if (includedFilters.length === 0) {
        setFolderFilterHighlightLayers([]);
        return;
      }

      const layer: HighlightLayer = {
        id: 'folder-filters',
        name: `Filtered Folders (${includedFilters.length})`,
        enabled: true,
        color: '#22c55e', // Green for included folders
        opacity: 0.4,
        priority: 18, // Below search results but above base layers
        borderWidth: 2,
        items: includedFilters.map(filter => ({
          path: filter.path,
          type: 'directory' as const,
        })),
      };

      setFolderFilterHighlightLayers([layer]);
    },
    [],
  );

  // Right pane mode: for remote exploration we default to city and do not show terminal toggle
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>('city');

  // Tab and view change handlers (defined after state to avoid "used before assignment" errors)
  const handleTabChange = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      if (tabId !== 'docs') {
        setSelectedDocPath(null);
        setDocContent(null);
      }
    },
    [],
  );

  const handleRightPaneViewChange = useCallback(
    (mode: RightPaneView) => {
      setRightPaneMode(mode);
      if (mode === 'city') {
        setSelectedDocPath(null);
        setDocContent(null);
        setSelectedCodeFile(null);
        setSelectedCodeFileAbsolutePath(null);
        setCodeFileContent(null);
      }
    },
    [],
  );

  // Create content provider for search
  const searchContentProvider = useMemo<ContentProvider>(() => {
    // For local repositories, use filesystem provider for content search
    if (activeFileTreeSource?.type === 'local') {
      // This enables full content search for local files
      return new LocalFileSystemProvider();
    }
    // For remote repositories, use NullContentProvider to avoid API calls
    // This means remote repos only search filenames, not content
    return new NullContentProvider();
  }, [activeFileTreeSource]);

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
        items: [
          { path: packagePath, type: 'directory' as const }, // Highlight the entire package directory
        ],
        enabled: true,
        priority: 5,
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
        items: results.map((f) => ({ path: f, type: 'file' as const })),
        enabled: true,
        priority: 15,
      };
      setSearchHighlightLayer(layer);
    } else {
      setSearchHighlightLayer(null);
    }

  }, [searchQuery, performSimpleSearch]);

  // Initialize sources only if not using shared service
  useEffect(() => {
    if (sharedFileTreeService || sharedActiveSource) {
      // Skip initialization if using shared data
      return;
    }

    const initialSources =
      fileTreeSourceService.initializeFromRepository(repository);

    // Filter to only remote sources for exploration view
    // Local clones are handled through external workflows
    const remoteSources = initialSources.filter(
      (source) => source.type === 'remote',
    );

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

  // RepositoryExplorationView should never load its own tree - always use the one from RepositoryManager
  useEffect(() => {
    if (!sharedFileTree) {
      setLoading(false);
      setError('File tree not provided by RepositoryManager');
      console.error(
        '[RepositoryExploration] No file tree provided by RepositoryManager',
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

      // Handle root package - check for various root indicators including "package.json" itself
      const isRootPackage =
        !pkg.packageData.path ||
        pkg.packageData.path === '.' ||
        pkg.packageData.path === 'root' ||
        pkg.packageData.path === '' ||
        pkg.packageData.path === 'package.json';

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

    setPackageHighlightLayers(layers);
  }, [highlightedPackages, packageLayers]);

  // Handle documentation selection
  const handleDocumentSelect = useCallback(
    async (filePath: string, type: 'markdown' | 'excalidraw') => {
      setSelectedDocPath(filePath);
      setSelectedDocType(type);
      setLoadingDoc(true);
      // Use the preferred view mode when opening a new document
      setDocViewMode(preferredDocViewMode);
      setCurrentSlide(0); // Reset to first slide

      try {
        // For local sources, read from filesystem
        if (activeFileTreeSource?.type === 'local') {
          // Build full path for local files
          const fullPath = filePath.startsWith('/')
            ? filePath
            : `${activeFileTreeSource.location}/${filePath}`.replace(
                /\/+/g,
                '/',
              );

          const result = await FileSystemService.readFile(fullPath);
          if (result?.content) {
            setDocContent(result.content);
          } else {
            setDocContent(null);
          }
        } else if (activeFileTreeSource?.type === 'remote') {
          // For remote sources, use GitHub API
          const relativePath = filePath.startsWith('/')
            ? filePath.substring(1)
            : filePath;
          const content =
            await fileViewerContentProvider.readFileContent(relativePath);
          if (content) {
            setDocContent(content);
          } else {
            setDocContent(null);
          }
        }
      } catch (error) {
        console.error('Failed to load document:', error);
        setDocContent(null);
      } finally {
        setLoadingDoc(false);
      }
    },
    [activeFileTreeSource, fileViewerContentProvider, preferredDocViewMode],
  );

  // Get git state for source badges (moved here to be available for fileTrees)
  const gitState =
    activeFileTreeSource?.type === 'local'
      ? getGitState(activeFileTreeSource.id)
      : undefined;

  // Create a Map of file trees for the search tab (moved here to be available for tabs)
  const fileTrees = useMemo(() => {
    const trees = new Map<string, FileTree>();

    // Add the main file tree
    if (fileTree) {
      const treeId = activeFileTreeSource?.id || 'main';
      trees.set(treeId, fileTree);
    }

    // Add HEAD tree if available (for git repositories)
    if (gitState?.headTree && activeFileTreeSource?.type === 'local') {
      trees.set('HEAD', gitState.headTree);
    }

    return trees;
  }, [fileTree, gitState?.headTree, activeFileTreeSource]);

  const repositoryPathForTools =
    activeFileTreeSource?.type === 'local'
      ? activeFileTreeSource.location
      : repository.localClones?.[0]?.path || '';

  useEffect(() => {
    if (!repositoryPathForTools) {
      setToolsHighlightLayers([]);
    }
  }, [repositoryPathForTools]);

  // Create tabs configuration
  const tabs: PanelTabConfig[] = [
    {
      id: 'fileTree',
      label: 'Files',
      icon: <FolderTree size={14} />,
      visible: true,
      content: (
        <FileTreeTab
          fileTree={fileTree}
          onFileSelect={handleSearchFileSelect}
          loading={loading}
        />
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: <Search size={14} />,
      visible: true,
      content: (
        <RepositorySearchTab
          fileTrees={fileTrees}
          activeFileTreeSource={activeFileTreeSource}
          contentProvider={searchContentProvider}
          showEditorSelector={false} // Hide editor selector in explore view
          gitModifiedFiles={allModifiedFiles}
          gitStatusWithFiles={gitStatusWithFiles}
          onFileSelect={handleSearchFileSelect}
          selectedFile={selectedFile}
          onSearchResultsChange={handleSearchResultsChange}
          onSearchResultHover={handleSearchResultHover}
          onFolderFiltersChange={handleFolderFiltersChange}
        />
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
          onError={(error) => {
            console.error('Architecture panel error:', error);
          }}
          onPackageLayersChanged={handlePackageLayersChange}
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
    {
      id: 'tools',
      label: 'Tools',
      icon: <Wrench size={14} />,
      visible: true,
      content: (
        <ToolsTab
          packageLayers={packageLayers}
          repositoryPath={repositoryPathForTools}
          onHighlightLayersChange={setToolsHighlightLayers}
        />
      ),
    },
    {
      id: 'docs',
      label: 'Docs',
      icon: <Book size={14} />,
      visible: true, // Always show, will display message if not registered
      content: (
        <AlexandriaDocsPanel
          repositoryPath={
            activeFileTreeSource?.location ||
            repository.localClones[0]?.path ||
            ''
          }
          onDocumentSelect={handleDocumentSelect}
          selectedDocument={selectedDocPath ?? undefined}
        />
      ),
    },
  ];

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

    // Git changes tool (for local sources)
    if (activeFileTreeSource?.type === 'local' && gitState) {
      const changeCount =
        (gitState.gitStatus?.modified?.length || 0) +
        (gitState.gitStatus?.created?.length || 0) +
        (gitState.gitStatus?.deleted?.length || 0);

      items.push({
        id: 'git-changes',
        label: gitState.hasNoCommits ? 'No commits yet' : `Git Changes`,
        shortLabel: 'Git',
        icon: <GitBranch />,
        count: gitState.hasNoCommits ? undefined : changeCount,
        color: '#f59e0b',
        active: gitState.enabled && !gitState.hasNoCommits,
        onClick: () => {
          if (!gitState.hasNoCommits && activeFileTreeSource) {
            // Just toggle visibility, don't reload HEAD tree
            setGitChangesVisible(activeFileTreeSource.id, !gitState.enabled);
          }
        },
        tooltip: gitState.hasNoCommits
          ? 'Repository has no commits yet'
          : `${gitState.enabled ? 'Hide' : 'Show'} git changes (${changeCount} changes)`,
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

    // Package highlights
    if (highlightedPackages.size > 0) {
      items.push({
        id: 'package-highlights',
        label: 'Package Highlights',
        shortLabel: 'Packages',
        icon: <Layers />,
        count: highlightedPackages.size,
        color: '#10b981',
        active: true,
        onClick: () => {
          setHighlightedPackages(new Set());
        },
        tooltip: `Clear package highlights (${highlightedPackages.size} highlighted)`,
      });
    }

    return items;
  }, [
    showFileColors,
    searchResults.length,
    selectedNoteIds.size,
    highlightedPackages.size,
    gitState,
    activeFileTreeSource,
    setGitChangesVisible,
  ]);

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

  // Create custom right panel content for file viewing (from search results)
  const fileViewerRightPanel = selectedCodeFile ? (
    <RepoManagerCodePreview
      key={selectedCodeFile} // Force remount when selecting a different file
      filePath={selectedCodeFile}
      absolutePath={selectedCodeFileAbsolutePath}
      content={codeFileContent}
      loading={loadingCodeFile}
      onClose={() => {
        setSelectedCodeFile(null);
        setSelectedCodeFileAbsolutePath(null);
        setCodeFileContent(null);
        setSelectedFile(null);
        setRightPaneMode('city');
      }}
    />
  ) : null;

  // Create custom right panel content for document viewing
  const documentRightPanel =
    selectedDocPath && docContent && activeTab === 'docs' ? (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: theme.colors.background,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Document header with collapse button */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            backgroundColor: theme.colors.backgroundLight,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Collapse button */}
            <button
              onClick={() => setLeftPanelCollapsed(!isLeftPanelCollapsed)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                color: theme.colors.textSecondary,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={isLeftPanelCollapsed ? 'Show panel' : 'Hide panel'}
            >
              {isLeftPanelCollapsed ? (
                <PanelLeft size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </button>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                {selectedDocPath.split('/').pop()}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                }}
              >
                {selectedDocPath}
              </span>
            </div>
          </div>

          {/* View mode switcher for markdown files */}
          {selectedDocType === 'markdown' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => {
                  setDocViewMode('document');
                  setPreferredDocViewMode('document');
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background:
                    docViewMode === 'document'
                      ? theme.colors.primary
                      : 'transparent',
                  color:
                    docViewMode === 'document'
                      ? '#fff'
                      : theme.colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
                title="View as document"
              >
                Document
              </button>
              <button
                onClick={() => {
                  setDocViewMode('slides');
                  setPreferredDocViewMode('slides');
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background:
                    docViewMode === 'slides'
                      ? theme.colors.primary
                      : 'transparent',
                  color:
                    docViewMode === 'slides'
                      ? '#fff'
                      : theme.colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
                title="View as slides"
              >
                Slides
              </button>
            </div>
          )}
        </div>

        {/* Document content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {loadingDoc ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: theme.colors.textSecondary,
              }}
            >
              Loading document...
            </div>
          ) : selectedDocType === 'excalidraw' ? (
            <ExcalidrawWrapper
              initialData={(() => {
                try {
                  return JSON.parse(docContent);
                } catch {
                  return { elements: [], appState: {}, files: {} };
                }
              })()}
              onChange={() => {}}
            />
          ) : (
            <MarkdownDocumentViewer
              viewMode={docViewMode}
              showEditor={false}
              content={docContent}
              slides={docContent.split('\n\n---\n\n')}
              currentSlide={currentSlide}
              theme={theme}
              showSegmented={true}
              onContentChange={() => {}}
              onSlideNavigate={setCurrentSlide}
              onCheckboxChange={() => {}}
            />
          )}
        </div>
      </div>
    ) : null;

  // Check if we should show document view or file viewer instead of city
  const showDocumentView =
    activeTab === 'docs' && selectedDocPath && docContent;
  const showCodeFileViewer = selectedCodeFile; // Show viewer as soon as file is selected, not waiting for content
  const shouldShowDocument = showDocumentView || showCodeFileViewer;
  const documentPanelContent = showDocumentView
    ? documentRightPanel
    : showCodeFileViewer
      ? fileViewerRightPanel
      : null;
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      const nextTab = visibleTabs[0];
      if (nextTab) {
        handleTabChange(nextTab.id);
      }
    }
  }, [visibleTabs, activeTab, handleTabChange]);

  const leftPanelTabs: PanelTabDefinition[] = visibleTabs.map(
    ({ visible: _visible, content, ...tab }) => ({
      ...tab,
      content: (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              boxSizing: 'border-box',
            }}
          >
            {content}
          </div>
        </div>
      ),
    }),
  );

  const rightPaneViewMode = (
    shouldShowDocument
      ? 'document'
      : rightPaneMode === 'terminal'
        ? 'city'
        : rightPaneMode
  ) as RightPaneView;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CityMapManager
        fileTree={fileTree}
        activeSource={activeFileTreeSource}
        gitEnabled={gitState?.enabled}
        headTree={gitState?.headTree}
        hasNoCommits={gitState?.hasNoCommits}
        viewMode="explore"
        renderCustomBadges={() => (
          <>
            {fileTreeSources.length > 1 && (
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
            )}
          </>
        )}
      >
        {({ cityData: managedCityData, sourceBadges, isBuilding }) => {
          // When docs tab is active and left panel is collapsed, render in full width mode
          if (
            activeTab === 'docs' &&
            isLeftPanelCollapsed &&
            selectedDocPath &&
            docContent
          ) {
            return (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '16px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    overflow: 'hidden',
                  }}
                >
                  {documentRightPanel}
                </div>
              </div>
            );
          }

          // Otherwise render the shared three panel layout with the repository panels
          const highlightLayers = shouldShowDocument
            ? []
            : [
                ...(showFileColors ? fileColorHighlightLayers : []),
                ...noteHighlightLayers,
                ...folderFilterHighlightLayers,
                ...(searchHighlightLayer ? [searchHighlightLayer] : []),
                ...(hoveredSearchLayer ? [hoveredSearchLayer] : []),
                ...(selectedFileLayer ? [selectedFileLayer] : []),
                ...dependencyAnalysisHighlightLayer,
                ...packageHighlightLayers,
                ...toolsHighlightLayers,
                ...gitHighlightLayers,
              ];

          const rightPanel = (
            <div
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderLeft: 'none',
                overflow: 'hidden',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <RightPaneContainer
                activeView={rightPaneViewMode}
                onViewChange={handleRightPaneViewChange}
                cityData={shouldShowDocument ? null : managedCityData}
                highlightLayers={highlightLayers}
                loading={shouldShowDocument ? false : loading || isBuilding}
                treeStats={shouldShowDocument ? null : treeStats}
                onFileClick={handleFileClick}
                activeSource={activeFileTreeSource}
                sessions={[]}
                sessionFileActivities={new Map()}
                repository={repository}
                onHelpClick={() => setShowHelpModal(true)}
                headerExtra={undefined}
                sourceBadges={shouldShowDocument ? null : sourceBadges}
                loadingMessage="Loading repository structure"
                emptyMessage="Select a branch to explore"
                showViewSwitcher={true}
                toolbarItems={shouldShowDocument ? [] : toolbarItems}
                toolbarExpanded={toolbarExpanded}
                onToolbarExpandedChange={setToolbarExpanded}
                documentContent={documentPanelContent}
              />
            </div>
          );

          const layout: PanelLayout = panelLayout || {
            left: 'left',
            middle: 'terminal',
            right: 'middle',
          };

          // Terminal panel - defined after layout so we can check visibility
          const isTerminalVisible = layout.middle === 'terminal' || layout.left === 'terminal' || layout.right === 'terminal';
          const terminalPanel = activeFileTreeSource?.type === 'local' ? (
            <TerminalPanel
              directory={activeFileTreeSource.location}
              context="dashboard"
              isVisible={isTerminalVisible}
              hideHeader={false}
              key={`terminal-${activeFileTreeSource.location}`}
            />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.textSecondary,
                padding: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: theme.colors.text }}>
                Terminal Unavailable
              </div>
              <div style={{ fontSize: '14px' }}>
                Terminal is only available for local repository clones
              </div>
            </div>
          );

          const panels: TabbedPanelDefinition[] = [
            {
              id: 'left',
              label: 'Search & Tools',
              content: null,
              tabs: leftPanelTabs,
              activeTab: activeTab,
              activeTabId: activeTab,
              onTabChange: handleTabChange,
              onActiveTabChange: handleTabChange,
            },
            {
              id: 'terminal',
              label: 'Terminal',
              content: terminalPanel,
            },
            {
              id: 'middle',
              label: 'City Visualization',
              content: rightPanel,
            },
          ];

          return (
            <div
              style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
              }}
            >
              <ConfigurablePanelLayout
                panels={panels}
                layout={layout}
                collapsiblePanels={{ left: true, right: true }}
                defaultSizes={{ left: 20, middle: 45, right: 35 }}
                minSizes={{ left: 15, middle: 30, right: 25 }}
                collapsed={{ left: isLeftPanelCollapsed, right: isRightPanelCollapsed }}
                showCollapseButtons={false}
                onLeftCollapseComplete={() => setLeftPanelCollapsed(true)}
                onLeftExpandComplete={() => setLeftPanelCollapsed(false)}
                onRightCollapseComplete={() => setRightPanelCollapsed(true)}
                onRightExpandComplete={() => setRightPanelCollapsed(false)}
                style={{ height: '100%', width: '100%' }}
                theme={panelsTheme}
              />
            </div>
          );
        }}
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
    </div>
  );
};
