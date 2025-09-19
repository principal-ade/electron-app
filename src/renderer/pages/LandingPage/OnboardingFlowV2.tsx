import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Download,
  CheckCircle,
  AlertCircle,
  Server,
  Activity,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Code,
  Brain,
  Zap,
  GitBranch,
  FileCode,
  Terminal,
  Layers,
  Users,
  Target,
  TrendingUp,
  Shield,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import {
  getAgentInfo,
  SupportedAgent,
  AGENT_INFO,
} from '@principal-ai/agent-monitoring';
import { APP_BRANDING } from '../../../shared/config/appBranding';
import { useTheme } from 'themed-markdown';
import { AgentConfigurationService } from '../../main-process-api/AgentConfigurationService';
import type { AgentSetupStatus } from '../../../shared/main-process-api-interfaces/AgentConfigAPI';

interface OnboardingFlowV2Props {
  onComplete?: () => void;
  onSkip?: () => void;
}

interface StepInfo {
  id: string;
  title: string;
  subtitle: string;
}

const ONBOARDING_STEPS: StepInfo[] = [
  {
    id: 'select-agent',
    title: 'Choose Your AI Partner',
    subtitle: 'Select the AI that matches your workflow',
  },
  {
    id: 'install-agent',
    title: 'Quick Setup',
    subtitle: 'Get your AI assistant ready in seconds',
  },
  {
    id: 'enable-planning',
    title: 'Collaborative Planning',
    subtitle: 'Enable context-aware code understanding',
  },
  {
    id: 'enable-monitoring',
    title: 'Development Insights',
    subtitle: 'Track and optimize your coding sessions',
  },
  {
    id: 'complete',
    title: 'Launch Your Journey',
    subtitle: 'Everything is configured and ready',
  },
];

