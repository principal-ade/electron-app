/**
 * ProjectsList
 *
 * Component showing a list of repositories sorted by recent activity.
 * Used in the FeedView panel layout.
 */

import React, { useMemo, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, User } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

export interface CommitTimestamp {
  timestamp: Date | string;
  repoId?: string;
}

export interface ProjectsListProps {
  /** Commit timestamps to aggregate by repository */
  commits: CommitTimestamp[];
  /** Repository data with GitHub information */
  repositories?: AlexandriaEntry[];
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
  /** Currently selected time block (not used in repository list) */
  selectedBlock?: string | null;
}

interface RepoSummaryWithEntry extends RepoSummary {
  entry?: AlexandriaEntry;
}

interface RepoSummary {
  repoId: string;
  repoName: string;
  commitCount: number;
  lastCommitTime: Date;
  githubOwner?: string;
}

export const ProjectsList: React.FC<ProjectsListProps> = ({
  commits,
  repositories = [],
  events,
  selectedBlock: _selectedBlock = null,
}) => {
  const { theme } = useTheme();

  const spacing = {
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
  };

  // Format relative time
  const formatRelativeTime = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    return `${diffYears}y ago`;
  }, []);

  // Handle repository click - open profile
  const handleRepoClick = useCallback(
    (entry: AlexandriaEntry) => {
      events.emit({
        type: 'feed:repository-selected',
        source: 'projects-list-panel',
        timestamp: Date.now(),
        payload: { repository: entry },
      });
    },
    [events]
  );

  // Create a map of repo paths to github owner info
  const repoGithubMap = useMemo(() => {
    const map = new Map<string, { owner: string; name: string }>();
    for (const repo of repositories) {
      if (repo.path && repo.github?.owner && repo.github?.name) {
        map.set(repo.path, { owner: repo.github.owner, name: repo.github.name });
      }
    }
    return map;
  }, [repositories]);

  // Aggregate commits by repository
  const repoSummaries = useMemo<RepoSummaryWithEntry[]>(() => {
    const repoMap = new Map<string, RepoSummaryWithEntry>();

    for (const commit of commits) {
      // Skip commits without repoId
      if (!commit.repoId) continue;

      const repoId = commit.repoId;
      const timestamp = typeof commit.timestamp === 'string'
        ? new Date(commit.timestamp)
        : commit.timestamp;

      let summary = repoMap.get(repoId);
      if (!summary) {
        // Extract repo name from path (last part after /)
        const repoName = repoId.split('/').pop() || repoId;
        const githubInfo = repoGithubMap.get(repoId);
        const entry = repositories.find(r => r.path === repoId);
        summary = {
          repoId,
          repoName,
          commitCount: 0,
          lastCommitTime: timestamp,
          githubOwner: githubInfo?.owner,
          entry,
        };
        repoMap.set(repoId, summary);
      }
      summary.commitCount++;
      if (timestamp > summary.lastCommitTime) {
        summary.lastCommitTime = timestamp;
      }
    }

    // Sort by most recent commit first
    return Array.from(repoMap.values()).sort(
      (a, b) => b.lastCommitTime.getTime() - a.lastCommitTime.getTime()
    );
  }, [commits, repoGithubMap, repositories]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
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
        {repoSummaries.length === 0 ? (
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
          repoSummaries.map((summary) => {
            return (
              <div
                key={summary.repoId}
                onClick={() => summary.entry && handleRepoClick(summary.entry)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  width: '100%',
                  padding: spacing.sm,
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii?.[1] || 4,
                  cursor: summary.entry ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  opacity: summary.entry ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (summary.entry) {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (summary.entry) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }
                }}
              >
              {/* Avatar */}
              <div
                style={{
                  width: 72,
                  height: 72,
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
                    src={`https://github.com/${summary.githubOwner}.png?size=120`}
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
                  <User size={36} color={theme.colors.textSecondary} />
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
                  {formatRelativeTime(summary.lastCommitTime)}
                </div>
              </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProjectsList;
