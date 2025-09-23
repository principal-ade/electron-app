import { useState, useEffect, useCallback } from 'react';
import { AgentSessionSDKService } from '../main-process-api/AgentSessionSDKService';
import { AgentSessionRecord } from '../../shared/sessionTypes';

export interface UseAgentSessionsOptions {
  directory: string;
  autoWatch?: boolean;
}

export interface UseAgentSessionsResult {
  sessions: AgentSessionRecord[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setActiveSession: (sessionId: string | null) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearSessions: () => Promise<void>;
}

/**
 * Hook for managing agent sessions
 * Uses the new AgentSessionService API completely
 */
export function useAgentSessions({
  directory,
  autoWatch = true,
}: UseAgentSessionsOptions): UseAgentSessionsResult {
  const [sessions, setSessions] = useState<AgentSessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch sessions using the new API
  const fetchSessions = useCallback(async () => {
    if (!directory) return;

    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Get session summaries for this directory (mapped to repository)
      const projectSessions =
        await AgentSessionSDKService.getActiveSessionsForDirectory(directory);

      if (!projectSessions || projectSessions.summaries.length === 0) {
        setSessions([]);
        setActiveSessionId(null);
        return;
      }

      // Step 2: Fetch full session details for each summary
      const fullSessions = await Promise.all(
        projectSessions.summaries.map(async (summary) => {
          try {
            const fullSession = await AgentSessionSDKService.getSDKSession(
              summary.sessionId,
              summary.repository,
            );
            return fullSession;
          } catch (err) {
            console.warn(
              `Failed to fetch full session ${summary.sessionId}:`,
              err,
            );
            // Return a minimal session record if fetch fails
            return {
              sessionId: summary.sessionId,
              workingDirectory: directory,
              firstAccess: summary.startTime,
              lastActivity: summary.lastActivity,
              reviewedLastStop: false,
              fileAccesses: {},
              fileWrites: {},
            } as AgentSessionRecord;
          }
        }),
      );

      setSessions(fullSessions.filter(Boolean));

      // Find active session
      const activeSession = projectSessions.summaries.find((s) => s.active);
      setActiveSessionId(activeSession?.sessionId || null);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching agent sessions:', err);
      setSessions([]);
      setActiveSessionId(null);
    } finally {
      setIsLoading(false);
    }
  }, [directory]);

  // Set active session
  const setActiveSession = useCallback(async (sessionId: string | null) => {
    try {
      // Note: The new API doesn't directly expose setActiveSession
      // We'll just update local state for now
      // TODO: Implement this in the main process API if needed
      console.warn('setActiveSession is not fully implemented in the new API');
      setActiveSessionId(sessionId);

      // Update the active flag in our local sessions array
      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          active: s.sessionId === sessionId,
        })),
      );
    } catch (err) {
      console.error('Error setting active session:', err);
      throw err;
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        // Note: The new API doesn't directly expose deleteSession
        // TODO: Implement this in the main process API if needed
        console.warn('deleteSession is not fully implemented in the new API');

        // Optimistically update UI
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
        }
      } catch (err) {
        console.error('Error deleting session:', err);
        throw err;
      }
    },
    [activeSessionId],
  );

  // Clear all sessions
  const clearSessions = useCallback(async () => {
    try {
      // Note: The new API doesn't directly expose clearSessions
      // TODO: Implement this in the main process API if needed
      console.warn('clearSessions is not fully implemented in the new API');

      // Optimistically update UI
      setSessions([]);
      setActiveSessionId(null);
    } catch (err) {
      console.error('Error clearing sessions:', err);
      throw err;
    }
  }, []);

  // Setup polling for updates if autoWatch is enabled
  useEffect(() => {
    if (!directory) return;

    // Initial fetch
    fetchSessions();

    // Set up polling if autoWatch is enabled
    let intervalId: NodeJS.Timeout | null = null;
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
