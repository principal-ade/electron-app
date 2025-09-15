import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from 'react';
import { X, Clock, FileText, Wrench, ChevronDown, ChevronRight, CheckSquare, StopCircle, Settings, HelpCircle } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { eventSegmenter } from '../../services/EventSegmenterService';
import { EventSegmentView } from './EventSegmentView';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
export const EventHistoryModal = ({ isOpen, onClose, session, sessionId }) => {
    const { theme } = useTheme();
    const [segmentationMode, setSegmentationMode] = useState('hybrid');
    const [expandedSegments, setExpandedSegments] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState([]);
    // Load full event data
    useEffect(() => {
        if (isOpen && sessionId) {
            setLoading(true);
            AgentSessionService.getSessionEvents(sessionId)
                .then(loadedEvents => {
                setEvents(loadedEvents || []);
            })
                .catch(error => {
                console.error('Failed to load session events:', error);
                setEvents([]);
            })
                .finally(() => {
                setLoading(false);
            });
        }
    }, [isOpen, sessionId]);
    // Segment events based on selected mode
    const segments = useMemo(() => {
        if (!events || events.length === 0)
            return [];
        return eventSegmenter.segmentEvents(events, segmentationMode);
    }, [events, segmentationMode]);
    // Filter segments based on search
    const filteredSegments = useMemo(() => {
        if (!searchQuery)
            return segments;
        return segments.filter(segment => {
            // Search in summary
            if (segment.summary.toLowerCase().includes(searchQuery.toLowerCase())) {
                return true;
            }
            // Search in todo content
            if (segment.todoInfo?.content.toLowerCase().includes(searchQuery.toLowerCase())) {
                return true;
            }
            // Search in file names
            const fileMatch = segment.stats.filesAccessed.some(file => file.toLowerCase().includes(searchQuery.toLowerCase()));
            return fileMatch;
        });
    }, [segments, searchQuery]);
    const toggleSegment = (index) => {
        const newExpanded = new Set(expandedSegments);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        }
        else {
            newExpanded.add(index);
        }
        setExpandedSegments(newExpanded);
    };
    const expandAll = () => {
        setExpandedSegments(new Set(filteredSegments.map((_, i) => i)));
    };
    const collapseAll = () => {
        setExpandedSegments(new Set());
    };
    const getSegmentIcon = (type) => {
        switch (type) {
            case 'todo':
                return _jsx(CheckSquare, { size: 16 });
            case 'stop':
                return _jsx(StopCircle, { size: 16 });
            case 'setup':
                return _jsx(Settings, { size: 16 });
            case 'orphaned':
                return _jsx(HelpCircle, { size: 16 });
            default:
                return null;
        }
    };
    const formatDuration = (ms) => {
        if (ms < 1000)
            return `${ms}ms`;
        if (ms < 60000)
            return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
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
            zIndex: 10000,
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '16px',
                width: '90vw',
                maxWidth: '1200px',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: theme.shadows[2] || theme.shadows[0],
                border: `1px solid ${theme.colors.border}`,
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px 24px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                    }, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                        fontSize: '20px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        margin: 0,
                                    }, children: "Event History" }), _jsxs("p", { style: {
                                        fontSize: '14px',
                                        color: theme.colors.textSecondary,
                                        margin: '4px 0 0 0',
                                    }, children: ["Session: ", sessionId.slice(0, 8), "... \u2022 ", events.length, " events"] })] }), _jsx("button", { onClick: onClose, style: {
                                background: 'none',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px 24px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        flexWrap: 'wrap',
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("label", { style: {
                                        fontSize: '14px',
                                        color: theme.colors.textSecondary,
                                    }, children: "Group by:" }), _jsxs("select", { value: segmentationMode, onChange: (e) => setSegmentationMode(e.target.value), style: {
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`,
                                        backgroundColor: theme.colors.background,
                                        color: theme.colors.text,
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                    }, children: [_jsx("option", { value: "hybrid", children: "Hybrid (Todo + Stops)" }), _jsx("option", { value: "todo", children: "Todo Items" }), _jsx("option", { value: "stop", children: "Stop Events" })] })] }), _jsx("input", { type: "text", placeholder: "Search events...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: {
                                flex: 1,
                                minWidth: '200px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${theme.colors.border}`,
                                backgroundColor: theme.colors.background,
                                color: theme.colors.text,
                                fontSize: '14px',
                            } }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx("button", { onClick: expandAll, style: {
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`,
                                        backgroundColor: theme.colors.background,
                                        color: theme.colors.text,
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                    }, children: "Expand All" }), _jsx("button", { onClick: collapseAll, style: {
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`,
                                        backgroundColor: theme.colors.background,
                                        color: theme.colors.text,
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                    }, children: "Collapse All" })] })] }), _jsx("div", { style: {
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px',
                    }, children: loading ? (_jsx("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: theme.colors.textSecondary,
                        }, children: "Loading events..." })) : filteredSegments.length === 0 ? (_jsx("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: theme.colors.textSecondary,
                        }, children: searchQuery ? 'No matching events found' : 'No events to display' })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: filteredSegments.map((segment, index) => (_jsxs("div", { style: {
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '12px',
                                overflow: 'hidden',
                                backgroundColor: theme.colors.background,
                            }, children: [_jsxs("div", { onClick: () => toggleSegment(index), style: {
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        borderLeft: `4px solid ${eventSegmenter.getSegmentColor(segment.type)}`,
                                        backgroundColor: expandedSegments.has(index)
                                            ? theme.colors.backgroundSecondary
                                            : theme.colors.background,
                                    }, children: [expandedSegments.has(index) ? _jsx(ChevronDown, { size: 16 }) : _jsx(ChevronRight, { size: 16 }), _jsx("div", { style: {
                                                color: eventSegmenter.getSegmentColor(segment.type),
                                                display: 'flex',
                                                alignItems: 'center',
                                            }, children: getSegmentIcon(segment.type) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: {
                                                        fontSize: '14px',
                                                        fontWeight: 500,
                                                        color: theme.colors.text,
                                                    }, children: segment.summary }), segment.todoInfo && (_jsxs("div", { style: {
                                                        fontSize: '12px',
                                                        color: theme.colors.textSecondary,
                                                        marginTop: '2px',
                                                    }, children: ["Status: ", segment.todoInfo.status] }))] }), _jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                fontSize: '12px',
                                                color: theme.colors.textSecondary,
                                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(Clock, { size: 12 }), formatDuration(segment.stats.duration)] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(Wrench, { size: 12 }), segment.events.length, " events"] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(FileText, { size: 12 }), segment.stats.filesAccessed.length, " files"] })] })] }), expandedSegments.has(index) && (_jsx(EventSegmentView, { segment: segment, theme: theme }))] }, index))) })) }), _jsxs("div", { style: {
                        padding: '16px 24px',
                        borderTop: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }, children: [_jsxs("div", { style: {
                                fontSize: '12px',
                                color: theme.colors.textSecondary,
                            }, children: ["Showing ", filteredSegments.length, " of ", segments.length, " segments"] }), _jsx("button", { onClick: onClose, style: {
                                padding: '8px 16px',
                                borderRadius: '8px',
                                backgroundColor: theme.colors.primary,
                                color: '#fff',
                                border: 'none',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                            }, children: "Close" })] })] }) }));
};
