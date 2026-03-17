/**
 * ProjectInfoPanel
 *
 * Displays information about the current project including repository details
 * and git status. This panel will eventually be moved to its own package.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { getTracer } from '../telemetry';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';
import type { RepositoryPanelActions } from '../contexts/RepositoryPanelContext';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { FolderGit2, GitBranch, RefreshCw, AlertCircle, Trash2, FolderOpen } from 'lucide-react';
import { LocalProjectCard } from '@industry-theme/repository-composition-panels';

interface ProjectInfoPanelContext extends PanelContextValue {
  gitStatusWithFiles?: DataSlice<GitStatusWithFiles | null>;
}

interface ProjectInfoPanelActions extends PanelActions {
  getFileCityImage: (repoPath: string) => Promise<string | null>;
}

interface ProjectInfoPanelProps {
  context: ProjectInfoPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
}

export const ProjectInfoPanel: React.FC<ProjectInfoPanelProps> = ({
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [fileCityImageUrl, setFileCityImageUrl] = useState<string | null>(null);

  // Cast actions to include our extended type
  const extendedActions = actions as ProjectInfoPanelActions;

  // Get repository info from context
  const repository = context.currentScope?.repository;

  // Get git status from context slice
  const gitSlice = context.gitStatusWithFiles;
  const hasGitData = gitSlice !== undefined;
  const isGitLoading = gitSlice?.loading ?? false;

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

  // Handle open project
  const handleOpenProject = async () => {
    // Type assertion: actions may be RepositoryPanelActions at runtime
    const repoActions = actions as RepositoryPanelActions;
    if (repository && repoActions.openLocalRepository) {
      try {
        // In ProjectsView context, repository is actually the full AlexandriaEntry
        // (see ProjectsPanelContext where currentScope.repository = selectedRepository)
        // TODO: Check with @principal-ade/panel-framework-core about extending RepositoryMetadata
        // to support richer repository types like AlexandriaEntry, or making it generic
        await repoActions.openLocalRepository(repository as unknown as AlexandriaEntry);
      } catch (error) {
        console.error('Failed to open project:', error);
      }
    }
  };

  // Handle delete request
  const handleDeleteRequest = () => {
    if (repository) {
      // Check if repo has uncommitted changes or is not synced
      const gitData = gitSlice?.data;
      const stagedCount = gitData?.stagedFiles?.length || 0;
      const unstagedCount = gitData?.modifiedFiles?.length || 0;
      const untrackedCount = gitData?.untrackedFiles?.length || 0;
      const totalChanges = stagedCount + unstagedCount + untrackedCount;
      const ahead = gitData?.ahead || 0;
      const behind = gitData?.behind || 0;
      const isSynced = ahead === 0 && behind === 0;
      const isClean = totalChanges === 0 && isSynced;

      // Show warning modal if not clean
      if (!isClean) {
        setShowWarningModal(true);
        return;
      }

      // Proceed with delete request
      events.emit({
        type: 'project-info:delete-requested',
        source: 'project-info-panel',
        timestamp: Date.now(),
        payload: {
          repository,
          gitStatus: gitData,
        },
      });
    }
  };

  // Handle delete confirmation from warning modal
  const handleDeleteConfirmation = () => {
    setShowWarningModal(false);
    if (repository) {
      const gitData = gitSlice?.data;
      events.emit({
        type: 'project-info:delete-requested',
        source: 'project-info-panel',
        timestamp: Date.now(),
        payload: {
          repository,
          gitStatus: gitData,
        },
      });
    }
  };

  // Get GitHub URL from repository
  const getGitHubUrl = (): string | null => {
    if (!repository) return null;

    // Try using github metadata first
    const repoWithMetadata = repository as { github?: { owner: string; name: string }; remoteUrl?: string };
    if (repoWithMetadata.github?.owner && repoWithMetadata.github?.name) {
      return `https://github.com/${repoWithMetadata.github.owner}/${repoWithMetadata.github.name}`;
    }

    // Fall back to parsing remoteUrl
    if (repoWithMetadata.remoteUrl) {
      const url = repoWithMetadata.remoteUrl;
      // Handle https://github.com/owner/repo.git
      const httpsMatch = url.match(new RegExp('https://github\\.com/([^/]+)/([^/.]+)'));
      if (httpsMatch) {
        return `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`;
      }
      // Handle git@github.com:owner/repo.git
      const sshMatch = url.match(new RegExp('git@github\\.com:([^/]+)/([^/.]+)'));
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

  // Store span ref so we can add events across useEffects
  const fileCitySpanRef = useRef<ReturnType<ReturnType<typeof getTracer>['startSpan']> | null>(null);
  const lastRenderedUrlRef = useRef<string | null>(null);

  // Fetch File City image when repository changes
  useEffect(() => {
    const tracer = getTracer('file-city-renderer');

    if (repository?.path) {
      const repoPath = repository.path;

      // Start span and store in ref
      const span = tracer.startSpan('file_city.renderer.fetch_image');
      fileCitySpanRef.current = span;

      // Event: Action called
      span.addEvent('file_city.renderer.action_called', {
        repo_path: repoPath,
      });

      console.info('[ProjectInfoPanel] Fetching File City image for:', repoPath);

      extendedActions.getFileCityImage(repoPath).then((url) => {
        // Event: URL received
        span.addEvent('file_city.renderer.url_received', {
          repo_path: repoPath,
          has_url: url !== null,
          url: url ?? 'null',
        });

        console.info('[ProjectInfoPanel] File City image URL:', url);
        setFileCityImageUrl(url);

        // Event: State updated
        span.addEvent('file_city.renderer.state_updated', {
          repo_path: repoPath,
          url: url ?? 'null',
        });

        // Don't end span here - wait for card_rendered event
      }).catch((error) => {
        span.addEvent('file_city.renderer.error', {
          repo_path: repoPath,
          error: error instanceof Error ? error.message : String(error),
        });
        span.end();
        fileCitySpanRef.current = null;
      });
    } else {
      setFileCityImageUrl(null);
    }
  }, [repository?.path, extendedActions]);

  // Track when card renders with image URL - adds event to the same span
  useEffect(() => {
    if (repository?.path && fileCityImageUrl !== lastRenderedUrlRef.current) {
      const span = fileCitySpanRef.current;
      if (span) {
        span.addEvent('file_city.renderer.card_rendered', {
          repo_path: repository.path,
          has_custom_image: fileCityImageUrl !== null,
          image_url: fileCityImageUrl ?? 'null',
        });
        span.end();
        fileCitySpanRef.current = null;
      }
      lastRenderedUrlRef.current = fileCityImageUrl;
      console.info('[ProjectInfoPanel] Card rendered with image:', fileCityImageUrl);
    }
  }, [repository?.path, fileCityImageUrl]);

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
  const stagedCount = gitData?.stagedFiles?.length || 0;
  const unstagedCount = gitData?.modifiedFiles?.length || 0;
  const untrackedCount = gitData?.untrackedFiles?.length || 0;
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
          {(() => {
            const githubOwner = (repository as { github?: { owner?: string } }).github?.owner;
            return githubOwner ? (
            <>
              <img
                src={`https://github.com/${githubOwner}.png`}
                alt={`${githubOwner} avatar`}
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
            );
          })()}
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
          {githubUrl && (
            <button
              onClick={handleOpenInGitHub}
              style={{
                padding: `${spacing.xs}px ${spacing.sm}px`,
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: borderRadius,
                background: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              }}
            >
              Open in GitHub
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
          <button
            onClick={handleOpenProject}
            style={{
              padding: `${spacing.xs}px ${spacing.sm}px`,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: borderRadius,
              background: theme.colors.primary,
              color: theme.colors.background,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <FolderOpen size={14} />
            Open
          </button>
          <button
            onClick={handleDeleteRequest}
            style={{
              padding: `${spacing.xs}px ${spacing.sm}px`,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              border: `1px solid ${theme.colors.error}`,
              borderRadius: borderRadius,
              background: 'transparent',
              color: theme.colors.error,
              cursor: 'pointer',
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
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        {/* File City Card and Git Status - Side by Side */}
        <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
          {/* File City Card - Left */}
          <div style={{ flexShrink: 0 }}>
            <LocalProjectCard
              entry={repository as unknown as AlexandriaEntry}
              customImageUrl={fileCityImageUrl ?? undefined}
              width={280}
              height={467}
              onOpen={() => handleOpenProject()}
            />
          </div>

          {/* Git Status - Right */}
          {hasGitData && (
            <section
              style={{
                flex: 1,
                padding: spacing.md,
                background: theme.colors.backgroundSecondary,
                borderRadius: borderRadius,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.sm,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
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
                  background: theme.colors.background,
                  color: theme.colors.text,
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  opacity: isRefreshing ? 0.6 : 1,
                  fontSize: theme.fontSizes[1],
                }}
              >
                <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </button>
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
      </div>

      {/* Warning Modal */}
      {showWarningModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowWarningModal(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: borderRadius * 2,
              padding: spacing.lg,
              maxWidth: '500px',
              width: '90%',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <AlertCircle size={24} color={theme.colors.warning} />
              <h3
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[4],
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Warning: Uncommitted Changes
              </h3>
            </div>

            {/* Content */}
            <div style={{ marginBottom: spacing.lg }}>
              <p
                style={{
                  margin: 0,
                  marginBottom: spacing.md,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.text,
                  lineHeight: 1.5,
                }}
              >
                This repository has uncommitted changes or is not synced with the remote.
              </p>

              {/* Status details */}
              <div
                style={{
                  padding: spacing.md,
                  backgroundColor: theme.colors.background,
                  borderRadius: borderRadius,
                  border: `1px solid ${theme.colors.border}`,
                  marginBottom: spacing.md,
                }}
              >
                {totalChanges > 0 && (
                  <div style={{ marginBottom: spacing.xs }}>
                    <span
                      style={{
                        fontSize: theme.fontSizes[2],
                        color: theme.colors.warning,
                        fontWeight: 500,
                      }}
                    >
                      • {totalChanges} uncommitted {totalChanges === 1 ? 'file' : 'files'}
                    </span>
                    <div style={{ marginLeft: spacing.md, marginTop: spacing.xs }}>
                      {stagedCount > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {stagedCount} staged
                        </div>
                      )}
                      {unstagedCount > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {unstagedCount} modified
                        </div>
                      )}
                      {untrackedCount > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {untrackedCount} untracked
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!isSynced && (
                  <div>
                    <span
                      style={{
                        fontSize: theme.fontSizes[2],
                        color: theme.colors.warning,
                        fontWeight: 500,
                      }}
                    >
                      • Not synced with remote
                    </span>
                    <div style={{ marginLeft: spacing.md, marginTop: spacing.xs }}>
                      {ahead > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {ahead} {ahead === 1 ? 'commit' : 'commits'} ahead
                        </div>
                      )}
                      {behind > 0 && (
                        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                          {behind} {behind === 1 ? 'commit' : 'commits'} behind
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.error,
                  fontWeight: 500,
                }}
              >
                Deleting this repository will permanently remove all uncommitted changes.
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowWarningModal(false)}
                style={{
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: borderRadius,
                  background: theme.colors.background,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[2],
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.background;
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmation}
                style={{
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: borderRadius,
                  background: theme.colors.error,
                  color: theme.colors.background,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[2],
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

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
