/**
 * React hook for processing session events in the UI
 */
import { useCallback, useRef } from 'react';
import { sessionEventProcessor } from '../../shared/event-processing/SessionEventProcessor';
export function useSessionEventProcessor(options) {
    const { onSessionUpdate, onSideEffect } = options;
    // Cache session states to avoid re-processing
    const sessionStates = useRef(new Map());
    /**
     * Process an incoming event
     */
    const processEvent = useCallback((event, currentSession) => {
        if (!event.sessionId)
            return;
        // Get or initialize session state
        let state = sessionStates.current.get(event.sessionId);
        if (!state) {
            if (currentSession) {
                // Convert UI session to processor state
                state = {
                    sessionId: currentSession.sessionId,
                    workingDirectory: currentSession.workingDirectory,
                    firstAccess: currentSession.firstAccess || Date.now(),
                    lastActivity: currentSession.lastActivity || Date.now(),
                    eventCount: currentSession.eventCount || 0,
                    isActive: currentSession.isActive !== false,
                    fileAccessCount: currentSession.fileAccessCount || 0,
                    fileWriteCount: currentSession.fileWriteCount || 0,
                    fileAccesses: {}, // We don't keep the full map in UI
                    fileWrites: {}, // We don't keep the full map in UI
                    toolCallCount: currentSession.toolCallCount || 0,
                    webAccessCount: 0,
                    metadata: currentSession.metadata,
                    customName: currentSession.customName
                };
            }
            else {
                // Initialize new session
                state = sessionEventProcessor.initializeSession(event.sessionId, event.workingDirectory || '');
            }
            sessionStates.current.set(event.sessionId, state);
        }
        // Process the event
        const result = sessionEventProcessor.processEvent(event, state);
        // Update cached state
        const newState = sessionEventProcessor.mergeState(state, result.session);
        sessionStates.current.set(event.sessionId, newState);
        // Convert to UI updates (only the fields UI cares about)
        const uiUpdates = {
            lastActivity: newState.lastActivity,
            eventCount: newState.eventCount,
            fileAccessCount: newState.fileAccessCount,
            fileWriteCount: newState.fileWriteCount,
            toolCallCount: newState.toolCallCount,
            lastEvent: newState.lastEvent,
            metadata: newState.metadata
        };
        // Notify listeners
        if (onSessionUpdate) {
            onSessionUpdate(event.sessionId, uiUpdates);
        }
        if (onSideEffect && result.sideEffects) {
            onSideEffect(event.sessionId, result.sideEffects);
        }
    }, [onSessionUpdate, onSideEffect]);
    /**
     * Reset cached state for a session
     */
    const resetSession = useCallback((sessionId) => {
        sessionStates.current.delete(sessionId);
    }, []);
    /**
     * Clear all cached states
     */
    const clearCache = useCallback(() => {
        sessionStates.current.clear();
    }, []);
    return {
        processEvent,
        resetSession,
        clearCache
    };
}
