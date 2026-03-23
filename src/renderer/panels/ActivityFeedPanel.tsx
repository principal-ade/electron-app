/**
 * ActivityFeedPanel
 *
 * Displays a cross-repository activity feed showing recent commits
 * from all local repositories. Includes a grid of repository images.
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { FolderGit2, Activity } from 'lucide-react';
import { useActivityFeed } from '../hooks/useActivityFeed';

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

export const ActivityFeedPanel: React.FC<ActivityFeedPanelProps> = ({
  context,
  actions,
  events: _events,
}) => {
  const { theme } = useTheme();
  const extendedActions = actions as ActivityFeedPanelActions;

  // Use theme space array or fallback values
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  // Get all local repositories for activity feed
  const allRepositories = context.alexandriaRepositories?.data?.repositories ?? [];
  const activityFeed = useActivityFeed(allRepositories);

  // State for activity feed repo images
  const [activityRepoImages, setActivityRepoImages] = useState<Map<string, string>>(new Map());
  // State for hovered/selected repo in activity feed
  const [hoveredRepoPath, setHoveredRepoPath] = useState<string | null>(null);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string | null>(null);

  // Fetch File City images for unique repos in activity feed
  useEffect(() => {
    if (activityFeed.commits.length === 0) return;

    // Get unique repo paths from activity feed
    const uniqueRepoPaths = [...new Set(activityFeed.commits.map(c => c.repoPath))];

    // Fetch images for each repo
    const fetchImages = async () => {
      const imageMap = new Map<string, string>();

      await Promise.all(
        uniqueRepoPaths.map(async (repoPath) => {
          try {
            const imageUrl = await extendedActions.getFileCityImage(repoPath);
            if (imageUrl) {
              imageMap.set(repoPath, imageUrl);
            }
          } catch (err) {
            console.warn(`[ActivityFeedPanel] Failed to get image for ${repoPath}:`, err);
          }
        })
      );

      setActivityRepoImages(imageMap);
    };

    fetchImages();
  }, [activityFeed.commits, extendedActions]);

  // Format relative time for activity feed
  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get unique repos from activity feed for image grid
  const uniqueActivityRepos = React.useMemo(() => {
    const seen = new Set<string>();
    return activityFeed.commits.filter(c => {
      if (seen.has(c.repoPath)) return false;
      seen.add(c.repoPath);
      return true;
    }).map(c => ({ name: c.repoName, path: c.repoPath }));
  }, [activityFeed.commits]);

  // Handle clicking on a commit to select that repository
  const handleCommitClick = (repoPath: string) => {
    const entry = allRepositories.find(r => r.path === repoPath);
    if (entry && extendedActions.selectRepository) {
      extendedActions.selectRepository(entry);
    }
  };

  // Handle double-clicking on a repo image to open it
  const handleRepoDoubleClick = (repoPath: string) => {
    const entry = allRepositories.find(r => r.path === repoPath);
    if (entry && extendedActions.openLocalRepository) {
      extendedActions.openLocalRepository(entry);
    }
  };

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
          gap: spacing.sm,
        }}
      >
        <Activity size={20} color={theme.colors.primary} />
        <h3
          style={{
            margin: 0,
            fontSize: theme.fontSizes[3],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Recent Activity
        </h3>
        {activityFeed.loading && (
          <span style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
            Loading...
          </span>
        )}
      </div>

      {/* Split Content: Activity Feed (left) + Repo Images (right) */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          gap: spacing.md,
          padding: spacing.md,
        }}
      >
        {/* Activity Feed - Left Side */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
          }}
        >
          {activityFeed.commits.length === 0 && !activityFeed.loading ? (
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
              <FolderGit2
                size={48}
                style={{ marginBottom: spacing.md, opacity: 0.5 }}
              />
              <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
                No recent activity
              </p>
              <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1] }}>
                Commits from your local repositories will appear here
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {activityFeed.commits
                .filter((commit) => !selectedRepoPath || commit.repoPath === selectedRepoPath)
                .map((commit) => {
                  const isDimmed = hoveredRepoPath && commit.repoPath !== hoveredRepoPath;
                  return (
                    <div
                      key={`${commit.repoPath}-${commit.hash}`}
                      style={{
                        padding: spacing.sm,
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: theme.radii?.[1] || 4,
                        border: `1px solid ${theme.colors.border}`,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease, opacity 0.15s ease',
                        opacity: isDimmed ? 0.3 : 1,
                      }}
                      onMouseEnter={(e) => {
                        setHoveredRepoPath(commit.repoPath);
                        e.currentTarget.style.borderColor = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        setHoveredRepoPath(null);
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                      onClick={() => handleCommitClick(commit.repoPath)}
                    >
                      {/* Repo name and time */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: spacing.xs,
                        }}
                      >
                        <span
                          style={{
                            fontSize: theme.fontSizes[1],
                            fontWeight: 600,
                            color: theme.colors.primary,
                          }}
                        >
                          {commit.repoName}
                        </span>
                        <span
                          style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {formatRelativeTime(commit.date)}
                        </span>
                      </div>
                      {/* Commit message */}
                      <div
                        style={{
                          fontSize: theme.fontSizes[2],
                          color: theme.colors.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {commit.message}
                      </div>
                      {/* Author and hash */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm,
                          marginTop: spacing.xs,
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                        }}
                      >
                        <span>{commit.author}</span>
                        <code
                          style={{
                            fontSize: theme.fontSizes[0],
                            fontFamily: theme.fonts.monospace,
                            backgroundColor: theme.colors.background,
                            padding: '1px 4px',
                            borderRadius: 2,
                          }}
                        >
                          {commit.hash.slice(0, 7)}
                        </code>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Repo Images - Right Side */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
          }}
        >
          {uniqueActivityRepos.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: spacing.sm,
              }}
            >
              {uniqueActivityRepos.map((repo) => {
                const imageUrl = activityRepoImages.get(repo.path);
                const isSelected = selectedRepoPath === repo.path;
                const isDimmed = hoveredRepoPath && repo.path !== hoveredRepoPath;
                return (
                  <div
                    key={repo.path}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: theme.radii?.[1] || 4,
                      border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: isSelected ? `0 0 0 2px ${theme.colors.primary}40` : 'none',
                      opacity: isDimmed ? 0.3 : 1,
                    }}
                    onMouseEnter={() => {
                      setHoveredRepoPath(repo.path);
                    }}
                    onMouseLeave={() => {
                      setHoveredRepoPath(null);
                    }}
                    onClick={() => {
                      setSelectedRepoPath(isSelected ? null : repo.path);
                    }}
                    onDoubleClick={() => handleRepoDoubleClick(repo.path)}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={repo.name}
                        style={{
                          flex: 1,
                          width: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FolderGit2 size={24} color={theme.colors.textSecondary} style={{ opacity: 0.5 }} />
                      </div>
                    )}
                    <div
                      style={{
                        padding: `${spacing.xs}px`,
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.text,
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        backgroundColor: theme.colors.background,
                        borderTop: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      {repo.name}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[1],
              }}
            >
              {activityFeed.loading ? 'Loading...' : 'No repositories'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
