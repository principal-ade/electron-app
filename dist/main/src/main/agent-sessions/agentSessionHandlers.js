import { ipcMain, BrowserWindow } from 'electron';
import { AgentSessionAPIEvents } from '../../shared/main-process-api-interfaces/AgentSessionAPI';
import { getTypedStorageManagerInstance } from '../stores/initialization';
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import { StaticNamespaces } from '../storage-providers/types';
import { AgentEventNamespaces } from '../../shared/types/namespaces.types';
/**
 * Main process session handlers
 * Handles all storage details internally - UI doesn't need to know about namespaces
 */
// Internal namespace constants (not exposed to UI)
/**
 * Helper function to clean up raw events for a session
 */
async function cleanupSessionRawEvents(sessionId, provider, storageManager) {
    let totalDeleted = 0;
    try {
        // Find the appropriate raw events namespace
        const namespaces = await storageManager.getNamespaces();
        const rawNamespaces = [];
        for (const [namespaceName, config] of namespaces) {
            if (config.category === 'agent-session-events' &&
                namespaceName.includes(provider) &&
                !namespaceName.includes('processed')) {
                rawNamespaces.push(namespaceName);
            }
        }
        if (rawNamespaces.length === 0) {
            console.warn(`[SessionHandlers] No raw events namespace found for cleanup (provider: ${provider})`);
            return;
        }
        // Delete from all matching namespaces
        for (const rawNamespace of rawNamespaces) {
            const keysResult = await storageManager.keys(rawNamespace);
            if (!keysResult.success || !keysResult.data) {
                continue;
            }
            let namespaceDeleted = 0;
            for (const key of keysResult.data) {
                // Check if key contains sessionId
                if (key.includes(sessionId)) {
                    await storageManager.delete(key, rawNamespace);
                    namespaceDeleted++;
                }
                else {
                    // Also check the event content to be thorough
                    const eventResult = await storageManager.get(rawNamespace, key);
                    if (eventResult.success && eventResult.data) {
                        if (eventResult.data.sessionId === sessionId ||
                            eventResult.data.metadata?.sessionId === sessionId) {
                            await storageManager.delete(key, rawNamespace);
                            namespaceDeleted++;
                        }
                    }
                }
            }
            if (namespaceDeleted > 0) {
                totalDeleted += namespaceDeleted;
            }
        }
        if (totalDeleted > 0) {
            console.log(`[SessionHandlers] Total cleaned up: ${totalDeleted} raw events for session ${sessionId}`);
        }
    }
    catch (error) {
        console.error(`[SessionHandlers] Failed to cleanup raw events for session ${sessionId}:`, error);
    }
}
/**
 * Create a summary from a full session object
 */
function createSummaryFromSession(sessionId, session) {
    // Get the working directory - try various locations where it might be stored
    let directory = session.workingDirectory || '';
    // If no workingDirectory at root, try to get it from the first event in segments
    if (!directory && session.segments && session.segments.length > 0) {
        for (const segment of session.segments) {
            if (segment.events && segment.events.length > 0) {
                const firstEvent = segment.events[0];
                if (firstEvent.workingDirectory) {
                    directory = firstEvent.workingDirectory;
                    break;
                }
            }
        }
    }
    // If still no directory, try activeSegment events
    if (!directory && session.activeSegment && session.activeSegment.events && session.activeSegment.events.length > 0) {
        const firstEvent = session.activeSegment.events[0];
        if (firstEvent.workingDirectory) {
            directory = firstEvent.workingDirectory;
        }
    }
    // Log if we still don't have a directory
    if (!directory) {
        console.warn(`[SessionHandlers] No working directory found for session ${sessionId}`);
    }
    return {
        sessionId,
        directory,
        agentCLI: session.agentCLI || 'unknown',
        startTime: session.startTime || session.firstEventTime || Date.now(),
        lastActivity: session.lastUpdateTime || session.lastEventTime || Date.now(),
        endTime: session.endTime,
        active: !session.endTime,
        needsReview: session.needsReview,
        eventCount: session.totalEvents || session.events?.length || 0,
        fileCount: session.fileWrites?.length || 0,
        toolUseCount: session.toolUses?.length || 0,
        repositoriesAccessed: session.repositoriesAccessed || [],
        // Add the counts that the UI expects
        fileAccessCount: Object.keys(session.fileAccesses || {}).length,
        fileWriteCount: Object.keys(session.fileWrites || {}).length,
        customName: session.metadata?.customName
    }; // Cast to any since SessionSummary interface needs updating
}
/**
 * Get active sessions from the live store
 */
