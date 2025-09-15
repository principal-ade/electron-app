/**
 * Clean Session Service for the renderer
 * Simply calls IPC methods - no knowledge of storage implementation
 */
export class AgentSessionService {
    /**
     * Get active sessions (fast, from live storage)
     */
    static getActiveSessions() {
        return window.mainProcess.agentSession.getActiveSessions();
    }
    /**
     * Get a session by ID
     */
    static getSession(sessionId, directory) {
        return window.mainProcess.agentSession.getSession(sessionId, directory);
    }
    /**
     * Get normalized events for a session
     * @param sessionId - The session ID to get events for
     * @returns Promise with array of normalized events or null if not found
     */
    static async getSessionEvents(sessionId) {
        return window.mainProcess.agentSession.getSessionEvents(sessionId);
    }
    /**
     * Update session metadata (e.g., custom name)
     * @param sessionId - The session ID to update
     * @param directory - The directory where the session is located
     * @param metadata - The metadata to update
     * @returns Promise indicating success
     */
    static async updateSessionMetadata(sessionId, directory, metadata) {
        return window.mainProcess.agentSession.updateSessionMetadata(sessionId, directory, metadata);
    }
    /**
     * Extract file path information from a normalized event
     * Centralizes the logic for extracting paths from events
     * @param event - The normalized event to extract paths from
     * @returns Extracted file path info or undefined if no file path found
     */
    static extractFilePath(event) {
        // Use new files array structure
        if (event.files && event.files.length > 0) {
            const file = event.files[0];
            return {
                displayPath: file.displayPath || '[path not normalized]',
                relativePath: file.displayPath, // Use displayPath as it's repository-relative
                absolutePath: undefined, // Never expose absolute paths
                originalPath: file.displayPath || '' // Use displayPath instead of originalPath
            };
        }
        // No normalized paths available - return undefined
        // This will help us identify events that haven't been properly normalized
        return undefined;
    }
    /**
     * Get the operation type from a tool name
     * @param toolName - The name of the tool
     * @returns The operation type or undefined
     */
    static getOperationType(toolName) {
        switch (toolName) {
            case 'Read':
                return 'read';
            case 'Write':
                return 'write';
            case 'Edit':
            case 'MultiEdit':
                return 'edit';
            default:
                return undefined;
        }
    }
    /**
     * Extract file write operations from session events
     * @param events - Array of normalized events
     * @returns Array of file paths that were written to (using relative paths when available)
     */
    static extractWrittenFiles(events) {
        const writtenFiles = new Set();
        for (const event of events) {
            // Only track write/edit operations
            const opType = event.toolName ? this.getOperationType(event.toolName) : undefined;
            if (opType === 'write' || opType === 'edit') {
                const filePath = this.extractFilePath(event);
                if (filePath) {
                    // Prefer repository-relative path for git operations, fallback to display path
                    writtenFiles.add(filePath.relativePath || filePath.displayPath);
                }
            }
        }
        return Array.from(writtenFiles);
    }
    /**
     * Extract file operations (read/write/edit) from session events
     * @param events - Array of normalized events
     * @returns Map of file paths to their operations
     */
    static extractFileOperations(events) {
        const fileOps = new Map();
        const TRACKED_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit']);
        for (const event of events) {
            if (event.toolName && TRACKED_TOOLS.has(event.toolName)) {
                const filePath = this.extractFilePath(event);
                if (filePath) {
                    const key = filePath.displayPath;
                    let fileOp = fileOps.get(key);
                    if (!fileOp) {
                        fileOp = {
                            path: filePath.displayPath,
                            fullPath: filePath.absolutePath,
                            relativePath: filePath.relativePath,
                            operations: [],
                            lastModified: event.timestamp
                        };
                        fileOps.set(key, fileOp);
                    }
                    const opType = this.getOperationType(event.toolName);
                    if (opType) {
                        fileOp.operations.push({
                            type: opType,
                            timestamp: event.timestamp,
                            tool: event.toolName
                        });
                        fileOp.lastModified = event.timestamp;
                    }
                }
            }
        }
        return fileOps;
    }
    /**
     * Extract the last todo list from session events
     * @param events - Array of normalized events
     * @returns Last todo list or undefined if no todos found
     */
    static extractLastTodos(events) {
        // Find the last TodoWrite event (post-tool-use)
        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            if (event.toolName === 'TodoWrite' && event.eventType === 'post-tool-use') {
                const todoData = event.toolInput;
                if (todoData?.todos && Array.isArray(todoData.todos)) {
                    return todoData.todos.map((todo) => ({
                        id: todo.id || Math.random().toString(36).substr(2, 9),
                        content: todo.content || todo.task || '',
                        status: todo.status || 'pending',
                        timestamp: event.timestamp
                    }));
                }
            }
        }
        return undefined;
    }
    /**
     * Get raw session events (unprocessed)
     * @param sessionId - The session ID to get raw events for
     * @returns Promise with array of raw events or null if not found
     */
    static getRawSessionEvents(sessionId) {
        return window.mainProcess.agentSession.getRawSessionEvents(sessionId);
    }
    /**
     * Delete a session from active storage
     * @param sessionId - The session ID to delete
     * @returns Promise indicating success
     */
    static deleteFromActive(sessionId) {
        return window.mainProcess.agentSession.deleteFromActive(sessionId);
    }
    /**
     * Reprocess a session's events
     * @param sessionId - The session ID to reprocess
     * @returns Promise with reprocessing result
     */
    static reprocessSession(sessionId) {
        return window.mainProcess.agentSession.reprocessSession(sessionId);
    }
    /**
     * Subscribe to CLI provider events
     * @param callback - Function to call when events occur
     * @returns Unsubscribe function
     */
    static onCliProviderEvent(callback) {
        return window.mainProcess.agentSession.onCliProviderEvent(callback);
    }
    /**
     * Subscribe to processed events
     * @param callback - Function to call when events occur
     * @returns Unsubscribe function
     */
    static onProcessedEvent(callback) {
        return window.mainProcess.agentSession.onProcessedEvent(callback);
    }
    /**
     * Subscribe to session updates
     * @param callback - Function to call when session is updated
     * @returns Unsubscribe function
     */
    static onSessionUpdated(callback) {
        return window.mainProcess.agentSession.onSessionUpdated(callback);
    }
}
