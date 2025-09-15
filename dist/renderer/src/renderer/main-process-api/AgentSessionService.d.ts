import { DirectorySessions } from '../../shared/main-process-api-interfaces/AgentSessionAPI';
import { SessionState } from '../../shared/event-processing/SessionEventProcessor';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
/**
 * File operation types we track
 */
export type FileOperationType = 'read' | 'write' | 'edit';
/**
 * Extracted file information from an event
 */
export interface ExtractedFilePath {
    /** Display path for UI */
    displayPath: string;
    /** Repository-relative path (preferred for git operations) */
    relativePath?: string;
    /** Absolute file path */
    absolutePath?: string;
    /** Original path from the event */
    originalPath: string;
}
/**
 * File operation with details
 */
export interface FileOperation {
    path: string;
    fullPath?: string;
    relativePath?: string;
    operations: Array<{
        type: FileOperationType;
        timestamp: number;
        tool: string;
    }>;
    lastModified: number;
}
/**
 * Todo item from agent session
 */
export interface TodoItem {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    timestamp: number;
}
/**
 * Clean Session Service for the renderer
 * Simply calls IPC methods - no knowledge of storage implementation
 */
export declare class AgentSessionService {
    /**
     * Get active sessions (fast, from live storage)
     */
    static getActiveSessions(): Promise<DirectorySessions[]>;
    /**
     * Get a session by ID
     */
    static getSession(sessionId: string, directory: string): Promise<SessionState | null>;
    /**
     * Get normalized events for a session
     * @param sessionId - The session ID to get events for
     * @returns Promise with array of normalized events or null if not found
     */
    static getSessionEvents(sessionId: string): Promise<NormalizedAgentSessionEvent[] | null>;
    /**
     * Update session metadata (e.g., custom name)
     * @param sessionId - The session ID to update
     * @param directory - The directory where the session is located
     * @param metadata - The metadata to update
     * @returns Promise indicating success
     */
    static updateSessionMetadata(sessionId: string, directory: string, metadata: {
        customName?: string;
    }): Promise<boolean>;
    /**
     * Extract file path information from a normalized event
     * Centralizes the logic for extracting paths from events
     * @param event - The normalized event to extract paths from
     * @returns Extracted file path info or undefined if no file path found
     */
    static extractFilePath(event: NormalizedAgentSessionEvent): ExtractedFilePath | undefined;
    /**
     * Get the operation type from a tool name
     * @param toolName - The name of the tool
     * @returns The operation type or undefined
     */
    static getOperationType(toolName: string): FileOperationType | undefined;
    /**
     * Extract file write operations from session events
     * @param events - Array of normalized events
     * @returns Array of file paths that were written to (using relative paths when available)
     */
    static extractWrittenFiles(events: NormalizedAgentSessionEvent[]): string[];
    /**
     * Extract file operations (read/write/edit) from session events
     * @param events - Array of normalized events
     * @returns Map of file paths to their operations
     */
    static extractFileOperations(events: NormalizedAgentSessionEvent[]): Map<string, FileOperation>;
    /**
     * Extract the last todo list from session events
     * @param events - Array of normalized events
     * @returns Last todo list or undefined if no todos found
     */
    static extractLastTodos(events: NormalizedAgentSessionEvent[]): TodoItem[] | undefined;
    /**
     * Get raw session events (unprocessed)
     * @param sessionId - The session ID to get raw events for
     * @returns Promise with array of raw events or null if not found
     */
    static getRawSessionEvents(sessionId: string): Promise<any[] | null>;
    /**
     * Delete a session from active storage
     * @param sessionId - The session ID to delete
     * @returns Promise indicating success
     */
    static deleteFromActive(sessionId: string): Promise<boolean>;
    /**
     * Reprocess a session's events
     * @param sessionId - The session ID to reprocess
     * @returns Promise with reprocessing result
     */
    static reprocessSession(sessionId: string): Promise<{
        success: boolean;
        processedCount?: number;
        error?: string;
    }>;
    /**
     * Subscribe to CLI provider events
     * @param callback - Function to call when events occur
     * @returns Unsubscribe function
     */
    static onCliProviderEvent(callback: (event: any) => void): () => void;
    /**
     * Subscribe to processed events
     * @param callback - Function to call when events occur
     * @returns Unsubscribe function
     */
    static onProcessedEvent(callback: (event: any) => void): () => void;
    /**
     * Subscribe to session updates
     * @param callback - Function to call when session is updated
     * @returns Unsubscribe function
     */
    static onSessionUpdated(callback: (data: any) => void): () => void;
}
//# sourceMappingURL=AgentSessionService.d.ts.map