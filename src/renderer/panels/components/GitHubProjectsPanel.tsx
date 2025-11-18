import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertCircle,
  Loader2,
  LogIn,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { useAuthState } from '../../hooks/useAuthState';
import { GithubService } from '../../main-process-api/GithubService';
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { GitHubRepositoryCard } from './GitHubRepositoryCard';
import { useAllRepositories } from '../../hooks/useRepositoryData';
import type { RepositoryCacheData } from '../../services/RepositoryDataCache';

export const GitHubProjectsPanel: React.FC = () => {
  const { theme } = useTheme();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isLoggingIn,
    login,
    loginError,
  } = useAuthState();
  const [ownedRepositories, setOwnedRepositories] = useState<
    GitHubRepository[]
  >([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

  // Load all local repositories for lookup (to show which GitHub repos are cloned locally)
  const { repositories: localRepos } = useAllRepositories();

  const baseContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
  };

  const renderState = (
    icon: React.ReactNode,
    title: string,
    description?: string,
    action?: React.ReactNode,
    footer?: React.ReactNode,
  ) => (
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
          <div>{icon}</div>
          <div>
            <h3
              style={{
                margin: 0,
                marginBottom: '8px',
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  lineHeight: theme.lineHeights.body,
                  fontFamily: theme.fonts.body,
                }}
              >
                {description}
              </p>
            )}
          </div>
          {action}
          {footer}
        </div>
      </div>
    </div>
  );

  const fetchRepositories = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsFetching(true);
    setError(null);
    try {
      const owned = await GithubService.getUserRepositories({
        perPage: 100,
        sort: 'updated',
        direction: 'desc',
      });

      setOwnedRepositories(owned);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Failed to load GitHub repositories', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load repositories from GitHub.',
      );
    } finally {
      setIsFetching(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchRepositories();
    } else {
      setOwnedRepositories([]);
      setLastUpdated(null);
      setError(null);
    }
  }, [fetchRepositories, isAuthenticated]);

  const handleLogin = useCallback(async () => {
    try {
      await login();
    } catch (err) {
      console.error('GitHub login failed', err);
    }
  }, [login]);

  const handleRefresh = useCallback(() => {
    if (!isFetching) {
      void fetchRepositories();
    }
  }, [fetchRepositories, isFetching]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const normalizedFilter = filter.trim().toLowerCase();

  // Group owned repositories by organization
  const repositoriesByOrg = useMemo(() => {
    const filtered = filterRepositories(ownedRepositories, normalizedFilter);

    // Group by organization/owner
    const grouped = new Map<string, GitHubRepository[]>();
    filtered.forEach((repo) => {
      const orgName = repo.owner.login;
      if (!grouped.has(orgName)) {
        grouped.set(orgName, []);
      }
      grouped.get(orgName)!.push(repo);
    });

    // Sort organizations alphabetically and sort repos within each org by name
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([org, repos]) => ({
        organization: org,
        repositories: repos.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
      }));
  }, [ownedRepositories, normalizedFilter]);

  // Auto-expand sections when there's a filter, collapse when filter is cleared
  useEffect(() => {
    if (normalizedFilter) {
      // Expand all sections when filtering
      setCollapsedSections(new Set());
    } else {
      // Collapse all sections when filter is cleared
      const allSections = new Set<string>();

      repositoriesByOrg.forEach(({ organization }) => {
        allSections.add(`org-${organization}`);
      });

      setCollapsedSections(allSections);
    }
  }, [normalizedFilter, repositoriesByOrg]);

  // Create lookup map for local repositories
  const localRepoMap = useMemo(() => {
    const map = new Map<string, RepositoryCacheData>();

    localRepos.forEach((repoData) => {
      const entry = repoData.repository;

      // Index by GitHub full_name (owner/repo format)
      if (entry.github?.id) {
        map.set(entry.github.id, repoData);
      }

      // Index by owner/name combination
      if (entry.github?.owner && entry.github?.name) {
        map.set(`${entry.github.owner}/${entry.github.name}`, repoData);
      }

      // Index by repository name (fallback)
      map.set(entry.name, repoData);
    });

    return map;
  }, [localRepos]);

  const hasData = ownedRepositories.length > 0;
  const isInitialLoading = isFetching && !hasData;

  if (isAuthLoading && !isAuthenticated) {
    return renderState(
      <Loader2 size={32} style={{ color: theme.colors.textSecondary }} />,
      'Checking authentication status…',
      'Confirming your GitHub session so we can load your projects.',
    );
  }

  if (!isAuthenticated) {
    return renderState(
      <AlertCircle
        size={32}
        style={{ color: theme.colors.warning || '#f59e0b' }}
      />,
      'Connect your GitHub account',
      'Sign in with GitHub to explore your repositories.',
      <button
        type="button"
        onClick={handleLogin}
        disabled={isLoggingIn}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: theme.colors.primary,
          color: theme.colors.background,
          fontWeight: theme.fontWeights.semibold,
          fontSize: `${theme.fontSizes[1]}px`,
          fontFamily: theme.fonts.body,
          cursor: isLoggingIn ? 'not-allowed' : 'pointer',
          opacity: isLoggingIn ? 0.75 : 1,
        }}
      >
        <LogIn size={16} />
        {isLoggingIn ? 'Opening…' : 'Sign in with GitHub'}
      </button>,
      loginError ? (
        <p
          style={{
            margin: 0,
            color: theme.colors.error || '#ef4444',
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
          }}
        >
          {loginError}
        </p>
      ) : undefined,
    );
  }

  if (isInitialLoading) {
    return renderState(
      <Loader2 size={32} style={{ color: theme.colors.textSecondary }} />,
      'Loading your GitHub repositories…',
      'Fetching your personal repositories from GitHub.',
    );
  }

  if (error && !hasData) {
    return renderState(
      <AlertCircle
        size={32}
        style={{ color: theme.colors.error || '#ef4444' }}
      />,
      'Unable to load repositories',
      error,
      <button
        type="button"
        onClick={handleRefresh}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: theme.colors.primary,
          color: theme.colors.background,
          fontWeight: theme.fontWeights.semibold,
          fontSize: `${theme.fontSizes[1]}px`,
          fontFamily: theme.fonts.body,
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={16} />
        Try again
      </button>,
    );
  }

  const contentContainerStyle: React.CSSProperties = {
    ...baseContainerStyle,
    padding: '16px',
    gap: '12px',
  };

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
          placeholder="Filter repositories..."
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

      {error && hasData && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: `${theme.colors.error || '#ef4444'}20`,
            color: theme.colors.error || '#ef4444',
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* GitHub Repositories - Organization Sections */}
        {repositoriesByOrg.map(({ organization, repositories }) => {
            const sectionId = `org-${organization}`;
            const isCollapsed = collapsedSections.has(sectionId);

            return (
              <div key={organization}>
                <button
                  onClick={() => toggleSection(sectionId)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: theme.colors.background,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary ||
                      theme.colors.backgroundSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isCollapsed ? (
                      <ChevronRight
                        size={16}
                        color={theme.colors.textSecondary}
                      />
                    ) : (
                      <ChevronDown
                        size={16}
                        color={theme.colors.textSecondary}
                      />
                    )}
                    <span
                      style={{
                        fontSize: `${theme.fontSizes[1]}px`,
                        fontWeight: theme.fontWeights.semibold,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.text,
                      }}
                    >
                      {organization}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: `${theme.fontSizes[0]}px`,
                      fontFamily: theme.fonts.body,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {repositories.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                    {repositories.map((repo) => (
                      <GitHubRepositoryCard
                        key={repo.id}
                        repository={repo}
                        variant="owned"
                        localRepo={localRepoMap.get(repo.full_name)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        {/* No results message */}
        {repositoriesByOrg.length === 0 && hasData && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <p style={{ margin: 0 }}>No repositories match your filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

function filterRepositories(
  repositories: GitHubRepository[],
  filter: string,
): GitHubRepository[] {
  if (!filter) {
    return repositories;
  }

  return repositories.filter((repo) => {
    const haystack = [
      repo.name,
      repo.full_name,
      repo.owner?.login ?? '',
      repo.description ?? '',
      repo.language ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(filter);
  });
}

export const GitHubProjectsPanelPreview: React.FC = () => {
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
            backgroundColor: `${theme.colors.primary}40`,
          }}
        />
        <span>Your Repositories</span>
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[0]}px`,
          fontFamily: theme.fonts.body,
          color: theme.colors.textSecondary,
          marginTop: '4px',
        }}
      >
        Browse your personal GitHub repositories grouped by organization
      </div>
    </div>
  );
};
