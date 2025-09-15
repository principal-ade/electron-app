import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { X, Code, FileJson, Copy, CheckCircle, TestTube, Archive } from 'lucide-react';
import { NormalizedEventCard } from './NormalizedEventCard';
import { EventProcessingTestView } from './EventProcessingTestView';
import { ArchiveTestView } from './ArchiveTestView';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';
export const AgentSessionDebugModal = ({ sessionId, sessionName, events: initialEvents, highlightLayer, onClose, onLoadEvents, onApplyLayer }) => {
    const { theme } = useTheme();
    const [events, setEvents] = useState(initialEvents || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('events');
    const [copied, setCopied] = useState(false);
    const [eventFilter, setEventFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showTestView, setShowTestView] = useState(false);
    const [eventToReprocess, setEventToReprocess] = useState();
    const [showArchiveTest, setShowArchiveTest] = useState(false);
    const [sessionStatus, setSessionStatus] = useState({ isArchived: false });
    const [isReprocessing, setIsReprocessing] = useState(false);
    // Load events if not provided
    useEffect(() => {
        const init = async () => {
            if (!initialEvents && onLoadEvents) {
                await loadEvents();
            }
            await checkSessionStatus();
        };
        init();
    }, [sessionId]);
    // Update time since last event periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (sessionStatus.lastEventTime) {
                const timeSince = formatTimeSince(sessionStatus.lastEventTime);
                setSessionStatus(prev => ({ ...prev, timeSinceLastEvent: timeSince }));
            }
        }, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [sessionStatus.lastEventTime]);
    const loadEvents = async () => {
        if (!onLoadEvents)
            return;
        setLoading(true);
        setError(null);
        try {
            const loadedEvents = await onLoadEvents(sessionId);
            console.log('Loaded events:', {
                count: loadedEvents.length,
                sample: loadedEvents[0],
                toolEvents: loadedEvents.filter(e => e.eventType === 'pre-tool-use' || e.eventType === 'post-tool-use').slice(0, 3)
            });
            setEvents(loadedEvents);
            // Update last event time and processed event count
            if (loadedEvents.length > 0) {
                const lastEvent = loadedEvents[loadedEvents.length - 1];
                const lastTime = lastEvent.timestamp || lastEvent.data?.timestamp;
                if (lastTime) {
                    setSessionStatus(prev => ({
                        ...prev,
                        lastEventTime: lastTime,
                        timeSinceLastEvent: formatTimeSince(lastTime),
                        processedEventCount: loadedEvents.length
                    }));
                }
            }
            else {
                setSessionStatus(prev => ({
                    ...prev,
                    processedEventCount: 0
                }));
            }
        }
        catch (err) {
            console.error('Failed to load events:', err);
            setError('Failed to load session events');
        }
        finally {
            setLoading(false);
        }
    };
    const checkSessionStatus = async () => {
        try {
            console.log(`[SessionDebugModal] Checking status for session ${sessionId}`);
            // Check if session is archived (returns null if not found, no error thrown)
            const archived = await AgentSessionArchiveService.loadSession(sessionId);
            console.log(`[SessionDebugModal] Archive check result:`, {
                archived,
                type: typeof archived,
                isNull: archived === null,
                isUndefined: archived === undefined,
                isFalsy: !archived,
                keys: archived ? Object.keys(archived) : 'N/A'
            });
            // Check if session exists in active storage using new API
            // We need to find the directory for this session first
            let activeSession = null;
            try {
                const allSessions = await AgentSessionService.getActiveSessions();
                for (const dirSessions of allSessions) {
                    const found = dirSessions.summaries.find(s => s.sessionId === sessionId);
                    if (found) {
                        activeSession = await AgentSessionService.getSession(sessionId, dirSessions.directory);
                        break;
                    }
                }
            }
            catch (err) {
                console.log(`[SessionDebugModal] Error getting active session:`, err);
            }
            console.log(`[SessionDebugModal] Active session check:`, {
                hasActiveSession: !!activeSession,
                activeSessionKeys: activeSession ? Object.keys(activeSession).slice(0, 5) : 'N/A'
            });
            // Calculate approximate storage size
            const storageSize = activeSession ? JSON.stringify(activeSession).length : 0;
            // Check for raw events to compare with processed events
            let rawEventCount = 0;
            let processedEventCount = events.length;
            try {
                // Get raw events count from the events API
                const rawEvents = await AgentSessionService.getRawSessionEvents(sessionId);
                rawEventCount = rawEvents?.length || 0;
                console.log(`[SessionDebugModal] Raw events: ${rawEventCount}, Processed events: ${processedEventCount}`);
            }
            catch (err) {
                console.log(`[SessionDebugModal] Could not get raw event count:`, err);
            }
            const hasDiscrepancy = rawEventCount > 0 && rawEventCount !== processedEventCount;
            const newStatus = {
                isArchived: !!archived,
                storageSize,
                lastEventTime: sessionStatus.lastEventTime,
                timeSinceLastEvent: sessionStatus.timeSinceLastEvent,
                rawEventCount,
                processedEventCount,
                hasDiscrepancy
            };
            console.log(`[SessionDebugModal] Setting session status:`, newStatus);
            setSessionStatus(newStatus);
        }
        catch (err) {
            console.error('[SessionDebugModal] Error checking session status:', err);
        }
    };
    const formatTimeSince = (timestamp) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0)
            return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0)
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0)
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    };
    const formatBytes = (bytes) => {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };
    const handleArchiveCleanup = async () => {
        if (!sessionStatus.isArchived) {
            setError('Session must be archived before cleanup');
            return;
        }
        const confirmed = window.confirm(`This will remove the active session data and free up approximately ${formatBytes(sessionStatus.storageSize || 0)} of storage.\n\n` +
            'The archived version will be preserved. Continue?');
        if (!confirmed)
            return;
        try {
            // Delete from active storage only (archive is already preserved)
            const result = await AgentSessionService.deleteFromActive(sessionId);
            if (result) {
                // Close modal since session is no longer in active storage
                onClose();
            }
        }
        catch (err) {
            console.error('Cleanup failed:', err);
            setError('Failed to cleanup active session data');
        }
    };
    const handleReprocessEvents = async () => {
        if (isReprocessing)
            return;
        const confirmed = window.confirm(`This will reprocess ${sessionStatus.rawEventCount || 0} raw events for this session.\n\n` +
            'This may help recover missing processed events. Continue?');
        if (!confirmed)
            return;
        setIsReprocessing(true);
        setError(null);
        try {
            console.log(`[SessionDebugModal] Reprocessing events for session ${sessionId}`);
            const result = await AgentSessionService.reprocessSession(sessionId);
            if (result.success) {
                console.log(`[SessionDebugModal] Reprocessed ${result.processedCount} events`);
                // Reload events to show the new processed events
                await loadEvents();
                // Recheck status to update counts
                await checkSessionStatus();
                setError(null);
            }
            else {
                setError(result.error || 'Failed to reprocess events');
            }
        }
        catch (err) {
            console.error('[SessionDebugModal] Reprocessing failed:', err);
            setError('Failed to reprocess events: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
        finally {
            setIsReprocessing(false);
        }
    };
    // Filter events based on type and search
    const filteredEvents = events.filter(event => {
        // Type filter
        if (eventFilter !== 'all') {
            if (eventFilter === 'tools' && event.eventType !== 'pre-tool-use' && event.eventType !== 'post-tool-use') {
                return false;
            }
            if (eventFilter === 'files' && (!event.files || event.files.length === 0)) {
                return false;
            }
            if (eventFilter === 'lifecycle' && !['session-start', 'stop', 'subagent-stop', 'pre-compact'].includes(event.eventType)) {
                return false;
            }
        }
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const searchableText = [
                event.eventType,
                event.toolName,
                event.files?.[0]?.displayPath,
                JSON.stringify(event.data)
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchableText.includes(query)) {
                return false;
            }
        }
        return true;
    });
    // Generate separate read and write highlight layers from events
    const generateHighlightLayers = () => {
        if (!events || events.length === 0)
            return {
                read: null,
                write: null,
                readEventIndices: [],
                writeEventIndices: [],
                eventsWithPaths: []
            };
        // Separate file paths by operation type
        const readPaths = new Set();
        const writePaths = new Set();
        const readEventIndices = [];
        const writeEventIndices = [];
        const eventsWithPaths = [];
        events.forEach((event, index) => {
            // Check if this event has any paths
            const hasPaths = event.files && event.files.length > 0;
            if (hasPaths) {
                eventsWithPaths.push(index);
                // Determine if this is a read or write operation based on tool name
                // Check against known write tools (matching the main process logic)
                const writeTools = new Set([
                    'Write', 'write', 'write_file', 'writefile',
                    'Edit', 'edit', 'edit_file', 'editfile',
                    'MultiEdit', 'multiedit', 'multi_edit',
                    'str_replace_editor', 'str_replace_based_edit_tool',
                    'str_replace', 'Create', 'create', 'Delete', 'delete',
                    'NotebookWrite', 'NotebookEdit'
                ]);
                const isWriteOperation = event.toolName && writeTools.has(event.toolName);
                console.log(`Event #${index + 1} - Tool: ${event.toolName}, Type: ${event.eventType}, IsWrite: ${isWriteOperation}, Paths:`, {
                    primary: event.files?.[0]?.displayPath,
                    additional: (event.files?.length || 0) - 1
                });
                const targetSet = isWriteOperation ? writePaths : readPaths;
                const targetIndices = isWriteOperation ? writeEventIndices : readEventIndices;
                if (event.files && event.files.length > 0) {
                    event.files.forEach((file) => {
                        // Use displayPath for UI, with safe fallback
                        const pathToUse = file.displayPath || '[path not normalized]';
                        if (pathToUse && pathToUse !== '[path not normalized]') {
                            targetSet.add(pathToUse);
                            if (!targetIndices.includes(index)) {
                                targetIndices.push(index);
                            }
                        }
                    });
                }
            }
        });
        // Create read layer
        const readLayer = readPaths.size > 0 ? {
            id: `session-${sessionId}-read`,
            name: `${sessionName || `Session ${sessionId.substring(0, 8)}`} (Reads)`,
            enabled: true,
            color: '#3b82f6', // Blue for reads
            opacity: 0.4,
            borderWidth: 2,
            priority: 10,
            items: Array.from(readPaths).map(path => ({
                path,
                type: 'file',
                renderStrategy: 'border'
            })),
            dynamic: true
        } : null;
        // Create write layer
        const writeLayer = writePaths.size > 0 ? {
            id: `session-${sessionId}-write`,
            name: `${sessionName || `Session ${sessionId.substring(0, 8)}`} (Writes)`,
            enabled: true,
            color: '#ef4444', // Red for writes
            opacity: 0.6,
            borderWidth: 3,
            priority: 15, // Higher priority than reads
            items: Array.from(writePaths).map(path => ({
                path,
                type: 'file',
                renderStrategy: 'fill' // Fill for writes to make them more visible
            })),
            dynamic: true
        } : null;
        console.log('Layer Generation Summary:', {
            totalEvents: events.length,
            eventsWithPaths: eventsWithPaths.length,
            readEvents: readEventIndices.length,
            writeEvents: writeEventIndices.length,
            readPaths: readPaths.size,
            writePaths: writePaths.size
        });
        return {
            read: readLayer,
            write: writeLayer,
            readEventIndices,
            writeEventIndices,
            eventsWithPaths
        };
    };
    const { read: readLayer, write: writeLayer, readEventIndices, writeEventIndices, eventsWithPaths } = generateHighlightLayers();
    const displayLayers = { read: readLayer, write: writeLayer };
    // For backward compatibility, use provided highlightLayer or combine read/write for display
    const displayLayer = highlightLayer || readLayer || writeLayer;
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (_jsxs("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }, children: [_jsxs("div", { style: {
                    width: '90%',
                    maxWidth: '1400px',
                    height: '85%',
                    backgroundColor: theme.colors.background,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }, children: [_jsxs("div", { style: {
                            padding: '16px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.backgroundSecondary,
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(Code, { size: 20, color: "#7c3aed" }), _jsx("h2", { style: {
                                                    fontSize: '18px',
                                                    fontWeight: 600,
                                                    color: theme.colors.text,
                                                    margin: 0,
                                                }, children: "Session Debug View" }), _jsxs("span", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.textSecondary,
                                                    fontFamily: 'monospace',
                                                }, children: [sessionId.substring(0, 12), "..."] }), sessionName && (_jsx("span", { style: {
                                                    fontSize: '12px',
                                                    color: '#7c3aed',
                                                    padding: '2px 8px',
                                                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                                                    borderRadius: '4px',
                                                }, children: sessionName }))] }), _jsxs("div", { style: { display: 'flex', gap: '8px', alignItems: 'center' }, children: [_jsx("button", { onClick: () => setShowArchiveTest(true), style: {
                                                    padding: '6px',
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#8b5cf6',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }, title: "Test Archive Functionality", children: _jsx(Archive, { size: 20 }) }), _jsx("button", { onClick: () => setShowTestView(true), style: {
                                                    padding: '6px',
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#10b981',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }, title: "Open Event Processing Test", children: _jsx(TestTube, { size: 20 }) }), _jsx("button", { onClick: onClose, style: {
                                                    padding: '6px',
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: theme.colors.textSecondary,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }, children: _jsx(X, { size: 20 }) })] })] }), _jsxs("div", { style: {
                                    marginTop: '12px',
                                    padding: '8px 0',
                                    display: 'flex',
                                    gap: '24px',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                }, children: [sessionStatus.timeSinceLastEvent && (_jsxs("div", { children: [_jsx("span", { style: { fontWeight: 600 }, children: "Last Event:" }), ' ', _jsx("span", { style: { color: theme.colors.text }, children: sessionStatus.timeSinceLastEvent })] })), _jsxs("div", { children: [_jsx("span", { style: { fontWeight: 600 }, children: "Status:" }), ' ', _jsx("span", { style: {
                                                    color: sessionStatus.isArchived ? '#10b981' : '#f59e0b',
                                                    fontWeight: 600
                                                }, children: sessionStatus.isArchived ? '✓ Archived' : '○ Active' })] }), sessionStatus.storageSize && sessionStatus.storageSize > 0 && (_jsxs("div", { children: [_jsx("span", { style: { fontWeight: 600 }, children: "Active Storage:" }), ' ', _jsx("span", { style: { color: theme.colors.text }, children: formatBytes(sessionStatus.storageSize) })] })), sessionStatus.rawEventCount !== undefined && sessionStatus.processedEventCount !== undefined && (_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }, children: [_jsx("span", { style: { fontWeight: 600 }, children: "Events:" }), ' ', _jsxs("span", { style: {
                                                    color: sessionStatus.hasDiscrepancy ? '#ef4444' : theme.colors.text,
                                                    fontWeight: sessionStatus.hasDiscrepancy ? 600 : 400
                                                }, children: [sessionStatus.processedEventCount, " processed / ", sessionStatus.rawEventCount, " raw"] }), sessionStatus.hasDiscrepancy && (_jsx("span", { style: {
                                                    padding: '2px 6px',
                                                    backgroundColor: '#ef4444',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase'
                                                }, children: "Discrepancy!" }))] })), sessionStatus.hasDiscrepancy && (_jsx("button", { onClick: handleReprocessEvents, disabled: isReprocessing, style: {
                                            marginLeft: sessionStatus.isArchived && sessionStatus.storageSize && sessionStatus.storageSize > 0 ? '0' : 'auto',
                                            padding: '4px 12px',
                                            backgroundColor: isReprocessing ? '#6b7280' : '#f59e0b',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: 'white',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: isReprocessing ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            opacity: isReprocessing ? 0.7 : 1
                                        }, title: "Reprocess all raw events to fix discrepancy", children: isReprocessing ? '⏳ Reprocessing...' : '🔄 Reprocess Events' })), sessionStatus.isArchived && sessionStatus.storageSize && sessionStatus.storageSize > 0 && (_jsx("button", { onClick: handleArchiveCleanup, style: {
                                            marginLeft: sessionStatus.hasDiscrepancy ? '0' : 'auto',
                                            padding: '4px 12px',
                                            backgroundColor: '#dc2626',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: 'white',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                        }, title: `Free up ${formatBytes(sessionStatus.storageSize)} by removing active data (archive will be preserved)`, children: "\uD83E\uDDF9 Clean Up Active Data" }))] }), error && (_jsxs("div", { style: {
                                    marginTop: '8px',
                                    padding: '8px 12px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid #ef4444',
                                    borderRadius: '4px',
                                    color: '#ef4444',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }, children: ["\u26A0\uFE0F ", error] }))] }), _jsxs("div", { style: {
                            display: 'flex',
                            gap: '4px',
                            padding: '0 16px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.backgroundSecondary,
                        }, children: [_jsxs("button", { onClick: () => setActiveTab('events'), style: {
                                    padding: '8px 16px',
                                    border: 'none',
                                    backgroundColor: activeTab === 'events' ? theme.colors.background : 'transparent',
                                    color: activeTab === 'events' ? '#7c3aed' : theme.colors.textSecondary,
                                    borderRadius: '4px 4px 0 0',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginTop: '8px',
                                }, children: [_jsx(Code, { size: 14 }), "Events (", filteredEvents.length, ")"] }), _jsxs("button", { onClick: () => setActiveTab('layer'), style: {
                                    padding: '8px 16px',
                                    border: 'none',
                                    backgroundColor: activeTab === 'layer' ? theme.colors.background : 'transparent',
                                    color: activeTab === 'layer' ? '#7c3aed' : theme.colors.textSecondary,
                                    borderRadius: '4px 4px 0 0',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginTop: '8px',
                                }, children: [_jsx(FileJson, { size: 14 }), "Highlight Layer JSON"] })] }), _jsx("div", { style: {
                            flex: 1,
                            display: 'flex',
                            overflow: 'hidden',
                        }, children: activeTab === 'events' ? (_jsxs("div", { style: {
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '16px',
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        gap: '12px',
                                        marginBottom: '16px',
                                        alignItems: 'center',
                                    }, children: [_jsxs("select", { value: eventFilter, onChange: (e) => setEventFilter(e.target.value), style: {
                                                padding: '6px 12px',
                                                borderRadius: '4px',
                                                border: `1px solid ${theme.colors.border}`,
                                                backgroundColor: theme.colors.backgroundSecondary,
                                                color: theme.colors.text,
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                            }, children: [_jsx("option", { value: "all", children: "All Events" }), _jsx("option", { value: "tools", children: "Tool Events" }), _jsx("option", { value: "files", children: "File Events" }), _jsx("option", { value: "lifecycle", children: "Lifecycle Events" })] }), _jsx("input", { type: "text", placeholder: "Search events...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: {
                                                flex: 1,
                                                maxWidth: '300px',
                                                padding: '6px 12px',
                                                borderRadius: '4px',
                                                border: `1px solid ${theme.colors.border}`,
                                                backgroundColor: theme.colors.backgroundSecondary,
                                                color: theme.colors.text,
                                                fontSize: '12px',
                                            } }), _jsxs("span", { style: {
                                                fontSize: '12px',
                                                color: theme.colors.textSecondary,
                                            }, children: ["Showing ", filteredEvents.length, " of ", events.length, " events"] })] }), (readEventIndices.length > 0 || writeEventIndices.length > 0) && (_jsxs("div", { style: {
                                        padding: '8px',
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        borderRadius: '4px',
                                        marginBottom: '12px',
                                        fontSize: '11px',
                                        display: 'flex',
                                        gap: '16px',
                                    }, children: [_jsxs("div", { style: { color: theme.colors.text }, children: [_jsx("strong", { children: "Events with paths:" }), " ", eventsWithPaths.length, "/", events.length] }), _jsxs("div", { style: { color: '#3b82f6' }, children: [_jsx("strong", { children: "Read layer:" }), " ", readEventIndices.length, " events \u2192 ", readLayer?.items.length || 0, " files"] }), _jsxs("div", { style: { color: '#ef4444' }, children: [_jsx("strong", { children: "Write layer:" }), " ", writeEventIndices.length, " events \u2192 ", writeLayer?.items.length || 0, " files"] })] })), _jsx("div", { style: {
                                        flex: 1,
                                        overflowY: 'auto',
                                        paddingRight: '8px',
                                    }, children: loading ? (_jsx("div", { style: {
                                            textAlign: 'center',
                                            color: theme.colors.textSecondary,
                                            padding: '40px',
                                        }, children: "Loading events..." })) : error ? (_jsx("div", { style: {
                                            textAlign: 'center',
                                            color: theme.colors.error || '#ef4444',
                                            padding: '40px',
                                        }, children: error })) : filteredEvents.length === 0 ? (_jsx("div", { style: {
                                            textAlign: 'center',
                                            color: theme.colors.textSecondary,
                                            padding: '40px',
                                        }, children: "No events found" })) : (filteredEvents.map((event, idx) => {
                                        const globalIndex = events.indexOf(event);
                                        const isInReadLayer = readEventIndices.includes(globalIndex);
                                        const isInWriteLayer = writeEventIndices.includes(globalIndex);
                                        const hasPath = eventsWithPaths.includes(globalIndex);
                                        return (_jsx(NormalizedEventCard, { event: event, index: idx + 1, compact: false, showRawData: true, layerBadges: (isInReadLayer || isInWriteLayer || hasPath) ? (_jsxs("div", { style: {
                                                    display: 'flex',
                                                    gap: '4px',
                                                    marginLeft: '8px',
                                                }, children: [isInReadLayer && (_jsxs("span", { style: {
                                                            padding: '2px 6px',
                                                            backgroundColor: '#3b82f6',
                                                            color: 'white',
                                                            borderRadius: '12px',
                                                            fontSize: '10px',
                                                            fontWeight: 600,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px',
                                                        }, title: "Included in Read Layer", children: [_jsx("span", { style: { fontSize: '8px' }, children: "\uD83D\uDCD6" }), " READ"] })), isInWriteLayer && (_jsxs("span", { style: {
                                                            padding: '2px 6px',
                                                            backgroundColor: '#ef4444',
                                                            color: 'white',
                                                            borderRadius: '12px',
                                                            fontSize: '10px',
                                                            fontWeight: 600,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px',
                                                        }, title: "Included in Write Layer", children: [_jsx("span", { style: { fontSize: '8px' }, children: "\u270F\uFE0F" }), " WRITE"] })), hasPath && !isInReadLayer && !isInWriteLayer && (_jsxs("span", { style: {
                                                            padding: '2px 6px',
                                                            backgroundColor: '#6b7280',
                                                            color: 'white',
                                                            borderRadius: '12px',
                                                            fontSize: '10px',
                                                            fontWeight: 500,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px',
                                                        }, title: "Has paths but not categorized", children: [_jsx("span", { style: { fontSize: '8px' }, children: "\u2753" }), " UNCATEGORIZED"] }))] })) : undefined, onReprocess: (e) => {
                                                setEventToReprocess(e);
                                                setShowTestView(true);
                                            } }, idx));
                                    })) })] })) : (_jsxs("div", { style: {
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '16px',
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '12px',
                                    }, children: [_jsx("h3", { style: {
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                                margin: 0,
                                            }, children: "Highlight Layer Configuration" }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [onApplyLayer && (readLayer || writeLayer) && (_jsxs(_Fragment, { children: [readLayer && (_jsx("button", { onClick: () => onApplyLayer(readLayer), style: {
                                                                padding: '6px 12px',
                                                                borderRadius: '4px',
                                                                border: 'none',
                                                                backgroundColor: '#3b82f6',
                                                                color: 'white',
                                                                fontSize: '12px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                fontWeight: 500,
                                                            }, children: "Apply Reads" })), writeLayer && (_jsx("button", { onClick: () => onApplyLayer(writeLayer), style: {
                                                                padding: '6px 12px',
                                                                borderRadius: '4px',
                                                                border: 'none',
                                                                backgroundColor: '#ef4444',
                                                                color: 'white',
                                                                fontSize: '12px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                fontWeight: 500,
                                                            }, children: "Apply Writes" }))] })), _jsxs("button", { onClick: () => copyToClipboard(JSON.stringify({ read: readLayer, write: writeLayer }, null, 2)), style: {
                                                        padding: '6px 12px',
                                                        borderRadius: '4px',
                                                        border: `1px solid ${theme.colors.border}`,
                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                        color: copied ? '#10b981' : theme.colors.text,
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                    }, children: [copied ? _jsx(CheckCircle, { size: 14 }) : _jsx(Copy, { size: 14 }), copied ? 'Copied!' : 'Copy JSON'] })] })] }), _jsx("div", { style: {
                                        flex: 1,
                                        overflowY: 'auto',
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        borderRadius: '4px',
                                        border: `1px solid ${theme.colors.border}`,
                                        padding: '16px',
                                    }, children: _jsx("pre", { style: {
                                            margin: 0,
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            color: theme.colors.text,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                        }, children: readLayer || writeLayer ? JSON.stringify({ read: readLayer, write: writeLayer }, null, 2) : 'No highlight layer data available' }) }), (readLayer || writeLayer) && (_jsx("div", { style: {
                                        marginTop: '12px',
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '4px',
                                        border: `1px solid ${theme.colors.border}`,
                                    }, children: _jsxs("div", { style: {
                                            fontSize: '12px',
                                            color: theme.colors.textSecondary,
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                            gap: '12px',
                                        }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontWeight: 600, color: theme.colors.text }, children: "Read Files:" }), " ", readLayer?.items.length || 0] }), _jsxs("div", { children: [_jsx("span", { style: { fontWeight: 600, color: theme.colors.text }, children: "Written Files:" }), " ", writeLayer?.items.length || 0] }), readLayer && (_jsxs("div", { children: [_jsx("span", { style: { fontWeight: 600, color: theme.colors.text }, children: "Read Color:" }), _jsx("span", { style: {
                                                            marginLeft: '6px',
                                                            padding: '2px 8px',
                                                            backgroundColor: readLayer.color + '22',
                                                            color: readLayer.color,
                                                            borderRadius: '4px',
                                                            fontFamily: 'monospace',
                                                        }, children: readLayer.color })] })), writeLayer && (_jsxs("div", { children: [_jsx("span", { style: { fontWeight: 600, color: theme.colors.text }, children: "Write Color:" }), _jsx("span", { style: {
                                                            marginLeft: '6px',
                                                            padding: '2px 8px',
                                                            backgroundColor: writeLayer.color + '22',
                                                            color: writeLayer.color,
                                                            borderRadius: '4px',
                                                            fontFamily: 'monospace',
                                                        }, children: writeLayer.color })] }))] }) }))] })) })] }), showTestView && (_jsx(EventProcessingTestView, { onClose: () => {
                    setShowTestView(false);
                    setEventToReprocess(undefined);
                }, initialEvent: eventToReprocess })), showArchiveTest && (_jsx(ArchiveTestView, { sessionId: sessionId, sessionName: sessionName, currentEvents: events, onClose: () => {
                    setShowArchiveTest(false);
                    // Always refresh status when closing archive modal
                    checkSessionStatus();
                }, onArchiveSuccess: () => {
                    // Refresh session status after successful archive
                    checkSessionStatus();
                } }))] }));
};
