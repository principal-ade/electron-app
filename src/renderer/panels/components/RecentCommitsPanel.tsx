import React, { useEffect, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { GitCommit, Calendar, User, AlertCircle, Loader2 } from 'lucide-react';
import { GithubService } from '../../main-process-api/GithubService';
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
}

interface RecentCommitsPanelProps {
  repository: GitHubRepository | null;
}

export const RecentCommitsPanel: React.FC<RecentCommitsPanelProps> = ({
  repository,
}) => {
  const { theme } = useTheme();
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommits = async () => {
      if (!repository) {
        setCommits([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const owner = repository.owner?.login || '';
        const repo = repository.name;

        const repoCommits = await GithubService.getRepositoryCommits(
          owner,
          repo,
          { perPage: 10 },
        );

        setCommits(repoCommits);
      } catch (err) {
        console.error('Failed to fetch commits:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load commits',
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchCommits();
  }, [repository]);

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString();
  };

  const truncateMessage = (message: string, maxLength: number = 80): string => {
    const firstLine = message.split('\n')[0];
    if (firstLine.length <= maxLength) {
      return firstLine;
    }
    return `${firstLine.substring(0, maxLength)}...`;
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
    padding: '20px',
    gap: '16px',
  };

  if (!repository) {
    return (
      <div style={containerStyle}>
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
            <GitCommit
              size={32}
              style={{ color: theme.colors.textSecondary }}
            />
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
                No repository selected
              </h3>
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                Click on a repository to view its recent commits
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Loader2
            size={32}
            style={{ color: theme.colors.textSecondary, animation: 'spin 1s linear infinite' }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <AlertCircle size={32} style={{ color: theme.colors.error }} />
            <p style={{ color: theme.colors.textSecondary }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div>
        <h2
          style={{
            margin: 0,
            color: theme.colors.text,
            fontSize: '20px',
            fontWeight: 600,
          }}
        >
          Recent Commits
        </h2>
        <p
          style={{
            margin: '4px 0 0 0',
            color: theme.colors.textSecondary,
            fontSize: '13px',
          }}
        >
          Latest commits from {repository.full_name}
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {commits.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            No commits found in this repository
          </div>
        ) : (
          commits.map((commit) => (
            <a
              key={commit.sha}
              href={commit.html_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                textDecoration: 'none',
                color: theme.colors.text,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  {formatRelativeTime(commit.commit.author.date)}
                </span>
              </div>

              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                }}
              >
                {truncateMessage(commit.commit.message)}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                {commit.author?.avatar_url ? (
                  <img
                    src={commit.author.avatar_url}
                    alt={commit.author.login}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                    }}
                  />
                ) : (
                  <User size={12} />
                )}
                <span>{commit.author?.login || commit.commit.author.name}</span>
                <span style={{ color: theme.colors.border }}>•</span>
                <code
                  style={{
                    fontSize: '11px',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    backgroundColor: `${theme.colors.border}40`,
                    fontFamily: 'monospace',
                  }}
                >
                  {commit.sha.substring(0, 7)}
                </code>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
};
