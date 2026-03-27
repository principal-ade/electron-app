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
import { FolderGit2, ChevronDown, ChevronRight, User, ExternalLink } from 'lucide-react';
import { useActivityFeed, type ActivityCommit } from '../hooks/useActivityFeed';
import { FileCityImageService } from '../main-process-api/FileCityImageService';
import { GitService } from '../main-process-api/GitService';

export interface ActivityFeedCardPanelProps {
  /** List of repositories to show activity for */
  repositories: AlexandriaEntry[];
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
  /** Callback to open a repository in dev workspace */
  onOpenRepository?: (entry: AlexandriaEntry) => void;
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
  entry?: AlexandriaEntry;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(date: Date): string {
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
}

export const ActivityFeedCardPanel: React.FC<ActivityFeedCardPanelProps> = ({
  repositories,
  events,
  onOpenRepository,
}) => {
  const { theme } = useTheme();

  // Time filter state from heatmap events
  const [timeFilter, setTimeFilter] = useState<{ start: Date; end: Date } | null>(null);

  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Repo images state
  const [repoImages, setRepoImages] = useState<Map<string, string>>(new Map());

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

  // Filter commits by time range if filter is active
  const filteredCommits = useMemo(() => {
    if (!timeFilter) return activityFeed.commits;

    return activityFeed.commits.filter((commit) => {
      const commitDate = new Date(commit.date);
      return commitDate >= timeFilter.start && commitDate < timeFilter.end;
    });
  }, [activityFeed.commits, timeFilter]);

  // Aggregate commits by repository
  const repoSummaries = useMemo<RepoActivitySummary[]>(() => {
    const repoMap = new Map<string, RepoActivitySummary>();

    for (const commit of filteredCommits) {
      let summary = repoMap.get(commit.repoPath);
      if (!summary) {
        summary = {
          repoPath: commit.repoPath,
          repoName: commit.repoName,
          commits: [],
          latestCommitAt: new Date(commit.date),
          commitCount: 0,
          githubOwner: repoOwnerMap.get(commit.repoPath),
          entry: repoEntryMap.get(commit.repoPath),
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
  }, [filteredCommits, repoOwnerMap, repoEntryMap]);

  // Fetch File City images for repos
  useEffect(() => {
    if (repoSummaries.length === 0) return;

    const fetchImages = async () => {
      const imageMap = new Map<string, string>();

      await Promise.all(
        repoSummaries.map(async (summary) => {
          try {
            const latestCommit = summary.commits[0];
            if (!latestCommit) return;

            const filePaths = await GitService.getFileTreeAtCommit(summary.repoPath, latestCommit.hash);
            const changedFilesMap = await GitService.getChangedFilesForCommit(summary.repoPath, latestCommit.hash);

            const changedFiles: Record<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }> = {};
            changedFilesMap.forEach((value, key) => {
              changedFiles[key] = value;
            });

            const imageUrl = await FileCityImageService.getImageForCommitWithChanges(
              summary.repoPath,
              latestCommit.hash,
              filePaths,
              changedFiles
            );

            if (imageUrl) {
              imageMap.set(summary.repoPath, imageUrl);
            }
          } catch (err) {
            console.warn(`[ActivityFeedCardPanel] Failed to get image for ${summary.repoPath}:`, err);
          }
        })
      );

      setRepoImages(imageMap);
    };

    fetchImages();
  }, [repoSummaries]);

  // Toggle card expansion
  const toggleExpanded = useCallback((repoPath: string) => {
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

  // Handle opening a repository
  const handleOpenRepo = useCallback(
    (summary: RepoActivitySummary) => {
      if (summary.entry && onOpenRepository) {
        onOpenRepository(summary.entry);
      }
    },
    [onOpenRepository]
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
        {activityFeed.loading && (
          <span
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            Loading...
          </span>
        )}
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
      </div>

      {/* Cards list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        {repoSummaries.length === 0 && !activityFeed.loading ? (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {repoSummaries.map((summary) => (
              <CompactRepoCard
                key={summary.repoPath}
                summary={summary}
                imageUrl={repoImages.get(summary.repoPath)}
                isExpanded={expandedCards.has(summary.repoPath)}
                onToggleExpand={() => toggleExpanded(summary.repoPath)}
                onOpen={() => handleOpenRepo(summary)}
                theme={theme}
                spacing={spacing}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Compact repository activity card
 */
interface CompactRepoCardProps {
  summary: RepoActivitySummary;
  imageUrl?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
  spacing: { xs: number; sm: number; md: number; lg: number };
}

const CompactRepoCard: React.FC<CompactRepoCardProps> = ({
  summary,
  imageUrl,
  isExpanded,
  onToggleExpand,
  onOpen,
  theme,
  spacing,
}) => {
  // Handle drag start - prepare repo info for dropping into terminal
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Format repo info and commits for pasting
      const lines: string[] = [
        `Repository: ${summary.repoName}`,
        `Path: ${summary.repoPath}`,
        `Recent commits (${summary.commitCount}):`,
      ];

      // Add commit details
      for (const commit of summary.commits.slice(0, 5)) {
        lines.push(`  - ${commit.hash.slice(0, 7)}: ${commit.message}`);
      }

      if (summary.commits.length > 5) {
        lines.push(`  ... and ${summary.commits.length - 5} more`);
      }

      const text = lines.join('\n');

      // Set as plain text so terminal will paste it
      e.dataTransfer.setData('text/plain', text);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [summary]
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: theme.radii?.[2] || 8,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        cursor: 'grab',
      }}
    >
      {/* Header: Avatar + Name + Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
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
              src={`https://github.com/${summary.githubOwner}.png?size=64`}
              alt={summary.githubOwner}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <User size={16} color={theme.colors.textSecondary} />
          )}
        </div>

        {/* Name and stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: 600,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary.repoName}
          </div>
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            {summary.commitCount} commit{summary.commitCount !== 1 ? 's' : ''} · {formatRelativeTime(summary.latestCommitAt)}
          </div>
        </div>

        {/* Open button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xs,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: theme.radii?.[1] || 4,
            color: theme.colors.textSecondary,
          }}
          title="Open in workspace"
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {/* File City Image */}
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          backgroundColor: theme.colors.background,
          borderTop: `1px solid ${theme.colors.border}`,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onClick={onOpen}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={summary.repoName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <FolderGit2 size={32} color={theme.colors.textSecondary} style={{ opacity: 0.3 }} />
        )}
      </div>

      {/* Expand/Collapse button */}
      {summary.commits.length > 0 && (
        <button
          onClick={onToggleExpand}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            width: '100%',
            padding: `${spacing.xs}px ${spacing.sm}px`,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            textAlign: 'left',
          }}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>{isExpanded ? 'Hide commits' : 'Show commits'}</span>
        </button>
      )}

      {/* Expanded commits list */}
      {isExpanded && summary.commits.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${theme.colors.border}`,
            padding: spacing.sm,
            backgroundColor: theme.colors.background,
          }}
        >
          {summary.commits.map((commit, index) => (
            <div
              key={commit.hash}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: spacing.xs,
                padding: `${spacing.xs}px 0`,
                borderTop: index > 0 ? `1px solid ${theme.colors.border}` : 'none',
              }}
            >
              <code
                style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.monospace || 'monospace',
                  color: theme.colors.textSecondary,
                  flexShrink: 0,
                }}
              >
                {commit.hash.slice(0, 7)}
              </code>
              <span
                style={{
                  fontSize: theme.fontSizes[0],
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

export default ActivityFeedCardPanel;
