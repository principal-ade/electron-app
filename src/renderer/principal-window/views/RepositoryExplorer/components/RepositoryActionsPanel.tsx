import React, { useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { AlertCircle, CheckCircle2, Loader2, Play, RefreshCcw, Settings } from 'lucide-react';
import type { FileTree } from '@principal-ai/repository-abstraction';

import { useRepositorySecretsStatus } from '../hooks/useRepositorySecretsStatus';
import type { ActWorkflowAction } from '../../../../../shared/types/act.types';

interface RepositoryActionsPanelProps {
  repoId: string | null | undefined;
  fileTree: FileTree | null;
  onConfigure?: () => void;
  onRun?: (action: ActWorkflowAction) => void;
  /**
   * Allows parents to skip work when the panel is collapsed or hidden.
   */
  isVisible?: boolean;
  runningActionId?: string | null;
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) {
    return null;
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);
  return `${minutes} min${minutes === 1 ? '' : 's'}`;
};

/**
 * Extract workflow actions from FileTree by filtering for .github/workflows/*.{yml,yaml} files
 */
const extractWorkflowActionsFromTree = (fileTree: FileTree | null): ActWorkflowAction[] => {
  if (!fileTree?.allFiles) {
    return [];
  }

  const workflowFiles = fileTree.allFiles.filter(file => {
    const path = file.path.toLowerCase();
    return path.includes('.github/workflows/') && (path.endsWith('.yml') || path.endsWith('.yaml'));
  });

  return workflowFiles.map(file => {
    const fileName = file.path.split('/').pop() || file.path;
    const baseName = fileName.replace(/\.(yml|yaml)$/i, '');

    // Generate a readable label from the filename
    const label = baseName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      id: file.path,
      label,
      description: `Workflow defined in ${fileName}`,
      workflowPath: file.path,
      requiresSecrets: true, // Conservative default - assume secrets needed
    };
  });
};

export const RepositoryActionsPanel: React.FC<RepositoryActionsPanelProps> = ({
  repoId,
  fileTree,
  onConfigure,
  onRun,
  isVisible = true,
  runningActionId,
}) => {
  const { theme } = useTheme();
  const { isConfigured, isLoading, error, refresh } = useRepositorySecretsStatus(repoId, {
    skip: !isVisible,
  });

  // Extract actions from the FileTree
  const actions = useMemo(() => extractWorkflowActionsFromTree(fileTree), [fileTree]);

  const hasActions = actions.length > 0;
  const isBusy = isLoading;

  const statusIndicator = useMemo(() => {
    if (!repoId) {
      return {
        icon: <AlertCircle size={16} color={theme.colors.textSecondary} />,
        text: 'Select a repository to manage workflow actions.',
        tone: theme.colors.textSecondary,
      };
    }

    if (error) {
      return {
        icon: <AlertCircle size={16} color={theme.colors.danger} />,
        text: 'Unable to verify secrets configuration.',
        tone: theme.colors.danger,
      };
    }

    if (isLoading) {
      return {
        icon: <Loader2 size={16} className="spin" color={theme.colors.textSecondary} />,
        text: 'Checking repository secrets…',
        tone: theme.colors.textSecondary,
      };
    }

    if (isConfigured) {
      return {
        icon: <CheckCircle2 size={16} color={theme.colors.success} />,
        text: 'Secrets configured for this repository.',
        tone: theme.colors.success,
      };
    }

    return {
      icon: <AlertCircle size={16} color={theme.colors.warning} />,
      text: 'Secrets are not configured yet.',
      tone: theme.colors.warning,
    };
    }, [repoId, error, isLoading, isConfigured, theme]);

  const handleConfigureClick = () => {
    onConfigure?.();
  };

  const handleRunClick = (action: ActWorkflowAction) => {
    if (!onRun) {
      return;
    }

    const confirmed = window.confirm(`Run the "${action.label}" action?`);
    if (confirmed) {
      onRun(action);
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: theme.colors.textPrimary,
          }}
        >
          Workflow Actions
        </div>
        {repoId ? (
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={isBusy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.textSecondary,
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {isBusy ? <Loader2 size={16} className="spin" /> : <RefreshCcw size={16} />}
            {isBusy ? 'Checking…' : 'Re-check'}
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: statusIndicator.tone,
        }}
      >
        {statusIndicator.icon}
        <span>{statusIndicator.text}</span>
      </div>

      {!hasActions ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: theme.colors.textSecondary,
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '10px',
            padding: '24px',
          }}
        >
          {!fileTree
            ? 'Loading repository files…'
            : repoId
              ? 'No workflow files found in .github/workflows/'
              : 'Select a repository to preview available workflow actions.'}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {actions.map(action => {
            const requiresSecrets = action.requiresSecrets !== false;
            const isActionRunning = runningActionId === action.id;
            const canRun = (!requiresSecrets || isConfigured) && Boolean(onRun) && !isActionRunning;
            const showConfigure = requiresSecrets && !isConfigured;
            const durationLabel = formatDuration(action.estimatedDurationSeconds);

            return (
              <div
                key={action.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: theme.colors.textPrimary,
                      }}
                    >
                      {action.label}
                    </div>
                    {action.description ? (
                      <div
                        style={{
                          color: theme.colors.textSecondary,
                          marginTop: '4px',
                        }}
                      >
                        {action.description}
                      </div>
                    ) : null}
                    {durationLabel ? (
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Estimated runtime: {durationLabel}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                    }}
                  >
                    {showConfigure ? (
                      <button
                        type="button"
                        onClick={handleConfigureClick}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: theme.colors.warning,
                          color: theme.colors.background,
                          cursor: onConfigure ? 'pointer' : 'not-allowed',
                          opacity: onConfigure ? 1 : 0.6,
                        }}
                        disabled={!onConfigure}
                      >
                        <Settings size={16} />
                        Configure
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRunClick(action)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: canRun
                            ? theme.colors.accent
                            : theme.colors.backgroundSecondary,
                          color: canRun ? theme.colors.background : theme.colors.textSecondary,
                          cursor: canRun ? 'pointer' : 'not-allowed',
                          opacity: canRun ? 1 : 0.6,
                        }}
                        disabled={!canRun}
                      >
                        {isActionRunning ? (
                          <Loader2 size={16} className="spin" />
                        ) : (
                          <Play size={16} />
                        )}
                        {isActionRunning ? 'Running…' : 'Run'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
