import React from 'react';
import { Download } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { SupportedAgent, getAgentInfo } from "@principal-ai/agent-monitoring";
import { AgentInstallationService } from '../../../main-process-api/AgentInstallationService';

interface InstallStepProps {
  agentType: SupportedAgent;
  agentDisplayName: string;
  isProcessing: boolean;
  installProgress: {
    stage?: string;
    progress?: number;
    message?: string;
  } | null;
  onInstall: () => void;
  onCheckStatus: () => void;
  onInstallComplete: () => void;
  onUninstall?: () => void;
  hasHooks?: boolean;
  handleClaudeTourButtonClick?: (stepIndex: number, buttonAction: () => void) => void;
  isClaudeTourActive?: boolean;
  claudeTourStepIndex?: number;
  isCurrentStep: boolean;
  isInstalled: boolean;
}

export const InstallStep: React.FC<InstallStepProps> = ({
  agentType,
  agentDisplayName,
  isProcessing,
  installProgress,
  onInstall,
  onCheckStatus,
  onInstallComplete,
  onUninstall,
  hasHooks = false,
  handleClaudeTourButtonClick,
  isClaudeTourActive,
  claudeTourStepIndex,
  isCurrentStep,
  isInstalled,
}) => {
  const { theme } = useTheme();
  const agentConfig = getAgentInfo(agentType);

  const handleCheckInstallation = async () => {
    if (agentType === SupportedAgent.GEMINI || agentType === SupportedAgent.OPENCODE) {
      const status = await AgentInstallationService.checkInstallation(agentType);
      if (status.installed) {
        onInstallComplete();
      }
    }
    onCheckStatus();
  };

  return (
    <div className="text-center" data-tour="install-step">
      <div className="mb-6">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: isInstalled ? `${agentConfig.ui.color}20` : theme.colors.backgroundTertiary,
          }}
        >
          {isInstalled ? (
            <Download size={32} style={{ color: agentConfig.ui.color }} />
          ) : (
            <Download
              size={32}
              style={{ color: theme.colors.textSecondary }}
            />
          )}
        </div>
        <h3
          className="text-xl font-semibold mb-2"
          style={{ color: isInstalled ? agentConfig.ui.color : theme.colors.text }}
        >
          {isInstalled ? 'Installed' : `Install ${agentDisplayName}`}
        </h3>
        <p style={{ color: theme.colors.textSecondary, height: '48px' }}>
          {isInstalled
            ? `${agentDisplayName} is installed and ready to use`
            : agentType === 'gemini'
            ? "We'll install a special fork of Gemini that includes hooks support"
            : `First, we need to install the ${agentDisplayName} application`}
        </p>
      </div>

      <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Show uninstall button if already installed and can uninstall */}
      {isInstalled && onUninstall && (agentType === SupportedAgent.GEMINI || agentType === SupportedAgent.OPENCODE) && (
        <>
          <button
            onClick={onUninstall}
            disabled={isProcessing || hasHooks}
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
            title={hasHooks ? "Remove hooks before uninstalling" : ""}
          >
            {isProcessing ? 'Uninstalling...' : 'Uninstall'}
          </button>
        </>
      )}
      
      {/* Show install button and progress if not installed */}
      {!isInstalled && (
        <>
      {isProcessing && installProgress ? (
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400" />
            <span className="text-blue-400">
              {installProgress.message || 'Installing...'}
              {installProgress.stage && (
                <span
                  className="ml-2 text-sm"
                  style={{ color: theme.colors.primary, opacity: 0.8 }}
                >
                  ({installProgress.stage})
                </span>
              )}
            </span>
          </div>
          {installProgress.progress !== undefined && (
            <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: theme.colors.surface }}>
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${installProgress.progress}%` }}
              />
            </div>
          )}
          {installProgress.message === 'Installation complete!' && (
            <div className="mt-4">
              <button
                onClick={handleCheckInstallation}
                className="text-sm transition-colors"
                style={{ color: theme.colors.textSecondary }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = theme.colors.text)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = theme.colors.textSecondary)
                }
              >
                Check installation status
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              if (handleClaudeTourButtonClick && isClaudeTourActive && claudeTourStepIndex === 0) {
                handleClaudeTourButtonClick(0, onInstall);
              } else {
                onInstall();
              }
            }}
            disabled={isProcessing || !isCurrentStep}
            data-tour="install-agent"
            className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
            }}
            onMouseEnter={(e) =>
              !e.currentTarget.disabled &&
              (e.currentTarget.style.backgroundColor = theme.colors.primary)
            }
            onMouseLeave={(e) =>
              !e.currentTarget.disabled &&
              (e.currentTarget.style.backgroundColor = theme.colors.primary)
            }
          >
            {isProcessing
              ? 'Installing...'
              : `Install ${agentDisplayName} →`}
          </button>
        </>
      )}
        </>
      )}
      </div>
    </div>
  );
};