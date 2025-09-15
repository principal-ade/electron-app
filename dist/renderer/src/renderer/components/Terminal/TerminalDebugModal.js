import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X, RefreshCw, Terminal, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { TerminalService } from '../../main-process-api/TerminalService';
export const TerminalDebugModal = ({ isOpen, onClose, currentSessionId, tabs = [] }) => {
    const { theme } = useTheme();
    const [sessions, setSessions] = useState([]);
    const [sessionsByRepo, setSessionsByRepo] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const [cleaningUp, setCleaningUp] = useState(false);
    const fetchSessions = async () => {
        setLoading(true);
        setError(null);
        try {
            const sessionList = await TerminalService.list();
            setSessions(sessionList);
            // Try to infer repo associations from directories
            const repoMap = new Map();
            sessionList.forEach(session => {
                repoMap.set(session.directory, session.id);
            });
            setSessionsByRepo(repoMap);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
            console.error('Failed to fetch terminal sessions:', err);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (isOpen) {
            fetchSessions();
        }
    }, [isOpen, refreshCount]);
    const getOrphanedSessions = () => {
        return sessions.filter(session => {
            const hasUITab = tabs.some(t => t.sessionId === session.id);
            return !hasUITab;
        });
    };
    const cleanupOrphanedSessions = async () => {
        setCleaningUp(true);
        setError(null);
        const orphaned = getOrphanedSessions();
        console.log('[TerminalDebug] Cleaning up', orphaned.length, 'orphaned sessions');
        try {
            for (const session of orphaned) {
                console.log('[TerminalDebug] Destroying session:', session.id);
                await TerminalService.destroy(session.id);
            }
            // Refresh the list after cleanup
            setRefreshCount(c => c + 1);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cleanup sessions');
            console.error('Failed to cleanup orphaned sessions:', err);
        }
        finally {
            setCleaningUp(false);
        }
    };
    const destroySession = async (sessionId) => {
        try {
            console.log('[TerminalDebug] Destroying individual session:', sessionId);
            await TerminalService.destroy(sessionId);
            setRefreshCount(c => c + 1);
        }
        catch (err) {
            console.error('Failed to destroy session:', err);
            setError(err instanceof Error ? err.message : 'Failed to destroy session');
        }
    };
    if (!isOpen)
        return null;
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };
    const formatDuration = (timestamp) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60)
            return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60)
            return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                width: '90%',
                maxWidth: '800px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        borderBottom: `1px solid ${theme.colors.border}`
                    }, children: [_jsxs("h2", { style: {
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }, children: [_jsx(Terminal, { size: 20 }), "Terminal Debug Information"] }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [getOrphanedSessions().length > 0 && (_jsxs("button", { onClick: cleanupOrphanedSessions, disabled: cleaningUp, style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        backgroundColor: theme.colors.error + '22',
                                        border: `1px solid ${theme.colors.error}`,
                                        borderRadius: '4px',
                                        color: theme.colors.error,
                                        cursor: cleaningUp ? 'not-allowed' : 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        opacity: cleaningUp ? 0.5 : 1
                                    }, title: "Clean up all orphaned sessions", children: [_jsx(Trash2, { size: 14 }), "Clean ", getOrphanedSessions().length, " Orphaned"] })), _jsx("button", { onClick: () => setRefreshCount(c => c + 1), style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '32px',
                                        height: '32px',
                                        backgroundColor: 'transparent',
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '4px',
                                        color: theme.colors.text,
                                        cursor: 'pointer'
                                    }, title: "Refresh", children: _jsx(RefreshCw, { size: 16 }) }), _jsx("button", { onClick: onClose, style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '32px',
                                        height: '32px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: theme.colors.textSecondary,
                                        cursor: 'pointer'
                                    }, children: _jsx(X, { size: 20 }) })] })] }), _jsxs("div", { style: {
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px'
                    }, children: [_jsxs("div", { style: {
                                marginBottom: '24px',
                                padding: '12px',
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '6px',
                                border: `1px solid ${theme.colors.border}`
                            }, children: [_jsx("h3", { style: {
                                        margin: '0 0 12px 0',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text
                                    }, children: "Current State" }), _jsxs("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: [_jsxs("div", { style: { marginBottom: '8px' }, children: [_jsx("strong", { children: "Active Session ID:" }), ' ', _jsx("code", { style: {
                                                        padding: '2px 4px',
                                                        backgroundColor: theme.colors.backgroundTertiary,
                                                        borderRadius: '3px',
                                                        fontFamily: 'monospace'
                                                    }, children: currentSessionId || 'none' })] }), _jsxs("div", { style: { marginBottom: '8px' }, children: [_jsx("strong", { children: "Total Sessions:" }), " ", sessions.length, " / 10 max"] }), _jsxs("div", { children: [_jsx("strong", { children: "UI Tabs:" }), " ", tabs.length, " tabs", tabs.length > 0 && (_jsx("ul", { style: { margin: '4px 0 0 20px', padding: 0 }, children: tabs.map(tab => (_jsxs("li", { style: { marginBottom: '4px' }, children: [tab.label, " - Tab ID: ", tab.id, tab.sessionId && (_jsxs(_Fragment, { children: [' → Session: ', _jsxs("code", { style: {
                                                                            padding: '2px 4px',
                                                                            backgroundColor: theme.colors.backgroundTertiary,
                                                                            borderRadius: '3px',
                                                                            fontFamily: 'monospace',
                                                                            fontSize: '11px'
                                                                        }, children: [tab.sessionId.substring(0, 8), "..."] })] })), tab.command && (_jsxs("span", { style: { color: theme.colors.primary }, children: [' ', "(cmd: ", tab.command, ")"] }))] }, tab.id))) }))] })] })] }), _jsxs("div", { style: { marginBottom: '24px' }, children: [_jsx("h3", { style: {
                                        margin: '0 0 12px 0',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text
                                    }, children: "Active Terminal Sessions (Backend)" }), loading ? (_jsx("div", { style: { color: theme.colors.textSecondary, fontSize: '12px' }, children: "Loading sessions..." })) : error ? (_jsxs("div", { style: {
                                        color: theme.colors.error,
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }, children: [_jsx(AlertCircle, { size: 14 }), error] })) : sessions.length === 0 ? (_jsx("div", { style: { color: theme.colors.textTertiary, fontSize: '12px' }, children: "No active terminal sessions" })) : (_jsx("div", { style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }, children: sessions.map(session => {
                                        const isCurrentSession = session.id === currentSessionId;
                                        const hasUITab = tabs.some(t => t.sessionId === session.id);
                                        return (_jsxs("div", { style: {
                                                padding: '12px',
                                                backgroundColor: isCurrentSession ?
                                                    theme.colors.primary + '11' :
                                                    theme.colors.backgroundSecondary,
                                                border: `1px solid ${isCurrentSession ? theme.colors.primary : theme.colors.border}`,
                                                borderRadius: '6px',
                                                fontSize: '12px'
                                            }, children: [_jsxs("div", { style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        marginBottom: '8px'
                                                    }, children: [_jsx("code", { style: {
                                                                fontFamily: 'monospace',
                                                                fontWeight: 600,
                                                                color: theme.colors.text
                                                            }, children: session.id }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [isCurrentSession && (_jsx("span", { style: {
                                                                        padding: '2px 6px',
                                                                        backgroundColor: theme.colors.primary,
                                                                        color: '#fff',
                                                                        borderRadius: '3px',
                                                                        fontSize: '10px',
                                                                        fontWeight: 600
                                                                    }, children: "CURRENT" })), hasUITab ? (_jsxs("span", { style: {
                                                                        padding: '2px 6px',
                                                                        backgroundColor: theme.colors.success + '22',
                                                                        color: theme.colors.success,
                                                                        borderRadius: '3px',
                                                                        fontSize: '10px',
                                                                        fontWeight: 600,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '3px'
                                                                    }, children: [_jsx(CheckCircle, { size: 10 }), "HAS TAB"] })) : (_jsx("span", { style: {
                                                                        padding: '2px 6px',
                                                                        backgroundColor: theme.colors.warning + '22',
                                                                        color: theme.colors.warning,
                                                                        borderRadius: '3px',
                                                                        fontSize: '10px',
                                                                        fontWeight: 600
                                                                    }, children: "ORPHANED" }))] })] }), _jsxs("div", { style: { color: theme.colors.textSecondary }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Directory:" }), " ", session.directory] }), _jsxs("div", { children: [_jsx("strong", { children: "Created:" }), " ", formatTime(session.createdAt), " (", formatDuration(session.createdAt), ")"] }), _jsxs("div", { children: [_jsx("strong", { children: "Last Activity:" }), " ", formatTime(session.lastActivity), " (", formatDuration(session.lastActivity), ")"] }), session.agentSessionId && (_jsxs("div", { children: [_jsx("strong", { children: "Agent Session:" }), " ", session.agentSessionId] }))] }), !hasUITab && (_jsxs("div", { style: {
                                                        marginTop: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '8px',
                                                        backgroundColor: theme.colors.warning + '11',
                                                        borderRadius: '4px',
                                                        fontSize: '11px'
                                                    }, children: [_jsx("span", { style: { color: theme.colors.warning }, children: "\u26A0\uFE0F This session exists in backend but has no UI tab - potential leak" }), _jsxs("button", { onClick: () => destroySession(session.id), style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                padding: '4px 8px',
                                                                backgroundColor: theme.colors.error,
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '3px',
                                                                fontSize: '10px',
                                                                fontWeight: 600,
                                                                cursor: 'pointer'
                                                            }, title: "Destroy this session", children: [_jsx(Trash2, { size: 12 }), "DESTROY"] })] }))] }, session.id));
                                    }) }))] }), _jsxs("div", { children: [_jsx("h3", { style: {
                                        margin: '0 0 12px 0',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text
                                    }, children: "Repository \u2192 Session Mapping" }), sessionsByRepo.size === 0 ? (_jsx("div", { style: { color: theme.colors.textTertiary, fontSize: '12px' }, children: "No repository mappings found" })) : (_jsx("div", { style: {
                                        fontSize: '12px',
                                        fontFamily: 'monospace',
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '6px',
                                        border: `1px solid ${theme.colors.border}`
                                    }, children: Array.from(sessionsByRepo.entries()).map(([repo, sessionId]) => (_jsxs("div", { style: { marginBottom: '4px' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: repo }), ' → ', _jsxs("span", { style: { color: theme.colors.primary }, children: [sessionId.substring(0, 8), "..."] })] }, repo))) }))] })] }), _jsxs("div", { style: {
                        padding: '16px',
                        borderTop: `1px solid ${theme.colors.border}`,
                        fontSize: '12px',
                        color: theme.colors.textSecondary
                    }, children: [_jsx("strong", { children: "Debug Tips:" }), _jsxs("ul", { style: { margin: '4px 0 0 0', padding: '0 0 0 20px' }, children: [_jsx("li", { children: "Sessions should be destroyed when tabs close" }), _jsx("li", { children: "Maximum 10 concurrent sessions allowed" }), _jsx("li", { children: "Orphaned sessions indicate a cleanup issue" }), _jsx("li", { children: "Sessions persist across view switches but UI tabs may not" })] })] })] }) }));
};
