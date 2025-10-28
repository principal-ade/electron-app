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
} from 'lucide-react';

import { useAuthState } from '../../hooks/useAuthState';
import { GithubService } from '../../main-process-api/GithubService';
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { GitHubRepositoryCard } from './GitHubRepositoryCard';

export const GitHubStarsPanel: React.FC = () => {
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

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredOwned = useMemo(
    () => filterRepositories(ownedRepositories, normalizedFilter),
    [normalizedFilter, ownedRepositories],
  );
  const filteredStarred = useMemo(
    () => filterRepositories(starredRepositories, normalizedFilter),
    [normalizedFilter, starredRepositories],
  );

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
    padding: '20px',
    gap: '16px',
  };

  const lastUpdatedLabel = lastUpdated
    ? `Last refreshed ${formatRelativeTimestamp(lastUpdated)}`
    : 'Data not refreshed yet';

  return (
    <div style={contentContainerStyle}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            justifyContent: 'flex-end',
            width: '100%',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                top: '50%',
                left: '12px',
                transform: 'translateY(-50%)',
                color: theme.colors.textSecondary,
              }}
            />
            <input
              type="text"
              value={filter}
              placeholder="Filter by name, owner, or language"
              onChange={(event) => setFilter(event.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '13px',
              }}
            />
          </div>
        </div>
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

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          paddingRight: '4px',
        }}
      >
        <Section
          title="Your repositories"
          totalCount={ownedRepositories.length}
          filteredCount={filteredOwned.length}
          emptyMessage={
            filter
              ? 'No repositories match your filter.'
              : 'We did not find any repositories for your account yet.'
          }
        >
          {filteredOwned.length > 0 && (
            <div style={gridStyle}>
              {filteredOwned.map((repo) => (
                <GitHubRepositoryCard
                  key={repo.id}
                  repository={repo}
                  variant="owned"
                />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Starred projects"
          totalCount={starredRepositories.length}
          filteredCount={filteredStarred.length}
          emptyMessage={
            filter
              ? 'No starred repositories match your filter.'
              : "You haven't starred any repositories yet."
          }
        >
          {filteredStarred.length > 0 && (
            <div style={gridStyle}>
              {filteredStarred.map((repo) => (
                <GitHubRepositoryCard
                  key={repo.id}
                  repository={repo}
                  variant="starred"
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '16px',
};

interface SectionProps {
  title: string;
  totalCount: number;
  filteredCount: number;
  emptyMessage: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({
  title,
  totalCount,
  filteredCount,
  emptyMessage,
  children,
}) => {
  const { theme } = useTheme();
  const isFiltered = filteredCount !== totalCount;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          {title}
        </h3>
        <span
          style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
            whiteSpace: 'nowrap',
          }}
        >
          {isFiltered
            ? `${filteredCount} of ${totalCount}`
            : `${totalCount}`}{' '}
          repos
        </span>
      </div>
      {filteredCount === 0 ? (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: `${theme.colors.border}20`,
            color: theme.colors.textSecondary,
            fontSize: '13px',
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </section>
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

function formatRelativeTimestamp(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 1000) {
    return 'just now';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

export const GitHubStarsPanelPreview: React.FC = () => {
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
