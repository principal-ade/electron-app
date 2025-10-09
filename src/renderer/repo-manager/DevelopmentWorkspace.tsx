import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitBranch,
  Layers,
  Search,
  FileText,
  Book,
  Palette,
  Wrench,
  FolderTree,
  Activity,
  ListTodo,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { HighlightLayer } from '@principal-ai/code-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { PackageLayer } from '@principal-ai/codebase-composition';
import {
  ConfigurablePanelLayout,
  type PanelDefinitionWithContent,
  type PanelLayout,
  type TabsConfig,
} from '@a24z/panels';
import '@a24z/panels/panels.css';
import { CityMapManager } from './shared/CityMapManager';
import { AlexandriaDocsPanel } from './shared/AlexandriaDocsPanel';
import TerminalPanel from '../panels/TerminalPanel';
import { TabbedTerminalPanel } from '../panels/components/TabbedTerminalPanel';

import type { Repository } from '../../shared/types/repository.types';
import { RightPaneMode } from '../../shared/types/userPreferences.types';
import { RepositoryNote } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { RepositoryNotesService } from '../main-process-api/RepositoryNotesService';
// import { SourceSelectionService } from '../services/SourceSelectionService'; // TODO: Re-enable when needed
import { FileTreeSource, FileTreeStats } from '../types/file-tree-source';
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
import { useRepositoryData } from '../hooks/useRepositoryData';
import { RepositorySearchTab } from '../components/repository-maps/RepositorySearchTab';
import { ToolsTab } from './shared/ToolsTab';
import { RightPaneView } from '../components/repository-maps/RightPaneContainer';
import { FileTreeTab } from '../panels/components/FileTreeTab';
import { FileTreePanelContent } from '../panels/components/FileTreePanelContent';
import { RepositoryPanelProvider } from '../panels/RepositoryPanelProvider';
import { GitChangesPanel } from '../panels/components/GitChangesPanel';
import {
  MarkdownRenderingPanel,
  ExcalidrawPanel,
} from './panels';
import { FilePreviewPanel } from '../panels/components/FilePreviewPanel';
import { AgentEventsPanel } from '../panels/components/AgentEventsPanel';
import type { EventHighlightService } from './services/EventHighlightService';
import { useHighlightLayers } from '../contexts/HighlightLayersContext';
import { CityVisualizationPanel } from '../panels/components/CityVisualizationPanel';
import { TasksPanel } from '../panels/components/TasksPanel';

type PanelTabConfig = { id: string; label: string; icon?: React.ReactNode; content: React.ReactNode; visible?: boolean };

interface DevelopmentWorkspaceProps {
  repository: Repository;
  repositoryKey: string;
  remoteData: {
    owner: string;
    repo: string;
    defaultBranch: string;
  };
  searchQuery?: string;

  // Shared tree data from parent
  activeFileTreeSource?: FileTreeSource | null;
  cityDataCache?: unknown;

  // Package layers shared from parent
  packageLayers?: PackageLayer[] | null;
  onPackageLayersChange?: (layers: PackageLayer[] | null) => void;

  // Panel layout state
  leftPanelCollapsed?: boolean;
  onLeftPanelCollapsedChange?: (collapsed: boolean) => void;
  rightPanelCollapsed?: boolean;
  onRightPanelCollapsedChange?: (collapsed: boolean) => void;
  panelLayout?: PanelLayout;
  panelSizes?: { left: number; middle: number; right: number };
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  panelPreferencesLoaded?: boolean;

  // Event highlighting
  eventHighlightLayers?: HighlightLayer[];
  eventHighlightService?: EventHighlightService;
}

export const DevelopmentWorkspace: React.FC<
  DevelopmentWorkspaceProps
