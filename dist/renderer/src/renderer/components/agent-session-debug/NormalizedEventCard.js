import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { RotateCw } from 'lucide-react';
export const NormalizedEventCard = ({ event, index, showRawData = true, compact = false, onReprocess, layerBadges }) => {
    const { theme } = useTheme();
    const [expandedSections, setExpandedSections] = useState(new Set());
    // Debug logging to see what's in the event
    React.useEffect(() => {
        if (!compact && event.eventType === 'pre-tool-use') {
            console.log('Event data:', {
                eventType: event.eventType,
                toolName: event.toolName,
                hasToolInput: !!event.toolInput,
                hasToolOutput: !!event.toolOutput,
                hasRaw: !!event.raw,
                hasData: !!event.data,
                toolInput: event.toolInput,
                raw: event.raw
            });
        }
    }, [event, compact]);
    const toggleSection = (section) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(section)) {
            newExpanded.delete(section);
        }
        else {
            newExpanded.add(section);
        }
        setExpandedSections(newExpanded);
    };
    const getEventColor = (eventType) => {
        switch (eventType) {
            case 'pre-tool-use': return '#7c3aed'; // Purple
            case 'post-tool-use': return '#10b981'; // Green
            case 'stop':
            case 'subagent-stop': return '#f59e0b'; // Amber
            case 'session-start': return '#3b82f6'; // Blue
            case 'notification': return '#06b6d4'; // Cyan
            case 'user-prompt-submit': return '#ec4899'; // Pink
            case 'pre-compact': return '#8b5cf6'; // Violet
            case 'lifecycle': return '#6b7280'; // Gray
            default: return '#6b7280'; // Gray for unknown
        }
    };
    const formatTimestamp = (timestamp) => {
        if (!timestamp || timestamp === 0 || !isFinite(timestamp)) {
            return 'No timestamp';
        }
        return new Date(timestamp).toLocaleString();
    };
    const formatPath = (path) => {
        if (!path)
            return null;
        // Show last 2 parts of the path for brevity
        const parts = path.split('/');
        if (parts.length > 2) {
            return `.../${parts.slice(-2).join('/')}`;
        }
        return path;
    };
    const eventColor = getEventColor(event.eventType);
    if (compact) {
        // Compact mode for list views
        return (_jsxs("div", { style: {
                padding: '6px 8px',
                borderLeft: `3px solid ${eventColor}`,
                backgroundColor: theme.colors.backgroundTertiary,
                marginBottom: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }, children: [index !== undefined && (_jsxs("span", { style: { color: theme.colors.textSecondary, fontSize: '10px' }, children: ["#", index] })), _jsx("span", { style: { color: theme.colors.textSecondary, fontSize: '10px' }, children: new Date(event.timestamp).toLocaleTimeString() }), _jsx("span", { style: { color: eventColor, fontWeight: 600 }, children: event.eventType }), event.toolName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "\u2192" }), _jsx("span", { style: { color: '#8b5cf6', fontWeight: 500 }, children: event.toolName })] })), layerBadges] }), event.files && event.files.length > 0 && (_jsxs("div", { style: {
                        marginTop: '4px',
                        paddingLeft: '12px',
                        fontSize: '10px',
                        color: theme.colors.text,
                        fontFamily: 'monospace',
                        opacity: 0.9
                    }, children: ["\uD83D\uDCC4 ", event.files[0].displayPath || '[path not normalized]', event.files.length > 1 && (_jsxs("span", { style: { color: theme.colors.textSecondary, marginLeft: '8px' }, children: ["(+", event.files.length - 1, " more)"] }))] }))] }));
    }
    // Full card mode
    return (_jsxs("div", { style: {
            marginBottom: '8px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            backgroundColor: theme.colors.background,
            fontFamily: 'monospace',
            fontSize: '11px',
        }, children: [_jsx("div", { style: {
                    padding: '8px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    borderLeft: `4px solid ${eventColor}`,
                }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }, children: [index !== undefined && (_jsxs("span", { style: { color: theme.colors.textSecondary, fontSize: '10px' }, children: ["#", index] })), _jsx("span", { style: { color: eventColor, fontWeight: 600 }, children: event.eventType }), event.toolName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "\u2192" }), _jsx("span", { style: { color: '#8b5cf6', fontWeight: 500 }, children: event.toolName })] })), layerBadges, _jsx("span", { style: { marginLeft: 'auto', color: theme.colors.textSecondary, fontSize: '10px' }, children: formatTimestamp(event.timestamp) }), onReprocess && event.raw && (_jsxs("button", { onClick: () => onReprocess(event), style: {
                                padding: '2px 6px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '3px',
                                color: '#10b981',
                                cursor: 'pointer',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginLeft: '8px',
                            }, title: "Reprocess this event", children: [_jsx(RotateCw, { size: 10 }), "Test"] }))] }) }), _jsxs("div", { style: { padding: '8px' }, children: [_jsxs("div", { style: { marginBottom: '6px' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary, fontSize: '10px' }, children: "Session: " }), _jsxs("span", { style: { fontSize: '10px', fontFamily: 'monospace' }, children: [event.sessionId.substring(0, 12), "..."] }), event.provider && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: theme.colors.textSecondary, fontSize: '10px', marginLeft: '8px' }, children: "Provider: " }), _jsx("span", { style: { fontSize: '10px', fontFamily: 'monospace' }, children: event.provider })] }))] }), event.normalizedWorkingDirectory && event.normalizedWorkingDirectory !== event.workingDirectory && (_jsxs("div", { style: { marginBottom: '6px' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary, fontSize: '10px' }, children: "Git Root: " }), _jsx("span", { style: { fontSize: '10px', fontFamily: 'monospace' }, children: event.normalizedWorkingDirectory })] })), event.files && event.files.length > 0 && (_jsxs("div", { style: {
                            marginBottom: '8px',
                            padding: '8px',
                            backgroundColor: theme.colors.backgroundTertiary,
                            borderRadius: '4px',
                            border: `1px solid ${theme.colors.border}`,
                        }, children: [_jsx("div", { style: {
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: theme.colors.text,
                                    marginBottom: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }, children: "\uD83D\uDCC1 File Paths" }), event.files[0] && (_jsxs("div", { style: { marginBottom: '4px' }, children: [_jsx("div", { style: {
                                            fontSize: '10px',
                                            color: '#8b5cf6',
                                            fontWeight: 600,
                                            marginBottom: '2px'
                                        }, children: "Primary:" }), _jsx("div", { style: {
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            color: theme.colors.text,
                                            padding: '4px 8px',
                                            backgroundColor: theme.colors.background,
                                            borderRadius: '3px',
                                            wordBreak: 'break-all'
                                        }, children: event.files[0].displayPath || '[path not normalized]' })] })), event.files.length > 1 && (_jsxs("div", { children: [_jsxs("div", { style: {
                                            fontSize: '10px',
                                            color: '#8b5cf6',
                                            fontWeight: 600,
                                            marginBottom: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }, children: ["Secondary (", event.files.length - 1, " files):", _jsx("button", { onClick: () => toggleSection('secondary-paths'), style: {
                                                    background: 'none',
                                                    border: 'none',
                                                    color: theme.colors.textSecondary,
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    fontSize: '10px'
                                                }, children: expandedSections.has('secondary-paths') ? '▼' : '▸' })] }), expandedSections.has('secondary-paths') && (_jsx("div", { style: {
                                            maxHeight: '150px',
                                            overflowY: 'auto',
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            color: theme.colors.text,
                                            padding: '4px 8px',
                                            backgroundColor: theme.colors.background,
                                            borderRadius: '3px',
                                        }, children: event.files.slice(1).map((file, idx) => (_jsx("div", { style: {
                                                padding: '2px 0',
                                                wordBreak: 'break-all',
                                                borderBottom: idx < event.files.length - 2 ? `1px solid ${theme.colors.border}` : 'none'
                                            }, children: file.displayPath || '[path not normalized]' }, idx))) }))] }))] })), event.data && Object.keys(event.data).length > 0 && (_jsxs("div", { style: { marginTop: '6px' }, children: [_jsxs("div", { style: { cursor: 'pointer', color: '#9333ea', fontSize: '11px', fontWeight: 500 }, onClick: () => toggleSection('data'), children: [expandedSections.has('data') ? '▼' : '▸', " Event Data"] }), expandedSections.has('data') && (_jsx("pre", { style: {
                                    fontSize: '10px',
                                    color: theme.colors.textSecondary,
                                    marginLeft: '12px',
                                    marginTop: '4px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                }, children: JSON.stringify(event.data, null, 2) }))] })), event.toolInput && (_jsxs("div", { style: { marginTop: '6px' }, children: [_jsxs("div", { style: { cursor: 'pointer', color: '#9333ea', fontSize: '11px', fontWeight: 500 }, onClick: () => toggleSection('input'), children: [expandedSections.has('input') ? '▼' : '▸', " Tool Input"] }), expandedSections.has('input') && (_jsx("pre", { style: {
                                    fontSize: '10px',
                                    color: theme.colors.textSecondary,
                                    marginLeft: '12px',
                                    marginTop: '4px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                }, children: JSON.stringify(event.toolInput, null, 2) }))] })), event.toolOutput && (_jsxs("div", { style: { marginTop: '6px' }, children: [_jsxs("div", { style: { cursor: 'pointer', color: '#9333ea', fontSize: '11px', fontWeight: 500 }, onClick: () => toggleSection('output'), children: [expandedSections.has('output') ? '▼' : '▸', " Tool Output"] }), expandedSections.has('output') && (_jsx("pre", { style: {
                                    fontSize: '10px',
                                    color: theme.colors.textSecondary,
                                    marginLeft: '12px',
                                    marginTop: '4px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                }, children: typeof event.toolOutput === 'string'
                                    ? event.toolOutput.substring(0, 500) + (event.toolOutput.length > 500 ? '...' : '')
                                    : JSON.stringify(event.toolOutput, null, 2).substring(0, 500) + '...' }))] })), showRawData && event.raw && (_jsxs("div", { style: { marginTop: '6px' }, children: [_jsxs("div", { style: { cursor: 'pointer', color: '#9333ea', fontSize: '11px', fontWeight: 500 }, onClick: () => toggleSection('raw'), children: [expandedSections.has('raw') ? '▼' : '▸', " Raw Event"] }), expandedSections.has('raw') && (_jsx("pre", { style: {
                                    fontSize: '10px',
                                    color: theme.colors.textSecondary,
                                    marginLeft: '12px',
                                    marginTop: '4px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    backgroundColor: theme.colors.backgroundTertiary,
                                    padding: '4px',
                                    borderRadius: '2px',
                                }, children: JSON.stringify(event.raw, null, 2) }))] }))] })] }));
};
