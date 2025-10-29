import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTheme } from '@a24z/industry-theme';
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
  const [ownedRepositories, setOwnedRepositories] = useState<GitHubRepository[]>(
    [],
  );
  const [starredRepositories, setStarredRepositories] =
    useState<GitHubRepository[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

  // Load all local repositories with caching
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
                fontSize: '18px',
                fontWeight: 600,
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
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
      const [owned, starred] = await Promise.all([
        GithubService.getUserRepositories({
          perPage: 100,
          sort: 'updated',
          direction: 'desc',
        }),
        GithubService.getUserStarredRepositories({
          perPage: 100,
          sort: 'updated',
          direction: 'desc',
        }),
      ]);

      setOwnedRepositories(owned);
      setStarredRepositories(starred);
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
      setStarredRepositories([]);
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
  const filteredOwned = useMemo(
    () => filterRepositories(ownedRepositories, normalizedFilter),
    [normalizedFilter, ownedRepositories],
  );
  const filteredStarred = useMemo(
    () => filterRepositories(starredRepositories, normalizedFilter),
    [normalizedFilter, starredRepositories],
  );

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

  const hasData = ownedRepositories.length > 0 || starredRepositories.length > 0;
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
      'Sign in with GitHub to explore your repositories and favorites.',
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
          fontWeight: 600,
          fontSize: '14px',
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
            fontSize: '13px',
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
      'Fetching your personal and starred repositories from GitHub.',
    );
  }

  if (error && !hasData) {
    return renderState(
      <AlertCircle size={32} style={{ color: theme.colors.error || '#ef4444' }} />,
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
          fontWeight: 600,
          fontSize: '14px',
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
            fontSize: '13px',
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
            fontSize: '13px',
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
        {/* Your Repositories Section */}
        {filteredOwned.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('owned')}
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
                  theme.colors.backgroundTertiary || theme.colors.backgroundSecondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {collapsedSections.has('owned') ? (
                  <ChevronRight size={16} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                )}
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Your Repositories
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                {filter
                  ? `${filteredOwned.length} / ${ownedRepositories.length}`
                  : filteredOwned.length}
              </span>
            </button>

            {!collapsedSections.has('owned') && (
              <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                {filteredOwned.map((repo) => (
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
        )}

        {/* Starred Projects Section */}
        {filteredStarred.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('starred')}
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
                  theme.colors.backgroundTertiary || theme.colors.backgroundSecondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {collapsedSections.has('starred') ? (
                  <ChevronRight size={16} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                )}
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Starred Projects
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                {filter
                  ? `${filteredStarred.length} / ${starredRepositories.length}`
                  : filteredStarred.length}
              </span>
            </button>

            {!collapsedSections.has('starred') && (
              <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                {filteredStarred.map((repo) => (
                  <GitHubRepositoryCard
                    key={repo.id}
                    repository={repo}
                    variant="starred"
                    localRepo={localRepoMap.get(repo.full_name)}
                  />
                ))}
              </div>
            )}
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
        fontSize: '12px',
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
          fontWeight: 600,
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
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 600,
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '2px',
            backgroundColor: `${theme.colors.warning || '#f59e0b'}40`,
          }}
        />
        <span>Starred Projects</span>
      </div>
      <div
        style={{
          fontSize: '11px',
          color: theme.colors.textSecondary,
          marginTop: '4px',
        }}
      >
        Browse and manage your GitHub repositories and starred projects
      </div>
    </div>
  );
};
