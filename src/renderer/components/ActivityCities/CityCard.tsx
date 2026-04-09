import React, { useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitBranch, ArrowUp, ArrowDown } from 'lucide-react';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
  createFileColorHighlightLayers,
} from '@principal-ai/file-city-react';
import type { SharedGitStatus } from '@principal-ai/control-tower-core';
import type { UserPresence } from '../../../shared/main-process-api-interfaces/PresenceAPI';
import { mergeGitStatusHighlightLayers } from '../../utils/gitStatusHighlightLayers';

export interface CityCardProps {
  owner: string;
  repo: string;
  branch: string;
  users: UserPresence[];
  cityData: CityData | null;
  loading: boolean;
  error: string | null;
  /** Aggregated git status from all users in this repo */
  gitStatus?: {
    byUser: Map<string, SharedGitStatus>;
    anyDirty: boolean;
    dirtyCount: number;
  };
  /** Current device ID for highlighting "this device" */
  currentDeviceId?: string | null;
}

/**
 * Card displaying a 2D File City visualization for a repository
 * with active users listed below
 */
export const CityCard: React.FC<CityCardProps> = ({
  owner,
  repo,
  users,
  cityData,
  loading,
  error,
  gitStatus,
  currentDeviceId,
}) => {
  const { theme } = useTheme();
  const [showSuffixColors, setShowSuffixColors] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Check if this repo has any sessions from the current device
  const hasCurrentDeviceSession = useMemo(() => {
    if (!currentDeviceId) return false;
    const repoId = `${owner}/${repo}`;
    return users.some((user) =>
      user.openRepositories?.some(
        (session) => session.repoId === repoId && session.agentId === currentDeviceId
      )
    );
  }, [users, owner, repo, currentDeviceId]);

  // Theme spacing helpers (space is number[])
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  // Theme radii helpers (radii is number[])
  const radii = {
    sm: theme.radii?.[1] || 4,
    md: theme.radii?.[2] || 8,
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: radii.md,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    minWidth: 400,
    maxWidth: 600,
  };

  const cityContainerStyle: React.CSSProperties = {
    width: '100%',
    height: 300,
    backgroundColor: theme.colors.background,
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    padding: spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.backgroundSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const infoStyle: React.CSSProperties = {
    padding: spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
  };

  const repoHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    overflow: 'hidden',
  };

  const avatarStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `2px solid ${theme.colors.border}`,
  };

  const repoInfoStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    overflow: 'hidden',
  };

  const repoNameStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[1],
    fontWeight: 600,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const ownerNameStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[0],
    color: theme.colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const branchStatusContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  };

  const branchBadgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '2px 4px',
    backgroundColor: theme.colors.background,
    borderRadius: radii.sm,
    fontSize: theme.fontSizes[0],
    fontFamily: theme.fonts.monospace,
    fontWeight: 500,
  };

  const aheadBadgeStyle: React.CSSProperties = {
    ...branchBadgeStyle,
    color: '#10b981', // Green
  };

  const behindBadgeStyle: React.CSSProperties = {
    ...branchBadgeStyle,
    color: '#f59e0b', // Orange
  };

  const divergedBadgeStyle: React.CSSProperties = {
    ...branchBadgeStyle,
    color: '#ef4444', // Red
  };

  const usersContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
  };

  const userBadgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    backgroundColor: theme.colors.background,
    borderRadius: radii.sm,
    fontSize: theme.fontSizes[0],
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const fileListModalStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: spacing.xs,
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: radii.sm,
    padding: spacing.sm,
    minWidth: 250,
    maxWidth: 400,
    maxHeight: 300,
    overflowY: 'auto',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  };

  const fileListHeaderStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[0],
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const fileGroupStyle: React.CSSProperties = {
    marginBottom: spacing.xs,
  };

  const fileGroupLabelStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[0],
    fontWeight: 600,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const fileItemStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[0],
    color: theme.colors.text,
    padding: '2px 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const statusDotStyle = (status: 'online' | 'away' | 'offline'): React.CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor:
      status === 'online'
        ? theme.colors.success
        : status === 'away'
          ? theme.colors.warning
          : theme.colors.textSecondary,
  });

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes[1],
  };

  const errorStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.error,
    fontSize: theme.fontSizes[1],
    padding: spacing.sm,
    textAlign: 'center',
  };

  const dirtyBadgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    backgroundColor: 'rgba(255, 171, 0, 0.9)', // Amber/orange for dirty
    color: '#000',
    borderRadius: radii.sm,
    fontSize: theme.fontSizes[0],
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
    opacity: showSuffixColors ? 1 : 0.6,
  };

  const deviceBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    backgroundColor: theme.colors.primary,
    color: theme.colors.background,
    borderRadius: radii.sm,
    fontSize: theme.fontSizes[0],
    fontWeight: 500,
    marginLeft: spacing.xs,
  };

  const gitIndicatorStyle = (isDirty: boolean): React.CSSProperties => ({
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: isDirty ? '#FFAB00' : 'transparent', // Amber for dirty
    marginLeft: 2,
  });

  // Helper to get user's git status
  const getUserGitStatus = (userId: string): SharedGitStatus | undefined => {
    return gitStatus?.byUser.get(userId);
  };

  // Calculate aggregate ahead/behind for all users
  const aggregateAheadBehind = useMemo(() => {
    if (!gitStatus?.byUser || gitStatus.byUser.size === 0) {
      return null;
    }

    let maxAhead = 0;
    let maxBehind = 0;

    for (const [, status] of gitStatus.byUser.entries()) {
      // Only consider users on main branch
      if (status.branch === 'main' || status.branch === 'master') {
        maxAhead = Math.max(maxAhead, status.ahead || 0);
        maxBehind = Math.max(maxBehind, status.behind || 0);
      }
    }

    if (maxAhead === 0 && maxBehind === 0) {
      return null;
    }

    return { ahead: maxAhead, behind: maxBehind };
  }, [gitStatus?.byUser]);

  // Generate highlight layers from aggregated git status and file suffixes
  const highlightLayers = useMemo(() => {
    const layers = [];
    const hasGitChanges = gitStatus?.byUser && gitStatus.byUser.size > 0;

    // 1. First, add file suffix color layers (higher priority: 100+)
    // Higher priority = drawn first = appears underneath
    // These show the default colors for all files based on their extensions
    if (showSuffixColors && cityData?.buildings) {
      const fileSuffixLayers = createFileColorHighlightLayers(cityData.buildings);

      // Dim suffix layers when git changes are present to help focus on git status
      // Also boost their priority so they render underneath git layers
      const adjustedSuffixLayers = hasGitChanges
        ? fileSuffixLayers.map(layer => ({
            ...layer,
            opacity: (layer.opacity ?? 1.0) * 0.2, // Reduce opacity to 20% when git changes present
            priority: layer.priority + 100, // Boost priority to render underneath git layers
          }))
        : fileSuffixLayers.map(layer => ({
            ...layer,
            priority: layer.priority + 100, // Always boost priority for consistent layering
          }));

      layers.push(...adjustedSuffixLayers);
    }

    // 2. Then, add git status layers (lower priority: 30+)
    // Lower priority = drawn later = appears on top
    // These override the file suffix colors for files with git changes
    if (hasGitChanges) {
      const gitStatusLayers = mergeGitStatusHighlightLayers(gitStatus.byUser);
      layers.push(...gitStatusLayers);
    }

    return layers;
  }, [showSuffixColors, cityData?.buildings, gitStatus?.byUser]);

  return (
    <div style={containerStyle}>
      {/* Header with repo info */}
      <div style={headerStyle}>
        <div style={repoHeaderStyle}>
          <img
            src={`https://github.com/${owner}.png`}
            alt={owner}
            style={avatarStyle}
          />
          <div style={repoInfoStyle}>
            <div style={repoNameStyle} title={repo}>
              {repo}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              <div style={ownerNameStyle} title={owner}>
                {owner}
              </div>
              {/* Ahead/Behind indicators */}
              {aggregateAheadBehind && (
                <div style={branchStatusContainerStyle}>
                  {aggregateAheadBehind.ahead > 0 && aggregateAheadBehind.behind > 0 ? (
                    // Diverged state
                    <div
                      style={divergedBadgeStyle}
                      title={`Diverged: ${aggregateAheadBehind.ahead} ahead, ${aggregateAheadBehind.behind} behind remote`}
                    >
                      <ArrowUp size={10} />
                      {aggregateAheadBehind.ahead}
                      <ArrowDown size={10} />
                      {aggregateAheadBehind.behind}
                    </div>
                  ) : (
                    <>
                      {aggregateAheadBehind.ahead > 0 && (
                        <div
                          style={aheadBadgeStyle}
                          title={`${aggregateAheadBehind.ahead} commit${aggregateAheadBehind.ahead > 1 ? 's' : ''} ahead of remote`}
                        >
                          <ArrowUp size={10} />
                          {aggregateAheadBehind.ahead}
                        </div>
                      )}
                      {aggregateAheadBehind.behind > 0 && (
                        <div
                          style={behindBadgeStyle}
                          title={`${aggregateAheadBehind.behind} commit${aggregateAheadBehind.behind > 1 ? 's' : ''} behind remote`}
                        >
                          <ArrowDown size={10} />
                          {aggregateAheadBehind.behind}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Changes badge - also toggles suffix colors */}
        {gitStatus?.anyDirty && (
          <div
            style={dirtyBadgeStyle}
            onClick={() => setShowSuffixColors(!showSuffixColors)}
            title={`${gitStatus.dirtyCount} user(s) with uncommitted changes\nClick to ${showSuffixColors ? 'hide' : 'show'} file extension colors`}
          >
            <GitBranch size={14} />
            <span>changes</span>
          </div>
        )}
        {hasCurrentDeviceSession && (
          <div style={deviceBadgeStyle} title="This repository is open on this device">
            This Device
          </div>
        )}
      </div>

      {/* City visualization */}
      <div style={cityContainerStyle}>
        {loading && <div style={loadingStyle}>Loading...</div>}
        {error && <div style={errorStyle}>{error}</div>}
        {!loading && !error && cityData && (
          <ArchitectureMapHighlightLayers
            cityData={cityData}
            fullSize={true}
            enableZoom={true}
            canvasBackgroundColor={theme.colors.background}
            defaultBuildingColor={theme.colors.backgroundSecondary}
            defaultDirectoryColor={theme.colors.background}
            showFileNames={false}
            showDirectoryLabels={false}
            showLayerControls={false}
            highlightLayers={highlightLayers}
          />
        )}
        {!loading && !error && !cityData && (
          <div style={loadingStyle}>No data available</div>
        )}
      </div>

      {/* Users section at bottom */}
      <div style={infoStyle}>
        <div style={{ ...usersContainerStyle, position: 'relative' }}>
          {users.map((user) => {
            const userGitStatus = getUserGitStatus(user.userId);
            const isSelected = selectedUserId === user.userId;
            const hasDirtyFiles = userGitStatus?.isDirty;

            return (
              <div key={user.userId} style={{ position: 'relative' }}>
                <div
                  style={{
                    ...userBadgeStyle,
                    ...(hasDirtyFiles && {
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.background,
                      color: isSelected ? theme.colors.background : theme.colors.textSecondary,
                    }),
                  }}
                  onClick={() => {
                    if (hasDirtyFiles) {
                      setSelectedUserId(isSelected ? null : user.userId);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (hasDirtyFiles) {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (hasDirtyFiles) {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? theme.colors.primary
                        : theme.colors.background;
                    }
                  }}
                  title={
                    hasDirtyFiles
                      ? `${user.userId} has uncommitted changes - click to view files`
                      : user.userId
                  }
                >
                  <span style={statusDotStyle(user.status)} />
                  <span>{user.userId}</span>
                  {hasDirtyFiles && (
                    <span style={gitIndicatorStyle(true)} title="Has uncommitted changes" />
                  )}
                </div>

                {/* File list modal */}
                {isSelected && userGitStatus && (
                  <div style={fileListModalStyle}>
                    <div style={fileListHeaderStyle}>{user.userId}'s Changes</div>

                    {userGitStatus.stagedFiles && userGitStatus.stagedFiles.length > 0 && (
                      <div style={fileGroupStyle}>
                        <div style={{ ...fileGroupLabelStyle, color: '#22c55e' }}>
                          Staged ({userGitStatus.stagedFiles.length})
                        </div>
                        {userGitStatus.stagedFiles.map((file) => (
                          <div key={file} style={fileItemStyle} title={file}>
                            {file}
                          </div>
                        ))}
                      </div>
                    )}

                    {userGitStatus.modifiedFiles && userGitStatus.modifiedFiles.length > 0 && (
                      <div style={fileGroupStyle}>
                        <div style={{ ...fileGroupLabelStyle, color: '#f59e0b' }}>
                          Modified ({userGitStatus.modifiedFiles.length})
                        </div>
                        {userGitStatus.modifiedFiles.map((file) => (
                          <div key={file} style={fileItemStyle} title={file}>
                            {file}
                          </div>
                        ))}
                      </div>
                    )}

                    {userGitStatus.untrackedFiles && userGitStatus.untrackedFiles.length > 0 && (
                      <div style={fileGroupStyle}>
                        <div style={{ ...fileGroupLabelStyle, color: '#3b82f6' }}>
                          Untracked ({userGitStatus.untrackedFiles.length})
                        </div>
                        {userGitStatus.untrackedFiles.map((file) => (
                          <div key={file} style={fileItemStyle} title={file}>
                            {file}
                          </div>
                        ))}
                      </div>
                    )}

                    {userGitStatus.deletedFiles && userGitStatus.deletedFiles.length > 0 && (
                      <div style={fileGroupStyle}>
                        <div style={{ ...fileGroupLabelStyle, color: '#ef4444' }}>
                          Deleted ({userGitStatus.deletedFiles.length})
                        </div>
                        {userGitStatus.deletedFiles.map((file) => (
                          <div key={file} style={fileItemStyle} title={file}>
                            {file}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
