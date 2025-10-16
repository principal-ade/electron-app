import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  ConfigurablePanelLayout,
  type PanelDefinitionWithContent,
  type PanelLayout,
} from '@a24z/panels';
import '@a24z/panels/panels.css';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import { createFileColorHighlightLayers } from '@principal-ai/code-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type {
  EnhancedAlexandriaEntry,
  GitStatus,
} from '../../../../../shared/types/repository.types';
import type {
  RepositoryPanelVisibility,
  RepositoryPanelId,
} from '../../../../../shared/types/repositoryPanel.types';
import { AlexandriaService } from '../../../../main-process-api/AlexandriaService';
import { RepositoryMonitoringService } from '../../../../main-process-api/RepositoryMonitoringService';
import { WindowService } from '../../../../main-process-api/WindowService';
import { RemoveRepositoryDialog } from './RemoveRepositoryDialog';
import { TerminalService } from '../../../../main-process-api/TerminalService';
import { RepositoryTasksAndNotesPanel } from '../../../../panels/components/RepositoryTasksAndNotesPanel';
import {
  GitService,
  GitBranchStatus,
} from '../../../../main-process-api/GitService';
import { RepositoryHeader } from './RepositoryHeader';
import { GitStatusPanel } from '../../../../panels/components/GitStatusPanel';
import { QualityHexagonPanel } from '../../../../panels/components/QualityHexagonPanel';
import { RepositoryCityService } from './city';
import { CityVisualizationPanel } from '../../../../panels/components/CityVisualizationPanel';
import { RepositoryActionsPanel } from '../../../../panels/components/RepositoryActionsPanel';
import { SecretsModal } from './SecretsModal';
import { ActRunnerService } from '../../../../main-process-api/ActRunnerService';
import type { ActWorkflowAction } from '../../../../../shared/types/act.types';
import {
  ActRunnerWorkflowChannels,
  type ActRunnerWorkflowEvent,
} from '../../../../../shared/types/act.types';
import { PanelConfiguration } from './PanelConfiguration';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import { createDefaultPanelVisibility } from '../../../../panels/registry';
import { useHighlightLayers } from '../../../../contexts/HighlightLayersContext';
import { RightPanel } from './RightPanel';
import { usePanelPersistence } from '../../../../hooks/usePanelPersistence';
import type { Task } from '../../../../../shared/main-process-api-interfaces/PalaceTasksAPI';
import { PalaceTasksService } from '../../../../main-process-api/PalaceTasksService';
import type { GitChangeSelectionStatus } from '../../../../../shared/types/repository.types';

type TaskWithDocumentPath = Task & { documentPath?: string };

interface RepositoryDetailsPanelProps {
  selectedRepository: EnhancedAlexandriaEntry | null;
  repositories: EnhancedAlexandriaEntry[];
  gitStatus: GitStatus;
  isLoadingRepository?: boolean;
  onOpenDashboard: (repo: EnhancedAlexandriaEntry) => void;
  onRepositoryRemoved?: (removedRepoName: string) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  onFileSelect?: (
    filePath: string | null,
    options?: { mode?: 'preview' | 'diff'; gitStatus?: GitChangeSelectionStatus },
  ) => void;
  onOpenTerminal?: () => void;
  // Props for nested right panel (File Preview + Terminal + Markdown)
  selectedFilePath?: string | null;
  rightPanelTab?: 'preview' | 'terminal' | 'markdown' | 'diff';
  onRightPanelTabChange?: (
    tab: 'preview' | 'terminal' | 'markdown' | 'diff',
  ) => void;
  onRightPanelClose?: () => void;
  fileSelectionMode?: 'preview' | 'diff';
  selectedGitStatus?: GitChangeSelectionStatus;
}

