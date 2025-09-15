import { EventEmitter } from 'events';
import os from 'os';
import { BrowserWindow } from 'electron';
import { SupportedAgent, ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor, isToolEvent, isStopEvent, PathContext } from "@principal-ai/agent-monitoring";
import { PathNormalizer } from './PathNormalizer';
import { EventQueue } from './EventQueue';
import { AgentSessionAPIEvents } from '../../shared/main-process-api-interfaces/AgentSessionAPI';
import { StaticNamespaces } from '../storage-providers/types';
import { getTypedStorageManager } from '../storage-providers';
import { repositoryCache } from '../stores/RepositoryCache';
// Import centralized event processor
import { sessionEventProcessor } from '../../shared/event-processing/SessionEventProcessor';
export class AgentSessionEventProcessor extends EventEmitter {
    adapters;
    pathNormalizer;
    eventQueue;
    constructor() {
        super();
        // Initialize adapters
        this.adapters = new Map([
            [SupportedAgent.CLAUDE, new ClaudeEventProcessor()],
            [SupportedAgent.GEMINI, new GeminiEventProcessor()],
            [SupportedAgent.OPENCODE, new OpenCodeEventProcessor()]
        ]);
        // Initialize event queue for serialized session writes
        this.eventQueue = new EventQueue();
        // Initialize path normalizer with repository detection
        this.pathNormalizer = new PathNormalizer({
            homeDir: os.homedir(),
            findRepositoryRoot: async (absolutePath) => {
                try {
                    const repoInfo = await repositoryCache.getRepositoryForPath(absolutePath);
                    if (repoInfo?.gitInfo.root) {
                        return {
                            root: repoInfo.gitInfo.root,
                            remoteUrl: repoInfo.gitInfo.remoteUrl,
                            owner: repoInfo.gitInfo.owner,
                            repo: repoInfo.gitInfo.repo,
                            branch: repoInfo.gitInfo.branch
                        };
                    }
                }
                catch (error) {
                    console.error('[EventProcessor] Error finding repository:', error);
                }
                return null;
            }
        });
    }
    /**
     * Process a raw event from a hook
     */
    async processRawEvent(provider, rawData) {
        try {
            // Validate raw data
            if (!rawData || typeof rawData !== 'object') {
                throw new Error('Invalid raw data: expected object');
            }
            // Get the appropriate adapter
            const adapter = this.adapters.get(provider);
            if (!adapter) {
                throw new Error(`No adapter found for provider: ${provider}`);
            }
            // Normalize the raw event
            const normalizedEvent = adapter.normalize(rawData);
            // Enrich with normalized working directory (git root)
            const enrichedEvent = await this.enrichEventWithGitRoot(normalizedEvent);
            // Log important events using normalized data
            this.logEvent(enrichedEvent);
            // Store the enriched event
            await this.storeNormalizedEvent(enrichedEvent);
            // Emit for real-time listeners
            this.emit('event-processed', enrichedEvent);
            return enrichedEvent;
        }
        catch (error) {
            console.error('[EventProcessor] Error processing event:', error);
            throw error;
        }
    }
    /**
     * Store normalized event in AGENT_SESSIONS namespace
     * Uses EventQueue to serialize writes per session and prevent race conditions
     */
    async storeNormalizedEvent(event) {
        // Validate session ID
        if (!event.sessionId || typeof event.sessionId !== 'string' || event.sessionId.trim() === '') {
            console.error('[EventProcessor] Invalid session ID, skipping event:', event.sessionId);
            return;
        }
        // Normalize session ID (trim whitespace) for consistent storage key
        const normalizedSessionId = event.sessionId.trim();
        // Queue the storage operation for this session to prevent concurrent writes
        return this.eventQueue.enqueue(normalizedSessionId, async () => {
            try {
                const typedStore = await getTypedStorageManager();
                const sessionKey = normalizedSessionId;
                // Get or create session data
                const existingResult = await typedStore.get(sessionKey, StaticNamespaces.AGENT_SESSIONS);
                let sessionData;
                if (existingResult.success && existingResult.data) {
                    // Update existing session
                    sessionData = existingResult.data;
                    sessionData.events.push(event);
                    sessionData.lastUpdateTime = event.timestamp;
                    // Don't update totalEvents here - let centralized processor handle it
                }
                else {
                    // Create new session with normalized session ID
                    sessionData = {
                        sessionId: normalizedSessionId,
                        provider: event.provider,
                        workingDirectory: event.workingDirectory,
                        startTime: event.timestamp,
                        lastUpdateTime: event.timestamp,
                        events: [event],
                        totalEvents: 0, // Start at 0, let centralized processor increment
                        repositoriesAccessed: [],
                        counters: {
                            fileAccesses: 0,
                            fileWrites: 0,
                            toolCalls: 0,
                            webAccesses: 0
                        },
                        // Initialize file tracking fields for centralized processor
                        fileAccesses: {},
                        fileWrites: {},
                        filesRead: [],
                        filesWritten: [],
                        // Initialize metadata for storing todos and other data
                        metadata: {}
                    };
                    // Emit SESSION_CREATED event to notify UI with normalized ID
                    this.emitSessionCreatedEvent(normalizedSessionId, event.workingDirectory);
                }
                // Use centralized event processor for consistent processing
                const currentState = {
                    sessionId: sessionData.sessionId,
                    workingDirectory: sessionData.workingDirectory,
                    firstAccess: sessionData.startTime || Date.now(),
                    lastActivity: sessionData.lastUpdateTime || Date.now(),
                    eventCount: sessionData.totalEvents || 0,
                    isActive: true,
                    fileAccessCount: sessionData.counters?.fileAccesses || 0,
                    fileWriteCount: sessionData.counters?.fileWrites || 0,
                    fileAccesses: sessionData.fileAccesses || {},
                    fileWrites: sessionData.fileWrites || {},
                    filesRead: sessionData.filesRead || [],
                    filesWritten: sessionData.filesWritten || [],
                    toolCallCount: sessionData.counters?.toolCalls || 0,
                    webAccessCount: sessionData.counters?.webAccesses || 0
                };
                // Process event through centralized processor
                const processingResult = sessionEventProcessor.processEvent(event, currentState);
                // Apply updates from centralized processor
                if (processingResult.session) {
                    // Update file tracking
                    if (processingResult.session.fileAccesses) {
                        sessionData.fileAccesses = processingResult.session.fileAccesses;
                    }
                    if (processingResult.session.fileWrites) {
                        sessionData.fileWrites = processingResult.session.fileWrites;
                    }
                    if (processingResult.session.filesRead) {
                        sessionData.filesRead = processingResult.session.filesRead;
                    }
                    if (processingResult.session.filesWritten) {
                        sessionData.filesWritten = processingResult.session.filesWritten;
                    }
                    // Update counters
                    if (processingResult.session.fileAccessCount !== undefined && sessionData.counters) {
                        sessionData.counters.fileAccesses = processingResult.session.fileAccessCount;
                    }
                    if (processingResult.session.fileWriteCount !== undefined && sessionData.counters) {
                        sessionData.counters.fileWrites = processingResult.session.fileWriteCount;
                    }
                    if (processingResult.session.toolCallCount !== undefined && sessionData.counters) {
                        sessionData.counters.toolCalls = processingResult.session.toolCallCount;
                    }
                    // Update activity tracking
                    if (processingResult.session.lastActivity) {
                        sessionData.lastUpdateTime = processingResult.session.lastActivity;
                    }
                    if (processingResult.session.eventCount !== undefined) {
                        sessionData.totalEvents = processingResult.session.eventCount;
                    }
                    // Update metadata (includes lastTodos from TodoWriteProcessor)
                    if (processingResult.session.metadata) {
                        sessionData.metadata = processingResult.session.metadata;
                    }
                }
                // Still do our original repository tracking (not in centralized processor yet)
                await this.updateRepositoryTracking(sessionData, event);
                // Store updated session data
                const result = await typedStore.set(sessionKey, sessionData, StaticNamespaces.AGENT_SESSIONS);
                if (!result.success) {
                    throw new Error(`Failed to store session data: ${result.error?.message}`);
                }
                console.log(`[EventProcessor] Stored event ${event.eventType} for session ${event.sessionId.slice(0, 8)}... (${sessionData.totalEvents} events)`);
                // Handle side effects if any
                if (processingResult.sideEffects) {
                    // Log for now - can be extended to trigger actual side effects
                    console.log('[EventProcessor] Side effects from centralized processor:', processingResult.sideEffects);
                }
            }
            catch (error) {
                console.error('[EventProcessor] Error storing normalized event:', error);
                throw error;
            }
        });
    }
    /**
     * Update session counters based on normalized event
     */
    updateSessionCounters(sessionData, event) {
        if (!sessionData.counters) {
            sessionData.counters = {
                fileAccesses: 0,
                fileWrites: 0,
                toolCalls: 0,
                webAccesses: 0
            };
        }
        if (!sessionData.fileContexts) {
            sessionData.fileContexts = {
                repositories: [],
                systemFiles: 0,
                configFiles: 0,
                tempFiles: 0,
                externalFiles: []
            };
        }
        // Count tool calls
        if (event.eventType === 'pre-tool-use') {
            sessionData.counters.toolCalls++;
            // Count specific tool types using utility functions
            if (event.toolName) {
                if (this.isFileReadTool(event.toolName)) {
                    sessionData.counters.fileAccesses++;
                }
                else if (this.isFileWriteTool(event.toolName)) {
                    sessionData.counters.fileWrites++;
                }
                else if (this.isWebAccessTool(event.toolName)) {
                    sessionData.counters.webAccesses++;
                }
            }
            // Track file contexts from normalized paths
            if (event.files && event.files.length > 0) {
                for (const pathInfo of event.files) {
                    if (!pathInfo)
                        continue;
                    // Track repository access (keep unique)
                    if (pathInfo.repository?.gitRoot) {
                        if (!sessionData.fileContexts.repositories.includes(pathInfo.repository.gitRoot)) {
                            sessionData.fileContexts.repositories.push(pathInfo.repository.gitRoot);
                        }
                    }
                    // Track file context types
                    switch (pathInfo.context) {
                        case PathContext.SYSTEM_FILE:
                            sessionData.fileContexts.systemFiles++;
                            break;
                        case PathContext.CONFIG_FILE:
                            sessionData.fileContexts.configFiles++;
                            break;
                        case PathContext.TEMP_FILE:
                            sessionData.fileContexts.tempFiles++;
                            break;
                        case PathContext.USER_FILE:
                            // Track notable external files (non-repo user files)
                            if (!pathInfo.repository && this.pathNormalizer.shouldTrackInDetail(pathInfo)) {
                                if (!sessionData.fileContexts.externalFiles.includes(pathInfo.displayPath)) {
                                    sessionData.fileContexts.externalFiles.push(pathInfo.displayPath);
                                }
                            }
                            break;
                    }
                }
            }
        }
    }
    /**
     * Check if a tool is a file reading tool
     */
    isFileReadTool(toolName) {
        const readTools = new Set([
            'Read', 'read', 'read_file', 'readfile',
            'LS', 'ls', 'list_files',
            'Glob', 'glob',
            'Grep', 'grep'
        ]);
        return readTools.has(toolName);
    }
    /**
     * Check if a tool is a file writing tool
     */
    isFileWriteTool(toolName) {
        const writeTools = new Set([
            'Write', 'write', 'write_file', 'writefile',
            'Edit', 'edit', 'edit_file', 'editfile',
            'MultiEdit', 'multiedit', 'multi_edit',
            'str_replace_editor', 'str_replace_based_edit_tool'
        ]);
        return writeTools.has(toolName);
    }
    /**
     * Check if a tool is a web access tool
     */
    isWebAccessTool(toolName) {
        const webTools = new Set([
            'WebFetch', 'webfetch', 'web_fetch',
            'WebSearch', 'websearch', 'web_search',
            'get_url', 'GetUrl'
        ]);
        return webTools.has(toolName);
    }
    /**
     * Log important events using normalized event data
     */
    logEvent(event) {
        // Only log tool events and important lifecycle events
        if (isToolEvent(event) || isStopEvent(event) || event.eventType === 'session-start') {
            const toolInfo = event.toolName ? `: ${event.toolName}` : '';
            const sessionShort = event.sessionId.slice(0, 8);
            console.log(`[EventProcessor] ${event.eventType}${toolInfo} (session: ${sessionShort}...)`);
        }
    }
    /**
     * Enrich event with normalized working directory (git root)
     * This adds the git root as normalizedWorkingDirectory
     */
    async enrichEventWithGitRoot(event) {
        // Try to get repository info for the working directory
        try {
            const repoInfo = await repositoryCache.getRepositoryForPath(event.workingDirectory);
            if (repoInfo?.gitInfo.root) {
                // Set normalized working directory to git root
                event.normalizedWorkingDirectory = repoInfo.gitInfo.root;
            }
            else {
                // Not in a git repo, normalized is same as original
                event.normalizedWorkingDirectory = event.workingDirectory;
            }
        }
        catch (_error) {
            // If git detection fails, normalized is same as original
            event.normalizedWorkingDirectory = event.workingDirectory;
        }
        // Normalize file paths if present
        if (event.files && event.files.length > 0) {
            try {
                // Normalize all file paths
                event.files = await this.pathNormalizer.normalizePaths(event.files.map(f => f.originalPath), event.workingDirectory);
                // VALIDATION: Check that displayPath was properly normalized for repository files
                for (const file of event.files) {
                    // Empty displayPath is valid - it could mean the root directory or current directory
                    // Only validate repository paths where we expect specific behavior
                    if (file.repository) {
                        // Check for absolute path when it should be relative (but only if not empty)
                        if (file.displayPath && file.displayPath === file.absolutePath) {
                            console.warn(`[EventProcessor] Warning: displayPath equals absolutePath in repository:\n` +
                                `  Display path: ${file.displayPath}\n` +
                                `  Repository root: ${file.repository.gitRoot}`);
                            // Try to fix it by making it relative
                            const path = require('path');
                            file.displayPath = path.relative(file.repository.gitRoot, file.absolutePath);
                        }
                        // Check for absolute path in displayPath when in repository (but empty is fine)
                        if (file.displayPath && file.displayPath.startsWith('/')) {
                            console.warn(`[EventProcessor] Warning: displayPath is absolute in repository:\n` +
                                `  Display path: ${file.displayPath}\n` +
                                `  Repository root: ${file.repository.gitRoot}`);
                            // Try to fix it by making it relative
                            const path = require('path');
                            file.displayPath = path.relative(file.repository.gitRoot, file.absolutePath);
                        }
                    }
                }
            }
            catch (error) {
                console.error('[EventProcessor] Error normalizing paths:', error);
                // Re-throw to make the error visible
                throw error;
            }
        }
        return event;
    }
    /**
     * Update repository tracking for the session
     * Uses the normalizedWorkingDirectory from the enriched event
     */
    async updateRepositoryTracking(sessionData, event) {
        if (!sessionData.repositoriesAccessed) {
            sessionData.repositoriesAccessed = [];
        }
        // Skip if no normalized directory (shouldn't happen after enrichment)
        if (!event.normalizedWorkingDirectory) {
            return;
        }
        // If normalizedWorkingDirectory is different from workingDirectory, it's a git root
        if (event.normalizedWorkingDirectory !== event.workingDirectory) {
            // Check if we already have this git root
            const existingRoot = sessionData.repositoriesAccessed.find(r => r.gitRoot === event.normalizedWorkingDirectory);
            if (!existingRoot) {
                // Get repository info to get the remote URL
                const repoInfo = await repositoryCache.getRepositoryForPath(event.workingDirectory);
                if (repoInfo?.repository.remoteUrl) {
                    // New git root
                    sessionData.repositoriesAccessed.push({
                        remoteUrl: repoInfo.repository.remoteUrl,
                        gitRoot: event.normalizedWorkingDirectory
                    });
                    console.log(`[EventProcessor] New repository detected: ${event.normalizedWorkingDirectory} -> ${repoInfo.repository.remoteUrl}`);
                    // Update repository last accessed time
                    await repositoryCache.updateRepositoryAccess(repoInfo.repository.remoteUrl);
                }
            }
        }
    }
    /**
     * Get session data by session ID
     */
    async getSessionData(sessionId) {
        try {
            const typedStore = await getTypedStorageManager();
            const result = await typedStore.get(sessionId, StaticNamespaces.AGENT_SESSIONS);
            return result.success ? result.data || null : null;
        }
        catch (error) {
            console.error('[EventProcessor] Error getting session data:', error);
            return null;
        }
    }
    /**
     * Get all session IDs
     */
    async getAllSessionIds() {
        try {
            const typedStore = await getTypedStorageManager();
            return await typedStore.keys(StaticNamespaces.AGENT_SESSIONS);
        }
        catch (error) {
            console.error('[EventProcessor] Error getting session IDs:', error);
            return [];
        }
    }
    /**
     * Delete a session
     */
    async deleteSession(sessionId) {
        try {
            const typedStore = await getTypedStorageManager();
            const result = await typedStore.delete(sessionId, StaticNamespaces.AGENT_SESSIONS);
            return result.success;
        }
        catch (error) {
            console.error('[EventProcessor] Error deleting session:', error);
            return false;
        }
    }
    /**
     * Emit session created event to all windows
     */
    emitSessionCreatedEvent(sessionId, directory) {
        try {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(window => {
                if (!window.isDestroyed()) {
                    window.webContents.send(AgentSessionAPIEvents.SESSION_CREATED, {
                        sessionId,
                        directory
                    });
                }
            });
            console.log(`[EventProcessor] Emitted SESSION_CREATED event for session ${sessionId.slice(0, 8)}...`);
        }
        catch (error) {
            console.error('[EventProcessor] Error emitting session created event:', error);
        }
    }
}