> = ({
  repository,
  repositoryKey,
  remoteData,
  searchQuery,
  activeFileTreeSource: sharedActiveSource,
  cityDataCache: _cityDataCache,
  packageLayers: sharedPackageLayers,
  onPackageLayersChange,
  leftPanelCollapsed: controlledLeftPanelCollapsed,
  onLeftPanelCollapsedChange,
  rightPanelCollapsed: controlledRightPanelCollapsed,
  onRightPanelCollapsedChange,
  panelLayout,
  panelSizes,
  onPanelSizesChange,
  panelPreferencesLoaded = true,
  eventHighlightLayers,
  eventHighlightService,
}) => {
  const { theme } = useTheme();
  const { registerLayer, unregisterLayer } = useHighlightLayers();
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

  // Register event highlight layers with context
  useEffect(() => {
    if (!eventHighlightLayers || eventHighlightLayers.length === 0) {
      // Unregister all event highlight layers
      eventHighlightLayers?.forEach((_, idx) => {
        unregisterLayer(`event-highlight-${idx}`);
      });
      return;
    }

    console.log('[DevelopmentWorkspace] Registering event highlight layers:', eventHighlightLayers.length);

    // Register all event highlight layers
    eventHighlightLayers.forEach((layer, idx) => {
      registerLayer(`event-highlight-${idx}`, {
        name: layer.name,
        enabled: layer.enabled,
        color: layer.color,
        priority: layer.priority,
        items: layer.items,
      });
    });

    // Cleanup: unregister on unmount
    return () => {
      eventHighlightLayers.forEach((_, idx) => {
        unregisterLayer(`event-highlight-${idx}`);
      });
    };
  }, [eventHighlightLayers, registerLayer, unregisterLayer]);

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

  // Data loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sources state
  const [fileTreeSources, setFileTreeSources] = useState<FileTreeSource[]>([]);
  const [activeFileTreeSource, setActiveFileTreeSource] =
    useState<FileTreeSource | null>(sharedActiveSource || null);

  // Repository data
  const [treeStats, setTreeStats] = useState<FileTreeStats | null>(null);
  const [fileTree, setFileTree] = useState<FileTree | null>(null);

  // Subscribe to file tree updates from RepositoryDataCache
  const repositoryPath = activeFileTreeSource?.type === 'local' ? activeFileTreeSource.location : null;
  const { data: cacheData } = useRepositoryData(repositoryPath, {
    autoLoad: true,
    subscribe: true,
  });

  // Update local fileTree state when cache data changes
  useEffect(() => {
    if (cacheData?.fileTree) {
      setFileTree(cacheData.fileTree);
      setLoading(false);
    }
  }, [cacheData?.fileTree]);

  // Compute tree stats from fileTree
  useEffect(() => {
    if (fileTree && fileTree.stats) {
      setTreeStats({
        fileCount: fileTree.stats.totalFiles,
        directoryCount: fileTree.stats.totalDirectories,
        loadedAt: Date.now(),
      });
    } else {
      setTreeStats(null);
    }
  }, [fileTree]);

  useEffect(() => {
    if (sharedActiveSource !== undefined) {
      setActiveFileTreeSource(sharedActiveSource);
    }
  }, [sharedActiveSource]);


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

  // Git status is now handled by RepositoryPanelProvider for GitChangesPanel
  // No longer needed in parent component

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

  // Register git highlight layers
  useEffect(() => {
    if (!gitHighlightLayers || gitHighlightLayers.length === 0) {
      return;
    }

    console.log('[DevelopmentWorkspace] Registering git highlight layers:', gitHighlightLayers.length);

    // Register each git layer
    gitHighlightLayers.forEach((layer, idx) => {
      registerLayer(`git-highlight-${idx}`, {
        name: layer.name,
        enabled: layer.enabled,
        color: layer.color,
        priority: layer.priority,
        items: layer.items,
      });
    });

    return () => {
      gitHighlightLayers.forEach((_, idx) => {
        unregisterLayer(`git-highlight-${idx}`);
      });
    };
  }, [gitHighlightLayers, registerLayer, unregisterLayer]);

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

  // Handle documentation selection - now just sets the path, panel loads content itself
  const handleDocumentSelect = useCallback(
    async (filePath: string, type: 'markdown' | 'excalidraw') => {
      setSelectedDocPath(filePath);
      setSelectedDocType(type);
      setRightPaneMode('document');
    },
    [],
  );

  // Handle task click - open task markdown in viewer
  const handleTaskClick = useCallback(
    async (task: any) => {
      // Tasks are stored in .palace-work/tasks/active/ directory
      const taskDocPath = task.documentPath || `${repositoryPath}/.palace-work/tasks/active/${task.id}.task.md`;
      setSelectedDocPath(taskDocPath);
      setSelectedDocType('markdown');
      setRightPaneMode('document');
    },
    [repositoryPath],
  );

  const openFileInRightPane = useCallback(
    async (filePath: string) => {
      setSelectedFile(filePath);

      // Check if it's a markdown file
      const isMarkdown = filePath.toLowerCase().endsWith('.md') || filePath.toLowerCase().endsWith('.mdx');

      if (isMarkdown) {
        // Open in BOTH markdown viewer and code viewer (editor)
        setSelectedDocPath(filePath);
        setSelectedDocType('markdown');
        setSelectedCodeFile(filePath); // Also open in editor
        setRightPaneMode('document');
      } else {
        // Show all other files in code viewer only
        setSelectedCodeFile(filePath);
        setRightPaneMode('document');
      }
    },
    [],
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

  const _handleRightPaneViewChange = useCallback(
    (mode: RightPaneView) => {
      setRightPaneMode(mode);
      if (mode === 'city') {
        setSelectedDocPath(null);
        setDocContent(null);
        setSelectedCodeFile(null);
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

  // Create panel content map - matches registry IDs
  const panelContentMap = React.useMemo(() => {
    const map: Record<string, React.ReactNode> = {
      fileTree: (
        <RepositoryPanelProvider
          repositoryPath={
            activeFileTreeSource?.type === 'local'
              ? activeFileTreeSource.location
              : null
          }
          actions={{ openFile: handleSearchFileSelect }}
        >
          <FileTreePanelContent onFileSelect={handleSearchFileSelect} />
        </RepositoryPanelProvider>
      ),
      search: (
        <RepositorySearchTab
          fileTrees={fileTrees}
          activeFileTreeSource={activeFileTreeSource}
          contentProvider={searchContentProvider}
          showEditorSelector={false}
          onFileSelect={handleSearchFileSelect}
          selectedFile={selectedFile}
          onSearchResultsChange={handleSearchResultsChange}
          onSearchResultHover={handleSearchResultHover}
          onFolderFiltersChange={handleFolderFiltersChange}
        />
      ),
      gitChanges: (
        <RepositoryPanelProvider
          repositoryPath={
            activeFileTreeSource?.type === 'local'
              ? activeFileTreeSource.location
              : null
          }
          actions={{ openFile: handleFileClick }}
        >
          <GitChangesPanel variant="tab" />
        </RepositoryPanelProvider>
      ),
      dependencies: activeFileTreeSource ? (
        <RepoSourceArchitecturePanelSimple
          source={activeFileTreeSource}
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
      tools: (
        <ToolsTab
          packageLayers={packageLayers}
          repositoryPath={repositoryPathForTools}
          onHighlightLayersChange={setToolsHighlightLayers}
        />
      ),
      docs: (
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
      agentEvents: (
        <AgentEventsPanel
          repositoryPath={
            activeFileTreeSource?.type === 'local'
              ? activeFileTreeSource.location
              : null
          }
          maxEvents={100}
        />
      ),
      tasks: (
        <TasksPanel
          repositoryPath={
            activeFileTreeSource?.type === 'local'
              ? activeFileTreeSource.location
              : repository.localClones?.[0]?.path || ''
          }
          onTaskClick={handleTaskClick}
        />
      ),
    };
    return map;
  }, [
    fileTree,
    loading,
    handleSearchFileSelect,
    fileTrees,
    activeFileTreeSource,
    searchContentProvider,
    selectedFile,
    handleSearchResultsChange,
    handleSearchResultHover,
    handleFolderFiltersChange,
    handleFileClick,
    handlePackageLayersChange,
    handlePackageAnalysisStart,
    handlePackageAnalysisEnd,
    handlePackageSelected,
    handlePackageDeselected,
    theme.colors.textSecondary,
    packageLayers,
    repositoryPathForTools,
    setToolsHighlightLayers,
    repository.localClones,
    handleDocumentSelect,
    selectedDocPath,
  ]);

  // Build tabs from registry using panel content
  const tabs: PanelTabConfig[] = [
    { id: 'fileTree', label: 'Files', icon: <FolderTree size={14} />, visible: true, content: panelContentMap.fileTree },
    { id: 'search', label: 'Search', icon: <Search size={14} />, visible: true, content: panelContentMap.search },
    { id: 'gitChanges', label: 'Git Changes', icon: <GitBranch size={14} />, visible: activeFileTreeSource?.type === 'local', content: panelContentMap.gitChanges },
    { id: 'dependencies', label: 'Dependencies', icon: <Layers size={14} />, visible: true, content: panelContentMap.dependencies },
    { id: 'tools', label: 'Tools', icon: <Wrench size={14} />, visible: true, content: panelContentMap.tools },
    { id: 'docs', label: 'Docs', icon: <Book size={14} />, visible: true, content: panelContentMap.docs },
    { id: 'agentEvents', label: 'Agent Events', icon: <Activity size={14} />, visible: true, content: panelContentMap.agentEvents },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo size={14} />, visible: true, content: panelContentMap.tasks },
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

  const visibleTabs = tabs.filter((tab) => tab.visible !== false);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      const nextTab = visibleTabs[0];
      if (nextTab) {
        handleTabChange(nextTab.id);
      }
    }
  }, [visibleTabs, activeTab, handleTabChange]);

  // Memoize viewer panels to ensure they re-render when state changes
  const codeViewerPanel = useMemo(
    () => {
      return (
        <FilePreviewPanel
          filePath={selectedCodeFile}
          source={activeFileTreeSource}
          contentProvider={fileViewerContentProvider}
          onClose={() => {
            setSelectedCodeFile(null);
            setSelectedFile(null);
          }}
        />
      );
    },
    [selectedCodeFile, activeFileTreeSource, fileViewerContentProvider],
  );

  const markdownViewerPanel = useMemo(
    () => {
      const shouldShow = selectedDocType !== 'excalidraw';
      return (
        <MarkdownRenderingPanel
          filePath={shouldShow ? selectedDocPath : null}
          source={activeFileTreeSource}
          contentProvider={fileViewerContentProvider}
          onClose={() => {
            setSelectedDocPath(null);
            setSelectedDocType('markdown');
          }}
        />
      );
    },
    [selectedDocPath, selectedDocType, activeFileTreeSource, fileViewerContentProvider],
  );

  const excalidrawDiagramPanel = useMemo(
    () => (
      <ExcalidrawPanel
        docPath={selectedDocType === 'excalidraw' ? selectedDocPath : null}
        source={activeFileTreeSource}
        contentProvider={fileViewerContentProvider}
        onClose={() => {
          setSelectedDocPath(null);
          setSelectedDocType('markdown');
        }}
      />
    ),
    [selectedDocPath, selectedDocType, activeFileTreeSource, fileViewerContentProvider],
  );

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

  const leftPanelTabs: PanelDefinitionWithContent[] = visibleTabs.map(
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
              boxSizing: 'border-box',
            }}
          >
            {content}
          </div>
        </div>
      ),
    }),
  );

  const _rightPaneViewMode = (
    rightPaneMode === 'terminal'
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
            selectedDocPath
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

          // City visualization panel (standalone, decoupled from document viewing)
          const cityPanel = (
            <CityVisualizationPanel
              cityData={managedCityData}
              treeStats={treeStats}
              onFileClick={handleFileClick}
              onHelpClick={() => setShowHelpModal(true)}
              loading={loading || isBuilding}
              loadingMessage="Loading repository structure"
              emptyMessage="Select a branch to explore"
              sourceBadges={sourceBadges}
              toolbarItems={toolbarItems}
              toolbarExpanded={toolbarExpanded}
            />
          );

          const propsPanelLayout = panelLayout || {
            left: 'left',
            middle: 'terminal',
            right: 'middle',
          };

          // Terminal panel - defined after layout so we can check visibility
          const isTerminalVisible = propsPanelLayout.middle === 'terminal' || propsPanelLayout.left === 'terminal' || propsPanelLayout.right === 'terminal';
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

          // Tabbed Terminal panel - defined after layout so we can check visibility
          const isTabbedTerminalVisible = propsPanelLayout.middle === 'tabbedTerminal' || propsPanelLayout.left === 'tabbedTerminal' || propsPanelLayout.right === 'tabbedTerminal';
          const tabbedTerminalPanel = activeFileTreeSource?.type === 'local' ? (
            <TabbedTerminalPanel
              directory={activeFileTreeSource.location}
              repositoryKey={repositoryKey}
              isVisible={isTabbedTerminalVisible}
              hideHeader={false}
              key={`tabbed-terminal-${activeFileTreeSource.location}`}
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

          // Create all panel definitions - expose individual panels for configuration
          const allPanels: PanelDefinitionWithContent[] = [
            // Individual panel tabs (can now be configured independently)
            ...leftPanelTabs,
            // Other panels
            {
              id: 'terminal',
              label: 'Terminal',
              content: terminalPanel,
            },
            {
              id: 'tabbedTerminal',
              label: 'Tabbed Terminal',
              content: tabbedTerminalPanel,
            },
            {
              id: 'cityVisualization',
              label: 'City Visualization',
              content: cityPanel,
            },
            // Viewer panels - memoized to re-render when state changes
            {
              id: 'codeViewer',
              label: 'Code Viewer',
              content: codeViewerPanel,
            },
            {
              id: 'markdownViewer',
              label: 'Markdown Viewer',
              content: markdownViewerPanel,
            },
            {
              id: 'excalidrawDiagram',
              label: 'Excalidraw Diagram',
              content: excalidrawDiagramPanel,
            },
          ];

          // Default layout: fileTree + docs tabs in left, city in middle, search + tools tabs in right
          // User can reconfigure via PanelConfigurator
          const defaultLayout: PanelLayout = {
            left: {
              type: 'tabs',
              panels: ['fileTree', 'docs'],
              config: {
                defaultActiveTab: 0,
                tabPosition: 'top',
              } as TabsConfig,
            },
            middle: 'cityVisualization',
            right: {
              type: 'tabs',
              panels: ['search', 'gitChanges', 'dependencies', 'tools'],
              config: {
                defaultActiveTab: 0,
                tabPosition: 'top',
              } as TabsConfig,
            },
          };

          // Wait for panel preferences to be loaded from parent before rendering
          if (!panelPreferencesLoaded) {
            return (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.background,
                }}
              >
                <div style={{ color: theme.colors.textSecondary }}>Loading...</div>
              </div>
            );
          }

          // Use provided layout or default
          const actualPanelLayout: PanelLayout = panelLayout || defaultLayout;

          return (
            <div
              style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
              }}
            >
              <ConfigurablePanelLayout
                panels={allPanels}
                layout={actualPanelLayout}
                collapsiblePanels={{ left: true, right: true }}
                defaultSizes={panelSizes ?? { left: 20, middle: 45, right: 35 }}
                minSizes={{ left: 15, middle: 30, right: 25 }}
                collapsed={{ left: isLeftPanelCollapsed, right: isRightPanelCollapsed }}
                showCollapseButtons={false}
                onPanelResize={onPanelSizesChange}
                onLeftCollapseComplete={() => setLeftPanelCollapsed(true)}
                onLeftExpandComplete={() => setLeftPanelCollapsed(false)}
                onRightCollapseComplete={() => setRightPanelCollapsed(true)}
                onRightExpandComplete={() => setRightPanelCollapsed(false)}
                style={{ height: '100%', width: '100%' }}
                theme={theme}
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
