import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Clock, FileText, Terminal, Globe, Hash, ChevronRight, Search, Activity, AlertCircle, CheckCircle, Info, Code } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
export const SessionEventsView = ({ sessionId, sessionName }) => {
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    // Load events on mount
    useEffect(() => {
        loadEvents();
    }, [sessionId]);
    const loadEvents = async () => {
        setLoading(true);
        try {
            const sessionEvents = await AgentSessionService.getSessionEvents(sessionId);
            if (sessionEvents) {
                setEvents(sessionEvents);
                // Auto-select first event
                if (sessionEvents.length > 0) {
                    setSelectedEvent(sessionEvents[0]);
                }
            }
        }
        catch (error) {
            console.error('Failed to load session events:', error);
            setEvents([]);
        }
        finally {
            setLoading(false);
        }
    };
    // Filter events based on search and type
    const filteredEvents = useMemo(() => {
        let filtered = events;
        // Apply type filter
        if (filterType !== 'all') {
            filtered = filtered.filter(event => {
                switch (filterType) {
                    case 'tool':
                        return event.eventType === 'pre-tool-use' || event.eventType === 'post-tool-use';
                    case 'file':
                        return event.toolName && ['Read', 'Write', 'Edit', 'MultiEdit'].includes(event.toolName);
                    case 'web':
                        return event.toolName && ['WebFetch', 'WebSearch'].includes(event.toolName);
                    case 'bash':
                        return event.toolName === 'Bash';
                    case 'todo':
                        return event.toolName === 'TodoWrite';
                    default:
                        return true;
                }
            });
        }
        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(event => {
                const searchableText = [
                    event.eventType,
                    event.toolName,
                    event.paths?.primary?.displayPath,
                    JSON.stringify(event.toolInput),
                    JSON.stringify(event.parameters)
                ].filter(Boolean).join(' ').toLowerCase();
                return searchableText.includes(query);
            });
        }
        return filtered;
    }, [events, searchQuery, filterType]);
    // Get event icon based on type
    const getEventIcon = (event) => {
        if (event.toolName) {
            if (['Read', 'Write', 'Edit', 'MultiEdit'].includes(event.toolName)) {
                return _jsx(FileText, { size: 14 });
            }
            if (event.toolName === 'Bash') {
                return _jsx(Terminal, { size: 14 });
            }
            if (['WebFetch', 'WebSearch'].includes(event.toolName)) {
                return _jsx(Globe, { size: 14 });
            }
            if (event.toolName === 'TodoWrite') {
                return _jsx(CheckCircle, { size: 14 });
            }
        }
        if (event.eventType === 'session-start') {
            return _jsx(Activity, { size: 14, color: theme.colors.success });
        }
        if (event.eventType === 'stop') {
            return _jsx(AlertCircle, { size: 14, color: theme.colors.error });
        }
        return _jsx(Hash, { size: 14 });
    };
    // Get event color based on type
    const getEventColor = (event) => {
        if (event.eventType === 'pre-tool-use')
            return theme.colors.primary;
        if (event.eventType === 'post-tool-use')
            return theme.colors.success;
        if (event.eventType === 'stop')
            return theme.colors.error;
        if (event.eventType === 'notification')
            return theme.colors.warning;
        return theme.colors.textSecondary;
    };
    // Format timestamp
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    };
    // Format event title
    const getEventTitle = (event) => {
        if (event.toolName) {
            if (event.files && event.files.length > 0 && event.files[0].displayPath) {
                const fileName = event.files[0].displayPath.split('/').pop();
                return `${event.toolName}: ${fileName}`;
            }
            return event.toolName;
        }
        return event.eventType;
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: theme.colors.background
        }, children: [_jsxs("div", { style: {
                    width: '350px',
                    borderRight: `1px solid ${theme.colors.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: theme.colors.backgroundSecondary
                }, children: [_jsx("div", { style: {
                            padding: '12px 16px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background
                        }, children: _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }, children: [_jsx("h3", { style: {
                                        margin: 0,
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text
                                    }, children: "Session Events" }), _jsx("span", { style: {
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.primary + '20',
                                        color: theme.colors.primary,
                                        fontSize: '11px',
                                        fontWeight: 600
                                    }, children: events.length })] }) }), _jsxs("div", { style: { padding: '12px', borderBottom: `1px solid ${theme.colors.border}` }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    backgroundColor: theme.colors.background,
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.colors.border}`
                                }, children: [_jsx(Search, { size: 16, color: theme.colors.textSecondary }), _jsx("input", { type: "text", placeholder: "Search events...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: {
                                            flex: 1,
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            color: theme.colors.text,
                                            fontSize: '13px'
                                        } })] }), _jsx("div", { style: {
                                    display: 'flex',
                                    gap: '4px',
                                    marginTop: '8px',
                                    flexWrap: 'wrap'
                                }, children: [
                                    { value: 'all', label: 'All' },
                                    { value: 'tool', label: 'Tools' },
                                    { value: 'file', label: 'Files' },
                                    { value: 'bash', label: 'Bash' },
                                    { value: 'web', label: 'Web' },
                                    { value: 'todo', label: 'Todos' }
                                ].map(filter => (_jsx("button", { onClick: () => setFilterType(filter.value), style: {
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        backgroundColor: filterType === filter.value
                                            ? theme.colors.primary
                                            : theme.colors.background,
                                        color: filterType === filter.value
                                            ? '#fff'
                                            : theme.colors.textSecondary,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: 500
                                    }, children: filter.label }, filter.value))) })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto' }, children: loading ? (_jsx("div", { style: {
                                padding: '20px',
                                textAlign: 'center',
                                color: theme.colors.textSecondary,
                                fontSize: '13px'
                            }, children: "Loading events..." })) : filteredEvents.length === 0 ? (_jsx("div", { style: {
                                padding: '20px',
                                textAlign: 'center',
                                color: theme.colors.textSecondary,
                                fontSize: '13px'
                            }, children: searchQuery || filterType !== 'all'
                                ? 'No matching events found'
                                : 'No events recorded for this session' })) : (filteredEvents.map((event, index) => (_jsxs("div", { onClick: () => setSelectedEvent(event), style: {
                                padding: '10px 12px',
                                borderBottom: `1px solid ${theme.colors.border}`,
                                cursor: 'pointer',
                                backgroundColor: selectedEvent === event
                                    ? theme.colors.primary + '15'
                                    : 'transparent',
                                transition: 'background-color 0.2s',
                                borderLeft: selectedEvent === event
                                    ? `3px solid ${theme.colors.primary}`
                                    : '3px solid transparent'
                            }, onMouseEnter: (e) => {
                                if (selectedEvent !== event) {
                                    e.currentTarget.style.backgroundColor = theme.colors.background;
                                }
                            }, onMouseLeave: (e) => {
                                if (selectedEvent !== event) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '4px'
                                    }, children: [getEventIcon(event), _jsx("span", { style: {
                                                flex: 1,
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: getEventColor(event),
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }, children: getEventTitle(event) }), _jsx(ChevronRight, { size: 14, color: theme.colors.textTertiary })] }), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '11px',
                                        color: theme.colors.textTertiary
                                    }, children: [_jsx(Clock, { size: 10 }), formatTime(event.timestamp), event.eventType && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsx("span", { style: {
                                                        padding: '1px 4px',
                                                        borderRadius: '3px',
                                                        backgroundColor: theme.colors.backgroundTertiary,
                                                        fontSize: '10px'
                                                    }, children: event.eventType })] }))] })] }, `${event.timestamp}-${index}`)))) })] }), _jsx("div", { style: { flex: 1, overflow: 'auto', padding: '20px' }, children: selectedEvent ? (_jsxs("div", { children: [_jsx("div", { style: { marginBottom: '20px' }, children: _jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '12px'
                                }, children: [_jsx("div", { style: {
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            backgroundColor: getEventColor(selectedEvent) + '20',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }, children: getEventIcon(selectedEvent) }), _jsxs("div", { children: [_jsx("h3", { style: {
                                                    margin: 0,
                                                    fontSize: '16px',
                                                    color: theme.colors.text
                                                }, children: getEventTitle(selectedEvent) }), _jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    marginTop: '4px'
                                                }, children: [_jsx("span", { style: {
                                                            fontSize: '12px',
                                                            color: theme.colors.textSecondary
                                                        }, children: selectedEvent.eventType }), _jsx("span", { style: {
                                                            fontSize: '12px',
                                                            color: theme.colors.textTertiary
                                                        }, children: new Date(selectedEvent.timestamp).toLocaleString() })] })] })] }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [(selectedEvent.sessionId || selectedEvent.provider || selectedEvent.workingDirectory) && (_jsxs("div", { style: {
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`
                                    }, children: [_jsxs("h4", { style: {
                                                margin: '0 0 8px 0',
                                                fontSize: '13px',
                                                color: theme.colors.textSecondary,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }, children: [_jsx(Info, { size: 12 }), "Basic Information"] }), _jsxs("div", { style: { fontSize: '13px', lineHeight: '1.6' }, children: [selectedEvent.sessionId && (_jsxs("div", { children: [_jsx("strong", { children: "Session ID:" }), " ", selectedEvent.sessionId] })), selectedEvent.provider && (_jsxs("div", { children: [_jsx("strong", { children: "Provider:" }), " ", selectedEvent.provider] })), selectedEvent.workingDirectory && (_jsxs("div", { children: [_jsx("strong", { children: "Working Directory:" }), " ", selectedEvent.workingDirectory] })), selectedEvent.normalizedWorkingDirectory && (_jsxs("div", { children: [_jsx("strong", { children: "Git Root:" }), " ", selectedEvent.normalizedWorkingDirectory] }))] })] })), selectedEvent.files && selectedEvent.files.length > 0 && (_jsxs("div", { style: {
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`
                                    }, children: [_jsxs("h4", { style: {
                                                margin: '0 0 8px 0',
                                                fontSize: '13px',
                                                color: theme.colors.textSecondary,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }, children: [_jsx(FileText, { size: 12 }), "File Paths"] }), selectedEvent.files.map((file, i) => (_jsx("div", { style: {
                                                padding: '8px',
                                                marginTop: i > 0 ? '4px' : '0',
                                                backgroundColor: theme.colors.background,
                                                borderRadius: '4px',
                                                fontFamily: 'monospace',
                                                fontSize: '12px',
                                                wordBreak: 'break-all'
                                            }, children: file.displayPath || file.originalPath || '[path not normalized]' }, i)))] })), selectedEvent.toolInput && (_jsxs("div", { style: {
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`
                                    }, children: [_jsxs("h4", { style: {
                                                margin: '0 0 8px 0',
                                                fontSize: '13px',
                                                color: theme.colors.textSecondary,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }, children: [_jsx(Code, { size: 12 }), "Tool Input"] }), _jsx("pre", { style: {
                                                margin: 0,
                                                padding: '12px',
                                                backgroundColor: theme.colors.background,
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                overflow: 'auto',
                                                maxHeight: '300px',
                                                color: theme.colors.text,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word'
                                            }, children: JSON.stringify(selectedEvent.toolInput, null, 2) })] })), selectedEvent.parameters && Object.keys(selectedEvent.parameters).length > 0 && (_jsxs("div", { style: {
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`
                                    }, children: [_jsx("h4", { style: {
                                                margin: '0 0 8px 0',
                                                fontSize: '13px',
                                                color: theme.colors.textSecondary,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }, children: "Parameters" }), _jsx("pre", { style: {
                                                margin: 0,
                                                padding: '12px',
                                                backgroundColor: theme.colors.background,
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                overflow: 'auto',
                                                maxHeight: '300px',
                                                color: theme.colors.text,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word'
                                            }, children: JSON.stringify(selectedEvent.parameters, null, 2) })] })), selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (_jsxs("div", { style: {
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`
                                    }, children: [_jsx("h4", { style: {
                                                margin: '0 0 8px 0',
                                                fontSize: '13px',
                                                color: theme.colors.textSecondary,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }, children: "Metadata" }), _jsx("pre", { style: {
                                                margin: 0,
                                                padding: '12px',
                                                backgroundColor: theme.colors.background,
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                overflow: 'auto',
                                                maxHeight: '200px',
                                                color: theme.colors.text,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word'
                                            }, children: JSON.stringify(selectedEvent.metadata, null, 2) })] }))] })] })) : (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: theme.colors.textSecondary
                    }, children: [_jsx(Info, { size: 48, style: { marginBottom: '16px', opacity: 0.5 } }), _jsx("p", { style: { fontSize: '14px' }, children: "Select an event to view details" })] })) })] }));
};
