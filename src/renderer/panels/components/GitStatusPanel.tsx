import React from 'react';
import { GitBranch } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { EnhancedAlexandriaEntry } from '../../../shared/types/repository.types';

interface GitStatusPanelProps {
  repository: EnhancedAlexandriaEntry;
}

/**
 * GitStatusPanel - Displays commit information only
 * Git changes are now shown in GitChangesPanel
 */
export const GitStatusPanel: React.FC<GitStatusPanelProps> = ({
  repository,
}) => {
  const { theme } = useTheme();

  // Format relative time
  const getRelativeTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 30) return `${Math.floor(days / 30)} months ago`;
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  // If no commit message, show nothing or minimal UI
  if (!repository.lastCommitMessage) {
    return null;
  }

  const commitMessage = repository.lastCommitMessage;
  const lines = commitMessage.split('\n');
  const firstLine = lines[0];
  const hasMoreContent =
    lines.length > 1 && lines.slice(1).some((line: string) => line.trim());

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        height: 'fit-content',
      }}
    >
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          marginBottom: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GitBranch size={14} />
          Last Commit
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            padding: '12px',
            backgroundColor: theme.colors.background,
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                fontSize: theme.fontSizes[2],
                color: theme.colors.text,
                fontWeight: 500,
                flex: 1,
                lineHeight: '1.4',
              }}
            >
              {firstLine}
            </div>
          </div>

          {/* Full Commit Message */}
          {hasMoreContent && (
            <div
              style={{
                padding: '8px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '4px',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {lines.slice(1).join('\n').trim()}
              </div>
            </div>
          )}

          {/* Commit Metadata */}
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            {repository.lastCommitAuthor && (
              <span>{repository.lastCommitAuthor}</span>
            )}
            {repository.lastCommitAuthor && repository.lastCommitHash && (
              <span>•</span>
            )}
            {repository.lastCommitHash && (
              <span
                style={{ fontFamily: theme.fonts.monospace, fontSize: '9px' }}
              >
                {repository.lastCommitHash.substring(0, 8)}
              </span>
            )}
            {(repository.lastCommitAuthor || repository.lastCommitHash) && (
              <span>•</span>
            )}
            <span>{getRelativeTime(repository.github?.lastCommit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