export const RepositoryDetailsPanel: React.FC<RepositoryDetailsPanelProps> = ({
  selectedRepository,
  repositories,
  gitStatus,
  isLoadingRepository = false,
  onOpenDashboard,
  onRepositoryRemoved,
  onRefresh,
  isRefreshing: _isRefreshing,
  onFileSelect,
  onOpenTerminal,
  selectedFilePath,
  rightPanelTab = 'preview',
  onRightPanelTabChange,
  onRightPanelClose,
  fileSelectionMode = 'preview',
  selectedGitStatus,
}) => {
  const { theme } = useTheme();
  const { registerLayer, unregisterLayer } = useHighlightLayers();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // Track terminal windows by repository path
  const [terminalWindows, setTerminalWindows] = useState<Map<string, number>>(
    new Map(),
  );

  // Panel configuration state
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [panelVisibility, setPanelVisibility] =
    useState<RepositoryPanelVisibility>(
      createDefaultPanelVisibility({ surfaces: ['explorer'] }),
    );

  // Branch sync status states
  const [branchStatus, setBranchStatus] = useState<GitBranchStatus | null>(
    null,
  );
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<{
    safe: boolean;
    reason?: string;
    needsUpstream: boolean;
  } | null>(null);
  const isCheckingRef = useRef(false);
  const [isRefreshingGitHub, setIsRefreshingGitHub] = useState(false);

  // City visualization state
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [fileTree, setFileTree] = useState<FileTree | null>(null);
  const [isBuildingCity, setIsBuildingCity] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [treeStats, setTreeStats] = useState<{
    fileCount: number;
    directoryCount: number;
  } | null>(null);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [showSecretsModal, setShowSecretsModal] = useState(false);
  const [requiredSecrets, setRequiredSecrets] = useState<string[]>([]);
  const [workflowOutput, setWorkflowOutput] = useState<string[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<
    'idle' | 'running' | 'success' | 'failed'
  >('idle');

  // File color state - default to showing file colors
  const [showFileColors, setShowFileColors] = useState(true);

  const cityService = useMemo(() => RepositoryCityService.getInstance(), []);

  // State for nested panel collapse
  const [nestedRightPanelCollapsed, setNestedRightPanelCollapsed] =
    useState(true);

  // Panel state for nested panel layout (details content in middle, preview/terminal in right)
  const nestedPanelState = usePanelPersistence({
    viewKey: 'repositoryDetailsNested',
    defaultSizes: { left: 0, middle: 50, right: 50 },
    collapsed: { left: true, right: nestedRightPanelCollapsed },
    panelType: 'three-panel',
  });

  // Toggle nested right panel function
  const handleToggleNestedRightPanel = useCallback(() => {
    setNestedRightPanelCollapsed((prev) => !prev);
  }, []);

  const repositoryId = useMemo(() => {
    if (!selectedRepository) {
      return null;
    }

    const candidates: Array<string | number | null | undefined> = [
      selectedRepository.id,
      selectedRepository.repoId,
      selectedRepository.repositoryId,
      selectedRepository.alexandriaId,
      selectedRepository.github?.id,
    ];

    const owner = selectedRepository.github?.owner;
    const repoName =
      selectedRepository.github?.name ?? selectedRepository.name;

    if (owner && repoName) {
      candidates.push(`${owner}/${repoName}`);
    } else if (repoName) {
      candidates.push(repoName);
    }

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
      if (typeof candidate === 'number') {
        return candidate.toString();
      }
    }

    return null;
  }, [selectedRepository]);

  // Create file color highlight layers from fileTree
  const fileColorHighlightLayers = useMemo(() => {
    if (!fileTree || !fileTree.allFiles) return [];
    return createFileColorHighlightLayers(fileTree.allFiles);
  }, [fileTree]);

  // Create git highlight layers from git status
  // Use stable keys based on actual file paths to avoid unnecessary re-renders
  const untrackedKey = useMemo(
    () => (gitStatus.untracked?.map((item) => item.path) ?? []).join('|'),
    [gitStatus.untracked],
  );
  const stagedKey = useMemo(
    () => (gitStatus.staged?.map((item) => item.path) ?? []).join('|'),
    [gitStatus.staged],
  );
  const unstagedKey = useMemo(
    () => (gitStatus.unstaged?.map((item) => item.path) ?? []).join('|'),
    [gitStatus.unstaged],
  );
  const deletedKey = useMemo(
    () => (gitStatus.deleted?.map((item) => item.path) ?? []).join('|'),
    [gitStatus.deleted],
  );

  const gitHighlightLayers = useMemo(() => {
    const layers: HighlightLayer[] = [];

    // Untracked files - Green (new files)
    const untrackedPaths = untrackedKey ? untrackedKey.split('|') : [];
    if (untrackedPaths.length > 0 && untrackedPaths[0] !== '') {
      layers.push({
        id: 'git-untracked',
        name: `Untracked (${untrackedPaths.length})`,
        enabled: true,
        color: '#10b981',
        priority: 25,
        opacity: 0.7,
        items: untrackedPaths.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'fill' as const,
        })),
      });
    }

    // Staged files - Blue
    const stagedPaths = stagedKey ? stagedKey.split('|') : [];
    if (stagedPaths.length > 0 && stagedPaths[0] !== '') {
      layers.push({
        id: 'git-staged',
        name: `Staged (${stagedPaths.length})`,
        enabled: true,
        color: '#3b82f6',
        priority: 26,
        opacity: 0.7,
        items: stagedPaths.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'fill' as const,
        })),
      });
    }

    // Unstaged/Modified files - Orange
    const unstagedPaths = unstagedKey ? unstagedKey.split('|') : [];
    if (unstagedPaths.length > 0 && unstagedPaths[0] !== '') {
      layers.push({
        id: 'git-unstaged',
        name: `Modified (${unstagedPaths.length})`,
        enabled: true,
        color: '#f59e0b',
        priority: 24,
        opacity: 0.7,
        items: unstagedPaths.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'fill' as const,
        })),
      });
    }

    // Deleted files - Red
    const deletedPaths = deletedKey ? deletedKey.split('|') : [];
    if (deletedPaths.length > 0 && deletedPaths[0] !== '') {
      layers.push({
        id: 'git-deleted',
        name: `Deleted (${deletedPaths.length})`,
        enabled: true,
        color: '#ef4444',
        priority: 23,
        opacity: 0.7,
        items: deletedPaths.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'fill' as const,
        })),
      });
    }

    return layers;
  }, [untrackedKey, stagedKey, unstagedKey, deletedKey]);

  // Determine if there are any git changes
  const hasGitChanges = useMemo(() => {
    return (
      (gitStatus.staged && gitStatus.staged.length > 0) ||
      (gitStatus.unstaged && gitStatus.unstaged.length > 0) ||
      (gitStatus.untracked && gitStatus.untracked.length > 0) ||
      (gitStatus.deleted && gitStatus.deleted.length > 0)
    );
  }, [gitStatus]);

  // Select which layers to show: git changes if available, otherwise file colors
  const activeHighlightLayers = useMemo(() => {
    if (hasGitChanges) {
      return gitHighlightLayers;
    }
    return showFileColors ? fileColorHighlightLayers : [];
  }, [
    hasGitChanges,
    gitHighlightLayers,
    showFileColors,
    fileColorHighlightLayers,
  ]);

  // Register active highlight layers with context
  // Use ref to track registered layer count to avoid cleanup issues
  const registeredLayersCountRef = useRef(0);

  useEffect(() => {
    // Unregister previous layers first
    for (let i = 0; i < registeredLayersCountRef.current; i++) {
      unregisterLayer(`repo-highlight-${i}`);
    }

    if (!activeHighlightLayers || activeHighlightLayers.length === 0) {
      registeredLayersCountRef.current = 0;
      return;
    }

    // Register new layers
    activeHighlightLayers.forEach((layer, idx) => {
      registerLayer(`repo-highlight-${idx}`, {
        name: layer.name,
        enabled: layer.enabled,
        color: layer.color,
        priority: layer.priority,
        items: layer.items,
      });
    });

    registeredLayersCountRef.current = activeHighlightLayers.length;
  }, [activeHighlightLayers, registerLayer, unregisterLayer]);

  // Check if there are workflow files in the repository
  const hasWorkflowActions = useMemo(() => {
    if (!fileTree?.allFiles) return false;
    return fileTree.allFiles.some((file) => {
      const path = file.path.toLowerCase();
      return (
        path.includes('.github/workflows/') &&
        (path.endsWith('.yml') || path.endsWith('.yaml'))
      );
    });
  }, [fileTree]);

  // Load panel visibility preferences when repository changes
  useEffect(() => {
    const loadPanelPreferences = async () => {
      if (!repositoryId) return;

      try {
        const preferences = await UserPreferencesService.getPreferences();
        const repoState = preferences.repositoryUIStates?.[repositoryId];

        if (repoState?.panelVisibility) {
          const defaultVisibility = createDefaultPanelVisibility({
            surfaces: ['explorer'],
          });

          // Handle both old (boolean record) and new (visibility + order) formats
          let nextVisibility: RepositoryPanelVisibility;

          if ('visibility' in repoState.panelVisibility && 'order' in repoState.panelVisibility) {
            // New format
            nextVisibility = repoState.panelVisibility as RepositoryPanelVisibility;
          } else {
            // Old format - migrate to new format
            const oldVisibility = repoState.panelVisibility as Record<RepositoryPanelId, boolean>;
            const visibility: Record<RepositoryPanelId, boolean> = {
              ...defaultVisibility.visibility,
            };
            const order: RepositoryPanelId[] = [];

            for (const [key, value] of Object.entries(oldVisibility)) {
              if (typeof value === 'boolean' && key in visibility) {
                visibility[key as RepositoryPanelId] = value;
                if (value) {
                  order.push(key as RepositoryPanelId);
                }
              }
            }

            nextVisibility = { visibility, order };
          }

          setPanelVisibility(nextVisibility);
        } else {
          setPanelVisibility(
            createDefaultPanelVisibility({ surfaces: ['explorer'] }),
          );
        }
      } catch (error) {
        console.error('Error loading panel preferences:', error);
      }
    };

    loadPanelPreferences();
  }, [repositoryId]);

  // Save panel visibility preferences
  const handlePanelVisibilityChange = useCallback(
    async (newVisibility: RepositoryPanelVisibility) => {
      setPanelVisibility(newVisibility);

      if (!repositoryId) return;

      try {
        const preferences = await UserPreferencesService.getPreferences();
        const currentRepoStates = preferences.repositoryUIStates || {};

        await UserPreferencesService.updatePreferences({
          repositoryUIStates: {
            ...currentRepoStates,
            [repositoryId]: {
              ...currentRepoStates[repositoryId],
              panelVisibility: newVisibility,
            },
          },
        });
      } catch (error) {
        console.error('Error saving panel preferences:', error);
      }
    },
    [repositoryId],
  );

  const handleRemoveClick = () => {
    setShowRemoveDialog(true);
  };

  const handleRefreshGitHubMetadata = useCallback(async () => {
    if (!selectedRepository?.name || isRefreshingGitHub) return;

    setIsRefreshingGitHub(true);

    try {
      // Call Alexandria service to refresh GitHub metadata only
      // This fetches from GitHub API and updates the Alexandria registry
      const refreshedRepo = await AlexandriaService.refreshRepository(
        selectedRepository.name,
      );

      if (refreshedRepo) {
        console.log('[RepositoryDetailsPanel] GitHub metadata refreshed:', refreshedRepo);
        // The REPOSITORY_UPDATED event will automatically update the UI via useAllRepositories hook
      }
    } catch (error) {
      console.error(
        '[RepositoryDetailsPanel] Error refreshing GitHub metadata:',
        error,
      );
    } finally {
      setIsRefreshingGitHub(false);
    }
  }, [selectedRepository?.name, isRefreshingGitHub]);

  const handleRemoveConfirm = async (deleteLocal: boolean) => {
    if (!selectedRepository) return;

    try {
      const success = await AlexandriaService.removeRepository(
        selectedRepository.name,
        deleteLocal,
      );

      if (success) {
        setShowRemoveDialog(false);
        // Notify parent component to update state immediately
        if (onRepositoryRemoved) {
          onRepositoryRemoved(selectedRepository.name);
        }
      } else {
        console.error('Failed to remove repository');
      }
    } catch (err) {
      console.error('Error removing repository:', err);
    }
  };

  const handleRemoveCancel = () => {
    setShowRemoveDialog(false);
  };

  const buildCityData = useCallback(async () => {
    if (!selectedRepository) {
      return;
    }

    setIsBuildingCity(true);
    setCityError(null);

    try {
      const result = await cityService.buildCityData(selectedRepository);

      if (result.error) {
        setCityError(result.error);
        setCityData(null);
        setFileTree(null);
        setTreeStats(null);
      } else {
        setCityData(result.cityData);
        setFileTree(result.fileTree);
        setTreeStats(result.treeStats);
        setCityError(null);
      }
    } catch (error) {
      console.error('[RepositoryDetailsPanel] Error building city:', error);
      setCityError(error instanceof Error ? error.message : 'Unknown error');
      setCityData(null);
      setFileTree(null);
      setTreeStats(null);
    } finally {
      setIsBuildingCity(false);
    }
  }, [selectedRepository, cityService]);

  useEffect(() => {
    setCityData(null);
    setFileTree(null);
    setTreeStats(null);
    setCityError(null);
    setIsBuildingCity(false);
  }, [selectedRepository?.path]);

  // Listen for workflow events
  useEffect(() => {
    const handleWorkflowEvent = (data: ActRunnerWorkflowEvent) => {
      switch (data.type) {
        case 'start':
          setWorkflowStatus('running');
          setWorkflowOutput([`Starting workflow: ${data.workflowPath}`]);
          break;

        case 'progress':
          setWorkflowOutput((prev) => [...prev, data.message]);
          break;

        case 'step': {
          const stepIcon =
            data.status === 'success'
              ? '✓'
              : data.status === 'failure'
                ? '✖'
                : '▶';
          setWorkflowOutput((prev) => [...prev, `${stepIcon} ${data.label}`]);
          break;
        }

        case 'error':
          setWorkflowOutput((prev) => [...prev, `ERROR: ${data.message}`]);
          break;

        case 'complete':
          setWorkflowStatus(data.success ? 'success' : 'failed');
          setWorkflowOutput((prev) => [
            ...prev,
            '',
            `Workflow ${data.success ? 'completed successfully' : 'failed'} (${(data.durationMs / 1000).toFixed(1)}s)`,
          ]);
          setRunningActionId(null);
          break;
      }
    };

    // Subscribe to all workflow event channels
    const unsubscribers = [
      window.mainProcess.actRunner.onWorkflowEvent(
        ActRunnerWorkflowChannels.START,
        handleWorkflowEvent,
      ),
      window.mainProcess.actRunner.onWorkflowEvent(
        ActRunnerWorkflowChannels.PROGRESS,
        handleWorkflowEvent,
      ),
      window.mainProcess.actRunner.onWorkflowEvent(
        ActRunnerWorkflowChannels.STEP,
        handleWorkflowEvent,
      ),
      window.mainProcess.actRunner.onWorkflowEvent(
        ActRunnerWorkflowChannels.ERROR,
        handleWorkflowEvent,
      ),
      window.mainProcess.actRunner.onWorkflowEvent(
        ActRunnerWorkflowChannels.COMPLETE,
        handleWorkflowEvent,
      ),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  useEffect(() => {
    setRunningActionId(null);
  }, [repositoryId]);

  const checkForUpdates = useCallback(async () => {
    if (!selectedRepository?.path || isCheckingRef.current) return;

    isCheckingRef.current = true;
    setIsCheckingUpdates(true);

    try {
      const [status, pushSafety] = await Promise.all([
        GitService.getBranchStatus(selectedRepository.path),
        GitService.isPushSafe(selectedRepository.path),
      ]);

      setBranchStatus(status);
      setPushStatus(pushSafety);

      // Status is now shown in the UI components, no banner messages needed
    } catch (error) {
      console.error(
        '[RepositoryDetailsPanel] Error checking for updates:',
        error,
      );
    } finally {
      isCheckingRef.current = false;
      setIsCheckingUpdates(false);
    }
  }, [selectedRepository?.path]); // Only depend on the path, not the entire object or isCheckingUpdates

  const performPush = useCallback(async () => {
    if (!selectedRepository?.path || isPushing || !pushStatus?.safe) return;

    setIsPushing(true);

    try {
      // Get current branch name
      const branchInfo = await GitService.getCurrentBranch(
        selectedRepository.path,
      );

      const result = await GitService.push(selectedRepository.path, {
        branch: branchInfo.branch,
        setUpstream: pushStatus.needsUpstream,
      });

      if (result.success) {
        // Successfully pushed - refresh repository monitoring to update sidebar
        await RepositoryMonitoringService.refreshRepository(
          selectedRepository.path,
        );

        if (onRefresh) {
          await onRefresh();
        }

        // Refresh local branch status
        await checkForUpdates();

        await buildCityData();
      } else {
        console.error('Push failed:', result.message);
      }
    } catch (error) {
      console.error('[RepositoryDetailsPanel] Error pushing:', error);
    } finally {
      setIsPushing(false);
    }
  }, [
    selectedRepository,
    isPushing,
    pushStatus,
    checkForUpdates,
    onRefresh,
    buildCityData,
  ]);

  const performFastForward = useCallback(async () => {
    if (
      !selectedRepository?.path ||
      isFastForwarding ||
      !branchStatus?.canFastForward
    )
      return;

    setIsFastForwarding(true);

    try {
      const result = await GitService.fastForwardMerge(selectedRepository.path);

      if (result.success) {
        // Fast-forward successful - refresh repository monitoring to update sidebar
        await RepositoryMonitoringService.refreshRepository(
          selectedRepository.path,
        );

        if (onRefresh) {
          await onRefresh();
        }

        // Refresh local branch status
        await checkForUpdates();

        await buildCityData();
      } else {
        console.error('Fast-forward failed:', result.message);
      }
    } catch (error) {
      console.error(
        '[RepositoryDetailsPanel] Error performing fast-forward:',
        error,
      );
    } finally {
      setIsFastForwarding(false);
    }
  }, [
    selectedRepository,
    isFastForwarding,
    branchStatus,
    checkForUpdates,
    onRefresh,
    buildCityData,
  ]);

  // Listen for terminal window close events to clean up tracking
  useEffect(() => {
    const handleTerminalWindowClose = (data: {
      terminalId?: string;
      agentSessionId?: string;
      windowId: number;
    }) => {
      // Find and remove the closed window from our tracking
      setTerminalWindows((prev) => {
        const newMap = new Map(prev);
        for (const [path, windowId] of newMap.entries()) {
          if (windowId === data.windowId) {
            newMap.delete(path);
            // Cleaned up closed terminal window
            break;
          }
        }
        return newMap;
      });
    };

    const unsubscribe = TerminalService.onWindowClose(
      handleTerminalWindowClose,
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-check for updates when repository is selected
  useEffect(() => {
    if (selectedRepository?.path) {
      // Reset branch status when switching repositories
      setBranchStatus(null);
      setPushStatus(null);

      // Check for updates after a short delay to avoid rapid calls
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 500);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepository?.path]); // checkForUpdates intentionally excluded - it updates state causing infinite loop

  // Add a separate effect to handle checkForUpdates dependency properly
  useEffect(() => {
    // This ensures checkForUpdates is available but doesn't trigger re-runs
  }, [checkForUpdates]);

  // Handle file click to show in preview panel
  const handleFileClick = useCallback(
    async (filePath: string) => {
      if (!selectedRepository) return;

      // If we have an onFileSelect handler, use it for preview
      if (onFileSelect) {
        onFileSelect(filePath, { mode: 'preview' });
      } else {
        // Fallback to original behavior: open in editor window
        try {
          // Get the absolute file path
          const absolutePath = `${selectedRepository.path}/${filePath}`;

          // Prepare file info for the multi-file editor
          const files = [
            {
              path: absolutePath,
              relativePath: filePath,
              lastModified: Date.now(),
            },
          ];

          // Parse owner and repo from repository name or github info
          let owner = 'local';
          let repo = selectedRepository.name;

          if (selectedRepository.github?.owner) {
            owner = selectedRepository.github.owner;
          }
          if (selectedRepository.github?.name) {
            repo = selectedRepository.github.name;
          }

          // Open the local files editor window
          await WindowService.openLocalFiles({
            windowId: `view-${owner}-${repo}-${Date.now()}`,
            windowTitle: `View ${filePath}`,
            files,
          });
        } catch (error) {
          console.error('[RepositoryDetailsPanel] Error opening file:', error);
        }
      }
    },
    [selectedRepository, onFileSelect],
  );

  const handleGitChangeSelect = useCallback(
    (filePath: string, status?: GitChangeSelectionStatus) => {
      if (onFileSelect && onRightPanelTabChange) {
        onFileSelect(filePath, { mode: 'diff', gitStatus: status });
        onRightPanelTabChange('diff');
        return;
      }

      void handleFileClick(filePath);
    },
    [handleFileClick, onFileSelect, onRightPanelTabChange],
  );

  // Handle clicking a task to view it in the markdown viewer
  const handleTaskClick = useCallback(
    async (task: TaskWithDocumentPath) => {
      if (!selectedRepository) return;

      try {
        // The task content is already markdown, stored in the task's document path
        // Get the full task to ensure we have all details
        const fullTask = (await PalaceTasksService.getTask(
          selectedRepository.path,
          task.id,
        )) as TaskWithDocumentPath | null;

        if (!fullTask) {
          console.error('[RepositoryDetailsPanel] Could not retrieve task');
          return;
        }

        // The task document path should be in the task object
        // If not, construct it based on the repository path and task ID
        // Tasks are stored in .palace-work/tasks/active/ directory
        const taskDocPath =
          fullTask.documentPath ||
          `${selectedRepository.path}/.palace-work/tasks/active/${task.id}.task.md`;

        // If we have an onFileSelect handler and onRightPanelTabChange, use the inline viewer
        if (onFileSelect && onRightPanelTabChange) {
          // Convert absolute path to relative path for the MarkdownRenderingPanel
          const relativePath = taskDocPath.startsWith(selectedRepository.path)
            ? taskDocPath.substring(selectedRepository.path.length + 1) // +1 to remove leading slash
            : taskDocPath;

          // Set the file path to the relative task document path
          onFileSelect(relativePath);
          // Switch to markdown tab
          onRightPanelTabChange('markdown');
        } else {
          // Fallback: open in a dedicated markdown view window
          await WindowService.openMarkdownView(
            taskDocPath,
            selectedRepository.name,
          );
        }
      } catch (error) {
        console.error('[RepositoryDetailsPanel] Error opening task:', error);
      }
    },
    [selectedRepository, onFileSelect, onRightPanelTabChange],
  );

  const handleConfigureSecrets = useCallback((secrets?: string[]) => {
    setRequiredSecrets(secrets || []);
    setShowSecretsModal(true);
  }, []);

  const handleRunRepositoryAction = useCallback(
    async (action: ActWorkflowAction) => {
      if (!selectedRepository || !repositoryId) {
        return;
      }

      setRunningActionId(action.id);
      try {
        if (!action.workflowPath) {
          window.alert(
            'This workflow action is missing a workflow path and cannot run yet.',
          );
          return;
        }

        const repoPath = selectedRepository?.path;

        if (!repoPath) {
          window.alert(
            'Cannot determine repository path for this workflow run.',
          );
          return;
        }

        const validation = await ActRunnerService.validateRunRequirements({
          repoId: repositoryId,
          repoPath,
          workflowPath: action.workflowPath,
          actionId: action.id,
        });

        // Check act installation first (hard requirement)
        if (!validation.actInstalled) {
          const message =
            validation.messages?.join('\n') ??
            'The local act binary is not installed. Install act to enable workflow execution.';
          window.alert(message);
          return;
        }

        // Check secrets only if the workflow requires them
        if (action.requiresSecrets && !validation.secretsConfigured) {
          const secretsList = action.requiredSecrets?.length
            ? `\n\nRequired secrets:\n${action.requiredSecrets.map((s) => `  • ${s}`).join('\n')}`
            : '';
          const message = `This workflow requires secrets to run.${secretsList}\n\nConfigure secrets before running this workflow.`;
          window.alert(message);
          return;
        }

        const result = await ActRunnerService.runRepositoryAction({
          repoId: repositoryId,
          repoPath,
          workflowPath: action.workflowPath,
          actionId: action.id,
        });

        if (!result.success) {
          window.alert(result.error ?? 'Failed to start the workflow run.');
          return;
        }

        if (result.executionId) {
          window.alert(
            `Workflow run started (execution ${result.executionId}).`,
          );
        } else {
          window.alert('Workflow run started.');
        }
      } catch (error) {
        console.error(
          '[RepositoryDetailsPanel] Failed to trigger workflow action:',
          error,
        );
        window.alert(
          'Failed to start the workflow action. Check the console for details.',
        );
      } finally {
        setRunningActionId(null);
      }
    },
    [repositoryId, selectedRepository],
  );

  // Create ordered panels based on user's panel order preference
  const orderedPanels = useMemo(() => {
    return panelVisibility.order.filter(
      (panelId) => panelVisibility.visibility[panelId]
    );
  }, [panelVisibility]);

  // Render a panel based on its ID
  const renderPanel = useCallback(
    (panelId: RepositoryPanelId) => {
      switch (panelId) {
        case 'gitStatus':
          return (
            <GitStatusPanel
              key={panelId}
              repository={selectedRepository}
            />
          );

        case 'tasks':
          return (
            <RepositoryTasksAndNotesPanel
              key={panelId}
              repositoryPath={selectedRepository.path}
              isLoading={false}
              onTaskClick={handleTaskClick}
            />
          );

        case 'cityVisualization':
          return (
            <div key={panelId} style={{ height: '400px' }}>
              <CityVisualizationPanel
                cityData={cityData}
                loading={isBuildingCity}
                treeStats={treeStats}
                onFileClick={handleFileClick}
                onRequestCityData={buildCityData}
                loadingMessage="Building repository structure visualization..."
                emptyMessage={
                  cityError ||
                  'Repository structure not available'
                }
              />
            </div>
          );

        case 'actions':
          if (!hasWorkflowActions) return null;
          return (
            <RepositoryActionsPanel
              key={panelId}
              repoId={repositoryId}
              repositoryPath={selectedRepository.path}
              fileTree={fileTree}
              onConfigure={handleConfigureSecrets}
              onRun={handleRunRepositoryAction}
              runningActionId={runningActionId}
            />
          );

        case 'packageInfo':
          return (
            <QualityHexagonPanel
              key={panelId}
              directory={selectedRepository.path}
              compact={false}
            />
          );

        default:
          return null;
      }
    },
    [
      selectedRepository,
      handleFileClick,
      handleTaskClick,
      cityData,
      isBuildingCity,
      treeStats,
      buildCityData,
      cityError,
      hasWorkflowActions,
      repositoryId,
      fileTree,
      handleConfigureSecrets,
      handleRunRepositoryAction,
      runningActionId,
    ],
  );

  // Format relative time
  const getRelativeTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 30) return `${Math.floor(days / 30)} months ago`;
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  // Loading skeleton component
  const renderLoadingSkeleton = () => (
    <div
      style={{
        height: '100%',
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          height: '101px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            height: '24px',
            width: '40%',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '4px',
            marginBottom: '12px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          style={{
            height: '16px',
            width: '60%',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: '0.1s',
          }}
        />
      </div>

      {/* Content skeleton */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '16px',
          }}
        >
          {/* Left column skeleton */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div
                  style={{
                    height: '18px',
                    width: '30%',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    marginBottom: '12px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
                <div
                  style={{
                    height: '14px',
                    width: '100%',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    marginBottom: '8px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: `${i * 0.1 + 0.05}s`,
                  }}
                />
                <div
                  style={{
                    height: '14px',
                    width: '80%',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: `${i * 0.1 + 0.1}s`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Right column skeleton */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                  height: i === 1 ? '400px' : 'auto',
                }}
              >
                <div
                  style={{
                    height: '18px',
                    width: '40%',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    marginBottom: '12px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
                <div
                  style={{
                    height: '14px',
                    width: '90%',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: `${i * 0.15 + 0.05}s`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
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
  );

  return (
    <div
      style={{
        height: '100%',
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {selectedRepository && showSecretsModal && (
        <SecretsModal
          isOpen={showSecretsModal}
          onClose={() => setShowSecretsModal(false)}
          repository={selectedRepository}
          requiredSecrets={requiredSecrets}
        />
      )}
      {isLoadingRepository ? (
        renderLoadingSkeleton()
      ) : selectedRepository ? (
        <>
          {/* Repository Header */}
          <RepositoryHeader
            repository={selectedRepository}
            gitStatus={gitStatus}
            branchStatus={branchStatus}
            pushStatus={pushStatus}
            isCheckingUpdates={isCheckingUpdates}
            isFastForwarding={isFastForwarding}
            isPushing={isPushing}
            terminalWindows={terminalWindows}
            onPerformFastForward={performFastForward}
            onPerformPush={performPush}
            onOpenDashboard={() => onOpenDashboard(selectedRepository)}
            onRemove={handleRemoveClick}
            onConfigure={() => setShowConfiguration(!showConfiguration)}
            onTerminalWindowsUpdate={setTerminalWindows}
            onOpenTerminal={handleToggleNestedRightPanel}
            isNestedRightPanelCollapsed={nestedRightPanelCollapsed}
            onRefresh={handleRefreshGitHubMetadata}
            isRefreshing={isRefreshingGitHub}
          />

          {/* Panel Configuration */}
          {showConfiguration && (
            <PanelConfiguration
              panelVisibility={panelVisibility}
              onPanelVisibilityChange={handlePanelVisibilityChange}
              onHide={() => setShowConfiguration(false)}
            />
          )}

          {/* Repository Info - Two Nested Panels */}
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
            }}
          >
            <ConfigurablePanelLayout
              panels={[
                {
                  id: 'empty-left',
                  label: 'Empty',
                  content: null,
                },
                {
                  id: 'repository-content',
                  label: 'Repository Content',
                  content: (
                    <div
                      style={{
                        height: '100%',
                        overflow: 'auto',
                        padding: '20px',
                        backgroundColor: theme.colors.background,
                      }}
                    >
                      {/* Main Content Grid - Responsive layout */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 600px), 1fr))',
                          gap: '16px',
                        }}
                      >
                        {/* Render panels in user-defined order */}
                        {orderedPanels.map((panelId) => {
                          const panel = renderPanel(panelId);
                          return panel ? (
                            <div
                              key={panelId}
                              style={{
                                minWidth: 0,
                              }}
                            >
                              {panel}
                            </div>
                          ) : null;
                        })}
                      </div>

                      {/* Workflow Output Console - Always shown when there's output */}
                      {workflowOutput.length > 0 && (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '16px',
                            backgroundColor:
                              theme.colors.backgroundSecondary,
                            borderRadius: '8px',
                            border: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '12px',
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: '14px',
                                fontWeight: 600,
                                color: theme.colors.text,
                              }}
                            >
                              Workflow Output
                              {workflowStatus === 'running' && (
                                <span
                                  style={{
                                    marginLeft: '8px',
                                    fontSize: '12px',
                                    color: theme.colors.info || '#3b82f6',
                                  }}
                                >
                                  (Running...)
                                </span>
                              )}
                              {workflowStatus === 'success' && (
                                <span
                                  style={{
                                    marginLeft: '8px',
                                    fontSize: '12px',
                                    color:
                                      theme.colors.success || '#10b981',
                                  }}
                                >
                                  ✓ Success
                                </span>
                              )}
                              {workflowStatus === 'failed' && (
                                <span
                                  style={{
                                    marginLeft: '8px',
                                    fontSize: '12px',
                                    color: theme.colors.error || '#ef4444',
                                  }}
                                >
                                  ✖ Failed
                                </span>
                              )}
                            </h3>
                            <button
                              onClick={() => {
                                setWorkflowOutput([]);
                                setWorkflowStatus('idle');
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                              }}
                            >
                              Clear
                            </button>
                          </div>
                          <div
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              backgroundColor: theme.colors.background,
                              padding: '12px',
                              borderRadius: '4px',
                              maxHeight: '300px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              color: theme.colors.text,
                            }}
                          >
                            {workflowOutput.map((line, i) => (
                              // eslint-disable-next-line react/no-array-index-key
                              <div key={`${line}-${i}`} style={{ marginBottom: '2px' }}>
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'file-preview-terminal',
                  label: 'Preview & Terminal',
                  content: (
                    <RightPanel
                      filePath={selectedFilePath || null}
                      repositoryPath={selectedRepository.path}
                      activeTab={rightPanelTab}
                      selectionMode={fileSelectionMode}
                      gitStatus={selectedGitStatus}
                      onTabChange={onRightPanelTabChange}
                      onClose={onRightPanelClose}
                    />
                  ),
                },
              ]}
              layout={{
                left: null,
                middle: 'repository-content',
                right: 'file-preview-terminal',
              }}
              collapsiblePanels={{ left: false, right: true }}
              defaultSizes={
                nestedPanelState.type === 'three-panel'
                  ? nestedPanelState.sizes
                  : { left: 0, middle: 50, right: 50 }
              }
              minSizes={{ left: 0, middle: 30, right: 0 }}
              collapsed={nestedPanelState.collapsed}
              style={{ height: '100%', width: '100%' }}
              theme={theme}
              showCollapseButtons={false}
              onPanelResize={
                nestedPanelState.type === 'three-panel'
                  ? nestedPanelState.handlePanelResize
                  : undefined
              }
              onLeftCollapseComplete={
                nestedPanelState.handleLeftCollapseComplete
              }
              onLeftExpandComplete={nestedPanelState.handleLeftExpandComplete}
              onRightCollapseComplete={
                nestedPanelState.type === 'three-panel'
                  ? nestedPanelState.handleRightCollapseComplete
                  : undefined
              }
              onRightExpandComplete={
                nestedPanelState.type === 'three-panel'
                  ? nestedPanelState.handleRightExpandComplete
                  : undefined
              }
            />
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.textSecondary,
            fontSize: '14px',
          }}
        >
          {repositories.length === 0
            ? 'Add a repository to get started'
            : 'Select a repository to view details'}
        </div>
      )}

      {/* Remove Repository Dialog */}
      {showRemoveDialog && selectedRepository && (
        <RemoveRepositoryDialog
          repository={selectedRepository}
          onConfirm={handleRemoveConfirm}
          onCancel={handleRemoveCancel}
        />
      )}
    </div>
  );
};
