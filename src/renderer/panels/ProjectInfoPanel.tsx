/**
 * ProjectInfoPanel
 *
 * Displays information about the current project including repository details
 * and git status. This panel will eventually be moved to its own package.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { getTracer } from '../telemetry';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';
import type { RepositoryPanelActions } from '../contexts/RepositoryPanelContext';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { FolderGit2, GitBranch, RefreshCw, AlertCircle, Trash2, FolderOpen, Download } from 'lucide-react';
import { CommitHeatMap, type PlayMode } from '../components/CommitHeatMap';
import { useCommitHeatMap } from '../hooks/useCommitHeatMap';
import { useRemoteCommitHeatMap } from '../hooks/useRemoteCommitHeatMap';
import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';
import { FileCityImageService } from '../main-process-api/FileCityImageService';
import type { GitHubCommit } from '../../shared/main-process-api-interfaces/GitHubAPI';

interface ProjectInfoPanelContext extends PanelContextValue {
  gitStatusWithFiles?: DataSlice<GitStatusWithFiles | null>;
}

interface ProjectInfoPanelActions extends PanelActions {
  getFileCityImage: (repoPath: string) => Promise<string | null>;
}

interface ProjectInfoPanelProps {
  context: ProjectInfoPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
}

export const ProjectInfoPanel: React.FC<ProjectInfoPanelProps> = ({
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [fileCityImageUrl, setFileCityImageUrl] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [historicalImageUrl, setHistoricalImageUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCommitInfo, setCurrentCommitInfo] = useState<{
    hash: string;
    message: string;
    author: string;
    date: string;
    additions?: number;
    deletions?: number;
  } | null>(null);
  const [typewriterText, setTypewriterText] = useState('');
  const [playMode, setPlayMode] = useState<PlayMode>('year');
  const [playbackProgress, setPlaybackProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const playbackRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Track previous repo for heat map transition
  const previousRepoRef = useRef<string | null>(null);
  const [isHeatMapTransitioning, setIsHeatMapTransitioning] = useState(false);

  // Typewriter effect for commit message
  useEffect(() => {
    if (!currentCommitInfo?.message) {
      setTypewriterText('');
      return;
    }

    const message = currentCommitInfo.message;
    let index = 0;
    setTypewriterText('');

    const interval = setInterval(() => {
      if (index < message.length) {
        setTypewriterText(message.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 45); // 45ms per character

    return () => clearInterval(interval);
  }, [currentCommitInfo?.message]);

  // Cast actions to include our extended type
  const extendedActions = actions as ProjectInfoPanelActions;

  // Get repository info from context
  const repository = context.currentScope?.repository;

  // Detect if this is a remote-only repository (from GitHub/Starred views)
  const isRemoteOnly = React.useMemo(() => {
    if (!repository) return false;
    const repo = repository as { path?: string; github?: { owner: string; name: string } };
    return (!repo.path || repo.path === '') && !!repo.github?.owner;
  }, [repository]);

  // Get GitHub info for remote repos
  const githubInfo = React.useMemo(() => {
    if (!repository) return null;
    const repo = repository as { github?: { owner: string; name: string } };
    return repo.github?.owner ? { owner: repo.github.owner, name: repo.github.name } : null;
  }, [repository]);

  // Get git status from context slice
  const gitSlice = context.gitStatusWithFiles;
  const hasGitData = gitSlice !== undefined;
  const isGitLoading = gitSlice?.loading ?? false;

  // Get commit heat map data - use appropriate hook based on repo type
  const localHeatMap = useCommitHeatMap(
    isRemoteOnly ? null : (repository?.path ?? null)
  );
  const remoteHeatMap = useRemoteCommitHeatMap(
    isRemoteOnly ? (githubInfo?.owner ?? null) : null,
    isRemoteOnly ? (githubInfo?.name ?? null) : null
  );
  const heatMapData = isRemoteOnly ? remoteHeatMap : localHeatMap;
  const heatMapCommits = heatMapData.commits;
  const heatMapLoading = heatMapData.loading;

  // State for latest commit (remote repos only)
  const [latestCommit, setLatestCommit] = useState<GitHubCommit | null>(null);

  // State for latest local commit with line counts
  const [latestLocalCommit, setLatestLocalCommit] = useState<{
    hash: string;
    message: string;
    author: string;
    date: string;
    additions: number;
    deletions: number;
  } | null>(null);

  // Fetch latest commit for remote repos
  useEffect(() => {
    if (isRemoteOnly && githubInfo) {
      GithubService.getLatestCommit(githubInfo.owner, githubInfo.name)
        .then(setLatestCommit)
        .catch((err) => console.error('[ProjectInfoPanel] Failed to fetch latest commit:', err));
    } else {
      setLatestCommit(null);
    }
  }, [isRemoteOnly, githubInfo]);

  // Fetch latest commit for local repos
  useEffect(() => {
    if (!isRemoteOnly && repository?.path) {
      (async () => {
        try {
          const commitInfo = await GitService.getLatestCommit(repository.path);
          if (!commitInfo.hash) {
            setLatestLocalCommit(null);
            return;
          }
          // Get line counts for the latest commit
          const changedFilesMap = await GitService.getChangedFilesForCommit(repository.path, commitInfo.hash);
          let additions = 0;
          let deletions = 0;
          for (const info of changedFilesMap.values()) {
            additions += info.additions;
            deletions += info.deletions;
          }
          setLatestLocalCommit({
            hash: commitInfo.hash,
            message: commitInfo.message.split('\n')[0],
            author: commitInfo.author,
            date: commitInfo.date.split('T')[0],
            additions,
            deletions,
          });
        } catch (err) {
          console.error('[ProjectInfoPanel] Failed to fetch latest local commit:', err);
          setLatestLocalCommit(null);
        }
      })();
    } else {
      setLatestLocalCommit(null);
    }
  }, [isRemoteOnly, repository?.path]);

  // Trigger heat map transition when repository changes
  useEffect(() => {
    const currentRepoId = repository?.path ||
      (githubInfo ? `${githubInfo.owner}/${githubInfo.name}` : null);

    // If repo changed, trigger transition
    if (previousRepoRef.current && currentRepoId && previousRepoRef.current !== currentRepoId) {
      setIsHeatMapTransitioning(true);
    }

    previousRepoRef.current = currentRepoId || null;
  }, [repository?.path, githubInfo]);

  // Clear transition state when new heat map data arrives
  useEffect(() => {
    if (isHeatMapTransitioning && heatMapCommits.length > 0 && !heatMapLoading) {
      setIsHeatMapTransitioning(false);
    }
  }, [isHeatMapTransitioning, heatMapCommits.length, heatMapLoading]);

  // Use theme space array or fallback values
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  const borderRadius = theme.radii?.[1] || 4;

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await context.refresh();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle open project
  const handleOpenProject = async () => {
    // Type assertion: actions may be RepositoryPanelActions at runtime
    const repoActions = actions as RepositoryPanelActions;
    if (repository && repoActions.openLocalRepository) {
      try {
        // In ProjectsView context, repository is actually the full AlexandriaEntry
        // (see ProjectsPanelContext where currentScope.repository = selectedRepository)
        // TODO: Check with @principal-ade/panel-framework-core about extending RepositoryMetadata
        // to support richer repository types like AlexandriaEntry, or making it generic
        await repoActions.openLocalRepository(repository as unknown as AlexandriaEntry);
      } catch (error) {
        console.error('Failed to open project:', error);
      }
    }
  };

  // Handle delete request
  const handleDeleteRequest = () => {
    if (repository) {
      // Check if repo has uncommitted changes or is not synced
      const gitData = gitSlice?.data;
      const stagedCount = gitData?.stagedFiles?.length || 0;
      const unstagedCount = gitData?.modifiedFiles?.length || 0;
      const untrackedCount = gitData?.untrackedFiles?.length || 0;
      const totalChanges = stagedCount + unstagedCount + untrackedCount;
      const ahead = gitData?.ahead || 0;
      const behind = gitData?.behind || 0;
      const isSynced = ahead === 0 && behind === 0;
      const isClean = totalChanges === 0 && isSynced;

      // Show warning modal if not clean
      if (!isClean) {
        setShowWarningModal(true);
        return;
      }

      // Proceed with delete request
      events.emit({
        type: 'project-info:delete-requested',
        source: 'project-info-panel',
        timestamp: Date.now(),
        payload: {
          repository,
          gitStatus: gitData,
        },
      });
    }
  };

  // Handle delete confirmation from warning modal
  const handleDeleteConfirmation = () => {
    setShowWarningModal(false);
    if (repository) {
      const gitData = gitSlice?.data;
      events.emit({
        type: 'project-info:delete-requested',
        source: 'project-info-panel',
        timestamp: Date.now(),
        payload: {
          repository,
          gitStatus: gitData,
        },
      });
    }
  };

  // Handle clone request for remote repos
  const handleClone = () => {
    if (githubInfo) {
      events.emit({
        type: 'github:clone-requested',
        source: 'project-info-panel',
        timestamp: Date.now(),
        payload: {
          repository: {
            owner: { login: githubInfo.owner },
            name: githubInfo.name,
            full_name: `${githubInfo.owner}/${githubInfo.name}`,
            html_url: `https://github.com/${githubInfo.owner}/${githubInfo.name}`,
          },
        },
      });
    }
  };

  // Handle heat map day click - show historical File City image
  const handleDayClick = async (date: string, count: number) => {
    if (count === 0) {
      // No commits on this day, clear selection
      setSelectedDate(null);
      setHistoricalImageUrl(null);
      return;
    }

    // If clicking the same date, toggle off
    if (selectedDate === date) {
      setSelectedDate(null);
      setHistoricalImageUrl(null);
      setCurrentCommitInfo(null);
      return;
    }

    setSelectedDate(date);
    setHistoricalImageUrl(null);

    if (isRemoteOnly && githubInfo) {
      // Remote repository - use GitHub API
      try {
        const commits = await GithubService.getCommitsInDateRange(
          githubInfo.owner,
          githubInfo.name,
          date,
          date
        );
        if (commits.length === 0) {
          console.warn('[ProjectInfoPanel] No commit found for date:', date);
          return;
        }

        // Use the first commit of that day
        const commit = commits[0];

        // Get file tree and changed files in parallel
        const [filePaths, changedFilesMap] = await Promise.all([
          GithubService.getFileTreeAtCommit(githubInfo.owner, githubInfo.name, commit.sha),
          GithubService.getChangedFilesForCommit(githubInfo.owner, githubInfo.name, commit.sha),
        ]);

        // Calculate aggregate line counts
        const { additions, deletions } = sumLineCounts(changedFilesMap);

        setCurrentCommitInfo({
          hash: commit.sha,
          message: commit.commit.message.split('\n')[0],
          author: commit.commit.author.name,
          date: commit.commit.author.date.split('T')[0],
          additions,
          deletions,
        });

        if (filePaths.length === 0) {
          console.warn('[ProjectInfoPanel] No files found at commit:', commit.sha);
          return;
        }

        // Generate historical File City image with highlight layers
        const changedFiles = Object.fromEntries(changedFilesMap);
        const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
          `github:${githubInfo.owner}/${githubInfo.name}`,
          commit.sha,
          filePaths,
          changedFiles
        );

        setHistoricalImageUrl(imageUrl);
      } catch (error) {
        console.error('[ProjectInfoPanel] Failed to load historical image (remote):', error);
      }
    } else if (repository?.path) {
      // Local repository - use git commands
      try {
        const commitInfo = await GitService.getCommitForDate(repository.path, date);
        if (!commitInfo) {
          console.warn('[ProjectInfoPanel] No commit found for date:', date);
          return;
        }

        // Get file tree and changed files in parallel
        const [filePaths, changedFilesMap] = await Promise.all([
          GitService.getFileTreeAtCommit(repository.path, commitInfo.hash),
          GitService.getChangedFilesForCommit(repository.path, commitInfo.hash),
        ]);

        // Calculate aggregate line counts
        const { additions, deletions } = sumLineCounts(changedFilesMap);

        setCurrentCommitInfo({
          ...commitInfo,
          additions,
          deletions,
        });

        if (filePaths.length === 0) {
          console.warn('[ProjectInfoPanel] No files found at commit:', commitInfo.hash);
          return;
        }

        // Generate historical File City image with highlight layers
        const changedFiles = Object.fromEntries(changedFilesMap);
        const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
          repository.path,
          commitInfo.hash,
          filePaths,
          changedFiles
        );

        setHistoricalImageUrl(imageUrl);
      } catch (error) {
        console.error('[ProjectInfoPanel] Failed to load historical image:', error);
      }
    }
  };

  // Helper to sum line counts from changed files map
  const sumLineCounts = (filesMap: Map<string, { status: string; additions: number; deletions: number }>) => {
    let additions = 0;
    let deletions = 0;
    for (const info of filesMap.values()) {
      additions += info.additions;
      deletions += info.deletions;
    }
    return { additions, deletions };
  };

  // Load historical image for a specific date (used by year playback)
  // Returns the commit info so playback can calculate timing
  const loadHistoricalImage = async (date: string): Promise<{ message: string } | null> => {
    setSelectedDate(date);

    if (isRemoteOnly && githubInfo) {
      // Remote repository
      try {
        const commits = await GithubService.getCommitsInDateRange(
          githubInfo.owner,
          githubInfo.name,
          date,
          date
        );
        if (commits.length === 0) return null;

        const commit = commits[0];

        // Get file tree and changed files in parallel
        const [filePaths, changedFilesMap] = await Promise.all([
          GithubService.getFileTreeAtCommit(githubInfo.owner, githubInfo.name, commit.sha),
          GithubService.getChangedFilesForCommit(githubInfo.owner, githubInfo.name, commit.sha),
        ]);

        const { additions, deletions } = sumLineCounts(changedFilesMap);
        const commitInfo = {
          hash: commit.sha,
          message: commit.commit.message.split('\n')[0],
          author: commit.commit.author.name,
          date: commit.commit.author.date.split('T')[0],
          additions,
          deletions,
        };
        setCurrentCommitInfo(commitInfo);

        if (filePaths.length === 0) return null;

        const changedFiles = Object.fromEntries(changedFilesMap);
        const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
          `github:${githubInfo.owner}/${githubInfo.name}`,
          commit.sha,
          filePaths,
          changedFiles
        );

        if (playbackRef.current.cancelled) return null;

        setHistoricalImageUrl(imageUrl);
        return { message: commitInfo.message };
      } catch (error) {
        console.error('[ProjectInfoPanel] Failed to load historical image (remote):', error);
        return null;
      }
    } else if (repository?.path) {
      // Local repository
      try {
        const commitInfo = await GitService.getCommitForDate(repository.path, date);
        if (!commitInfo) return null;

        // Get file tree and changed files in parallel
        const [filePaths, changedFilesMap] = await Promise.all([
          GitService.getFileTreeAtCommit(repository.path, commitInfo.hash),
          GitService.getChangedFilesForCommit(repository.path, commitInfo.hash),
        ]);

        const { additions, deletions } = sumLineCounts(changedFilesMap);
        setCurrentCommitInfo({
          ...commitInfo,
          additions,
          deletions,
        });

        if (filePaths.length === 0) return null;

        const changedFiles = Object.fromEntries(changedFilesMap);
        const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
          repository.path,
          commitInfo.hash,
          filePaths,
          changedFiles
        );

        if (playbackRef.current.cancelled) return null;

        setHistoricalImageUrl(imageUrl);
        return { message: commitInfo.message };
      } catch (error) {
        console.error('[ProjectInfoPanel] Failed to load historical image:', error);
        return null;
      }
    }

    return null;
  };

  // Load historical image for a specific commit (used by today/week playback)
  const loadHistoricalImageForCommit = async (
    commitInfo: { hash: string; message: string; author: string; date: string }
  ): Promise<{ message: string } | null> => {
    setSelectedDate(commitInfo.date);

    if (isRemoteOnly && githubInfo) {
      // Remote repository
      try {
        // Get file tree and changed files in parallel
        const [filePaths, changedFilesMap] = await Promise.all([
          GithubService.getFileTreeAtCommit(githubInfo.owner, githubInfo.name, commitInfo.hash),
          GithubService.getChangedFilesForCommit(githubInfo.owner, githubInfo.name, commitInfo.hash),
        ]);

        const { additions, deletions } = sumLineCounts(changedFilesMap);
        setCurrentCommitInfo({
          ...commitInfo,
          additions,
          deletions,
        });

        if (filePaths.length === 0) return null;

        const changedFiles = Object.fromEntries(changedFilesMap);
        const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
          `github:${githubInfo.owner}/${githubInfo.name}`,
          commitInfo.hash,
          filePaths,
          changedFiles
        );

        if (playbackRef.current.cancelled) return null;

        setHistoricalImageUrl(imageUrl);
        return { message: commitInfo.message };
      } catch (error) {
        console.error('[ProjectInfoPanel] Failed to load historical image for commit (remote):', error);
        return null;
      }
    } else if (repository?.path) {
      // Local repository
      try {
        // Get file tree and changed files in parallel
        const [filePaths, changedFilesMap] = await Promise.all([
          GitService.getFileTreeAtCommit(repository.path, commitInfo.hash),
          GitService.getChangedFilesForCommit(repository.path, commitInfo.hash),
        ]);

        const { additions, deletions } = sumLineCounts(changedFilesMap);
        setCurrentCommitInfo({
          ...commitInfo,
          additions,
          deletions,
        });

        if (filePaths.length === 0) return null;

        const changedFiles = Object.fromEntries(changedFilesMap);
        const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
          repository.path,
          commitInfo.hash,
          filePaths,
          changedFiles
        );

        if (playbackRef.current.cancelled) return null;

        setHistoricalImageUrl(imageUrl);
        return { message: commitInfo.message };
      } catch (error) {
        console.error('[ProjectInfoPanel] Failed to load historical image for commit:', error);
        return null;
      }
    }

    return null;
  };

  // Handle play/pause button
  const handlePlayPause = async (mode: PlayMode) => {
    if (isPlaying) {
      // Stop playback
      playbackRef.current.cancelled = true;
      setIsPlaying(false);
      return;
    }

    // Need either local path or remote GitHub info
    if (!repository?.path && !isRemoteOnly) return;
    if (isRemoteOnly && !githubInfo) return;

    setPlayMode(mode);
    setIsPlaying(true);
    playbackRef.current.cancelled = false;

    const TYPING_SPEED = 45; // ms per character (matches typewriter effect)
    const BASE_DELAY = 1000; // extra time after typing finishes

    if (mode === 'today' || mode === 'week') {
      // Get date range based on mode
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      let startDate: string;
      if (mode === 'today') {
        startDate = todayStr;
      } else {
        // Start of current week (Sunday)
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        startDate = weekStart.toISOString().split('T')[0];
      }

      // Get all commits in the range - use appropriate service
      let commits: { hash: string; message: string; author: string; date: string }[] = [];

      if (isRemoteOnly && githubInfo) {
        const remoteCommits = await GithubService.getCommitsInDateRange(
          githubInfo.owner,
          githubInfo.name,
          startDate,
          todayStr
        );
        commits = remoteCommits.map((c) => ({
          hash: c.sha,
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date.split('T')[0],
        }));
      } else if (repository?.path) {
        commits = await GitService.getCommitsInDateRange(
          repository.path,
          startDate,
          todayStr
        );
      }

      if (commits.length === 0) {
        setIsPlaying(false);
        setPlaybackProgress({ current: 0, total: 0 });
        return;
      }

      setPlaybackProgress({ current: 0, total: commits.length });

      // Play through each commit
      for (let i = 0; i < commits.length; i++) {
        if (playbackRef.current.cancelled) break;

        setPlaybackProgress({ current: i + 1, total: commits.length });
        const result = await loadHistoricalImageForCommit(commits[i]);

        if (playbackRef.current.cancelled) break;

        const messageLength = result?.message?.length || 0;
        const frameDelay = (messageLength * TYPING_SPEED) + BASE_DELAY;

        await new Promise(resolve => setTimeout(resolve, frameDelay));
      }
    } else {
      // Year mode - one commit per day (original behavior)
      const datesWithCommits = heatMapCommits
        .filter(c => c.count > 0)
        .map(c => c.date)
        .sort((a, b) => a.localeCompare(b));

      if (datesWithCommits.length === 0) {
        setIsPlaying(false);
        setPlaybackProgress({ current: 0, total: 0 });
        return;
      }

      setPlaybackProgress({ current: 0, total: datesWithCommits.length });

      for (let i = 0; i < datesWithCommits.length; i++) {
        if (playbackRef.current.cancelled) break;

        setPlaybackProgress({ current: i + 1, total: datesWithCommits.length });
        const result = await loadHistoricalImage(datesWithCommits[i]);

        if (playbackRef.current.cancelled) break;

        const messageLength = result?.message?.length || 0;
        const frameDelay = (messageLength * TYPING_SPEED) + BASE_DELAY;

        await new Promise(resolve => setTimeout(resolve, frameDelay));
      }
    }

    // Playback finished
    setIsPlaying(false);
    setPlaybackProgress({ current: 0, total: 0 });
  };

  // Get GitHub URL from repository
  const getGitHubUrl = (): string | null => {
    if (!repository) return null;

    // Try using github metadata first
    const repoWithMetadata = repository as { github?: { owner: string; name: string }; remoteUrl?: string };
    if (repoWithMetadata.github?.owner && repoWithMetadata.github?.name) {
      return `https://github.com/${repoWithMetadata.github.owner}/${repoWithMetadata.github.name}`;
    }

    // Fall back to parsing remoteUrl
    if (repoWithMetadata.remoteUrl) {
      const url = repoWithMetadata.remoteUrl;
      // Handle https://github.com/owner/repo.git
      const httpsMatch = url.match(new RegExp('https://github\\.com/([^/]+)/([^/.]+)'));
      if (httpsMatch) {
        return `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`;
      }
      // Handle git@github.com:owner/repo.git
      const sshMatch = url.match(new RegExp('git@github\\.com:([^/]+)/([^/.]+)'));
      if (sshMatch) {
        return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
      }
    }

    return null;
  };

  // Handle open in GitHub
  const handleOpenInGitHub = () => {
    const githubUrl = getGitHubUrl();
    if (githubUrl) {
      window.open(githubUrl, '_blank');
    }
  };

  const githubUrl = getGitHubUrl();

  // Subscribe to events
  useEffect(() => {
    const unsubscribers = [
      events.on('file:opened', () => {
        // Could update project info when files are opened
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [events]);

  // Store span ref so we can add events across useEffects
  const fileCitySpanRef = useRef<ReturnType<ReturnType<typeof getTracer>['startSpan']> | null>(null);
  const lastRenderedUrlRef = useRef<string | null>(null);

  // Fetch File City image when repository changes
  useEffect(() => {
    const tracer = getTracer('principal-ade-dev-workspace');

    if (repository?.path) {
      // Local repository - use existing path-based fetch
      const repoPath = repository.path;

      // Start span and store in ref
      const span = tracer.startSpan('file_city.renderer.fetch_image');
      fileCitySpanRef.current = span;

      // Event: Action called
      span.addEvent('file_city.renderer.action_called', {
        repo_path: repoPath,
      });

      console.info('[ProjectInfoPanel] Fetching File City image for:', repoPath);

      extendedActions.getFileCityImage(repoPath).then((url) => {
        // Event: URL received
        span.addEvent('file_city.renderer.url_received', {
          repo_path: repoPath,
          has_url: url !== null,
          url: url ?? 'null',
        });

        setFileCityImageUrl(url);

        // Event: State updated
        span.addEvent('file_city.renderer.state_updated', {
          repo_path: repoPath,
          url: url ?? 'null',
        });

        // Don't end span here - wait for card_rendered event
      }).catch((error) => {
        span.addEvent('file_city.renderer.error', {
          repo_path: repoPath,
          error: error instanceof Error ? error.message : String(error),
        });
        span.end();
        fileCitySpanRef.current = null;
      });
    } else if (isRemoteOnly && githubInfo && latestCommit) {
      // Remote repository - fetch file tree from GitHub and generate image
      const virtualPath = `github:${githubInfo.owner}/${githubInfo.name}`;

      console.info('[ProjectInfoPanel] Fetching File City image for remote repo:', virtualPath);

      // Get file tree at the latest commit and generate image
      GithubService.getFileTreeAtCommit(githubInfo.owner, githubInfo.name, latestCommit.sha)
        .then((filePaths) => {
          if (filePaths.length === 0) {
            console.warn('[ProjectInfoPanel] No files found for remote repo');
            setFileCityImageUrl(null);
            return;
          }

          return FileCityImageService.getImageForCommit(
            virtualPath,
            latestCommit.sha,
            filePaths
          );
        })
        .then((url) => {
          if (url) {
            console.info('[ProjectInfoPanel] Remote File City image generated:', url);
            setFileCityImageUrl(url);
          }
        })
        .catch((error) => {
          console.error('[ProjectInfoPanel] Failed to generate File City image for remote repo:', error);
          setFileCityImageUrl(null);
        });
    } else {
      setFileCityImageUrl(null);
    }
  }, [repository?.path, extendedActions, isRemoteOnly, githubInfo, latestCommit]);

  // State for dirty repo image with uncommitted changes highlighted
  const [dirtyImageUrl, setDirtyImageUrl] = useState<string | null>(null);

  // Generate File City image with uncommitted changes highlighted
  useEffect(() => {
    if (!repository?.path || isRemoteOnly) {
      setDirtyImageUrl(null);
      return;
    }

    const gitStatus = gitSlice?.data;
    const stagedFiles = gitStatus?.stagedFiles || [];
    const modifiedFiles = gitStatus?.modifiedFiles || [];
    const untrackedFiles = gitStatus?.untrackedFiles || [];
    const hasDirtyChanges = stagedFiles.length > 0 || modifiedFiles.length > 0 || untrackedFiles.length > 0;

    if (!hasDirtyChanges) {
      setDirtyImageUrl(null);
      return;
    }

    // Generate image with uncommitted changes highlighted
    (async () => {
      try {
        // Get current file tree at HEAD
        const latestCommitInfo = await GitService.getLatestCommit(repository.path);
        if (!latestCommitInfo.hash) {
          setDirtyImageUrl(null);
          return;
        }

        const filePaths = await GitService.getFileTreeAtCommit(repository.path, latestCommitInfo.hash);

        // Add untracked files to the file paths (they're not in HEAD but should be shown)
        const allFilePaths = [...new Set([...filePaths, ...untrackedFiles])];

        // Build changed files map from uncommitted changes
        const changedFiles: Record<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }> = {};

        // Staged files are typically modified or added
        for (const file of stagedFiles) {
          changedFiles[file] = { status: 'modified', additions: 0, deletions: 0 };
        }

        // Modified (unstaged) files
        for (const file of modifiedFiles) {
          changedFiles[file] = { status: 'modified', additions: 0, deletions: 0 };
        }

        // Untracked files are new/added
        for (const file of untrackedFiles) {
          changedFiles[file] = { status: 'added', additions: 0, deletions: 0 };
        }

        // Generate image with changes - use a special cache key for dirty state
        const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
          repository.path,
          `${latestCommitInfo.hash}-dirty`,
          allFilePaths,
          changedFiles
        );

        setDirtyImageUrl(imageUrl);
      } catch (error) {
        console.error('[ProjectInfoPanel] Failed to generate dirty image:', error);
        setDirtyImageUrl(null);
      }
    })();
  }, [repository?.path, isRemoteOnly, gitSlice?.data?.stagedFiles, gitSlice?.data?.modifiedFiles, gitSlice?.data?.untrackedFiles]);

  // Track when card renders with image URL - adds event to the same span
  useEffect(() => {
    if (repository?.path && fileCityImageUrl !== lastRenderedUrlRef.current) {
      const span = fileCitySpanRef.current;
      if (span) {
        span.addEvent('file_city.renderer.card_rendered', {
          repo_path: repository.path,
          has_custom_image: fileCityImageUrl !== null,
          image_url: fileCityImageUrl ?? 'null',
        });
        span.end();
        fileCitySpanRef.current = null;
      }
      lastRenderedUrlRef.current = fileCityImageUrl;
      console.info('[ProjectInfoPanel] Card rendered with image:', fileCityImageUrl);
    }
  }, [repository?.path, fileCityImageUrl]);

  // No repository selected
  if (!repository) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <FolderGit2
          size={48}
          style={{ marginBottom: spacing.md, opacity: 0.5 }}
        />
        <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
          No project selected
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[2] }}>
          Select a project from the left panel to view its information
        </p>
      </div>
    );
  }

  const gitData = gitSlice?.data;
  const stagedCount = gitData?.stagedFiles?.length || 0;
  const unstagedCount = gitData?.modifiedFiles?.length || 0;
  const untrackedCount = gitData?.untrackedFiles?.length || 0;
  const totalChanges = stagedCount + unstagedCount + untrackedCount;
  const ahead = gitData?.ahead || 0;
  const behind = gitData?.behind || 0;
  const isSynced = ahead === 0 && behind === 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          {(() => {
            const githubOwner = (repository as { github?: { owner?: string } }).github?.owner;
            return githubOwner ? (
            <>
              <img
                src={`https://github.com/${githubOwner}.png`}
                alt={`${githubOwner} avatar`}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  e.currentTarget.style.display = 'none';
                  const fallbackIcon = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallbackIcon) fallbackIcon.style.display = 'block';
                }}
              />
              <FolderGit2
                size={20}
                color={theme.colors.primary}
                style={{ display: 'none' }}
              />
            </>
            ) : (
              <FolderGit2 size={20} color={theme.colors.primary} />
            );
          })()}
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            {repository.name}
          </h3>
          {githubUrl && (
            <button
              onClick={handleOpenInGitHub}
              style={{
                padding: `${spacing.xs}px ${spacing.sm}px`,
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: borderRadius,
                background: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              }}
            >
              Open in GitHub
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
          {isRemoteOnly ? (
            // Clone button for remote repos
            <button
              onClick={handleClone}
              style={{
                padding: `${spacing.xs}px ${spacing.sm}px`,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: borderRadius,
                background: theme.colors.primary,
                color: theme.colors.background,
                cursor: 'pointer',
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <Download size={14} />
              Clone
            </button>
          ) : (
            // Open and Delete buttons for local repos
            <>
              <button
                onClick={handleOpenProject}
                style={{
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: borderRadius,
                  background: theme.colors.primary,
                  color: theme.colors.background,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <FolderOpen size={14} />
                Open
              </button>
              <button
                onClick={handleDeleteRequest}
                style={{
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: borderRadius,
                  background: 'transparent',
                  color: theme.colors.error,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.error;
                  e.currentTarget.style.color = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.error;
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        {/* Commit Heat Map */}
        {repository && (
          <div style={{ marginBottom: spacing.md }}>
            <CommitHeatMap
              commits={heatMapCommits}
              loading={heatMapLoading}
              selectedDate={selectedDate}
              onDayClick={handleDayClick}
              isPlaying={isPlaying}
              onPlayPause={heatMapCommits.length > 0 ? handlePlayPause : undefined}
              playMode={playMode}
              transitioning={isHeatMapTransitioning}
            />
          </div>
        )}

        {/* File City Image and Git Status - Side by Side */}
        <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
          {/* File City Image - Left */}
          <div
            style={{
              flex: 1,
              aspectRatio: '1 / 1',
              order: 0, // Left side
              cursor: (fileCityImageUrl || historicalImageUrl || dirtyImageUrl) && !selectedDate ? 'pointer' : 'default',
              borderRadius: borderRadius,
              overflow: 'hidden',
              border: `1px solid ${selectedDate ? theme.colors.primary : dirtyImageUrl ? theme.colors.warning : theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
            }}
            onClick={(fileCityImageUrl || historicalImageUrl || dirtyImageUrl) && !selectedDate ? handleOpenProject : undefined}
          >
            {(historicalImageUrl || dirtyImageUrl || fileCityImageUrl) && (
              <img
                src={(historicalImageUrl || dirtyImageUrl || fileCityImageUrl)!}
                alt={`${repository.name} visualization`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            )}
          </div>

          {/* Historical Commit Info - shown during playback */}
          {currentCommitInfo && (
            <section
              style={{
                flex: 1,
                padding: spacing.md,
                background: theme.colors.backgroundSecondary,
                borderRadius: borderRadius,
                border: `1px solid ${theme.colors.primary}`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  marginBottom: spacing.md,
                }}
              >
                <FolderGit2 size={16} color={theme.colors.primary} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[2],
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Historical Snapshot
                </h4>
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    marginBottom: spacing.sm,
                  }}
                >
                  <span>{currentCommitInfo.date}</span>
                  {(currentCommitInfo.additions !== undefined || currentCommitInfo.deletions !== undefined) && (
                    <span style={{ display: 'flex', gap: spacing.xs, fontFamily: 'monospace' }}>
                      <span style={{ color: '#22c55e' }}>+{currentCommitInfo.additions ?? 0}</span>
                      <span style={{ color: '#ef4444' }}>-{currentCommitInfo.deletions ?? 0}</span>
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[4],
                    color: theme.colors.text,
                    fontWeight: 600,
                    marginBottom: spacing.sm,
                    lineHeight: 1.3,
                    minHeight: '1.3em',
                  }}
                >
                  {typewriterText}
                  {typewriterText.length < currentCommitInfo.message.length && (
                    <span
                      style={{
                        opacity: 0.7,
                        animation: 'blink 0.7s infinite',
                      }}
                    >
                      |
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[2],
                    color: theme.colors.textSecondary,
                  }}
                >
                  {currentCommitInfo.author}
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    fontFamily: 'monospace',
                    marginTop: spacing.sm,
                  }}
                >
                  {currentCommitInfo.hash.slice(0, 7)}
                </div>

                {/* Progress bar */}
                {playbackProgress.total > 0 && (
                  <div style={{ marginTop: spacing.md }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 2,
                        marginBottom: spacing.xs,
                      }}
                    >
                      {Array.from({ length: playbackProgress.total }).map((_, i) => (
                        <div
                          key={i} // eslint-disable-line react/no-array-index-key -- Static progress segments
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: i < playbackProgress.current
                              ? theme.colors.primary
                              : theme.colors.backgroundTertiary,
                            transition: 'background-color 0.2s ease',
                          }}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                        textAlign: 'center',
                      }}
                    >
                      {playbackProgress.current} of {playbackProgress.total}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Latest Commit Info - for remote repos (hidden during playback) */}
          {isRemoteOnly && latestCommit && !currentCommitInfo && (
            <section
              style={{
                flex: 1,
                padding: spacing.md,
                background: theme.colors.backgroundSecondary,
                borderRadius: borderRadius,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  marginBottom: spacing.md,
                }}
              >
                <FolderGit2 size={16} color={theme.colors.primary} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[2],
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Latest Commit
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <div
                  style={{
                    fontSize: theme.fontSizes[3],
                    color: theme.colors.text,
                    fontWeight: 500,
                    lineHeight: 1.4,
                  }}
                >
                  {latestCommit.commit.message.split('\n')[0]}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  {latestCommit.author?.avatar_url && (
                    <img
                      src={latestCommit.author.avatar_url}
                      alt={latestCommit.commit.author.name}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: theme.fontSizes[2],
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {latestCommit.commit.author.name}
                  </span>
                  <span style={{ color: theme.colors.textSecondary }}>•</span>
                  <span
                    style={{
                      fontSize: theme.fontSizes[2],
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {new Date(latestCommit.commit.author.date).toLocaleDateString()}
                  </span>
                </div>
                <code
                  style={{
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts.monospace,
                    color: theme.colors.primary,
                    backgroundColor: theme.colors.background,
                    padding: '2px 6px',
                    borderRadius: '2px',
                    alignSelf: 'flex-start',
                  }}
                >
                  {latestCommit.sha.slice(0, 7)}
                </code>
              </div>
            </section>
          )}

          {/* Git Status - Right (for local repos, hidden during playback) */}
          {!isRemoteOnly && hasGitData && !currentCommitInfo && (
            <section
              style={{
                flex: 1,
                padding: spacing.md,
                background: theme.colors.backgroundSecondary,
                borderRadius: borderRadius,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.sm,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <GitBranch size={16} color={theme.colors.primary} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[2],
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Git Status
                </h4>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: borderRadius,
                  background: theme.colors.background,
                  color: theme.colors.text,
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  opacity: isRefreshing ? 0.6 : 1,
                  fontSize: theme.fontSizes[1],
                }}
              >
                <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </button>
            </div>

            {isGitLoading ? (
              <p
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.textSecondary,
                }}
              >
                Loading git status...
              </p>
            ) : gitData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {/* Branch */}
                {gitData.branch && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                    <div>
                      <span
                        style={{
                          fontSize: theme.fontSizes[2],
                          fontWeight: 500,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Branch:
                      </span>{' '}
                      <code
                        style={{
                          fontSize: theme.fontSizes[1],
                          fontFamily: theme.fonts.monospace,
                          color: theme.colors.primary,
                          backgroundColor: theme.colors.background,
                          padding: '2px 6px',
                          borderRadius: '2px',
                        }}
                      >
                        {gitData.branch}
                      </code>
                    </div>
                    {/* Sync status */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        fontSize: theme.fontSizes[1],
                      }}
                    >
                      {isSynced ? (
                        <>
                          <div
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: theme.colors.success,
                            }}
                          />
                          <span style={{ color: theme.colors.textSecondary }}>
                            Up to date with remote
                          </span>
                        </>
                      ) : (
                        <>
                          {ahead > 0 && (
                            <span
                              style={{
                                color: theme.colors.info,
                                fontWeight: 500,
                              }}
                            >
                              ↑ {ahead} {ahead === 1 ? 'commit' : 'commits'} ahead
                            </span>
                          )}
                          {ahead > 0 && behind > 0 && (
                            <span style={{ color: theme.colors.textSecondary }}>•</span>
                          )}
                          {behind > 0 && (
                            <span
                              style={{
                                color: theme.colors.warning,
                                fontWeight: 500,
                              }}
                            >
                              ↓ {behind} {behind === 1 ? 'commit' : 'commits'} behind
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* File list - show changed files */}
                {totalChanges > 0 ? (
                  <div
                    style={{
                      marginTop: spacing.xs,
                      maxHeight: 180,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {/* Staged files */}
                    {gitData?.stagedFiles?.map((file) => (
                      <div
                        key={`staged-${file}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          fontSize: theme.fontSizes[1],
                          fontFamily: theme.fonts.monospace,
                          padding: '2px 4px',
                          borderRadius: 2,
                          backgroundColor: theme.colors.background,
                        }}
                      >
                        <span style={{ color: theme.colors.success, fontWeight: 600, width: 14 }}>S</span>
                        <span style={{ color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.split('/').pop()}
                        </span>
                      </div>
                    ))}
                    {/* Modified files */}
                    {gitData?.modifiedFiles?.map((file) => (
                      <div
                        key={`modified-${file}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          fontSize: theme.fontSizes[1],
                          fontFamily: theme.fonts.monospace,
                          padding: '2px 4px',
                          borderRadius: 2,
                          backgroundColor: theme.colors.background,
                        }}
                      >
                        <span style={{ color: theme.colors.warning, fontWeight: 600, width: 14 }}>M</span>
                        <span style={{ color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.split('/').pop()}
                        </span>
                      </div>
                    ))}
                    {/* Untracked files */}
                    {gitData?.untrackedFiles?.map((file) => (
                      <div
                        key={`untracked-${file}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          fontSize: theme.fontSizes[1],
                          fontFamily: theme.fonts.monospace,
                          padding: '2px 4px',
                          borderRadius: 2,
                          backgroundColor: theme.colors.background,
                        }}
                      >
                        <span style={{ color: theme.colors.info, fontWeight: 600, width: 14 }}>?</span>
                        <span style={{ color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.split('/').pop()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                      marginTop: spacing.xs,
                      padding: spacing.xs,
                      backgroundColor: theme.colors.background,
                      borderRadius: borderRadius,
                    }}
                  >
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: theme.colors.success,
                      }}
                    />
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                      }}
                    >
                      Working tree clean
                    </span>
                  </div>
                )}

                {/* Latest Commit - only show when working tree is clean */}
                {latestLocalCommit && totalChanges === 0 && (
                  <div
                    style={{
                      marginTop: spacing.md,
                      paddingTop: spacing.md,
                      borderTop: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        marginBottom: spacing.xs,
                      }}
                    >
                      <FolderGit2 size={14} color={theme.colors.textSecondary} />
                      <span
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          fontWeight: 500,
                        }}
                      >
                        Latest Commit
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: theme.fontSizes[2],
                        color: theme.colors.text,
                        marginBottom: spacing.xs,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {latestLocalCommit.message}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.sm,
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                      }}
                    >
                      <span>{latestLocalCommit.date}</span>
                      <span style={{ display: 'flex', gap: spacing.xs, fontFamily: 'monospace' }}>
                        <span style={{ color: '#22c55e' }}>+{latestLocalCommit.additions}</span>
                        <span style={{ color: '#ef4444' }}>-{latestLocalCommit.deletions}</span>
                      </span>
                      <code
                        style={{
                          fontSize: theme.fontSizes[0],
                          fontFamily: theme.fonts.monospace,
                          color: theme.colors.textSecondary,
                          backgroundColor: theme.colors.background,
                          padding: '1px 4px',
                          borderRadius: '2px',
                        }}
                      >
                        {latestLocalCommit.hash.slice(0, 7)}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.textSecondary,
                }}
              >
                No git data available
              </p>
            )}
          </section>
          )}
        </div>
      </div>

      {/* Warning Modal */}
      {showWarningModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowWarningModal(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: borderRadius * 2,
              padding: spacing.lg,
              maxWidth: '500px',
              width: '90%',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <AlertCircle size={24} color={theme.colors.warning} />
              <h3
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[4],
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Warning: Uncommitted Changes
              </h3>
            </div>

            {/* Content */}
            <div style={{ marginBottom: spacing.lg }}>
              <p
                style={{
                  margin: 0,
                  marginBottom: spacing.md,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.text,
                  lineHeight: 1.5,
                }}
              >
                This repository has uncommitted changes or is not synced with the remote.
              </p>

              {/* Status details */}
              <div
                style={{
                  padding: spacing.md,
                  backgroundColor: theme.colors.background,
                  borderRadius: borderRadius,
                  border: `1px solid ${theme.colors.border}`,
                  marginBottom: spacing.md,
                }}
              >
                {totalChanges > 0 && (
                  <div style={{ marginBottom: spacing.xs }}>
                    <span
                      style={{
                        fontSize: theme.fontSizes[2],
                        color: theme.colors.warning,
                        fontWeight: 500,
                      }}
                    >
                      • {totalChanges} uncommitted {totalChanges === 1 ? 'file' : 'files'}
                    </span>
                    <div style={{ marginLeft: spacing.md, marginTop: spacing.xs }}>
                      {stagedCount > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {stagedCount} staged
                        </div>
                      )}
                      {unstagedCount > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {unstagedCount} modified
                        </div>
                      )}
                      {untrackedCount > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {untrackedCount} untracked
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!isSynced && (
                  <div>
                    <span
                      style={{
                        fontSize: theme.fontSizes[2],
                        color: theme.colors.warning,
                        fontWeight: 500,
                      }}
                    >
                      • Not synced with remote
                    </span>
                    <div style={{ marginLeft: spacing.md, marginTop: spacing.xs }}>
                      {ahead > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {ahead} {ahead === 1 ? 'commit' : 'commits'} ahead
                        </div>
                      )}
                      {behind > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {behind} {behind === 1 ? 'commit' : 'commits'} behind
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.error,
                  fontWeight: 500,
                }}
              >
                Deleting this repository will permanently remove all uncommitted changes.
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowWarningModal(false)}
                style={{
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: borderRadius,
                  background: theme.colors.background,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[2],
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.background;
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmation}
                style={{
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: borderRadius,
                  background: theme.colors.error,
                  color: theme.colors.background,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[2],
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
