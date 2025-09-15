import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { X, Download, Info } from 'lucide-react';
import { useAgentUpdateNotifications } from '../hooks/useAgentUpdateNotifications';
export const AgentUpdateNotifications = () => {
    const { theme } = useTheme();
    const { notifications, dismissNotification } = useAgentUpdateNotifications();
    if (notifications.length === 0) {
        return null;
    }
    return (_jsxs("div", { style: {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '400px',
        }, children: [notifications.map(notification => (_jsx("div", { style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.primary}`,
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    animation: 'slideIn 0.3s ease-out',
                }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'start', gap: '12px' }, children: [_jsx(Info, { size: 20, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("h4", { style: {
                                        margin: '0 0 4px 0',
                                        color: theme.colors.text,
                                        fontSize: '14px',
                                        fontWeight: 600,
                                    }, children: [notification.displayName, " Update Available"] }), _jsxs("p", { style: {
                                        margin: 0,
                                        color: theme.colors.textSecondary,
                                        fontSize: '13px',
                                    }, children: ["Version ", notification.latestVersion, " is ready to install", notification.currentVersion && ` (current: ${notification.currentVersion})`] }), _jsxs("div", { style: { marginTop: '12px', display: 'flex', gap: '8px' }, children: [_jsxs("button", { onClick: () => {
                                                // Navigate to agent settings or trigger update
                                                dismissNotification(notification.id);
                                            }, style: {
                                                padding: '6px 12px',
                                                backgroundColor: theme.colors.primary,
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }, children: [_jsx(Download, { size: 14 }), "Update Now"] }), _jsx("button", { onClick: () => dismissNotification(notification.id), style: {
                                                padding: '6px 12px',
                                                backgroundColor: 'transparent',
                                                color: theme.colors.textSecondary,
                                                border: `1px solid ${theme.colors.border}`,
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                            }, children: "Later" })] })] }), _jsx("button", { onClick: () => dismissNotification(notification.id), style: {
                                background: 'none',
                                border: 'none',
                                padding: '4px',
                                cursor: 'pointer',
                                color: theme.colors.textSecondary,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }, "aria-label": "Dismiss notification", children: _jsx(X, { size: 16 }) })] }) }, notification.id))), _jsx("style", { children: `
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        ` })] }));
};
