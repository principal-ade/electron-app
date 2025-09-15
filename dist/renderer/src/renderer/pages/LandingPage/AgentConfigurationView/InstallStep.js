import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Download } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { SupportedAgent, getAgentInfo } from "@principal-ai/agent-monitoring";
import { AgentInstallationService } from '../../../main-process-api/AgentInstallationService';
export const InstallStep = ({ agentType, agentDisplayName, isProcessing, installProgress, onInstall, onCheckStatus, onInstallComplete, onUninstall, hasHooks = false, handleClaudeTourButtonClick, isClaudeTourActive, claudeTourStepIndex, isCurrentStep, isInstalled, }) => {
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
    return (_jsxs("div", { className: "text-center", "data-tour": "install-step", children: [_jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center", style: {
                            backgroundColor: isInstalled ? `${agentConfig.ui.color}20` : theme.colors.backgroundTertiary,
                        }, children: isInstalled ? (_jsx(Download, { size: 32, style: { color: agentConfig.ui.color } })) : (_jsx(Download, { size: 32, style: { color: theme.colors.textSecondary } })) }), _jsx("h3", { className: "text-xl font-semibold mb-2", style: { color: isInstalled ? agentConfig.ui.color : theme.colors.text }, children: isInstalled ? 'Installed' : `Install ${agentDisplayName}` }), _jsx("p", { style: { color: theme.colors.textSecondary, height: '48px' }, children: isInstalled
                            ? `${agentDisplayName} is installed and ready to use`
                            : agentType === 'gemini'
                                ? "We'll install a special fork of Gemini that includes hooks support"
                                : `First, we need to install the ${agentDisplayName} application` })] }), _jsxs("div", { style: { minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: [isInstalled && onUninstall && (agentType === SupportedAgent.GEMINI || agentType === SupportedAgent.OPENCODE) && (_jsx(_Fragment, { children: _jsx("button", { onClick: onUninstall, disabled: isProcessing || hasHooks, className: "px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm", style: {
                                backgroundColor: theme.colors.backgroundTertiary,
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                            }, onMouseEnter: (e) => !e.currentTarget.disabled &&
                                (e.currentTarget.style.backgroundColor =
                                    theme.colors.backgroundSecondary), onMouseLeave: (e) => !e.currentTarget.disabled &&
                                (e.currentTarget.style.backgroundColor =
                                    theme.colors.backgroundTertiary), title: hasHooks ? "Remove hooks before uninstalling" : "", children: isProcessing ? 'Uninstalling...' : 'Uninstall' }) })), !isInstalled && (_jsx(_Fragment, { children: isProcessing && installProgress ? (_jsxs("div", { className: "max-w-md mx-auto", children: [_jsxs("div", { className: "flex items-center justify-center gap-3 mb-3", children: [_jsx("div", { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400" }), _jsxs("span", { className: "text-blue-400", children: [installProgress.message || 'Installing...', installProgress.stage && (_jsxs("span", { className: "ml-2 text-sm", style: { color: theme.colors.primary, opacity: 0.8 }, children: ["(", installProgress.stage, ")"] }))] })] }), installProgress.progress !== undefined && (_jsx("div", { className: "w-full rounded-full h-3 overflow-hidden", style: { backgroundColor: theme.colors.surface }, children: _jsx("div", { className: "bg-blue-500 h-full rounded-full transition-all duration-300", style: { width: `${installProgress.progress}%` } }) })), installProgress.message === 'Installation complete!' && (_jsx("div", { className: "mt-4", children: _jsx("button", { onClick: handleCheckInstallation, className: "text-sm transition-colors", style: { color: theme.colors.textSecondary }, onMouseEnter: (e) => (e.currentTarget.style.color = theme.colors.text), onMouseLeave: (e) => (e.currentTarget.style.color = theme.colors.textSecondary), children: "Check installation status" }) }))] })) : (_jsx(_Fragment, { children: _jsx("button", { onClick: () => {
                                    if (handleClaudeTourButtonClick && isClaudeTourActive && claudeTourStepIndex === 0) {
                                        handleClaudeTourButtonClick(0, onInstall);
                                    }
                                    else {
                                        onInstall();
                                    }
                                }, disabled: isProcessing || !isCurrentStep, "data-tour": "install-agent", className: "px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm", style: {
                                    backgroundColor: theme.colors.primary,
                                    color: theme.colors.background,
                                }, onMouseEnter: (e) => !e.currentTarget.disabled &&
                                    (e.currentTarget.style.backgroundColor = theme.colors.primary), onMouseLeave: (e) => !e.currentTarget.disabled &&
                                    (e.currentTarget.style.backgroundColor = theme.colors.primary), children: isProcessing
                                    ? 'Installing...'
                                    : `Install ${agentDisplayName} →` }) })) }))] })] }));
};
