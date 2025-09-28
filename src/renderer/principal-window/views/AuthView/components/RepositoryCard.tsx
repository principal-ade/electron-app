import React from 'react';
import { useTheme } from 'themed-markdown';
import { GitBranch, Star, ExternalLink, Folder, Clock } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';
import { getRelativeTime } from '../utils/repositoryOrganizer';

interface RepositoryCardProps {
  repository: AlexandriaEntry | EnhancedAlexandriaEntry;
  onOpen: (repo: AlexandriaEntry | EnhancedAlexandriaEntry) => void;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  onOpen,
}) => {
  const { theme } = useTheme();
  const enhanced = repository as EnhancedAlexandriaEntry;

  const cardBackground = theme.colors.backgroundTertiary;

  const getLanguageColor = (language?: string) => {
    const colors: Record<string, string> = {
      TypeScript: '#3178c6',
      JavaScript: '#f1e05a',
      Python: '#3572A5',
      Java: '#b07219',
      Go: '#00ADD8',
      Rust: '#dea584',
      C: '#555555',
      'C++': '#f34b7d',
      Ruby: '#701516',
      Swift: '#FA7343',
    };
    return colors[language || ''] || theme.colors.textSecondary;
  };

  return (
    <div
      onClick={() => onOpen(repository)}
      style={{
        backgroundColor: cardBackground,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.colors.primary;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <Folder size={16} style={{ color: theme.colors.primary }} />
          <h4
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
            title={repository.name}
          >
            {repository.name}
          </h4>
          <ExternalLink size={14} style={{ color: theme.colors.textSecondary }} />
        </div>

        {/* Organization/Owner */}
        <p
          style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
            margin: 0,
          }}
        >
          {repository.github?.owner || 'Local Repository'}
        </p>
      </div>

      {/* Description */}
      {repository.github?.description && (
        <p
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.4,
          }}
        >
          {repository.github.description}
        </p>
      )}

      {/* Stats and Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          fontSize: '12px',
          color: theme.colors.textSecondary,
          marginTop: 'auto',
        }}
      >
        {/* Branch */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <GitBranch size={12} />
          {enhanced.gitBranch || repository.github?.defaultBranch || 'main'}
        </span>

        {/* Dirty state indicator */}
        {enhanced.isDirty && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: theme.colors.warning,
              fontWeight: 500,
            }}
          >
            ● {enhanced.dirtyFileCount} changes
          </span>
        )}

        {/* Stars */}
        {repository.github?.stars !== undefined && repository.github.stars > 0 && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Star size={12} />
            {repository.github.stars}
          </span>
        )}


        {/* Language */}
        {repository.github?.primaryLanguage && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getLanguageColor(repository.github.primaryLanguage),
              }}
            />
            {repository.github.primaryLanguage}
          </span>
        )}
      </div>

      {/* Last activity */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          color: theme.colors.textSecondary,
          paddingTop: '8px',
          borderTop: `1px solid ${theme.colors.border}`,
        }}
      >
        <Clock size={11} />
        <span>
          {enhanced.isDirty ? 'Modified ' : 'Updated '}
          {getRelativeTime(enhanced.mostRecentChange || repository.github?.lastCommit)}
        </span>
      </div>
    </div>
  );
};