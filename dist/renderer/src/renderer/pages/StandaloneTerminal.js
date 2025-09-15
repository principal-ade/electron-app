import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from 'themed-markdown';
import TerminalPanel from '../components/Terminal/TerminalPanel';
import { TerminalService } from '../main-process-api/TerminalService';
import { AgentSessionService } from '../main-process-api/AgentSessionService';
export const StandaloneTerminal = () => {
    const { sessionId } = useParams();
    const { theme } = useTheme();
    const [terminalInfo, setTerminalInfo] = useState(null);
    const [aiSession, setAiSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!sessionId) {
            setError('No session ID provided');
            setLoading(false);
            return;
        }
        const loadTerminalInfo = async () => {
            try {
                setLoading(true);
                // Get list of terminals and find the one matching our session ID
                const terminals = await TerminalService.list();
                const terminal = terminals?.find((t) => t.id === sessionId);
                if (!terminal) {
                    throw new Error(`Terminal session ${sessionId} not found`);
                }
                setTerminalInfo(terminal);
                // If there's an associated AI session, get its info
                if (terminal.agentSessionId && terminal.directory) {
                    try {
                        const session = await AgentSessionService.getSession(terminal.directory, terminal.agentSessionId);
                        if (session) {
                            setAiSession({
                                sessionId: session.sessionId,
                                metadata: session.metadata,
                            });
                        }
                    }
                    catch (aiError) {
                        console.warn('Failed to load AI session info:', aiError);
                        // Don't fail the whole component if AI session loading fails
                    }
                }
            }
            catch (err) {
                console.error('Failed to load terminal info:', err);
                setError(err instanceof Error ? err.message : 'Failed to load terminal');
            }
            finally {
                setLoading(false);
            }
        };
        loadTerminalInfo();
    }, [sessionId]);
    if (loading) {
        return (_jsx("div", { style: {
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
            }, children: _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: '16px', marginBottom: '8px' }, children: "Loading terminal..." }), _jsxs("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: ["Session: ", sessionId?.slice(0, 8)] })] }) }));
    }
    if (error || !terminalInfo) {
        return (_jsx("div", { style: {
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
            }, children: _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: {
                            fontSize: '16px',
                            marginBottom: '8px',
                            color: theme.colors.error,
                        }, children: error || 'Terminal not found' }), _jsxs("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: ["Session: ", sessionId?.slice(0, 8)] }), _jsx("button", { onClick: () => window.close(), style: {
                            marginTop: '16px',
                            padding: '8px 16px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            color: theme.colors.text,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }, children: "Close Window" })] }) }));
    }
    return (_jsxs("div", { style: {
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme.colors.background,
        }, children: [aiSession && (_jsxs("div", { style: {
                    padding: '8px 16px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: theme.colors.primary, strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M12 1v6m0 6v6m11-7h-6m-6 0H1" })] }), _jsxs("span", { style: {
                            fontSize: '13px',
                            color: theme.colors.text,
                            fontWeight: '500',
                        }, children: ["AI Session:", ' ', aiSession.metadata?.customName || aiSession.sessionId.slice(0, 8)] })] })), _jsx("div", { style: { flex: 1, minHeight: 0 }, children: _jsx(TerminalPanel, { directory: terminalInfo.directory, terminalId: sessionId, onClose: () => window.close(), className: "h-full", agentSessionId: terminalInfo.agentSessionId }) })] }));
};
