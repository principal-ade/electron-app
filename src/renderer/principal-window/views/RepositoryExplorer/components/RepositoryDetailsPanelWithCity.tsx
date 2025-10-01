import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import type { CityData } from '@principal-ai/code-city-react';
import type { EnhancedAlexandriaEntry, GitStatus } from '../../../../../shared/types/repository.types';
import { AlexandriaService } from '../../../../main-process-api/AlexandriaService';
import { RepositoryMonitoringService } from '../../../../main-process-api/RepositoryMonitoringService';
import { WindowService } from '../../../../main-process-api/WindowService';
import { RemoveRepositoryDialog } from './RemoveRepositoryDialog';
import { TerminalService } from '../../../../main-process-api/TerminalService';
import { RepositoryNotesPanel } from './RepositoryNotesPanel';
import { GitService, GitBranchStatus } from '../../../../main-process-api/GitService';
import { RepositoryHeader } from './RepositoryHeader';
import { GitStatusPanel } from './GitStatusPanel';
import { QualityHexagonPanel } from './quality';
import { SimpleCityVisualization, RepositoryCityService } from './city';

interface RepositoryDetailsPanelWithCityProps {
  selectedRepository: EnhancedAlexandriaEntry | null;
  repositories: EnhancedAlexandriaEntry[];
  markdownFiles: Array<{ path: string; lastModified?: string }>;
  gitStatus: GitStatus;
  isLoadingDocs: boolean;
  isLoadingGitStatus: boolean;
  onOpenDashboard: (repo: EnhancedAlexandriaEntry) => void;
  onRepositoryRemoved?: (removedRepoName: string) => void;
}