async function getActiveSessionsInternal() {
    try {
        const storageManager = await getTypedStorageManagerInstance();
        // Get all processed events
        const processedResult = await storageManager.keys(StaticNamespaces.AGENT_SESSIONS);
        // If no processed events, return empty array
        if (!processedResult) {
            console.log('[SessionHandlers] No processed events found');
            return [];
        }
        console.log(`[SessionHandlers] Found ${processedResult.length} sessions`);
        const directorySessions = new Map();
        const sessionsWithoutDirectory = [];
        for (const sessionId of processedResult) {
            const sessionResult = await storageManager.get(sessionId, StaticNamespaces.AGENT_SESSIONS);
            if (sessionResult.success && sessionResult.data) {
                const summary = createSummaryFromSession(sessionId, sessionResult.data);
                // If we have a directory, group by it
                if (summary.directory) {
                    if (!directorySessions.has(summary.directory)) {
                        directorySessions.set(summary.directory, []);
                    }
                    directorySessions.get(summary.directory).push(summary);
                }
                else {
                    // Track sessions without directories for debugging
                    sessionsWithoutDirectory.push(summary);
                }
            }
        }
        if (sessionsWithoutDirectory.length > 0) {
            console.warn(`[SessionHandlers] ${sessionsWithoutDirectory.length} sessions have no directory`);
            // Group them under "Unknown" so they're not lost
            if (sessionsWithoutDirectory.length > 0) {
                directorySessions.set('Unknown', sessionsWithoutDirectory);
            }
        }
        console.log(`[SessionHandlers] Grouped into ${directorySessions.size} directories`);
        return Array.from(directorySessions.entries()).map(([directory, summaries]) => ({
            directory,
            summaries: summaries.sort((a, b) => b.lastActivity - a.lastActivity)
        }));
    }
    catch (error) {
        console.error('[SessionHandlers] Failed to get active sessions:', error);
        return [];
    }
}
/**
 * Get archived sessions from file storage
 */
async function getArchivedSessionsInternal() {
    try {
        // Archives are stored in the file system
        const archiveDir = path.join(app.getPath('userData'), 'archived-sessions');
        try {
            const entries = await fs.readdir(archiveDir);
            const directorySessions = new Map();
            for (const entry of entries) {
                const entryPath = path.join(archiveDir, entry);
                const stats = await fs.stat(entryPath);
                if (stats.isDirectory()) {
                    // New format: directory-based archives
                    const summaryPath = path.join(entryPath, 'summary.json');
                    try {
                        const summaryData = await fs.readFile(summaryPath, 'utf-8');
                        const summary = JSON.parse(summaryData);
                        summary.active = false; // Mark as archived
                        if (summary.directory) {
                            if (!directorySessions.has(summary.directory)) {
                                directorySessions.set(summary.directory, []);
                            }
                            directorySessions.get(summary.directory).push(summary);
                        }
                    }
                    catch (err) {
                        // Skip if summary doesn't exist or is invalid
                    }
                }
                else if (entry.endsWith('.json')) {
                    // Legacy format: single JSON files
                    try {
                        const archiveData = await fs.readFile(entryPath, 'utf-8');
                        const archive = JSON.parse(archiveData);
                        if (archive.summary) {
                            const summary = archive.summary;
                            summary.active = false;
                            if (summary.directory) {
                                if (!directorySessions.has(summary.directory)) {
                                    directorySessions.set(summary.directory, []);
                                }
                                directorySessions.get(summary.directory).push(summary);
                            }
                        }
                    }
                    catch (err) {
                        // Skip invalid files
                    }
                }
            }
            return Array.from(directorySessions.entries()).map(([directory, summaries]) => ({
                directory,
                summaries: summaries.sort((a, b) => b.lastActivity - a.lastActivity)
            }));
        }
        catch (error) {
            // Archive directory doesn't exist or can't be read
            return [];
        }
    }
    catch (error) {
        console.error('[SessionHandlers] Failed to get archived sessions:', error);
        return [];
    }
}
/**
 * Setup IPC handlers for session operations
 */
