/**
 * ActivityFeedPanel
 *
 * Displays an aggregated activity feed showing repository cards
 * sorted by recent activity. Each card combines the File City image
 * with commit summaries for a repo-centric view.
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';
import { FolderGit2, ChevronDown, ChevronRight, Check, User, Play, Square, ExternalLink, Search, X, Folder, Github, Star, Sparkles, CheckSquare, SquareIcon, type LucideIcon } from 'lucide-react';
import { useActivityFeed, type ActivityCommit } from '../hooks/useActivityFeed';
import { useWatchedActivityFeed, type WatchedRepoGroup } from '../hooks/useWatchedActivityFeed';
import { FileCityImageService } from '../main-process-api/FileCityImageService';
import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';
import { AISummaryPanel } from '../components/AISummaryPanel';
import type { FeedMode } from '../principal-window/views/FeedView/FeedView';

// Quarter helpers (matching heatmap)
type DayQuarter = 'Night' | 'Morning' | 'Afternoon' | 'Evening';

const getQuarter = (date: Date): DayQuarter => {
  const hour = date.getHours();
  if (hour >= 0 && hour < 6) return 'Night';
  if (hour >= 6 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  return 'Evening';
};

const getGreeting = (quarter: DayQuarter): string => {
  switch (quarter) {
    case 'Night': return 'Welcome Night Owls';
    case 'Morning': return 'Good Morning';
    case 'Afternoon': return 'Good Afternoon';
    case 'Evening': return 'Good Evening';
  }
};

const getQuarterLabel = (quarter: DayQuarter): string => {
  switch (quarter) {
    case 'Night': return 'Night Shift';
    default: return quarter;
  }
};

interface QuarterGroup {
  quarter: DayQuarter;
  date: Date;
  dateKey: string;
  isFirst: boolean;
  summaries: RepoActivitySummary[];
  commitCount: number;
}

// Group summaries by quarter, splitting repos that span multiple quarters
function groupSummariesByQuarter(summaries: RepoActivitySummary[]): QuarterGroup[] {
  const quarterMap = new Map<string, {
    quarter: DayQuarter;
    date: Date;
    summaryMap: Map<string, RepoActivitySummary>;
    commitCount: number;
  }>();

  // Process each summary
  for (const summary of summaries) {
    for (const commit of summary.commits) {
      const commitDate = new Date(commit.date);
      const quarter = getQuarter(commitDate);
      const dateKey = `${commitDate.getFullYear()}-${commitDate.getMonth()}-${commitDate.getDate()}-${quarter}`;

      let group = quarterMap.get(dateKey);
      if (!group) {
        // Create a representative date for this quarter
        const quarterDate = new Date(commitDate);
        quarterDate.setMinutes(0, 0, 0);
        group = {
          quarter,
          date: quarterDate,
          summaryMap: new Map(),
          commitCount: 0,
        };
        quarterMap.set(dateKey, group);
      }
      group.commitCount++;

      // Add or update the summary for this repo in this quarter
      let quarterSummary = group.summaryMap.get(summary.repoPath);
      if (!quarterSummary) {
        quarterSummary = {
          ...summary,
          commits: [],
          commitCount: 0,
          latestCommitAt: commitDate,
        };
        group.summaryMap.set(summary.repoPath, quarterSummary);
      }
      quarterSummary.commits.push(commit);
      quarterSummary.commitCount++;
      if (commitDate > quarterSummary.latestCommitAt) {
        quarterSummary.latestCommitAt = commitDate;
      }
    }
  }

  // Convert to array and sort by time (most recent first)
  const groups: QuarterGroup[] = [];
  for (const [dateKey, group] of quarterMap) {
    const summaryList = Array.from(group.summaryMap.values())
      .sort((a, b) => new Date(b.latestCommitAt).getTime() - new Date(a.latestCommitAt).getTime());

    groups.push({
      quarter: group.quarter,
      date: group.date,
      dateKey,
      isFirst: false,
      summaries: summaryList,
      commitCount: group.commitCount,
    });
  }

  // Sort by date (most recent first)
  groups.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Mark the first one
  const firstGroup = groups[0];
  if (firstGroup) {
    firstGroup.isFirst = true;
  }

  return groups;
}

function formatQuarterDate(date: Date): string | null {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return null;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

/**
 * Get avatar URL from an email address
 * Uses GitHub avatars service for GitHub noreply emails
 */
function getAvatarUrl(email: string, size = 32): string | null {
  if (!email) return null;

  const lowerEmail = email.trim().toLowerCase();

  // Check for GitHub noreply email format: username@users.noreply.github.com
  // or the newer format: 12345678+username@users.noreply.github.com
  const githubMatch = lowerEmail.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
  if (githubMatch) {
    return `https://avatars.githubusercontent.com/${githubMatch[1]}?size=${size}`;
  }

  // No reliable avatar URL for non-GitHub emails
  return null;
}

interface ActivityFeedPanelContext extends PanelContextValue {
  alexandriaRepositories?: DataSlice<{
    repositories: AlexandriaEntry[];
    loading: boolean;
  }>;
}

interface ActivityFeedPanelActions extends PanelActions {
  getFileCityImage: (repoPath: string) => Promise<string | null>;
  selectRepository?: (entry: AlexandriaEntry) => Promise<void>;
  openLocalRepository?: (entry: AlexandriaEntry) => Promise<void>;
}

/**
 * Search result from unified search
 */
export type SearchResultSource = 'local' | 'github' | 'starred';

