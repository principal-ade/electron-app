import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { CityData } from '@principal-ai/code-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { EnhancedAlexandriaEntry, GitStatus } from '../../../../../shared/types/repository.types';
import { AlexandriaService } from '../../../../main-process-api/AlexandriaService';
import { RepositoryMonitoringService } from '../../../../main-process-api/RepositoryMonitoringService';
import { WindowService } from '../../../../main-process-api/WindowService';
import { RemoveRepositoryDialog } from './RemoveRepositoryDialog';
import { TerminalService } from '../../../../main-process-api/TerminalService';
import { RepositoryTasksAndNotesPanel } from './RepositoryTasksAndNotesPanel';
import { GitService, GitBranchStatus } from '../../../../main-process-api/GitService';
import { RepositoryHeader } from './RepositoryHeader';
import { GitStatusPanel } from './GitStatusPanel';
import { RepositoryFilesPanel } from './RepositoryFilesPanel';
import { QualityHexagonPanel } from './quality';
import { SimpleCityVisualization, RepositoryCityService } from './city';
import { RepositoryActionsPanel } from './RepositoryActionsPanel';
import { SecretsModal } from './SecretsModal';
import { ActRunnerService } from '../../../../main-process-api/ActRunnerService';
import type { ActWorkflowAction } from '../../../../../shared/types/act.types';
import { ActRunnerWorkflowChannels, type ActRunnerWorkflowEvent } from '../../../../../shared/types/act.types';
import { PanelConfiguration, type PanelVisibility } from './PanelConfiguration';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';

interface RepositoryDetailsPanelProps {
  selectedRepository: EnhancedAlexandriaEntry | null;
  repositories: EnhancedAlexandriaEntry[];
  markdownFiles: Array<{ path: string; lastModified?: string }>;
  gitStatus: GitStatus;
  isLoadingDocs: boolean;
  isLoadingGitStatus: boolean;
  isLoadingRepository?: boolean;
  onOpenDashboard: (repo: EnhancedAlexandriaEntry) => void;
  onRepositoryRemoved?: (removedRepoName: string) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  onFileSelect?: (filePath: string | null) => void;
  onOpenTerminal?: () => void;
}


