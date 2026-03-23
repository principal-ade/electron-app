/**
 * ActivityFeedPanel
 *
 * Displays an aggregated activity feed showing repository cards
 * sorted by recent activity. Each card combines the File City image
 * with commit summaries for a repo-centric view.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { FolderGit2, GitCommit, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useActivityFeed, type ActivityCommit } from '../hooks/useActivityFeed';

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
  }, [activityFeed.commits]);

  // Fetch File City images for repos
  useEffect(() => {
    if (repoSummaries.length === 0) return;

    const fetchImages = async () => {
      const imageMap = new Map<string, string>();

      await Promise.all(
        repoSummaries.map(async (summary) => {
          try {
            const imageUrl = await extendedActions.getFileCityImage(summary.repoPath);
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
      {/* Horizontal layout: image left, content right */}
      <div
        style={{
          display: 'flex',
          minHeight: 400,
        }}
      >
        {/* File City image - left half */}
        <div
          style={{
            width: 400,
            height: 400,
            backgroundColor: theme.colors.background,
            borderRight: `1px solid ${theme.colors.border}`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onDoubleClick={onOpen}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
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

        {/* Summary info - right half */}
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
          {/* Repo name */}
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

          {/* Time */}
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              marginBottom: spacing.md,
            }}
          >
            {formatRelativeTime(summary.latestCommitAt)}
          </span>

          {/* Commit count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              marginBottom: spacing.md,
            }}
          >
            <GitCommit size={14} />
            <span>
              {summary.commitCount} commit{summary.commitCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Latest commit message */}
          <div
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.text,
              marginBottom: spacing.sm,
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
              {summary.commits[0]?.hash.slice(0, 7)}
            </code>
            {summary.commits[0]?.message || 'No commits'}
          </div>

          {/* Spacer to push expand indicator to bottom */}
          <div style={{ flex: 1 }} />

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
              <span>{isExpanded ? 'Show less' : `+${summary.commits.length - 1} more commits`}</span>
            </div>
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
