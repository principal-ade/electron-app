import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ExternalLink,
  Star,
  FolderOpen,
  Download,
  Folder,
  Cloud,
  Layers,
  Check,
  Loader2,
  Focus,
} from 'lucide-react';

import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { useSelectedRepository } from '../../contexts/SelectedRepositoryContext';
import { WindowService } from '../../main-process-api/WindowService';
import { GitCloneModal } from '../../components/GitCloneModal';
import type { EnhancedAlexandriaEntry } from '../../../shared/types/repository.types';
import type { RepositoryCacheData } from '../../services/RepositoryDataCache';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import type { Workspace } from '@a24z/core-library';

// Add spin animation styles to document if not already present
if (typeof document !== 'undefined') {
  const styleId = 'github-repository-card-animations';
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

interface GitHubRepositoryCardProps {
  repository: GitHubRepository;
  variant: 'owned' | 'starred';
  localRepo?: RepositoryCacheData;
}

export const GitHubRepositoryCard: React.FC<GitHubRepositoryCardProps> = ({
  repository,
  variant,
  localRepo,
}) => {
  const { theme } = useTheme();
  const { selectedRepository, setSelectedRepository } = useSelectedRepository();
  const isStarred = variant === 'starred';
  const isReadmeSelected = selectedRepository?.id === repository.id;
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [repositoryWorkspaces, setRepositoryWorkspaces] = useState<Set<string>>(new Set());
  const [windowState, setWindowState] = useState<'closed' | 'opening' | 'ready'>('closed');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const badgeColor = isStarred
    ? theme.colors.warning || '#f59e0b'
    : theme.colors.primary;

  const handleOpenInGitHub = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(repository.html_url, '_blank');
  };

  const handleToggleSelection = () => {
    // Set as selected repository to show README
    setSelectedRepository(repository);
  };

  const handleOpenOrClone = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (localRepo) {
      // Repository exists locally - open dashboard
      setWindowState('opening');
      try {
        await WindowService.openRepositoryDashboard(localRepo.repository);
      } catch (error) {
        console.error('Error opening repository dashboard:', error);
        setWindowState('closed');
      }
    } else {
      // Repository not cloned - trigger clone
      setShowCloneModal(true);
    }
  };

  const handleRepositoryCloned = async (
    repo: EnhancedAlexandriaEntry,
  ): Promise<void> => {
    // Close the modal
    setShowCloneModal(false);

    // Automatically open the newly cloned repository
    // Note: The localRepo will be updated automatically via useAllRepositories cache subscription
    try {
      await WindowService.openRepositoryDashboard(repo);
    } catch (error) {
      console.error('Error opening cloned repository dashboard:', error);
    }
  };

  const handleToggleWorkspaceDropdown = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!showWorkspaceDropdown) {
      // Load workspaces when opening dropdown
      try {
        const [allWorkspaces, repoWorkspaces] = await Promise.all([
          WorkspaceService.getWorkspaces(),
          localRepo ? WorkspaceService.getRepositoryWorkspaces(localRepo.repository) : Promise.resolve([]),
        ]);

        setWorkspaces(allWorkspaces);
        setRepositoryWorkspaces(new Set(repoWorkspaces.map(w => w.id)));
      } catch (error) {
        console.error('Error loading workspaces:', error);
      }
    }

    setShowWorkspaceDropdown(!showWorkspaceDropdown);
  };

  const handleAddToWorkspace = async (e: React.MouseEvent, workspace: Workspace) => {
    e.stopPropagation();

    if (!localRepo) return;

    try {
      const isInWorkspace = repositoryWorkspaces.has(workspace.id);

      if (isInWorkspace) {
        // Remove from workspace
        await WorkspaceService.removeRepositoryFromWorkspace(localRepo.repository, workspace.id);
        setRepositoryWorkspaces(prev => {
          const next = new Set(prev);
          next.delete(workspace.id);
          return next;
        });
      } else {
        // Add to workspace
        await WorkspaceService.addRepositoryToWorkspace(localRepo.repository, workspace.id);
        setRepositoryWorkspaces(prev => new Set(prev).add(workspace.id));
      }
    } catch (error) {
      console.error('Error updating workspace membership:', error);
    }
  };

  // Subscribe to repository window state changes
  useEffect(() => {
    if (!localRepo) {
      setWindowState('closed');
      return;
    }

    // Initial check
    const checkWindowStatus = async () => {
      const isOpen = await WindowService.isRepositoryWindowOpen(localRepo.repository);
      setWindowState(isOpen ? 'ready' : 'closed');
    };

    checkWindowStatus();

    // Listen for window state changes
    WindowService.onRepositoryWindowsChanged((repoWindows) => {
      const entry = localRepo.repository;
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

      const repoWindow = repoWindows.find((w) => w.remoteUrl === remoteUrl);
      setWindowState(repoWindow ? repoWindow.state : 'closed');
    });
  }, [localRepo]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowWorkspaceDropdown(false);
      }
    };

    if (showWorkspaceDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showWorkspaceDropdown]);

  const starCount = repository.stargazers_count ?? 0;

  const isHighlighted = isReadmeSelected;
  const highlightColor = theme.colors.primary;

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
      {/* Status indicator */}
      <div style={{ flexShrink: 0 }}>
        {localRepo ? (
          <Folder size={16} color={theme.colors.success || '#10b981'} />
        ) : (
          <Cloud size={16} color={theme.colors.textSecondary} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.medium,
              color: localRepo
                ? theme.colors.success || '#10b981'
                : theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repository.name}
          </span>
          {isStarred && (
            <Star
              size={12}
              fill={theme.colors.warning || '#f59e0b'}
              color={theme.colors.warning || '#f59e0b'}
            />
          )}
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
          {repository.language && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: getLanguageColor(repository.language),
                }}
              />
              {repository.language}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Star size={10} />
            {starCount.toLocaleString()}
          </div>
          {repository.description && (
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {repository.description}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleOpenOrClone}
          title={
            localRepo
              ? windowState === 'ready'
                ? 'Focus window'
                : windowState === 'opening'
                  ? 'Window is opening...'
                  : 'Open locally'
              : 'Clone repository'
          }
          disabled={windowState === 'opening'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 10px',
            gap: '4px',
            borderRadius: '4px',
            border: `1px solid ${localRepo ? badgeColor : theme.colors.border}`,
            backgroundColor: localRepo
              ? `${badgeColor}15`
              : theme.colors.background,
            color: localRepo ? badgeColor : theme.colors.text,
            fontSize: `${theme.fontSizes[0]}px`,
            fontWeight: theme.fontWeights.medium,
            cursor: windowState === 'opening' ? 'wait' : 'pointer',
            opacity: windowState === 'opening' ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(event) => {
            if (windowState !== 'opening') {
              event.currentTarget.style.backgroundColor = localRepo
                ? `${badgeColor}25`
                : theme.colors.backgroundTertiary ||
                  theme.colors.backgroundSecondary;
            }
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = localRepo
              ? `${badgeColor}15`
              : theme.colors.background;
          }}
        >
          {localRepo ? (
            windowState === 'ready' ? (
              <Focus size={12} />
            ) : windowState === 'opening' ? (
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <FolderOpen size={12} />
            )
          ) : (
            <Download size={12} />
          )}
          {localRepo
            ? windowState === 'ready'
              ? 'Focus'
              : windowState === 'opening'
                ? 'Opening...'
                : 'Open'
            : 'Clone'}
        </button>

        {/* Add to Workspace button - only show for cloned repos */}
        {localRepo && (
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              onClick={handleToggleWorkspaceDropdown}
              title="Add to workspace"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: showWorkspaceDropdown
                  ? theme.colors.backgroundTertiary || theme.colors.backgroundSecondary
                  : theme.colors.background,
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(event) => {
                if (!showWorkspaceDropdown) {
                  event.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary ||
                    theme.colors.backgroundSecondary;
                  event.currentTarget.style.color = theme.colors.text;
                }
              }}
              onMouseLeave={(event) => {
                if (!showWorkspaceDropdown) {
                  event.currentTarget.style.backgroundColor = theme.colors.background;
                  event.currentTarget.style.color = theme.colors.textSecondary;
                }
              }}
            >
              <Layers size={12} />
            </button>

            {/* Workspace dropdown */}
            {showWorkspaceDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  minWidth: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  padding: '4px',
                }}
              >
                {workspaces.length === 0 ? (
                  <div
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: theme.colors.textSecondary,
                      fontSize: `${theme.fontSizes[0]}px`,
                    }}
                  >
                    No workspaces available
                  </div>
                ) : (
                  workspaces.map((workspace) => {
                    const isInWorkspace = repositoryWorkspaces.has(workspace.id);
                    return (
                      <button
                        key={workspace.id}
                        type="button"
                        onClick={(e) => handleAddToWorkspace(e, workspace)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: theme.colors.text,
                          fontSize: `${theme.fontSizes[1]}px`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.backgroundColor =
                            theme.colors.backgroundTertiary ||
                            theme.colors.backgroundSecondary;
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '2px',
                              backgroundColor: workspace.color || theme.colors.primary,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {workspace.name}
                          </span>
                        </div>
                        {isInWorkspace && (
                          <Check size={14} color={theme.colors.success || '#10b981'} />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

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
            event.currentTarget.style.backgroundColor = theme.colors.background;
            event.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <ExternalLink size={12} />
        </button>
      </div>

      {/* Clone Modal */}
      {showCloneModal &&
        createPortal(
          <GitCloneModal
            isOpen={showCloneModal}
            onClose={() => setShowCloneModal(false)}
            onRepositoryAdded={handleRepositoryCloned}
            initialUrl={repository.clone_url}
          />,
          document.body,
        )}
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