export const RepositoryDetailsPanel: React.FC<RepositoryDetailsPanelProps> = ({
  selectedRepository,
  repositories,
  markdownFiles,
  gitStatus,
  isLoadingDocs,
  isLoadingGitStatus,
  isLoadingRepository = false,
  onOpenDashboard,
  onRepositoryRemoved,
  onRefresh,
  isRefreshing: _isRefreshing,
  onFileSelect,
  onOpenTerminal,
}) => {
  const { theme } = useTheme();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // Track terminal windows by repository path
  const [terminalWindows, setTerminalWindows] = useState<Map<string, number>>(new Map());

  // Panel configuration state
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [panelVisibility, setPanelVisibility] = useState<PanelVisibility>({
    files: true,
    gitStatus: true,
    tasksAndNotes: true,
    cityVisualization: true,
    actions: true,
    packageInfo: true,
  });

  // Branch sync status states
  const [branchStatus, setBranchStatus] = useState<GitBranchStatus | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<{ safe: boolean; reason?: string; needsUpstream: boolean } | null>(null);
  const isCheckingRef = useRef(false);

  // City visualization state
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [fileTree, setFileTree] = useState<FileTree | null>(null);
  const [isBuildingCity, setIsBuildingCity] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [treeStats, setTreeStats] = useState<{ fileCount: number; directoryCount: number } | null>(null);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [showSecretsModal, setShowSecretsModal] = useState(false);
  const [requiredSecrets, setRequiredSecrets] = useState<string[]>([]);
  const [workflowOutput, setWorkflowOutput] = useState<string[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');

  const cityService = useMemo(() => RepositoryCityService.getInstance(), []);

  const repositoryId = useMemo(() => {
    if (!selectedRepository) {
      return null;
    }

    const candidates: Array<unknown> = [
      (selectedRepository as any).id,
      (selectedRepository as any).repoId,
      (selectedRepository as any).repositoryId,
      (selectedRepository as any).alexandriaId,
      (selectedRepository as any).github?.id,
    ];

    const owner = (selectedRepository as any).github?.owner;
    const repoName = (selectedRepository as any).github?.name ?? selectedRepository.name;

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


  const sortedMarkdownFiles = useMemo(() => {
    return [...markdownFiles].sort((a, b) => {
      const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return bTime - aTime;
    });
  }, [markdownFiles]);

  // Load panel visibility preferences when repository changes
  useEffect(() => {
    const loadPanelPreferences = async () => {
      if (!repositoryId) return;

      try {
        const preferences = await UserPreferencesService.getPreferences();
        const repoState = preferences.repositoryUIStates?.[repositoryId];

        if (repoState?.panelVisibility) {
          setPanelVisibility({
            files: repoState.panelVisibility.files ?? true,
            gitStatus: repoState.panelVisibility.gitStatus ?? true,
            tasksAndNotes: repoState.panelVisibility.tasksAndNotes ?? true,
            cityVisualization: repoState.panelVisibility.cityVisualization ?? true,
            actions: repoState.panelVisibility.actions ?? true,
            packageInfo: repoState.panelVisibility.packageInfo ?? true,
          });
        } else {
          // Reset to defaults if no preferences found
          setPanelVisibility({
            files: true,
            gitStatus: true,
            tasksAndNotes: true,
            cityVisualization: true,
            actions: true,
            packageInfo: true,
          });
        }
      } catch (error) {
        console.error('Error loading panel preferences:', error);
      }
    };

    loadPanelPreferences();
  }, [repositoryId]);

  // Save panel visibility preferences
  const handlePanelVisibilityChange = useCallback(async (newVisibility: PanelVisibility) => {
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
  }, [repositoryId]);

  const handleRemoveClick = () => {
    setShowRemoveDialog(true);
  };

  const handleRemoveConfirm = async (deleteLocal: boolean) => {
    if (!selectedRepository) return;

    try {
      const success = await AlexandriaService.removeRepository(
        selectedRepository.name,
        deleteLocal
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
          setWorkflowOutput(prev => [...prev, data.message]);
          break;

        case 'step':
          const stepIcon = data.status === 'success' ? '✓' : data.status === 'failure' ? '✖' : '▶';
          setWorkflowOutput(prev => [...prev, `${stepIcon} ${data.label}`]);
          break;

        case 'error':
          setWorkflowOutput(prev => [...prev, `ERROR: ${data.message}`]);
          break;

        case 'complete':
          setWorkflowStatus(data.success ? 'success' : 'failed');
          setWorkflowOutput(prev => [
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
      window.mainProcess.actRunner.onWorkflowEvent(ActRunnerWorkflowChannels.START, handleWorkflowEvent),
      window.mainProcess.actRunner.onWorkflowEvent(ActRunnerWorkflowChannels.PROGRESS, handleWorkflowEvent),
      window.mainProcess.actRunner.onWorkflowEvent(ActRunnerWorkflowChannels.STEP, handleWorkflowEvent),
      window.mainProcess.actRunner.onWorkflowEvent(ActRunnerWorkflowChannels.ERROR, handleWorkflowEvent),
      window.mainProcess.actRunner.onWorkflowEvent(ActRunnerWorkflowChannels.COMPLETE, handleWorkflowEvent),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
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
      console.error('[RepositoryDetailsPanel] Error checking for updates:', error);
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
      const branchInfo = await GitService.getCurrentBranch(selectedRepository.path);

      const result = await GitService.push(selectedRepository.path, {
        branch: branchInfo.branch,
        setUpstream: pushStatus.needsUpstream,
      });

      if (result.success) {
        // Successfully pushed - refresh repository monitoring to update sidebar
        await RepositoryMonitoringService.refreshRepository(selectedRepository.path);

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
  }, [selectedRepository, isPushing, pushStatus, checkForUpdates, onRefresh, buildCityData]);

  const performFastForward = useCallback(async () => {
    if (!selectedRepository?.path || isFastForwarding || !branchStatus?.canFastForward) return;

    setIsFastForwarding(true);

    try {
      const result = await GitService.fastForwardMerge(selectedRepository.path);

      if (result.success) {
        // Fast-forward successful - refresh repository monitoring to update sidebar
        await RepositoryMonitoringService.refreshRepository(selectedRepository.path);

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
      console.error('[RepositoryDetailsPanel] Error performing fast-forward:', error);
    } finally {
      setIsFastForwarding(false);
    }
  }, [selectedRepository, isFastForwarding, branchStatus, checkForUpdates, onRefresh, buildCityData]);



  // Listen for terminal window close events to clean up tracking
  useEffect(() => {
    const handleTerminalWindowClose = (data: { terminalId?: string; agentSessionId?: string; windowId: number }) => {
      // Find and remove the closed window from our tracking
      setTerminalWindows(prev => {
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

    const unsubscribe = TerminalService.onWindowClose(handleTerminalWindowClose);

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
        onFileSelect(filePath);
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
          console.error(
            '[RepositoryDetailsPanel] Error opening file:',
            error,
          );
        }
      }
    },
    [selectedRepository, onFileSelect],
  );

  // Handle clicking a markdown file from the Markdown Documents list.
  // Opens the dedicated markdown-view special window for a single file.
  const handleOpenMarkdown = useCallback(
    async (filePath: string) => {
      if (!selectedRepository) return;

      try {
        const absolutePath = `${selectedRepository.path}/${filePath}`;
        await WindowService.openMarkdownView(absolutePath, selectedRepository.name);
      } catch (error) {
        console.error('[RepositoryDetailsPanel] Error opening markdown view:', error);
      }
    },
    [selectedRepository],
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
          window.alert('This workflow action is missing a workflow path and cannot run yet.');
          return;
        }

        const repoPath = selectedRepository?.path;

        if (!repoPath) {
          window.alert('Cannot determine repository path for this workflow run.');
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
            ? `\n\nRequired secrets:\n${action.requiredSecrets.map(s => `  • ${s}`).join('\n')}`
            : '';
          const message =
            `This workflow requires secrets to run.${secretsList}\n\nConfigure secrets before running this workflow.`;
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
          window.alert(`Workflow run started (execution ${result.executionId}).`);
        } else {
          window.alert('Workflow run started.');
        }
      } catch (error) {
        console.error('[RepositoryDetailsPanel] Failed to trigger workflow action:', error);
        window.alert('Failed to start the workflow action. Check the console for details.');
      } finally {
        setRunningActionId(null);
      }
    },
    [repositoryId, selectedRepository],
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
          padding: '20px',
          borderBottom: `1px solid ${theme.colors.border}`,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            onOpenTerminal={onOpenTerminal}
          />

          {/* Panel Configuration */}
          {showConfiguration && (
            <PanelConfiguration
              panelVisibility={panelVisibility}
              onPanelVisibilityChange={handlePanelVisibilityChange}
              onHide={() => setShowConfiguration(false)}
            />
          )}

          {/* Repository Info */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px',
            }}
          >
            {/* Main Content Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: '16px',
              }}
            >
              {/* Left Column - Combined Files Panel, Git Status and Notes */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  height: 'fit-content',
                  minWidth: 0,
                }}
              >
                {/* Combined Git Changes and Markdown Files */}
                {panelVisibility.files && (
                  <RepositoryFilesPanel
                    repository={selectedRepository}
                    gitStatus={gitStatus}
                    markdownFiles={sortedMarkdownFiles}
                    isLoadingGitStatus={isLoadingGitStatus}
                    isLoadingDocs={isLoadingDocs}
                    onFileClick={handleFileClick}
                    onMarkdownClick={handleFileClick}
                  />
                )}

                {/* Git Status / Last Commit Info */}
                {panelVisibility.gitStatus && (
                  <GitStatusPanel
                    repository={selectedRepository}
                  />
                )}

                {/* Repository Tasks and Notes Panel */}
                {panelVisibility.tasksAndNotes && (
                  <RepositoryTasksAndNotesPanel
                    repositoryPath={selectedRepository.path}
                    isLoading={false}
                  />
                )}
              </div>

              {/* Right Column - City Visualization and Package Information */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minWidth: 0,
                }}
              >
                {/* City Visualization */}
                {panelVisibility.cityVisualization && selectedRepository && (
                  <div>
                    <SimpleCityVisualization
                      repository={selectedRepository}
                      cityData={cityData}
                      isBuilding={isBuildingCity}
                      treeStats={treeStats}
                      height="400px"
                      onFileClick={handleFileClick}
                      onRequestCityData={buildCityData}
                      loadingMessage="Building repository structure visualization..."
                      emptyMessage={cityError || 'Repository structure not available'}
                    />
                  </div>
                )}

                {panelVisibility.actions && (
                  <RepositoryActionsPanel
                    repoId={repositoryId}
                    repositoryPath={selectedRepository.path}
                    fileTree={fileTree}
                    onConfigure={handleConfigureSecrets}
                    onRun={handleRunRepositoryAction}
                    runningActionId={runningActionId}
                  />
                )}

                {/* Workflow Output Console */}
                {workflowOutput.length > 0 && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '16px',
                      backgroundColor: theme.colors.backgroundSecondary,
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
                              color: theme.colors.success || '#10b981',
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
                        <div key={i} style={{ marginBottom: '2px' }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Package Information Panel */}
                {panelVisibility.packageInfo && (
                  <QualityHexagonPanel
                    directory={selectedRepository.path}
                    compact={false}
                  />
                )}
              </div>
            </div>
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
