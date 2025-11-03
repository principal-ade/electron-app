import React, {
  useMemo,
  useState,
} from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Search,
} from 'lucide-react';

import { useAllRepositories } from '../../hooks/useRepositoryData';
import { LocalProjectCard } from './LocalProjectCard';

export const LocalProjectsPanel: React.FC = () => {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('');

  // Load all local repositories with caching
  const { repositories: localRepos, loading } = useAllRepositories();

  const normalizedFilter = filter.trim().toLowerCase();

  // Filter and sort local repositories by most recent commit
  const filteredAndSortedRepositories = useMemo(() => {
    // Filter repositories
    const filtered = localRepos.filter((repoData) => {
      if (!normalizedFilter) return true;

      const entry = repoData.repository;
      const haystack = [
        entry.name,
        entry.github?.name ?? '',
        entry.github?.owner ?? '',
        entry.remoteUrl ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedFilter);
    });

    // Sort by most recent commit (newest first)
    return filtered.sort((a, b) => {
      const aTime = a.repository.github?.lastCommit
        ? new Date(a.repository.github.lastCommit).getTime()
        : 0;
      const bTime = b.repository.github?.lastCommit
        ? new Date(b.repository.github.lastCommit).getTime()
        : 0;

      return bTime - aTime; // Descending order (newest first)
    });
  }, [localRepos, normalizedFilter]);

  const baseContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
  };

  const contentContainerStyle: React.CSSProperties = {
    ...baseContainerStyle,
    padding: '16px',
    gap: '12px',
  };

  if (loading) {
    return (
      <div style={baseContainerStyle}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              maxWidth: '360px',
            }}
          >
            <h3
              style={{
                margin: 0,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
              }}
            >
              Loading local projects...
            </h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={contentContainerStyle}>
      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            top: '50%',
            left: '12px',
            transform: 'translateY(-50%)',
            color: theme.colors.textSecondary,
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={filter}
          placeholder="Filter local projects..."
          onChange={(event) => setFilter(event.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
            outline: 'none',
          }}
        />
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {/* Flat list of repositories */}
        {filteredAndSortedRepositories.map((repoData) => (
          <LocalProjectCard
            key={repoData.repository.path}
            repositoryData={repoData}
          />
        ))}

        {/* No results message */}
        {filteredAndSortedRepositories.length === 0 && !loading && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <p style={{ margin: 0 }}>
              {normalizedFilter ? 'No local projects match your filter.' : 'No local projects found.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const LocalProjectsPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: `${theme.fontSizes[0]}px`,
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: theme.fontWeights.semibold,
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '2px',
            backgroundColor: `${theme.colors.success || '#10b981'}40`,
          }}
        />
        <span>Local Projects</span>
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[0]}px`,
          fontFamily: theme.fonts.body,
          color: theme.colors.textSecondary,
          marginTop: '4px',
        }}
      >
        Browse your cloned repositories sorted by recent activity
      </div>
    </div>
  );
};
