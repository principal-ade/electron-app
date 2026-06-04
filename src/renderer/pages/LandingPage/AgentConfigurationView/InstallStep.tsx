import React from 'react';
import { Download, Check } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { SupportedAgent, getAgentInfo } from '@principal-ai/agent-monitoring';

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
  handleClaudeTourButtonClick?: (
    stepIndex: number,
    buttonAction: () => void,
  ) => void;
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
  handleClaudeTourButtonClick,
  isClaudeTourActive,
  claudeTourStepIndex,
  isInstalled,
}) => {
  const { theme } = useTheme();
  const agentConfig = getAgentInfo(agentType);

  const _handleCheckInstallation = async () => {
    // Installation is now handled externally
    onCheckStatus();
  };

  return (
    <div className="text-center" data-tour="install-step">
      <div className="mb-6">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: isInstalled
              ? `${theme.colors.success}20`
              : `${agentConfig.ui.color}20`,
          }}
        >
          {isInstalled ? (
            <Check size={32} style={{ color: theme.colors.success }} />
          ) : (
            <Download size={32} style={{ color: agentConfig.ui.color }} />
          )}
        </div>
        <h3
          className="text-xl font-semibold mb-2"
          style={{
            color: isInstalled ? theme.colors.success : agentConfig.ui.color,
          }}
        >
          {agentDisplayName}
        </h3>
        <p style={{ color: theme.colors.textSecondary, height: '48px' }}>
          {isInstalled
            ? `${agentDisplayName} is installed and ready to configure`
            : `Don't have ${agentDisplayName} installed yet? Download it to get started`}
        </p>
      </div>

      <div
        style={{
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Already installed — no download prompt needed */}
        {isInstalled ? null : (
          <>
            {isProcessing && installProgress ? (
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span style={{ color: theme.colors.textSecondary }}>
                    {installProgress.message || 'Opening download page...'}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (
                      handleClaudeTourButtonClick &&
                      isClaudeTourActive &&
                      claudeTourStepIndex === 0
                    ) {
                      handleClaudeTourButtonClick(0, onInstall);
                    } else {
                      onInstall();
                    }
                  }}
                  disabled={isProcessing}
                  data-tour="install-agent"
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
                  {isProcessing
                    ? 'Opening...'
                    : `Download ${agentDisplayName} →`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
