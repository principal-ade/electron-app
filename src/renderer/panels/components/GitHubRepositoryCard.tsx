import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  ExternalLink,
  FolderGit2,
  GitBranch,
  GitFork,
  Star,
  Check,
} from 'lucide-react';

import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { useVisibleProjects } from '../../contexts/VisibleProjectsContext';

interface GitHubRepositoryCardProps {
  repository: GitHubRepository;
  variant: 'owned' | 'starred';
}

export const GitHubRepositoryCard: React.FC<GitHubRepositoryCardProps> = ({
  repository,
  variant,
}) => {
  const { theme } = useTheme();
  const { toggleVisibleProject, isProjectVisible } = useVisibleProjects();
  const isStarred = variant === 'starred';
  const isSelected = isProjectVisible(repository.full_name);

  const badgeColor = isStarred
    ? theme.colors.warning || '#f59e0b'
    : theme.colors.primary;
  const badgeBackground = `${badgeColor}30`;

  const handleOpenInGitHub = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(repository.html_url, '_blank');
  };

  const handleToggleSelection = () => {
    toggleVisibleProject({
      fullName: repository.full_name,
      name: repository.name,
      owner: repository.owner?.login || 'unknown',
    });
  };

  const starCount = repository.stargazers_count ?? 0;

  return (
    <div
      onClick={handleToggleSelection}
      style={{
        backgroundColor: theme.colors.background,
        border: `2px solid ${isSelected ? badgeColor : theme.colors.border}`,
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: '200px',
        position: 'relative',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        ...(isSelected && {
          backgroundColor: `${badgeColor}10`,
        }),
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = badgeColor;
        event.currentTarget.style.transform = 'translateY(-2px)';
        event.currentTarget.style.boxShadow = '0 10px 24px rgba(0, 0, 0, 0.35)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = isSelected
          ? badgeColor
          : theme.colors.border;
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.boxShadow = 'none';
      }}
    >
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: badgeColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.background,
          }}
        >
          <Check size={16} />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {repository.owner?.login ?? 'unknown-owner'}
          </div>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
              lineHeight: 1.2,
              wordBreak: 'break-word',
            }}
          >
            {repository.name}
          </h3>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '999px',
            backgroundColor: badgeBackground,
            color: badgeColor,
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {isStarred ? (
            <Star size={12} fill={badgeColor} color={badgeColor} />
          ) : (
            <FolderGit2 size={12} />
          )}
          {isStarred ? 'Starred' : 'Your Repo'}
        </div>
      </div>

      {repository.description && (
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: theme.colors.textSecondary,
            lineHeight: 1.5,
            maxHeight: '60px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {repository.description}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px 16px',
          fontSize: '12px',
          color: theme.colors.textSecondary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Star
            size={12}
            color={isStarred ? badgeColor : theme.colors.textSecondary}
            fill={isStarred ? badgeColor : 'none'}
          />
          {starCount.toLocaleString()}
        </div>
        {repository.language && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
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
        {repository.fork && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <GitFork size={12} />
            Forked
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Updated {formatRelativeTime(repository.pushed_at || repository.updated_at)}
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button
          type="button"
          onClick={handleOpenInGitHub}
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor =
              theme.colors.backgroundTertiary || theme.colors.backgroundSecondary;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor =
              theme.colors.backgroundSecondary;
          }}
        >
          <ExternalLink size={14} />
          Open on GitHub
        </button>
      </div>
    </div>
  );
};

function formatRelativeTime(dateInput?: string): string {
  if (!dateInput) {
    return 'unknown';
  }

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) {
    return 'just now';
  }
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

function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3776ab',
    Java: '#b07219',
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
