import React, { useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { AlertCircle, CheckCircle2, Loader2, Play, RefreshCcw, Settings } from 'lucide-react';

import { useRepositorySecretsStatus } from '../hooks/useRepositorySecretsStatus';

export interface RepositoryActionDefinition {
  id: string;
  label: string;
  description?: string;
  requiresSecrets?: boolean;
  estimatedDurationSeconds?: number;
}

interface RepositoryActionsPanelProps {
  repoId: string | null | undefined;
  actions?: RepositoryActionDefinition[];
  onConfigure?: () => void;
  onRun?: (action: RepositoryActionDefinition) => void;
  /**
   * Allows parents to skip work when the panel is collapsed or hidden.
   */
  isVisible?: boolean;
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

export const RepositoryActionsPanel: React.FC<RepositoryActionsPanelProps> = ({
  repoId,
  actions = [],
  onConfigure,
  onRun,
  isVisible = true,
}) => {
  const { theme } = useTheme();
  const { isConfigured, isLoading, error, hasChecked, refresh } = useRepositorySecretsStatus(repoId, {
    skip: !isVisible,
  });

  const hasActions = actions.length > 0;

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

  const handleRunClick = (action: RepositoryActionDefinition) => {
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
            onClick={() => void refresh()}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.textSecondary,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <RefreshCcw size={16} />
            Re-check
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
          {repoId
            ? 'No workflow actions detected yet. Actions will appear here after ACT integration discovers workflow jobs.'
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
            const canRun = (!requiresSecrets || isConfigured) && Boolean(onRun);
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
                        <Play size={16} />
                        Run
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
