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
} from 'lucide-react';
import { parseGitHubUrl } from '../../shared/utils/githubUrlParser';
import {
  PackageLayerModule,
  PackageLayer,
} from '@principal-ai/codebase-composition';
import { SourceFileSystemAdapter } from '../adapters/SourceFileSystemAdapter';
import { RepositoryTitlebar } from '../components/Titlebar';

import type { Repository } from '../../shared/types/repository.types';
import { RepositoryExplorationView } from './RepositoryExplorationView';
import { SecretsModal } from './shared/SecretsModal';
import { SourceBadgeHelpModal } from './shared/SourceBadgeHelpModal';
import { BadgeInfoModal } from './shared/BadgeInfoModal';
import { PanelConfiguratorModal } from './shared/PanelConfiguratorModal';
import type { PanelLayout } from '@a24z/panels';
import { GitChangesProvider } from '../contexts/GitChangesContext';
import { HighlightLayersProvider } from '../contexts/HighlightLayersContext';
import { GitService } from '../main-process-api/GitService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { CityDataCacheService } from '../services/CityDataCacheService';
import { FileTreeSource } from '../types/file-tree-source';
import { SourceSelectionService } from '../services/SourceSelectionService';
import { CloneVisibilityService } from '../services/CloneVisibilityService';
import { AgentConfigurationService } from '../main-process-api/AgentConfigurationService';
import { SupportedAgent } from '@principal-ai/agent-monitoring';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { EventHighlightService } from './services/EventHighlightService';
import { AgentSessionSDKService } from '../main-process-api/AgentSessionSDKService';
import type { HighlightLayer } from '@principal-ai/code-city-react';
import { WorkspaceLayoutService } from '../services/WorkspaceLayoutService';
import type { WorkspaceLayout } from '../../shared/types/userPreferences.types';

interface RepositoryManagerProps {
  repository: Repository;
  onBack?: () => void;
  hasUpdateAvailable?: boolean;
}

