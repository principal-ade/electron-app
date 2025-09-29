import React, { useState, useEffect, useCallback } from 'react';
import { Check, AlertCircle, Server, Settings } from 'lucide-react';

import { getAgentInfo, SupportedAgent } from '@principal-ai/agent-monitoring';
import { APP_BRANDING } from '../../../../shared/config/appBranding';
import { useTheme } from 'themed-markdown';

import { AgentConnectionVisualizer } from './AgentConnectionVisualizer';
import { WizardStep } from './WizardStep';
import { InstallStep } from './InstallStep';

import { AgentSetupStatus } from '../../../../shared/main-process-api-interfaces/AgentConfigAPI';
import { AgentConfigurationService } from '../../../main-process-api/AgentConfigurationService';

interface AgentSetupWizardProps {
  agentType: SupportedAgent;
  agentStatus: AgentSetupStatus;
  checkAgentStatus: () => void;
  onShowDetails: () => void;
  handleClaudeTourNext?: () => void;
  handleClaudeTourAction?: (action: {
    fn: (step: number) => Promise<void>;
  }) => void;
  handleClaudeTourButtonClick?: (
    stepIndex: number,
    buttonAction: () => void,
  ) => void;
  isClaudeTourActive?: boolean;
  claudeTourStepIndex?: number;
}

interface InstallProgress {
  stage?: string;
  progress?: number;
  message?: string;
}

