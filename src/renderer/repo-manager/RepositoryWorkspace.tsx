import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  FolderTree,
  Search,
  GitBranch,
  Layers,
  Wrench,
  Book,
  Building2,
  Terminal as TerminalIcon,
  FileCode,
  FileText,
  Presentation,
  Pencil,
  Activity,
  ListTodo,
  AlertCircle,
  GitPullRequest,
  Palette,
  Package,
  History,
} from 'lucide-react';
import { parseGitHubUrl } from '../../shared/utils/githubUrlParser';
import { PackageLayer } from '@principal-ai/codebase-composition';
import { RepositoryTitlebar } from '../components/Titlebar';

import type {
  Repository,
  GitChangeSelectionStatus,
} from '../../shared/types/repository.types';
import { SecretsModal } from './shared/SecretsModal';
import { LinksModal } from './shared/LinksModal';
import { SourceBadgeHelpModal } from './shared/SourceBadgeHelpModal';
import { BadgeInfoModal } from './shared/BadgeInfoModal';
import { PanelConfiguratorModal } from './shared/PanelConfiguratorModal';
import { AddNoteModal } from '../principal-window/views/RepositoryExplorer/components/AddNoteModal';
import {
  ConfigurablePanelLayout,
  type PanelDefinition,
  type PanelDefinitionWithContent,
  type PanelLayout,
  type TabsConfig,
} from '@a24z/panels';
import '@a24z/panels/panels.css';
import { GitChangesProvider } from '../contexts/GitChangesContext';
import { HighlightLayersProvider } from '../contexts/HighlightLayersContext';
import { GitService } from '../main-process-api/GitService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { CityDataCacheService } from '../services/CityDataCacheService';
import { FileTreeSource, FileTreeStats } from '../types/file-tree-source';
import { SourceSelectionService } from '../services/SourceSelectionService';
import { CloneVisibilityService } from '../services/CloneVisibilityService';
import { AgentConfigurationService } from '../main-process-api/AgentConfigurationService';
import { SupportedAgent } from '@principal-ai/agent-monitoring';
import { EventHighlightService } from './services/EventHighlightService';
import { AgentSessionSDKService } from '../main-process-api/AgentSessionSDKService';
import type { HighlightLayer } from '@principal-ai/code-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { WorkspaceLayoutService } from '../services/WorkspaceLayoutService';
import type { WorkspaceLayout } from '../../shared/types/userPreferences.types';
import { RightPaneMode } from '../../shared/types/userPreferences.types';
import { RepositoryNote } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { RepositoryNotesService } from '../main-process-api/RepositoryNotesService';
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
import { ToolsPanel } from '../panels/components/ToolsPanel';
import { RightPaneView } from '../components/repository-maps/RightPaneContainer';
import { FileTreePanelContent } from '../panels/components/FileTreePanelContent';
import { RepositoryPanelProvider } from '../panels/RepositoryPanelProvider';
import { GitChangesPanel } from '../panels/components/GitChangesPanel';
import { GitIssuesPanel } from '../panels/components/GitIssuesPanel';
import { GitPullRequestsPanel } from '../panels/components/GitPullRequestsPanel';
import { GitCommitHistoryPanel } from '../panels/components/GitCommitHistoryPanel';
import { MarkdownRenderingPanel, ExcalidrawPanel } from './panels';
import { FilePreviewPanel } from '../panels/components/FilePreviewPanel';
import { GitDiffPanel } from '../panels/components/GitDiffPanel';
import { AgentEventsPanel } from '../panels/components/AgentEventsPanel';
import { AgentSessionsPanel } from '../panels/components/AgentSessionsPanel';
import { AgentContextTreePanel } from '../panels/components/AgentContextTreePanel';
import { useHighlightLayers } from '../contexts/HighlightLayersContext';
import { CityVisualizationPanel } from '../panels/components/CityVisualizationPanel';
import { TasksPanel } from '../panels/components/TasksPanel';
import { DrawingsListPanel } from '../panels/components/DrawingsListPanel';
import { QualityHexagonPanel } from '../panels/components/QualityHexagonPanel';
import { CityMapManager } from './shared/CityMapManager';
import { AlexandriaDocsPanel } from './shared/AlexandriaDocsPanel';
import { MultiTerminalPanel } from '../panels/components/MultiTerminalPanel';
import { panelPreviewRegistry } from '../panels/panelPreviews';
import { repositoryPanelDefinitions } from '../panels/registry';

type PanelTabConfig = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  visible?: boolean;
};

interface RepositoryWorkspaceProps {
  repository: Repository;
  onBack?: () => void;
  hasUpdateAvailable?: boolean;
}

