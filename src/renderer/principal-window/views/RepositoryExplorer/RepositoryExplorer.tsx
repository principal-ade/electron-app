import React, { useCallback, useState, useEffect } from 'react';
import { GitBranch, Star } from 'lucide-react';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/style.css';
import { usePanelsTheme } from '../../../theme/panelsTheme';
import type { AlexandriaEntry } from '@a24z/core-library';
// MainWindowTitlebar removed - using IntegratedTitlebar in shell
import type { EnhancedAlexandriaEntry, GitStatus } from '../../../../shared/types/repository.types';

import { useTheme } from 'themed-markdown';

// Agent configuration removed - handled at app level
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { AlexandriaDocsService } from '../../../main-process-api/AlexandriaDocsService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { GitService } from '../../../main-process-api/GitService';
import { WindowService } from '../../../main-process-api/WindowService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { useComponentTracking } from './components/withComponentTracking';

// OnboardingFlowV2 will be handled by settings modal
import { RepositoryDetailsPanel } from './components/RepositoryDetailsPanel';
import { GitCloneModal } from './components/GitCloneModal';
import { RepositoryListHeader } from './components/RepositoryListHeader';

interface RepositoryExplorerProps {
  sidebarCollapsed?: boolean;
}

interface RepositoryStatus {
  branch: string;
  ahead?: number;
  behind?: number;
  staged?: number;
  unstaged?: number;
  untracked?: number;
  hasUncommittedChanges?: boolean;
  canFastForward?: boolean;
  needsUpstream?: boolean;
  error?: string;
  lastChecked: Date;
}

