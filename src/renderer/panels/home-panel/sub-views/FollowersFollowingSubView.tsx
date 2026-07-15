import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import type { GitHubUser } from '../../../../shared/main-process-api-interfaces/GitHubAPI';

export interface FollowersFollowingSubViewProps {
  users: GitHubUser[];
  loading?: boolean;
  label: string;
  onBack: () => void;
}

export const FollowersFollowingSubView: React.FC<FollowersFollowingSubViewProps> = ({
  users,
  loading = false,
  label,
  onBack,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            padding: 4,
            cursor: 'pointer',
            color: theme.colors.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <Users size={16} style={{ color: theme.colors.textMuted }} />
        <h3
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
          }}
        >
          {label}
        </h3>
        {users.length > 0 && (
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textMuted,
              marginLeft: 'auto',
            }}
          >
            {users.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              color: theme.colors.textMuted,
            }}
          >
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : users.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes[2],
            }}
          >
            No {label.toLowerCase()} found
          </div>
        ) : (
          users.map((user) => (
            <a
              key={user.id}
              href={`https://github.com/${user.login}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 16px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <img
                src={user.avatar_url}
                alt={user.login}
                width={32}
                height={32}
                style={{ borderRadius: '50%' }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: theme.fontSizes[2],
                    fontWeight: theme.fontWeights.semibold,
                    color: theme.colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.name || user.login}
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textMuted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  @{user.login}
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
};
