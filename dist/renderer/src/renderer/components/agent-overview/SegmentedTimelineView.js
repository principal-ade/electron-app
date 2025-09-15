import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { FileText, Wrench, Globe, FileText as SummaryIcon, List, } from 'lucide-react';
import { ActiveSegmentTimeline } from './ActiveSegmentTimeline';
import { SegmentSummary } from './SegmentSummary';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { aiService } from '../../main-process-api/AIService';
export const SegmentedTimelineView = ({ session, newEventIds, segmentEventsByStops, }) => {
    const { theme } = useTheme();
    const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
    const segments = segmentEventsByStops(session);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [viewMode, setViewMode] = useState('timeline');
    const [segmentSummaries, setSegmentSummaries] = useState({});
    const [selectedModel, setSelectedModel] = useState('');
    const [availableModels, setAvailableModels] = useState([]);
    // Load user preferences and check available models
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const response = await aiService.checkOllamaStatus();
                if (response && response.models) {
                    setAvailableModels(response.models);
                }
            }
            catch (error) {
                console.warn('Failed to get available models:', error);
            }
            const prefs = await UserPreferencesService.getPreferences();
            if (prefs.ollamaModel) {
                setSelectedModel(prefs.ollamaModel);
            }
        };
        loadPreferences();
    }, []);
    // Add CSS animation for pulse if not already defined
    React.useEffect(() => {
        const styleId = 'segmented-timeline-animations';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `;
            document.head.appendChild(style);
        }
    }, []);
    // Reset to first segment when session changes, or adjust if index is out of bounds
    useEffect(() => {
        if (segments.length > 0) {
            if (activeSegmentIndex >= segments.length) {
                setActiveSegmentIndex(segments.length - 1);
            }
        }
        else {
            setActiveSegmentIndex(0);
        }
    }, [segments.length]);
    // Reset to latest segment when session changes
    useEffect(() => {
        if (segments.length > 0) {
            setActiveSegmentIndex(segments.length - 1);
            // Disable transition briefly to prevent animation on session change
            setIsInitialLoad(true);
            setTimeout(() => setIsInitialLoad(false), 50);
        }
        // Clear segment summaries when session changes
        setSegmentSummaries({});
        // Reset view mode to timeline
        setViewMode('timeline');
    }, [session.sessionId]);
    if (segments.length === 0) {
        return (_jsx("div", { style: {
                textAlign: 'center',
                padding: '32px 0',
                color: theme.colors.textSecondary,
            }, children: _jsx("p", { children: "No activity recorded for this session" }) }));
    }
    const activeSegment = segments[activeSegmentIndex] || segments[0];
    // Helper to format duration
    const formatDuration = (start, end) => {
        const duration = (end || Date.now()) - start;
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };
    // Helper to get segment summary
    const getSegmentSummary = (segment) => {
        // Filter out stop events for counting
        const nonStopEvents = segment.events.filter((e) => e.type !== 'stop');
        const fileCount = new Set(nonStopEvents
            .filter((e) => e.type === 'file-read' || e.type === 'file-write')
            .map((e) => e.data.file)).size;
        const toolCount = nonStopEvents.filter((e) => e.type === 'tool').length;
        const webCount = nonStopEvents.filter((e) => e.type === 'web').length;
        return { fileCount, toolCount, webCount };
    };
    return (_jsxs("div", { style: { height: '100%', display: 'flex', flexDirection: 'column' }, children: [_jsx("div", { style: {
                    flexShrink: 0,
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    padding: '12px 16px',
                }, children: _jsxs("div", { style: { position: 'relative' }, children: [_jsx("div", { style: { overflow: 'hidden', position: 'relative', height: '96px' }, children: _jsx("div", { style: {
                                    display: 'flex',
                                    gap: '8px',
                                    transition: isInitialLoad ? 'none' : 'transform 0.3s',
                                    position: 'absolute',
                                    left: '50%',
                                    top: 0,
                                    transform: `translateX(calc(-104px - ${activeSegmentIndex * 216}px))`,
                                }, children: segments.map((segment, index) => {
                                    const summary = getSegmentSummary(segment);
                                    const isActive = index === activeSegmentIndex;
                                    const isCurrent = !segment.endTime;
                                    return (_jsxs("button", { onClick: () => {
                                            setIsInitialLoad(false);
                                            setActiveSegmentIndex(index);
                                        }, style: {
                                            flexShrink: 0,
                                            width: '208px',
                                            height: '96px',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
                                            backgroundColor: isActive
                                                ? theme.colors.backgroundTertiary
                                                : `${theme.colors.backgroundTertiary}80`,
                                            boxShadow: isActive
                                                ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                                : 'none',
                                            transition: 'all 0.2s',
                                            cursor: 'pointer',
                                        }, onMouseEnter: (e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.backgroundColor =
                                                    theme.colors.backgroundTertiary;
                                                e.currentTarget.style.borderColor =
                                                    theme.colors.backgroundHover;
                                            }
                                        }, onMouseLeave: (e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.backgroundColor = `${theme.colors.backgroundTertiary}80`;
                                                e.currentTarget.style.borderColor = theme.colors.border;
                                            }
                                        }, children: [_jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '8px',
                                                }, children: [_jsxs("div", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                        }, children: [_jsxs("span", { style: {
                                                                    fontSize: '12px',
                                                                    fontWeight: 500,
                                                                    color: theme.colors.text,
                                                                }, children: ["Segment ", segment.segmentNumber] }), isCurrent && (_jsxs("span", { style: {
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    fontSize: '12px',
                                                                    color: theme.colors.success,
                                                                }, children: [_jsxs("span", { style: {
                                                                            position: 'relative',
                                                                            display: 'flex',
                                                                            height: '8px',
                                                                            width: '8px',
                                                                        }, children: [_jsx("span", { style: {
                                                                                    animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                                                                                    position: 'absolute',
                                                                                    display: 'inline-flex',
                                                                                    height: '100%',
                                                                                    width: '100%',
                                                                                    borderRadius: '50%',
                                                                                    backgroundColor: theme.colors.success,
                                                                                    opacity: 0.75,
                                                                                } }), _jsx("span", { style: {
                                                                                    position: 'relative',
                                                                                    display: 'inline-flex',
                                                                                    borderRadius: '50%',
                                                                                    height: '8px',
                                                                                    width: '8px',
                                                                                    backgroundColor: theme.colors.success,
                                                                                } })] }), "Working"] }))] }), index === activeSegmentIndex && (_jsxs("div", { style: {
                                                            display: 'flex',
                                                            gap: '4px',
                                                            marginLeft: '8px',
                                                        }, children: [_jsx("button", { onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    setViewMode('timeline');
                                                                }, style: {
                                                                    padding: '4px 8px',
                                                                    borderRadius: '4px',
                                                                    border: 'none',
                                                                    backgroundColor: viewMode === 'timeline'
                                                                        ? theme.colors.primary
                                                                        : 'transparent',
                                                                    color: viewMode === 'timeline'
                                                                        ? '#FFFFFF'
                                                                        : theme.colors.textSecondary,
                                                                    fontSize: '11px',
                                                                    fontWeight: 500,
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    transition: 'all 0.2s',
                                                                }, title: "View timeline", children: _jsx(List, { size: 12 }) }), _jsx("button", { onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    setViewMode('summary');
                                                                }, style: {
                                                                    padding: '4px 8px',
                                                                    borderRadius: '4px',
                                                                    border: 'none',
                                                                    backgroundColor: viewMode === 'summary'
                                                                        ? theme.colors.primary
                                                                        : 'transparent',
                                                                    color: viewMode === 'summary'
                                                                        ? '#FFFFFF'
                                                                        : theme.colors.textSecondary,
                                                                    fontSize: '11px',
                                                                    fontWeight: 500,
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    transition: 'all 0.2s',
                                                                }, title: "View summary", children: _jsx(SummaryIcon, { size: 12 }) })] }))] }), _jsxs("div", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.textSecondary,
                                                    marginBottom: '8px',
                                                }, children: [new Date(segment.startTime).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    }), ' - ', segment.endTime
                                                        ? new Date(segment.endTime).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })
                                                        : 'Now', _jsxs("span", { style: {
                                                            marginLeft: '4px',
                                                            color: theme.colors.textTertiary,
                                                        }, children: ["(", formatDuration(segment.startTime, segment.endTime), ")"] })] }), _jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    fontSize: '12px',
                                                }, children: [summary.fileCount > 0 && (_jsxs("span", { style: {
                                                            color: theme.colors.textSecondary,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }, children: [_jsx(FileText, { size: 14 }), " ", summary.fileCount] })), summary.toolCount > 0 && (_jsxs("span", { style: {
                                                            color: theme.colors.textSecondary,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }, children: [_jsx(Wrench, { size: 14 }), " ", summary.toolCount] })), summary.webCount > 0 && (_jsxs("span", { style: {
                                                            color: theme.colors.textSecondary,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }, children: [_jsx(Globe, { size: 14 }), " ", summary.webCount] }))] })] }, segment.segmentNumber));
                                }) }) }), segments.length > 1 && (_jsx("button", { onClick: () => setActiveSegmentIndex(Math.max(0, activeSegmentIndex - 1)), disabled: activeSegmentIndex === 0, style: {
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '64px',
                                height: '96px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10,
                                transition: 'all 0.2s',
                                color: activeSegmentIndex === 0
                                    ? theme.colors.textMuted
                                    : theme.colors.textSecondary,
                                cursor: activeSegmentIndex === 0 ? 'not-allowed' : 'pointer',
                                background: activeSegmentIndex === 0
                                    ? `linear-gradient(to right, ${theme.colors.backgroundSecondary}cc, transparent)`
                                    : `linear-gradient(to right, ${theme.colors.backgroundSecondary}99, transparent)`,
                                border: 'none',
                            }, onMouseEnter: (e) => {
                                if (activeSegmentIndex !== 0) {
                                    e.currentTarget.style.color = theme.colors.text;
                                    e.currentTarget.style.background = `linear-gradient(to right, ${theme.colors.backgroundSecondary}cc, transparent)`;
                                }
                            }, onMouseLeave: (e) => {
                                if (activeSegmentIndex !== 0) {
                                    e.currentTarget.style.color = theme.colors.textSecondary;
                                    e.currentTarget.style.background = `linear-gradient(to right, ${theme.colors.backgroundSecondary}99, transparent)`;
                                }
                            }, children: _jsx("svg", { style: { width: '20px', height: '20px' }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) })), segments.length > 1 && (_jsx("button", { onClick: () => setActiveSegmentIndex(Math.min(segments.length - 1, activeSegmentIndex + 1)), disabled: activeSegmentIndex === segments.length - 1, style: {
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                width: '64px',
                                height: '96px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10,
                                transition: 'all 0.2s',
                                color: activeSegmentIndex === segments.length - 1
                                    ? theme.colors.textMuted
                                    : theme.colors.textSecondary,
                                cursor: activeSegmentIndex === segments.length - 1
                                    ? 'not-allowed'
                                    : 'pointer',
                                background: activeSegmentIndex === segments.length - 1
                                    ? `linear-gradient(to left, ${theme.colors.backgroundSecondary}cc, transparent)`
                                    : `linear-gradient(to left, ${theme.colors.backgroundSecondary}99, transparent)`,
                                border: 'none',
                            }, onMouseEnter: (e) => {
                                if (activeSegmentIndex !== segments.length - 1) {
                                    e.currentTarget.style.color = theme.colors.text;
                                    e.currentTarget.style.background = `linear-gradient(to left, ${theme.colors.backgroundSecondary}cc, transparent)`;
                                }
                            }, onMouseLeave: (e) => {
                                if (activeSegmentIndex !== segments.length - 1) {
                                    e.currentTarget.style.color = theme.colors.textSecondary;
                                    e.currentTarget.style.background = `linear-gradient(to left, ${theme.colors.backgroundSecondary}99, transparent)`;
                                }
                            }, children: _jsx("svg", { style: { width: '20px', height: '20px' }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }) }))] }) }), viewMode === 'timeline' ? (_jsx(ActiveSegmentTimeline, { activeSegment: activeSegment, session: session, newEventIds: newEventIds })) : (_jsx(SegmentSummary, { segment: activeSegment, session: session, segmentSummary: segmentSummaries[`segment-${activeSegment?.segmentNumber}`], onSummaryGenerated: (summary) => {
                    if (activeSegment) {
                        setSegmentSummaries((prev) => ({
                            ...prev,
                            [`segment-${activeSegment.segmentNumber}`]: summary,
                        }));
                    }
                }, onRegenerateSummary: () => {
                    if (activeSegment) {
                        // Clear the existing summary to trigger regeneration
                        setSegmentSummaries((prev) => {
                            const newSummaries = { ...prev };
                            delete newSummaries[`segment-${activeSegment.segmentNumber}`];
                            return newSummaries;
                        });
                    }
                }, selectedModel: selectedModel, availableModels: availableModels }, `segment-summary-${activeSegment?.segmentNumber}-${session.sessionId}`))] }));
};