export const OnboardingFlowV2: React.FC<OnboardingFlowV2Props> = ({
  onComplete,
  onSkip,
}) => {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<SupportedAgent | null>(
    null,
  );
  const [agentStatus, setAgentStatus] = useState<AgentSetupStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<{
    message?: string;
    progress?: number;
  } | null>(null);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [hooksEnabled, setHooksEnabled] = useState(false);
  const [localInstallStatus, setLocalInstallStatus] = useState<boolean | null>(
    null,
  );

  // Check agent status - same as original
  const checkAgentStatus = useCallback(async () => {
    if (!selectedAgent) return;

    try {
      const status =
        await AgentConfigurationService.getAgentStatus(selectedAgent);
      setAgentStatus(status);

      if (status.isInstalled && localInstallStatus === null) {
        setLocalInstallStatus(status.isInstalled);
      }

      setHooksEnabled(status.hasHooks);

      if (status.isInstalled) {
        try {
          const mcpResult =
            await AgentConfigurationService.getAgentMCPStatus(selectedAgent);
          if (mcpResult.success && mcpResult.status) {
            setMcpEnabled(mcpResult.status.hasMCP);
          }
        } catch (error) {
          console.error('Error checking MCP status:', error);
        }
      }
    } catch (error) {
      console.error('Error checking agent status:', error);
    }
  }, [selectedAgent, localInstallStatus]);

  useEffect(() => {
    checkAgentStatus();
  }, [checkAgentStatus]);

  // Handle agent selection - auto-advance to next step
  const handleSelectAgent = (agent: SupportedAgent) => {
    setSelectedAgent(agent);
    setError(null);
    setTimeout(() => setCurrentStep(1), 500); // Auto-advance after selection
  };

  // Installation handler - same as original
  const handleInstallAgent = useCallback(async () => {
    if (!selectedAgent) return;

    setError(null);
    setIsProcessing(true);

    const agentConfig = getAgentInfo(selectedAgent);

    if (selectedAgent === SupportedAgent.CLAUDE) {
      window.open(agentConfig.ui.downloadUrl, '_blank');
      setIsProcessing(false);
      setTimeout(() => checkAgentStatus(), 3000);
    } else {
      setInstallProgress({ message: 'Starting installation...' });

      const unsubscribeProgress = AgentInstallationService.onInstallProgress(
        selectedAgent,
        (progress) => {
          if (typeof progress === 'string') {
            setInstallProgress({ message: progress });
          } else {
            setInstallProgress(progress);
          }
        },
      );

      const unsubscribeComplete = AgentInstallationService.onInstallComplete(
        selectedAgent,
        async () => {
          setInstallProgress({ message: 'Installation complete!' });
          setIsProcessing(false);

          try {
            const installationStatus =
              await AgentInstallationService.checkInstallation(selectedAgent);
            if (installationStatus.installed) {
              setLocalInstallStatus(true);
              setTimeout(() => {
                checkAgentStatus();
                setInstallProgress(null);
                setCurrentStep(2);
              }, 1000);
            }
          } catch (error) {
            console.error(`Error checking ${selectedAgent} status:`, error);
          }

          unsubscribeComplete();
          unsubscribeError();
          unsubscribeProgress?.();
        },
      );

      const unsubscribeError = AgentInstallationService.onInstallError(
        selectedAgent,
        (error) => {
          setError(error);
          setIsProcessing(false);
          setInstallProgress(null);
          unsubscribeComplete();
          unsubscribeError();
          unsubscribeProgress?.();
        },
      );

      try {
        await AgentInstallationService.install(selectedAgent);
      } catch (error) {
        setError(`Failed to install ${agentConfig.displayName}`);
        setIsProcessing(false);
        setInstallProgress(null);
      }
    }
  }, [selectedAgent, checkAgentStatus]);

  // MCP handler
  const handleEnableMCP = useCallback(async () => {
    if (!selectedAgent) return;

    setError(null);
    setIsProcessing(true);

    try {
      const result = await AgentConfigurationService.addMCPToAgent(
        selectedAgent,
        APP_BRANDING.MCP_SERVER_CONFIG_KEY,
      );

      if (result.success && result.status) {
        setMcpEnabled(result.status.hasMCP);
        await checkAgentStatus();
        setTimeout(() => {
          setCurrentStep(3);
          setIsProcessing(false);
        }, 1000);
      } else {
        setError(result.error || 'Failed to enable MCP');
        setIsProcessing(false);
      }
    } catch (error) {
      setError('Error configuring MCP');
      setIsProcessing(false);
    }
  }, [selectedAgent, checkAgentStatus]);

  // Hooks handler
  const handleEnableHooks = useCallback(async () => {
    if (!selectedAgent) return;

    setError(null);
    setIsProcessing(true);

    try {
      const result =
        await AgentConfigurationService.addHooksToAgent(selectedAgent);

      if (result) {
        setHooksEnabled(true);
        await checkAgentStatus();
        setTimeout(() => {
          setCurrentStep(4);
          setIsProcessing(false);
        }, 1000);
      } else {
        setError('Failed to configure hooks');
        setIsProcessing(false);
      }
    } catch (error) {
      setError('Error configuring hooks');
      setIsProcessing(false);
    }
  }, [selectedAgent, checkAgentStatus]);

  // Progress dots at the top
  const ProgressDots = () => (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '20px',
        justifyContent: 'center',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      {ONBOARDING_STEPS.map((_, index) => (
        <div
          key={index}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor:
              index <= currentStep
                ? theme.colors.primary
                : theme.colors.backgroundTertiary,
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  );

  // Right side brand content for each step
  const renderBrandContent = () => {
    const step = ONBOARDING_STEPS[currentStep];

    switch (step.id) {
      case 'select-agent':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '42px',
                  fontWeight: 700,
                  color: theme.colors.text,
                  marginBottom: '16px',
                  lineHeight: 1.2,
                }}
              >
                Your AI-Powered
                <br />
                Development Team
              </h1>
              <p
                style={{
                  fontSize: '18px',
                  color: theme.colors.textSecondary,
                  lineHeight: 1.6,
                }}
              >
                Transform your coding experience with an AI assistant that
                understands your codebase, helps you plan features, and tracks
                your productivity.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '20px',
              }}
            >
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <Code
                  size={24}
                  color={theme.colors.primary}
                  style={{ marginBottom: '12px' }}
                />
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '8px',
                  }}
                >
                  Smart Code Understanding
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  AI that truly understands your project structure and coding
                  patterns
                </p>
              </div>

              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <Brain
                  size={24}
                  color={theme.colors.primary}
                  style={{ marginBottom: '12px' }}
                />
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '8px',
                  }}
                >
                  Intelligent Planning
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Collaborate on architecture decisions and implementation
                  strategies
                </p>
              </div>

              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <TrendingUp
                  size={24}
                  color={theme.colors.primary}
                  style={{ marginBottom: '12px' }}
                />
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '8px',
                  }}
                >
                  Productivity Insights
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Track your development patterns and optimize your workflow
                </p>
              </div>

              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <Shield
                  size={24}
                  color={theme.colors.primary}
                  style={{ marginBottom: '12px' }}
                />
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '8px',
                  }}
                >
                  Secure & Private
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Your code stays on your machine with full control over AI
                  interactions
                </p>
              </div>
            </div>
          </div>
        );

      case 'install-agent':
        if (!selectedAgent) return null;
        const agentInfo = AGENT_INFO[selectedAgent];
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${agentInfo.ui.color}05 0%, ${agentInfo.ui.color}10 100%)`,
            }}
          >
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '24px',
                background: `linear-gradient(135deg, ${agentInfo.ui.color}20, ${agentInfo.ui.color}40)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <Bot size={64} color={agentInfo.ui.color} />
            </div>

            <div style={{ textAlign: 'center' }}>
              <h2
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: theme.colors.text,
                  marginBottom: '16px',
                }}
              >
                {agentInfo.displayName}
              </h2>
              <p
                style={{
                  fontSize: '18px',
                  color: theme.colors.textSecondary,
                  maxWidth: '400px',
                  margin: '0 auto',
                  lineHeight: 1.6,
                }}
              >
                {agentInfo.ui.description}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: `${agentInfo.ui.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Terminal size={20} color={agentInfo.ui.color} />
                </div>
                <div>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    Command Line Integration
                  </h4>
                  <p
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Works seamlessly with your terminal workflow
                  </p>
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: `${agentInfo.ui.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GitBranch size={20} color={agentInfo.ui.color} />
                </div>
                <div>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    Git-Aware
                  </h4>
                  <p
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Understands your repository structure and history
                  </p>
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: `${agentInfo.ui.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileCode size={20} color={agentInfo.ui.color} />
                </div>
                <div>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    Multi-Language Support
                  </h4>
                  <p
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Works with all major programming languages
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'enable-planning':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                padding: '24px',
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${theme.colors.primary}10, ${theme.colors.primary}05)`,
                border: `1px solid ${theme.colors.primary}30`,
              }}
            >
              <h2
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: theme.colors.text,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Brain size={32} color={theme.colors.primary} />
                MCP: Model Context Protocol
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  color: theme.colors.textSecondary,
                  lineHeight: 1.6,
                  marginBottom: '24px',
                }}
              >
                Enable your AI to maintain context across conversations,
                understand your entire codebase, and collaborate on complex
                architectural decisions.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                What You're Enabling:
              </h3>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                }}
              >
                <Layers
                  size={24}
                  color={theme.colors.primary}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
                <div>
                  <h4
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '4px',
                    }}
                  >
                    Deep Code Understanding
                  </h4>
                  <p
                    style={{
                      fontSize: '14px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    AI can navigate your entire project structure, understanding
                    relationships between files and modules
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                }}
              >
                <MessageSquare
                  size={24}
                  color={theme.colors.primary}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
                <div>
                  <h4
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '4px',
                    }}
                  >
                    Persistent Context
                  </h4>
                  <p
                    style={{
                      fontSize: '14px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Your AI remembers previous conversations and decisions,
                    building on past discussions
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                }}
              >
                <Target
                  size={24}
                  color={theme.colors.primary}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
                <div>
                  <h4
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '4px',
                    }}
                  >
                    Smart Planning Mode
                  </h4>
                  <p
                    style={{
                      fontSize: '14px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Collaborate on implementation strategies before writing code
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'enable-monitoring':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                padding: '24px',
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${theme.colors.success}10, ${theme.colors.success}05)`,
                border: `1px solid ${theme.colors.success}30`,
              }}
            >
              <h2
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: theme.colors.text,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Activity size={32} color={theme.colors.success} />
                Agent Event Monitoring
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  color: theme.colors.textSecondary,
                  lineHeight: 1.6,
                  marginBottom: '16px',
                }}
              >
                Track AI agent events to enable context handoff between sessions
                and gain insights into agent collaboration patterns for better
                git management.
              </p>

              {/* Privacy Notice */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: `${theme.colors.primary}10`,
                  border: `1px solid ${theme.colors.primary}30`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <Shield
                  size={20}
                  color={theme.colors.primary}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      color: theme.colors.text,
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                  >
                    🔒 100% Private & Local
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    We never collect, store, or transmit your personal data,
                    code, or usage patterns. Your privacy is our priority.
                  </p>
                </div>
              </div>
            </div>

            {/* Key Features */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                What This Enables:
              </h4>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                  }}
                >
                  <Users
                    size={24}
                    color={theme.colors.primary}
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  />
                  <div>
                    <h4
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: theme.colors.text,
                        marginBottom: '4px',
                      }}
                    >
                      Agent Context Handoff
                    </h4>
                    <p
                      style={{
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      Seamlessly transfer context between AI sessions,
                      maintaining continuity across your development workflow
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                  }}
                >
                  <GitBranch
                    size={24}
                    color={theme.colors.primary}
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  />
                  <div>
                    <h4
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: theme.colors.text,
                        marginBottom: '4px',
                      }}
                    >
                      Git Collision Insights
                    </h4>
                    <p
                      style={{
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      Detect when multiple agents work on the same files,
                      preventing merge conflicts and improving collaboration
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Agent Events We Monitor:
              </h4>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ChevronRight size={16} color={theme.colors.primary} />
                <span
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  File edits and code generation from AI agents
                </span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ChevronRight size={16} color={theme.colors.primary} />
                <span
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Tool usage patterns and command execution
                </span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ChevronRight size={16} color={theme.colors.primary} />
                <span
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Git operations to detect potential conflicts
                </span>
              </div>

              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: `${theme.colors.success}10`,
                  border: `1px solid ${theme.colors.success}30`,
                  fontSize: '12px',
                  color: theme.colors.success,
                  fontWeight: 500,
                }}
              >
                ✓ No cloud storage • ✓ No telemetry • ✓ No external servers • ✓
                You own your data
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              background: `linear-gradient(135deg, ${theme.colors.primary}05 0%, ${theme.colors.success}05 100%)`,
            }}
          >
            <div
              style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.colors.success}20, ${theme.colors.success}40)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 3s infinite',
              }}
            >
              <Rocket size={80} color={theme.colors.success} />
            </div>

            <div style={{ textAlign: 'center' }}>
              <h1
                style={{
                  fontSize: '42px',
                  fontWeight: 700,
                  color: theme.colors.text,
                  marginBottom: '16px',
                }}
              >
                You're All Set! 🎉
              </h1>
              <p
                style={{
                  fontSize: '18px',
                  color: theme.colors.textSecondary,
                  maxWidth: '500px',
                  lineHeight: 1.6,
                }}
              >
                Your AI development environment is fully configured. You're
                ready to code smarter, faster, and with more confidence.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '32px',
                marginTop: '32px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: `${theme.colors.success}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <CheckCircle size={32} color={theme.colors.success} />
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Agent Ready
                </div>
              </div>

              {mcpEnabled && (
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      backgroundColor: `${theme.colors.success}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <Brain size={32} color={theme.colors.success} />
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    Context Enabled
                  </div>
                </div>
              )}

              {hooksEnabled && (
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      backgroundColor: `${theme.colors.success}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <Activity size={32} color={theme.colors.success} />
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    Tracking Active
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Left side action content
  const renderActionContent = () => {
    const step = ONBOARDING_STEPS[currentStep];

    switch (step.id) {
      case 'select-agent':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                {step.title}
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  color: theme.colors.textSecondary,
                }}
              >
                {step.subtitle}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {Object.values(SupportedAgent).map((agent) => {
                const agentInfo = AGENT_INFO[agent as SupportedAgent];
                const isSelected = selectedAgent === agent;

                return (
                  <div
                    key={agent}
                    onClick={() => handleSelectAgent(agent as SupportedAgent)}
                    style={{
                      padding: '20px',
                      borderRadius: '12px',
                      border: `2px solid ${isSelected ? agentInfo.ui.color : theme.colors.border}`,
                      backgroundColor: isSelected
                        ? `${agentInfo.ui.color}10`
                        : theme.colors.backgroundSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor =
                          agentInfo.ui.color + '60';
                        e.currentTarget.style.backgroundColor = `${agentInfo.ui.color}05`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = theme.colors.border;
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundSecondary;
                      }
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${agentInfo.ui.color}20, ${agentInfo.ui.color}40)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Bot size={28} color={agentInfo.ui.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: '18px',
                          fontWeight: 600,
                          color: theme.colors.text,
                          marginBottom: '4px',
                        }}
                      >
                        {agentInfo.displayName}
                      </h3>
                      <p
                        style={{
                          fontSize: '14px',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {agentInfo.ui.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle size={24} color={agentInfo.ui.color} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'install-agent':
        if (!selectedAgent) return null;
        const agentInfo = AGENT_INFO[selectedAgent];
        const isInstalled =
          localInstallStatus !== null
            ? localInstallStatus
            : agentStatus?.isInstalled;

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                {isInstalled ? `${agentInfo.displayName} is Ready` : step.title}
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  color: theme.colors.textSecondary,
                }}
              >
                {isInstalled
                  ? 'Your AI assistant is installed and ready to use'
                  : step.subtitle}
              </p>
            </div>

            {installProgress && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    marginBottom: installProgress.progress ? '12px' : 0,
                  }}
                >
                  {installProgress.message}
                </p>
                {installProgress.progress !== undefined && (
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '4px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${installProgress.progress}%`,
                        height: '100%',
                        backgroundColor: theme.colors.primary,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <AlertCircle size={20} color="#f87171" />
                <span style={{ color: '#f87171' }}>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px' }}>
              {!isInstalled ? (
                <>
                  <button
                    onClick={handleInstallAgent}
                    disabled={isProcessing}
                    style={{
                      padding: '14px 28px',
                      borderRadius: '12px',
                      backgroundColor: isProcessing
                        ? theme.colors.backgroundTertiary
                        : theme.colors.primary,
                      color: isProcessing
                        ? theme.colors.textSecondary
                        : 'white',
                      fontSize: '16px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isProcessing ? (
                      <>Installing...</>
                    ) : (
                      <>
                        <Download size={20} />
                        {selectedAgent === SupportedAgent.CLAUDE
                          ? 'Download'
                          : 'Install'}
                      </>
                    )}
                  </button>
                  {selectedAgent === SupportedAgent.CLAUDE && (
                    <button
                      onClick={checkAgentStatus}
                      style={{
                        padding: '14px 28px',
                        borderRadius: '12px',
                        backgroundColor: 'transparent',
                        color: theme.colors.primary,
                        fontSize: '16px',
                        fontWeight: 600,
                        border: `2px solid ${theme.colors.primary}`,
                        cursor: 'pointer',
                      }}
                    >
                      Check Status
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setCurrentStep(2)}
                  style={{
                    padding: '14px 28px',
                    borderRadius: '12px',
                    backgroundColor: theme.colors.primary,
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Continue
                  <ArrowRight size={20} />
                </button>
              )}

              <button
                onClick={() => setCurrentStep(0)}
                disabled={isProcessing}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  fontSize: '16px',
                  fontWeight: 600,
                  border: `1px solid ${theme.colors.border}`,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ArrowLeft size={20} />
                Back
              </button>
            </div>
          </div>
        );

      case 'enable-planning':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                {mcpEnabled ? 'Planning Enabled!' : step.title}
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  color: theme.colors.textSecondary,
                }}
              >
                {mcpEnabled
                  ? 'Your AI now has enhanced context and planning capabilities'
                  : step.subtitle}
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <AlertCircle size={20} color="#f87171" />
                <span style={{ color: '#f87171' }}>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px' }}>
              {!mcpEnabled ? (
                <button
                  onClick={handleEnableMCP}
                  disabled={isProcessing}
                  style={{
                    padding: '14px 28px',
                    borderRadius: '12px',
                    backgroundColor: isProcessing
                      ? theme.colors.backgroundTertiary
                      : theme.colors.primary,
                    color: isProcessing ? theme.colors.textSecondary : 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {isProcessing ? 'Enabling...' : 'Enable Planning'}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentStep(3)}
                  style={{
                    padding: '14px 28px',
                    borderRadius: '12px',
                    backgroundColor: theme.colors.primary,
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Continue
                  <ArrowRight size={20} />
                </button>
              )}

              <button
                onClick={() => setCurrentStep(3)}
                disabled={isProcessing}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  fontSize: '16px',
                  fontWeight: 600,
                  border: `1px solid ${theme.colors.border}`,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                Skip for Now
              </button>
            </div>
          </div>
        );

      case 'enable-monitoring':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                {hooksEnabled ? 'Monitoring Active!' : step.title}
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  color: theme.colors.textSecondary,
                }}
              >
                {hooksEnabled
                  ? 'Your development activities are being tracked for insights'
                  : step.subtitle}
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <AlertCircle size={20} color="#f87171" />
                <span style={{ color: '#f87171' }}>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px' }}>
              {!hooksEnabled ? (
                <button
                  onClick={handleEnableHooks}
                  disabled={isProcessing}
                  style={{
                    padding: '14px 28px',
                    borderRadius: '12px',
                    backgroundColor: isProcessing
                      ? theme.colors.backgroundTertiary
                      : theme.colors.primary,
                    color: isProcessing ? theme.colors.textSecondary : 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {isProcessing ? 'Enabling...' : 'Enable Monitoring'}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentStep(4)}
                  style={{
                    padding: '14px 28px',
                    borderRadius: '12px',
                    backgroundColor: theme.colors.primary,
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Continue
                  <ArrowRight size={20} />
                </button>
              )}

              <button
                onClick={() => setCurrentStep(4)}
                disabled={isProcessing}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  fontSize: '16px',
                  fontWeight: 600,
                  border: `1px solid ${theme.colors.border}`,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                Skip for Now
              </button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '48px',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <button
              onClick={onComplete}
              style={{
                padding: '16px 32px',
                borderRadius: '12px',
                backgroundColor: theme.colors.primary,
                color: 'white',
                fontSize: '18px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 8px 24px ${theme.colors.primary}40`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Get Started
              <Rocket size={20} />
            </button>

            <button
              onClick={onComplete}
              style={{
                padding: '14px 28px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                fontSize: '16px',
                fontWeight: 600,
                border: `1px solid ${theme.colors.border}`,
                cursor: 'pointer',
              }}
            >
              View Advanced Settings
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
      `}</style>

      <ProgressDots />

      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Left side - Actions */}
        <div
          style={{
            width: '40%',
            minWidth: '400px',
            backgroundColor: theme.colors.background,
            borderRight: `1px solid ${theme.colors.border}`,
            overflow: 'auto',
          }}
        >
          {renderActionContent()}
        </div>

        {/* Right side - Brand content */}
        <div
          style={{
            flex: 1,
            backgroundColor: theme.colors.backgroundSecondary,
            overflow: 'auto',
          }}
        >
          {renderBrandContent()}
        </div>
      </div>

      {/* Skip button */}
      {currentStep < 4 && (
        <button
          onClick={onSkip}
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.textSecondary,
            fontSize: '14px',
            border: `1px solid ${theme.colors.border}`,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          Skip Setup
        </button>
      )}
    </div>
  );
};
