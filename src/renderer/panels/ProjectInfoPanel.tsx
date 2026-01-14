/**
 * ProjectInfoPanel
 *
 * Displays information about the current project including repository details
 * and git status. This panel will eventually be moved to its own package.
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import { FolderGit2, GitBranch, RefreshCw, AlertCircle, Trash2, ExternalLink } from 'lucide-react';

interface ProjectInfoPanelProps {
  context: PanelContextValue;
  actions: PanelActions;
  events: PanelEventEmitter;
}

interface GitStatusData {
  branch?: string;
  staged?: string[];
  unstaged?: string[];
  untracked?: string[];
  ahead?: number;
  behind?: number;
}

export const ProjectInfoPanel: React.FC<ProjectInfoPanelProps> = ({
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get repository info from context
  const repository = context.currentScope?.repository;

  // Get git status from context slice
  const gitSlice = context.getSlice<GitStatusData>('git');
  const hasGitData = context.hasSlice('git');
  const isGitLoading = context.isSliceLoading('git');

  // Use theme space array or fallback values
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  const borderRadius = theme.radii?.[1] || 4;

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await context.refresh();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle delete request
  const handleDeleteRequest = () => {
    if (repository) {
      events.emit({
        type: 'project-info:delete-requested',
        source: 'project-info-panel',
        timestamp: Date.now(),
        payload: {
          repository,
          gitStatus: gitData ? {
            branch: gitData.branch,
            staged: gitData.staged,
            unstaged: gitData.unstaged,
            untracked: gitData.untracked,
            ahead: gitData.ahead,
            behind: gitData.behind,
          } : undefined,
        },
      });
    }
  };

  // Get GitHub URL from repository
  const getGitHubUrl = (): string | null => {
    if (!repository) return null;

    // Try using github metadata first
    if ((repository as any).github?.owner && (repository as any).github?.name) {
      return `https://github.com/${(repository as any).github.owner}/${(repository as any).github.name}`;
    }

    // Fall back to parsing remoteUrl
    if ((repository as any).remoteUrl) {
      const url = (repository as any).remoteUrl as string;
      // Handle https://github.com/owner/repo.git
      const httpsMatch = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/\.]+)/);
      if (httpsMatch) {
        return `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`;
      }
      // Handle git@github.com:owner/repo.git
      const sshMatch = url.match(/git@github\.com:([^\/]+)\/([^\/\.]+)/);
      if (sshMatch) {
        return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
      }
    }

    return null;
  };

  // Handle open in GitHub
  const handleOpenInGitHub = () => {
    const githubUrl = getGitHubUrl();
    if (githubUrl) {
      window.open(githubUrl, '_blank');
    }
  };

  const githubUrl = getGitHubUrl();

  // Subscribe to events
  useEffect(() => {
    const unsubscribers = [
      events.on('file:opened', () => {
        // Could update project info when files are opened
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [events]);

  // No repository selected
  if (!repository) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <FolderGit2
          size={48}
          style={{ marginBottom: spacing.md, opacity: 0.5 }}
        />
        <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
          No project selected
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[2] }}>
          Select a project from the left panel to view its information
        </p>
      </div>
    );
  }

  const gitData = gitSlice?.data;
  const stagedCount = gitData?.staged?.length || 0;
  const unstagedCount = gitData?.unstaged?.length || 0;
  const untrackedCount = gitData?.untracked?.length || 0;
  const totalChanges = stagedCount + unstagedCount + untrackedCount;
  const ahead = gitData?.ahead || 0;
  const behind = gitData?.behind || 0;
  const isSynced = ahead === 0 && behind === 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          {(repository as any).github?.owner ? (
            <>
              <img
                src={`https://github.com/${(repository as any).github.owner}.png`}
                alt={`${(repository as any).github.owner} avatar`}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  e.currentTarget.style.display = 'none';
                  const fallbackIcon = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallbackIcon) fallbackIcon.style.display = 'block';
                }}
              />
              <FolderGit2
                size={20}
                color={theme.colors.primary}
                style={{ display: 'none' }}
              />
            </>
          ) : (
            <FolderGit2 size={20} color={theme.colors.primary} />
          )}
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            {repository.name}
          </h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            padding: `${spacing.xs}px ${spacing.sm}px`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: borderRadius,
            background: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            opacity: isRefreshing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        {/* Repository Information */}
        <section
          style={{
            padding: spacing.md,
            marginBottom: spacing.md,
            background: theme.colors.backgroundSecondary,
            borderRadius: borderRadius,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {(repository as any).github?.owner && (
              <div>
                <span
                  style={{
                    fontSize: theme.fontSizes[2],
                    fontWeight: 500,
                    color: theme.colors.textSecondary,
                  }}
                >
                  Owner:
                </span>{' '}
                <span
                  style={{
                    fontSize: theme.fontSizes[2],
                    color: theme.colors.text,
                  }}
                >
                  {(repository as any).github.owner}
                </span>
              </div>
            )}
            <div>
              <span
                style={{
                  fontSize: theme.fontSizes[2],
                  fontWeight: 500,
                  color: theme.colors.textSecondary,
                }}
              >
                Path:
              </span>{' '}
              <code
                style={{
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.monospace,
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.background,
                  padding: '2px 4px',
                  borderRadius: '2px',
                }}
              >
                {repository.path}
              </code>
            </div>

            {/* Open in GitHub button */}
            {githubUrl && (
              <div style={{ marginTop: spacing.sm }}>
                <button
                  onClick={handleOpenInGitHub}
                  style={{
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: borderRadius,
                    background: theme.colors.background,
                    color: theme.colors.primary,
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[1],
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.primary;
                    e.currentTarget.style.color = theme.colors.background;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.background;
                    e.currentTarget.style.color = theme.colors.primary;
                  }}
                >
                  <ExternalLink size={14} />
                  Open in GitHub
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Git Status */}
        {hasGitData && (
          <section
            style={{
              padding: spacing.md,
              marginBottom: spacing.md,
              background: theme.colors.backgroundSecondary,
              borderRadius: borderRadius,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                marginBottom: spacing.sm,
              }}
            >
              <GitBranch size={16} color={theme.colors.primary} />
              <h4
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Git Status
              </h4>
            </div>

            {isGitLoading ? (
              <p
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.textSecondary,
                }}
              >
                Loading git status...
              </p>
            ) : gitData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {/* Branch */}
                {gitData.branch && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                    <div>
                      <span
                        style={{
                          fontSize: theme.fontSizes[2],
                          fontWeight: 500,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Branch:
                      </span>{' '}
                      <code
                        style={{
                          fontSize: theme.fontSizes[1],
                          fontFamily: theme.fonts.monospace,
                          color: theme.colors.primary,
                          backgroundColor: theme.colors.background,
                          padding: '2px 6px',
                          borderRadius: '2px',
                        }}
                      >
                        {gitData.branch}
                      </code>
                    </div>
                    {/* Sync status */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        fontSize: theme.fontSizes[1],
                      }}
                    >
                      {isSynced ? (
                        <>
                          <div
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: theme.colors.success,
                            }}
                          />
                          <span style={{ color: theme.colors.textSecondary }}>
                            Up to date with remote
                          </span>
                        </>
                      ) : (
                        <>
                          {ahead > 0 && (
                            <span
                              style={{
                                color: theme.colors.info,
                                fontWeight: 500,
                              }}
                            >
                              ↑ {ahead} {ahead === 1 ? 'commit' : 'commits'} ahead
                            </span>
                          )}
                          {ahead > 0 && behind > 0 && (
                            <span style={{ color: theme.colors.textSecondary }}>•</span>
                          )}
                          {behind > 0 && (
                            <span
                              style={{
                                color: theme.colors.warning,
                                fontWeight: 500,
                              }}
                            >
                              ↓ {behind} {behind === 1 ? 'commit' : 'commits'} behind
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Changes Summary - only show if there are changes */}
                {totalChanges > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: spacing.xs,
                      marginTop: spacing.xs,
                    }}
                  >
                    <div
                      style={{
                        padding: spacing.xs,
                        backgroundColor: theme.colors.background,
                        borderRadius: borderRadius,
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: theme.fontSizes[4],
                          fontWeight: 600,
                          color: theme.colors.success,
                        }}
                      >
                        {stagedCount}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          marginTop: '2px',
                        }}
                      >
                        Staged
                      </div>
                    </div>
                    <div
                      style={{
                        padding: spacing.xs,
                        backgroundColor: theme.colors.background,
                        borderRadius: borderRadius,
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: theme.fontSizes[4],
                          fontWeight: 600,
                          color: theme.colors.warning,
                        }}
                      >
                        {unstagedCount}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          marginTop: '2px',
                        }}
                      >
                        Modified
                      </div>
                    </div>
                    <div
                      style={{
                        padding: spacing.xs,
                        backgroundColor: theme.colors.background,
                        borderRadius: borderRadius,
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: theme.fontSizes[4],
                          fontWeight: 600,
                          color: theme.colors.info,
                        }}
                      >
                        {untrackedCount}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          marginTop: '2px',
                        }}
                      >
                        Untracked
                      </div>
                    </div>
                  </div>
                )}

                {/* Status message */}
                {totalChanges === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                      marginTop: spacing.xs,
                      padding: spacing.xs,
                      backgroundColor: theme.colors.background,
                      borderRadius: borderRadius,
                    }}
                  >
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: theme.colors.success,
                      }}
                    />
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                      }}
                    >
                      Working tree clean
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                      marginTop: spacing.xs,
                      padding: spacing.xs,
                      backgroundColor: theme.colors.background,
                      borderRadius: borderRadius,
                    }}
                  >
                    <AlertCircle size={12} color={theme.colors.warning} />
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {totalChanges} {totalChanges === 1 ? 'file' : 'files'} with changes
                    </span>
                  </div>
                )}

                {/* Delete button - only show when repo is clean and up to date */}
                {isSynced && totalChanges === 0 && (
                  <button
                    onClick={handleDeleteRequest}
                    style={{
                      marginTop: spacing.sm,
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.xs,
                      width: '100%',
                      border: `1px solid ${theme.colors.error}`,
                      borderRadius: borderRadius,
                      background: 'transparent',
                      color: theme.colors.error,
                      cursor: 'pointer',
                      fontSize: theme.fontSizes[2],
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.error;
                      e.currentTarget.style.color = theme.colors.background;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.colors.error;
                    }}
                  >
                    <Trash2 size={16} />
                    Delete Repository
                  </button>
                )}
              </div>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.textSecondary,
                }}
              >
                No git data available
              </p>
            )}
          </section>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
