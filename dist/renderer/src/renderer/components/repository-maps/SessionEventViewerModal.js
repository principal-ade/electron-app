import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { X, Clock, FileText, Terminal, Globe, Hash, ChevronRight, Search, Activity, Code, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
export const SessionEventViewerModal = ({ sessionId, sessionName, isOpen, onClose }) => {
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    // Load events when modal opens
    useEffect(() => {
        if (isOpen && sessionId) {
            loadEvents();
        }
    }, [isOpen, sessionId]);
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
    if (!isOpen)
        return null;
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
        }, onClick: onClose, children: _jsxs("div", { style: {
                width: '90%',
                maxWidth: '1400px',
                height: '80%',
                backgroundColor: theme.colors.background,
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
            }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                        padding: '16px 20px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: theme.colors.backgroundSecondary
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(Activity, { size: 20, color: theme.colors.primary }), _jsxs("h2", { style: { margin: 0, fontSize: '18px', color: theme.colors.text }, children: ["Session Events: ", sessionName || `Session ${sessionId.substring(0, 8)}`] }), _jsxs("span", { style: {
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.primary + '20',
                                        color: theme.colors.primary,
                                        fontSize: '12px',
                                        fontWeight: 600
                                    }, children: [events.length, " events"] })] }), _jsx("button", { onClick: onClose, style: {
                                padding: '6px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                transition: 'all 0.2s'
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsxs("div", { style: {
                                width: '400px',
                                borderRight: `1px solid ${theme.colors.border}`,
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: theme.colors.backgroundSecondary
                            }, children: [_jsxs("div", { style: { padding: '12px', borderBottom: `1px solid ${theme.colors.border}` }, children: [_jsxs("div", { style: {
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
                                            color: theme.colors.textSecondary
                                        }, children: "Loading events..." })) : filteredEvents.length === 0 ? (_jsx("div", { style: {
                                            padding: '20px',
                                            textAlign: 'center',
                                            color: theme.colors.textSecondary
                                        }, children: "No events found" })) : (filteredEvents.map((event, index) => (_jsxs("div", { onClick: () => setSelectedEvent(event), style: {
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
                                                                    }, children: new Date(selectedEvent.timestamp).toLocaleString() })] })] })] }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { style: {
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
                                                        }, children: [_jsx(Info, { size: 12 }), "Basic Information"] }), _jsxs("div", { style: { fontSize: '13px', lineHeight: '1.6' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Session ID:" }), " ", selectedEvent.sessionId] }), _jsxs("div", { children: [_jsx("strong", { children: "Provider:" }), " ", selectedEvent.provider] }), _jsxs("div", { children: [_jsx("strong", { children: "Working Directory:" }), " ", selectedEvent.workingDirectory] }), selectedEvent.normalizedWorkingDirectory && (_jsxs("div", { children: [_jsx("strong", { children: "Git Root:" }), " ", selectedEvent.normalizedWorkingDirectory] }))] })] }), selectedEvent.paths && (_jsxs("div", { style: {
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
                                                        }, children: [_jsx(FileText, { size: 12 }), "File Paths"] }), selectedEvent.files && selectedEvent.files.length > 0 && (_jsxs("div", { style: { marginBottom: '8px' }, children: [_jsx("strong", { children: "Primary Path:" }), _jsx("div", { style: {
                                                                    padding: '8px',
                                                                    marginTop: '4px',
                                                                    backgroundColor: theme.colors.background,
                                                                    borderRadius: '4px',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '12px',
                                                                    wordBreak: 'break-all'
                                                                }, children: selectedEvent.files[0].displayPath || '[path not normalized]' })] })), selectedEvent.files && selectedEvent.files.length > 1 && (_jsxs("div", { children: [_jsx("strong", { children: "Additional Paths:" }), selectedEvent.files.slice(1).map((file, i) => (_jsx("div", { style: {
                                                                    padding: '8px',
                                                                    marginTop: '4px',
                                                                    backgroundColor: theme.colors.background,
                                                                    borderRadius: '4px',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '12px',
                                                                    wordBreak: 'break-all'
                                                                }, children: file.displayPath || '[path not normalized]' }, i)))] }))] })), selectedEvent.toolInput && (_jsxs("div", { style: {
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
                                                            color: theme.colors.text
                                                        }, children: JSON.stringify(selectedEvent.toolInput, null, 2) })] })), selectedEvent.parameters && (_jsxs("div", { style: {
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
                                                            color: theme.colors.text
                                                        }, children: JSON.stringify(selectedEvent.parameters, null, 2) })] })), selectedEvent.metadata && (_jsxs("div", { style: {
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
                                                            color: theme.colors.text
                                                        }, children: JSON.stringify(selectedEvent.metadata, null, 2) })] }))] })] })) : (_jsxs("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    color: theme.colors.textSecondary
                                }, children: [_jsx(Info, { size: 48, style: { marginBottom: '16px', opacity: 0.5 } }), _jsx("p", { children: "Select an event to view details" })] })) })] })] }) }));
};
