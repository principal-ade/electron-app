import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useTheme } from 'themed-markdown';
export const RemoteAgentTitlebar = () => {
    const { theme } = useTheme();
    const [agents, setAgents] = useState([]);
    const [activeAgentId, setActiveAgentId] = useState(null);
    useEffect(() => {
        // Subscribe to agent list changes
        const unsubscribeList = window.mainProcess.remoteAgentWindow.onRemoteAgentListChanged((agentList, activeId) => {
            setAgents(agentList);
            setActiveAgentId(activeId);
        });
        // Subscribe to active agent changes
        const unsubscribeActive = window.mainProcess.remoteAgentWindow.onRemoteAgentActiveChanged((agentId) => {
            setActiveAgentId(agentId);
        });
        // Load initial state
        (async () => {
            try {
                const agentList = await window.mainProcess.remoteAgentWindow.listRemoteAgents();
                const activeId = await window.mainProcess.remoteAgentWindow.getActiveAgentId();
                setAgents(agentList);
                setActiveAgentId(activeId);
            }
            catch (error) {
                console.error('Failed to load initial agent state:', error);
            }
        })();
        return () => {
            unsubscribeList();
            unsubscribeActive();
        };
    }, []);
    const handleSwitchAgent = async (agentId) => {
        try {
            await window.mainProcess.remoteAgentWindow.switchToAgent(agentId);
        }
        catch (error) {
            console.error('Failed to switch agent:', error);
        }
    };
    const handleCloseAgent = async (agentId, e) => {
        e.stopPropagation();
        try {
            await window.mainProcess.remoteAgentWindow.closeRemoteAgent(agentId);
        }
        catch (error) {
            console.error('Failed to close agent:', error);
        }
    };
    return (_jsxs("div", { style: {
            height: '40px',
            background: theme.colors?.background || '#2d2d2d',
            borderBottom: `1px solid ${theme.colors?.border || '#444'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px 0 80px',
            WebkitAppRegion: 'drag',
            color: theme.colors?.text || '#fff',
            fontFamily: theme.fonts?.body || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }, children: [_jsx("div", { style: { flex: 1 }, children: agents.length === 0 ? (_jsx("span", { style: { opacity: 0.6 }, children: "Remote Agents" })) : null }), _jsx("div", { style: {
                    WebkitAppRegion: 'no-drag',
                    display: 'flex',
                    gap: '6px',
                }, children: agents.map((agent) => (_jsxs("div", { onClick: () => handleSwitchAgent(agent.id), style: {
                        padding: '6px 12px',
                        background: activeAgentId === agent.id
                            ? (theme.colors?.primary || '#007acc')
                            : (theme.colors?.surface || '#1e1e1e'),
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s',
                        fontSize: '13px',
                    }, onMouseEnter: (e) => {
                        if (activeAgentId !== agent.id) {
                            e.currentTarget.style.background = theme.colors?.hover || '#333';
                        }
                    }, onMouseLeave: (e) => {
                        if (activeAgentId !== agent.id) {
                            e.currentTarget.style.background = theme.colors?.surface || '#1e1e1e';
                        }
                    }, children: [_jsx("span", { children: agent.name }), _jsx("button", { onClick: (e) => handleCloseAgent(agent.id, e), style: {
                                background: 'transparent',
                                border: 'none',
                                color: theme.colors?.text || '#fff',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                fontSize: '16px',
                                lineHeight: '1',
                                opacity: 0.6,
                                transition: 'opacity 0.2s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.opacity = '1';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.opacity = '0.6';
                            }, children: "\u00D7" })] }, agent.id))) })] }));
};
