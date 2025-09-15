/**
 * Session API - Clean interface for session operations
 * The main process handles all storage details internally
 */
import type { SessionState } from '../event-processing/SessionEventProcessor';
import type { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
export interface SessionSummary {
    sessionId: string;
    directory: string;
    agentCLI: string;
    startTime: number;
    lastActivity: number;
    endTime?: number;
    active: boolean;
    needsReview?: boolean;
    eventCount: number;
    fileCount?: number;
    toolUseCount?: number;
    repositoriesAccessed?: string[];
    fileAccessCount?: number;
    fileWriteCount?: number;
    customName?: string;
}
export interface DirectorySessions {
    directory: string;
    summaries: SessionSummary[];
}
export declare enum AgentSessionAPIEvents {
    GET_ACTIVE_SESSIONS = "sessions:get-active",
    GET_ARCHIVED_SESSIONS = "sessions:get-archived",
    GET_SESSIONS_FOR_DIRECTORY = "sessions:get-for-directory",
    GET_SESSION = "sessions:get-session",
    GET_SESSION_EVENTS = "sessions:get-events",
    DELETE_SESSION = "sessions:delete",
    CLEAR_DIRECTORY_SESSIONS = "sessions:clear-directory",
    UPDATE_SESSION_METADATA = "sessions:update-metadata",
    SESSION_CREATED = "sessions:created",
    SESSION_UPDATED = "sessions:updated",
    SESSION_DELETED = "sessions:deleted",
    SESSION_ARCHIVED = "sessions:archived"
}
export interface AgentSessionAPI {
    getActiveSessions: () => Promise<DirectorySessions[]>;
    getArchivedSessions: () => Promise<DirectorySessions[]>;
    getSessionsForDirectory: (directory: string) => Promise<{
        active: SessionSummary[];
        archived: SessionSummary[];
    }>;
    getSession: (sessionId: string, directory: string) => Promise<SessionState | null>;
    getSessionEvents: (sessionId: string) => Promise<NormalizedAgentSessionEvent[] | null>;
    deleteSession: (sessionId: string, directory: string) => Promise<boolean>;
    deleteFromActive: (sessionId: string) => Promise<boolean>;
    clearSessionsForDirectory: (directory: string) => Promise<boolean>;
    updateSessionMetadata: (sessionId: string, directory: string, metadata: {
        customName?: string;
    }) => Promise<boolean>;
    reprocessSession: (sessionId: string) => Promise<{
        success: boolean;
        processedCount?: number;
        error?: string;
    }>;
    getRawSessionEvents: (sessionId: string) => Promise<any[] | null>;
    onSessionCreated: (callback: (data: {
        sessionId: string;
        directory: string;
    }) => void) => () => void;
    onSessionUpdated: (callback: (data: {
        sessionId: string;
        directory: string;
    }) => void) => () => void;
    onSessionDeleted: (callback: (data: {
        sessionId: string;
        directory: string;
    }) => void) => () => void;
    onSessionArchived: (callback: (data: {
        sessionId: string;
        directory: string;
    }) => void) => () => void;
    onCliProviderEvent: (callback: (event: any) => void) => () => void;
    onProcessedEvent: (callback: (event: any) => void) => () => void;
}
//# sourceMappingURL=AgentSessionAPI.d.ts.map