import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
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

  const infoStyle: React.CSSProperties = {
    padding: spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
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
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    backgroundColor: 'rgba(255, 171, 0, 0.9)', // Amber/orange for dirty
    color: '#000',
    borderRadius: radii.sm,
    fontSize: theme.fontSizes[0],
    fontWeight: 600,
    zIndex: 10,
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

  // Generate highlight layers from aggregated git status
  const highlightLayers = useMemo(() => {
    if (!gitStatus?.byUser || gitStatus.byUser.size === 0) {
      return [];
    }

    return mergeGitStatusHighlightLayers(gitStatus.byUser);
  }, [gitStatus?.byUser]);

  return (
    <div style={containerStyle}>
      <div style={cityContainerStyle}>
        {/* Dirty indicator badge */}
        {gitStatus?.anyDirty && (
          <div style={dirtyBadgeStyle} title={`${gitStatus.dirtyCount} user(s) with uncommitted changes`}>
            <span style={{ fontSize: 10 }}>*</span>
            <span>{gitStatus.dirtyCount} dirty</span>
          </div>
        )}
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
      <div style={infoStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xs }}>
          <div style={repoNameStyle} title={`${owner}/${repo}`}>
            {owner}/{repo}
          </div>
          {hasCurrentDeviceSession && (
            <div style={deviceBadgeStyle} title="This repository is open on this device">
              This Device
            </div>
          )}
        </div>
        <div style={usersContainerStyle}>
          {users.map((user) => {
            const userGitStatus = getUserGitStatus(user.userId);
            return (
              <div
                key={user.userId}
                style={userBadgeStyle}
                title={userGitStatus?.isDirty ? `${user.userId} has uncommitted changes` : user.userId}
              >
                <span style={statusDotStyle(user.status)} />
                <span>{user.userId}</span>
                {userGitStatus?.isDirty && (
                  <span style={gitIndicatorStyle(true)} title="Has uncommitted changes" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
