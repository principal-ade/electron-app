import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X, Bot, Terminal, Download } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { SupportedAgent, getAgentInfo } from "@principal-ai/agent-monitoring";
import { AgentConfigurationService } from '../../main-process-api/AgentConfigurationService';
import { ShellService } from '../../main-process-api/ShellService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { DEFAULT_TERMINAL } from '../../../shared/types/terminal.types';
export const AgentSelectionModal = ({ isOpen, onClose, sources, repositoryName, }) => {
    const { theme } = useTheme();
    const [agentStatus, setAgentStatus] = useState({});
    const [isLaunching, setIsLaunching] = useState(false);
    const [preferredTerminal, setPreferredTerminal] = useState(DEFAULT_TERMINAL);
    // Load agent installation status
    useEffect(() => {
        if (isOpen) {
            const loadAgentStatus = async () => {
                try {
                    const status = await AgentConfigurationService.checkAgentInstallations();
                    setAgentStatus(status);
                }
                catch (error) {
                    console.error('Failed to check agent installations:', error);
                }
            };
            const loadPreferences = async () => {
                try {
                    const prefs = await UserPreferencesService.getPreferences();
                    setPreferredTerminal(prefs.defaultTerminal || DEFAULT_TERMINAL);
                }
                catch (error) {
                    console.error('Failed to load preferences:', error);
                }
            };
            loadAgentStatus();
            loadPreferences();
        }
    }, [isOpen]);
    const handleLaunchAgent = async (agent) => {
        if (sources.length === 0 || isLaunching)
            return;
        setIsLaunching(true);
        try {
            const localSource = sources.find(s => s.type === 'local');
            if (!localSource) {
                console.error('No local source found');
                return;
            }
            const agentInfo = getAgentInfo(agent);
            const agentCommand = agentInfo.installation.binaryName || `principal-${agent}`;
            console.log(`Launching ${agent} with command: ${agentCommand} in ${localSource.location}`);
            const result = await ShellService.openInTerminal({
                terminal: preferredTerminal,
                dir: localSource.location,
                command: agentCommand,
            });
            if (result.success) {
                console.log(`Successfully launched ${agent} in:`, localSource.location);
                onClose();
            }
            else {
                console.error('Failed to launch agent:', result.error);
                alert(`Failed to launch ${agent}: ${result.error || 'Unknown error'}`);
            }
        }
        catch (error) {
            console.error('Error launching agent:', error);
            alert(`Error launching agent: ${error}`);
        }
        finally {
            setIsLaunching(false);
        }
    };
    if (!isOpen)
        return null;
    // Get installed agents
    const installedAgents = Object.values(SupportedAgent).filter(agent => agentStatus[agent]?.isInstalled);
    return (_jsx("div", { onClick: onClose, style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000
        }, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), style: {
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                boxShadow: theme.shadows[1] || theme.shadows[0]
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '24px'
                    }, children: [_jsx(Bot, { size: 20, color: theme.colors.primary }), _jsx("h3", { style: {
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 600,
                                color: theme.colors.text
                            }, children: "Select Agent" }), _jsx("button", { onClick: onClose, style: {
                                marginLeft: 'auto',
                                background: 'none',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                padding: '4px'
                            }, children: _jsx(X, { size: 20 }) })] }), installedAgents.length === 0 ? (_jsxs("div", { style: {
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: theme.colors.textSecondary
                    }, children: [_jsx("p", { style: { margin: '0 0 20px 0', fontSize: '14px' }, children: "No agents installed" }), _jsxs("button", { onClick: () => {
                                window.open('https://github.com/principle-md/principal-claude', '_blank');
                            }, style: {
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: `1px solid ${theme.colors.primary}`,
                                backgroundColor: 'transparent',
                                color: theme.colors.primary,
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }, children: [_jsx(Download, { size: 16 }), "Install Agents"] })] })) : (_jsx("div", { style: {
                        display: 'grid',
                        gridTemplateColumns: installedAgents.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '12px'
                    }, children: installedAgents.map(agent => {
                        const agentInfo = getAgentInfo(agent);
                        return (_jsxs("button", { onClick: () => handleLaunchAgent(agent), disabled: isLaunching, style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '24px 16px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '12px',
                                cursor: isLaunching ? 'wait' : 'pointer',
                                transition: 'all 0.2s',
                                opacity: isLaunching ? 0.6 : 1
                            }, onMouseEnter: (e) => {
                                if (!isLaunching) {
                                    e.currentTarget.style.backgroundColor = theme.colors.primary + '22';
                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                e.currentTarget.style.borderColor = theme.colors.border;
                                e.currentTarget.style.transform = 'translateY(0)';
                            }, children: [_jsx("div", { style: {
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '10px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: theme.colors.primary
                                    }, children: _jsx(Terminal, { size: 24 }) }), _jsx("div", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text
                                    }, children: agentInfo.name })] }, agent));
                    }) }))] }) }));
};
