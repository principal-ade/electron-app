import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { FolderOpen, Focus, Loader2, Home, AlertTriangle, MoveRight, X, Copy, Check } from 'lucide-react';
import type { Workspace } from '@a24z/core-library';

import type { RepositoryCacheData } from '../../services/RepositoryDataCache';
import { useSelectedRepository } from '../../contexts/SelectedRepositoryContext';
import { WindowService } from '../../main-process-api/WindowService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { RepositoryAvatar } from '../../components/repository-maps/RepositoryAvatar';

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
  workspace?: Workspace | null;
}

export const LocalProjectCard: React.FC<LocalProjectCardProps> = ({
  repositoryData,
  workspace,
}) => {
  const { theme } = useTheme();
  const { selectedRepository, setSelectedRepository } = useSelectedRepository();
  const entry = repositoryData.repository;
  const [windowState, setWindowState] = useState<'closed' | 'opening' | 'ready'>('closed');
  const [isInWorkspaceDirectory, setIsInWorkspaceDirectory] = useState<boolean | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

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

  // Check if repository is in workspace directory
  useEffect(() => {
    const checkLocation = async () => {
      if (!workspace || !workspace.id) {
        setIsInWorkspaceDirectory(null);
        return;
      }

      try {
        const result = await WorkspaceService.isRepositoryInWorkspaceDirectory(entry, workspace.id);
        setIsInWorkspaceDirectory(result);
      } catch (error) {
        console.error('Failed to check repository location:', error);
        setIsInWorkspaceDirectory(null);
      }
    };

    checkLocation();
  }, [entry, workspace]);

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

  const handleMoveToWorkspace = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!workspace || !workspace.id) return;

    if (!confirm(`Move ${entry.name} to ${workspace.suggestedClonePath}?\n\nThis will move all files to the workspace directory.`)) {
      return;
    }

    try {
      setIsMoving(true);
      const newPath = await WorkspaceService.moveRepositoryToWorkspaceDirectory(entry, workspace.id);

      // Update the entry with the new path so the check reflects the change
      // Type assertion needed because path requires ValidatedRepositoryPath branded type
      entry.path = newPath as typeof entry.path;

      // Refresh the location status
      setIsInWorkspaceDirectory(true);
      alert(`Successfully moved ${entry.name} to workspace directory!`);

      // Events will update all panels automatically - no need for hard reload
    } catch (error) {
      console.error('Failed to move repository:', error);
      alert(`Failed to move repository: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsMoving(false);
    }
  };

  const handleRemoveFromWorkspace = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!workspace || !workspace.id) return;

    if (!confirm(`Remove ${entry.name} from workspace "${workspace.name}"?\n\nThis will not delete any files, only remove the repository from this workspace.`)) {
      return;
    }

    try {
      setIsRemoving(true);
      await WorkspaceService.removeRepositoryFromWorkspace(entry, workspace.id);

      // Events will update all panels automatically - no need for hard reload
    } catch (error) {
      console.error('Failed to remove repository from workspace:', error);
      alert(`Failed to remove repository: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(entry.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (err) {
      console.error('Failed to copy path:', err);
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
      <RepositoryAvatar
        customAvatarUrl={avatarUrl}
        size={32}
        type="owner"
        fallbackIcon={
          <div
            style={{
              color: theme.colors.textSecondary,
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
            }}
          >
            {entry.name[0]?.toUpperCase() || '?'}
          </div>
        }
      />

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
          onClick={handleCopyPath}
          style={{
            fontSize: `${theme.fontSizes[0]}px`,
            color: copiedPath
              ? theme.colors.success || '#10b981'
              : theme.colors.textTertiary || theme.colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'color 0.15s ease',
          }}
          title={copiedPath ? 'Copied!' : `Click to copy: ${entry.path}`}
          onMouseEnter={(event) => {
            if (!copiedPath) {
              event.currentTarget.style.color = theme.colors.textSecondary;
            }
          }}
          onMouseLeave={(event) => {
            if (!copiedPath) {
              event.currentTarget.style.color = theme.colors.textTertiary || theme.colors.textSecondary;
            }
          }}
        >
          {copiedPath ? <Check size={12} /> : <Copy size={12} />}
          {entry.path}
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
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
        {/* Location indicator */}
        {workspace && workspace.suggestedClonePath && isInWorkspaceDirectory !== null && (
          <div
            title={
              isInWorkspaceDirectory
                ? `In workspace directory: ${workspace.suggestedClonePath}`
                : `Outside workspace directory`
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: isInWorkspaceDirectory
                ? `${theme.colors.success || '#10b981'}15`
                : `${theme.colors.warning || '#f59e0b'}15`,
              color: isInWorkspaceDirectory
                ? theme.colors.success || '#10b981'
                : theme.colors.warning || '#f59e0b',
            }}
          >
            {isInWorkspaceDirectory ? <Home size={14} /> : <AlertTriangle size={14} />}
          </div>
        )}

        {/* Move to workspace button */}
        {workspace && workspace.suggestedClonePath && isInWorkspaceDirectory === false && (
          <button
            type="button"
            onClick={handleMoveToWorkspace}
            disabled={isMoving}
            title={`Move to ${workspace.suggestedClonePath}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 10px',
              gap: '4px',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.primary || '#3b82f6'}`,
              backgroundColor: `${theme.colors.primary || '#3b82f6'}15`,
              color: theme.colors.primary || '#3b82f6',
              fontSize: `${theme.fontSizes[0]}px`,
              fontWeight: theme.fontWeights.medium,
              cursor: isMoving ? 'wait' : 'pointer',
              opacity: isMoving ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(event) => {
              if (!isMoving) {
                event.currentTarget.style.backgroundColor = `${theme.colors.primary || '#3b82f6'}25`;
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = `${theme.colors.primary || '#3b82f6'}15`;
            }}
          >
            {isMoving ? (
              <Loader2
                size={12}
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              />
            ) : (
              <MoveRight size={12} />
            )}
            {isMoving ? 'Moving...' : 'Move'}
          </button>
        )}

        {/* Open/Focus button */}
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

        {/* Remove from workspace button */}
        {workspace && (
          <button
            type="button"
            onClick={handleRemoveFromWorkspace}
            disabled={isRemoving}
            title={`Remove from workspace "${workspace.name}"`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              padding: 0,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.colors.textSecondary,
              cursor: isRemoving ? 'wait' : 'pointer',
              opacity: isRemoving ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(event) => {
              if (!isRemoving) {
                event.currentTarget.style.backgroundColor = theme.colors.error || '#ef4444';
                event.currentTarget.style.color = '#fff';
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = 'transparent';
              event.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            {isRemoving ? (
              <Loader2
                size={14}
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              />
            ) : (
              <X size={14} />
            )}
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