export const RepositoryExplorer: React.FC<RepositoryExplorerProps> = ({ sidebarCollapsed = false }) => {
  const { theme } = useTheme();
  const panelsTheme = usePanelsTheme();
  const trackingProps = useComponentTracking(
    'RepositoryExplorer',
    'src/renderer/principal-window/views/RepositoryExplorer/RepositoryExplorer.tsx',
  );
  const [showGitCloneModal, setShowGitCloneModal] = useState(false);

  // Repository state
  const [repositories, setRepositories] = useState<EnhancedAlexandriaEntry[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<EnhancedAlexandriaEntry | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyWithChanges, setShowOnlyWithChanges] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Bulk status check state
  const [repositoryStatuses, setRepositoryStatuses] = useState<Map<string, RepositoryStatus>>(new Map());
  const [isCheckingAllStatus, setIsCheckingAllStatus] = useState(false);

  // Markdown files and git status state
  const [markdownFiles, setMarkdownFiles] = useState<Array<{ path: string; lastModified?: string }>>([]);
  const [gitStatus, setGitStatus] = useState<GitStatus>({ staged: [], unstaged: [], untracked: [] });
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingGitStatus, setIsLoadingGitStatus] = useState(false);


  // Helper function to enhance a single repository with git info
  const enhanceRepositoryWithGitInfo = useCallback(async (repo: AlexandriaEntry): Promise<EnhancedAlexandriaEntry> => {
    try {
      // Get git branch
      const branchResult = await GitService.execCommand(repo.path, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]).catch(() => ({ stdout: 'main', stderr: '' }));
      const gitBranch = branchResult.stdout.trim() || 'main';

      // Get git status to check if dirty
      const status = await GitService.getStatus(repo.path).catch(() => ({
        staged: [],
        unstaged: [],
        untracked: [],
      }));

      const isDirty = status.staged.length > 0 ||
                     status.unstaged.length > 0 ||
                     status.untracked.length > 0;
      const dirtyFileCount = status.staged.length + status.unstaged.length + status.untracked.length;

      let mostRecentChange = repo.github?.lastCommit;

      // If no GitHub lastCommit, get the last commit date from git
      if (!mostRecentChange) {
        try {
          const lastCommitResult = await GitService.execCommand(repo.path, [
            'log',
            '-1',
            '--format=%cI', // ISO 8601 format
          ]).catch(() => null);

          if (lastCommitResult && lastCommitResult.stdout) {
            mostRecentChange = lastCommitResult.stdout.trim();
          }
        } catch (error) {
          console.warn(`Failed to get last commit date for ${repo.name}:`, error);
        }
      }

      // If there are uncommitted changes, get the most recent file modification time
      if (isDirty) {
        try {
          const allChangedFiles = [...status.staged, ...status.unstaged, ...status.untracked];
          const fileStats = await Promise.all(
            allChangedFiles.map(async (filePath) => {
              try {
                const fullPath = `${repo.path}/${filePath}`;
                const stats = await FileSystemService.getFileStats(fullPath);
                return stats?.lastModified || null;
              } catch (_error) {
                return null;
              }
            })
          );

          const validTimes = fileStats.filter(time => time);
          if (validTimes.length > 0) {
            const recentTime = validTimes.reduce((latest, current) => {
              if (!latest) return current;
              if (!current) return latest;
              const latestDate = new Date(latest);
              const currentDate = new Date(current);
              return currentDate > latestDate ? current : latest;
            });
            mostRecentChange = recentTime ? (typeof recentTime === 'string' ? recentTime : recentTime.toISOString()) : mostRecentChange;
          }
        } catch (error) {
          console.warn(`Failed to get modification times for ${repo.name}:`, error);
        }
      }

      return {
        ...repo,
        gitBranch,
        isDirty,
        dirtyFileCount,
        mostRecentChange,
      };
    } catch (error) {
      console.warn(`Failed to get git info for ${repo.name}:`, error);
      return {
        ...repo,
        gitBranch: 'main',
        isDirty: false,
        dirtyFileCount: 0,
        mostRecentChange: repo.github?.lastCommit,
      };
    }
  }, []);

  const loadRepositories = useCallback(async () => {
    try {
      setIsLoadingRepos(true);
      const repos = await AlexandriaService.getRepositories();

      // Enhance repositories with git information using the helper function
      const enhancedRepos: EnhancedAlexandriaEntry[] = await Promise.all(
        repos.map(repo => enhanceRepositoryWithGitInfo(repo))
      );

      // Sort repositories by most recent activity (either file changes or commits)
      const sortedRepos = [...enhancedRepos].sort((a, b) => {
        const aTime = a.mostRecentChange ? new Date(a.mostRecentChange).getTime() : 0;
        const bTime = b.mostRecentChange ? new Date(b.mostRecentChange).getTime() : 0;
        return bTime - aTime; // Most recent first
      });

      setRepositories(sortedRepos);

      // Load preferences if not already loaded
      if (!preferencesLoaded) {
        const preferences = await UserPreferencesService.getPreferences();
        setPreferencesLoaded(true);

        // Load the show only with changes filter
        if (preferences.landingPage?.showOnlyWithChanges !== undefined) {
          setShowOnlyWithChanges(preferences.landingPage.showOnlyWithChanges);
        }

        // Try to restore the previously selected repository
        if (preferences.landingPage?.selectedRepository) {
          const savedRepo = sortedRepos.find(r => r.name === preferences.landingPage?.selectedRepository);
          if (savedRepo) {
            setSelectedRepository(savedRepo);
            return; // Don't auto-select first if we found the saved one
          }
        }
      }

      // Select first repository by default if none selected
      if (!selectedRepository && sortedRepos.length > 0) {
        setSelectedRepository(sortedRepos[0]);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setIsLoadingRepos(false);
    }
  }, [enhanceRepositoryWithGitInfo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: Adding preferencesLoaded/selectedRepository would cause infinite loops since this function sets them

  // Load repositories on mount and listen for backend events
  useEffect(() => {
    loadRepositories();

    // Subscribe to repository changes from backend
    const unsubscribe = AlexandriaService.onRepositoryChange((event) => {
      // For removal and add events that we handle locally, skip the reload
      if (event.type === 'removed') {
        // Already handled in handleRepositoryRemoved
        return;
      }

      if (event.type === 'added' && event.repository) {
        // Check if we already have this repository (from our optimistic update)
        setRepositories(prev => {
          const exists = prev.some(repo => repo.name === event.repository?.name);
          if (exists) {
            // We added it optimistically, just update with backend data
            return prev.map(repo =>
              repo.name === event.repository?.name
                ? { ...repo, ...event.repository }
                : repo
            );
          } else {
            // This was added externally, add it to our list
            return [event.repository as EnhancedAlexandriaEntry, ...prev];
          }
        });
        return;
      }

      // For update events, reload to get fresh data
      if (event.type === 'updated') {
        loadRepositories();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadRepositories]);



  // Handle repository removal
  const handleRepositoryRemoved = (removedRepoName: string) => {
    // Update local state immediately for smooth UX
    setRepositories(prev => prev.filter(repo => repo.name !== removedRepoName));

    // Clear selection if the removed repo was selected
    if (selectedRepository?.name === removedRepoName) {
      // Select next available repository or null
      const remainingRepos = repositories.filter(repo => repo.name !== removedRepoName);
      const nextRepo = remainingRepos.length > 0 ? remainingRepos[0] : null;
      setSelectedRepository(nextRepo);

      // Clear related data
      setMarkdownFiles([]);
      setGitStatus({ staged: [], unstaged: [], untracked: [] });

      // Update preferences to clear or update selection
      UserPreferencesService.updatePreferences({
        landingPage: {
          selectedRepository: nextRepo?.name,
          showOnlyWithChanges,
        },
      });
    }
  };

  // Helper function to load docs and git status for a repository
  const loadDocsAndGitStatusForRepo = useCallback(async (repo: EnhancedAlexandriaEntry) => {
    // Load markdown files
    setIsLoadingDocs(true);
    try {
      const comprehensiveDocs = await AlexandriaDocsService.getComprehensiveDocuments(repo);
      const allDocs = comprehensiveDocs.all || [];

      // Get last modified times for each file using file system stats
      const docsWithTimestamps = await Promise.all(
        allDocs.map(async (filePath) => {
          try {
            const fullPath = `${repo.path}/${filePath}`;
            const stats = await FileSystemService.getFileStats(fullPath);
            const lastModified = stats?.lastModified;
            return {
              path: filePath,
              lastModified: lastModified ? (typeof lastModified === 'string' ? lastModified : lastModified.toISOString()) : undefined
            };
          } catch (error) {
            console.warn(`Failed to get timestamp for ${filePath}:`, error);
            return {
              path: filePath,
              lastModified: undefined
            };
          }
        })
      );

      // Sort by most recent changes first
      const sortedDocs = docsWithTimestamps.sort((a, b) => {
        if (!a.lastModified && !b.lastModified) return a.path.localeCompare(b.path);
        if (!a.lastModified) return 1;
        if (!b.lastModified) return -1;
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      });

      setMarkdownFiles(sortedDocs);
    } catch (error) {
      console.error('Failed to load markdown files:', error);
      setMarkdownFiles([]);
    } finally {
      setIsLoadingDocs(false);
    }

    // Load git status
    setIsLoadingGitStatus(true);
    try {
      const status = await GitService.getStatus(repo.path);

      // Helper function to get timestamps for files
      const getFileTimestamps = async (files: string[]) => {
        return Promise.all(
          files.map(async (filePath) => {
            try {
              const fullPath = `${repo.path}/${filePath}`;
              const stats = await FileSystemService.getFileStats(fullPath);
              const lastModified = stats?.lastModified;
              return {
                path: filePath,
                lastModified: lastModified ? (typeof lastModified === 'string' ? lastModified : lastModified.toISOString()) : undefined
              };
            } catch (error) {
              console.warn(`Failed to get timestamp for ${filePath}:`, error);
              return {
                path: filePath,
                lastModified: undefined
              };
            }
          })
        );
      };

      // Get timestamps for all file categories
      const [stagedWithTime, unstagedWithTime, untrackedWithTime] = await Promise.all([
        getFileTimestamps(status.staged),
        getFileTimestamps(status.unstaged),
        getFileTimestamps(status.untracked)
      ]);

      setGitStatus({
        staged: stagedWithTime,
        unstaged: unstagedWithTime,
        untracked: untrackedWithTime
      });
    } catch (error) {
      console.error('Failed to load git status:', error);
      setGitStatus({ staged: [], unstaged: [], untracked: [] });
    } finally {
      setIsLoadingGitStatus(false);
    }
  }, []);

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

      // Handle both possible response formats
      const selectedPath = result.filePaths?.[0];

      if (selectedPath) {
        // Check if repository already exists by path
        const existingRepo = repositories.find(repo =>
          repo.path === selectedPath ||
          repo.path === selectedPath.replace(/\/$/, '') || // Handle trailing slash
          repo.path === selectedPath + '/'
        );

        if (existingRepo) {
          // Repository already exists - select it instead
          setSelectedRepository(existingRepo);

          // Flash the existing repository to show it's already added
          const repoElement = document.querySelector(`[data-repo-name="${existingRepo.name}"]`);
          if (repoElement) {
            // Add a flash animation
            repoElement.classList.add('flash-highlight');
            setTimeout(() => {
              repoElement.classList.remove('flash-highlight');
            }, 1000);
          }

          console.info(`Repository already exists: ${existingRepo.name}`);
          return;
        }

        const name = selectedPath.split('/').pop() || 'unnamed';

        // Also check if a repository with the same name exists
        const existingByName = repositories.find(repo => repo.name === name);
        if (existingByName) {
          // If the name exists but path is different, we might want to use a different name
          // For now, let's add a number suffix
          let counter = 2;
          let uniqueName = `${name}-${counter}`;
          while (repositories.find(repo => repo.name === uniqueName)) {
            counter++;
            uniqueName = `${name}-${counter}`;
          }
          console.info(`Repository name '${name}' already exists, using '${uniqueName}' instead`);
          // Note: We'll still use 'name' for registration as the backend might handle this differently
        }

        // Create a basic placeholder entry for instant feedback
        const placeholderRepo: EnhancedAlexandriaEntry = {
          name,
          path: selectedPath,
          registeredAt: new Date().toISOString(),
          hasViews: false,
          viewCount: 0,
          bookColor: '#3b82f6',
          gitBranch: 'loading...',
          isDirty: false,
          dirtyFileCount: 0,
          mostRecentChange: new Date().toISOString(),
        };

        // Add placeholder immediately for instant feedback
        setRepositories(prev => [placeholderRepo, ...prev]);
        setSelectedRepository(placeholderRepo);

        // Clear previous selection data
        setMarkdownFiles([]);
        setGitStatus({ staged: [], unstaged: [], untracked: [] });

        // Register with backend and get enriched data
        const registeredRepo = await AlexandriaService.registerRepository(name, selectedPath);

        // Immediately enhance with git info (this is the important part!)
        const enhancedRepo = await enhanceRepositoryWithGitInfo(registeredRepo);

        // Update with the fully enhanced repository
        setRepositories(prev =>
          prev.map(repo => repo.name === name ? enhancedRepo : repo)
        );
        setSelectedRepository(enhancedRepo);

        // Load docs and git status for the newly selected repo
        loadDocsAndGitStatusForRepo(enhancedRepo);
      }
    } catch (err) {
      console.error('Failed to add local repository:', err);
    }
  }, [repositories, enhanceRepositoryWithGitInfo, loadDocsAndGitStatusForRepo]);

  // Handle repository selection
  const handleSelectRepository = async (repo: EnhancedAlexandriaEntry) => {
    setSelectedRepository(repo);
    // Open repository dashboard
    await WindowService.openRepositoryDashboard(repo);
  };

  // Save preferences when selected repository or filter changes
  useEffect(() => {
    // Don't save preferences until they've been loaded initially
    if (!preferencesLoaded) return;

    const savePreferences = async () => {
      await UserPreferencesService.updatePreferences({
        landingPage: {
          selectedRepository: selectedRepository?.name,
          showOnlyWithChanges,
        },
      });
    };

    // Debounce the save to avoid too many writes
    const timeoutId = setTimeout(savePreferences, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedRepository, showOnlyWithChanges, preferencesLoaded]);

  // Load markdown files and git status when repository is selected
  useEffect(() => {
    if (!selectedRepository) {
      setMarkdownFiles([]);
      setGitStatus({ staged: [], unstaged: [], untracked: [] });
      return;
    }

    loadDocsAndGitStatusForRepo(selectedRepository);
  }, [selectedRepository, loadDocsAndGitStatusForRepo]);

  // Filter repositories based on search and changes filter
  const filteredRepositories = repositories.filter((repo) => {
    // Apply changes filter first
    if (showOnlyWithChanges && !repo.isDirty) {
      return false;
    }

    // Apply search filter
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

  // Handle pasting GitHub link
  const handleAddGithubLink = useCallback(() => {
    setShowGitCloneModal(true);
  }, []);


  // Handle checking all repository statuses
  const handleCheckAllStatus = useCallback(async () => {
    if (isCheckingAllStatus || repositories.length === 0) return;

    setIsCheckingAllStatus(true);
    const statusMap = new Map<string, RepositoryStatus>();

    try {

      // Check each repository's status
      for (const repo of repositories) {
        try {
          // Get current branch
          const branchResult = await GitService.execCommand(repo.path, [
            'rev-parse',
            '--abbrev-ref',
            'HEAD',
          ]);
          const branch = branchResult.stdout.trim() || 'main';

          // Get branch status (ahead/behind)
          const branchStatus = await GitService.getBranchStatus(repo.path);

          // Get file status (staged/unstaged/untracked)
          const gitStatus = await GitService.getStatus(repo.path);

          // Check if push is safe (has upstream)
          const pushSafety = await GitService.isPushSafe(repo.path);

          statusMap.set(repo.name, {
            branch,
            ahead: branchStatus.ahead,
            behind: branchStatus.behind,
            staged: gitStatus.staged.length,
            unstaged: gitStatus.unstaged.length,
            untracked: gitStatus.untracked.length,
            hasUncommittedChanges: branchStatus.hasUncommittedChanges,
            canFastForward: branchStatus.canFastForward,
            needsUpstream: pushSafety.needsUpstream,
            lastChecked: new Date(),
          });
        } catch (error) {
          // Add error status for this repository
          statusMap.set(repo.name, {
            branch: 'unknown',
            error: `Failed to check: ${error instanceof Error ? error.message : 'Unknown error'}`,
            lastChecked: new Date(),
          });
        }

        // Update the statuses as we go for better UX
        setRepositoryStatuses(new Map(statusMap));
      }
    } catch (error) {
      console.error('Failed to check repository statuses:', error);
    } finally {
      setIsCheckingAllStatus(false);
    }
  }, [repositories, isCheckingAllStatus]);


  // Handle repository added from Git clone modal
  const handleRepositoryAdded = useCallback(async (repo: EnhancedAlexandriaEntry) => {
    // Refresh the repositories list to include the new one
    await loadRepositories();
    // Select the newly added repository
    setSelectedRepository(repo);
  }, [loadRepositories]);


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

        {/* Repository List Header with Search */}
        <RepositoryListHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddLocalRepository={handleAddLocalRepository}
          onAddGithubLink={handleAddGithubLink}
          repositoryCount={repositories.length}
          onCheckAllStatus={handleCheckAllStatus}
          isCheckingStatus={isCheckingAllStatus}
          showOnlyWithChanges={showOnlyWithChanges}
          onToggleChangesFilter={(newValue) => {
            setShowOnlyWithChanges(newValue);
            // Save filter preference immediately
            UserPreferencesService.updatePreferences({
              landingPage: {
                selectedRepository: selectedRepository?.name,
                showOnlyWithChanges: newValue,
              },
            });
          }}
        />

        {/* Repository List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px',
          }}
        >
          {isLoadingRepos ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[1],
              }}
            >
              Loading repositories...
            </div>
          ) : filteredRepositories.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[1],
              }}
            >
              No repositories yet. Add one to get started!
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {filteredRepositories.map((repo) => {
                const status = repositoryStatuses.get(repo.name);
                return (
                <div
                  key={repo.name}
                  data-repo-name={repo.name}
                  onClick={() => {
                    setSelectedRepository(repo);
                    // Also save the selection immediately when user clicks
                    UserPreferencesService.updatePreferences({
                      landingPage: {
                        selectedRepository: repo.name,
                        showOnlyWithChanges,
                      },
                    });
                  }}
                  style={{
                    padding: '12px',
                    backgroundColor:
                      selectedRepository?.name === repo.name
                        ? `${theme.colors.primary}15`
                        : 'transparent',
                    border:
                      selectedRepository?.name === repo.name
                        ? `1px solid ${theme.colors.primary}`
                        : '1px solid transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedRepository?.name !== repo.name) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedRepository?.name !== repo.name) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0, flex: 1, marginRight: '8px' }}>
                          <div
                            style={{
                              fontSize: theme.fontSizes[2], // 16px
                              fontWeight:
                                selectedRepository?.name === repo.name ? 600 : 500,
                              color:
                                selectedRepository?.name === repo.name
                                  ? theme.colors.primary
                                  : theme.colors.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {repo.name}
                          </div>
                          <div
                            style={{
                              fontSize: theme.fontSizes[0], // 12px
                              color: theme.colors.textSecondary,
                              marginTop: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>{repo.github?.owner || repo.remoteUrl?.split('/')[3] || 'local'}</span>
                            {repo.github?.stars && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Star size={10} />
                                {repo.github.stars}
                              </span>
                            )}
                            {/* Git Branch */}
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                padding: '2px 6px',
                                backgroundColor: `${theme.colors.primary}10`,
                                borderRadius: '4px',
                                fontSize: theme.fontSizes[0], // 12px
                              }}
                            >
                              <GitBranch size={10} />
                              {status?.branch || repo.gitBranch || 'main'}
                            </span>
                            {/* Dirty State Indicator */}
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
                                  fontSize: theme.fontSizes[0], // 12px
                                  fontWeight: 600,
                                }}
                                title={`${status ? (status.staged + status.unstaged + status.untracked) : repo.dirtyFileCount} uncommitted changes`}
                              >
                                ● {status ? (status.staged + status.unstaged + status.untracked) : repo.dirtyFileCount}
                              </span>
                            )}
                          </div>
                          {/* Status information from bulk check */}
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
                              {status.error ? (
                                <span style={{ color: theme.colors.error }}>
                                  ⚠ {status.error}
                                </span>
                              ) : (
                                <>
                                  {/* Ahead/Behind indicators */}
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
                                  {/* File changes breakdown */}
                                  {status.staged > 0 && (
                                    <span style={{ color: theme.colors.success }}>
                                      +{status.staged} staged
                                    </span>
                                  )}
                                  {status.unstaged > 0 && (
                                    <span style={{ color: theme.colors.warning }}>
                                      ~{status.unstaged} modified
                                    </span>
                                  )}
                                  {status.untracked > 0 && (
                                    <span style={{ color: theme.colors.textSecondary }}>
                                      ?{status.untracked} untracked
                                    </span>
                                  )}
                                  {/* Fast-forward available */}
                                  {status.canFastForward && (
                                    <span
                                      style={{
                                        color: theme.colors.success,
                                      }}
                                    >
                                      ⟳ FF available
                                    </span>
                                  )}
                                  {/* No upstream */}
                                  {status.needsUpstream && (
                                    <span
                                      style={{
                                        color: theme.colors.textSecondary,
                                      }}
                                    >
                                      ⊘ No upstream
                                    </span>
                                  )}
                                </>
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
                          title={repo.isDirty ? 'Most recent file change' : 'Last commit'}
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
        isLoadingDocs={isLoadingDocs}
        isLoadingGitStatus={isLoadingGitStatus}
        onOpenDashboard={handleSelectRepository}
        onRepositoryRemoved={handleRepositoryRemoved}
      />
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* CSS for flash animation */}
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

        {/* Main Content Container */}
        <div
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Main Content Area with Resizable Panels */}
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

        {/* Git Clone Modal */}
        <GitCloneModal
          isOpen={showGitCloneModal}
          onClose={() => setShowGitCloneModal(false)}
          onRepositoryAdded={handleRepositoryAdded}
        />
      </div>
    </div>
  );
};
