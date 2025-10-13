import React, { useCallback, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { AlertCircle, Loader2, LogIn } from 'lucide-react';

import { PullRequestsTab } from '../../components/repository-maps/PullRequestsTab';
import { useAuthState } from '../../hooks/useAuthState';
import { parseGitHubUrl } from '../../../shared/utils/githubUrlParser';

type RepositoryLike = {
  owner?: string;
  name?: string;
  remoteUrl?: string;
  github?: {
    owner?: string;
    name?: string;
  } | null;
} | null;

interface GitPullRequestsPanelProps {
  repository?: RepositoryLike;
}

export const GitPullRequestsPanel: React.FC<GitPullRequestsPanelProps> = ({
  repository,
}) => {
  const { theme } = useTheme();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isLoggingIn,
    login,
    loginError,
  } = useAuthState();

  const repoInfo = useMemo(() => {
    if (!repository) {
      return null;
    }

    if (repository.github?.owner && repository.github.name) {
      return {
        owner: repository.github.owner,
        name: repository.github.name,
      };
    }

    if (repository.owner && repository.name) {
      return {
        owner: repository.owner,
        name: repository.name,
      };
    }

    if (repository.remoteUrl) {
      const parsed = parseGitHubUrl(repository.remoteUrl);
      if (parsed?.owner && parsed?.repo) {
        return {
          owner: parsed.owner,
          name: parsed.repo,
        };
      }
    }

    return null;
  }, [repository]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  };

  const renderState = (
    icon: React.ReactNode,
    title: string,
    description?: string,
    action?: React.ReactNode,
    footer?: React.ReactNode,
  ) => (
    <div style={containerStyle}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '360px',
            textAlign: 'center',
          }}
        >
          <div>{icon}</div>
          <div>
            <h3
              style={{
                margin: 0,
                marginBottom: '8px',
                color: theme.colors.text,
                fontSize: '16px',
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

  const handleLogin = useCallback(async () => {
    try {
      await login();
    } catch (error) {
      console.error('GitHub login failed:', error);
    }
  }, [login]);

  if (isAuthLoading && !isAuthenticated) {
    return renderState(
      <Loader2 size={32} style={{ color: theme.colors.textSecondary }} />,
      'Checking authentication status…',
      'Verifying your GitHub session so we can load repository pull requests.',
    );
  }

  if (!isAuthenticated) {
    return renderState(
      <AlertCircle size={32} style={{ color: theme.colors.warning || '#f59e0b' }} />,
      'Sign in to GitHub',
      'Connect your GitHub account to review repository pull requests.',
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
          opacity: isLoggingIn ? 0.7 : 1,
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

  if (!repository) {
    return renderState(
      <AlertCircle size={32} style={{ color: theme.colors.textSecondary }} />,
      'Repository data unavailable',
      'We are still loading information about this repository. Try again in a moment.',
    );
  }

  if (!repoInfo) {
    return renderState(
      <AlertCircle size={32} style={{ color: theme.colors.warning || '#f59e0b' }} />,
      'Pull requests unavailable for this repository',
      'We could not determine a GitHub remote for this project. Configure a GitHub remote to work with pull requests.',
    );
  }

  return (
    <div style={containerStyle}>
      <PullRequestsTab
        repository={{ owner: repoInfo.owner, name: repoInfo.name }}
        ghOwner={repoInfo.owner}
        ghRepo={repoInfo.name}
      />
    </div>
  );
};
