import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History as HistoryIcon, RefreshCcw, Clock } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import {
  GitService,
  type GitCommitInfo,
} from '../../main-process-api/GitService';

interface GitCommitHistoryPanelProps {
  repositoryPath: string | null;
  limit?: number;
}

const DEFAULT_LIMIT = 25;

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export const GitCommitHistoryPanel: React.FC<GitCommitHistoryPanelProps> = ({
  repositoryPath,
  limit = DEFAULT_LIMIT,
}) => {
  const { theme } = useTheme();
  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const sortedCommits = useMemo(() => {
    return commits.slice().sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return timeB - timeA;
    });
  }, [commits]);

  const loadCommits = useCallback(async () => {
    if (!repositoryPath) {
      setCommits([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const history = await GitService.getCommitHistory(repositoryPath, limit);
      setCommits(history);
    } catch (err) {
      console.error('[GitCommitHistoryPanel] Failed to load commit history:', err);
      setError('Failed to load commit history');
    } finally {
      setIsLoading(false);
    }
  }, [limit, repositoryPath]);

  useEffect(() => {
    void loadCommits();
  }, [loadCommits, refreshToken]);

  const handleRefresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  if (!repositoryPath) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.textSecondary,
        }}
      >
        Connect a local repository to see commit history.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        height: 'fit-content',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
          fontWeight: 600,
          fontSize: theme.fontSizes[1],
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HistoryIcon size={14} />
          Commit History
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            cursor: isLoading ? 'default' : 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          <RefreshCcw size={12} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div
          style={{
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: theme.colors.errorBackground || '#3f1d1d',
            color: theme.colors.error || '#ef4444',
            fontSize: theme.fontSizes[1],
          }}
        >
          {error}
        </div>
      ) : null}

      {isLoading && !commits.length ? (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
          }}
        >
          Loading commit history...
        </div>
      ) : null}

      {!isLoading && !error && sortedCommits.length === 0 ? (
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
            backgroundColor: theme.colors.background,
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          No commits found.
        </div>
      ) : null}

      {!error && sortedCommits.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {sortedCommits.map((commit) => {
            const firstLine = commit.message.split('\n')[0];
            const relative = formatRelativeTime(commit.date);
            return (
              <div
                key={commit.hash}
                style={{
                  padding: '12px',
                  backgroundColor: theme.colors.background,
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: theme.fontSizes[2],
                    color: theme.colors.text,
                    fontWeight: 500,
                    lineHeight: 1.4,
                  }}
                >
                  {firstLine}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center',
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                  }}
                >
                  {commit.author && <span>{commit.author}</span>}
                  <span style={{ fontSize: '10px' }}>•</span>
                  <span
                    style={{
                      fontFamily: theme.fonts.monospace,
                      fontSize: '11px',
                    }}
                  >
                    {commit.hash.substring(0, 8)}
                  </span>
                  <span style={{ fontSize: '10px' }}>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span title={new Date(commit.date).toLocaleString()}>{relative}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