export function setupSessionHandlers() {
    // Get active sessions
    ipcMain.handle(AgentSessionAPIEvents.GET_ACTIVE_SESSIONS, async () => {
        return getActiveSessionsInternal();
    });
    // Get archived sessions
    ipcMain.handle(AgentSessionAPIEvents.GET_ARCHIVED_SESSIONS, async () => {
        return getArchivedSessionsInternal();
    });
    // Get sessions for directory
    ipcMain.handle(AgentSessionAPIEvents.GET_SESSIONS_FOR_DIRECTORY, async (_, directory) => {
        const [active, archived] = await Promise.all([
            getActiveSessionsInternal(),
            getArchivedSessionsInternal()
        ]);
        const activeForDir = active.find(ds => ds.directory === directory);
        const archivedForDir = archived.find(ds => ds.directory === directory);
        return {
            active: activeForDir?.summaries || [],
            archived: archivedForDir?.summaries || []
        };
    });
    // Get specific session
    ipcMain.handle(AgentSessionAPIEvents.GET_SESSION, async (_, sessionId, directory) => {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            // Try active sessions first - they're in AGENT_SESSIONS namespace
            const sessionResult = await storageManager.get(sessionId, StaticNamespaces.AGENT_SESSIONS);
            console.log(`[SessionHandlers] Getting session ${sessionId}:`, sessionResult.success ? 'found' : 'not found');
            if (sessionResult.success && sessionResult.data) {
                return sessionResult.data;
            }
            // Try archived sessions (file-based)
            // Archive directories are named as sessionId_timestamp, so we need to search
            const archiveBaseDir = path.join(app.getPath('userData'), 'archived-sessions');
            try {
                const dirs = await fs.readdir(archiveBaseDir);
                const sessionDir = dirs.find(d => d.startsWith(`${sessionId}_`));
                if (sessionDir) {
                    const sessionPath = path.join(archiveBaseDir, sessionDir, 'session.json');
                    const sessionData = await fs.readFile(sessionPath, 'utf-8');
                    return JSON.parse(sessionData);
                }
            }
            catch (err) {
                // Not in archives or error reading
            }
            return null;
        }
        catch (error) {
            console.error(`[SessionHandlers] Failed to get session ${sessionId}:`, error);
            return null;
        }
    });
    // Get normalized events for a session
    ipcMain.handle(AgentSessionAPIEvents.GET_SESSION_EVENTS, async (_, sessionId) => {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            // Get the session from AGENT_SESSIONS namespace
            const sessionResult = await storageManager.get(sessionId, StaticNamespaces.AGENT_SESSIONS);
            if (sessionResult.success && sessionResult.data) {
                // The session data has 'events' array with normalized events
                const events = sessionResult.data.events || null;
                // VALIDATION: Check if any events have improperly normalized paths
                if (events && Array.isArray(events)) {
                    for (const event of events) {
                        if (event.files && Array.isArray(event.files)) {
                            for (const file of event.files) {
                                // Check if file is supposedly in a repository but displayPath is absolute
                                if (file.repository && file.displayPath && file.displayPath.startsWith('/')) {
                                    console.error(`[SessionHandlers] WARNING: Found event with absolute displayPath in repository!`, {
                                        sessionId,
                                        eventType: event.eventType,
                                        toolName: event.toolName,
                                        displayPath: file.displayPath,
                                        absolutePath: file.absolutePath,
                                        repository: file.repository,
                                        originalPath: file.originalPath
                                    });
                                    // Don't throw here, just warn - this helps diagnose existing bad data
                                }
                            }
                        }
                    }
                }
                return events;
            }
            // Try archived sessions (file-based)
            // Archive directories are named as sessionId_timestamp, so we need to search
            const archiveBaseDir = path.join(app.getPath('userData'), 'archived-sessions');
            try {
                const dirs = await fs.readdir(archiveBaseDir);
                const sessionDir = dirs.find(d => d.startsWith(`${sessionId}_`));
                if (sessionDir) {
                    const sessionPath = path.join(archiveBaseDir, sessionDir, 'session.json');
                    const sessionData = await fs.readFile(sessionPath, 'utf-8');
                    const session = JSON.parse(sessionData);
                    return session.events || null;
                }
            }
            catch (err) {
                // Not in archives or error reading
            }
            return null;
        }
        catch (error) {
            console.error(`[SessionHandlers] Failed to get events for session ${sessionId}:`, error);
            return null;
        }
    });
    // Delete from active storage only (preserve archive)
    ipcMain.handle('sessions:delete-from-active', async (_, sessionId) => {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            // First get the session to find the provider for raw event cleanup
            const sessionResult = await storageManager.get(sessionId, StaticNamespaces.AGENT_SESSIONS);
            const sessionData = sessionResult.success ? sessionResult.data : null;
            const provider = sessionData?.provider || sessionData?.agentCLI;
            // Delete from active storage
            await storageManager.delete(sessionId, StaticNamespaces.AGENT_SESSIONS);
            console.log(`[SessionHandlers] Deleted session ${sessionId} from AGENT_SESSIONS`);
            // Also clean up raw events if we know the provider
            if (provider) {
                await cleanupSessionRawEvents(sessionId, provider, storageManager);
                console.log(`[SessionHandlers] Cleaned up raw events for session ${sessionId}`);
            }
            else {
                console.warn(`[SessionHandlers] Could not determine provider for session ${sessionId}, raw events not cleaned`);
            }
            return true;
        }
        catch (error) {
            console.error(`[SessionHandlers] Failed to delete session ${sessionId} from active storage:`, error);
            return false;
        }
    });
    // Delete session completely (including archives)
    ipcMain.handle(AgentSessionAPIEvents.DELETE_SESSION, async (_, sessionId, directory) => {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            // Delete from active storage
            await storageManager.delete(sessionId, StaticNamespaces.AGENT_SESSIONS);
            // Delete from archives (find directory that starts with sessionId_)
            const archiveBaseDir = path.join(app.getPath('userData'), 'archived-sessions');
            try {
                const dirs = await fs.readdir(archiveBaseDir);
                const sessionDir = dirs.find(d => d.startsWith(`${sessionId}_`));
                if (sessionDir) {
                    await fs.rm(path.join(archiveBaseDir, sessionDir), { recursive: true, force: true });
                }
            }
            catch (err) {
                // Archive might not exist or error reading
            }
            // Notify all windows
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send(AgentSessionAPIEvents.SESSION_DELETED, { sessionId, directory });
            });
            return true;
        }
        catch (error) {
            console.error(`[SessionHandlers] Failed to delete session ${sessionId}:`, error);
            return false;
        }
    });
    // Clear directory sessions
    ipcMain.handle(AgentSessionAPIEvents.CLEAR_DIRECTORY_SESSIONS, async (_, directory) => {
        try {
            const [active, archived] = await Promise.all([
                getActiveSessionsInternal(),
                getArchivedSessionsInternal()
            ]);
            const activeForDir = active.find(ds => ds.directory === directory);
            const archivedForDir = archived.find(ds => ds.directory === directory);
            const allSessions = [
                ...(activeForDir?.summaries || []),
                ...(archivedForDir?.summaries || [])
            ];
            // Delete all sessions
            const deletePromises = allSessions.map(session => ipcMain.emit(AgentSessionAPIEvents.DELETE_SESSION, null, session.sessionId, directory));
            await Promise.all(deletePromises);
            return true;
        }
        catch (error) {
            console.error(`[SessionHandlers] Failed to clear sessions for directory ${directory}:`, error);
            return false;
        }
    });
    // Update session metadata
    ipcMain.handle(AgentSessionAPIEvents.UPDATE_SESSION_METADATA, async (_, sessionId, directory, metadata) => {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            // Get the current session data
            const sessionResult = await storageManager.get(sessionId, StaticNamespaces.AGENT_SESSIONS);
            if (!sessionResult.success || !sessionResult.data) {
                console.error(`[SessionHandlers] Session ${sessionId} not found`);
                return false;
            }
            // Update the metadata
            const session = sessionResult.data;
            if (!session.metadata) {
                session.metadata = {};
            }
            // Merge the new metadata
            Object.assign(session.metadata, metadata);
            // Save the updated session
            const saveResult = await storageManager.set(sessionId, session, StaticNamespaces.AGENT_SESSIONS);
            if (saveResult.success) {
                // Notify all windows about the update
                BrowserWindow.getAllWindows().forEach(window => {
                    window.webContents.send(AgentSessionAPIEvents.SESSION_UPDATED, { sessionId, directory });
                });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`[SessionHandlers] Failed to update metadata for session ${sessionId}:`, error);
            return false;
        }
    });
    // Reprocess events for a session (delegates to agent-session-events module)
    ipcMain.handle('sessions:reprocess', async (_, sessionId) => {
        try {
            console.log(`[SessionHandlers] Reprocessing session ${sessionId}`);
            // This will be implemented by the agent-session-events module
            // For now, return a stub response
            return {
                success: false,
                error: 'Reprocessing handler not yet implemented in agent-session-events module'
            };
        }
        catch (error) {
            console.error(`[SessionHandlers] Failed to reprocess session ${sessionId}:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Get raw session events (delegates to agent-session-events module)
    ipcMain.handle('sessions:get-raw-events', async (_, sessionId) => {
        try {
            console.log(`[SessionHandlers] Getting raw events for session ${sessionId}`);
            const storageManager = await getTypedStorageManagerInstance();
            // Get raw events from the appropriate namespace
            // Look in various agent event namespaces
            const namespaces = [AgentEventNamespaces.CLAUDE, AgentEventNamespaces.GEMINI, AgentEventNamespaces.OPENCODE];
            const allEvents = [];
            for (const namespace of namespaces) {
                try {
                    const keys = await storageManager.keys(namespace);
                    if (keys) {
                        for (const key of keys) {
                            if (key.includes(sessionId)) {
                                const event = await storageManager.get(key, namespace);
                                if (event?.success && event.data) {
                                    allEvents.push(event.data);
                                }
                            }
                        }
                    }
                }
                catch (err) {
                    // Namespace might not exist, continue
                }
            }
            return allEvents.length > 0 ? allEvents : null;
        }
        catch (error) {
            console.error(`[SessionHandlers] Failed to get raw events for session ${sessionId}:`, error);
            return null;
        }
    });
}
