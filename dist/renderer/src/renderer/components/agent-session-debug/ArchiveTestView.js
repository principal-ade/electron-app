import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Archive, Check, AlertCircle, Loader, FileJson, Database } from 'lucide-react';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';
export const ArchiveTestView = ({ sessionId, sessionName, currentEvents, onClose, onArchiveSuccess }) => {
    const { theme } = useTheme();
    const [isArchiving, setIsArchiving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [archiveStatus, setArchiveStatus] = useState('pending');
    const [archivedData, setArchivedData] = useState(null);
    const [comparisonResult, setComparisonResult] = useState(null);
    const [error, setError] = useState(null);
    // Check if session is already archived on mount
    useEffect(() => {
        checkArchiveStatus();
    }, [sessionId]);
    const checkArchiveStatus = async () => {
        try {
            // Try to load the archived session - if it exists, it's archived
            const archived = await AgentSessionArchiveService.loadSession(sessionId);
            if (archived) {
                setArchiveStatus('success');
                setArchivedData(archived);
            }
        }
        catch (err) {
            // Session not archived or error loading - that's ok
            console.log('Session not archived yet or error checking:', err);
        }
    };
    const archiveSession = async () => {
        setIsArchiving(true);
        setError(null);
        try {
            // Archive the session for TESTING - skip cleanup to avoid deleting active data
            const result = await AgentSessionArchiveService.archiveSession(sessionId);
            if (result.success) {
                setArchiveStatus('success');
                console.log('Session archived successfully (test mode - no cleanup performed)');
                // Notify parent that archive was successful
                if (onArchiveSuccess) {
                    onArchiveSuccess();
                }
                // Automatically load and compare
                await loadAndCompare();
            }
            else {
                throw new Error('Archive operation failed');
            }
        }
        catch (err) {
            console.error('Archive error:', err);
            setError(err.message || 'Failed to archive session');
            setArchiveStatus('error');
        }
        finally {
            setIsArchiving(false);
        }
    };
    const loadAndCompare = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Load the archived session data (raw events are always included)
            const archived = await AgentSessionArchiveService.loadSession(sessionId);
            if (!archived) {
                throw new Error('Failed to load archived session');
            }
            setArchivedData(archived);
            // Compare with current data
            const comparison = compareSessionData(currentEvents, archived);
            setComparisonResult(comparison);
        }
        catch (err) {
            console.error('Load/compare error:', err);
            setError(err.message || 'Failed to load or compare archived data');
        }
        finally {
            setIsLoading(false);
        }
    };
    const compareSessionData = (original, archived) => {
        const differences = [];
        // Extract events from archived data
        // The archived data structure should have events in the session object
        const archivedSession = archived.session || archived;
        const archivedEvents = archivedSession.events || [];
        const rawEvents = archived.rawEvents;
        console.log('Comparing data:', {
            originalCount: original.length,
            archivedCount: archivedEvents.length,
            hasRawEvents: !!rawEvents,
            rawEventCount: rawEvents?.length || 0,
            archivedStructure: Object.keys(archived)
        });
        // Compare event counts
        if (original.length !== archivedEvents.length) {
            differences.push(`Event count mismatch: ${original.length} vs ${archivedEvents.length}`);
        }
        // Check raw events
        if (!rawEvents || rawEvents.length === 0) {
            differences.push('Warning: No raw events found in archive');
        }
        // Compare individual events
        const minLength = Math.min(original.length, archivedEvents.length);
        for (let i = 0; i < minLength; i++) {
            const origEvent = original[i];
            const archEvent = archivedEvents[i];
            // Check key fields
            if (origEvent.sessionId !== archEvent.sessionId) {
                differences.push(`Event ${i}: sessionId mismatch`);
            }
            if (origEvent.eventType !== archEvent.eventType) {
                differences.push(`Event ${i}: eventType mismatch (${origEvent.eventType} vs ${archEvent.eventType})`);
            }
            if (origEvent.toolName !== archEvent.toolName) {
                differences.push(`Event ${i}: toolName mismatch`);
            }
            // Check paths
            const origPath = origEvent.paths?.primary?.displayPath;
            const archPath = archEvent.paths?.primary?.displayPath;
            if (origPath !== archPath) {
                differences.push(`Event ${i}: primary path mismatch`);
            }
        }
        // Calculate sizes (approximate)
        const originalSize = JSON.stringify(original).length;
        const archivedSize = JSON.stringify(archived).length;
        return {
            isIdentical: differences.length === 0,
            differences: differences.slice(0, 10), // Limit to first 10 differences
            originalEventCount: original.length,
            archivedEventCount: archivedEvents.length,
            originalSize,
            archivedSize,
            hasRawEvents: !!rawEvents && rawEvents.length > 0,
            rawEventCount: rawEvents?.length || 0
        };
    };
    const formatBytes = (bytes) => {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
        }, children: _jsxs("div", { style: {
                width: '90%',
                maxWidth: '800px',
                maxHeight: '80%',
                backgroundColor: theme.colors.background,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }, children: [_jsxs("div", { style: {
                        padding: '16px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: theme.colors.backgroundSecondary,
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(Archive, { size: 20, color: "#8b5cf6" }), _jsx("h2", { style: {
                                        fontSize: '18px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        margin: 0,
                                    }, children: "Archive Test" }), _jsx("span", { style: {
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                        fontFamily: 'monospace',
                                    }, children: sessionName || sessionId.substring(0, 12) })] }), onClose && (_jsx("button", { onClick: onClose, style: {
                                padding: '6px 12px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                color: theme.colors.text,
                                cursor: 'pointer',
                                fontSize: '13px',
                            }, children: "Close" }))] }), _jsxs("div", { style: {
                        flex: 1,
                        padding: '20px',
                        overflowY: 'auto',
                    }, children: [_jsxs("div", { style: {
                                marginBottom: '24px',
                                padding: '16px',
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '6px',
                                border: `1px solid ${theme.colors.border}`,
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '12px',
                                    }, children: [_jsx(Database, { size: 18, color: theme.colors.text }), _jsx("span", { style: {
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                            }, children: "Session Status" })] }), _jsxs("div", { style: {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '12px',
                                        fontSize: '12px',
                                    }, children: [_jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Current Events: " }), _jsx("span", { style: { color: theme.colors.text, fontWeight: 600 }, children: currentEvents.length })] }), _jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Archive Status: " }), _jsx("span", { style: {
                                                        color: archiveStatus === 'success' ? '#10b981' :
                                                            archiveStatus === 'error' ? '#ef4444' :
                                                                theme.colors.textSecondary,
                                                        fontWeight: 600
                                                    }, children: archiveStatus === 'success' ? 'Archived' :
                                                        archiveStatus === 'error' ? 'Failed' :
                                                            'Not Archived' })] })] })] }), (archiveStatus === 'pending' ||
                            archiveStatus === 'error' ||
                            (archiveStatus === 'success' && comparisonResult && !comparisonResult.isIdentical)) && (_jsxs("div", { style: {
                                textAlign: 'center',
                                marginBottom: '24px',
                            }, children: [_jsx("button", { onClick: archiveSession, disabled: isArchiving, style: {
                                        padding: '10px 24px',
                                        backgroundColor: archiveStatus === 'pending' ? '#8b5cf6' : '#ef4444',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: isArchiving ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: isArchiving ? 0.6 : 1,
                                    }, children: isArchiving ? (_jsxs(_Fragment, { children: [_jsx(Loader, { size: 16, className: "animate-spin" }), "Archiving..."] })) : (_jsxs(_Fragment, { children: [_jsx(Archive, { size: 16 }), archiveStatus === 'pending' ? 'Archive Session' : 'Re-archive Session'] })) }), _jsx("div", { style: {
                                        marginTop: '8px',
                                        fontSize: '11px',
                                        color: theme.colors.textSecondary,
                                    }, children: archiveStatus === 'pending'
                                        ? 'This will create a test archive without deleting active data'
                                        : 'This will replace the existing archive with fresh data' })] })), archiveStatus === 'success' && !comparisonResult && !isLoading && (_jsxs("div", { style: {
                                textAlign: 'center',
                                marginBottom: '24px',
                            }, children: [_jsxs("button", { onClick: loadAndCompare, disabled: isLoading, style: {
                                        padding: '10px 24px',
                                        backgroundColor: '#3b82f6',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }, children: [_jsx(FileJson, { size: 16 }), "Load & Compare Archive"] }), _jsx("div", { style: {
                                        marginTop: '8px',
                                        fontSize: '11px',
                                        color: theme.colors.textSecondary,
                                    }, children: "Load the archived data and compare with current session" })] })), comparisonResult && (_jsxs("div", { style: {
                                marginBottom: '24px',
                                padding: '16px',
                                backgroundColor: comparisonResult.isIdentical ?
                                    'rgba(16, 185, 129, 0.1)' :
                                    'rgba(239, 68, 68, 0.1)',
                                borderRadius: '6px',
                                border: `1px solid ${comparisonResult.isIdentical ? '#10b981' : '#ef4444'}`,
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '12px',
                                    }, children: [comparisonResult.isIdentical ? (_jsx(Check, { size: 18, color: "#10b981" })) : (_jsx(AlertCircle, { size: 18, color: "#ef4444" })), _jsx("span", { style: {
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: comparisonResult.isIdentical ? '#10b981' : '#ef4444',
                                            }, children: comparisonResult.isIdentical ? 'Data Integrity Verified' : 'Data Mismatch Detected' })] }), _jsxs("div", { style: {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '12px',
                                        fontSize: '12px',
                                        marginBottom: '12px',
                                    }, children: [_jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Normalized Events: " }), _jsx("span", { style: { fontWeight: 600 }, children: comparisonResult.originalEventCount })] }), _jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Archived Events: " }), _jsx("span", { style: { fontWeight: 600 }, children: comparisonResult.archivedEventCount })] }), _jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Raw Events: " }), _jsx("span", { style: {
                                                        fontWeight: 600,
                                                        color: comparisonResult.hasRawEvents ? theme.colors.text : '#ef4444'
                                                    }, children: comparisonResult.hasRawEvents ? comparisonResult.rawEventCount : 'Missing' })] }), _jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Raw Events Status: " }), _jsx("span", { style: {
                                                        fontWeight: 600,
                                                        color: comparisonResult.hasRawEvents ? '#10b981' : '#ef4444'
                                                    }, children: comparisonResult.hasRawEvents ? '✓ Included' : '✗ Not Found' })] }), comparisonResult.originalSize && (_jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Original Size: " }), _jsx("span", { style: { fontWeight: 600 }, children: formatBytes(comparisonResult.originalSize) })] })), comparisonResult.archivedSize && (_jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Archived Size: " }), _jsx("span", { style: { fontWeight: 600 }, children: formatBytes(comparisonResult.archivedSize) })] }))] }), comparisonResult.differences.length > 0 && (_jsxs("div", { style: {
                                        marginTop: '12px',
                                        padding: '8px',
                                        backgroundColor: theme.colors.background,
                                        borderRadius: '4px',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                    }, children: [_jsx("div", { style: {
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                                marginBottom: '6px',
                                            }, children: "Differences Found:" }), comparisonResult.differences.map((diff, idx) => (_jsxs("div", { style: {
                                                fontSize: '10px',
                                                color: theme.colors.textSecondary,
                                                fontFamily: 'monospace',
                                                padding: '2px 0',
                                            }, children: ["\u2022 ", diff] }, idx)))] }))] })), archiveStatus === 'success' && !comparisonResult && (_jsx("div", { style: {
                                textAlign: 'center',
                            }, children: _jsx("button", { onClick: loadAndCompare, disabled: isLoading, style: {
                                    padding: '8px 20px',
                                    backgroundColor: theme.colors.backgroundTertiary,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '4px',
                                    color: theme.colors.text,
                                    fontSize: '13px',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx(Loader, { size: 14, className: "animate-spin" }), "Loading Archive..."] })) : (_jsxs(_Fragment, { children: [_jsx(FileJson, { size: 14 }), "Load & Compare"] })) }) })), error && (_jsxs("div", { style: {
                                marginTop: '16px',
                                padding: '12px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid #ef4444',
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: '#ef4444',
                            }, children: [_jsx(AlertCircle, { size: 14, style: { display: 'inline', marginRight: '6px' } }), error] })), comparisonResult?.isIdentical && (_jsxs("div", { style: {
                                marginTop: '16px',
                                padding: '16px',
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '6px',
                                textAlign: 'center',
                            }, children: [_jsx(Check, { size: 32, color: "#10b981", style: { marginBottom: '8px' } }), _jsx("div", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '4px',
                                    }, children: "Archive Verified Successfully" }), _jsxs("div", { style: {
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                    }, children: ["The archived data matches the original session data perfectly.", comparisonResult.hasRawEvents
                                            ? ` ${comparisonResult.rawEventCount} raw events are included in the archive.`
                                            : ' Warning: Raw events were not archived.', comparisonResult.isIdentical && comparisonResult.hasRawEvents &&
                                            ' It\'s safe to enable automatic cleanup.'] })] }))] })] }) }));
};
