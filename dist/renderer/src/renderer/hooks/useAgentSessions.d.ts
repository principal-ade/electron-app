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
export declare function useAgentSessions({ directory, autoWatch, }: UseAgentSessionsOptions): UseAgentSessionsResult;
//# sourceMappingURL=useAgentSessions.d.ts.map