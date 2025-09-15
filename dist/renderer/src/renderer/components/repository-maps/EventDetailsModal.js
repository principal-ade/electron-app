import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { useTheme } from 'themed-markdown';
import { X, Copy, CheckCircle } from 'lucide-react';
export const EventDetailsModal = ({ event, rawEvent, isOpen, onClose }) => {
    const { theme } = useTheme();
    const [copiedSide, setCopiedSide] = React.useState(null);
    if (!isOpen || !event)
        return null;
    const copyToClipboard = (data, side) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopiedSide(side);
        setTimeout(() => setCopiedSide(null), 2000);
    };
    const formatJson = (data) => {
        try {
            return JSON.stringify(data, null, 2);
        }
        catch (e) {
            return String(data);
        }
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
            zIndex: 1000
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                width: '90%',
                maxWidth: '1200px',
                height: '80%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }, children: [_jsxs("div", { style: {
                        padding: '16px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }, children: [_jsxs("h2", { style: {
                                fontSize: '16px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                margin: 0
                            }, children: ["Event Details: ", event.eventType, " ", event.toolName && `- ${event.toolName}`] }), _jsx("button", { onClick: onClose, style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s'
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { style: {
                        flex: 1,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1px',
                        backgroundColor: theme.colors.border,
                        overflow: 'hidden'
                    }, children: [_jsxs("div", { style: {
                                backgroundColor: theme.colors.backgroundSecondary,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }, children: [_jsxs("div", { style: {
                                        padding: '12px 16px',
                                        backgroundColor: theme.colors.background,
                                        borderBottom: `1px solid ${theme.colors.border}`,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }, children: [_jsx("h3", { style: {
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                                margin: 0
                                            }, children: "Normalized Event" }), _jsx("button", { onClick: () => copyToClipboard(event, 'normalized'), style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 8px',
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                border: `1px solid ${theme.colors.border}`,
                                                borderRadius: '4px',
                                                color: theme.colors.text,
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                                e.currentTarget.style.borderColor = theme.colors.primary;
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                e.currentTarget.style.borderColor = theme.colors.border;
                                            }, children: copiedSide === 'normalized' ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle, { size: 12 }), "Copied!"] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { size: 12 }), "Copy"] })) })] }), _jsx("div", { style: {
                                        flex: 1,
                                        overflow: 'auto',
                                        padding: '16px'
                                    }, children: _jsx("pre", { style: {
                                            margin: 0,
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            color: theme.colors.text,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }, children: formatJson(event) }) })] }), _jsxs("div", { style: {
                                backgroundColor: theme.colors.backgroundSecondary,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }, children: [_jsxs("div", { style: {
                                        padding: '12px 16px',
                                        backgroundColor: theme.colors.background,
                                        borderBottom: `1px solid ${theme.colors.border}`,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }, children: [_jsx("h3", { style: {
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                                margin: 0
                                            }, children: "Raw Event" }), rawEvent && (_jsx("button", { onClick: () => copyToClipboard(rawEvent, 'raw'), style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 8px',
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                border: `1px solid ${theme.colors.border}`,
                                                borderRadius: '4px',
                                                color: theme.colors.text,
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                                e.currentTarget.style.borderColor = theme.colors.primary;
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                e.currentTarget.style.borderColor = theme.colors.border;
                                            }, children: copiedSide === 'raw' ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle, { size: 12 }), "Copied!"] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { size: 12 }), "Copy"] })) }))] }), _jsx("div", { style: {
                                        flex: 1,
                                        overflow: 'auto',
                                        padding: '16px'
                                    }, children: rawEvent ? (_jsx("pre", { style: {
                                            margin: 0,
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            color: theme.colors.text,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }, children: formatJson(rawEvent) })) : (_jsx("div", { style: {
                                            color: theme.colors.textSecondary,
                                            fontSize: '13px',
                                            textAlign: 'center',
                                            marginTop: '40px'
                                        }, children: "Raw event data not available" })) })] })] }), _jsxs("div", { style: {
                        padding: '12px 16px',
                        borderTop: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        gap: '24px',
                        fontSize: '12px',
                        color: theme.colors.textSecondary
                    }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Timestamp:" }), " ", new Date(event.timestamp).toLocaleString()] }), event.sessionId && (_jsxs("div", { children: [_jsx("strong", { children: "Session ID:" }), " ", event.sessionId.substring(0, 12), "..."] })), event.workingDirectory && (_jsxs("div", { children: [_jsx("strong", { children: "Working Dir:" }), " ", event.workingDirectory] }))] })] }) }));
};
