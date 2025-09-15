import { useState, useEffect, useCallback } from 'react';
import { AgentSessionService } from '../main-process-api/AgentSessionService';
/**
 * Hook for managing agent sessions
 * Uses the new AgentSessionService API completely
 */
export function useAgentSessions({ directory, autoWatch = true, }) {
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // Fetch sessions using the new API
    const fetchSessions = useCallback(async () => {
        if (!directory)
            return;
        try {
            setIsLoading(true);
            setError(null);
            // Step 1: Get session summaries for this directory
            const allDirectorySessions = await AgentSessionService.getActiveSessions();
            const directorySessions = allDirectorySessions.find(ds => ds.directory === directory);
            if (!directorySessions || directorySessions.summaries.length === 0) {
                setSessions([]);
                setActiveSessionId(null);
                return;
            }
            // Step 2: Fetch full session details for each summary
            const fullSessions = await Promise.all(directorySessions.summaries.map(async (summary) => {
                try {
                    const fullSession = await AgentSessionService.getSession(summary.sessionId, directory);
                    return fullSession;
                }
                catch (err) {
                    console.warn(`Failed to fetch full session ${summary.sessionId}:`, err);
                    // Return a minimal session record if fetch fails
                    return {
                        sessionId: summary.sessionId,
                        workingDirectory: directory,
                        firstAccess: summary.startTime,
                        lastActivity: summary.lastActivity,
                        reviewedLastStop: false,
                        fileAccesses: {},
                        fileWrites: {},
                    };
                }
            }));
            setSessions(fullSessions.filter(Boolean));
            // Find active session
            const activeSession = directorySessions.summaries.find(s => s.active);
            setActiveSessionId(activeSession?.sessionId || null);
        }
        catch (err) {
            setError(err);
            console.error('Error fetching agent sessions:', err);
            setSessions([]);
            setActiveSessionId(null);
        }
        finally {
            setIsLoading(false);
        }
    }, [directory]);
    // Set active session
    const setActiveSession = useCallback(async (sessionId) => {
        try {
            // Note: The new API doesn't directly expose setActiveSession
            // We'll just update local state for now
            // TODO: Implement this in the main process API if needed
            console.warn('setActiveSession is not fully implemented in the new API');
            setActiveSessionId(sessionId);
            // Update the active flag in our local sessions array
            setSessions(prev => prev.map(s => ({
                ...s,
                active: s.sessionId === sessionId
            })));
        }
        catch (err) {
            console.error('Error setting active session:', err);
            throw err;
        }
    }, []);
    // Delete session
    const deleteSession = useCallback(async (sessionId) => {
        try {
            // Note: The new API doesn't directly expose deleteSession
            // TODO: Implement this in the main process API if needed
            console.warn('deleteSession is not fully implemented in the new API');
            // Optimistically update UI
            setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
            if (activeSessionId === sessionId) {
                setActiveSessionId(null);
            }
        }
        catch (err) {
            console.error('Error deleting session:', err);
            throw err;
        }
    }, [activeSessionId]);
    // Clear all sessions
    const clearSessions = useCallback(async () => {
        try {
            // Note: The new API doesn't directly expose clearSessions
            // TODO: Implement this in the main process API if needed
            console.warn('clearSessions is not fully implemented in the new API');
            // Optimistically update UI
            setSessions([]);
            setActiveSessionId(null);
        }
        catch (err) {
            console.error('Error clearing sessions:', err);
            throw err;
        }
    }, []);
    // Setup polling for updates if autoWatch is enabled
    useEffect(() => {
        if (!directory)
            return;
        // Initial fetch
        fetchSessions();
        // Set up polling if autoWatch is enabled
        let intervalId = null;
        if (autoWatch) {
            // Poll every 5 seconds for updates
            intervalId = setInterval(() => {
                fetchSessions();
            }, 5000);
        }
        // TODO: Once the new API has event listeners, use those instead of polling
        // The API interface shows onSessionUpdated, onSessionDeleted, onSessionArchived
        // but they may not be fully implemented yet
        // Cleanup
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [directory, autoWatch, fetchSessions]);
    return {
        sessions,
        activeSessionId,
        isLoading,
        error,
        refetch: fetchSessions,
        setActiveSession,
        deleteSession,
        clearSessions,
    };
}