export const RepositoryManager: React.FC<RepositoryManagerProps> = React.memo(
  ({ repository, onBack, hasUpdateAvailable }) => {
    const { theme } = useTheme();

    // Search state - TODO: Move to floating search component in bottom-left corner
    const [searchQuery] = useState<string>(''); // setSearchQuery will be used when search is implemented

    // Modal states
    const [showSecretsModal, setShowSecretsModal] = useState(false);
    const [showSourceHelpModal, setShowSourceHelpModal] = useState(false);
    const [showBadgeInfoModal, setShowBadgeInfoModal] = useState(false);
    const [showPanelConfigModal, setShowPanelConfigModal] = useState(false);
    const [cloneBranchStatuses, setCloneBranchStatuses] = useState<Record<string, any>>({});

    // Panel layout state - default matches RepositoryExplorationView
    const [panelLayout, setPanelLayout] = useState<PanelLayout>({
      left: {
        type: 'tabs',
        panels: ['fileTree', 'docs'],
        config: {
          defaultActiveTab: 0,
        },
      },
      middle: 'terminal',
      right: 'cityVisualization',
    });

    // Workspace layout state
    const [availableWorkspaces, setAvailableWorkspaces] = useState<Record<string, WorkspaceLayout>>({});
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
    const [workspacesLoaded, setWorkspacesLoaded] = useState(false);
    const [hasStateDeviation, setHasStateDeviation] = useState(false);
    const [panelResetKey, setPanelResetKey] = useState(0);

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
    const [eventHighlightLayers, setEventHighlightLayers] = useState<HighlightLayer[]>([]);

    // Note: File tree sources and toggle logic removed - badges now launch windows

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
    }, [ghOwner, ghRepo, repository.owner, repository.name, repository.remoteUrl]);

    const [panelCollapsedState, setPanelCollapsedState] = useState<{
      left?: boolean;
      right?: boolean;
    }>({ left: false, right: false });
    const [panelSizes, setPanelSizes] = useState<{ left: number; middle: number; right: number }>({
      left: 20,
      middle: 45,
      right: 35,
    });
    const [panelPreferencesLoaded, setPanelPreferencesLoaded] = useState(false);

    // Load saved repository state (workspace + sizes + collapsed)
    useEffect(() => {
      let isMounted = true;
      const loadRepositoryState = async () => {
        try {
          const repoState = await WorkspaceLayoutService.getRepositoryState(repositoryKey);

          if (isMounted && repoState) {
            // Set workspace ID
            setCurrentWorkspaceId(repoState.workspaceId);

            // Apply layout from workspace or custom
            if (repoState.workspaceId) {
              const workspace = await WorkspaceLayoutService.getWorkspaceLayout(repoState.workspaceId);
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
          console.error('[RepositoryManager] Failed to load repository state:', error);
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
          console.error('[RepositoryManager] Failed to load workspace layouts:', error);
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
          const matchingWorkspaceId = await WorkspaceLayoutService.findMatchingWorkspace(panelLayout);
          setCurrentWorkspaceId(matchingWorkspaceId);
          setHasStateDeviation(false);
          return;
        }

        // If workspace is selected, check for drift
        const workspace = availableWorkspaces[currentWorkspaceId];
        if (workspace) {
          const deviation = WorkspaceLayoutService.hasStateDeviation(
            { workspaceId: currentWorkspaceId, sizes: panelSizes, collapsed: panelCollapsedState },
            workspace
          );
          setHasStateDeviation(deviation.hasSizeDeviation || deviation.hasCollapsedDeviation);
        }
      };

      checkLayoutAndDrift();
    }, [panelLayout, panelSizes, panelCollapsedState, workspacesLoaded, panelPreferencesLoaded, currentWorkspaceId, availableWorkspaces]);

    const persistCollapsedState = useCallback(
      async (collapsed: { left?: boolean; right?: boolean }) => {
        try {
          await WorkspaceLayoutService.updateRepositoryCollapsed(repositoryKey, collapsed);
        } catch (error) {
          console.error('[RepositoryManager] Failed to persist collapsed state:', error);
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
          console.error('[RepositoryManager] Failed to persist panel layout:', error);
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
          await WorkspaceLayoutService.updateRepositorySizes(repositoryKey, sizes);
        } catch (error) {
          console.error('[RepositoryManager] Failed to persist panel sizes:', error);
        }
      },
      [repositoryKey],
    );

    // Debounce panel size changes to avoid too frequent saves
    const [pendingPanelSizes, setPendingPanelSizes] = useState<{ left: number; middle: number; right: number } | null>(null);

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
          console.error(`[RepositoryManager] Workspace ${workspaceId} not found`);
          return;
        }

        const newSizes = workspace.defaultSizes || { left: 20, middle: 45, right: 35 };
        const newCollapsed = workspace.defaultCollapsed || { left: false, right: false };

        // Apply workspace layout
        setPanelLayout(workspace.layout);
        setPanelSizes(newSizes);
        setPanelCollapsedState(newCollapsed);
        setCurrentWorkspaceId(workspaceId);
        setPanelResetKey(prev => prev + 1); // Force panel remount

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
        }
      ) => {
        try {
          const workspace = await WorkspaceLayoutService.createWorkspaceLayout(
            name,
            panelLayout,
            {
              description: options?.description,
              defaultSizes: options?.includeSizes ? panelSizes : undefined,
              defaultCollapsed: options?.includeCollapsed ? panelCollapsedState : undefined,
            }
          );

          // Update available workspaces
          setAvailableWorkspaces(prev => ({
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
          console.error('[RepositoryManager] Failed to save workspace:', error);
          throw error;
        }
      },
      [panelLayout, panelSizes, panelCollapsedState, repositoryKey],
    );

    const handleUpdateWorkspaceDefaults = useCallback(
      async () => {
        if (!currentWorkspaceId) return;

        try {
          await WorkspaceLayoutService.updateWorkspaceFromRepositoryState(
            currentWorkspaceId,
            repositoryKey
          );

          // Reload workspaces to reflect updated defaults
          const workspaces = await WorkspaceLayoutService.getWorkspaceLayouts();
          setAvailableWorkspaces(workspaces);
          setHasStateDeviation(false);
        } catch (error) {
          console.error('[RepositoryManager] Failed to update workspace defaults:', error);
        }
      },
      [currentWorkspaceId, repositoryKey],
    );

    const handleResetToWorkspaceDefaults = useCallback(
      async () => {
        if (!currentWorkspaceId) return;

        const workspace = availableWorkspaces[currentWorkspaceId];
        if (!workspace) return;

        try {
          const defaultSizes = workspace.defaultSizes || { left: 20, middle: 45, right: 35 };
          const defaultCollapsed = workspace.defaultCollapsed || { left: false, right: false };

          // Update UI state immediately
          setPanelSizes(defaultSizes);
          setPanelCollapsedState(defaultCollapsed);
          setHasStateDeviation(false);
          setPanelResetKey(prev => prev + 1); // Force panel remount

          // Persist to repository state
          await WorkspaceLayoutService.resetRepositoryToWorkspaceDefaults(
            repositoryKey,
            currentWorkspaceId
          );
        } catch (error) {
          console.error('[RepositoryManager] Failed to reset to workspace defaults:', error);
        }
      },
      [currentWorkspaceId, repositoryKey, availableWorkspaces],
    );

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
            '[RepositoryManager] Agents with MCP enabled:',
            agentsWithMCPEnabled,
          );
        } catch (error) {
          console.error(
            '[RepositoryManager] Failed to check agent MCP status:',
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
            const visibleClonePath = CloneVisibilityService.getVisibleClonePath(repository);
            if (visibleClonePath) {
              try {
                // Start monitoring service if not already started
                console.log('[RepositoryManager] Starting monitoring service...');
                await RepositoryMonitoringService.startMonitoring();
                console.log('[RepositoryManager] Monitoring service started');

                console.log('[RepositoryManager] Registering repository with monitoring service:', visibleClonePath);
                await RepositoryMonitoringService.registerRepository(visibleClonePath);
                console.log('[RepositoryManager] Repository registered successfully');

                // Enable git watching for the repository
                console.log('[RepositoryManager] Enabling git watching for repository:', visibleClonePath);
                const result = await RepositoryMonitoringService.enableGitWatching(visibleClonePath);
                if (result.success) {
                  console.log('[RepositoryManager] Git watching enabled successfully');
                } else {
                  console.warn('[RepositoryManager] Failed to enable git watching:', result.error);
                }
              } catch (error) {
                console.error('[RepositoryManager] Failed to register repository:', error);
                // Not fatal - the service will still work but may need to compute FileTree on first access
              }
            }
          }
        }
      };

      initializeAndRegister();

      // Cleanup: disable git watching on unmount
      return () => {
        const visibleClonePath = CloneVisibilityService.getVisibleClonePath(repository);
        if (visibleClonePath) {
          RepositoryMonitoringService.disableGitWatching(visibleClonePath)
            .then((result) => {
              if (result.success) {
                console.log('[RepositoryManager] Git watching disabled on unmount');
              }
            })
            .catch((error) => {
              console.error('[RepositoryManager] Failed to disable git watching on unmount:', error);
            });
        }
      };
    }, [repository]);

    // Set up event highlight service - listen for agent events
    useEffect(() => {
      const visibleClonePath = CloneVisibilityService.getVisibleClonePath(repository);
      if (!visibleClonePath) {
        console.log('[RepositoryManager] No visible clone path for event highlighting');
        return;
      }

      console.log('[RepositoryManager] Setting up event highlight service for:', visibleClonePath);

      // Set repository context
      eventHighlightService.setRepository(visibleClonePath);

      // Subscribe to processed events
      const unsubscribe = AgentSessionSDKService.onProcessedEvent((event) => {
        console.log('[RepositoryManager] Received agent event:', event.eventType, event.toolName);
        eventHighlightService.processEvent(event);
      });

      // Listen for highlight updates
      const handleHighlightUpdate = (layers: HighlightLayer[]) => {
        console.log('[RepositoryManager] Highlight layers updated:', layers.length);
        setEventHighlightLayers(layers);
      };

      eventHighlightService.on('highlight-update', handleHighlightUpdate);

      return () => {
        console.log('[RepositoryManager] Cleaning up event highlight service');
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
        // Check if this update is for our repository
        if (data.repository.remoteUrl === repository.remoteUrl) {
          console.info(
            '[RepositoryManager] Clone added to current repository:',
            data.clonePath,
          );
          // TODO: Update the repository data without a full page reload
          // For now, we've removed the window.location.reload() to prevent jarring reloads
          // The parent component should handle repository updates through props
        }
      };

      const handleCloneRemoved = (data: {
        repository: Repository;
        clonePath: string;
      }) => {
        // Check if this update is for our repository
        if (data.repository.remoteUrl === repository.remoteUrl) {
          console.info(
            '[RepositoryManager] Clone removed from current repository:',
            data.clonePath,
          );

          // TODO: Update the repository data without a full page reload
          // For now, we handle the source selection change locally

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
          onHelpClick={() => setShowSourceHelpModal(true)}
          onForkBadgeClick={() => setShowBadgeInfoModal(true)}
          onConfigurePanels={() => setShowPanelConfigModal(true)}
          showSidebarControls
          sidebarCollapsed={panelCollapsedState.left ?? false}
          onToggleSidebar={() =>
            handleLeftPanelCollapsedChange(!(panelCollapsedState.left ?? false))
          }
          rightSidebarCollapsed={panelCollapsedState.right ?? false}
          onToggleRightSidebar={() =>
            handleRightPanelCollapsedChange(!(panelCollapsedState.right ?? false))
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
          <HighlightLayersProvider>
              <GitChangesProvider>
                <RepositoryExplorationView
                key={panelResetKey}
                repository={repository}
                repositoryKey={repositoryKey}
                remoteData={{
                  owner: ghOwner || '',
                  repo: ghRepo || '',
                  defaultBranch: repository.metadata?.defaultBranch || 'main',
                }}
                searchQuery={searchQuery}
                activeFileTreeSource={selectedSource}
                cityDataCache={cityDataCache}
                packageLayers={packageLayers}
                onPackageLayersChange={setPackageLayers}
                leftPanelCollapsed={panelCollapsedState.left ?? false}
                onLeftPanelCollapsedChange={handleLeftPanelCollapsedChange}
                rightPanelCollapsed={panelCollapsedState.right ?? false}
                onRightPanelCollapsedChange={handleRightPanelCollapsedChange}
                panelLayout={panelLayout}
                panelSizes={panelSizes}
                onPanelSizesChange={handlePanelSizesChange}
                panelPreferencesLoaded={panelPreferencesLoaded}
                eventHighlightLayers={eventHighlightLayers}
                eventHighlightService={eventHighlightService}
              />
            </GitChangesProvider>
          </HighlightLayersProvider>
        </div>


        {/* Modals */}
        <SecretsModal
          isOpen={showSecretsModal}
          onClose={() => setShowSecretsModal(false)}
          repository={repository}
          selectedSource={selectedSource}
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
          availablePanels={[
            // Navigation & Search panels
            {
              id: 'fileTree',
              label: 'Files',
              icon: <FolderTree size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>File browser</div>
            },
            {
              id: 'search',
              label: 'Search',
              icon: <Search size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>Search files and content</div>
            },
            {
              id: 'gitChanges',
              label: 'Git Changes',
              icon: <GitBranch size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>View git changes</div>
            },
            {
              id: 'dependencies',
              label: 'Dependencies',
              icon: <Layers size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>Package architecture</div>
            },
            {
              id: 'tools',
              label: 'Tools',
              icon: <Wrench size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>Development tools</div>
            },
            {
              id: 'docs',
              label: 'Docs',
              icon: <Book size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>Documentation viewer</div>
            },
            {
              id: 'agentEvents',
              label: 'Agent Events',
              icon: <Activity size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>Monitor agent activity in real-time</div>
            },
            // Visualization panels
            {
              id: 'cityVisualization',
              label: 'City Visualization',
              icon: <Building2 size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>Code city view</div>
            },
            // Utility panels
            {
              id: 'terminal',
              label: 'Terminal',
              icon: <TerminalIcon size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>Integrated terminal</div>
            },
            {
              id: 'tabbedTerminal',
              label: 'Tabbed Terminal',
              icon: <TerminalIcon size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>Multi-tab terminal with agent support</div>
            },
            // Viewer panels (context-dependent, shown when files are selected)
            {
              id: 'codeViewer',
              label: 'Code Viewer',
              icon: <FileCode size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>View source code files</div>
            },
            {
              id: 'markdownViewer',
              label: 'Markdown Viewer',
              icon: <FileText size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>View markdown as document or slides</div>
            },
            {
              id: 'excalidrawDiagram',
              label: 'Excalidraw Diagram',
              icon: <Pencil size={16} />,
              preview: <div style={{ padding: '8px', fontSize: '14px', color: theme.colors.text }}>View excalidraw diagrams</div>
            },
          ]}
          currentLayout={panelLayout}
          onChange={handlePanelLayoutChange}
        />
      </div>
    );
  },
);
