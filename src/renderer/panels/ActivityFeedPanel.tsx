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
import { FolderGit2, ChevronDown, ChevronRight, Check, User, Play, Square } from 'lucide-react';
import { useActivityFeed, type ActivityCommit } from '../hooks/useActivityFeed';
import { FileCityImageService } from '../main-process-api/FileCityImageService';
import { GitService } from '../main-process-api/GitService';

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

interface ActivityFeedPanelProps {
  context: ActivityFeedPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
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
}

export const ActivityFeedPanel: React.FC<ActivityFeedPanelProps> = ({
  context,
  actions,
  events: _events,
}) => {
  const { theme } = useTheme();
  const extendedActions = actions as ActivityFeedPanelActions;

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  // Get all local repositories for activity feed
  const allRepositories = context.alexandriaRepositories?.data?.repositories ?? [];
  const activityFeed = useActivityFeed(allRepositories, 20, 10, 100); // Get more commits for aggregation

  // State for repo images
  const [repoImages, setRepoImages] = useState<Map<string, string>>(new Map());
  // State for expanded cards
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());

  // Create a map of repo paths to github owners
  const repoOwnerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const repo of allRepositories) {
      if (repo.path && repo.github?.owner) {
        map.set(repo.path, repo.github.owner);
      }
    }
    return map;
  }, [allRepositories]);

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
  const recentRepos = repoSummaries.filter(
    (s) => s.latestCommitAt >= twentyFourHoursAgo
  );
  const olderRepos = repoSummaries.filter(
    (s) => s.latestCommitAt < twentyFourHoursAgo
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
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Activity Feed
          </h3>
          {activityFeed.loading && (
            <span
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
              }}
            >
              Loading...
            </span>
          )}
        </div>

        {/* Status indicator */}
        {!activityFeed.loading && repoSummaries.length > 0 && (
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

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        <div
          style={{
            minWidth: 800,
            maxWidth: 800,
            margin: '0 auto',
          }}
        >
        {repoSummaries.length === 0 && !activityFeed.loading ? (
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
            <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>No recent activity</p>
            <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1] }}>
              Commits from your local repositories will appear here
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {/* Recent repos (last 24h) */}
            {recentRepos.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    marginBottom: spacing.sm,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Last 24 Hours
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {recentRepos.map((summary) => (
                    <RepoActivityCard
                      key={summary.repoPath}
                      summary={summary}
                      imageUrl={repoImages.get(summary.repoPath)}
                      isExpanded={expandedRepos.has(summary.repoPath)}
                      onToggleExpand={() => toggleExpanded(summary.repoPath)}
                      onOpen={() => handleRepoOpen(summary.repoPath)}
                      formatRelativeTime={formatRelativeTime}
                      theme={theme}
                      spacing={spacing}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Older repos */}
            {olderRepos.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    marginBottom: spacing.sm,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Earlier
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {olderRepos.map((summary) => (
                    <RepoActivityCard
                      key={summary.repoPath}
                      summary={summary}
                      imageUrl={repoImages.get(summary.repoPath)}
                      isExpanded={expandedRepos.has(summary.repoPath)}
                      onToggleExpand={() => toggleExpanded(summary.repoPath)}
                      onOpen={() => handleRepoOpen(summary.repoPath)}
                      formatRelativeTime={formatRelativeTime}
                      theme={theme}
                      spacing={spacing}
                      dimmed
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
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
}) => {
  const hasMoreCommits = summary.commits.length > 1;
  const [hoveredCommitIndex, setHoveredCommitIndex] = useState<number | null>(null);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationCommitIndex, setAnimationCommitIndex] = useState<number | null>(null);
  const [typewriterText, setTypewriterText] = useState<string>('');
  const [animationImageUrl, setAnimationImageUrl] = useState<string | null>(null);
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

    // Start from oldest commit (highest index) to newest (index 0)
    const commits = summary.commits;

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
        });

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
              return (
                <div
                  key={rowIndex}
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

          {/* Commit message (changes on hover/animation) */}
          <div
            style={{
              fontSize: theme.fontSizes[1],
              color: (isAnimating || hoveredCommitIndex !== null) ? theme.colors.primary : theme.colors.text,
              marginBottom: spacing.sm,
              transition: 'color 0.15s ease',
              minHeight: '1.5em', // Prevent layout shift during typewriter
            }}
          >
            <code
              style={{
                fontSize: theme.fontSizes[0],
                fontFamily: theme.fonts.monospace,
                color: theme.colors.textSecondary,
                marginRight: spacing.sm,
              }}
            >
              {displayedCommit?.hash.slice(0, 7)}
            </code>
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
                  display: 'flex',
                  alignItems: 'center',
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

            {/* Expand indicator */}
            {hasMoreCommits && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.primary,
                }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{isExpanded ? 'Show less' : `+${summary.commits.length - 1} more`}</span>
              </div>
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
