import React from 'react';
import { Layers, Cloud, CloudOff, Terminal } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { BaseTitlebar } from './BaseTitlebar';
import { GitSyncStatusIndicator } from './GitSyncStatusIndicator';
import { RepositoryAvatar } from '../repository-maps/RepositoryAvatar';
import type { Repository } from '../../../shared/types/repository.types';
import type { FileTreeSource } from '../../types/file-tree-source';
import { useRepositoryGitStatus } from '../../hooks/useRepositoryGitStatus';

export interface RepositoryTitlebarSimpleProps {
  repository?: Repository;
  repositoryOwner?: string;
  repositoryName?: string;
  selectedSource?: FileTreeSource | null;
  onShowGitChanges?: () => void;
  // UI Mode toggle
  onSwitchToClassic?: () => void;
  // Terminal implementation toggle
  terminalImplementation?: 'xterm' | 'ghostty';
  onToggleTerminalImplementation?: () => void;
}

export const RepositoryTitlebarSimple: React.FC<
  RepositoryTitlebarSimpleProps
> = ({
  repository,
  repositoryOwner,
  repositoryName,
  selectedSource,
  onShowGitChanges,
  onSwitchToClassic,
  terminalImplementation,
  onToggleTerminalImplementation,
}) => {
  const { theme } = useTheme();

  // Get local clone path for git status
  const localClonePath =
    selectedSource?.type === 'local'
      ? selectedSource.location
      : repository?.localClones?.[0]?.path;

  // Subscribe to git status
  const { gitStatus, gitStatusWithFiles } = useRepositoryGitStatus(
    localClonePath || null,
  );

  // Check if there are uncommitted changes
  const hasUncommittedChanges = gitStatusWithFiles
    ? gitStatusWithFiles.modifiedFiles.length +
        gitStatusWithFiles.untrackedFiles.length +
        gitStatusWithFiles.stagedFiles.length +
        gitStatusWithFiles.createdFiles.length +
        gitStatusWithFiles.deletedFiles.length >
      0
    : false;

  const displayName = repositoryName || repository?.name || 'Repository';
  const displayOwner = repositoryOwner || repository?.owner;

  // Get avatar URL
  const avatarUrl =
    repository?.avatarUrl ||
    (displayOwner ? `https://github.com/${displayOwner}.png` : null);

  return (
    <BaseTitlebar confirmBeforeClose={true}>
      {/* Center: Repository info */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Avatar - left side */}
        <div style={{ width: '28px', height: '28px', flexShrink: 0 }}>
          {repository && (
            <RepositoryAvatar
              repository={repository}
              type="owner"
              size={28}
              customAvatarUrl={avatarUrl}
            />
          )}
        </div>

        {/* Repository name, branch, and sync status */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {/* Repository name and branch */}
          <span
            style={{
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
            }}
          >
            <span
              style={{
                color: theme.colors.text,
                fontWeight: theme.fontWeights.medium,
                cursor: displayOwner ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (displayOwner && displayName) {
                  window.open(
                    `https://github.com/${displayOwner}/${displayName}`,
                    '_blank',
                  );
                }
              }}
              onMouseEnter={(e) => {
                if (displayOwner) {
                  e.currentTarget.style.opacity = '0.7';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              title={
                displayOwner
                  ? `Open ${displayOwner}/${displayName} on GitHub`
                  : undefined
              }
            >
              {displayName}
            </span>

            {/* Branch */}
            {selectedSource?.type === 'local' &&
              selectedSource.metadata?.currentBranch && (
                <>
                  <span
                    style={{
                      color: theme.colors.accent,
                      fontWeight: theme.fontWeights.medium,
                      padding: '0 8px',
                    }}
                  >
                    on
                  </span>
                  <span
                    style={{
                      color: theme.colors.text,
                      fontWeight: theme.fontWeights.medium,
                    }}
                  >
                    {selectedSource.metadata.currentBranch}

                    {/* Uncommitted changes indicator */}
                    {hasUncommittedChanges && onShowGitChanges && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowGitChanges();
                        }}
                        style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: theme.colors.warning,
                          marginLeft: '6px',
                          verticalAlign: 'middle',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                        title="Click to view uncommitted changes"
                      />
                    )}
                  </span>
                </>
              )}
          </span>

          {/* Remote sync status - below repo name */}
          {selectedSource?.type === 'local' &&
            selectedSource.metadata?.currentBranch &&
            gitStatus && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: `${theme.fontSizes[0]}px`,
                }}
              >
                {gitStatus.ahead === 0 && gitStatus.behind === 0 ? (
                  <span
                    style={{
                      color: theme.colors.success,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Cloud size={12} />
                    <span>Synced</span>
                  </span>
                ) : (
                  <span
                    style={{
                      color: theme.colors.warning,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <CloudOff size={12} />
                    <span>
                      {gitStatus.ahead > 0 && gitStatus.behind > 0
                        ? 'Diverged'
                        : gitStatus.ahead > 0
                          ? 'Ahead'
                          : 'Behind'}
                    </span>
                  </span>
                )}
              </span>
            )}
        </div>

        {/* Git-Sync connectivity indicator - right side, mirrors avatar */}
        <div style={{ width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GitSyncStatusIndicator
            repositoryPath={
              selectedSource?.type === 'local'
                ? selectedSource.location
                : undefined
            }
            branch={
              selectedSource?.type === 'local'
                ? selectedSource.metadata?.currentBranch
                : undefined
            }
          />
        </div>
      </div>

      {/* Right: Terminal toggle and mode switch */}
      <div
        style={{
          position: 'absolute',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Terminal Implementation Toggle */}
        {onToggleTerminalImplementation && (
          <button
            onClick={onToggleTerminalImplementation}
            title={`Switch to ${terminalImplementation === 'ghostty' ? 'XTerm' : 'Ghostty'} terminal`}
            style={{
              // @ts-ignore - WebkitAppRegion is not in CSSProperties
              WebkitAppRegion: 'no-drag',
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.medium,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <Terminal size={14} />
            <span>{terminalImplementation === 'ghostty' ? 'Ghostty' : 'XTerm'}</span>
          </button>
        )}
        {onSwitchToClassic && (
          <button
            onClick={onSwitchToClassic}
            title="Switch to Classic mode"
            style={{
              // @ts-ignore - WebkitAppRegion is not in CSSProperties
              WebkitAppRegion: 'no-drag',
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.primary}`,
              color: theme.colors.primary,
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.medium,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.primary;
              e.currentTarget.style.color = theme.colors.background;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.primary;
            }}
          >
            <Layers size={14} />
            <span>Panel Framework</span>
          </button>
        )}
      </div>
    </BaseTitlebar>
  );
};
