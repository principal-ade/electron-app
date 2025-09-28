import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { Bot, CheckCircle } from 'lucide-react';
import { SupportedAgent } from '@principal-ai/agent-monitoring';
import {
  AgentConfigurationService,
  AgentInstallationStatus,
} from '../../../../main-process-api/AgentConfigurationService';
import { AgentConfigurationView } from '../../../../pages/LandingPage/AgentConfigurationView';

export const AIAssistantsSettings: React.FC = () => {
  const { theme } = useTheme();
  const [agentStatus, setAgentStatus] = useState<AgentInstallationStatus | null>(null);
  const [activeAgentView, setActiveAgentView] = useState<
    'claude' | 'cline' | 'opencode' | null
  >(null);
  const [agentViewLayout, setAgentViewLayout] = useState<'simple' | 'detailed'>('simple');

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

  if (!activeAgentView) {
    return (
      <div style={{ maxWidth: '800px' }}>
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
                      background: 'linear-gradient(135deg, #D4500F20, #D4500F40)',
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

            {/* Cline */}
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
                      background: 'linear-gradient(135deg, #8B5CF620, #8B5CF640)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Bot size={20} color="#8B5CF6" />
                  </div>
                  <div>
                    <h5
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: '0 0 4px 0',
                      }}
                    >
                      Cline
                    </h5>
                    <p
                      style={{
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        margin: 0,
                      }}
                    >
                      VS Code AI assistant
                    </p>
                    {agentStatus?.cline?.isInstalled && (
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
                    setActiveAgentView('cline');
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
                      background: 'linear-gradient(135deg, #10b98120, #10b98140)',
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
      <div
        style={{
          padding: '20px 0',
          borderBottom: `1px solid ${theme.colors.border}`,
          marginBottom: '20px',
        }}
      >
        <button
          onClick={() => setActiveAgentView(null)}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          ← Back to AI Assistants
        </button>
      </div>

      {activeAgentView === 'claude' && agentStatus && (
        <AgentConfigurationView
          agentType={SupportedAgent.CLAUDE}
          agentStatus={agentStatus.claude}
          checkAgentStatus={checkAgentStatus}
          viewLayout={agentViewLayout}
          onShowDetails={() => setAgentViewLayout('detailed')}
          onBackToSetup={() => setAgentViewLayout('simple')}
        />
      )}

      {activeAgentView === 'cline' && agentStatus && (
        <AgentConfigurationView
          agentType={SupportedAgent.CLINE}
          agentStatus={agentStatus.cline}
          checkAgentStatus={checkAgentStatus}
          viewLayout={agentViewLayout}
          onShowDetails={() => setAgentViewLayout('detailed')}
          onBackToSetup={() => setAgentViewLayout('simple')}
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
        />
      )}
    </div>
  );
};