// Internal component that uses the highlight layers context
const RepositoryWorkspaceInternal: React.FC<RepositoryWorkspaceProps> =
  React.memo(({ repository, onBack, hasUpdateAvailable }) => {
    const { theme } = useTheme();
    const { registerLayer, unregisterLayer } = useHighlightLayers();

    // Search state - TODO: Move to floating search component in bottom-left corner
    const [searchQuery] = useState<string>(''); // setSearchQuery will be used when search is implemented

    // Modal states
    const [showSecretsModal, setShowSecretsModal] = useState(false);
    const [showLinksModal, setShowLinksModal] = useState(false);
    const [showAddNoteModal, setShowAddNoteModal] = useState(false);
    const [showSourceHelpModal, setShowSourceHelpModal] = useState(false);
    const [showBadgeInfoModal, setShowBadgeInfoModal] = useState(false);
    const [showPanelConfigModal, setShowPanelConfigModal] = useState(false);
    const [cloneBranchStatuses, setCloneBranchStatuses] = useState<
      Record<string, any>
    >({});

    // Panel layout state - default layout ('old-school' workspace)
    const [panelLayout, setPanelLayout] = useState<PanelLayout>({
      left: {
        type: 'tabs',
        panels: ['fileTree', 'search', 'gitChanges', 'docs'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top',
        },
      },
      middle: {
        type: 'tabs',
        panels: ['codeViewer', 'markdownViewer'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top',
        },
      },
      right: {
        type: 'tabs',
        panels: ['multiTerminal', 'cityVisualization'],
        config: {
          defaultActiveTab: 0,
          tabPosition: 'top',
        },
      },
    });

    // Terminal panel state
    const [showAllTerminals, setShowAllTerminals] = useState(false);

    // Workspace layout state
    const [availableWorkspaces, setAvailableWorkspaces] = useState<
      Record<string, WorkspaceLayout>
    >({});
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
      null,
    );
    const [workspacesLoaded, setWorkspacesLoaded] = useState(false);
    const [hasStateDeviation, setHasStateDeviation] = useState(false);
    const [panelResetKey, setPanelResetKey] = useState(0);
    const [leftPanelActiveTabIndex, setLeftPanelActiveTabIndex] =
      useState<number>(0);
    const [middlePanelActiveTabIndex, setMiddlePanelActiveTabIndex] =
      useState<number>(0);
    const [rightPanelActiveTabIndex, setRightPanelActiveTabIndex] =
      useState<number>(0);

    // File tree services - shared across all views
    const cityDataCache = useMemo(() => new CityDataCacheService(), []);

    // File tree state - unified around selected source
    const [selectedSource, setSelectedSource] = useState<FileTreeSource | null>(
      null,
    );
    const [packageLayers, setPackageLayers] = useState<PackageLayer[] | null>(
      null,
    );

    // MCP Agent configuration state
    const [agentsWithMCP, setAgentsWithMCP] = useState<SupportedAgent[]>([]);
    const [loadingAgentMCPStatus, setLoadingAgentMCPStatus] = useState(true);

    // Event highlight service - convert agent events to map highlights
    const [eventHighlightService] = useState(() => new EventHighlightService());
    const [eventHighlightLayers, setEventHighlightLayers] = useState<
      HighlightLayer[]
    >([]);

    // Parse repository info
    const repoInfo = useMemo(
      () => parseGitHubUrl(repository.remoteUrl),
      [repository.remoteUrl],
    );
    const ghOwner = repoInfo?.owner || repository.owner;
    const ghRepo = repoInfo?.repo || repository.name;

    const repositoryKey = useMemo(() => {
      const owner = ghOwner || repository.owner;
      const name = ghRepo || repository.name;
      if (owner && name) {
        return `${owner}/${name}`;
      }
      return repository.remoteUrl;
    }, [
      ghOwner,
      ghRepo,
      repository.owner,
      repository.name,
      repository.remoteUrl,
    ]);

    const [panelCollapsedState, setPanelCollapsedState] = useState<{
      left?: boolean;
      right?: boolean;
    }>({ left: false, right: true }); // 'old-school' default: right collapsed
    const [panelSizes, setPanelSizes] = useState<{
      left: number;
      middle: number;
      right: number;
    }>({
      left: 20,
      middle: 50,
      right: 30,
    }); // 'old-school' default sizes
    const [panelPreferencesLoaded, setPanelPreferencesLoaded] = useState(false);

    // Panel content state (from DevelopmentWorkspace)
    const [activeTab, setActiveTab] = useState<string>('fileTree');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileTreeSources, setFileTreeSources] = useState<FileTreeSource[]>(
      [],
    );
    const [treeStats, setTreeStats] = useState<FileTreeStats | null>(null);
    const [fileTree, setFileTree] = useState<FileTree | null>(null);

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
    const [hoveredSearchResult, setHoveredSearchResult] = useState<
      string | null
    >(null);
    const [hoveredSearchLayer, setHoveredSearchLayer] =
      useState<HighlightLayer | null>(null);

    // Folder filter state
    const [folderFilterHighlightLayers, setFolderFilterHighlightLayers] =
      useState<HighlightLayer[]>([]);

    // File viewer modal state
    const [showFileViewer, setShowFileViewer] = useState(false);
    const [viewerFilePath, setViewerFilePath] = useState<string | null>(null);
    const [viewerRelativePath, setViewerRelativePath] = useState<string | null>(
      null,
    );

    // Help modal state
    const [showHelpModal, setShowHelpModal] = useState(false);

    // File viewer in right panel state
    const [selectedCodeFile, setSelectedCodeFile] = useState<string | null>(
      null,
    );
    const [selectedDiffFile, setSelectedDiffFile] = useState<
      { path: string; status?: GitChangeSelectionStatus } | null
    >(null);

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
    const [createExcalidrawTrigger, setCreateExcalidrawTrigger] = useState(0);

    // Right pane mode
    const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>('city');

    // Git changes from context
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

    // Subscribe to file tree updates from RepositoryDataCache
    const repositoryPath =
      selectedSource?.type === 'local' ? selectedSource.location : null;
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

    // Load saved repository state (workspace + sizes + collapsed)
    useEffect(() => {
      let isMounted = true;
      const loadRepositoryState = async () => {
        try {
          const repoState =
            await WorkspaceLayoutService.getRepositoryState(repositoryKey);

          if (isMounted && repoState) {
            // Set workspace ID
            setCurrentWorkspaceId(repoState.workspaceId);

            // Apply layout from workspace or custom
            if (repoState.workspaceId) {
              const workspace = await WorkspaceLayoutService.getWorkspaceLayout(
                repoState.workspaceId,
              );
              if (workspace) {
                setPanelLayout(workspace.layout);
              }
            } else if (repoState.layout) {
              // Custom layout (no workspace)
              setPanelLayout(repoState.layout);
            }

            // Apply saved sizes and collapsed state
            setPanelSizes(repoState.sizes);
            setPanelCollapsedState(repoState.collapsed);
          }
        } catch (error) {
          console.error(
            '[RepositoryWorkspace] Failed to load repository state:',
            error,
          );
        } finally {
          if (isMounted) {
            setPanelPreferencesLoaded(true);
          }
        }
      };

      loadRepositoryState();

      return () => {
        isMounted = false;
      };
    }, [repositoryKey]);

    // Initialize and load workspace layouts (once per repository)
    useEffect(() => {
      let isMounted = true;

      const loadWorkspaces = async () => {
        try {
          // Initialize workspace layouts if needed
          await WorkspaceLayoutService.initializeWorkspaceLayouts();

          // Load all available workspaces
          const workspaces = await WorkspaceLayoutService.getWorkspaceLayouts();
          if (isMounted) {
            setAvailableWorkspaces(workspaces);
            setWorkspacesLoaded(true);
          }
        } catch (error) {
          console.error(
            '[RepositoryWorkspace] Failed to load workspace layouts:',
            error,
          );
          if (isMounted) {
            setWorkspacesLoaded(true);
          }
        }
      };

      loadWorkspaces();

      return () => {
        isMounted = false;
      };
    }, [repositoryKey]);

    // Detect when layout changes and check for drift from workspace defaults
    useEffect(() => {
      if (!workspacesLoaded || !panelPreferencesLoaded) return;

      const checkLayoutAndDrift = async () => {
        // If no workspace is selected, try to match current layout to a workspace
        if (!currentWorkspaceId) {
          const matchingWorkspaceId =
            await WorkspaceLayoutService.findMatchingWorkspace(panelLayout);
          setCurrentWorkspaceId(matchingWorkspaceId);
          setHasStateDeviation(false);
          return;
        }

        // If workspace is selected, check for drift
        const workspace = availableWorkspaces[currentWorkspaceId];
        if (workspace) {
          const deviation = WorkspaceLayoutService.hasStateDeviation(
            {
              workspaceId: currentWorkspaceId,
              sizes: panelSizes,
              collapsed: panelCollapsedState,
            },
            workspace,
          );
          setHasStateDeviation(
            deviation.hasSizeDeviation || deviation.hasCollapsedDeviation,
          );
        }
      };

      checkLayoutAndDrift();
    }, [
      panelLayout,
      panelSizes,
      panelCollapsedState,
      workspacesLoaded,
      panelPreferencesLoaded,
      currentWorkspaceId,
      availableWorkspaces,
    ]);

    const persistCollapsedState = useCallback(
      async (collapsed: { left?: boolean; right?: boolean }) => {
        try {
          await WorkspaceLayoutService.updateRepositoryCollapsed(
            repositoryKey,
            collapsed,
          );
        } catch (error) {
          console.error(
            '[RepositoryWorkspace] Failed to persist collapsed state:',
            error,
          );
        }
      },
      [repositoryKey],
    );

    const handleLeftPanelCollapsedChange = useCallback(
      (collapsed: boolean) => {
        const newCollapsed = { ...panelCollapsedState, left: collapsed };
        setPanelCollapsedState(newCollapsed);
        if (panelPreferencesLoaded) {
          void persistCollapsedState(newCollapsed);
        }
      },
      [panelPreferencesLoaded, persistCollapsedState, panelCollapsedState],
    );

    const handleRightPanelCollapsedChange = useCallback(
      (collapsed: boolean) => {
        const newCollapsed = { ...panelCollapsedState, right: collapsed };
        setPanelCollapsedState(newCollapsed);
        if (panelPreferencesLoaded) {
          void persistCollapsedState(newCollapsed);
        }
      },
      [panelPreferencesLoaded, persistCollapsedState, panelCollapsedState],
    );

    const persistPanelLayout = useCallback(
      async (layout: PanelLayout) => {
        try {
          // When layout changes, save as custom layout (workspaceId = null)
          await WorkspaceLayoutService.setRepositoryState(repositoryKey, {
            workspaceId: null,
            layout,
            sizes: panelSizes,
            collapsed: panelCollapsedState,
          });
        } catch (error) {
          console.error(
            '[RepositoryWorkspace] Failed to persist panel layout:',
            error,
          );
        }
      },
      [repositoryKey, panelSizes, panelCollapsedState],
    );

    const handlePanelLayoutChange = useCallback(
      (layout: PanelLayout) => {
        setPanelLayout(layout);
        if (panelPreferencesLoaded) {
          void persistPanelLayout(layout);
        }
      },
      [panelPreferencesLoaded, persistPanelLayout],
    );

    const persistPanelSizes = useCallback(
      async (sizes: { left: number; middle: number; right: number }) => {
        try {
          await WorkspaceLayoutService.updateRepositorySizes(
            repositoryKey,
            sizes,
          );
        } catch (error) {
          console.error(
            '[RepositoryWorkspace] Failed to persist panel sizes:',
            error,
          );
        }
      },
      [repositoryKey],
    );

    // Debounce panel size changes to avoid too frequent saves
    const [pendingPanelSizes, setPendingPanelSizes] = useState<{
      left: number;
      middle: number;
      right: number;
    } | null>(null);

    useEffect(() => {
      if (!pendingPanelSizes || !panelPreferencesLoaded) return;

      const timeoutId = setTimeout(() => {
        void persistPanelSizes(pendingPanelSizes);
        setPendingPanelSizes(null);
      }, 500); // Debounce by 500ms

      return () => clearTimeout(timeoutId);
    }, [pendingPanelSizes, panelPreferencesLoaded, persistPanelSizes]);

    const handlePanelSizesChange = useCallback(
      (sizes: { left: number; middle: number; right: number }) => {
        setPanelSizes(sizes);
        if (panelPreferencesLoaded) {
          setPendingPanelSizes(sizes);
        }
      },
      [panelPreferencesLoaded],
    );

    // Workspace layout handlers
    const handleWorkspaceSelect = useCallback(
      async (workspaceId: string) => {
        const workspace = availableWorkspaces[workspaceId];
        if (!workspace) {
          console.error(
            `[RepositoryWorkspace] Workspace ${workspaceId} not found`,
          );
          return;
        }

        const newSizes = workspace.defaultSizes || {
          left: 20,
          middle: 45,
          right: 35,
        };
        const newCollapsed = workspace.defaultCollapsed || {
          left: false,
          right: false,
        };

        // Apply workspace layout
        setPanelLayout(workspace.layout);
        setPanelSizes(newSizes);
        setPanelCollapsedState(newCollapsed);
        setCurrentWorkspaceId(workspaceId);
        setPanelResetKey((prev) => prev + 1); // Force panel remount

        // Save repository state (workspace + current sizes/collapsed)
        await WorkspaceLayoutService.setRepositoryState(repositoryKey, {
          workspaceId,
          sizes: newSizes,
          collapsed: newCollapsed,
        });
      },
      [availableWorkspaces, repositoryKey],
    );

    const handleSaveWorkspace = useCallback(
      async (
        name: string,
        options?: {
          description?: string;
          includeSizes?: boolean;
          includeCollapsed?: boolean;
        },
      ) => {
        try {
          const workspace = await WorkspaceLayoutService.createWorkspaceLayout(
            name,
            panelLayout,
            {
              description: options?.description,
              defaultSizes: options?.includeSizes ? panelSizes : undefined,
              defaultCollapsed: options?.includeCollapsed
                ? panelCollapsedState
                : undefined,
            },
          );

          // Update available workspaces
          setAvailableWorkspaces((prev) => ({
            ...prev,
            [workspace.id]: workspace,
          }));

          // Set as current workspace
          setCurrentWorkspaceId(workspace.id);

          // Save repository state with this workspace
          await WorkspaceLayoutService.setRepositoryState(repositoryKey, {
            workspaceId: workspace.id,
            sizes: panelSizes,
            collapsed: panelCollapsedState,
          });

          return workspace;
        } catch (error) {
          console.error(
            '[RepositoryWorkspace] Failed to save workspace:',
            error,
          );
          throw error;
        }
      },
      [panelLayout, panelSizes, panelCollapsedState, repositoryKey],
    );

    const handleUpdateWorkspaceDefaults = useCallback(async () => {
      if (!currentWorkspaceId) return;

      try {
        await WorkspaceLayoutService.updateWorkspaceFromRepositoryState(
          currentWorkspaceId,
          repositoryKey,
        );

        // Reload workspaces to reflect updated defaults
        const workspaces = await WorkspaceLayoutService.getWorkspaceLayouts();
        setAvailableWorkspaces(workspaces);
        setHasStateDeviation(false);
      } catch (error) {
        console.error(
          '[RepositoryWorkspace] Failed to update workspace defaults:',
          error,
        );
      }
    }, [currentWorkspaceId, repositoryKey]);

    const handleResetToWorkspaceDefaults = useCallback(async () => {
      if (!currentWorkspaceId) return;

      const workspace = availableWorkspaces[currentWorkspaceId];
      if (!workspace) return;

      try {
        const defaultSizes = workspace.defaultSizes || {
          left: 20,
          middle: 45,
          right: 35,
        };
        const defaultCollapsed = workspace.defaultCollapsed || {
          left: false,
          right: false,
        };

        // Update UI state immediately
        setPanelSizes(defaultSizes);
        setPanelCollapsedState(defaultCollapsed);
        setHasStateDeviation(false);
        setPanelResetKey((prev) => prev + 1); // Force panel remount

        // Persist to repository state
        await WorkspaceLayoutService.resetRepositoryToWorkspaceDefaults(
          repositoryKey,
          currentWorkspaceId,
        );
      } catch (error) {
        console.error(
          '[RepositoryWorkspace] Failed to reset to workspace defaults:',
          error,
        );
      }
    }, [currentWorkspaceId, repositoryKey, availableWorkspaces]);

    const handleSwitchPanels = useCallback(() => {
      // Swap right and middle panel configurations
      const newLayout: PanelLayout = {
        left: panelLayout.left,
        middle: panelLayout.right,
        right: panelLayout.middle,
      };

      // Update the layout
      handlePanelLayoutChange(newLayout);
    }, [panelLayout, handlePanelLayoutChange]);

    // Check which agents have MCP configured (once on mount)
    useEffect(() => {
      const checkAgentMCPStatus = async () => {
        setLoadingAgentMCPStatus(true);
        const agentsWithMCPEnabled: SupportedAgent[] = [];

        try {
          // Check each supported agent for MCP configuration
          for (const agent of Object.values(SupportedAgent)) {
            const mcpStatus =
              await AgentConfigurationService.getAgentMCPStatus(agent);
            if (mcpStatus.success && mcpStatus.status?.hasMCP) {
              agentsWithMCPEnabled.push(agent);
            }
          }
          setAgentsWithMCP(agentsWithMCPEnabled);
          console.info(
            '[RepositoryWorkspace] Agents with MCP enabled:',
            agentsWithMCPEnabled,
          );
        } catch (error) {
          console.error(
            '[RepositoryWorkspace] Failed to check agent MCP status:',
            error,
          );
        } finally {
          setLoadingAgentMCPStatus(false);
        }
      };

      checkAgentMCPStatus();
    }, []); // Only run once on mount

    // Initialize selected source from repository and register with monitoring service
    useEffect(() => {
      const initializeAndRegister = async () => {
        const defaultSource =
          SourceSelectionService.getSelectedSource(repository);
        if (defaultSource) {
          setSelectedSource(defaultSource);

          // Register repository with monitoring service for local clones
          if (repository.localClones && repository.localClones.length > 0) {
            const visibleClonePath =
              CloneVisibilityService.getVisibleClonePath(repository);
            if (visibleClonePath) {
              try {
                // Start monitoring service if not already started
                console.log(
                  '[RepositoryWorkspace] Starting monitoring service...',
                );
                await RepositoryMonitoringService.startMonitoring();
                console.log('[RepositoryWorkspace] Monitoring service started');

                console.log(
                  '[RepositoryWorkspace] Registering repository with monitoring service:',
                  visibleClonePath,
                );
                await RepositoryMonitoringService.registerRepository(
                  visibleClonePath,
                );
                console.log(
                  '[RepositoryWorkspace] Repository registered successfully',
                );

                // Enable git watching for the repository
                console.log(
                  '[RepositoryWorkspace] Enabling git watching for repository:',
                  visibleClonePath,
                );
                const result =
                  await RepositoryMonitoringService.enableGitWatching(
                    visibleClonePath,
                  );
                if (result.success) {
                  console.log(
                    '[RepositoryWorkspace] Git watching enabled successfully',
                  );
                } else {
                  console.warn(
                    '[RepositoryWorkspace] Failed to enable git watching:',
                    result.error,
                  );
                }
              } catch (error) {
                console.error(
                  '[RepositoryWorkspace] Failed to register repository:',
                  error,
                );
              }
            }
          }
        }
      };

      initializeAndRegister();

      // Cleanup: disable git watching on unmount
      return () => {
        const visibleClonePath =
          CloneVisibilityService.getVisibleClonePath(repository);
        if (visibleClonePath) {
          RepositoryMonitoringService.disableGitWatching(visibleClonePath)
            .then((result) => {
              if (result.success) {
                console.log(
                  '[RepositoryWorkspace] Git watching disabled on unmount',
                );
              }
            })
            .catch((error) => {
              console.error(
                '[RepositoryWorkspace] Failed to disable git watching on unmount:',
                error,
              );
            });
        }
      };
    }, [repository]);

    // Set up event highlight service - listen for agent events
    useEffect(() => {
      const visibleClonePath =
        CloneVisibilityService.getVisibleClonePath(repository);
      if (!visibleClonePath) {
        console.log(
          '[RepositoryWorkspace] No visible clone path for event highlighting',
        );
        return;
      }

      console.log(
        '[RepositoryWorkspace] Setting up event highlight service for:',
        visibleClonePath,
      );

      // Set repository context
      eventHighlightService.setRepository(visibleClonePath);

      // Subscribe to processed events
      const unsubscribe = AgentSessionSDKService.onProcessedEvent((event) => {
        console.log(
          '[RepositoryWorkspace] Received agent event:',
          event.eventType,
          event.toolName,
        );
        eventHighlightService.processEvent(event);
      });

      // Listen for highlight updates
      const handleHighlightUpdate = (layers: HighlightLayer[]) => {
        console.log(
          '[RepositoryWorkspace] Highlight layers updated:',
          layers.length,
        );
        setEventHighlightLayers(layers);
      };

      eventHighlightService.on('highlight-update', handleHighlightUpdate);

      return () => {
        console.log(
          '[RepositoryWorkspace] Cleaning up event highlight service',
        );
        unsubscribe();
        eventHighlightService.off('highlight-update', handleHighlightUpdate);
      };
    }, [repository, eventHighlightService]);

    // Listen for repository updates (e.g., new clones added)
    useEffect(() => {
      const handleCloneAdded = (data: {
        repository: Repository;
        clonePath: string;
      }) => {
        if (data.repository.remoteUrl === repository.remoteUrl) {
          console.info(
            '[RepositoryWorkspace] Clone added to current repository:',
            data.clonePath,
          );
        }
      };

      const handleCloneRemoved = (data: {
        repository: Repository;
        clonePath: string;
      }) => {
        if (data.repository.remoteUrl === repository.remoteUrl) {
          console.info(
            '[RepositoryWorkspace] Clone removed from current repository:',
            data.clonePath,
          );

          // If the removed clone was the selected one, we need to handle it
          if (
            selectedSource?.type === 'local' &&
            selectedSource.location === data.clonePath
          ) {
            // Select another clone or fall back to remote
            if (data.repository.localClones.length > 0) {
              const newSource = SourceSelectionService.getSelectedSource(
                data.repository,
              );
              if (newSource) {
                setSelectedSource(newSource);
              }
            } else {
              // Fall back to remote source if available
              const remoteSource = SourceSelectionService.getAvailableSources(
                data.repository,
              ).find((s) => s.type === 'remote');
              if (remoteSource) {
                setSelectedSource(remoteSource);
                SourceSelectionService.setSelectedSource(
                  data.repository.remoteUrl,
                  remoteSource.id,
                );
              }
            }
          }
        }
      };

      // Subscribe to repository events using GitService
      const unsubscribeCloneAdded =
        GitService.onRepositoryCloneAdded(handleCloneAdded);
      const unsubscribeCloneRemoved =
        GitService.onRepositoryCloneRemoved(handleCloneRemoved);

      // Cleanup listeners on unmount
      return () => {
        unsubscribeCloneAdded();
        unsubscribeCloneRemoved();
      };
    }, [repository.remoteUrl, selectedSource]);

    // Register event highlight layers with context
    useEffect(() => {
      if (!eventHighlightLayers || eventHighlightLayers.length === 0) {
        // Unregister all event highlight layers
        eventHighlightLayers?.forEach((_, idx) => {
          unregisterLayer(`event-highlight-${idx}`);
        });
        return;
      }

      console.log(
        '[RepositoryWorkspace] Registering event highlight layers:',
        eventHighlightLayers.length,
      );

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

    // Auto-initialize git state for local sources (loads HEAD tree)
    useEffect(() => {
      if (selectedSource?.type === 'local') {
        initializeLocalSource(selectedSource);
      }
    }, [selectedSource, initializeLocalSource]);

    // Check git status and get layers when source changes
    useEffect(() => {
      if (selectedSource && selectedSource.type === 'local') {
        checkGitStatus(selectedSource).then(() => {
          const layers = getGitHighlightLayers(
            selectedSource.id,
            fileTree as FileTree | undefined,
          );
          setGitHighlightLayers(layers);
        });
      } else {
        setGitHighlightLayers([]);
      }
    }, [selectedSource, fileTree, checkGitStatus, getGitHighlightLayers]);

    // Register git highlight layers
    useEffect(() => {
      if (!gitHighlightLayers || gitHighlightLayers.length === 0) {
        return;
      }

      console.log(
        '[RepositoryWorkspace] Registering git highlight layers:',
        gitHighlightLayers.length,
      );

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

    // Register tools highlight layers
    useEffect(() => {
      if (!toolsHighlightLayers || toolsHighlightLayers.length === 0) {
        return;
      }

      console.log(
        '[RepositoryWorkspace] Registering tools highlight layers:',
        toolsHighlightLayers.length,
      );

      // Register each tools layer
      toolsHighlightLayers.forEach((layer, idx) => {
        registerLayer(`tools-highlight-${idx}`, {
          name: layer.name,
          enabled: layer.enabled,
          color: layer.color,
          opacity: layer.opacity,
          priority: layer.priority,
          items: layer.items,
        });
      });

      return () => {
        toolsHighlightLayers.forEach((_, idx) => {
          unregisterLayer(`tools-highlight-${idx}`);
        });
      };
    }, [toolsHighlightLayers, registerLayer, unregisterLayer]);

    // Separate provider for viewing individual files
    const fileViewerContentProvider = useMemo(() => {
      return new GitHubContentProvider(
        ghOwner || '',
        ghRepo || '',
        selectedSource?.metadata?.currentBranch ||
          repository.metadata?.defaultBranch ||
          'main',
      );
    }, [
      ghOwner,
      ghRepo,
      repository.metadata?.defaultBranch,
      selectedSource?.metadata?.currentBranch,
    ]);

    // Helper function to focus a specific panel tab (searches all panels)
    const focusPanelTab = useCallback(
      (panelId: string) => {
        // Check left panel
        const leftPanel = panelLayout.left;
        if (
          typeof leftPanel === 'object' &&
          leftPanel !== null &&
          'type' in leftPanel &&
          leftPanel.type === 'tabs'
        ) {
          const tabIndex = leftPanel.panels.indexOf(panelId);
          if (tabIndex !== -1) {
            setLeftPanelActiveTabIndex(tabIndex);
            return; // Found it, we're done
          }
        }

        // Check middle panel
        const middlePanel = panelLayout.middle;
        if (
          typeof middlePanel === 'object' &&
          middlePanel !== null &&
          'type' in middlePanel &&
          middlePanel.type === 'tabs'
        ) {
          const tabIndex = middlePanel.panels.indexOf(panelId);
          if (tabIndex !== -1) {
            setMiddlePanelActiveTabIndex(tabIndex);
            return; // Found it, we're done
          }
        }

        // Check right panel
        const rightPanel = panelLayout.right;
        if (
          typeof rightPanel === 'object' &&
          rightPanel !== null &&
          'type' in rightPanel &&
          rightPanel.type === 'tabs'
        ) {
          const tabIndex = rightPanel.panels.indexOf(panelId);
          if (tabIndex !== -1) {
            setRightPanelActiveTabIndex(tabIndex);
            return; // Found it, we're done
          }
        }

        // Panel not found in any tab group (it's either a single panel or doesn't exist)
        // This is fine - single panels don't need focusing
      },
      [panelLayout],
    );

    // Handle documentation selection
    const handleDocumentSelect = useCallback(
      async (filePath: string, type: 'markdown' | 'excalidraw') => {
        setSelectedDocPath(filePath);
        setSelectedDocType(type);
        setRightPaneMode('document');
        // Focus the appropriate viewer tab
        if (type === 'markdown') {
          focusPanelTab('markdownViewer');
        } else {
          focusPanelTab('excalidrawDiagram');
        }
      },
      [focusPanelTab],
    );

    // Handle task click - open task markdown in viewer
    const handleTaskClick = useCallback(
      async (task: any) => {
        const taskDocPath =
          task.documentPath ||
          `${repositoryPath}/.palace-work/tasks/active/${task.id}.task.md`;
        setSelectedDocPath(taskDocPath);
        setSelectedDocType('markdown');
        setRightPaneMode('document');
        // Focus the markdown viewer tab
        focusPanelTab('markdownViewer');
      },
      [repositoryPath, focusPanelTab],
    );

    const openFileInRightPane = useCallback(
      async (filePath: string) => {
        setSelectedDiffFile(null);
        setSelectedFile(filePath);

        // Check if it's a markdown file
        const isMarkdown =
          filePath.toLowerCase().endsWith('.md') ||
          filePath.toLowerCase().endsWith('.mdx');

        if (isMarkdown) {
          // Open in BOTH markdown viewer and code viewer (editor)
          setSelectedDocPath(filePath);
          setSelectedDocType('markdown');
          setSelectedCodeFile(filePath);
          setRightPaneMode('document');
          // Focus the markdown viewer tab
          focusPanelTab('markdownViewer');
        } else {
          // Show all other files in code viewer only
          setSelectedCodeFile(filePath);
          setRightPaneMode('document');
          // Focus the code viewer tab
          focusPanelTab('codeViewer');
        }
      },
      [focusPanelTab],
    );

    const handleFileClick = useCallback(
      (filePath: string) => {
        void openFileInRightPane(filePath);
      },
      [openFileInRightPane],
    );

    const handleGitChangeSelect = useCallback(
      (filePath: string, status?: GitChangeSelectionStatus) => {
        setSelectedFile(filePath);
        setSelectedDiffFile({ path: filePath, status });
        setRightPaneMode('document');
        focusPanelTab('gitDiffViewer');
      },
      [focusPanelTab],
    );

    const handleSearchFileSelect = useCallback(
      async (
        filePath: string,
        _lineNumbers?: number[],
        _searchQuery?: string,
      ) => {
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
      (
        filters: Array<{
          id: string;
          path: string;
          mode: 'include' | 'exclude';
        }>,
      ) => {
        if (filters.length === 0) {
          setFolderFilterHighlightLayers([]);
          return;
        }

        // Only create layers for included directories
        const includedFilters = filters.filter((f) => f.mode === 'include');

        if (includedFilters.length === 0) {
          setFolderFilterHighlightLayers([]);
          return;
        }

        const layer: HighlightLayer = {
          id: 'folder-filters',
          name: `Filtered Folders (${includedFilters.length})`,
          enabled: true,
          color: '#22c55e',
          opacity: 0.4,
          priority: 18,
          borderWidth: 2,
          items: includedFilters.map((filter) => ({
            path: filter.path,
            type: 'directory' as const,
          })),
        };

        setFolderFilterHighlightLayers([layer]);
      },
      [],
    );

    // Tab and view change handlers
    const handleTabChange = useCallback((tabId: string) => {
      setActiveTab(tabId);
      if (tabId !== 'docs') {
        setSelectedDocPath(null);
      }
    }, []);

    // Create content provider for search
    const searchContentProvider = useMemo<ContentProvider>(() => {
      if (selectedSource?.type === 'local') {
        return new LocalFileSystemProvider();
      }
      return new NullContentProvider();
    }, [selectedSource]);

    // Handle dependency analysis highlighting
    const handlePackageAnalysisStart = useCallback(
      (packagePath: string, packageName: string) => {
        if (!fileTree) return;

        setAnalyzingPackagePath(packagePath);
        setPackageHighlightLayers([]);

        const highlightLayer: HighlightLayer = {
          id: 'dependency-analysis',
          name: `Analyzing ${packageName}`,
          color: '#0ea5e9',
          opacity: 0.9,
          items: [{ path: packagePath, type: 'directory' as const }],
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

      if (prevAnalyzingPath && fileTree && packageLayers) {
        const packageData = packageLayers.find(
          (pkg) => pkg.packageData.path === prevAnalyzingPath,
        );
        if (packageData) {
          const highlightLayer: HighlightLayer = {
            id: 'package-selection',
            name: `Selected ${packageData.packageData.name}`,
            color: '#22c55e',
            opacity: 0.9,
            items: [
              { path: prevAnalyzingPath, type: 'directory' as const },
              {
                path: packageData.packageData.manifestPath,
                type: 'file' as const,
              },
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

        if (analyzingPackagePath === packagePath) return;

        const highlightLayer: HighlightLayer = {
          id: 'package-selection',
          name: `Selected ${packageName}`,
          color: '#22c55e',
          opacity: 0.9,
          items: [{ path: packagePath, type: 'directory' as const }],
          enabled: true,
          priority: 5,
        };

        setPackageHighlightLayers([highlightLayer]);
      },
      [fileTree, analyzingPackagePath],
    );

    const handlePackageDeselected = useCallback(() => {
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

        for (const file of fileTree.allFiles || []) {
          if (
            file.name.toLowerCase().includes(lowerQuery) ||
            file.relativePath.toLowerCase().includes(lowerQuery)
          ) {
            results.push(file.relativePath);

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

      const results = performSimpleSearch(searchQuery);
      setSearchResults(results);

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

    // Handler for when a note is added
    const handleNoteAdded = useCallback(async () => {
      if (!repository.remoteUrl) return;
      try {
        const notes = await RepositoryNotesService.getNotesForRepository(
          repository.remoteUrl,
        );
        setTribalKnowledgeNotes(notes);
      } catch (error) {
        console.error('Failed to fetch repository notes:', error);
      }
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
        color: '#3b82f6',
        priority: 25,
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
        color: '#fbbf24',
        priority: 40,
        borderWidth: 3,
        items: [
          {
            path: hoveredSearchResult,
            type: 'file' as const,
            renderStrategy: 'fill',
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

      let relativePath = selectedFile;
      if (selectedFile.includes('/')) {
        const parts = selectedFile.split('/');
        const repoNameIndex = parts.findIndex(
          (part) => part === repository.name,
        );
        if (repoNameIndex !== -1 && repoNameIndex < parts.length - 1) {
          relativePath = parts.slice(repoNameIndex + 1).join('/');
        } else {
          relativePath = selectedFile.substring(
            selectedFile.lastIndexOf('/') + 1,
          );
        }
      }

      const layer: HighlightLayer = {
        id: 'selected-file',
        name: 'Selected File',
        enabled: true,
        color: '#10b981',
        priority: 30,
        items: [
          {
            path: relativePath,
            type: 'file' as const,
            renderStrategy: 'fill',
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
      const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
      let colorIndex = 0;

      for (const packageId of highlightedPackages) {
        const pkg = packageLayers.find((p) => p.id === packageId);
        if (!pkg) continue;

        const items: Array<{
          path: string;
          type: 'file' | 'directory';
          renderStrategy?: 'fill' | 'border';
        }> = [];

        const isRootPackage =
          !pkg.packageData.path ||
          pkg.packageData.path === '.' ||
          pkg.packageData.path === 'root' ||
          pkg.packageData.path === '' ||
          pkg.packageData.path === 'package.json';

        if (isRootPackage) {
          items.push({
            path: '',
            type: 'directory' as const,
            renderStrategy: 'fill',
          });
          const manifestFile = pkg.packageData.manifestPath || 'package.json';
          items.push({
            path: manifestFile,
            type: 'file' as const,
            renderStrategy: 'fill',
          });
        } else {
          items.push({
            path: pkg.packageData.path,
            type: 'directory' as const,
            renderStrategy: 'fill',
          });
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
          priority: 35 + colorIndex,
          items,
        };

        layers.push(layer);
        colorIndex++;
      }

      setPackageHighlightLayers(layers);
    }, [highlightedPackages, packageLayers]);

    // Get git state for source badges
    const gitState =
      selectedSource?.type === 'local'
        ? getGitState(selectedSource.id)
        : undefined;

    // Create a Map of file trees for the search tab
    const fileTrees = useMemo(() => {
      const trees = new Map<string, FileTree>();

      if (fileTree) {
        const treeId = selectedSource?.id || 'main';
        trees.set(treeId, fileTree);
      }

      if (gitState?.headTree && selectedSource?.type === 'local') {
        trees.set('HEAD', gitState.headTree);
      }

      return trees;
    }, [fileTree, gitState?.headTree, selectedSource]);

    const repositoryPathForTools =
      selectedSource?.type === 'local'
        ? selectedSource.location
        : repository.localClones?.[0]?.path || '';

    useEffect(() => {
      if (!repositoryPathForTools) {
        setToolsHighlightLayers([]);
      }
    }, [repositoryPathForTools]);

    useEffect(() => {
      setSelectedDiffFile(null);
    }, [selectedSource?.id]);

    const repositoryPanelMetadata = React.useMemo(() => {
      return repositoryPanelDefinitions.reduce(
        (map, definition) => {
          map.set(definition.id, {
            label: definition.label,
            description: definition.description,
          });
          return map;
        },
        new Map<string, { label: string; description?: string }>(),
      );
    }, []);

    const availablePanelDefinitions = React.useMemo<PanelDefinition[]>(() => {
      return Object.entries(panelPreviewRegistry).map(([id, metadata]) => {
        const definition = repositoryPanelMetadata.get(id);
        const label = definition?.label ?? metadata.label ?? id;
        return {
          id,
          label,
          description: definition?.description ?? metadata.description,
          icon: metadata.icon,
          preview: metadata.preview,
        } satisfies PanelDefinition;
      });
    }, [repositoryPanelMetadata]);

    // Create panel content map - matches registry IDs
    const panelContentMap = React.useMemo(() => {
      const map: Record<string, React.ReactNode> = {
        fileTree: (
          <RepositoryPanelProvider
            repositoryPath={
              selectedSource?.type === 'local' ? selectedSource.location : null
            }
            actions={{ openFile: handleSearchFileSelect }}
          >
            <FileTreePanelContent onFileSelect={handleSearchFileSelect} />
          </RepositoryPanelProvider>
        ),
        search: (
          <RepositorySearchTab
            fileTrees={fileTrees}
            activeFileTreeSource={selectedSource}
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
              selectedSource?.type === 'local' ? selectedSource.location : null
            }
            actions={{
              openGitDiff: handleGitChangeSelect,
              openFile: handleFileClick,
            }}
          >
            <GitChangesPanel variant="tab" />
          </RepositoryPanelProvider>
        ),
        gitHistory: (
          <GitCommitHistoryPanel
            repositoryPath={
              selectedSource?.type === 'local' ? selectedSource.location : null
            }
          />
        ),
        gitIssues: (
          <GitIssuesPanel
            repository={{
              owner: ghOwner || repository.owner,
              name: ghRepo || repository.name,
              remoteUrl: repository.remoteUrl,
              github: null,
            }}
          />
        ),
        gitPullRequests: (
          <GitPullRequestsPanel
            repository={{
              owner: ghOwner || repository.owner,
              name: ghRepo || repository.name,
              remoteUrl: repository.remoteUrl,
              github: null,
            }}
          />
        ),
        dependencies: selectedSource ? (
          <RepoSourceArchitecturePanelSimple
            source={selectedSource}
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
        tools: (
          <ToolsPanel
            packageLayers={cacheData?.packages ?? null}
            repositoryPath={repositoryPathForTools}
            onHighlightLayersChange={setToolsHighlightLayers}
          />
        ),
        docs: (
          <AlexandriaDocsPanel
            repositoryPath={
              selectedSource?.location || repository.localClones[0]?.path || ''
            }
            onDocumentSelect={handleDocumentSelect}
            selectedDocument={selectedDocPath ?? undefined}
          />
        ),
        agentEvents: (
          <AgentEventsPanel
            repositoryPath={
              selectedSource?.type === 'local' ? selectedSource.location : null
            }
            maxEvents={100}
          />
        ),
        agentSessions: (
          <AgentSessionsPanel
            repositoryPath={
              selectedSource?.type === 'local' ? selectedSource.location : null
            }
          />
        ),
        agentContext: (
          <AgentContextTreePanel
            repositoryPath={
              selectedSource?.type === 'local' ? selectedSource.location : null
            }
            onFileSelect={handleSearchFileSelect}
          />
        ),
        tasks: (
          <TasksPanel
            repositoryPath={
              selectedSource?.type === 'local'
                ? selectedSource.location
                : repository.localClones?.[0]?.path || ''
            }
            onTaskClick={handleTaskClick}
          />
        ),
        drawings: (
          <RepositoryPanelProvider
            repositoryPath={
              selectedSource?.type === 'local' ? selectedSource.location : null
            }
            actions={{ openFile: handleSearchFileSelect }}
          >
            <DrawingsListPanel
              onDrawingSelect={(drawingId, drawingName) => {
                // Open the drawing in the Excalidraw panel
                const drawingPath = drawingId.endsWith('.excalidraw')
                  ? drawingId
                  : `${drawingId}.excalidraw`;
                setSelectedDocPath(drawingPath);
                setSelectedDocType('excalidraw');
                setRightPaneMode('document');
              }}
              onCreateNew={() => {
                // Switch the right pane to the Excalidraw editor and start a fresh canvas
                setCreateExcalidrawTrigger((prev) => prev + 1);
                setSelectedDocPath(null);
                setSelectedDocType('excalidraw');
                setRightPaneMode('document');
              }}
            />
          </RepositoryPanelProvider>
        ),
        packageInfo:
          selectedSource?.type === 'local' ? (
            <QualityHexagonPanel directory={selectedSource.location} />
          ) : null,
      };
      return map;
    }, [
      fileTree,
      loading,
      handleSearchFileSelect,
      fileTrees,
      selectedSource,
      searchContentProvider,
      selectedFile,
      handleSearchResultsChange,
      handleSearchResultHover,
      handleFolderFiltersChange,
      handleFileClick,
      handleGitChangeSelect,
      setPackageLayers,
      handlePackageAnalysisStart,
      handlePackageAnalysisEnd,
      handlePackageSelected,
      handlePackageDeselected,
      theme.colors.textSecondary,
      packageLayers,
      repositoryPathForTools,
      setToolsHighlightLayers,
      repository.localClones,
      repository.remoteUrl,
      repository.owner,
      repository.name,
      ghOwner,
      ghRepo,
      handleDocumentSelect,
      selectedDocPath,
      handleTaskClick,
    ]);

    // Build tabs from registry using panel content
    const tabs: PanelTabConfig[] = [
      {
        id: 'fileTree',
        label: 'Files',
        icon: <FolderTree size={14} />,
        visible: true,
        content: panelContentMap.fileTree,
      },
      {
        id: 'search',
        label: 'Search',
        icon: <Search size={14} />,
        visible: true,
        content: panelContentMap.search,
      },
      {
        id: 'gitChanges',
        label: 'Git Changes',
        icon: <GitBranch size={14} />,
        visible: selectedSource?.type === 'local',
        content: panelContentMap.gitChanges,
      },
      {
        id: 'gitHistory',
        label: 'Commit History',
        icon: <History size={14} />,
        visible: selectedSource?.type === 'local',
        content: panelContentMap.gitHistory,
      },
      {
        id: 'gitIssues',
        label: 'Git Issues',
        icon: <AlertCircle size={14} />,
        visible: !!repoInfo,
        content: panelContentMap.gitIssues,
      },
      {
        id: 'gitPullRequests',
        label: 'Git Pull Requests',
        icon: <GitPullRequest size={14} />,
        visible: !!repoInfo,
        content: panelContentMap.gitPullRequests,
      },
      {
        id: 'dependencies',
        label: 'Dependencies',
        icon: <Layers size={14} />,
        visible: true,
        content: panelContentMap.dependencies,
      },
      {
        id: 'tools',
        label: 'Tools',
        icon: <Wrench size={14} />,
        visible: true,
        content: panelContentMap.tools,
      },
      {
        id: 'docs',
        label: 'Docs',
        icon: <Book size={14} />,
        visible: true,
        content: panelContentMap.docs,
      },
      {
        id: 'drawings',
        label: 'Drawings',
        icon: <Pencil size={14} />,
        visible: selectedSource?.type === 'local',
        content: panelContentMap.drawings,
      },
      {
        id: 'agentEvents',
        label: 'Agent Events',
        icon: <Activity size={14} />,
        visible: true,
        content: panelContentMap.agentEvents,
      },
      {
        id: 'agentSessions',
        label: 'Agent Sessions',
        icon: <Activity size={14} />,
        visible: true,
        content: panelContentMap.agentSessions,
      },
      {
        id: 'agentContext',
        label: 'Agent Context',
        icon: <Activity size={14} />,
        visible: true,
        content: panelContentMap.agentContext,
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: <ListTodo size={14} />,
        visible: true,
        content: panelContentMap.tasks,
      },
      {
        id: 'packageInfo',
        label: 'Package Information',
        icon: <Package size={14} />,
        visible: selectedSource?.type === 'local',
        content: panelContentMap.packageInfo,
      },
    ];

    // Create toolbar items
    const toolbarItems = useMemo<ToolbarItem[]>(() => {
      const items: ToolbarItem[] = [];

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

      if (selectedSource?.type === 'local' && gitState) {
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
            if (!gitState.hasNoCommits && selectedSource) {
              setGitChangesVisible(selectedSource.id, !gitState.enabled);
            }
          },
          tooltip: gitState.hasNoCommits
            ? 'Repository has no commits yet'
            : `${gitState.enabled ? 'Hide' : 'Show'} git changes (${changeCount} changes)`,
        });
      }

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
      selectedSource,
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

    // Memoize viewer panels
    const codeViewerPanel = useMemo(() => {
      return (
        <FilePreviewPanel
          filePath={selectedCodeFile}
          source={selectedSource}
          contentProvider={fileViewerContentProvider}
          onClose={() => {
            setSelectedCodeFile(null);
            setSelectedFile(null);
          }}
        />
      );
    }, [selectedCodeFile, selectedSource, fileViewerContentProvider]);

    const gitDiffViewerPanel = useMemo(() => {
      return (
        <GitDiffPanel
          filePath={selectedDiffFile?.path ?? null}
          repositoryPath={
            selectedSource?.type === 'local' ? selectedSource.location : null
          }
          status={selectedDiffFile?.status}
          onClose={() => {
            setSelectedDiffFile(null);
          }}
        />
      );
    }, [selectedDiffFile, selectedSource]);

    const markdownViewerPanel = useMemo(() => {
      const shouldShow = selectedDocType !== 'excalidraw';
      return (
        <MarkdownRenderingPanel
          filePath={shouldShow ? selectedDocPath : null}
          source={selectedSource}
          contentProvider={fileViewerContentProvider}
          onClose={() => {
            setSelectedDocPath(null);
            setSelectedDocType('markdown');
          }}
        />
      );
    }, [
      selectedDocPath,
      selectedDocType,
      selectedSource,
      fileViewerContentProvider,
    ]);

    const excalidrawDiagramPanel = useMemo(
      () => (
        <ExcalidrawPanel
          filePath={selectedDocType === 'excalidraw' ? selectedDocPath : null}
          createNewTrigger={createExcalidrawTrigger}
          source={selectedSource}
          contentProvider={fileViewerContentProvider}
          onClose={() => {
            setSelectedDocPath(null);
            setSelectedDocType('markdown');
          }}
        />
      ),
      [
        selectedDocPath,
        selectedDocType,
        createExcalidrawTrigger,
        selectedSource,
        fileViewerContentProvider,
      ],
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

    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.background,
        }}
      >
        <RepositoryTitlebar
          repository={repository}
          repositoryOwner={repository.owner}
          repositoryName={repository.name}
          hasUpdateAvailable={hasUpdateAvailable}
          selectedSource={selectedSource}
          onSourceSelect={setSelectedSource}
          onSecretsClick={() => setShowSecretsModal(true)}
          onLinksClick={() => setShowLinksModal(true)}
          onAddNoteClick={() => setShowAddNoteModal(true)}
          onHelpClick={() => setShowSourceHelpModal(true)}
          onForkBadgeClick={() => setShowBadgeInfoModal(true)}
          onConfigurePanels={() => setShowPanelConfigModal(true)}
          onSwitchPanels={handleSwitchPanels}
          showSidebarControls
          sidebarCollapsed={panelCollapsedState.left ?? false}
          onToggleSidebar={() =>
            handleLeftPanelCollapsedChange(!(panelCollapsedState.left ?? false))
          }
          rightSidebarCollapsed={panelCollapsedState.right ?? false}
          onToggleRightSidebar={() =>
            handleRightPanelCollapsedChange(
              !(panelCollapsedState.right ?? false),
            )
          }
          availableWorkspaces={availableWorkspaces}
          currentWorkspaceId={currentWorkspaceId}
          onWorkspaceSelect={handleWorkspaceSelect}
          onSaveWorkspace={handleSaveWorkspace}
          hasStateDeviation={hasStateDeviation}
          onUpdateWorkspaceDefaults={handleUpdateWorkspaceDefaults}
          onResetToWorkspaceDefaults={handleResetToWorkspaceDefaults}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
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
              activeSource={selectedSource}
              gitEnabled={gitState?.enabled}
              headTree={gitState?.headTree}
              hasNoCommits={gitState?.hasNoCommits}
              viewMode="explore"
              renderCustomBadges={() => (
                <>
                  {fileTreeSources.length > 1 && (
                    <button
                      onClick={() => {
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
                  middle: 'tabbedTerminal',
                  right: 'middle',
                };

                // Multi Terminal panel (combines tabbed and carousel with toggle button)
                const isMultiTerminalVisible =
                  propsPanelLayout.middle === 'multiTerminal' ||
                  propsPanelLayout.left === 'multiTerminal' ||
                  propsPanelLayout.right === 'multiTerminal';
                const multiTerminalPanel =
                  selectedSource?.type === 'local' ? (
                    <div
                      style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <MultiTerminalPanel
                        directory={selectedSource.location}
                        repositoryKey={repositoryKey}
                        isVisible={isMultiTerminalVisible}
                        hideHeader={false}
                        key={`multi-terminal-${selectedSource.location}`}
                        showAllTerminals={showAllTerminals}
                        onShowAllTerminalsChange={setShowAllTerminals}
                      />
                    </div>
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
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          marginBottom: '8px',
                          color: theme.colors.text,
                        }}
                      >
                        Terminal Unavailable
                      </div>
                      <div style={{ fontSize: '14px' }}>
                        Terminal is only available for local repository clones
                      </div>
                    </div>
                  );

                // Create all panel definitions
                const allPanels: PanelDefinitionWithContent[] = [
                  ...leftPanelTabs,
                  {
                    id: 'multiTerminal',
                    label: 'Multi Terminal',
                    content: multiTerminalPanel,
                  },
                  {
                    id: 'cityVisualization',
                    label: 'City Visualization',
                    content: cityPanel,
                  },
                  {
                    id: 'codeViewer',
                    label: 'Code Viewer',
                    content: codeViewerPanel,
                  },
                  {
                    id: 'gitDiff',
                    label: 'Git Diff',
                    content: gitDiffViewerPanel,
                  },
                  {
                    id: 'gitDiffViewer',
                    label: 'Diff Viewer',
                    content: gitDiffViewerPanel,
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

                // Default layout (fallback - matches 'old-school' workspace)
                const defaultLayout: PanelLayout = {
                  left: {
                    type: 'tabs',
                    panels: ['fileTree', 'search', 'gitChanges', 'docs'],
                    config: {
                      defaultActiveTab: 0,
                      tabPosition: 'top',
                    } as TabsConfig,
                  },
                  middle: {
                    type: 'tabs',
                    panels: ['codeViewer', 'markdownViewer'],
                    config: {
                      defaultActiveTab: 0,
                      tabPosition: 'top',
                    } as TabsConfig,
                  },
                  right: {
                    type: 'tabs',
                    panels: ['multiTerminal', 'cityVisualization'],
                    config: {
                      defaultActiveTab: 0,
                      tabPosition: 'top',
                    } as TabsConfig,
                  },
                };

                // Wait for panel preferences to be loaded
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
                      <div style={{ color: theme.colors.textSecondary }}>
                        Loading...
                      </div>
                    </div>
                  );
                }

                // Use provided layout or default
                let actualPanelLayout: PanelLayout =
                  panelLayout || defaultLayout;

                // Add controlled tab props to left panel if it's a tab group
                const leftPanel = actualPanelLayout.left;
                if (
                  typeof leftPanel === 'object' &&
                  leftPanel !== null &&
                  'type' in leftPanel &&
                  leftPanel.type === 'tabs'
                ) {
                  actualPanelLayout = {
                    ...actualPanelLayout,
                    left: {
                      ...leftPanel,
                      config: {
                        ...leftPanel.config,
                        activeTabIndex: leftPanelActiveTabIndex,
                        onTabChange: (index: number) => {
                          setLeftPanelActiveTabIndex(index);
                        },
                      },
                    },
                  };
                }

                // Add controlled tab props to middle panel if it's a tab group
                const middlePanel = actualPanelLayout.middle;
                if (
                  typeof middlePanel === 'object' &&
                  middlePanel !== null &&
                  'type' in middlePanel &&
                  middlePanel.type === 'tabs'
                ) {
                  actualPanelLayout = {
                    ...actualPanelLayout,
                    middle: {
                      ...middlePanel,
                      config: {
                        ...middlePanel.config,
                        activeTabIndex: middlePanelActiveTabIndex,
                        onTabChange: (index: number) => {
                          setMiddlePanelActiveTabIndex(index);
                        },
                      },
                    },
                  };
                }

                // Add controlled tab props to right panel if it's a tab group
                const rightPanel = actualPanelLayout.right;
                if (
                  typeof rightPanel === 'object' &&
                  rightPanel !== null &&
                  'type' in rightPanel &&
                  rightPanel.type === 'tabs'
                ) {
                  actualPanelLayout = {
                    ...actualPanelLayout,
                    right: {
                      ...rightPanel,
                      config: {
                        ...rightPanel.config,
                        activeTabIndex: rightPanelActiveTabIndex,
                        onTabChange: (index: number) => {
                          setRightPanelActiveTabIndex(index);
                        },
                      },
                    },
                  };
                }

                return (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <ConfigurablePanelLayout
                      key={panelResetKey}
                      panels={allPanels}
                      layout={actualPanelLayout}
                      collapsiblePanels={{ left: true, right: true }}
                      defaultSizes={
                        panelSizes ?? { left: 20, middle: 45, right: 35 }
                      }
                      minSizes={{ left: 15, middle: 30, right: 25 }}
                      collapsed={{
                        left: panelCollapsedState.left ?? false,
                        right: panelCollapsedState.right ?? false,
                      }}
                      showCollapseButtons={false}
                      onPanelResize={handlePanelSizesChange}
                      onLeftCollapseComplete={() =>
                        handleLeftPanelCollapsedChange(true)
                      }
                      onLeftExpandComplete={() =>
                        handleLeftPanelCollapsedChange(false)
                      }
                      onRightCollapseComplete={() =>
                        handleRightPanelCollapsedChange(true)
                      }
                      onRightExpandComplete={() =>
                        handleRightPanelCollapsedChange(false)
                      }
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
                  owner: ghOwner || '',
                  repo: ghRepo || '',
                  branch:
                    selectedSource?.metadata?.currentBranch ||
                    repository.metadata?.defaultBranch ||
                    'main',
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
        </div>

        {/* Modals */}
        <SecretsModal
          isOpen={showSecretsModal}
          onClose={() => setShowSecretsModal(false)}
          repository={repository}
          selectedSource={selectedSource}
        />

        <LinksModal
          isOpen={showLinksModal}
          onClose={() => setShowLinksModal(false)}
          repository={repository}
          selectedSource={selectedSource}
        />

        <AddNoteModal
          isOpen={showAddNoteModal}
          onClose={() => setShowAddNoteModal(false)}
          onNoteAdded={handleNoteAdded}
          repositoryPath={
            selectedSource?.type === 'local'
              ? selectedSource.location
              : repository.localClones?.[0]?.path || ''
          }
        />

        <SourceBadgeHelpModal
          isOpen={showSourceHelpModal}
          onClose={() => setShowSourceHelpModal(false)}
        />

        <BadgeInfoModal
          isOpen={showBadgeInfoModal}
          onClose={() => setShowBadgeInfoModal(false)}
          repository={repository}
          cloneBranchStatuses={cloneBranchStatuses}
          setCloneBranchStatuses={setCloneBranchStatuses}
        />

        <PanelConfiguratorModal
          isOpen={showPanelConfigModal}
          onClose={() => setShowPanelConfigModal(false)}
          availablePanels={availablePanelDefinitions}
          currentLayout={panelLayout}
          onChange={handlePanelLayoutChange}
        />
      </div>
    );
  });

RepositoryWorkspaceInternal.displayName = 'RepositoryWorkspaceInternal';

// Public wrapper component that provides context
export const RepositoryWorkspace: React.FC<RepositoryWorkspaceProps> = (
  props,
) => {
  return (
    <HighlightLayersProvider>
      <GitChangesProvider>
        <RepositoryWorkspaceInternal {...props} />
      </GitChangesProvider>
    </HighlightLayersProvider>
  );
};

RepositoryWorkspace.displayName = 'RepositoryWorkspace';
