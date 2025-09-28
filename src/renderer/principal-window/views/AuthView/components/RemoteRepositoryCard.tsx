import React from 'react';
import { useTheme } from 'themed-markdown';
import { Cloud, GitBranch, Download, ExternalLink, Lock, Unlock } from 'lucide-react';
import type { GitHubRepository } from '../../../../../shared/main-process-api-interfaces/GitHubAPI';
import { getRelativeTime } from '../utils/repositoryOrganizer';

interface RemoteRepositoryCardProps {
  repository: GitHubRepository;
  onClone?: (repo: GitHubRepository) => void;
}

export const RemoteRepositoryCard: React.FC<RemoteRepositoryCardProps> = ({
  repository,
  onClone,
}) => {
  const { theme } = useTheme();

  const handleOpenInGitHub = () => {
    window.open(repository.html_url, '_blank');
  };

  const handleClone = () => {
    if (onClone) {
      onClone(repository);
    }
  };

  return (
    <div
      style={{
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.colors.primary;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.shadow}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Remote indicator badge */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          backgroundColor: `${theme.colors.info}20`,
          color: theme.colors.info,
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 500,
        }}
      >
        <Cloud size={12} />
        Remote
      </div>

      {/* Repository name and description */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            {repository.name}
          </h3>
          {repository.private ? (
            <Lock size={14} style={{ color: theme.colors.textSecondary }} />
          ) : (
            <Unlock size={14} style={{ color: theme.colors.textSecondary }} />
          )}
        </div>
        {repository.description && (
          <p
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              margin: '4px 0 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {repository.description}
          </p>
        )}
      </div>

      {/* Repository metadata */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '12px',
          color: theme.colors.textSecondary,
        }}
      >
        {repository.language && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getLanguageColor(repository.language),
              }}
            />
            {repository.language}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <GitBranch size={12} />
          {repository.default_branch}
        </div>
        <div>
          Updated {getRelativeTime(repository.pushed_at)}
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: 'auto',
        }}
      >
        <button
          onClick={handleClone}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <Download size={14} />
          Clone
        </button>
        <button
          onClick={handleOpenInGitHub}
          style={{
            padding: '8px 12px',
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          }}
        >
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
};

// Helper function to get language color
function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3776ab',
    Java: '#007396',
    Go: '#00add8',
    Rust: '#dea584',
    Ruby: '#cc342d',
    PHP: '#777bb4',
    'C++': '#00599c',
    C: '#555555',
    'C#': '#239120',
    Swift: '#fa7343',
    Kotlin: '#7f52ff',
    Dart: '#0175c2',
    Vue: '#4fc08d',
    HTML: '#e34c26',
    CSS: '#1572b6',
    Shell: '#89e051',
    PowerShell: '#012456',
  };
  return colors[language] || '#6e7681';
}