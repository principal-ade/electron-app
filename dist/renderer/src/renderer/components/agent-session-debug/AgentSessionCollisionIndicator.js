import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
export const AgentSessionCollisionIndicator = ({ collisions, sessionNames = new Map(), onFileClick }) => {
    const { theme } = useTheme();
    if (collisions.length === 0) {
        return null;
    }
    // Group collisions by severity
    const highSeverity = collisions.filter(c => c.severity === 'high');
    const mediumSeverity = collisions.filter(c => c.severity === 'medium');
    const lowSeverity = collisions.filter(c => c.severity === 'low');
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return '#ef4444'; // Red
            case 'medium': return '#f59e0b'; // Amber
            case 'low': return '#3b82f6'; // Blue
            default: return theme.colors.textSecondary;
        }
    };
    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'high': return _jsx(AlertTriangle, { size: 14 });
            case 'medium': return _jsx(AlertCircle, { size: 14 });
            case 'low': return _jsx(Info, { size: 14 });
            default: return null;
        }
    };
    const formatPath = (path) => {
        const parts = path.split('/');
        return parts.length > 3 ? `.../${parts.slice(-2).join('/')}` : path;
    };
    const renderCollisionGroup = (title, items, severity) => {
        if (items.length === 0)
            return null;
        return (_jsxs("div", { style: { marginBottom: '12px' }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '6px',
                        color: getSeverityColor(severity),
                        fontSize: '12px',
                        fontWeight: 600,
                    }, children: [getSeverityIcon(severity), _jsxs("span", { children: [title, " (", items.length, ")"] })] }), _jsxs("div", { style: {
                        maxHeight: '120px',
                        overflowY: 'auto',
                        paddingLeft: '20px',
                    }, children: [items.slice(0, 5).map((collision, idx) => (_jsxs("div", { style: {
                                marginBottom: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                            }, children: [_jsx("div", { style: {
                                        color: theme.colors.text,
                                        cursor: onFileClick ? 'pointer' : 'default',
                                        textDecoration: onFileClick ? 'underline' : 'none',
                                    }, onClick: () => onFileClick?.(collision.path), children: formatPath(collision.path) }), _jsx("div", { style: {
                                        color: theme.colors.textSecondary,
                                        fontSize: '10px',
                                        marginTop: '2px',
                                    }, children: collision.sessions.map(s => {
                                        const name = sessionNames.get(s.sessionId) || s.sessionId.substring(0, 8);
                                        const ops = Array.from(s.operations).join('+');
                                        return `${name}(${ops})`;
                                    }).join(' ↔ ') })] }, idx))), items.length > 5 && (_jsxs("div", { style: {
                                fontSize: '10px',
                                color: theme.colors.textSecondary,
                                fontStyle: 'italic',
                            }, children: ["...and ", items.length - 5, " more"] }))] })] }));
    };
    return (_jsxs("div", { style: {
            padding: '12px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            marginBottom: '12px',
        }, children: [_jsxs("div", { style: {
                    fontSize: '13px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }, children: [_jsx(AlertTriangle, { size: 16, color: "#f59e0b" }), "File Collisions Detected"] }), _jsxs("div", { style: {
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginBottom: '12px',
                }, children: [collisions.length, " file", collisions.length !== 1 ? 's' : '', " accessed by multiple sessions"] }), renderCollisionGroup('Critical - Write Conflicts', highSeverity, 'high'), renderCollisionGroup('Warning - Mixed Access', mediumSeverity, 'medium'), renderCollisionGroup('Info - Read Overlaps', lowSeverity, 'low')] }));
};
