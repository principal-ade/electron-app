/**
 * ActivityFeedCardPanel
 *
 * Right panel for FeedView showing compact activity cards.
 * Cards display repo info and File City image, with expandable commit details.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { FolderGit2, X } from 'lucide-react';
import { useActivityFeed, type ActivityCommit } from '../hooks/useActivityFeed';
import { RepoActivityCard, type RepoActivitySummary } from './RepoActivityCard';

export interface ActivityFeedCardPanelProps {
  /** List of repositories to show activity for */
  repositories: AlexandriaEntry[];
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
  /** Callback to open a repository in dev workspace */
  onOpenRepository?: (entry: AlexandriaEntry) => void;
}


export const ActivityFeedCardPanel: React.FC<ActivityFeedCardPanelProps> = ({
  repositories,
  events,
  onOpenRepository,
}) => {
  const { theme } = useTheme();

  // Time filter state from heatmap events
  const [timeFilter, setTimeFilter] = useState<{ start: Date; end: Date } | null>(null);
  // Repository filter state
  const [repoFilter, setRepoFilter] = useState<string | null>(null);

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  };

  // Get activity feed commits
  const activityFeed = useActivityFeed(repositories, 20, 10, 100);

  // Listen for time filter events from heatmap
  useEffect(() => {
    const handleTimeFilter = (event: { type: string; payload: { start: Date; end: Date } | null }) => {
      if (event.type === 'feed:time-filter-changed') {
        setTimeFilter(event.payload);
      }
    };

    events.on('feed:time-filter-changed', handleTimeFilter);
    return () => {
      events.off('feed:time-filter-changed', handleTimeFilter);
    };
  }, [events]);

  // Listen for repository filter events from repository list
  useEffect(() => {
    const handleRepoFilter = (event: { type: string; payload: { repoId: string } | null }) => {
      if (event.type === 'feed:repository-filter-changed') {
        setRepoFilter(event.payload?.repoId ?? null);
      }
    };

    events.on('feed:repository-filter-changed', handleRepoFilter);
    return () => {
      events.off('feed:repository-filter-changed', handleRepoFilter);
    };
  }, [events]);

  // Listen for activity refresh events (triggered by git commits)
  useEffect(() => {
    const handleRefreshRequest = () => {
      activityFeed.refresh();
    };

    events.on('feed:activity-refresh-requested', handleRefreshRequest);
    return () => {
      events.off('feed:activity-refresh-requested', handleRefreshRequest);
    };
  }, [events, activityFeed]);

  // Create repo github owner map
  const repoOwnerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const repo of repositories) {
      if (repo.path && repo.github?.owner) {
        map.set(repo.path, repo.github.owner);
      }
    }
    return map;
  }, [repositories]);

  // Create repo entry map
  const repoEntryMap = useMemo(() => {
    const map = new Map<string, AlexandriaEntry>();
    for (const repo of repositories) {
      if (repo.path) {
        map.set(repo.path, repo);
      }
    }
    return map;
  }, [repositories]);

  // Filter commits by time range and repository if filters are active
  const filteredCommits = useMemo(() => {
    let commits = activityFeed.commits;

    // Apply time filter
    if (timeFilter) {
      commits = commits.filter((commit) => {
        const commitDate = new Date(commit.date);
        return commitDate >= timeFilter.start && commitDate < timeFilter.end;
      });
    }

    // Apply repository filter
    if (repoFilter) {
      commits = commits.filter((commit) => commit.repoPath === repoFilter);
    }

    return commits;
  }, [activityFeed.commits, timeFilter, repoFilter]);

  // Helper to get hour bucket for a date
  const getHourBucket = useCallback((date: Date): string => {
    const rounded = new Date(date);
    rounded.setMinutes(0, 0, 0);
    return rounded.toISOString();
  }, []);

  // Helper to format hour bucket for display
  const formatHourBucket = useCallback((hourKey: string): string => {
    const date = new Date(hourKey);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Last hour';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      hour12: true
    });
  }, []);

  // Expanded card state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCardExpanded = useCallback((repoPath: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(repoPath)) {
        next.delete(repoPath);
      } else {
        next.add(repoPath);
      }
      return next;
    });
  }, []);

  // Group commits by hour, then by repository
  const hourlyGroups = useMemo(() => {
    // First, group by hour
    const hourMap = new Map<string, ActivityCommit[]>();

    for (const commit of filteredCommits) {
      const hourKey = getHourBucket(new Date(commit.date));
      const commits = hourMap.get(hourKey) || [];
      commits.push(commit);
      hourMap.set(hourKey, commits);
    }

    // Sort hours (newest first)
    const sortedHours = Array.from(hourMap.entries()).sort(
      (a, b) => b[0].localeCompare(a[0])
    );

    // For each hour, group commits by repository
    return sortedHours.map(([hourKey, commits]) => {
      const repoMap = new Map<string, RepoActivitySummary>();

      for (const commit of commits) {
        let summary = repoMap.get(commit.repoPath);
        if (!summary) {
          const entry = repoEntryMap.get(commit.repoPath);
          summary = {
            repoPath: commit.repoPath,
            repoName: commit.repoName,
            commits: [],
            latestCommitAt: new Date(commit.date),
            commitCount: 0,
            githubOwner: repoOwnerMap.get(commit.repoPath),
            githubRepo: entry?.github?.name,
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

      // Sort repos within hour by latest commit
      const repoSummaries = Array.from(repoMap.values()).sort(
        (a, b) => b.latestCommitAt.getTime() - a.latestCommitAt.getTime()
      );

      return {
        hourKey,
        hourLabel: formatHourBucket(hourKey),
        repos: repoSummaries,
      };
    });
  }, [filteredCommits, repoOwnerMap, repoEntryMap, getHourBucket, formatHourBucket]);

  // Handle opening a repository
  const handleOpenRepo = useCallback(
    (repoPath: string) => {
      const entry = repoEntryMap.get(repoPath);
      if (entry && onOpenRepository) {
        onOpenRepository(entry);
      }
    },
    [repoEntryMap, onOpenRepository]
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Activity
        </h3>
        {timeFilter && (
          <div
            style={{
              marginTop: spacing.xs,
              fontSize: theme.fontSizes[0],
              color: theme.colors.primary,
            }}
          >
            Filtered by time
          </div>
        )}
        {repoFilter && (
          <button
            onClick={() => {
              setRepoFilter(null);
              events.emit({
                type: 'feed:repository-filter-changed',
                source: 'activity-feed-card-panel',
                timestamp: Date.now(),
                payload: null,
              });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              marginTop: spacing.xs,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              fontSize: theme.fontSizes[0],
              color: theme.colors.primary,
              backgroundColor: `${theme.colors.primary}15`,
              border: `1px solid ${theme.colors.primary}`,
              borderRadius: theme.radii?.[1] || 4,
              cursor: 'pointer',
            }}
          >
            <span>Filtered by: {repoFilter.split('/').pop()}</span>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Cards list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        {hourlyGroups.length === 0 && !activityFeed.loading ? (
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
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            {hourlyGroups.map((group) => (
              <div key={group.hourKey}>
                {/* Time section header */}
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    marginBottom: spacing.sm,
                    paddingBottom: spacing.xs,
                    borderBottom: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {group.hourLabel}
                </div>

                {/* Repo cards for this hour */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                  {group.repos.map((summary) => (
                    <RepoActivityCard
                      key={summary.repoPath}
                      summary={summary}
                      isExpanded={expandedCards.has(summary.repoPath)}
                      onToggleExpand={() => toggleCardExpanded(summary.repoPath)}
                      onOpen={() => handleOpenRepo(summary.repoPath)}
                      events={events}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeedCardPanel;
