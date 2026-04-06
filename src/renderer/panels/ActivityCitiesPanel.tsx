import React, { useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { useActivityCities } from '../hooks/useActivityCities';
import { CityCard } from '../components/ActivityCities/CityCard';
import { ActivityCitiesHeader } from '../components/ActivityCities/ActivityCitiesHeader';
import { usePrincipalEvents } from '../principal-window/PrincipalEventContext';

/**
 * ActivityCitiesPanel - Bloomberg terminal-style activity feed
 * Shows interactive 2D File City visualizations for all repositories
 * where users are currently active
 */
export const ActivityCitiesPanel: React.FC = () => {
  const { theme } = useTheme();
  const { events: principalEvents } = usePrincipalEvents();
  const { repositories, onlineCount, loading, error } = useActivityCities();

  // Navigate back to Feed view
  const handleBack = useCallback(() => {
    principalEvents?.emit({
      type: 'panel:switch',
      source: 'activity-cities-panel',
      timestamp: Date.now(),
      payload: { view: 'feed' },
    });
  }, [principalEvents]);

  // Theme spacing helpers (space is number[])
  const spacing = {
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: spacing.md,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
    gap: spacing.md,
  };

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[1],
    textAlign: 'center',
    gap: spacing.sm,
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[1],
  };

  const errorStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.error,
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[1],
    padding: spacing.md,
    textAlign: 'center',
  };

  const renderContent = () => {
    if (loading && repositories.length === 0) {
      return <div style={loadingStyle}>Loading activity...</div>;
    }

    if (error && repositories.length === 0) {
      return <div style={errorStyle}>{error}</div>;
    }

    if (repositories.length === 0) {
      return (
        <div style={emptyStateStyle}>
          <div>No active repositories</div>
          <div style={{ fontSize: theme.fontSizes[0], opacity: 0.7 }}>
            When users are online and working on repositories, their cities will appear here.
          </div>
        </div>
      );
    }

    return (
      <div style={gridStyle}>
        {repositories.map((repo) => (
          <CityCard
            key={repo.repoId}
            owner={repo.owner}
            repo={repo.repo}
            branch={repo.branch}
            users={repo.users}
            cityData={repo.cityData}
            loading={repo.loading}
            error={repo.error}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={containerStyle}>
      <ActivityCitiesHeader onlineCount={onlineCount} onBack={handleBack} />
      <div style={contentStyle}>{renderContent()}</div>
    </div>
  );
};
