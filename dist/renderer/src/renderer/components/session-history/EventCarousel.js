import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Layers, Wrench, FileText, Search, Globe, Terminal, CheckSquare, } from 'lucide-react';
import { useTheme } from 'themed-markdown';
// Helper Functions
const getToolIcon = (toolName) => {
    const iconProps = { size: 14 };
    switch (toolName) {
        case 'Read':
        case 'Write':
        case 'Edit':
        case 'MultiEdit':
            return _jsx(FileText, { ...iconProps });
        case 'Grep':
        case 'Glob':
            return _jsx(Search, { ...iconProps });
        case 'Bash':
            return _jsx(Terminal, { ...iconProps });
        case 'WebFetch':
        case 'WebSearch':
            return _jsx(Globe, { ...iconProps });
        case 'TodoWrite':
            return _jsx(CheckSquare, { ...iconProps });
        default:
            return _jsx(Wrench, { ...iconProps });
    }
};
const groupEvents = (events) => {
    const grouped = [];
    const processedIndices = new Set();
    for (let i = 0; i < events.length; i++) {
        if (processedIndices.has(i))
            continue;
        const event = events[i];
        // Check if this is a pre-tool-use event
        if (event.eventType === 'pre-tool-use' && event.toolName) {
            // Look for matching post-tool-use event
            let postEvent;
            // Search within next 5 events for matching post event
            for (let j = i + 1; j < Math.min(i + 5, events.length); j++) {
                const candidate = events[j];
                if (candidate.eventType === 'post-tool-use' &&
                    candidate.toolName === event.toolName &&
                    !processedIndices.has(j)) {
                    postEvent = candidate;
                    processedIndices.add(j);
                    break;
                }
            }
            if (postEvent) {
                // Create paired event - only use displayPath (relative to git root)
                const files = [
                    ...(event.files?.map(f => f.displayPath || '[path not normalized]') || []),
                    ...(postEvent.files?.map(f => f.displayPath || '[path not normalized]') || [])
                ];
                grouped.push({
                    id: `${event.sessionId}-${i}`,
                    type: 'paired',
                    preEvent: event,
                    postEvent,
                    timestamp: event.timestamp,
                    toolName: event.toolName,
                    fileCount: files.length,
                    files: [...new Set(files)], // Dedupe
                    duration: postEvent.timestamp - event.timestamp
                });
            }
            else {
                // Single pre event
                grouped.push({
                    id: `${event.sessionId}-${i}`,
                    type: 'single',
                    event,
                    timestamp: event.timestamp,
                    toolName: event.toolName || 'Unknown',
                    fileCount: event.files?.length || 0,
                    files: event.files?.map(f => f.displayPath || '[path not normalized]') || []
                });
            }
            processedIndices.add(i);
        }
        else if (event.eventType === 'post-tool-use' && !processedIndices.has(i)) {
            // Orphaned post event
            grouped.push({
                id: `${event.sessionId}-${i}`,
                type: 'single',
                event,
                timestamp: event.timestamp,
                toolName: event.toolName || 'Unknown',
                fileCount: event.files?.length || 0,
                files: event.files?.map(f => f.displayPath || '[path not normalized]') || []
            });
            processedIndices.add(i);
        }
        else if (!processedIndices.has(i) && event.toolName) {
            // Other tool events
            grouped.push({
                id: `${event.sessionId}-${i}`,
                type: 'single',
                event,
                timestamp: event.timestamp,
                toolName: event.toolName,
                fileCount: event.files?.length || 0,
                files: event.files?.map(f => f.displayPath || '[path not normalized]') || []
            });
            processedIndices.add(i);
        }
    }
    return grouped;
};
const formatDuration = (ms) => {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};
const formatTimestamp = (ts) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};
// Main Component
export const EventCarousel = ({ events, onEventSelect, onHighlightModeChange, className }) => {
    const { theme } = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per event
    const [filterMode, setFilterMode] = useState('all');
    const [highlightMode, setHighlightMode] = useState('single');
    // Group events
    const groupedEvents = useMemo(() => groupEvents(events), [events]);
    // Filter events
    const filteredEvents = useMemo(() => {
        if (filterMode === 'all')
            return groupedEvents;
        return groupedEvents.filter(g => {
            switch (filterMode) {
                case 'reads':
                    return g.toolName === 'Read' || g.toolName === 'Grep' || g.toolName === 'Glob';
                case 'writes':
                    return g.toolName === 'Write' || g.toolName === 'Edit' || g.toolName === 'MultiEdit';
                case 'todos':
                    return g.toolName === 'TodoWrite';
                default:
                    return true;
            }
        });
    }, [groupedEvents, filterMode]);
    // Playback effect with auto-scroll
    useEffect(() => {
        if (!isPlaying || filteredEvents.length === 0)
            return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => {
                const next = prev + 1;
                if (next >= filteredEvents.length) {
                    setIsPlaying(false);
                    return prev;
                }
                // Auto-scroll the carousel to keep current event visible
                const eventElement = document.getElementById(`event-card-${next}`);
                if (eventElement) {
                    eventElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }
                return next;
            });
        }, playbackSpeed);
        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, filteredEvents.length]);
    // Handle event selection
    useEffect(() => {
        if (filteredEvents.length > 0 && currentIndex < filteredEvents.length) {
            const event = filteredEvents[currentIndex];
            onEventSelect(event, event.files);
        }
    }, [currentIndex, filteredEvents, onEventSelect]);
    // Handle highlight mode change
    const handleHighlightModeChange = useCallback((mode) => {
        setHighlightMode(mode);
        onHighlightModeChange?.(mode);
    }, [onHighlightModeChange]);
    // Navigation
    const goToPrevious = useCallback(() => {
        setCurrentIndex(prev => Math.max(0, prev - 1));
    }, []);
    const goToNext = useCallback(() => {
        setCurrentIndex(prev => Math.min(filteredEvents.length - 1, prev + 1));
    }, [filteredEvents.length]);
    const goToFirst = useCallback(() => {
        setCurrentIndex(0);
    }, []);
    const goToLast = useCallback(() => {
        setCurrentIndex(filteredEvents.length - 1);
    }, [filteredEvents.length]);
    if (events.length === 0) {
        return (_jsx("div", { className: className, style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                background: theme.colors.surface || theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`
            }, children: _jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    paddingTop: '8px',
                    borderTop: `1px solid ${theme.colors.border}`
                }, children: "No events to display" }) }));
    }
    const currentEvent = filteredEvents[currentIndex];
    // Style helpers
    const buttonStyle = (active) => ({
        padding: '6px',
        borderRadius: '4px',
        border: `1px solid ${theme.colors.border}`,
        background: active ? theme.colors.primary : theme.colors.background,
        color: active ? theme.colors.background : theme.colors.text,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
    });
    const filterButtonStyle = (active) => ({
        padding: '4px 8px',
        borderRadius: '4px',
        border: `1px solid ${theme.colors.border}`,
        background: active ? theme.colors.primary : theme.colors.background,
        color: active ? theme.colors.background : theme.colors.text,
        cursor: 'pointer',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s ease'
    });
    const eventCardStyle = (active, type) => ({
        flexShrink: 0,
        padding: '8px 12px',
        borderRadius: '6px',
        border: `2px solid ${active ? theme.colors.primary : theme.colors.border}`,
        background: active ? (theme.colors.primaryLight || theme.colors.primary + '20') : theme.colors.background,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '120px',
        position: 'relative'
    });
    return (_jsxs("div", { className: className, style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            background: theme.colors.surface || theme.colors.backgroundSecondary,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            flexWrap: 'wrap'
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }, children: [_jsx("button", { onClick: goToFirst, disabled: currentIndex === 0, style: { ...buttonStyle(), opacity: currentIndex === 0 ? 0.5 : 1, padding: '4px' }, children: _jsx(SkipBack, { size: 14 }) }), _jsx("button", { onClick: goToPrevious, disabled: currentIndex === 0, style: { ...buttonStyle(), opacity: currentIndex === 0 ? 0.5 : 1, padding: '4px' }, children: _jsx(ChevronLeft, { size: 14 }) }), _jsx("button", { onClick: () => setIsPlaying(!isPlaying), style: { ...buttonStyle(isPlaying), padding: '6px' }, children: isPlaying ? _jsx(Pause, { size: 16 }) : _jsx(Play, { size: 16 }) }), _jsx("button", { onClick: goToNext, disabled: currentIndex >= filteredEvents.length - 1, style: { ...buttonStyle(), opacity: currentIndex >= filteredEvents.length - 1 ? 0.5 : 1, padding: '4px' }, children: _jsx(ChevronRight, { size: 14 }) }), _jsx("button", { onClick: goToLast, disabled: currentIndex >= filteredEvents.length - 1, style: { ...buttonStyle(), opacity: currentIndex >= filteredEvents.length - 1 ? 0.5 : 1, padding: '4px' }, children: _jsx(SkipForward, { size: 14 }) }), _jsxs("select", { value: playbackSpeed, onChange: (e) => setPlaybackSpeed(Number(e.target.value)), style: {
                                            padding: '2px 4px',
                                            borderRadius: '4px',
                                            border: `1px solid ${theme.colors.border}`,
                                            background: theme.colors.background,
                                            color: theme.colors.text,
                                            fontSize: '11px'
                                        }, children: [_jsx("option", { value: "500", children: "2x" }), _jsx("option", { value: "1000", children: "1x" }), _jsx("option", { value: "2000", children: "0.5x" }), _jsx("option", { value: "3000", children: "0.3x" })] })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }, children: [_jsx("button", { onClick: () => handleHighlightModeChange('single'), style: { ...filterButtonStyle(highlightMode === 'single'), padding: '3px 6px' }, title: "Highlight current event only", children: _jsx(Layers, { size: 11 }) }), _jsx("button", { onClick: () => handleHighlightModeChange('trail'), style: { ...filterButtonStyle(highlightMode === 'trail'), padding: '3px 6px', fontSize: '11px' }, title: "Show trail of recent events", children: "Trail" }), _jsx("button", { onClick: () => handleHighlightModeChange('cumulative'), style: { ...filterButtonStyle(highlightMode === 'cumulative'), padding: '3px 6px', fontSize: '11px' }, title: "Show all accessed files", children: "All" })] })] }), _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }, children: [_jsx("button", { onClick: () => setFilterMode('all'), style: { ...filterButtonStyle(filterMode === 'all'), padding: '3px 8px', fontSize: '11px' }, children: "All" }), _jsxs("button", { onClick: () => setFilterMode('reads'), style: { ...filterButtonStyle(filterMode === 'reads'), padding: '3px 8px', fontSize: '11px' }, children: [_jsx(FileText, { size: 11 }), " Reads"] }), _jsxs("button", { onClick: () => setFilterMode('writes'), style: { ...filterButtonStyle(filterMode === 'writes'), padding: '3px 8px', fontSize: '11px' }, children: [_jsx(FileText, { size: 11 }), " Writes"] }), _jsxs("button", { onClick: () => setFilterMode('todos'), style: { ...filterButtonStyle(filterMode === 'todos'), padding: '3px 8px', fontSize: '11px' }, children: [_jsx(CheckSquare, { size: 11 }), " Todos"] })] })] }), _jsxs("div", { style: {
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }, children: [_jsx("button", { onClick: goToPrevious, disabled: currentIndex === 0, style: {
                            padding: '4px',
                            borderRadius: '4px',
                            border: `1px solid ${theme.colors.border}`,
                            background: theme.colors.background,
                            color: theme.colors.text,
                            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: currentIndex === 0 ? 0.3 : 1
                        }, children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("div", { style: {
                            flex: 1,
                            display: 'flex',
                            gap: '8px',
                            overflowX: 'auto',
                            padding: '8px 0',
                            scrollBehavior: 'smooth'
                        }, children: filteredEvents.map((event, index) => (_jsxs("div", { id: `event-card-${index}`, onClick: () => setCurrentIndex(index), style: eventCardStyle(index === currentIndex, event.type), onMouseEnter: (e) => {
                                if (index !== currentIndex) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                                }
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.transform = '';
                                e.currentTarget.style.boxShadow = '';
                            }, children: [event.type === 'paired' && (_jsx("div", { style: {
                                        position: 'absolute',
                                        top: '4px',
                                        right: '4px',
                                        width: '8px',
                                        height: '8px',
                                        background: theme.colors.success || '#10b981',
                                        borderRadius: '50%'
                                    } })), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        marginBottom: '4px'
                                    }, children: [getToolIcon(event.toolName), _jsx("span", { children: event.toolName })] }), _jsxs("div", { style: {
                                        fontSize: '11px',
                                        color: theme.colors.textSecondary,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }, children: [event.type === 'paired' && event.duration && (_jsx("div", { children: formatDuration(event.duration) })), formatTimestamp(event.timestamp)] }), event.fileCount > 0 && (_jsxs("div", { style: {
                                        fontSize: '10px',
                                        color: theme.colors.textTertiary || theme.colors.textSecondary,
                                        marginTop: '2px'
                                    }, children: [event.fileCount, " file", event.fileCount !== 1 ? 's' : ''] }))] }, event.id))) }), _jsx("button", { onClick: goToNext, disabled: currentIndex >= filteredEvents.length - 1, style: {
                            padding: '4px',
                            borderRadius: '4px',
                            border: `1px solid ${theme.colors.border}`,
                            background: theme.colors.background,
                            color: theme.colors.text,
                            cursor: currentIndex >= filteredEvents.length - 1 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: currentIndex >= filteredEvents.length - 1 ? 0.3 : 1
                        }, children: _jsx(ChevronRight, { size: 16 }) })] }), currentEvent && (_jsxs("div", { style: {
                    marginTop: '8px',
                    padding: '8px',
                    background: theme.colors.backgroundSecondary,
                    borderRadius: '4px',
                    border: `1px solid ${theme.colors.border}`,
                    maxHeight: '120px',
                    overflowY: 'auto'
                }, children: [_jsxs("div", { style: {
                            fontSize: '11px',
                            fontWeight: 600,
                            color: theme.colors.textSecondary,
                            marginBottom: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }, children: [_jsx(FileText, { size: 12 }), "Files Affected (", currentEvent.files.length, "):"] }), currentEvent.files.length > 0 ? (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                        }, children: currentEvent.files.map((file, idx) => (_jsx("div", { style: {
                                fontSize: '11px',
                                color: theme.colors.text,
                                fontFamily: 'monospace',
                                padding: '2px 4px',
                                background: theme.colors.background,
                                borderRadius: '2px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }, children: file }, idx))) })) : (_jsx("div", { style: {
                            fontSize: '11px',
                            color: theme.colors.textTertiary || theme.colors.textSecondary,
                            fontStyle: 'italic',
                            padding: '4px'
                        }, children: "No files affected by this event" }))] })), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    paddingTop: '8px',
                    borderTop: `1px solid ${theme.colors.border}`
                }, children: [_jsxs("div", { children: ["Event ", currentIndex + 1, " of ", filteredEvents.length, filterMode !== 'all' && ` (filtered: ${filterMode})`] }), currentEvent && (_jsxs("div", { children: [currentEvent.type === 'paired' ? 'Pre→Post' : 'Single', " \u2022", currentEvent.toolName, " \u2022", currentEvent.fileCount > 0 && `${currentEvent.fileCount} files`] }))] })] }));
};
export default EventCarousel;