export const AgentSetupWizard: React.FC<AgentSetupWizardProps> = ({
  agentType,
  agentStatus,
  checkAgentStatus,
  onShowDetails,
  handleClaudeTourNext,
  handleClaudeTourAction,
  handleClaudeTourButtonClick,
  isClaudeTourActive,
  claudeTourStepIndex,
}) => {
  const { theme } = useTheme();
  const [isInstallingAgent, setIsInstallingAgent] = useState(false);
  const [isConfiguringHooks, setIsConfiguringHooks] = useState(false);
  const [isTogglingMCP, setIsTogglingMCP] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installProgress, setInstallProgress] =
    useState<InstallProgress | null>(null);
  const [localInstallStatus, setLocalInstallStatus] = useState<boolean | null>(
    null,
  );
  const [mcpStatus, setMcpStatus] = useState<{
    enabled: boolean;
    serverCount: number;
  }>({ enabled: false, serverCount: 0 });

  // Sync local status with prop changes
  useEffect(() => {
    if (agentStatus?.isInstalled && localInstallStatus === null) {
      setLocalInstallStatus(agentStatus?.isInstalled ?? true);
    }
  }, [agentStatus?.isInstalled, localInstallStatus]);

  // Check MCP status using the new unified API
  useEffect(() => {
    const checkMCPStatus = async () => {
      try {
        const result =
          await AgentConfigurationService.getAgentMCPStatus(agentType);

        if (result.success && result.status) {
          setMcpStatus({
            enabled: result.status.hasMCP,
            serverCount: result.status.mcpCount,
          });
        } else {
          setMcpStatus({ enabled: false, serverCount: 0 });
        }
      } catch (error) {
        console.error('Error checking MCP status:', error);
        setMcpStatus({ enabled: false, serverCount: 0 });
      }
    };

    if (agentStatus?.isInstalled && agentStatus?.hasHooks) {
      checkMCPStatus();
    }
  }, [agentType, agentStatus]);

  // Get agent configuration from core library
  const agentConfig = getAgentInfo(agentType as SupportedAgent);

  const handleInstallAgent = useCallback(async () => {
    setError(null);
    // Open download URL for all agents
    window.open(agentConfig.ui.downloadUrl, '_blank');

    // Show message to user
    setInstallProgress({ message: 'Opening download page...' });

    // Clear message after 2 seconds and refresh status
    setTimeout(() => {
      setInstallProgress(null);
      checkAgentStatus();
    }, 2000);

    // Handle tour navigation if applicable
    if (agentType === 'claude') {
      handleClaudeTourNext?.();
    }
  }, [
    agentType,
    agentConfig.ui.downloadUrl,
    handleClaudeTourNext,
    checkAgentStatus,
  ]);

  const handleConfigureHooks = useCallback(async () => {
    setError(null);
    setIsConfiguringHooks(true);
    try {
      const result = await AgentConfigurationService.addHooksToAgent(agentType);

      if (result) {
        await checkAgentStatus();
        handleClaudeTourNext?.();
      } else {
        setError('Failed to configure hooks');
      }
    } catch (error) {
      setError('Error configuring hooks');
    } finally {
      setIsConfiguringHooks(false);
    }
  }, [agentType, checkAgentStatus, handleClaudeTourNext]);

  const handleRemoveHooks = useCallback(async () => {
    setError(null);
    setIsConfiguringHooks(true);
    try {
      const result = await AgentConfigurationService.removeHooksFromAgent(
        agentType as SupportedAgent,
      );

      if (result) {
        checkAgentStatus();
      } else {
        setError('Failed to remove hooks');
      }
    } catch (error) {
      setError('Error removing hooks');
    } finally {
      setIsConfiguringHooks(false);
    }
  }, [agentType, checkAgentStatus]);

  const handleUninstallAgent = useCallback(async () => {
    setError(null);
    // For all agents, direct user to uninstall manually
    alert(`Please uninstall ${agentConfig.displayName} manually through your system settings`);
  }, [agentConfig.displayName]);

  const handleMCPToggle = useCallback(async () => {
    setIsTogglingMCP(true);
    setError(null);

    try {
      if (mcpStatus.enabled) {
        // Disable MCP server using new unified API
        const result = await AgentConfigurationService.removeMCPFromAgent(
          agentType,
          APP_BRANDING.MCP_SERVER_CONFIG_KEY,
        );
        if (result.success && result.status) {
          setMcpStatus({
            enabled: result.status.hasMCP,
            serverCount: result.status.mcpCount,
          });
          await checkAgentStatus();
        } else {
          setError(result.error || 'Failed to disable MCP server');
        }
      } else {
        // Enable MCP server using new unified API
        const result = await AgentConfigurationService.addMCPToAgent(
          agentType,
          APP_BRANDING.MCP_SERVER_CONFIG_KEY,
        );
        if (result.success && result.status) {
          setMcpStatus({
            enabled: result.status.hasMCP,
            serverCount: result.status.mcpCount,
          });
          await checkAgentStatus();
          handleClaudeTourNext?.();
        } else {
          setError(result.error || 'Failed to enable MCP server');
        }
      }
    } catch (error) {
      console.error('Error toggling MCP:', error);
      setError('Error configuring MCP server');
    } finally {
      setIsTogglingMCP(false);
    }
  }, [agentType, mcpStatus.enabled, checkAgentStatus, handleClaudeTourNext]);

  const getCurrentStep = () => {
    // Use local status if available (immediately after install)
    const isInstalled =
      localInstallStatus !== null
        ? localInstallStatus
        : agentStatus?.isInstalled ?? true;

    if (!isInstalled) return 'install';
    if (!agentStatus?.hasHooks) return 'configure';
    if (agentStatus?.hasHooks && !mcpStatus.enabled) return 'mcp';
    return 'complete';
  };

  const currentStep = getCurrentStep();

  const handleTriggerStepAction = useCallback(
    async (step: number) => {
      if (step === 0) {
        await handleInstallAgent();
      } else if (step === 1) {
        await handleConfigureHooks();
      } else if (step === 2) {
        await handleMCPToggle();
      }
    },
    [handleInstallAgent, handleConfigureHooks, handleMCPToggle],
  );

  useEffect(() => {
    if (handleClaudeTourAction && isClaudeTourActive) {
      handleClaudeTourAction({ fn: handleTriggerStepAction });
    }
  }, [handleClaudeTourAction, isClaudeTourActive, handleTriggerStepAction]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div
        className="w-full h-full flex flex-col rounded-lg p-6"
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        {/* Header - Fixed height */}
        <div className="mb-4 flex-shrink-0 relative">
          <h2
            className="text-2xl font-bold mb-1 text-center"
            style={{ color: theme.colors.text }}
          >
            {agentConfig.displayName} Setup
          </h2>
          <button
            onClick={onShowDetails}
            className="absolute top-0 right-0 p-2 rounded-lg transition-colors flex items-center gap-2"
            style={{
              backgroundColor: theme.colors.backgroundTertiary,
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.border}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.surface;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <Settings size={16} />
            <span className="text-sm">Detailed View</span>
          </button>
        </div>

        {/* Error Message - Fixed height when present */}
        {error && (
          <div
            className="mb-4 p-4 rounded-lg flex-shrink-0"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <div
              className="flex items-center gap-2"
              style={{ color: '#f87171' }}
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Main content - Split evenly between wizard steps and visualization */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Steps Container - Show all 3 steps horizontally */}
          <div
            className="flex-1 mb-4 overflow-x-auto"
            style={{
              minHeight: 0,
            }}
          >
            <div className="flex gap-4 h-full">
              {/* Step 1: Install */}
              <div
                className="flex-1 p-4 rounded-lg"
                style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  //opacity: !agentStatus?.isInstalled ? 1 : 0.5,
                }}
              >
                <InstallStep
                  agentType={agentType}
                  agentDisplayName={agentConfig.displayName}
                  isProcessing={isInstallingAgent}
                  installProgress={installProgress}
                  onInstall={handleInstallAgent}
                  onCheckStatus={checkAgentStatus}
                  onInstallComplete={() => setLocalInstallStatus(true)}
                  onUninstall={handleUninstallAgent}
                  hasHooks={agentStatus?.hasHooks || false}
                  handleClaudeTourButtonClick={handleClaudeTourButtonClick}
                  isClaudeTourActive={isClaudeTourActive}
                  claudeTourStepIndex={claudeTourStepIndex}
                  isCurrentStep={currentStep === 'install'}
                  isInstalled={agentStatus?.isInstalled ?? true}
                />
              </div>

              {/* Step 2: Configure Hooks */}
              <div
                className="flex-1 p-4 rounded-lg"
                style={{
                  backgroundColor:
                    currentStep !== 'install'
                      ? theme.colors.backgroundTertiary
                      : 'transparent',
                }}
              >
                <WizardStep
                  icon={
                    <Check
                      size={32}
                      style={{
                        color: agentStatus?.hasHooks
                          ? agentConfig.ui.color
                          : theme.colors.textSecondary,
                      }}
                    />
                  }
                  title={
                    agentStatus?.hasHooks ? 'Configured' : 'Configure Hooks'
                  }
                  titleColor={
                    agentStatus?.hasHooks ? agentConfig.ui.color : undefined
                  }
                  description={
                    agentStatus?.hasHooks
                      ? 'Activity tracking enabled'
                      : 'Enable activity tracking'
                  }
                  iconBackgroundColor={
                    agentStatus?.hasHooks
                      ? `${agentConfig.ui.color}20`
                      : theme.colors.backgroundLight
                  }
                  dataTour="configure-step"
                >
                  <div className="flex justify-center">
                    {!agentStatus?.hasHooks ? (
                      <button
                        onClick={() => {
                          if (
                            handleClaudeTourButtonClick &&
                            isClaudeTourActive &&
                            claudeTourStepIndex === 1
                          ) {
                            handleClaudeTourButtonClick(
                              1,
                              handleConfigureHooks,
                            );
                          } else {
                            handleConfigureHooks();
                          }
                        }}
                        disabled={
                          isConfiguringHooks || currentStep !== 'configure'
                        }
                        data-tour="configure-hooks"
                        className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        style={{
                          backgroundColor: theme.colors.primary,
                          color: theme.colors.background,
                        }}
                        onMouseEnter={(e) =>
                          !e.currentTarget.disabled &&
                          (e.currentTarget.style.backgroundColor =
                            theme.colors.primary)
                        }
                        onMouseLeave={(e) =>
                          !e.currentTarget.disabled &&
                          (e.currentTarget.style.backgroundColor =
                            theme.colors.primary)
                        }
                      >
                        {isConfiguringHooks ? 'Configuring...' : 'Enable →'}
                      </button>
                    ) : (
                      <button
                        onClick={handleRemoveHooks}
                        disabled={isConfiguringHooks || mcpStatus.enabled}
                        className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        style={{
                          backgroundColor: theme.colors.backgroundTertiary,
                          color: theme.colors.text,
                          border: `1px solid ${theme.colors.border}`,
                        }}
                        onMouseEnter={(e) =>
                          !e.currentTarget.disabled &&
                          (e.currentTarget.style.backgroundColor =
                            theme.colors.backgroundSecondary)
                        }
                        onMouseLeave={(e) =>
                          !e.currentTarget.disabled &&
                          (e.currentTarget.style.backgroundColor =
                            theme.colors.backgroundTertiary)
                        }
                        title={
                          mcpStatus.enabled
                            ? 'Disable MCP before removing hooks'
                            : ''
                        }
                      >
                        {isConfiguringHooks ? 'Removing...' : 'Remove Hooks'}
                      </button>
                    )}
                  </div>
                </WizardStep>
              </div>

              {/* Step 3: Enable MCP */}
              <div
                className="flex-1 p-4 rounded-lg"
                style={{
                  backgroundColor:
                    currentStep === 'mcp' || currentStep === 'complete'
                      ? theme.colors.backgroundTertiary
                      : 'transparent',
                  opacity: agentStatus?.hasHooks ? 1 : 0.5,
                }}
              >
                <WizardStep
                  icon={
                    <Server
                      size={32}
                      style={{
                        color: mcpStatus.enabled
                          ? agentConfig.ui.color
                          : theme.colors.textSecondary,
                      }}
                    />
                  }
                  title={mcpStatus.enabled ? 'Enabled' : 'Enable MCP'}
                  titleColor={
                    mcpStatus.enabled ? agentConfig.ui.color : undefined
                  }
                  description={
                    mcpStatus.enabled
                      ? 'Code analysis active'
                      : 'Enhanced code analysis'
                  }
                  iconBackgroundColor={
                    mcpStatus.enabled
                      ? `${agentConfig.ui.color}20`
                      : theme.colors.backgroundTertiary
                  }
                  dataTour="mcp-step"
                >
                  <div className="flex justify-center">
                    {!mcpStatus.enabled ? (
                      <button
                        onClick={() => {
                          if (
                            handleClaudeTourButtonClick &&
                            isClaudeTourActive &&
                            claudeTourStepIndex === 2
                          ) {
                            handleClaudeTourButtonClick(2, handleMCPToggle);
                          } else {
                            handleMCPToggle();
                          }
                        }}
                        disabled={
                          isTogglingMCP ||
                          (currentStep !== 'mcp' && !mcpStatus.enabled)
                        }
                        data-tour="enable-mcp"
                        className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        style={{
                          backgroundColor: theme.colors.primary,
                          color: theme.colors.background,
                        }}
                        onMouseEnter={(e) =>
                          !e.currentTarget.disabled &&
                          (e.currentTarget.style.backgroundColor =
                            theme.colors.primary)
                        }
                        onMouseLeave={(e) =>
                          !e.currentTarget.disabled &&
                          (e.currentTarget.style.backgroundColor =
                            theme.colors.primary)
                        }
                      >
                        {isTogglingMCP ? 'Configuring...' : 'Enable'}
                      </button>
                    ) : (
                      <button
                        onClick={handleMCPToggle}
                        disabled={isTogglingMCP || currentStep !== 'complete'}
                        className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        style={{
                          backgroundColor: theme.colors.backgroundTertiary,
                          color: theme.colors.text,
                          border: `1px solid ${theme.colors.border}`,
                        }}
                        onMouseEnter={(e) =>
                          !e.currentTarget.disabled &&
                          (e.currentTarget.style.backgroundColor =
                            theme.colors.backgroundSecondary)
                        }
                        onMouseLeave={(e) =>
                          !e.currentTarget.disabled &&
                          (e.currentTarget.style.backgroundColor =
                            theme.colors.backgroundTertiary)
                        }
                      >
                        {isTogglingMCP ? 'Disabling...' : 'Disable MCP'}
                      </button>
                    )}
                  </div>
                </WizardStep>
              </div>
            </div>
          </div>

          {/* Visualization - 50% of remaining space */}
          <div className="flex-1" style={{ minHeight: 0 }}>
            <AgentConnectionVisualizer
              agentType={agentType}
              isInstalled={
                localInstallStatus !== null
                  ? localInstallStatus
                  : agentStatus?.isInstalled ?? true
              }
              hasHooks={agentStatus?.hasHooks || false}
              hasMCP={mcpStatus.enabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
