import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Clock, Github, Download } from 'lucide-react';

export interface RecentRepo {
  url: string;
  owner: string;
  repo: string;
  branch: string;
  lastVisited: number;
}

interface RecentSkillsPanelProps {
  recentRepos: RecentRepo[];
  onSelectRepo: (repo: RecentRepo) => void;
  githubUrl: string;
  onGithubUrlChange: (url: string) => void;
  onFetchSkills: (url?: string) => void;
  isLoading?: boolean;
}

export const RecentSkillsPanel: React.FC<RecentSkillsPanelProps> = ({
  recentRepos,
  onSelectRepo,
  githubUrl,
  onGithubUrlChange,
  onFetchSkills,
  isLoading = false,
}) => {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState(githubUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGithubUrlChange(inputValue);
    onFetchSkills(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search Bar */}
      <div
        style={{
          padding: '24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <Github size={20} color={theme.colors.primary} />
          <h3
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.medium,
              margin: 0,
              color: theme.colors.text,
            }}
          >
            Browse Skills from GitHub
          </h3>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://github.com/owner/repo or owner/repo"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.monospace,
                outline: 'none',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !inputValue.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              borderRadius: '6px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              opacity: isLoading || !inputValue.trim() ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isLoading && inputValue.trim()) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && inputValue.trim()) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            <Download size={16} />
            {isLoading ? 'Loading...' : 'Browse'}
          </button>
        </div>
      </div>

      {/* Recent Repos Section */}
      {recentRepos.length > 0 && (
        <div
          style={{
            padding: '16px 24px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color={theme.colors.textSecondary} />
            <h4
              style={{
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
                margin: 0,
                color: theme.colors.textSecondary,
              }}
            >
              Recently Visited
            </h4>
          </div>
        </div>
      )}

      {/* Recent Repos List or Empty State */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: recentRepos.length === 0 ? '48px 24px' : '16px',
          display: recentRepos.length === 0 ? 'flex' : 'block',
          flexDirection: recentRepos.length === 0 ? 'column' : undefined,
          alignItems: recentRepos.length === 0 ? 'center' : undefined,
          justifyContent: recentRepos.length === 0 ? 'center' : undefined,
        }}
      >
        {recentRepos.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: theme.colors.textSecondary,
              textAlign: 'center',
            }}
          >
            <Clock size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p
              style={{
                fontSize: theme.fontSizes[1],
                margin: 0,
                maxWidth: '400px',
              }}
            >
              Your recently visited repositories will appear here after you browse them.
            </p>
          </div>
        ) : (
          recentRepos.map((repo) => (
          <button
            key={`${repo.owner}/${repo.repo}`}
            onClick={() => onSelectRepo(repo)}
            style={{
              width: '100%',
              padding: '16px',
              marginBottom: '12px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.surface;
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            {/* Repo Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Github size={16} color={theme.colors.primary} />
              <span
                style={{
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.medium,
                  color: theme.colors.text,
                }}
              >
                {repo.owner}/{repo.repo}
              </span>
            </div>

            {/* Branch */}
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.monospace,
              }}
            >
              Branch: {repo.branch}
            </div>

            {/* Last Visited */}
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              {formatLastVisited(repo.lastVisited)}
            </div>
          </button>
          ))
        )}
      </div>
    </div>
  );
};

function formatLastVisited(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}
