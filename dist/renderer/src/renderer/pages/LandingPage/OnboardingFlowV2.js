import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Bot, Download, CheckCircle, AlertCircle, Activity, ArrowRight, ArrowLeft, Rocket, Code, Brain, GitBranch, FileCode, Terminal, Layers, Users, Target, TrendingUp, Shield, MessageSquare, ChevronRight } from 'lucide-react';
import { getAgentInfo, SupportedAgent, AGENT_INFO } from "@principal-ai/agent-monitoring";
import { APP_BRANDING } from '../../../shared/config/appBranding';
import { useTheme } from 'themed-markdown';
import { AgentInstallationService } from '../../main-process-api/AgentInstallationService';
import { AgentConfigurationService } from '../../main-process-api/AgentConfigurationService';
const ONBOARDING_STEPS = [
    {
        id: 'select-agent',
        title: 'Choose Your AI Partner',
        subtitle: 'Select the AI that matches your workflow'
    },
    {
        id: 'install-agent',
        title: 'Quick Setup',
        subtitle: 'Get your AI assistant ready in seconds'
    },
    {
        id: 'enable-planning',
        title: 'Collaborative Planning',
        subtitle: 'Enable context-aware code understanding'
    },
    {
        id: 'enable-monitoring',
        title: 'Development Insights',
        subtitle: 'Track and optimize your coding sessions'
    },
    {
        id: 'complete',
        title: 'Launch Your Journey',
        subtitle: 'Everything is configured and ready'
    }
];
export const OnboardingFlowV2 = ({ onComplete, onSkip }) => {
    const { theme } = useTheme();
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [agentStatus, setAgentStatus] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [installProgress, setInstallProgress] = useState(null);
    const [mcpEnabled, setMcpEnabled] = useState(false);
    const [hooksEnabled, setHooksEnabled] = useState(false);
    const [localInstallStatus, setLocalInstallStatus] = useState(null);
    // Check agent status - same as original
    const checkAgentStatus = useCallback(async () => {
        if (!selectedAgent)
            return;
        try {
            const status = await AgentConfigurationService.getAgentStatus(selectedAgent);
            setAgentStatus(status);
            if (status.isInstalled && localInstallStatus === null) {
                setLocalInstallStatus(status.isInstalled);
            }
            setHooksEnabled(status.hasHooks);
            if (status.isInstalled) {
                try {
                    const mcpResult = await AgentConfigurationService.getAgentMCPStatus(selectedAgent);
                    if (mcpResult.success && mcpResult.status) {
                        setMcpEnabled(mcpResult.status.hasMCP);
                    }
                }
                catch (error) {
                    console.error('Error checking MCP status:', error);
                }
            }
        }
        catch (error) {
            console.error('Error checking agent status:', error);
        }
    }, [selectedAgent, localInstallStatus]);
    useEffect(() => {
        checkAgentStatus();
    }, [checkAgentStatus]);
    // Handle agent selection - auto-advance to next step
    const handleSelectAgent = (agent) => {
        setSelectedAgent(agent);
        setError(null);
        setTimeout(() => setCurrentStep(1), 500); // Auto-advance after selection
    };
    // Installation handler - same as original
    const handleInstallAgent = useCallback(async () => {
        if (!selectedAgent)
            return;
        setError(null);
        setIsProcessing(true);
        const agentConfig = getAgentInfo(selectedAgent);
        if (selectedAgent === SupportedAgent.CLAUDE) {
            window.open(agentConfig.ui.downloadUrl, '_blank');
            setIsProcessing(false);
            setTimeout(() => checkAgentStatus(), 3000);
        }
        else {
            setInstallProgress({ message: 'Starting installation...' });
            const unsubscribeProgress = AgentInstallationService.onInstallProgress(selectedAgent, (progress) => {
                if (typeof progress === 'string') {
                    setInstallProgress({ message: progress });
                }
                else {
                    setInstallProgress(progress);
                }
            });
            const unsubscribeComplete = AgentInstallationService.onInstallComplete(selectedAgent, async () => {
                setInstallProgress({ message: 'Installation complete!' });
                setIsProcessing(false);
                try {
                    const installationStatus = await AgentInstallationService.checkInstallation(selectedAgent);
                    if (installationStatus.installed) {
                        setLocalInstallStatus(true);
                        setTimeout(() => {
                            checkAgentStatus();
                            setInstallProgress(null);
                            setCurrentStep(2);
                        }, 1000);
                    }
                }
                catch (error) {
                    console.error(`Error checking ${selectedAgent} status:`, error);
                }
                unsubscribeComplete();
                unsubscribeError();
                unsubscribeProgress?.();
            });
            const unsubscribeError = AgentInstallationService.onInstallError(selectedAgent, (error) => {
                setError(error);
                setIsProcessing(false);
                setInstallProgress(null);
                unsubscribeComplete();
                unsubscribeError();
                unsubscribeProgress?.();
            });
            try {
                await AgentInstallationService.install(selectedAgent);
            }
            catch (error) {
                setError(`Failed to install ${agentConfig.displayName}`);
                setIsProcessing(false);
                setInstallProgress(null);
            }
        }
    }, [selectedAgent, checkAgentStatus]);
    // MCP handler
    const handleEnableMCP = useCallback(async () => {
        if (!selectedAgent)
            return;
        setError(null);
        setIsProcessing(true);
        try {
            const result = await AgentConfigurationService.addMCPToAgent(selectedAgent, APP_BRANDING.MCP_SERVER_CONFIG_KEY);
            if (result.success && result.status) {
                setMcpEnabled(result.status.hasMCP);
                await checkAgentStatus();
                setTimeout(() => {
                    setCurrentStep(3);
                    setIsProcessing(false);
                }, 1000);
            }
            else {
                setError(result.error || 'Failed to enable MCP');
                setIsProcessing(false);
            }
        }
        catch (error) {
            setError('Error configuring MCP');
            setIsProcessing(false);
        }
    }, [selectedAgent, checkAgentStatus]);
    // Hooks handler
    const handleEnableHooks = useCallback(async () => {
        if (!selectedAgent)
            return;
        setError(null);
        setIsProcessing(true);
        try {
            const result = await AgentConfigurationService.addHooksToAgent(selectedAgent);
            if (result) {
                setHooksEnabled(true);
                await checkAgentStatus();
                setTimeout(() => {
                    setCurrentStep(4);
                    setIsProcessing(false);
                }, 1000);
            }
            else {
                setError('Failed to configure hooks');
                setIsProcessing(false);
            }
        }
        catch (error) {
            setError('Error configuring hooks');
            setIsProcessing(false);
        }
    }, [selectedAgent, checkAgentStatus]);
    // Progress dots at the top
    const ProgressDots = () => (_jsx("div", { style: {
            display: 'flex',
            gap: '8px',
            padding: '20px',
            justifyContent: 'center',
            borderBottom: `1px solid ${theme.colors.border}`,
        }, children: ONBOARDING_STEPS.map((_, index) => (_jsx("div", { style: {
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: index <= currentStep
                    ? theme.colors.primary
                    : theme.colors.backgroundTertiary,
                transition: 'all 0.3s ease',
            } }, index))) }));
    // Right side brand content for each step
    const renderBrandContent = () => {
        const step = ONBOARDING_STEPS[currentStep];
        switch (step.id) {
            case 'select-agent':
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '32px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                    }, children: [_jsxs("div", { children: [_jsxs("h1", { style: {
                                        fontSize: '42px',
                                        fontWeight: 700,
                                        color: theme.colors.text,
                                        marginBottom: '16px',
                                        lineHeight: 1.2,
                                    }, children: ["Your AI-Powered", _jsx("br", {}), "Development Team"] }), _jsx("p", { style: {
                                        fontSize: '18px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: 1.6,
                                    }, children: "Transform your coding experience with an AI assistant that understands your codebase, helps you plan features, and tracks your productivity." })] }), _jsxs("div", { style: {
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '20px',
                            }, children: [_jsxs("div", { style: {
                                        padding: '20px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        border: `1px solid ${theme.colors.border}`,
                                    }, children: [_jsx(Code, { size: 24, color: theme.colors.primary, style: { marginBottom: '12px' } }), _jsx("h3", { style: { fontSize: '16px', fontWeight: 600, color: theme.colors.text, marginBottom: '8px' }, children: "Smart Code Understanding" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "AI that truly understands your project structure and coding patterns" })] }), _jsxs("div", { style: {
                                        padding: '20px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        border: `1px solid ${theme.colors.border}`,
                                    }, children: [_jsx(Brain, { size: 24, color: theme.colors.primary, style: { marginBottom: '12px' } }), _jsx("h3", { style: { fontSize: '16px', fontWeight: 600, color: theme.colors.text, marginBottom: '8px' }, children: "Intelligent Planning" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Collaborate on architecture decisions and implementation strategies" })] }), _jsxs("div", { style: {
                                        padding: '20px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        border: `1px solid ${theme.colors.border}`,
                                    }, children: [_jsx(TrendingUp, { size: 24, color: theme.colors.primary, style: { marginBottom: '12px' } }), _jsx("h3", { style: { fontSize: '16px', fontWeight: 600, color: theme.colors.text, marginBottom: '8px' }, children: "Productivity Insights" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Track your development patterns and optimize your workflow" })] }), _jsxs("div", { style: {
                                        padding: '20px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        border: `1px solid ${theme.colors.border}`,
                                    }, children: [_jsx(Shield, { size: 24, color: theme.colors.primary, style: { marginBottom: '12px' } }), _jsx("h3", { style: { fontSize: '16px', fontWeight: 600, color: theme.colors.text, marginBottom: '8px' }, children: "Secure & Private" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Your code stays on your machine with full control over AI interactions" })] })] })] }));
            case 'install-agent':
                if (!selectedAgent)
                    return null;
                const agentInfo = AGENT_INFO[selectedAgent];
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '32px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${agentInfo.ui.color}05 0%, ${agentInfo.ui.color}10 100%)`,
                    }, children: [_jsx("div", { style: {
                                width: '120px',
                                height: '120px',
                                borderRadius: '24px',
                                background: `linear-gradient(135deg, ${agentInfo.ui.color}20, ${agentInfo.ui.color}40)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto',
                            }, children: _jsx(Bot, { size: 64, color: agentInfo.ui.color }) }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("h2", { style: {
                                        fontSize: '36px',
                                        fontWeight: 700,
                                        color: theme.colors.text,
                                        marginBottom: '16px',
                                    }, children: agentInfo.displayName }), _jsx("p", { style: {
                                        fontSize: '18px',
                                        color: theme.colors.textSecondary,
                                        maxWidth: '400px',
                                        margin: '0 auto',
                                        lineHeight: 1.6,
                                    }, children: agentInfo.ui.description })] }), _jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                padding: '24px',
                                borderRadius: '12px',
                                backgroundColor: theme.colors.background,
                                border: `1px solid ${theme.colors.border}`,
                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: `${agentInfo.ui.color}20`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }, children: _jsx(Terminal, { size: 20, color: agentInfo.ui.color }) }), _jsxs("div", { children: [_jsx("h4", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text }, children: "Command Line Integration" }), _jsx("p", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Works seamlessly with your terminal workflow" })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: `${agentInfo.ui.color}20`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }, children: _jsx(GitBranch, { size: 20, color: agentInfo.ui.color }) }), _jsxs("div", { children: [_jsx("h4", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text }, children: "Git-Aware" }), _jsx("p", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Understands your repository structure and history" })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: `${agentInfo.ui.color}20`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }, children: _jsx(FileCode, { size: 20, color: agentInfo.ui.color }) }), _jsxs("div", { children: [_jsx("h4", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text }, children: "Multi-Language Support" }), _jsx("p", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Works with all major programming languages" })] })] })] })] }));
            case 'enable-planning':
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '32px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                    }, children: [_jsxs("div", { style: {
                                padding: '24px',
                                borderRadius: '16px',
                                background: `linear-gradient(135deg, ${theme.colors.primary}10, ${theme.colors.primary}05)`,
                                border: `1px solid ${theme.colors.primary}30`,
                            }, children: [_jsxs("h2", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: theme.colors.text,
                                        marginBottom: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }, children: [_jsx(Brain, { size: 32, color: theme.colors.primary }), "MCP: Model Context Protocol"] }), _jsx("p", { style: {
                                        fontSize: '16px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: 1.6,
                                        marginBottom: '24px',
                                    }, children: "Enable your AI to maintain context across conversations, understand your entire codebase, and collaborate on complex architectural decisions." })] }), _jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                            }, children: [_jsx("h3", { style: {
                                        fontSize: '18px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '8px',
                                    }, children: "What You're Enabling:" }), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '16px',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                    }, children: [_jsx(Layers, { size: 24, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { children: [_jsx("h4", { style: { fontSize: '15px', fontWeight: 600, color: theme.colors.text, marginBottom: '4px' }, children: "Deep Code Understanding" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "AI can navigate your entire project structure, understanding relationships between files and modules" })] })] }), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '16px',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                    }, children: [_jsx(MessageSquare, { size: 24, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { children: [_jsx("h4", { style: { fontSize: '15px', fontWeight: 600, color: theme.colors.text, marginBottom: '4px' }, children: "Persistent Context" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Your AI remembers previous conversations and decisions, building on past discussions" })] })] }), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '16px',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                    }, children: [_jsx(Target, { size: 24, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { children: [_jsx("h4", { style: { fontSize: '15px', fontWeight: 600, color: theme.colors.text, marginBottom: '4px' }, children: "Smart Planning Mode" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Collaborate on implementation strategies before writing code" })] })] })] })] }));
            case 'enable-monitoring':
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '32px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                    }, children: [_jsxs("div", { style: {
                                padding: '24px',
                                borderRadius: '16px',
                                background: `linear-gradient(135deg, ${theme.colors.success}10, ${theme.colors.success}05)`,
                                border: `1px solid ${theme.colors.success}30`,
                            }, children: [_jsxs("h2", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: theme.colors.text,
                                        marginBottom: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }, children: [_jsx(Activity, { size: 32, color: theme.colors.success }), "Agent Event Monitoring"] }), _jsx("p", { style: {
                                        fontSize: '16px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: 1.6,
                                        marginBottom: '16px',
                                    }, children: "Track AI agent events to enable context handoff between sessions and gain insights into agent collaboration patterns for better git management." }), _jsxs("div", { style: {
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        backgroundColor: `${theme.colors.primary}10`,
                                        border: `1px solid ${theme.colors.primary}30`,
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '12px',
                                    }, children: [_jsx(Shield, { size: 20, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { children: [_jsx("p", { style: {
                                                        fontSize: '14px',
                                                        color: theme.colors.text,
                                                        fontWeight: 600,
                                                        marginBottom: '4px',
                                                    }, children: "\uD83D\uDD12 100% Private & Local" }), _jsx("p", { style: {
                                                        fontSize: '13px',
                                                        color: theme.colors.textSecondary,
                                                        lineHeight: 1.5,
                                                    }, children: "We never collect, store, or transmit your personal data, code, or usage patterns. Your privacy is our priority." })] })] })] }), _jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                            }, children: [_jsx("h4", { style: {
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '8px',
                                    }, children: "What This Enables:" }), _jsxs("div", { style: {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '16px',
                                    }, children: [_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '12px',
                                                padding: '16px',
                                                borderRadius: '12px',
                                                backgroundColor: theme.colors.backgroundSecondary,
                                            }, children: [_jsx(Users, { size: 24, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { children: [_jsx("h4", { style: { fontSize: '15px', fontWeight: 600, color: theme.colors.text, marginBottom: '4px' }, children: "Agent Context Handoff" }), _jsx("p", { style: { fontSize: '13px', color: theme.colors.textSecondary, lineHeight: 1.4 }, children: "Seamlessly transfer context between AI sessions, maintaining continuity across your development workflow" })] })] }), _jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '12px',
                                                padding: '16px',
                                                borderRadius: '12px',
                                                backgroundColor: theme.colors.backgroundSecondary,
                                            }, children: [_jsx(GitBranch, { size: 24, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { children: [_jsx("h4", { style: { fontSize: '15px', fontWeight: 600, color: theme.colors.text, marginBottom: '4px' }, children: "Git Collision Insights" }), _jsx("p", { style: { fontSize: '13px', color: theme.colors.textSecondary, lineHeight: 1.4 }, children: "Detect when multiple agents work on the same files, preventing merge conflicts and improving collaboration" })] })] })] })] }), _jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                            }, children: [_jsx("h4", { style: {
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                    }, children: "Agent Events We Monitor:" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(ChevronRight, { size: 16, color: theme.colors.primary }), _jsx("span", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "File edits and code generation from AI agents" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(ChevronRight, { size: 16, color: theme.colors.primary }), _jsx("span", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Tool usage patterns and command execution" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(ChevronRight, { size: 16, color: theme.colors.primary }), _jsx("span", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Git operations to detect potential conflicts" })] }), _jsx("div", { style: {
                                        marginTop: '12px',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        backgroundColor: `${theme.colors.success}10`,
                                        border: `1px solid ${theme.colors.success}30`,
                                        fontSize: '12px',
                                        color: theme.colors.success,
                                        fontWeight: 500,
                                    }, children: "\u2713 No cloud storage \u2022 \u2713 No telemetry \u2022 \u2713 No external servers \u2022 \u2713 You own your data" })] })] }));
            case 'complete':
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '32px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: `linear-gradient(135deg, ${theme.colors.primary}05 0%, ${theme.colors.success}05 100%)`,
                    }, children: [_jsx("div", { style: {
                                width: '160px',
                                height: '160px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${theme.colors.success}20, ${theme.colors.success}40)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: 'pulse 3s infinite',
                            }, children: _jsx(Rocket, { size: 80, color: theme.colors.success }) }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("h1", { style: {
                                        fontSize: '42px',
                                        fontWeight: 700,
                                        color: theme.colors.text,
                                        marginBottom: '16px',
                                    }, children: "You're All Set! \uD83C\uDF89" }), _jsx("p", { style: {
                                        fontSize: '18px',
                                        color: theme.colors.textSecondary,
                                        maxWidth: '500px',
                                        lineHeight: 1.6,
                                    }, children: "Your AI development environment is fully configured. You're ready to code smarter, faster, and with more confidence." })] }), _jsxs("div", { style: {
                                display: 'flex',
                                gap: '32px',
                                marginTop: '32px',
                            }, children: [_jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: {
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                backgroundColor: `${theme.colors.success}20`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 12px',
                                            }, children: _jsx(CheckCircle, { size: 32, color: theme.colors.success }) }), _jsx("div", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text }, children: "Agent Ready" })] }), mcpEnabled && (_jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: {
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                backgroundColor: `${theme.colors.success}20`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 12px',
                                            }, children: _jsx(Brain, { size: 32, color: theme.colors.success }) }), _jsx("div", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text }, children: "Context Enabled" })] })), hooksEnabled && (_jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: {
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                backgroundColor: `${theme.colors.success}20`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 12px',
                                            }, children: _jsx(Activity, { size: 32, color: theme.colors.success }) }), _jsx("div", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text }, children: "Tracking Active" })] }))] })] }));
            default:
                return null;
        }
    };
    // Left side action content
    const renderActionContent = () => {
        const step = ONBOARDING_STEPS[currentStep];
        switch (step.id) {
            case 'select-agent':
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                    }, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                        fontSize: '24px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '8px',
                                    }, children: step.title }), _jsx("p", { style: {
                                        fontSize: '16px',
                                        color: theme.colors.textSecondary,
                                    }, children: step.subtitle })] }), _jsx("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                            }, children: Object.values(SupportedAgent).map((agent) => {
                                const agentInfo = AGENT_INFO[agent];
                                const isSelected = selectedAgent === agent;
                                return (_jsxs("div", { onClick: () => handleSelectAgent(agent), style: {
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
                                    }, onMouseEnter: (e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.borderColor = agentInfo.ui.color + '60';
                                            e.currentTarget.style.backgroundColor = `${agentInfo.ui.color}05`;
                                        }
                                    }, onMouseLeave: (e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.borderColor = theme.colors.border;
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                        }
                                    }, children: [_jsx("div", { style: {
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '12px',
                                                background: `linear-gradient(135deg, ${agentInfo.ui.color}20, ${agentInfo.ui.color}40)`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }, children: _jsx(Bot, { size: 28, color: agentInfo.ui.color }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("h3", { style: {
                                                        fontSize: '18px',
                                                        fontWeight: 600,
                                                        color: theme.colors.text,
                                                        marginBottom: '4px',
                                                    }, children: agentInfo.displayName }), _jsx("p", { style: {
                                                        fontSize: '14px',
                                                        color: theme.colors.textSecondary,
                                                    }, children: agentInfo.ui.description })] }), isSelected && (_jsx(CheckCircle, { size: 24, color: agentInfo.ui.color }))] }, agent));
                            }) })] }));
            case 'install-agent':
                if (!selectedAgent)
                    return null;
                const agentInfo = AGENT_INFO[selectedAgent];
                const isInstalled = localInstallStatus !== null ? localInstallStatus : agentStatus?.isInstalled;
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                    }, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                        fontSize: '24px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '8px',
                                    }, children: isInstalled ? `${agentInfo.displayName} is Ready` : step.title }), _jsx("p", { style: {
                                        fontSize: '16px',
                                        color: theme.colors.textSecondary,
                                    }, children: isInstalled
                                        ? 'Your AI assistant is installed and ready to use'
                                        : step.subtitle })] }), installProgress && (_jsxs("div", { style: {
                                padding: '16px',
                                borderRadius: '12px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                border: `1px solid ${theme.colors.border}`,
                            }, children: [_jsx("p", { style: {
                                        fontSize: '14px',
                                        color: theme.colors.textSecondary,
                                        marginBottom: installProgress.progress ? '12px' : 0,
                                    }, children: installProgress.message }), installProgress.progress !== undefined && (_jsx("div", { style: {
                                        width: '100%',
                                        height: '8px',
                                        borderRadius: '4px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        overflow: 'hidden',
                                    }, children: _jsx("div", { style: {
                                            width: `${installProgress.progress}%`,
                                            height: '100%',
                                            backgroundColor: theme.colors.primary,
                                            transition: 'width 0.3s ease',
                                        } }) }))] })), error && (_jsxs("div", { style: {
                                padding: '16px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }, children: [_jsx(AlertCircle, { size: 20, color: "#f87171" }), _jsx("span", { style: { color: '#f87171' }, children: error })] })), _jsxs("div", { style: { display: 'flex', gap: '16px' }, children: [!isInstalled ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: handleInstallAgent, disabled: isProcessing, style: {
                                                padding: '14px 28px',
                                                borderRadius: '12px',
                                                backgroundColor: isProcessing ? theme.colors.backgroundTertiary : theme.colors.primary,
                                                color: isProcessing ? theme.colors.textSecondary : 'white',
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                border: 'none',
                                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }, children: isProcessing ? (_jsx(_Fragment, { children: "Installing..." })) : (_jsxs(_Fragment, { children: [_jsx(Download, { size: 20 }), selectedAgent === SupportedAgent.CLAUDE ? 'Download' : 'Install'] })) }), selectedAgent === SupportedAgent.CLAUDE && (_jsx("button", { onClick: checkAgentStatus, style: {
                                                padding: '14px 28px',
                                                borderRadius: '12px',
                                                backgroundColor: 'transparent',
                                                color: theme.colors.primary,
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                border: `2px solid ${theme.colors.primary}`,
                                                cursor: 'pointer',
                                            }, children: "Check Status" }))] })) : (_jsxs("button", { onClick: () => setCurrentStep(2), style: {
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
                                    }, children: ["Continue", _jsx(ArrowRight, { size: 20 })] })), _jsxs("button", { onClick: () => setCurrentStep(0), disabled: isProcessing, style: {
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
                                    }, children: [_jsx(ArrowLeft, { size: 20 }), "Back"] })] })] }));
            case 'enable-planning':
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                    }, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                        fontSize: '24px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '8px',
                                    }, children: mcpEnabled ? 'Planning Enabled!' : step.title }), _jsx("p", { style: {
                                        fontSize: '16px',
                                        color: theme.colors.textSecondary,
                                    }, children: mcpEnabled
                                        ? 'Your AI now has enhanced context and planning capabilities'
                                        : step.subtitle })] }), error && (_jsxs("div", { style: {
                                padding: '16px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }, children: [_jsx(AlertCircle, { size: 20, color: "#f87171" }), _jsx("span", { style: { color: '#f87171' }, children: error })] })), _jsxs("div", { style: { display: 'flex', gap: '16px' }, children: [!mcpEnabled ? (_jsx("button", { onClick: handleEnableMCP, disabled: isProcessing, style: {
                                        padding: '14px 28px',
                                        borderRadius: '12px',
                                        backgroundColor: isProcessing ? theme.colors.backgroundTertiary : theme.colors.primary,
                                        color: isProcessing ? theme.colors.textSecondary : 'white',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        border: 'none',
                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }, children: isProcessing ? 'Enabling...' : 'Enable Planning' })) : (_jsxs("button", { onClick: () => setCurrentStep(3), style: {
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
                                    }, children: ["Continue", _jsx(ArrowRight, { size: 20 })] })), _jsx("button", { onClick: () => setCurrentStep(3), disabled: isProcessing, style: {
                                        padding: '14px 28px',
                                        borderRadius: '12px',
                                        backgroundColor: 'transparent',
                                        color: theme.colors.textSecondary,
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        border: `1px solid ${theme.colors.border}`,
                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    }, children: "Skip for Now" })] })] }));
            case 'enable-monitoring':
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                    }, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                        fontSize: '24px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '8px',
                                    }, children: hooksEnabled ? 'Monitoring Active!' : step.title }), _jsx("p", { style: {
                                        fontSize: '16px',
                                        color: theme.colors.textSecondary,
                                    }, children: hooksEnabled
                                        ? 'Your development activities are being tracked for insights'
                                        : step.subtitle })] }), error && (_jsxs("div", { style: {
                                padding: '16px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }, children: [_jsx(AlertCircle, { size: 20, color: "#f87171" }), _jsx("span", { style: { color: '#f87171' }, children: error })] })), _jsxs("div", { style: { display: 'flex', gap: '16px' }, children: [!hooksEnabled ? (_jsx("button", { onClick: handleEnableHooks, disabled: isProcessing, style: {
                                        padding: '14px 28px',
                                        borderRadius: '12px',
                                        backgroundColor: isProcessing ? theme.colors.backgroundTertiary : theme.colors.primary,
                                        color: isProcessing ? theme.colors.textSecondary : 'white',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        border: 'none',
                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }, children: isProcessing ? 'Enabling...' : 'Enable Monitoring' })) : (_jsxs("button", { onClick: () => setCurrentStep(4), style: {
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
                                    }, children: ["Continue", _jsx(ArrowRight, { size: 20 })] })), _jsx("button", { onClick: () => setCurrentStep(4), disabled: isProcessing, style: {
                                        padding: '14px 28px',
                                        borderRadius: '12px',
                                        backgroundColor: 'transparent',
                                        color: theme.colors.textSecondary,
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        border: `1px solid ${theme.colors.border}`,
                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    }, children: "Skip for Now" })] })] }));
            case 'complete':
                return (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        padding: '48px',
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }, children: [_jsxs("button", { onClick: onComplete, style: {
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
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = `0 8px 24px ${theme.colors.primary}40`;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }, children: ["Get Started", _jsx(Rocket, { size: 20 })] }), _jsx("button", { onClick: onComplete, style: {
                                padding: '14px 28px',
                                borderRadius: '12px',
                                backgroundColor: 'transparent',
                                color: theme.colors.textSecondary,
                                fontSize: '16px',
                                fontWeight: 600,
                                border: `1px solid ${theme.colors.border}`,
                                cursor: 'pointer',
                            }, children: "View Advanced Settings" })] }));
            default:
                return null;
        }
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.colors.background,
        }, children: [_jsx("style", { children: `
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
      ` }), _jsx(ProgressDots, {}), _jsxs("div", { style: {
                    flex: 1,
                    display: 'flex',
                    overflow: 'hidden',
                }, children: [_jsx("div", { style: {
                            width: '40%',
                            minWidth: '400px',
                            backgroundColor: theme.colors.background,
                            borderRight: `1px solid ${theme.colors.border}`,
                            overflow: 'auto',
                        }, children: renderActionContent() }), _jsx("div", { style: {
                            flex: 1,
                            backgroundColor: theme.colors.backgroundSecondary,
                            overflow: 'auto',
                        }, children: renderBrandContent() })] }), currentStep < 4 && (_jsx("button", { onClick: onSkip, style: {
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
                }, children: "Skip Setup" }))] }));
};
