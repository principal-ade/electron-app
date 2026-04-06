import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
} from '@principal-ai/file-city-react';
import type { UserPresence } from '../../../shared/main-process-api-interfaces/PresenceAPI';

export interface CityCardProps {
  owner: string;
  repo: string;
  branch: string;
  users: UserPresence[];
  cityData: CityData | null;
  loading: boolean;
  error: string | null;
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
}) => {
  const { theme } = useTheme();

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
    marginBottom: spacing.xs,
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

  return (
    <div style={containerStyle}>
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
          />
        )}
        {!loading && !error && !cityData && (
          <div style={loadingStyle}>No data available</div>
        )}
      </div>
      <div style={infoStyle}>
        <div style={repoNameStyle} title={`${owner}/${repo}`}>
          {owner}/{repo}
        </div>
        <div style={usersContainerStyle}>
          {users.map((user) => (
            <div key={user.userId} style={userBadgeStyle}>
              <span style={statusDotStyle(user.status)} />
              <span>{user.userId}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