export const RepositoryDetailsPanelWithCity: React.FC<RepositoryDetailsPanelWithCityProps> = ({
  selectedRepository,
  repositories,
  markdownFiles,
  gitStatus,
  isLoadingDocs,
  isLoadingGitStatus,
  onOpenDashboard,
  onRepositoryRemoved,
}) => {
  const { theme } = useTheme();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // Track terminal windows by repository path
  const [terminalWindows, setTerminalWindows] = useState<Map<string, number>>(new Map());

  // Branch sync status states
  const [branchStatus, setBranchStatus] = useState<GitBranchStatus | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<{ safe: boolean; reason?: string; needsUpstream: boolean } | null>(null);
  const isCheckingRef = useRef(false);

  // City visualization state
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [isBuildingCity, setIsBuildingCity] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [treeStats, setTreeStats] = useState<{ fileCount: number; directoryCount: number } | null>(null);
  
  // Get city service instance
  const cityService = useMemo(() => RepositoryCityService.getInstance(), []);

  const sortedMarkdownFiles = useMemo(() => {
    return [...markdownFiles].sort((a, b) => {
      const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return bTime - aTime;
    });
  }, [markdownFiles]);

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

  // Build city data for the current repository
  const buildCityData = useCallback(async () => {
    if (!selectedRepository) return;

    setIsBuildingCity(true);
    setCityError(null);

    try {
      const result = await cityService.buildCityData(selectedRepository);
      
      if (result.error) {
        setCityError(result.error);
        setCityData(null);
        setTreeStats(null);
      } else {
        setCityData(result.cityData);
        setTreeStats(result.treeStats);
        setCityError(null);
      }
    } catch (error) {
      console.error('[RepositoryDetailsPanelWithCity] Error building city:', error);
      setCityError(error instanceof Error ? error.message : 'Unknown error');
      setCityData(null);
      setTreeStats(null);
    } finally {
      setIsBuildingCity(false);
    }
  }, [selectedRepository, cityService]);

  // Reset city data when repository changes
  useEffect(() => {
    setCityData(null);
    setTreeStats(null);
    setCityError(null);
    setIsBuildingCity(false);
  }, [selectedRepository?.path]);

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
      console.error('[RepositoryDetailsPanelWithCity] Error checking for updates:', error);
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

        // Refresh local branch status
        await checkForUpdates();
      } else {
        console.error('Push failed:', result.message);
      }
    } catch (error) {
      console.error('[RepositoryDetailsPanelWithCity] Error pushing:', error);
    } finally {
      setIsPushing(false);
    }
  }, [selectedRepository, isPushing, pushStatus, checkForUpdates]);

  const performFastForward = useCallback(async () => {
    if (!selectedRepository?.path || isFastForwarding || !branchStatus?.canFastForward) return;

    setIsFastForwarding(true);

    try {
      const result = await GitService.fastForwardMerge(selectedRepository.path);

      if (result.success) {
        // Fast-forward successful - refresh repository monitoring to update sidebar
        await RepositoryMonitoringService.refreshRepository(selectedRepository.path);

        // Refresh local branch status
        await checkForUpdates();
      } else {
        console.error('Fast-forward failed:', result.message);
      }
    } catch (error) {
      console.error('[RepositoryDetailsPanelWithCity] Error performing fast-forward:', error);
    } finally {
      setIsFastForwarding(false);
    }
  }, [selectedRepository, isFastForwarding, branchStatus, checkForUpdates]);

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

  // Handle file click to open in multi-file editor window
  const handleFileClick = useCallback(
    async (filePath: string) => {
      if (!selectedRepository) return;

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

        if ((selectedRepository as any).github?.owner) {
          owner = (selectedRepository as any).github.owner;
        }
        if ((selectedRepository as any).github?.name) {
          repo = (selectedRepository as any).github.name;
        }

        // Open the local files editor window
        await WindowService.openLocalFiles({
          windowId: `view-${owner}-${repo}-${Date.now()}`,
          windowTitle: `View ${filePath}`,
          files,
        });
      } catch (error) {
        console.error(
          '[RepositoryDetailsPanelWithCity] Error opening file:',
          error,
        );
      }
    },
    [selectedRepository],
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
        console.error('[RepositoryDetailsPanelWithCity] Error opening markdown view:', error);
      }
    },
    [selectedRepository],
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
      {selectedRepository ? (
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
            onTerminalWindowsUpdate={setTerminalWindows}
          />

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
              {/* Left Column - City Visualization, Git Status and Quality Panel */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minWidth: 0,
                }}
              >
                {/* City Visualization - Always Visible */}
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
                    emptyMessage={cityError || "Repository structure not available"}
                  />
                </div>

                {/* Git Changes List or Last Commit */}
                <GitStatusPanel
                  repository={selectedRepository}
                  gitStatus={gitStatus}
                  isLoadingGitStatus={isLoadingGitStatus}
                  onFileClick={handleFileClick}
                />

                {/* Quality Hexagon Panel */}
                <QualityHexagonPanel
                  repository={selectedRepository.path}
                  autoAnalyze={false}
                  size="lg"
                  compact={false}
                />
              </div>

              {/* Right Column - Markdown and Notes */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  height: 'fit-content',
                  minWidth: 0,
                }}
              >
                {/* Markdown Files List */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textSecondary,
                      marginBottom: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Markdown Documents</span>
                    <span style={{ fontSize: theme.fontSizes[1], fontWeight: 'normal', marginRight: '4px' }}>
                      {isLoadingDocs ? 'Loading...' : sortedMarkdownFiles.length}
                    </span>
                  </div>
                  <div
                    style={{
                      maxHeight: '300px',
                      overflow: 'auto',
                    }}
                  >
                    {isLoadingDocs ? (
                      <div
                        style={{
                          padding: '20px',
                          textAlign: 'center',
                          color: theme.colors.textSecondary,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        Loading documents...
                      </div>
                    ) : sortedMarkdownFiles.length === 0 ? (
                      <div
                        style={{
                          padding: '20px',
                          textAlign: 'center',
                          color: theme.colors.textSecondary,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        No markdown documents found
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        {sortedMarkdownFiles.map((file) => {
                          const filename = file.path.split('/').pop() || file.path;
                          const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                          return (
                            <div
                              key={file.path}
                              style={{
                                padding: '10px',
                                backgroundColor: theme.colors.background,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.backgroundTertiary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.background;
                              }}
                              onClick={() => handleOpenMarkdown(file.path)}
                              title={file.path}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  marginBottom: '2px',
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: theme.fontSizes[1], // 14px
                                    color: theme.colors.text,
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1,
                                  }}
                                >
                                  {filename}
                                </div>
                                {file.lastModified && (
                                  <div
                                    style={{
                                      fontSize: theme.fontSizes[1],
                                      color: theme.colors.textSecondary,
                                      whiteSpace: 'nowrap',
                                      marginLeft: '8px',
                                    }}
                                  >
                                    {getRelativeTime(file.lastModified)}
                                  </div>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: theme.fontSizes[0],
                                  color: theme.colors.textSecondary,
                                  fontFamily: theme.fonts.monospace,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {directory === 'root' ? 'root' : `${directory}/`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Repository Notes Panel */}
                <RepositoryNotesPanel
                  repositoryPath={selectedRepository.path}
                  isLoading={false}
                />
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