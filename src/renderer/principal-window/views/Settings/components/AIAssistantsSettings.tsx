import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bot, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { SupportedAgent, AGENT_INFO } from '@principal-ai/agent-monitoring';
import {
  AgentConfigurationService,
  AgentInstallationStatus,
  AgentDetectionResult,
} from '../../../../main-process-api/AgentConfigurationService';
import { ShellService } from '../../../../main-process-api/ShellService';
import { AgentConfigurationView } from '../../../../pages/LandingPage/AgentConfigurationView';

export const AIAssistantsSettings: React.FC = () => {
  const { theme } = useTheme();
  const [agentStatus, setAgentStatus] =
    useState<AgentInstallationStatus | null>(null);
  const [claudeDetection, setClaudeDetection] =
    useState<AgentDetectionResult | null>(null);
  const [activeAgentView, setActiveAgentView] = useState<'claude' | null>(null);
  const [agentViewLayout, setAgentViewLayout] = useState<'simple' | 'detailed'>(
    'simple',
  );

  const checkAgentStatus = useCallback(async () => {
    try {
      const status = await AgentConfigurationService.checkAgentInstallations();
      setAgentStatus(status);
    } catch (error) {
      console.error('Failed to check agent status:', error);
    }
    // Real PATH detection, independent of the hook-config status above.
    try {
      const detection = await AgentConfigurationService.detectInstalled(
        SupportedAgent.CLAUDE,
      );
      setClaudeDetection(detection);
    } catch (error) {
      console.error('Failed to detect Claude installation:', error);
      setClaudeDetection({ installed: false });
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
                    {claudeDetection &&
                      (claudeDetection.installed ? (
                        <div
                          title={claudeDetection.path}
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
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '4px',
                          }}
                        >
                          <AlertCircle
                            size={12}
                            color={theme.colors.textSecondary}
                          />
                          <span
                            style={{
                              fontSize: '11px',
                              color: theme.colors.textSecondary,
                            }}
                          >
                            Not installed
                          </span>
                          <button
                            onClick={() =>
                              ShellService.openExternal(
                                AGENT_INFO[SupportedAgent.CLAUDE].ui
                                  .downloadUrl,
                              )
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              color: theme.colors.primary,
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            <Download size={12} />
                            Get it
                          </button>
                        </div>
                      ))}
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
    </div>
  );
};