export interface SearchResult {
  id: string;
  name: string;
  fullName: string;
  description?: string | null;
  source: SearchResultSource;
  entry?: AlexandriaEntry;
  repository?: GitHubRepository;
}

interface ActivityFeedPanelProps {
  context: ActivityFeedPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
  // Search props (optional for backward compatibility)
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchResults?: SearchResult[];
  onSelectSearchResult?: (result: SearchResult) => void;
  searchLoading?: boolean;
  // Feed mode prop
  feedMode?: FeedMode;
}

/**
 * Aggregated repository activity summary
 */
interface RepoActivitySummary {
  repoPath: string;
  repoName: string;
  commits: ActivityCommit[];
  latestCommitAt: Date;
  commitCount: number;
  githubOwner?: string;
  githubRepoName?: string;
}


export const ActivityFeedPanel: React.FC<ActivityFeedPanelProps> = ({
  context,
  actions,
  events: _events,
  searchQuery = '',
  onSearchChange,
  searchResults = [],
  onSelectSearchResult,
  searchLoading = false,
  feedMode = 'my-activity', // Default to my-activity
}) => {
  const { theme } = useTheme();
  const extendedActions = actions as ActivityFeedPanelActions;
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Sync local search with external prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Debounce search input
  useEffect(() => {
    if (!onSearchChange) return;
    const timer = setTimeout(() => {
      onSearchChange(localSearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearchQuery, onSearchChange]);

  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery('');
    onSearchChange?.('');
  }, [onSearchChange]);

  const isSearching = localSearchQuery.trim().length > 0;

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  // Get all local repositories for activity feed
  const allRepositories = useMemo(
    () => context.alexandriaRepositories?.data?.repositories ?? [],
    [context.alexandriaRepositories?.data?.repositories]
  );
  const activityFeed = useActivityFeed(allRepositories, 20, 10, 100); // Get more commits for aggregation

  // Get watched activity feed from web-ade
  const watchedActivityFeed = useWatchedActivityFeed(
    feedMode === 'watched-activity',
    100 // maxCards
  );

  // State for repo images
  const [repoImages, setRepoImages] = useState<Map<string, string>>(new Map());
  // State for expanded cards
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  // State for commit author avatars (sha -> avatarUrl)
  const [commitAvatars, setCommitAvatars] = useState<Map<string, string>>(new Map());

  // State for AI selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  // Toggle card selection
  const toggleCardSelection = useCallback((cardKey: string) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) {
        next.delete(cardKey);
      } else {
        next.add(cardKey);
      }
      return next;
    });
  }, []);

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedCards(new Set());
    setSelectionMode(false);
  }, []);

  // Create a map of repo paths to github info (owner and repo name)
  const repoGithubMap = useMemo(() => {
    const map = new Map<string, { owner: string; name: string }>();
    for (const repo of allRepositories) {
      if (repo.path && repo.github?.owner && repo.github?.name) {
        map.set(repo.path, { owner: repo.github.owner, name: repo.github.name });
      }
    }
    return map;
  }, [allRepositories]);

  // Legacy map for backwards compatibility
  const repoOwnerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [path, info] of repoGithubMap) {
      map.set(path, info.owner);
    }
    return map;
  }, [repoGithubMap]);

  // Aggregate commits by repository
  const repoSummaries = useMemo<RepoActivitySummary[]>(() => {
    const repoMap = new Map<string, RepoActivitySummary>();

    for (const commit of activityFeed.commits) {
      let summary = repoMap.get(commit.repoPath);
      if (!summary) {
        summary = {
          repoPath: commit.repoPath,
          repoName: commit.repoName,
          commits: [],
          latestCommitAt: new Date(commit.date),
          commitCount: 0,
          githubOwner: repoOwnerMap.get(commit.repoPath),
        };
        repoMap.set(commit.repoPath, summary);
      }
      summary.commits.push(commit);
      summary.commitCount++;

      const commitDate = new Date(commit.date);
      if (commitDate > summary.latestCommitAt) {
        summary.latestCommitAt = commitDate;
      }
    }

    // Sort by latest commit (most recent first)
    return Array.from(repoMap.values()).sort(
      (a, b) => b.latestCommitAt.getTime() - a.latestCommitAt.getTime()
    );
  }, [activityFeed.commits, repoOwnerMap]);

  // Transform watched activity data to match RepoActivitySummary format
  const watchedRepoSummaries = useMemo<RepoActivitySummary[]>(() => {
    return watchedActivityFeed.repoGroups.map((group: WatchedRepoGroup) => ({
      repoPath: group.repoPath, // Empty for watched repos
      repoName: group.repoName,
      commits: group.commits.map((commit) => ({
        repoName: commit.repoName,
        repoPath: commit.repoPath,
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        authorEmail: commit.authorEmail,
        date: commit.date,
      })),
      latestCommitAt: group.latestCommitAt,
      commitCount: group.commitCount,
      githubOwner: group.githubOwner,
      githubRepoName: group.githubRepoName,
    }));
  }, [watchedActivityFeed.repoGroups]);

  // Determine which summaries to display based on feed mode
  const displayedRepoSummaries = useMemo(() => {
    return feedMode === 'watched-activity' ? watchedRepoSummaries : repoSummaries;
  }, [feedMode, watchedRepoSummaries, repoSummaries]);

  // Group summaries by quarter
  const quarterGroups = useMemo(() => {
    return groupSummariesByQuarter(displayedRepoSummaries);
  }, [displayedRepoSummaries]);

  // Select all visible cards
  const selectAllCards = useCallback(() => {
    const allCardKeys = new Set<string>();
    for (const group of quarterGroups) {
      for (const summary of group.summaries) {
        allCardKeys.add(`${group.dateKey}-${summary.repoPath}`);
      }
    }
    setSelectedCards(allCardKeys);
  }, [quarterGroups]);

  // Get selected commits for AI summarization
  const selectedCommits = useMemo(() => {
    const commits: Array<{
      repoName: string;
      sha: string;
      message: string;
      author: string;
    }> = [];

    for (const cardKey of selectedCards) {
      // Find the summary matching this card key
      for (const group of quarterGroups) {
        for (const summary of group.summaries) {
          const expectedKey = `${group.dateKey}-${summary.repoPath}`;
          if (cardKey === expectedKey) {
            for (const commit of summary.commits) {
              commits.push({
                repoName: summary.repoName,
                sha: commit.hash,
                message: commit.message,
                author: commit.author,
              });
            }
          }
        }
      }
    }

    return commits;
  }, [selectedCards, quarterGroups]);

  // Fetch File City images for repos with aggregate change highlights
  useEffect(() => {
    if (repoSummaries.length === 0) return;

    const fetchImages = async () => {
      const imageMap = new Map<string, string>();

      await Promise.all(
        repoSummaries.map(async (summary) => {
          try {
            // Get file tree at latest commit
            const latestCommit = summary.commits[0];
            if (!latestCommit) {
              // Fallback to plain image if no commits
              const imageUrl = await extendedActions.getFileCityImage(summary.repoPath);
              if (imageUrl) {
                imageMap.set(summary.repoPath, imageUrl);
              }
              return;
            }

            const filePaths = await GitService.getFileTreeAtCommit(summary.repoPath, latestCommit.hash);

            // Aggregate changed files from all commits
            const aggregateChanges: Record<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }> = {};

            await Promise.all(
              summary.commits.map(async (commit) => {
                try {
                  const changedFilesMap = await GitService.getChangedFilesForCommit(summary.repoPath, commit.hash);
                  changedFilesMap.forEach((value, key) => {
                    // If file already tracked, combine the changes
                    if (aggregateChanges[key]) {
                      aggregateChanges[key].additions += value.additions;
                      aggregateChanges[key].deletions += value.deletions;
                      // Keep the most "significant" status (added > modified > renamed > deleted)
                      if (value.status === 'added') {
                        aggregateChanges[key].status = 'added';
                      }
                    } else {
                      aggregateChanges[key] = { ...value };
                    }
                  });
                } catch (err) {
                  console.warn(`[ActivityFeedPanel] Failed to get changes for commit ${commit.hash}:`, err);
                }
              })
            );

            // Generate image with aggregate highlights
            const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
              summary.repoPath,
              latestCommit.hash,
              filePaths,
              aggregateChanges
            );

            if (imageUrl) {
              imageMap.set(summary.repoPath, imageUrl);
            }
          } catch (err) {
            console.warn(`[ActivityFeedPanel] Failed to get image for ${summary.repoPath}:`, err);
          }
        })
      );

      setRepoImages(imageMap);
    };

    fetchImages();
  }, [repoSummaries, extendedActions]);

  // Fetch commit author avatars from GitHub API
  useEffect(() => {
    if (repoSummaries.length === 0) return;

    const fetchAvatars = async () => {
      const avatarMap = new Map<string, string>();

      // Group commits by repo for batch fetching
      await Promise.all(
        repoSummaries.map(async (summary) => {
          const githubInfo = repoGithubMap.get(summary.repoPath);

          if (!githubInfo) {
            return; // Skip non-GitHub repos
          }

          try {
            // Fetch commits from GitHub API (includes avatar URLs)
            const githubCommits = await GithubService.getRepositoryCommits(
              githubInfo.owner,
              githubInfo.name,
              { perPage: summary.commits.length }
            );

            // Map GitHub commits by sha for quick lookup
            for (const ghCommit of githubCommits) {
              if (ghCommit.author?.avatar_url) {
                avatarMap.set(ghCommit.sha, ghCommit.author.avatar_url);
              }
            }
          } catch (err) {
            console.warn(`[ActivityFeedPanel] Failed to fetch avatars for ${summary.repoName}:`, err);
          }
        })
      );

      setCommitAvatars(avatarMap);
    };

    fetchAvatars();
  }, [repoSummaries, repoGithubMap]);

  // Format relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Toggle card expansion
  const toggleExpanded = (repoPath: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoPath)) {
        next.delete(repoPath);
      } else {
        next.add(repoPath);
      }
      return next;
    });
  };

  // Handle double-click to open repo
  const handleRepoOpen = (repoPath: string) => {
    const entry = allRepositories.find((r) => r.path === repoPath);
    if (entry && extendedActions.openLocalRepository) {
      extendedActions.openLocalRepository(entry);
    }
  };

  // Check if we're within last 24 hours scope
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentRepos = displayedRepoSummaries.filter(
    (s) => s.latestCommitAt >= twentyFourHoursAgo
  );
  const totalRecentCommits = recentRepos.reduce((sum, r) => sum + r.commitCount, 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header - spans full width */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            {feedMode === 'watched-activity' ? 'Watched Activity' : 'Activity Feed'}
          </h3>
        </div>

        {/* Status indicator and time filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          {/* Selection mode toggle */}
          <button
            onClick={() => {
              if (selectionMode) {
                clearSelections();
              } else {
                setSelectionMode(true);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              fontSize: theme.fontSizes[1],
              color: selectionMode ? theme.colors.primary : theme.colors.textSecondary,
              backgroundColor: selectionMode ? `${theme.colors.primary}15` : 'transparent',
              border: `1px solid ${selectionMode ? theme.colors.primary : theme.colors.border}`,
              borderRadius: theme.radii?.[1] || 4,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={14} />
            <span>{selectionMode ? `${selectedCards.size} selected` : 'AI Summary'}</span>
          </button>

          {/* Select All button - only show in selection mode */}
          {selectionMode && quarterGroups.length > 0 && (
            <button
              onClick={() => {
                // Calculate total cards count
                const totalCards = quarterGroups.reduce((sum, g) => sum + g.summaries.length, 0);
                if (selectedCards.size === totalCards) {
                  // All selected, clear selection
                  setSelectedCards(new Set());
                } else {
                  // Select all
                  selectAllCards();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii?.[1] || 4,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {(() => {
                const totalCards = quarterGroups.reduce((sum, g) => sum + g.summaries.length, 0);
                const allSelected = selectedCards.size === totalCards && totalCards > 0;
                return (
                  <>
                    {allSelected ? <SquareIcon size={14} /> : <CheckSquare size={14} />}
                    <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
                  </>
                );
              })()}
            </button>
          )}

          {/* Status indicator */}
          {!activityFeed.loading && !watchedActivityFeed.loading && displayedRepoSummaries.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                fontSize: theme.fontSizes[1],
                color: recentRepos.length === 0 ? theme.colors.success : theme.colors.textSecondary,
              }}
            >
              {recentRepos.length === 0 ? (
                <>
                  <Check size={14} />
                  <span>All caught up</span>
                </>
              ) : (
                <span>
                  {recentRepos.length} repo{recentRepos.length !== 1 ? 's' : ''} active today
                  {totalRecentCommits > 0 && ` · ${totalRecentCommits} commit${totalRecentCommits !== 1 ? 's' : ''}`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Left column - Repository List */}
        {onSearchChange && (
          <div
            style={{
              flex: 1,
              minWidth: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end', // Right-align content within this column
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 400,
                height: '100%',
                padding: spacing.md,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.md,
              }}
            >
              {/* Recent Projects Title */}
              <h3
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Recent Projects
              </h3>

              {/* Repository List */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing.sm,
                }}
              >
                {displayedRepoSummaries.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: theme.colors.textSecondary,
                      fontSize: theme.fontSizes[1],
                      textAlign: 'center',
                    }}
                  >
                    <FolderGit2 size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
                    <span>No repositories</span>
                  </div>
                ) : (
                  displayedRepoSummaries.map((summary) => (
                    <button
                      key={summary.repoPath}
                      onClick={() => handleRepoOpen(summary.repoPath)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.sm,
                        width: '100%',
                        padding: spacing.sm,
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radii?.[1] || 4,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                        e.currentTarget.style.borderColor = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          backgroundColor: theme.colors.background,
                          border: `1px solid ${theme.colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {summary.githubOwner ? (
                          <img
                            src={`https://github.com/${summary.githubOwner}.png?size=80`}
                            alt={summary.githubOwner}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        {!summary.githubOwner && (
                          <User size={28} color={theme.colors.textSecondary} />
                        )}
                      </div>

                      {/* Text content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: theme.fontSizes[1],
                            fontWeight: 600,
                            color: theme.colors.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: 2,
                          }}
                        >
                          {summary.repoName}
                        </div>
                        {summary.githubOwner && (
                          <div
                            style={{
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.textSecondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginBottom: 4,
                            }}
                          >
                            {summary.githubOwner}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textTertiary,
                          }}
                        >
                          {summary.commitCount} commit{summary.commitCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Feed column - fixed width, centered */}
        <div
          style={{
            width: 800,
            flexShrink: 0,
            overflow: 'auto',
            padding: spacing.md,
          }}
        >
          <div>
          {quarterGroups.length === 0 && !activityFeed.loading && !watchedActivityFeed.loading ? (
          // Empty state
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              textAlign: 'center',
            }}
          >
            <FolderGit2 size={48} style={{ marginBottom: spacing.md, opacity: 0.5 }} />
            {feedMode === 'watched-activity' ? (
              !watchedActivityFeed.authenticated ? (
                <>
                  <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>Sign in required</p>
                  <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1] }}>
                    Sign in to view watched activity from web-ade
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>No watched activity</p>
                  <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1] }}>
                    Visit app.principal-ade.com to watch repositories and users
                  </p>
                </>
              )
            ) : (
              <>
                <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>No recent activity</p>
                <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1] }}>
                  Commits from your local repositories will appear here
                </p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {quarterGroups.map((group, groupIndex) => {
              const dateLabel = formatQuarterDate(group.date);
              const label = group.isFirst ? getGreeting(group.quarter) : getQuarterLabel(group.quarter);

              return (
                <div key={group.dateKey}>
                  {/* Quarter header */}
                  <div
                    style={{
                      paddingTop: groupIndex > 0 ? spacing.sm : 0,
                      paddingBottom: spacing.sm,
                      borderTop: groupIndex > 0 ? `1px solid ${theme.colors.border}` : undefined,
                      marginTop: groupIndex > 0 ? spacing.sm : 0,
                    }}
                  >
                    {dateLabel && (
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textTertiary,
                          marginBottom: spacing.xs,
                        }}
                      >
                        {dateLabel}
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <div
                        style={{
                          fontSize: theme.fontSizes[2],
                          fontWeight: 600,
                          color: theme.colors.text,
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textTertiary,
                        }}
                      >
                        {group.commitCount} commit{group.commitCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Cards for this quarter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    {group.summaries.map((summary) => (
                      <RepoActivityCard
                        key={`${group.dateKey}-${summary.repoPath}`}
                        summary={summary}
                        imageUrl={repoImages.get(summary.repoPath)}
                        isExpanded={expandedRepos.has(`${group.dateKey}-${summary.repoPath}`)}
                        onToggleExpand={() => toggleExpanded(`${group.dateKey}-${summary.repoPath}`)}
                        onOpen={() => handleRepoOpen(summary.repoPath)}
                        formatRelativeTime={formatRelativeTime}
                        theme={theme}
                        spacing={spacing}
                        commitAvatars={commitAvatars}
                        selectionMode={selectionMode}
                        isSelected={selectedCards.has(`${group.dateKey}-${summary.repoPath}`)}
                        onSelectionChange={() => toggleCardSelection(`${group.dateKey}-${summary.repoPath}`)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

        {/* Right column - Search and AI Panel */}
        {onSearchChange && (
          <div
            style={{
              flex: 1,
              minWidth: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              overflow: 'hidden',
            }}
          >
            {/* Search section (top) */}
            <div
              style={{
                width: '100%',
                maxWidth: 400,
                flex: selectionMode || selectedCards.size > 0 ? '0 0 auto' : 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Search input */}
              <div style={{ padding: spacing.md }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: theme.radii?.[1] || 4,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <Search size={16} color={theme.colors.textSecondary} />
                  <input
                    type="text"
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    placeholder="Search repositories..."
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: theme.colors.text,
                      fontSize: theme.fontSizes[1],
                      fontFamily: 'inherit',
                    }}
                  />
                  {localSearchQuery && (
                    <button
                      onClick={handleClearSearch}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: spacing.xs,
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: theme.radii?.[1] || 4,
                      }}
                    >
                      <X size={14} color={theme.colors.textSecondary} />
                    </button>
                  )}
                </div>
              </div>

              {/* Search results - only show when not in selection mode with items */}
              {!(selectionMode || selectedCards.size > 0) && (
                <div style={{ flex: 1, overflow: 'auto', padding: `0 ${spacing.md}px ${spacing.md}px` }}>
                  {!isSearching ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: theme.colors.textSecondary,
                        textAlign: 'center',
                        fontSize: theme.fontSizes[1],
                      }}
                    >
                      <Search size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
                      <span>Search local, GitHub,</span>
                      <span>and starred repos</span>
                    </div>
                  ) : searchLoading ? (
                    <div
                      style={{
                        padding: spacing.lg,
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        fontSize: theme.fontSizes[1],
                      }}
                    >
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div
                      style={{
                        padding: spacing.md,
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        fontSize: theme.fontSizes[1],
                      }}
                    >
                      No results for "{localSearchQuery}"
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          marginBottom: spacing.xs,
                          textAlign: 'left',
                        }}
                      >
                        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                      </div>
                      {searchResults.map((result) => {
                        const SOURCE_CONFIG: Record<SearchResultSource, { icon: LucideIcon; color: string; label: string }> = {
                          local: { icon: Folder, color: '#3b82f6', label: 'Local' },
                          github: { icon: Github, color: '#6b7280', label: 'GitHub' },
                          starred: { icon: Star, color: '#eab308', label: 'Starred' },
                        };
                        const config = SOURCE_CONFIG[result.source];
                        const Icon = config.icon;

                        return (
                          <button
                            key={result.id}
                            onClick={() => onSelectSearchResult?.(result)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.sm,
                              width: '100%',
                              padding: spacing.sm,
                              backgroundColor: 'transparent',
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: theme.radii?.[1] || 4,
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                              e.currentTarget.style.borderColor = theme.colors.primary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.borderColor = theme.colors.border;
                            }}
                          >
                            {/* Source icon */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 24,
                                height: 24,
                                borderRadius: theme.radii?.[1] || 4,
                                backgroundColor: `${config.color}20`,
                                flexShrink: 0,
                              }}
                            >
                              <Icon size={12} color={config.color} />
                            </div>

                            {/* Name */}
                            <div
                              style={{
                                flex: 1,
                                fontSize: theme.fontSizes[1],
                                color: theme.colors.text,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {result.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Summary Panel (bottom) - show when in selection mode or has selections */}
            {(selectionMode || selectedCards.size > 0) && (
              <div
                style={{
                  width: '100%',
                  maxWidth: 400,
                  flex: 1,
                  borderTop: `1px solid ${theme.colors.border}`,
                  overflow: 'hidden',
                }}
              >
                <AISummaryPanel
                  selectedCommits={selectedCommits}
                  selectedCount={selectedCards.size}
                  onClearSelection={clearSelections}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Individual repository activity card
 */
interface RepoActivityCardProps {
  summary: RepoActivitySummary;
  imageUrl?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
  formatRelativeTime: (date: Date) => string;
  theme: ReturnType<typeof useTheme>['theme'];
  spacing: { xs: number; sm: number; md: number; lg: number };
  dimmed?: boolean;
  commitAvatars: Map<string, string>;
  // Selection mode props
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: () => void;
}

const RepoActivityCard: React.FC<RepoActivityCardProps> = ({
  summary,
  imageUrl,
  isExpanded,
  onToggleExpand,
  onOpen,
  formatRelativeTime,
  theme,
  spacing,
  dimmed = false,
  commitAvatars,
  selectionMode = false,
  isSelected = false,
  onSelectionChange,
}) => {
  const hasMoreCommits = summary.commits.length > 1;
  const [hoveredCommitIndex, setHoveredCommitIndex] = useState<number | null>(null);

  // Diff totals state (per-commit)
  const [diffTotals, setDiffTotals] = useState<{ additions: number; deletions: number } | null>(null);

  // Aggregate diff totals (all commits in card)
  const [aggregateDiff, setAggregateDiff] = useState<{ additions: number; deletions: number } | null>(null);
  // Per-commit diffs for computing accumulated totals on hover
  const [perCommitDiffs, setPerCommitDiffs] = useState<Array<{ additions: number; deletions: number }>>([]);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [isOpenClicked, setIsOpenClicked] = useState(false);
  const [animationCommitIndex, setAnimationCommitIndex] = useState<number | null>(null);
  const [typewriterText, setTypewriterText] = useState<string>('');
  const [animationImageUrl, setAnimationImageUrl] = useState<string | null>(null);
  const [animatedAggregate, setAnimatedAggregate] = useState<{ additions: number; deletions: number }>({ additions: 0, deletions: 0 });
  const animationRef = useRef<{ cancel: boolean }>({ cancel: false });

  // Get the commit to display (animation > hovered > most recent)
  const displayedCommitIndex = animationCommitIndex ?? hoveredCommitIndex ?? 0;
  const displayedCommit = summary.commits[displayedCommitIndex];
  const displayedTime = new Date(displayedCommit?.date ?? summary.latestCommitAt);
  const displayedMessage = isAnimating && typewriterText !== null
    ? typewriterText
    : displayedCommit?.message ?? '';

  // Animation logic
  const startAnimation = useCallback(async () => {
    if (isAnimating) {
      // Stop animation
      animationRef.current.cancel = true;
      setIsAnimating(false);
      setAnimationCommitIndex(null);
      setTypewriterText('');
      setAnimationImageUrl(null);
      return;
    }

    setIsAnimating(true);
    animationRef.current.cancel = false;
    setAnimatedAggregate({ additions: 0, deletions: 0 });

    // Start from oldest commit (highest index) to newest (index 0)
    const commits = summary.commits;
    let runningAdditions = 0;
    let runningDeletions = 0;

    for (let i = commits.length - 1; i >= 0; i--) {
      if (animationRef.current.cancel) break;

      const commit = commits[i];
      setAnimationCommitIndex(i);
      setTypewriterText('');

      // Generate image for this commit with changed files highlighted
      try {
        const filePaths = await GitService.getFileTreeAtCommit(summary.repoPath, commit.hash);
        const changedFilesMap = await GitService.getChangedFilesForCommit(summary.repoPath, commit.hash);

        // Convert Map to Record for the API
        const changedFiles: Record<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }> = {};
        changedFilesMap.forEach((value, key) => {
          changedFiles[key] = value;
          runningAdditions += value.additions;
          runningDeletions += value.deletions;
        });

        // Update animated aggregate with running totals
        if (!animationRef.current.cancel) {
          setAnimatedAggregate({ additions: runningAdditions, deletions: runningDeletions });
        }

        const image = await FileCityImageService.getImageForCommitWithChanges(
          summary.repoPath,
          commit.hash,
          filePaths,
          changedFiles
        );
        if (!animationRef.current.cancel) {
          setAnimationImageUrl(image);
        }
      } catch (err) {
        console.warn('[ActivityFeedPanel] Failed to generate image for commit:', err);
      }

      // Typewriter effect for commit message
      const message = commit.message;
      for (let j = 0; j <= message.length; j++) {
        if (animationRef.current.cancel) break;
        setTypewriterText(message.slice(0, j));
        await new Promise(resolve => setTimeout(resolve, 30)); // 30ms per character
      }

      if (animationRef.current.cancel) break;

      // Pause at each commit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Animation complete
    if (!animationRef.current.cancel) {
      setIsAnimating(false);
      setAnimationCommitIndex(null);
      setTypewriterText('');
      setAnimationImageUrl(null);
    }
  }, [isAnimating, summary.commits, summary.repoPath]);

  // Fetch diff totals when displayed commit changes
  const displayedCommitHash = displayedCommit?.hash;
  useEffect(() => {
    if (!displayedCommitHash) {
      setDiffTotals(null);
      return;
    }

    let cancelled = false;

    GitService.getChangedFilesForCommit(summary.repoPath, displayedCommitHash)
      .then((changedFilesMap) => {
        if (cancelled) return;

        let additions = 0;
        let deletions = 0;
        changedFilesMap.forEach((value) => {
          additions += value.additions;
          deletions += value.deletions;
        });

        setDiffTotals({ additions, deletions });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[ActivityFeedPanel] Failed to fetch diff totals:', err);
        setDiffTotals(null);
      });

    return () => {
      cancelled = true;
    };
  }, [displayedCommitHash, summary.repoPath]);

  // Compute aggregate diff totals from all commits
  useEffect(() => {
    if (summary.commits.length === 0) {
      setAggregateDiff(null);
      setPerCommitDiffs([]);
      return;
    }

    let cancelled = false;

    Promise.all(
      summary.commits.map((commit) =>
        GitService.getChangedFilesForCommit(summary.repoPath, commit.hash)
      )
    )
      .then((results) => {
        if (cancelled) return;

        let totalAdditions = 0;
        let totalDeletions = 0;
        const commitDiffs: Array<{ additions: number; deletions: number }> = [];

        for (const changedFilesMap of results) {
          let commitAdditions = 0;
          let commitDeletions = 0;
          changedFilesMap.forEach((value) => {
            commitAdditions += value.additions;
            commitDeletions += value.deletions;
            totalAdditions += value.additions;
            totalDeletions += value.deletions;
          });
          commitDiffs.push({ additions: commitAdditions, deletions: commitDeletions });
        }

        setPerCommitDiffs(commitDiffs);
        setAggregateDiff({ additions: totalAdditions, deletions: totalDeletions });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[ActivityFeedPanel] Failed to compute aggregate diff:', err);
        setAggregateDiff(null);
        setPerCommitDiffs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [summary.commits, summary.repoPath]);

  // Determine which image to show
  const currentImageUrl = isAnimating && animationImageUrl ? animationImageUrl : imageUrl;

  return (
    <div
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: theme.radii?.[2] || 8,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        opacity: dimmed ? 0.7 : 1,
        transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Horizontal layout: content left, image right */}
      <div
        style={{
          display: 'flex',
          minHeight: 300,
        }}
      >
        {/* Summary info - left half */}
        <div
          style={{
            flex: 1,
            padding: spacing.md,
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
          }}
          onClick={onToggleExpand}
        >
          {/* Header with avatar, name, and time */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            {/* Selection checkbox */}
            {selectionMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectionChange?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  marginTop: 16,
                  backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                  border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {isSelected && <Check size={14} color={theme.colors.textOnPrimary} />}
              </button>
            )}

            {/* Avatar */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {summary.githubOwner ? (
                <img
                  src={`https://github.com/${summary.githubOwner}.png?size=80`}
                  alt={summary.githubOwner}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    // Fall back to placeholder on error
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.removeAttribute('style');
                  }}
                />
              ) : null}
              <User
                size={28}
                color={theme.colors.textSecondary}
                style={summary.githubOwner ? { display: 'none' } : undefined}
              />
            </div>

            {/* Name and time */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4
                style={{
                  margin: 0,
                  marginBottom: spacing.xs,
                  fontSize: theme.fontSizes[3],
                  fontWeight: 600,
                  color: theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {summary.repoName}
              </h4>
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  color: hoveredCommitIndex !== null ? theme.colors.primary : theme.colors.textSecondary,
                  transition: 'color 0.15s ease',
                }}
              >
                {formatRelativeTime(displayedTime)}
              </span>
            </div>
          </div>

          {/* Commit dots - grouped in rows of 10 with connecting line */}
          <div style={{ marginBottom: spacing.md }}>
            {Array.from({ length: Math.ceil(summary.commits.length / 10) }).map((_, rowIndex) => {
              const rowCommits = summary.commits.slice(rowIndex * 10, (rowIndex + 1) * 10);
              const firstCommit = rowCommits[0];
              return (
                <div
                  key={firstCommit?.hash ?? `empty-row-${rowIndex}`}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    marginBottom: rowIndex < Math.ceil(summary.commits.length / 10) - 1 ? spacing.xs : 0,
                    height: 24,
                  }}
                >
                  {/* Connecting line */}
                  {rowCommits.length > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '50%',
                        height: 2,
                        backgroundColor: theme.colors.border,
                        transform: 'translateY(-50%)',
                        zIndex: 0,
                      }}
                    />
                  )}
                  {/* Dots with expanded hover targets */}
                  {rowCommits.map((commit, index) => {
                    const globalIndex = rowIndex * 10 + index;
                    // During animation, use animationCommitIndex; otherwise use hover/default logic
                    const activeIndex = isAnimating ? animationCommitIndex : (hoveredCommitIndex ?? 0);
                    const isDisplayed = globalIndex === activeIndex;
                    // Fill from most recent (0) up to active index
                    const isFilled = activeIndex !== null && globalIndex <= activeIndex;
                    return (
                      <div
                        key={commit.hash}
                        onMouseEnter={() => !isAnimating && setHoveredCommitIndex(globalIndex)}
                        onMouseLeave={() => !isAnimating && setHoveredCommitIndex(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 1,
                          height: '100%',
                          cursor: 'pointer',
                          zIndex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            backgroundColor: isDisplayed ? theme.colors.primary : theme.colors.textSecondary,
                            opacity: isFilled ? 1 : 0.3,
                            border: `2px solid ${theme.colors.backgroundSecondary}`,
                            transition: 'opacity 0.15s ease, background-color 0.15s ease',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Aggregate diff bars */}
          {(() => {
            // Compute displayed aggregate based on state:
            // - Animating: use animatedAggregate
            // - Hovering: compute accumulated from oldest to hovered index
            // - Default: show full aggregate
            let displayedAggregate: { additions: number; deletions: number } | null = null;

            if (isAnimating) {
              displayedAggregate = animatedAggregate;
            } else if (hoveredCommitIndex !== null && perCommitDiffs.length > 0) {
              // Accumulate from oldest (highest index) to hovered index
              let additions = 0;
              let deletions = 0;
              for (let i = perCommitDiffs.length - 1; i >= hoveredCommitIndex; i--) {
                additions += perCommitDiffs[i]?.additions ?? 0;
                deletions += perCommitDiffs[i]?.deletions ?? 0;
              }
              displayedAggregate = { additions, deletions };
            } else {
              displayedAggregate = aggregateDiff;
            }

            const total = aggregateDiff ? aggregateDiff.additions + aggregateDiff.deletions : 0;

            if (!displayedAggregate || total === 0) return null;

            return (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  marginBottom: spacing.sm,
                }}
              >
                {/* Additions bar */}
                {aggregateDiff && aggregateDiff.additions > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <div
                      style={{
                        height: 10,
                        width: `${Math.min(100, (displayedAggregate.additions / total) * 100)}%`,
                        minWidth: displayedAggregate.additions > 0 ? 6 : 0,
                        backgroundColor: theme.colors.success,
                        transition: 'width 0.3s ease',
                      }}
                    />
                    <span
                      style={{
                        fontSize: theme.fontSizes[0],
                        fontFamily: theme.fonts.monospace,
                        color: theme.colors.success,
                      }}
                    >
                      +{displayedAggregate.additions}
                    </span>
                  </div>
                )}
                {/* Deletions bar */}
                {aggregateDiff && aggregateDiff.deletions > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <div
                      style={{
                        height: 10,
                        width: `${Math.min(100, (displayedAggregate.deletions / total) * 100)}%`,
                        minWidth: displayedAggregate.deletions > 0 ? 6 : 0,
                        backgroundColor: theme.colors.error,
                        transition: 'width 0.3s ease',
                      }}
                    />
                    <span
                      style={{
                        fontSize: theme.fontSizes[0],
                        fontFamily: theme.fonts.monospace,
                        color: theme.colors.error,
                      }}
                    >
                      -{displayedAggregate.deletions}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Commit hash + per-commit changes */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              marginBottom: spacing.xs,
            }}
          >
            {/* Author avatar */}
            {displayedCommit && (() => {
              const avatarUrl =
                commitAvatars.get(displayedCommit.hash) ||
                getAvatarUrl(displayedCommit.authorEmail, 20) ||
                (summary.githubOwner ? `https://github.com/${summary.githubOwner}.png?size=40` : null);

              return avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayedCommit.author}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <User size={12} color={theme.colors.textSecondary} />
                </div>
              );
            })()}
            <code
              style={{
                fontSize: theme.fontSizes[0],
                fontFamily: theme.fonts.monospace,
                color: theme.colors.textSecondary,
              }}
            >
              {displayedCommit?.hash.slice(0, 7)}
            </code>
            {diffTotals && (diffTotals.additions > 0 || diffTotals.deletions > 0) && (
              <>
                {diffTotals.additions > 0 && (
                  <span
                    style={{
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.monospace,
                      color: theme.colors.success,
                    }}
                  >
                    +{diffTotals.additions}
                  </span>
                )}
                {diffTotals.deletions > 0 && (
                  <span
                    style={{
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.monospace,
                      color: theme.colors.error,
                    }}
                  >
                    -{diffTotals.deletions}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Commit message (on its own line) */}
          <div
            style={{
              fontSize: theme.fontSizes[1],
              color: (isAnimating || hoveredCommitIndex !== null) ? theme.colors.primary : theme.colors.text,
              marginBottom: spacing.sm,
              transition: 'color 0.15s ease',
              minHeight: '1.5em',
            }}
          >
            {displayedMessage || (isAnimating ? '' : 'No commits')}
            {isAnimating && <span style={{ opacity: 0.5 }}>|</span>}
          </div>

          {/* Spacer to push controls to bottom */}
          <div style={{ flex: 1 }} />

          {/* Controls row: animate button and expand indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            {/* Animate button */}
            {hasMoreCommits && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startAnimation();
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  fontSize: theme.fontSizes[1],
                  color: isAnimating ? theme.colors.error : theme.colors.primary,
                  backgroundColor: 'transparent',
                  border: `1px solid ${isAnimating ? theme.colors.error : theme.colors.primary}`,
                  borderRadius: theme.radii?.[1] || 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isAnimating ? <Square size={12} /> : <Play size={12} />}
                <span>{isAnimating ? 'Stop' : 'Animate'}</span>
              </button>
            )}

            {/* Open in workspace button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpenClicked(true);
                setTimeout(() => setIsOpenClicked(false), 200);
                onOpen();
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                fontSize: theme.fontSizes[1],
                color: theme.colors.primary,
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.primary}`,
                borderRadius: theme.radii?.[1] || 4,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                transform: isOpenClicked ? 'scale(0.92)' : 'scale(1)',
              }}
            >
              <ExternalLink size={12} />
              <span>Open</span>
            </button>

            {/* Show details button */}
            {hasMoreCommits && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii?.[1] || 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
              </button>
            )}
          </div>
        </div>

        {/* File City image - right half */}
        <div
          style={{
            width: 300,
            height: 300,
            backgroundColor: theme.colors.background,
            borderLeft: `1px solid ${theme.colors.border}`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onDoubleClick={onOpen}
        >
          {currentImageUrl ? (
            <img
              src={currentImageUrl}
              alt={summary.repoName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <FolderGit2 size={64} color={theme.colors.textSecondary} style={{ opacity: 0.3 }} />
          )}
        </div>
      </div>

      {/* Expanded commits list */}
      {isExpanded && summary.commits.length > 1 && (
        <div
          style={{
            borderTop: `1px solid ${theme.colors.border}`,
            padding: spacing.md,
            backgroundColor: theme.colors.background,
          }}
        >
          {summary.commits.slice(1).map((commit, index) => (
            <div
              key={commit.hash}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: spacing.sm,
                padding: `${spacing.xs}px 0`,
                borderTop: index > 0 ? `1px solid ${theme.colors.border}` : 'none',
              }}
            >
              <code
                style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts.monospace,
                  color: theme.colors.textSecondary,
                  flexShrink: 0,
                }}
              >
                {commit.hash.slice(0, 7)}
              </code>
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {commit.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
