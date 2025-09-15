import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';
import { SessionDetailsHeader } from './SessionDetailsHeader';
import { SegmentedTimelineView } from './SegmentedTimelineView';
import { FileActivityView } from './FileActivityView';
import { ToolUseView } from './ToolUseView';
import { KnipAnalysisStats } from './SessionDetailCards';
import { CommitPreview } from './CommitPreview';
import { createTimelineEvents, segmentEventsByStops } from './timelineHelpers';
import { SessionEventType } from '../../../shared/sessionEnums';
// Temporary API stubs for archived sessions
const agentSession = {
    getSession: async (directory, sessionId) => {
        try {
            // Try to get archived session first
            const archivedSession = await AgentSessionArchiveService.getArchivedSession(sessionId);
            if (archivedSession) {
                return archivedSession;
            }
            // TODO: Fall back to active session API when it's available
            return null;
        }
        catch (error) {
            console.error('Failed to load session:', error);
            return null;
        }
    },
    updateRepositoryInfo: async (directory, sessionId) => {
        // Stub - archived sessions don't need repository info updates
        return Promise.resolve();
    }
};
// Configuration constants
const FILE_SIZE_THRESHOLDS = {
    WARNING: 650, // Lines at which to show warning
    LARGE: 800, // Lines at which to mark as large file
};
export const SessionDetailsPanel = ({ sessionId, directory, initialSession, viewMode, setViewMode, knipAnalysis, setKnipAnalysis, runningKnip, setRunningKnip, analyzingRepos, setAnalyzingRepos, onSessionDeleted, }) => {
    const { theme } = useTheme();
    // Internal state management
    const [session, setSession] = useState(initialSession || null);
    const [newEventIds, setNewEventIds] = useState(new Set());
    const [isLiveSession, setIsLiveSession] = useState(false);
    const [isLoading, setIsLoading] = useState(!initialSession); // Not loading if we have initial data
    // Add fadeIn animation
    useEffect(() => {
        const styleId = 'session-details-panel-animations';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `;
            document.head.appendChild(style);
        }
    }, []);
    // Fetch session data on mount and when sessionId/directory changes
    useEffect(() => {
        let mounted = true;
        const loadSession = async () => {
            // Skip loading if we already have the initial session
            if (initialSession && initialSession.sessionId === sessionId) {
                setSession(initialSession); // Update the session state with the new data
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const sessionData = await agentSession.getSession(directory, sessionId);
                if (!mounted)
                    return;
                if (sessionData) {
                    setSession(sessionData);
                    setIsLoading(false);
                    // Check if session is live
                    const allEvents = createTimelineEvents(sessionData);
                    const mostRecentEvent = allEvents.length > 0 ? allEvents[0] : null;
                    const sessionIsLive = mostRecentEvent
                        ? mostRecentEvent.type !== SessionEventType.STOP
                        : true;
                    setIsLiveSession(sessionIsLive);
                    // Auto-fetch repository info if missing (but don't reload to avoid infinite loop)
                    if (!sessionData.repositories ||
                        sessionData.repositories.length === 0) {
                        agentSession
                            .updateRepositoryInfo(directory, sessionId)
                            .then(() => {
                            // Fetch the updated session data without triggering a full reload
                            return agentSession.getSession(directory, sessionId);
                        })
                            .then((updatedSession) => {
                            if (mounted && updatedSession) {
                                setSession(updatedSession);
                            }
                        })
                            .catch((error) => {
                            console.error('Failed to auto-fetch repository info:', error);
                        });
                    }
                }
                else {
                    setIsLoading(false);
                }
            }
            catch (error) {
                console.error('Failed to load session:', error);
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };
        loadSession();
        return () => {
            mounted = false;
        };
    }, [sessionId, directory, initialSession]);
    // Set up real-time event listeners
    useEffect(() => {
        if (!session || !isLiveSession)
            return;
        // Register this window with the session
        agentSession.registerWindowSession(sessionId);
        // Function to generate event ID
        const generateEventId = (event) => {
            return `${event.type}-${event.timestamp}-${Math.random()}`;
        };
        // Event handlers for real-time updates
        const handleFileAccess = (_event, data) => {
            if (data.sessionId === sessionId) {
                // Mark this event as new
                const eventId = generateEventId({
                    type: 'file-read',
                    timestamp: Date.now(),
                });
                setNewEventIds((prev) => new Set([...prev, eventId]));
                // Remove the "new" status after animation
                setTimeout(() => {
                    setNewEventIds((prev) => {
                        const next = new Set(prev);
                        next.delete(eventId);
                        return next;
                    });
                }, 3000);
                // Refresh the session data
                refreshCurrentSession();
            }
        };
        const handleFileWrite = (_event, data) => {
            if (data.sessionId === sessionId) {
                const eventId = generateEventId({
                    type: 'file-write',
                    timestamp: Date.now(),
                });
                setNewEventIds((prev) => new Set([...prev, eventId]));
                setTimeout(() => {
                    setNewEventIds((prev) => {
                        const next = new Set(prev);
                        next.delete(eventId);
                        return next;
                    });
                }, 3000);
                refreshCurrentSession();
            }
        };
        const handleToolCall = (_event, data) => {
            if (data.sessionId === sessionId) {
                const eventId = generateEventId({
                    type: 'tool',
                    timestamp: Date.now(),
                });
                setNewEventIds((prev) => new Set([...prev, eventId]));
                setTimeout(() => {
                    setNewEventIds((prev) => {
                        const next = new Set(prev);
                        next.delete(eventId);
                        return next;
                    });
                }, 3000);
                refreshCurrentSession();
            }
        };
        const handleSessionStop = (_event, data) => {
            if (data.sessionId === sessionId) {
                setIsLiveSession(false);
                refreshCurrentSession();
            }
        };
        const refreshCurrentSession = async () => {
            try {
                const updatedSession = await agentSession.getSession(directory, sessionId);
                if (updatedSession) {
                    setSession(updatedSession);
                }
            }
            catch (error) {
                console.error('Failed to refresh session:', error);
            }
        };
        // Subscribe to events
        const unsubscribers = [];
        // Set up listeners
        unsubscribers.push(agentSessionExtended.onFileAccess(handleFileAccess));
        unsubscribers.push(agentSessionExtended.onFileWrite(handleFileWrite));
        unsubscribers.push(agentSessionExtended.onToolCall(handleToolCall));
        unsubscribers.push(agentSessionExtended.onSessionStopped(handleSessionStop));
        // Cleanup
        return () => {
            unsubscribers.forEach((unsub) => unsub());
            // Unregister from session events
            agentSession.unregisterWindowSession(sessionId);
        };
    }, [session, sessionId, directory, isLiveSession]);
    // Show header immediately with basic info, even while loading
    return (_jsxs("div", { style: {
            height: '100%',
            backgroundColor: theme.colors.background,
            display: 'flex',
            flexDirection: 'column',
            opacity: 1,
            animation: 'fadeIn 0.5s ease-in-out',
        }, children: [_jsx(SessionDetailsHeader, { sessionId: sessionId, workingDirectory: directory, basicGitInfo: session?.basicGitInfo, repositories: session?.repositories, onDeleteSession: onSessionDeleted
                    ? async () => {
                        try {
                            const result = await agentSession.deleteSession(directory, sessionId);
                            if (result.success) {
                                onSessionDeleted();
                            }
                            else {
                                console.error('Failed to delete session:', result.error);
                            }
                        }
                        catch (error) {
                            console.error('Failed to delete session:', error);
                        }
                    }
                    : undefined }), _jsx("div", { style: { flexShrink: 0 }, children: _jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: `1px solid ${theme.colors.border}`,
                    }, children: [_jsx("button", { onClick: () => setViewMode('timeline'), style: {
                                flex: 1,
                                padding: '16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                backgroundColor: viewMode === 'timeline'
                                    ? theme.colors.primary
                                    : theme.colors.backgroundTertiary,
                                color: viewMode === 'timeline'
                                    ? theme.colors.background
                                    : theme.colors.textSecondary,
                                border: 'none',
                                cursor: 'pointer',
                            }, onMouseEnter: (e) => {
                                if (viewMode !== 'timeline') {
                                    e.currentTarget.style.backgroundColor =
                                        theme.colors.backgroundHover;
                                }
                            }, onMouseLeave: (e) => {
                                if (viewMode !== 'timeline') {
                                    e.currentTarget.style.backgroundColor =
                                        theme.colors.backgroundTertiary;
                                }
                            }, children: "Timeline" }), _jsx("button", { onClick: () => setViewMode('files'), style: {
                                flex: 1,
                                padding: '16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                backgroundColor: viewMode === 'files'
                                    ? theme.colors.primary
                                    : theme.colors.backgroundTertiary,
                                color: viewMode === 'files'
                                    ? theme.colors.background
                                    : theme.colors.textSecondary,
                                border: 'none',
                                cursor: 'pointer',
                            }, onMouseEnter: (e) => {
                                if (viewMode !== 'files') {
                                    e.currentTarget.style.backgroundColor =
                                        theme.colors.backgroundHover;
                                }
                            }, onMouseLeave: (e) => {
                                if (viewMode !== 'files') {
                                    e.currentTarget.style.backgroundColor =
                                        theme.colors.backgroundTertiary;
                                }
                            }, children: "File Activity" }), _jsx("button", { onClick: () => setViewMode('tools'), style: {
                                flex: 1,
                                padding: '16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                backgroundColor: viewMode === 'tools'
                                    ? theme.colors.primary
                                    : theme.colors.backgroundTertiary,
                                color: viewMode === 'tools'
                                    ? theme.colors.background
                                    : theme.colors.textSecondary,
                                border: 'none',
                                cursor: 'pointer',
                            }, onMouseEnter: (e) => {
                                if (viewMode !== 'tools') {
                                    e.currentTarget.style.backgroundColor =
                                        theme.colors.backgroundHover;
                                }
                            }, onMouseLeave: (e) => {
                                if (viewMode !== 'tools') {
                                    e.currentTarget.style.backgroundColor =
                                        theme.colors.backgroundTertiary;
                                }
                            }, children: "Tool Use" })] }) }), _jsxs("div", { style: { flex: 1, overflowY: 'auto' }, children: [!isLoading && session && session.basicGitInfo && (_jsx(CommitPreview, { sessionId: sessionId, directory: directory, onCommit: () => {
                            // Refresh session to update commit status
                            refreshCurrentSession();
                        } })), isLoading || !session ? (_jsx("div", { style: {
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.6,
                        }, children: _jsx("div", { style: { color: theme.colors.textSecondary }, children: isLoading ? 'Loading session details...' : 'Session not found' }) })) : (_jsxs(_Fragment, { children: [viewMode === 'timeline' && (_jsx("div", { style: { height: '100%' }, children: _jsx(SegmentedTimelineView, { session: session, newEventIds: newEventIds, segmentEventsByStops: segmentEventsByStops }) })), viewMode === 'files' && (_jsx(FileActivityView, { session: session, FILE_SIZE_THRESHOLDS: FILE_SIZE_THRESHOLDS })), viewMode === 'tools' && _jsx(ToolUseView, { session: session })] }))] }), knipAnalysis && viewMode === 'files' && !isLoading && session && (_jsx("div", { style: {
                    marginTop: '16px',
                    padding: '16px',
                    borderTop: `1px solid ${theme.colors.border}`,
                }, children: _jsx(KnipAnalysisStats, { analysis: knipAnalysis, isLoading: runningKnip }) }))] }));
};
