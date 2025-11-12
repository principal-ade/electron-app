import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Bot, CheckCircle } from 'lucide-react';
import { SupportedAgent } from '@principal-ai/agent-monitoring';
import {
  AgentConfigurationService,
  AgentInstallationStatus,
} from '../../../../main-process-api/AgentConfigurationService';
import { AgentConfigurationView } from '../../../../pages/LandingPage/AgentConfigurationView';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import type { UserPreferences } from '../../../../../shared/types/userPreferences.types';

export const AIAssistantsSettings: React.FC = () => {
  const { theme } = useTheme();
  const [agentStatus, setAgentStatus] =
    useState<AgentInstallationStatus | null>(null);
  const [activeAgentView, setActiveAgentView] = useState<
    'claude' | 'opencode' | null
  >(null);
  const [agentViewLayout, setAgentViewLayout] = useState<'simple' | 'detailed'>(
    'simple',
  );
  const [showJulesButton, setShowJulesButton] = useState(false);
  const [showCodexButton, setShowCodexButton] = useState(false);

  const checkAgentStatus = useCallback(async () => {
    try {
      const status = await AgentConfigurationService.checkAgentInstallations();
      setAgentStatus(status);
    } catch (error) {
      console.error('Failed to check agent status:', error);
    }
  }, []);

  useEffect(() => {
    checkAgentStatus();
  }, [checkAgentStatus]);

  useEffect(() => {
    let isMounted = true;

    const applyPreferences = (preferences: UserPreferences) => {
      if (!isMounted) {
        return;
      }

      setShowJulesButton(preferences.remoteAgentButtons?.jules ?? false);
      setShowCodexButton(preferences.remoteAgentButtons?.codex ?? false);
    };

    void UserPreferencesService.getPreferences().then(applyPreferences);

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UserPreferences>).detail;
      if (detail) {
        applyPreferences(detail);
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

  const handleToggleJulesButton = async () => {
    const nextValue = !showJulesButton;
    setShowJulesButton(nextValue);
    await UserPreferencesService.updatePreferences({
      remoteAgentButtons: { jules: nextValue },
    });
  };

  const handleToggleCodexButton = async () => {
    const nextValue = !showCodexButton;
    setShowCodexButton(nextValue);
    await UserPreferencesService.updatePreferences({
      remoteAgentButtons: { codex: nextValue },
    });
  };

  if (!activeAgentView) {
    return (
      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h4
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '16px',
              color: theme.colors.text,
            }}
          >
            Remote Agent Buttons
          </h4>
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                margin: '0 0 16px 0',
              }}
            >
              Choose which remote agent quick access buttons appear in the
              titlebar.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  fontSize: '14px',
                  color: theme.colors.text,
                }}
              >
                <span>Show Jules quick access button</span>
                <input
                  type="checkbox"
                  checked={showJulesButton}
                  onChange={handleToggleJulesButton}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  fontSize: '14px',
                  color: theme.colors.text,
                }}
              >
                <span>Show Codex quick access button</span>
                <input
                  type="checkbox"
                  checked={showCodexButton}
                  onChange={handleToggleCodexButton}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Claude */}
            <div
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background:
                        'linear-gradient(135deg, #D4500F20, #D4500F40)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Bot size={20} color="#D4500F" />
                  </div>
                  <div>
                    <h5
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: '0 0 4px 0',
                      }}
                    >
                      Claude
                    </h5>
                    <p
                      style={{
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        margin: 0,
                      }}
                    >
                      Anthropic's AI assistant
                    </p>
                    {agentStatus?.claude?.isInstalled && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '4px',
                        }}
                      >
                        <CheckCircle size={12} color={theme.colors.success} />
                        <span
                          style={{
                            fontSize: '11px',
                            color: theme.colors.success,
                          }}
                        >
                          Installed
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveAgentView('claude');
                    setAgentViewLayout('simple');
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Configure
                </button>
              </div>
            </div>

            {/* OpenCode */}
            <div
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background:
                        'linear-gradient(135deg, #10b98120, #10b98140)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Bot size={20} color="#10b981" />
                  </div>
                  <div>
                    <h5
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: '0 0 4px 0',
                      }}
                    >
                      OpenCode
                    </h5>
                    <p
                      style={{
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        margin: 0,
                      }}
                    >
                      Open-source AI assistant
                    </p>
                    {agentStatus?.opencode?.isInstalled && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '4px',
                        }}
                      >
                        <CheckCircle size={12} color={theme.colors.success} />
                        <span
                          style={{
                            fontSize: '11px',
                            color: theme.colors.success,
                          }}
                        >
                          Installed
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveAgentView('opencode');
                    setAgentViewLayout('simple');
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Configure
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {activeAgentView === 'claude' && agentStatus && (
        <AgentConfigurationView
          agentType={SupportedAgent.CLAUDE}
          agentStatus={agentStatus.claude}
          checkAgentStatus={checkAgentStatus}
          viewLayout={agentViewLayout}
          onShowDetails={() => setAgentViewLayout('detailed')}
          onBackToSetup={() => setAgentViewLayout('simple')}
          onBackToAssistants={() => setActiveAgentView(null)}
        />
      )}

      {activeAgentView === 'opencode' && agentStatus && (
        <AgentConfigurationView
          agentType={SupportedAgent.OPENCODE}
          agentStatus={agentStatus.opencode}
          checkAgentStatus={checkAgentStatus}
          viewLayout={agentViewLayout}
          onShowDetails={() => setAgentViewLayout('detailed')}
          onBackToSetup={() => setAgentViewLayout('simple')}
          onBackToAssistants={() => setActiveAgentView(null)}
        />
      )}
    </div>
  );
};
