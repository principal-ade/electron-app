import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useCallback } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { TerminalService } from '../../../main-process-api/TerminalService';
import { getTerminalSessionCount } from '../../../utils/terminalCleanup';
export const TerminalCleanupButton = ({ currentSessionId, onCleanupComplete }) => {
    const { theme } = useTheme();
    const [sessionCount, setSessionCount] = useState(0);
    const [isClearing, setIsClearing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    // Check session count periodically
    React.useEffect(() => {
        const checkCount = async () => {
            const count = await getTerminalSessionCount();
            setSessionCount(count);
        };
        checkCount();
        const interval = setInterval(checkCount, 5000); // Check every 5 seconds
        return () => clearInterval(interval);
    }, []);
    const handleClearAll = useCallback(async () => {
        setIsClearing(true);
        try {
            const sessions = await TerminalService.list();
            if (sessions) {
                for (const session of sessions) {
                    // Skip the current session if provided
                    if (currentSessionId && session.id === currentSessionId) {
                        continue;
                    }
                    try {
                        await TerminalService.destroy(session.id);
                        console.log('[TerminalCleanup] Destroyed session:', session.id);
                    }
                    catch (err) {
                        console.error('[TerminalCleanup] Failed to destroy session:', session.id, err);
                    }
                }
            }
            // Update count
            const newCount = await getTerminalSessionCount();
            setSessionCount(newCount);
            onCleanupComplete?.();
        }
        catch (err) {
            console.error('[TerminalCleanup] Failed to clear terminals:', err);
        }
        finally {
            setIsClearing(false);
            setShowConfirm(false);
        }
    }, [currentSessionId, onCleanupComplete]);
    // Only show button if we're approaching the limit
    if (sessionCount < 7) {
        return null;
    }
    const isAtLimit = sessionCount >= 10;
    return (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { onClick: () => setShowConfirm(true), disabled: isClearing, style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: isAtLimit ? theme.colors.error : theme.colors.warning,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: isClearing ? 'wait' : 'pointer',
                    opacity: isClearing ? 0.7 : 1
                }, title: `${sessionCount}/10 terminal sessions active`, children: [isAtLimit ? _jsx(AlertCircle, { size: 12 }) : _jsx(Trash2, { size: 12 }), isClearing ? 'Clearing...' : `Clear Terminals (${sessionCount}/10)`] }), showConfirm && !isClearing && (_jsxs("div", { style: {
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '200px'
                }, children: [_jsxs("p", { style: {
                            fontSize: '12px',
                            color: theme.colors.text,
                            marginBottom: '8px'
                        }, children: ["Clear all ", sessionCount, " terminal sessions?", currentSessionId && ' (keeping current)'] }), _jsxs("div", { style: {
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'flex-end'
                        }, children: [_jsx("button", { onClick: () => setShowConfirm(false), style: {
                                    padding: '4px 12px',
                                    backgroundColor: theme.colors.backgroundTertiary,
                                    color: theme.colors.text,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer'
                                }, children: "Cancel" }), _jsx("button", { onClick: handleClearAll, style: {
                                    padding: '4px 12px',
                                    backgroundColor: theme.colors.error,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }, children: "Clear All" })] })] }))] }));
};
