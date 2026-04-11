/**
 * HeatmapPanel
 *
 * Panel showing a list of popular repositories sorted by recent activity.
 * Used in the FeedView panel layout (renamed from heatmap to repository list).
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, User } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { CommitTimestamp } from '../components/HourlyActivityHeatmap';

export interface HeatmapPanelProps {
  /** Commit timestamps to aggregate by repository */
  commits: CommitTimestamp[];
  /** Repository data with GitHub information */
  repositories?: AlexandriaEntry[];
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
  /** Currently selected time block (not used in repository list) */
  selectedBlock?: string | null;
}

interface RepoSummary {
  repoId: string;
  repoName: string;
  commitCount: number;
  lastCommitTime: Date;
  githubOwner?: string;
}

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  commits,
  repositories = [],
  events,
  selectedBlock: _selectedBlock = null,
}) => {
  const { theme } = useTheme();
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);

  const spacing = {
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
  };

  // Handle repository click - filter feed by repository
  const handleRepoClick = useCallback(
    (repoId: string) => {
      // Toggle filter off if clicking the same repo
      const isDeselecting = selectedRepoId === repoId;
      const newSelectedRepoId = isDeselecting ? null : repoId;
      setSelectedRepoId(newSelectedRepoId);

      events.emit({
        type: 'feed:repository-filter-changed',
        source: 'heatmap-panel',
        timestamp: Date.now(),
        payload: newSelectedRepoId ? { repoId: newSelectedRepoId } : null,
      });
    },
    [events, selectedRepoId]
  );

  // Listen for repository filter changes from other panels (like clear button)
  useEffect(() => {
    const handleRepoFilterChanged = (event: { type: string; payload: { repoId: string } | null }) => {
      if (event.type === 'feed:repository-filter-changed') {
        setSelectedRepoId(event.payload?.repoId ?? null);
      }
    };

    events.on('feed:repository-filter-changed', handleRepoFilterChanged);
    return () => {
      events.off('feed:repository-filter-changed', handleRepoFilterChanged);
    };
  }, [events]);

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
  const repoSummaries = useMemo<RepoSummary[]>(() => {
    const repoMap = new Map<string, RepoSummary>();

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
        summary = {
          repoId,
          repoName,
          commitCount: 0,
          lastCommitTime: timestamp,
          githubOwner: githubInfo?.owner,
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
  }, [commits, repoGithubMap]);

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
      {/* Header */}
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
            const isSelected = selectedRepoId === summary.repoId;
            return (
              <div
                key={summary.repoId}
                onClick={() => handleRepoClick(summary.repoId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  width: '100%',
                  padding: spacing.sm,
                  backgroundColor: isSelected ? `${theme.colors.primary}15` : 'transparent',
                  border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                  borderRadius: theme.radii?.[1] || 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
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
                  {summary.commitCount} commit{summary.commitCount !== 1 ? 's' : ''}
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

export default HeatmapPanel;
