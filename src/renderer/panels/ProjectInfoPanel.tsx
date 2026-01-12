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
import { FolderGit2, GitBranch, RefreshCw, AlertCircle } from 'lucide-react';

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
        <p style={{ margin: 0, fontSize: '14px' }}>
          No project selected
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: '12px' }}>
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
          <FolderGit2 size={20} color={theme.colors.primary} />
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Project Info
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
          <h4
            style={{
              margin: `0 0 ${spacing.sm}px 0`,
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Repository
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: theme.colors.textSecondary,
                }}
              >
                Name:
              </span>{' '}
              <span
                style={{
                  fontSize: '12px',
                  color: theme.colors.text,
                }}
              >
                {repository.name}
              </span>
            </div>
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: theme.colors.textSecondary,
                }}
              >
                Path:
              </span>{' '}
              <code
                style={{
                  fontSize: '11px',
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
                  fontSize: '14px',
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
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                Loading git status...
              </p>
            ) : gitData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {/* Branch */}
                {gitData.branch && (
                  <div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      Branch:
                    </span>{' '}
                    <code
                      style={{
                        fontSize: '11px',
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
                )}

                {/* Changes Summary */}
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
                        fontSize: '18px',
                        fontWeight: 600,
                        color: theme.colors.success,
                      }}
                    >
                      {stagedCount}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
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
                        fontSize: '18px',
                        fontWeight: 600,
                        color: theme.colors.warning,
                      }}
                    >
                      {unstagedCount}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
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
                        fontSize: '18px',
                        fontWeight: 600,
                        color: theme.colors.info,
                      }}
                    >
                      {untrackedCount}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: theme.colors.textSecondary,
                        marginTop: '2px',
                      }}
                    >
                      Untracked
                    </div>
                  </div>
                </div>

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
                        fontSize: '11px',
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
                        fontSize: '11px',
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
                  fontSize: '12px',
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
