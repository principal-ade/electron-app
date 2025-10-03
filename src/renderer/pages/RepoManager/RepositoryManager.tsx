import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { parseGitHubUrl } from '../../../shared/utils/githubUrlParser';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import { createFileColorHighlightLayers } from '@principal-ai/code-city-react';
import {
  PackageLayerModule,
  PackageLayer,
} from '@principal-ai/codebase-composition';
import { SourceFileSystemAdapter } from '../../adapters/SourceFileSystemAdapter';
import { RepositoryTitlebar } from '../../components/Titlebar';
import { RepositoryLoadingState } from './components/RepositoryLoadingState';

import type { Repository } from '../../../shared/types/repository.types';
import { RepositoryExplorationView } from './RepositoryExplorationView';
import { SecretsModal } from './shared/SecretsModal';
import { SourceBadgeHelpModal } from './shared/SourceBadgeHelpModal';
import { BadgeInfoModal } from './shared/BadgeInfoModal';
import { GitChangesProvider } from '../../contexts/GitChangesContext';
import { GitService } from '../../main-process-api/GitService';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { FileTree } from '@principal-ai/repository-abstraction';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { MonitoredFileTreeService } from '../../services/MonitoredFileTreeService';
import { FileTreeInvalidator } from '../../services/FileTreeInvalidator';
import { CityDataCacheService } from '../../services/CityDataCacheService';
import { FileTreeSource, FileTreeStats } from '../../types/file-tree-source';
import { SourceSelectionService } from '../../services/SourceSelectionService';
import { CloneVisibilityService } from '../../services/CloneVisibilityService';
import { AgentConfigurationService } from '../../main-process-api/AgentConfigurationService';
import { SupportedAgent } from '@principal-ai/agent-monitoring';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';

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
    const [cloneBranchStatuses, setCloneBranchStatuses] = useState<Record<string, any>>({});

    // File tree services - shared across all views
    const fileTreeSourceService = useMemo(
      () => new FileTreeSourceService(),
      [],
    );
    const cacheService = useMemo(() => new MonitoredFileTreeService(), []);
    const cityDataCache = useMemo(() => new CityDataCacheService(), []);
    const fileTreeInvalidator = useMemo(
      () => new FileTreeInvalidator(cacheService, cityDataCache),
      [cacheService, cityDataCache],
    );

    // File tree state - unified around selected source
    const [selectedSource, setSelectedSource] = useState<FileTreeSource | null>(
      null,
    );
    const [fileTree, setFileTree] = useState<FileTree | null>(null);
    const [treeStats, setTreeStats] = useState<FileTreeStats | null>(null);
    const [cityData, setCityData] = useState<CityData | null>(null);
    const [packageLayers, setPackageLayers] = useState<PackageLayer[] | null>(
      null,
    );
    const [filterLayers, setFilterLayers] = useState<any[] | null>(null);
    const [_loading, setLoading] = useState(true);
    const [_treeLoadError, setTreeLoadError] = useState<string | null>(null);
    // Note: _loading and _treeLoadError will be used in UI rendering once implemented

    // Cache for loaded trees to avoid re-fetching
    const treeCache = useMemo(
      () =>
        new Map<
          string,
          { tree: FileTree; stats: FileTreeStats; filterLayers?: any[] }
        >(),
      [],
    );

    // Create file color highlight layers from fileTree
    const fileColorHighlightLayers = useMemo(() => {
      if (!fileTree || !fileTree.allFiles) return [];
      const layers = createFileColorHighlightLayers(fileTree.allFiles);
      console.log('[RepositoryManager] Created file color highlight layers:', {
        layerCount: layers.length,
        totalFiles: fileTree.allFiles?.length || 0,
      });
      return layers;
    }, [fileTree]);

    // MCP Agent configuration state
    const [agentsWithMCP, setAgentsWithMCP] = useState<SupportedAgent[]>([]);
    const [loadingAgentMCPStatus, setLoadingAgentMCPStatus] = useState(true);


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
    }>({ left: false });
    const [panelPreferencesLoaded, setPanelPreferencesLoaded] = useState(false);

    // Load saved panel state for this repository
    useEffect(() => {
      let isMounted = true;
      const loadPanelPreferences = async () => {
        try {
          const prefs = await UserPreferencesService.getPreferences();
          const collapsed =
            prefs.repositoryUIStates?.[repositoryKey]?.panelLayouts?.exploration?.collapsed?.left ??
            false;
          if (isMounted) {
            setPanelCollapsedState((prev) => ({ ...prev, left: collapsed }));
          }
        } catch (error) {
          console.error('[RepositoryManager] Failed to load panel state:', error);
        } finally {
          if (isMounted) {
            setPanelPreferencesLoaded(true);
          }
        }
      };

      loadPanelPreferences();

      return () => {
        isMounted = false;
      };
    }, [repositoryKey]);

    const persistLeftPanelCollapsed = useCallback(
      async (collapsed: boolean) => {
        try {
          const prefs = await UserPreferencesService.getPreferences();
          const repoStates = { ...(prefs.repositoryUIStates ?? {}) };
          const repoState = { ...(repoStates[repositoryKey] ?? {}) };
          const panelLayouts = {
            ...(repoState.panelLayouts ?? {}),
            exploration: {
              ...(repoState.panelLayouts?.exploration ?? {}),
              collapsed: {
                ...(repoState.panelLayouts?.exploration?.collapsed ?? {}),
                left: collapsed,
              },
            },
          };

          repoStates[repositoryKey] = {
            ...repoState,
            panelLayouts,
          };

          await UserPreferencesService.updatePreferences({
            repositoryUIStates: repoStates,
          });
        } catch (error) {
          console.error('[RepositoryManager] Failed to persist panel state:', error);
        }
      },
      [repositoryKey],
    );

    const handleLeftPanelCollapsedChange = useCallback(
      (collapsed: boolean) => {
        setPanelCollapsedState((prev) => ({ ...prev, left: collapsed }));
        if (panelPreferencesLoaded) {
          void persistLeftPanelCollapsed(collapsed);
        }
      },
      [panelPreferencesLoaded, persistLeftPanelCollapsed],
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


    // Clear file tree cache on first load to prevent stale cached results
    useEffect(() => {
      console.log(
        '🗑️ [RepositoryManager] Clearing file tree cache on first load to prevent stale data',
      );
      cacheService.clearAll();
    }, []); // Empty deps = run only once on mount

    // Initialize selected source from repository and register with monitoring service
    useEffect(() => {
      const initializeAndRegister = async () => {
        const defaultSource =
          SourceSelectionService.getSelectedSource(repository);
        if (defaultSource) {
          setSelectedSource(defaultSource);
          // Initialize the file tree source service with this source
          fileTreeSourceService.initializeFromRepository(repository);
          fileTreeSourceService.setActiveSource(defaultSource.id);

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
                await cacheService.registerRepository(visibleClonePath);
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
    }, [repository, fileTreeSourceService, cacheService]);

    // Load file tree for selected source
    const loadTree = useCallback(
      async (forceReload = false) => {
        if (!selectedSource) {
          setLoading(false);
          return;
        }

        // Check memory cache first (unless forcing reload)
        if (!forceReload) {
          const cached = treeCache.get(selectedSource.id);
          if (cached) {
            setFileTree(cached.tree);
            setTreeStats(cached.stats);
            setFilterLayers(cached.filterLayers || null);
            setLoading(false);
            return;
          }
        }

        try {
          setLoading(true);
          setTreeLoadError(null);

          console.log(
            '[RepositoryManager] Loading tree for source:',
            selectedSource,
          );

          // Load tree using cache service
          const result = await cacheService.loadFileTree(selectedSource);

          console.log('[RepositoryManager] Tree loaded result:', {
            sourceId: selectedSource.id,
            hasTree: !!result.tree,
            hasTreeStats: !!result.treeStats,
            treeFiles: result.tree?.allFiles?.length || 0,
            treeDirs: result.tree?.allDirectories?.length || 0,
            treeStats: result.treeStats,
            filterLayers: result.filterLayers?.length || 0,
            filters: result.filterLayers,
          });

          // Update memory cache
          treeCache.set(selectedSource.id, {
            tree: result.tree,
            stats: result.treeStats,
            filterLayers: result.filterLayers,
          });

          console.log('[RepositoryManager] Setting state:', {
            tree: !!result.tree,
            treeStats: result.treeStats,
            filterLayers: result.filterLayers?.length || 0,
          });

          setFileTree(result.tree);
          setTreeStats(result.treeStats);
          setFilterLayers(result.filterLayers || null);

          // Build city data using cache service
          if (result.tree) {
            const city = await cityDataCache.buildCityData(
              selectedSource,
              result.tree,
              new Map(), // No additional trees for basic loading
              { width: 1200, height: 900 },
            );
            setCityData(city);

            // Discover packages for violation monitoring
            try {
              console.info('[RepositoryManager] Discovering packages...');

              // Check if packages are already cached
              const cached = cacheService.getAnalysis(selectedSource.id);
              if (cached?.packageLayers) {
                console.info(
                  '[RepositoryManager] Using cached packages:',
                  cached.packageLayers.length,
                );
                setPackageLayers(cached.packageLayers);
              } else {
                // Create source-aware filesystem adapter
                const sourceAdapter = new SourceFileSystemAdapter(
                  selectedSource,
                );

                // Create package module
                const packageModule = new PackageLayerModule();

                // Convert FileTree to FileSystemTree
                const fileSystemTree = result.tree as any;

                // Create file reader function from the source adapter
                const fileReader = sourceAdapter.createFileReader();

                // Discover packages
                const packageResult = await packageModule.discoverPackages(
                  fileSystemTree,
                  fileReader,
                );
                console.info(
                  '[RepositoryManager] Discovered packages:',
                  packageResult?.length || 0,
                );
                // Log detailed structure of first package for debugging
                if (packageResult && packageResult.length > 0) {
                  console.info('[RepositoryManager] First package structure:', {
                    hasPackageData: !!packageResult[0].packageData,
                    packageDataPath: packageResult[0].packageData?.path,
                    packageDataName: packageResult[0].packageData?.name,
                    configFiles: packageResult[0].configFiles,
                    type: packageResult[0].type,
                    keys: Object.keys(packageResult[0]),
                  });
                }

                setPackageLayers(packageResult);

                // Cache the result
                if (packageResult) {
                  cacheService.setAnalysis(selectedSource.id, {
                    packageLayers: packageResult,
                  });
                }
              }
            } catch (error) {
              console.error(
                '[RepositoryManager] Error discovering packages:',
                error,
              );
              // Don't fail the whole load if package discovery fails
              setPackageLayers(null);
            }
          }
        } catch (err) {
          console.error('[RepositoryManager] Error loading tree:', err);
          console.error('[RepositoryManager] Error details:', {
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
            source: selectedSource,
            err,
          });
          setTreeLoadError(
            err instanceof Error ? err.message : 'Failed to load file tree',
          );
          setFileTree(null);
          setTreeStats(null);
          setFilterLayers(null);
          setCityData(null);
          setPackageLayers(null);
        } finally {
          setLoading(false);
        }
      },
      [selectedSource, cacheService, treeCache, cityDataCache],
    );

    // Load tree when source changes
    useEffect(() => {
      console.log(
        '[RepositoryManager] useEffect triggered for loadTree, selectedSource:',
        selectedSource,
      );
      if (selectedSource) {
        loadTree();
      } else {
        console.log('[RepositoryManager] No selectedSource, skipping loadTree');
      }
    }, [selectedSource, loadTree]);

    // Listen for cache invalidation events
    useEffect(() => {
      const handleCacheInvalidated = (event: CustomEvent) => {
        const { repoPath } = event.detail;

        // Check if this invalidation affects our current source
        if (
          selectedSource?.type === 'local' &&
          selectedSource.location === repoPath
        ) {
          console.info(
            '[RepositoryManager] Cache invalidated for current source, reloading...',
          );
          // Clear memory cache for this source
          treeCache.delete(selectedSource.id);
          // Reload the tree
          loadTree(true);
        }
      };

      window.addEventListener(
        'filetree:cache-invalidated',
        handleCacheInvalidated as EventListener,
      );

      return () => {
        window.removeEventListener(
          'filetree:cache-invalidated',
          handleCacheInvalidated as EventListener,
        );
      };
    }, [selectedSource, loadTree, treeCache]);

    // Determine available modes
    // const hasLocalClones = repository.localClones && repository.localClones.length > 0; // TODO: Use for mode availability checks
    // const hasRemoteAccess = Boolean(ghOwner && ghRepo); // TODO: Use for mode availability checks

    // Note: File tree source initialization and toggle handling removed

    // Clean up file tree invalidator on unmount
    useEffect(() => {
      return () => {
        fileTreeInvalidator.destroy();
      };
    }, [fileTreeInvalidator]);

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
          showSidebarControls
          sidebarCollapsed={panelCollapsedState.left ?? false}
          onToggleSidebar={() =>
            handleLeftPanelCollapsedChange(!(panelCollapsedState.left ?? false))
          }
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
          {_loading && !fileTree ? (
            <RepositoryLoadingState repositoryName={repository.name} />
          ) : (
            <GitChangesProvider>
              <RepositoryExplorationView
                repository={repository}
                remoteData={{
                  owner: ghOwner || '',
                  repo: ghRepo || '',
                  defaultBranch: repository.metadata?.defaultBranch || 'main',
                }}
                searchQuery={searchQuery}
                fileTree={fileTree}
                activeFileTreeSource={selectedSource}
                fileTreeSourceService={fileTreeSourceService}
                cacheService={cacheService}
                cityDataCache={cityDataCache}
                treeStats={treeStats}
                fileColorHighlightLayers={fileColorHighlightLayers}
                packageLayers={packageLayers}
                onPackageLayersChange={setPackageLayers}
                leftPanelCollapsed={panelCollapsedState.left ?? false}
                onLeftPanelCollapsedChange={handleLeftPanelCollapsedChange}
              />
            </GitChangesProvider>
          )}
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
      </div>
    );
  },
);
