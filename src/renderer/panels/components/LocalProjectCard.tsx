import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { ExternalLink, FolderOpen, Focus, Loader2 } from 'lucide-react';

import type { RepositoryCacheData } from '../../services/RepositoryDataCache';
import { useSelectedRepository } from '../../contexts/SelectedRepositoryContext';
import { WindowService } from '../../main-process-api/WindowService';
import type { RepositoryWindowState } from '../../main-process-api/WindowService';

// Add spin animation styles to document if not already present
if (typeof document !== 'undefined') {
  const styleId = 'local-project-card-animations';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

interface LocalProjectCardProps {
  repositoryData: RepositoryCacheData;
}

export const LocalProjectCard: React.FC<LocalProjectCardProps> = ({
  repositoryData,
}) => {
  const { theme } = useTheme();
  const { selectedRepository, setSelectedRepository } = useSelectedRepository();
  const entry = repositoryData.repository;
  const [windowState, setWindowState] = useState<'closed' | 'opening' | 'ready'>('closed');

  // Check if this repo is selected for README view
  const isReadmeSelected =
    selectedRepository &&
    entry.github &&
    (selectedRepository.id ===
      (typeof entry.github.id === 'number'
        ? entry.github.id
        : parseInt(entry.github.id, 10)) ||
      selectedRepository.full_name ===
        `${entry.github.owner}/${entry.github.name}`);

  // Subscribe to repository window state changes
  useEffect(() => {
    // Initial check
    const checkWindowStatus = async () => {
      const isOpen = await WindowService.isRepositoryWindowOpen(entry);
      setWindowState(isOpen ? 'ready' : 'closed');
    };

    checkWindowStatus();

    // Listen for window state changes
    WindowService.onRepositoryWindowsChanged((repoWindows) => {
      // Build the expected remote URL for this repository
      let owner = entry.github?.owner;
      let repoName = entry.name;
      let remoteUrl = entry.remoteUrl;

      if (!owner && entry.name.includes('/')) {
        const parts = entry.name.split('/');
        owner = parts[0];
        repoName = parts[1];
      }

      if (!owner) {
        owner = 'unknown';
      }

      if (!remoteUrl) {
        remoteUrl = `https://github.com/${owner}/${repoName}`;
      }

      // Find this repository's window in the list
      const repoWindow = repoWindows.find((w) => w.remoteUrl === remoteUrl);
      setWindowState(repoWindow ? repoWindow.state : 'closed');
    });
  }, [entry]);

  const handleOpenInGitHub = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.remoteUrl) {
      // Convert git URL to https URL if needed
      const url = entry.remoteUrl
        .replace(/^git@github\.com:/, 'https://github.com/')
        .replace(/\.git$/, '');
      window.open(url, '_blank');
    }
  };

  const handleToggleSelection = () => {
    // Create a mock GitHub repository object for README viewing
    if (entry.github) {
      const mockRepo = {
        id:
          typeof entry.github.id === 'number'
            ? entry.github.id
            : parseInt(entry.github.id, 10) || 0,
        name: entry.github.name || entry.name,
        full_name: `${entry.github.owner}/${entry.github.name}`,
        owner: {
          login: entry.github.owner,
        },
        description: entry.github.description || null,
        language: entry.github.primaryLanguage || null,
        stargazers_count: entry.github.stars || 0,
        private: entry.github.isPublic === false,
        html_url: entry.remoteUrl || '',
        clone_url: entry.remoteUrl || '',
        default_branch: entry.github.defaultBranch || 'main',
        fork: false,
        updated_at: entry.github.lastUpdated || new Date().toISOString(),
        pushed_at: entry.github.lastCommit || new Date().toISOString(),
      };
      setSelectedRepository(mockRepo);
    }
  };

  const handleOpenLocally = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await WindowService.openRepositoryDashboard(entry);
    } catch (error) {
      console.error('Error opening repository dashboard:', error);
    }
  };

  const isHighlighted = isReadmeSelected;
  const highlightColor = theme.colors.primary;

  // Get avatar URL - use GitHub owner if available
  const avatarUrl = entry.github?.owner
    ? `https://github.com/${entry.github.owner}.png`
    : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        borderRadius: '4px',
        backgroundColor: isHighlighted ? `${highlightColor}15` : 'transparent',
        border: isHighlighted
          ? `1px solid ${highlightColor}40`
          : '1px solid transparent',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
      onClick={handleToggleSelection}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = isHighlighted
          ? `${highlightColor}20`
          : theme.colors.backgroundTertiary || theme.colors.backgroundSecondary;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = isHighlighted
          ? `${highlightColor}15`
          : 'transparent';
      }}
    >
      {/* Owner avatar or placeholder */}
      <div style={{ flexShrink: 0 }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={entry.github?.owner || entry.name}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor:
                theme.colors.backgroundTertiary || theme.colors.border,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
            }}
          >
            {entry.name[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.medium,
              color: theme.colors.text,
            }}
          >
            {entry.name}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: `${theme.fontSizes[0]}px`,
            color: theme.colors.textSecondary,
          }}
        >
          {entry.github?.primaryLanguage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: getLanguageColor(
                    entry.github.primaryLanguage,
                  ),
                }}
              />
              {entry.github.primaryLanguage}
            </div>
          )}
          {entry.github?.description && (
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.github.description}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleOpenLocally}
          title={
            windowState === 'ready'
              ? 'Focus window'
              : windowState === 'opening'
                ? 'Window is opening...'
                : 'Open locally'
          }
          disabled={windowState === 'opening'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 10px',
            gap: '4px',
            borderRadius: '4px',
            border: `1px solid ${theme.colors.success || '#10b981'}`,
            backgroundColor: `${theme.colors.success || '#10b981'}15`,
            color: theme.colors.success || '#10b981',
            fontSize: `${theme.fontSizes[0]}px`,
            fontWeight: theme.fontWeights.medium,
            cursor: windowState === 'opening' ? 'wait' : 'pointer',
            opacity: windowState === 'opening' ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(event) => {
            if (windowState !== 'opening') {
              event.currentTarget.style.backgroundColor = `${theme.colors.success || '#10b981'}25`;
            }
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = `${theme.colors.success || '#10b981'}15`;
          }}
        >
          {windowState === 'ready' ? (
            <Focus size={12} />
          ) : windowState === 'opening' ? (
            <Loader2
              size={12}
              style={{
                animation: 'spin 1s linear infinite',
              }}
            />
          ) : (
            <FolderOpen size={12} />
          )}
          {windowState === 'ready'
            ? 'Focus'
            : windowState === 'opening'
              ? 'Opening...'
              : 'Open'}
        </button>
        {entry.remoteUrl && (
          <button
            type="button"
            onClick={handleOpenInGitHub}
            title="View on GitHub"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary ||
                theme.colors.backgroundSecondary;
              event.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor =
                theme.colors.background;
              event.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

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
