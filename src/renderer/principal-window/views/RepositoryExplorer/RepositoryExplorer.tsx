import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { GitBranch } from 'lucide-react';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/style.css';
import { usePanelsTheme } from '../../../theme/panelsTheme';
import { useTheme } from 'themed-markdown';

import type { EnhancedAlexandriaEntry, GitStatus } from '../../../../shared/types/repository.types';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { WindowService } from '../../../main-process-api/WindowService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';

import { useRepositoryData, useAllRepositories } from '../../../hooks/useRepositoryData';
import { useComponentTracking } from './components/withComponentTracking';

import { RepositoryDetailsPanel } from './components/RepositoryDetailsPanel';
import { GitCloneModal } from './components/GitCloneModal';
import { RepositoryListHeader } from './components/RepositoryListHeader';

interface RepositoryExplorerProps {
  sidebarCollapsed?: boolean;
}

export const RepositoryExplorer: React.FC<RepositoryExplorerProps> = ({
  sidebarCollapsed = false
}) => {
  const { theme } = useTheme();
  const panelsTheme = usePanelsTheme();
  const trackingProps = useComponentTracking(
    'RepositoryExplorer',
    'src/renderer/principal-window/views/RepositoryExplorer/RepositoryExplorer.tsx',
  );

  const [showGitCloneModal, setShowGitCloneModal] = useState(false);
  const [selectedRepositoryPath, setSelectedRepositoryPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyWithChanges, setShowOnlyWithChanges] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Use the cache to get all repositories
  // Note: autoLoad is set to true, but the cache will check if data already exists
  // from the registration process before making new calls
  const { repositories: cachedRepos, loading: isLoadingRepos, refresh: refreshRepos } = useAllRepositories({
    autoLoad: true,
    subscribe: true,
  });

  // Use cached data for selected repository
  const { data: selectedRepoData } = useRepositoryData(selectedRepositoryPath, {
    autoLoad: true,
    subscribe: true,
  });

  // Extract repositories list from cached data
  const repositories = useMemo(() => {
    return cachedRepos
      .map(cached => cached.repository)
      .sort((a, b) => {
        const aTime = a.mostRecentChange ? new Date(a.mostRecentChange).getTime() : 0;
        const bTime = b.mostRecentChange ? new Date(b.mostRecentChange).getTime() : 0;
        return bTime - aTime;
      });
  }, [cachedRepos]);

  // Get selected repository from cache
  const selectedRepository = selectedRepoData?.repository || null;

  // Extract data for details panel from cached data
  const markdownFiles = selectedRepoData?.markdownFiles || [];
  const gitStatus: GitStatus = selectedRepoData?.gitStatus ? {
    staged: selectedRepoData.gitStatus.stagedFiles.map(f => ({ path: f })),
    unstaged: selectedRepoData.gitStatus.modifiedFiles.map(f => ({ path: f })),
    untracked: selectedRepoData.gitStatus.untrackedFiles.map(f => ({ path: f })),
    deleted: selectedRepoData.gitStatus.deletedFiles.map(f => ({ path: f })),
  } : { staged: [], unstaged: [], untracked: [], deleted: [] };

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setPreferencesLoaded(true);

      if (preferences.landingPage?.showOnlyWithChanges !== undefined) {
        setShowOnlyWithChanges(preferences.landingPage.showOnlyWithChanges);
      }

      // Restore previously selected repository
      if (preferences.landingPage?.selectedRepository && !selectedRepositoryPath) {
        const savedRepo = repositories.find(r => r.name === preferences.landingPage?.selectedRepository);
        if (savedRepo) {
          setSelectedRepositoryPath(savedRepo.path);
        }
      }
    };

    loadPreferences();
  }, [repositories, selectedRepositoryPath]);

  // Auto-select first repository if none selected
  useEffect(() => {
    if (!selectedRepositoryPath && repositories.length > 0 && preferencesLoaded) {
      setSelectedRepositoryPath(repositories[0].path);
    }
  }, [repositories, selectedRepositoryPath, preferencesLoaded]);

  // Save preferences when selection changes
  useEffect(() => {
    if (!preferencesLoaded) return;

    const savePreferences = async () => {
      await UserPreferencesService.updatePreferences({
        landingPage: {
          selectedRepository: selectedRepository?.name,
          showOnlyWithChanges,
        },
      });
    };

    const timeoutId = setTimeout(savePreferences, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedRepository, showOnlyWithChanges, preferencesLoaded]);

  // Handle adding local repository
  const handleAddLocalRepository = useCallback(async () => {
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Local Repository',
        buttonLabel: 'Select Repository',
        properties: ['openDirectory'],
      });

      if (!result || result.canceled) {
        return;
      }

      const selectedPath = result.filePaths?.[0];
      if (selectedPath) {
        // Check if repository already exists
        const existingRepo = repositories.find(repo =>
          repo.path === selectedPath ||
          repo.path === selectedPath.replace(/\/$/, '') ||
          repo.path === selectedPath + '/'
        );

        if (existingRepo) {
          setSelectedRepositoryPath(existingRepo.path);
          return;
        }

        const name = selectedPath.split('/').pop() || 'unnamed';

        // Register with Alexandria and monitoring
        const registeredRepo = await AlexandriaService.registerRepository(name, selectedPath);

        // Select the newly added repository
        setSelectedRepositoryPath(registeredRepo.path);
      }
    } catch (err) {
      console.error('Failed to add local repository:', err);
    }
  }, [repositories]);

  // Handle repository selection
  const handleSelectRepository = async (repo: EnhancedAlexandriaEntry) => {
    setSelectedRepositoryPath(repo.path);
    await WindowService.openRepositoryDashboard(repo);
  };

  // Handle repository removal
  const handleRepositoryRemoved = (removedRepoName: string) => {
    const removedRepo = repositories.find(r => r.name === removedRepoName);
    if (removedRepo && selectedRepositoryPath === removedRepo.path) {
      // Select next available repository
      const remainingRepos = repositories.filter(r => r.name !== removedRepoName);
      const nextRepo = remainingRepos.length > 0 ? remainingRepos[0] : null;
      setSelectedRepositoryPath(nextRepo?.path || null);
    }
  };

  // Handle adding GitHub repository
  const handleAddGithubLink = useCallback(() => {
    setShowGitCloneModal(true);
  }, []);

  // Handle repository added from Git clone modal
  const handleRepositoryAdded = useCallback(async (repo: EnhancedAlexandriaEntry) => {
    setSelectedRepositoryPath(repo.path);
  }, []);

  // Filter repositories based on search and changes filter
  const filteredRepositories = repositories.filter((repo) => {
    if (showOnlyWithChanges && !repo.isDirty) {
      return false;
    }

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      repo.github?.description?.toLowerCase().includes(query) ||
      repo.github?.topics?.some((t) => t.toLowerCase().includes(query))
    );
  });

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

  // Get repository status from cache
  const getRepositoryStatus = (repoPath: string) => {
    const cached = cachedRepos.find(r => r.repository.path === repoPath);
    if (!cached) return null;

    return {
      branch: cached.gitBranch,
      ahead: cached.branchStatus.ahead,
      behind: cached.branchStatus.behind,
      staged: cached.gitStatus?.stagedFiles?.length || 0,
      unstaged: cached.gitStatus?.modifiedFiles?.length || 0,
      untracked: cached.gitStatus?.untrackedFiles?.length || 0,
      hasUncommittedChanges: cached.gitStatus?.isDirty || false,
      canFastForward: cached.branchStatus.canFastForward || false,
      needsUpstream: cached.branchStatus.needsUpstream || false,
      lastChecked: new Date(cached.lastFullRefresh),
    };
  };

  // Render left panel - Repository sidebar
  const renderLeftPanel = () => {
    return (
      <div
        style={{
          height: '100%',
          backgroundColor: theme.colors.backgroundSecondary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <RepositoryListHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddLocalRepository={handleAddLocalRepository}
          onAddGithubLink={handleAddGithubLink}
          repositoryCount={repositories.length}
        />

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px',
          }}
        >
          {isLoadingRepos ? (
            <div style={{ padding: '20px', textAlign: 'center', color: theme.colors.textSecondary }}>
              Loading repositories...
            </div>
          ) : filteredRepositories.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: theme.colors.textSecondary }}>
              {repositories.length === 0
                ? 'No repositories yet. Add one to get started!'
                : 'No repositories match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredRepositories.map((repo) => {
                const status = getRepositoryStatus(repo.path);
                const isSelected = selectedRepositoryPath === repo.path;

                return (
                  <div
                    key={repo.name}
                    data-repo-name={repo.name}
                    onClick={() => setSelectedRepositoryPath(repo.path)}
                    style={{
                      padding: '12px',
                      backgroundColor: isSelected ? `${theme.colors.primary}15` : 'transparent',
                      border: isSelected ? `1px solid ${theme.colors.primary}` : '1px solid transparent',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0, flex: 1, marginRight: '8px' }}>
                            <div
                              style={{
                                fontSize: theme.fontSizes[2],
                                fontWeight: isSelected ? 600 : 500,
                                color: isSelected ? theme.colors.primary : theme.colors.text,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {repo.name}
                            </div>
                            <div
                              style={{
                                fontSize: theme.fontSizes[0],
                                color: theme.colors.textSecondary,
                                marginTop: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span>{repo.github?.owner || repo.remoteUrl?.split('/')[3] || 'local'}</span>
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '2px 6px',
                                  backgroundColor: `${theme.colors.primary}10`,
                                  borderRadius: '4px',
                                }}
                              >
                                <GitBranch size={10} />
                                {status?.branch || repo.gitBranch || 'main'}
                              </span>
                              {(status?.hasUncommittedChanges || repo.isDirty) && (
                                <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: '2px 6px',
                                    backgroundColor: `${theme.colors.warning}15`,
                                    color: theme.colors.warning,
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                  }}
                                >
                                  ● {status ? (status.staged + status.unstaged + status.untracked) : repo.dirtyFileCount}
                                </span>
                              )}
                            </div>

                            {status && (
                              <div
                                style={{
                                  fontSize: theme.fontSizes[0],
                                  marginTop: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                {(status.ahead > 0 || status.behind > 0) && (
                                  <span
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                      padding: '1px 4px',
                                      backgroundColor: status.behind > 0
                                        ? `${theme.colors.warning}10`
                                        : `${theme.colors.info}10`,
                                      color: status.behind > 0
                                        ? theme.colors.warning
                                        : theme.colors.info,
                                      borderRadius: '3px',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {status.ahead > 0 && `↑${status.ahead}`}
                                    {status.ahead > 0 && status.behind > 0 && ' '}
                                    {status.behind > 0 && `↓${status.behind}`}
                                  </span>
                                )}
                                {status.canFastForward && (
                                  <span style={{ color: theme.colors.success }}>
                                    ⟳ FF available
                                  </span>
                                )}
                                {status.needsUpstream && (
                                  <span style={{ color: theme.colors.textSecondary }}>
                                    ⊘ No upstream
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: theme.fontSizes[0],
                              color: repo.isDirty ? theme.colors.warning : theme.colors.textSecondary,
                              whiteSpace: 'nowrap',
                              fontWeight: repo.isDirty ? 500 : 400,
                            }}
                          >
                            {getRelativeTime(repo.mostRecentChange || repo.github?.lastCommit)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render right panel - Repository details
  const renderRightPanel = () => {
    return (
      <RepositoryDetailsPanel
        selectedRepository={selectedRepository}
        repositories={repositories}
        markdownFiles={markdownFiles}
        gitStatus={gitStatus}
        isLoadingDocs={false}
        isLoadingGitStatus={false}
        onOpenDashboard={handleSelectRepository}
        onRepositoryRemoved={handleRepositoryRemoved}
        onRefresh={refreshRepos}
        isRefreshing={isLoadingRepos}
      />
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes flashHighlight {
          0%, 100% {
            background-color: transparent;
            border-color: transparent;
          }
          25%, 75% {
            background-color: ${theme.colors.primary}30;
            border-color: ${theme.colors.primary};
            transform: scale(1.02);
          }
        }

        .flash-highlight {
          animation: flashHighlight 1s ease-in-out;
        }
      `}</style>

      <div
        {...trackingProps}
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <AnimatedResizableLayout
            leftPanel={renderLeftPanel()}
            rightPanel={renderRightPanel()}
            minSize={20}
            defaultSize={25}
            collapsibleSide="left"
            collapsed={sidebarCollapsed}
            style={{ height: '100%', width: '100%' }}
            theme={panelsTheme}
          />
        </div>

        <GitCloneModal
          isOpen={showGitCloneModal}
          onClose={() => setShowGitCloneModal(false)}
          onRepositoryAdded={handleRepositoryAdded}
        />
      </div>
    </div>
  );
};