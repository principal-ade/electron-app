import { BrowserWindow, ipcMain, app } from 'electron';
import express from 'express';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import path from 'path';
import { getAgentInfo, SUPPORTED_AGENTS } from "@principal-ai/agent-monitoring";
import { AgentSessionEventsAPIEvent } from '../../shared/main-process-api-interfaces';
import { getTypedStorageManagerInstance } from '../stores/initialization';
import { StaticNamespaces } from '../storage-providers/types';
import { getAgentEventNamespace } from '../storage-providers/typed-namespaces';
import { AgentEventNamespaces } from '../../shared/types/namespaces.types';
import { AgentSessionEventProcessorV2 } from './AgentSessionEventProcessorV2';
import { BatchEventReprocessor } from './BatchEventReprocessor';
import { HookConfigurationManager } from '../agent-management/HookConfigurationManager';
export class AgentSessionEventsHttpBridge extends EventEmitter {
    app;
    server = null;
    port = 3043; // Port that claude-hook expects
    maxPortRetries = 10;
    recentEvents = new Map();
    maxEventsPerProvider = 1000; // Only for in-memory cache, not persistent storage
    eventProcessorV2;
    /**
     * Type-safe helper to get an event from an agent namespace
     * All agent namespaces store AgentSessionEvent, so this is always safe
     */
    async getAgentEvent(storageManager, eventKey, namespace) {
        const result = await storageManager.get(eventKey, namespace);
        return result.success ? result.data : undefined;
    }
    /**
     * Type-safe helper to set an event in an agent namespace
     */
    async setAgentEvent(storageManager, eventKey, event, namespace) {
        await storageManager.set(eventKey, event, namespace);
    }
    /**
     * Type-safe helper to delete an event from an agent namespace
     */
    async deleteAgentEvent(storageManager, eventKey, namespace) {
        await storageManager.delete(eventKey, namespace);
    }
    constructor(startPort) {
        super();
        this.app = express();
        this.port = startPort;
        // Use V2 processor with new pipeline
        console.log('[AgentSessionEventsHttpBridge] Using V2 event processor with new pipeline');
        this.eventProcessorV2 = new AgentSessionEventProcessorV2();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupEventHandlers();
        this.setupEventProcessorListeners();
        // Schedule auto-processing for after the app is ready
        // This prevents blocking the UI during startup
        if (app.isReady()) {
            // App is already ready, schedule for next tick
            process.nextTick(() => this.autoProcessFallbackFiles());
        }
        else {
            // Wait for app to be ready
            app.once('ready', () => {
                // Give the UI time to fully load
                setTimeout(() => this.autoProcessFallbackFiles(), 10000); // 10 seconds after app ready
            });
        }
    }
    setupMiddleware() {
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        // CORS headers for local development
        this.app.use((_req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (_req.method === 'OPTIONS') {
                res.sendStatus(200);
            }
            else {
                next();
            }
        });
        // Request logging middleware
        this.app.use((req, _res, next) => {
            console.log(`[Agent Session Events Bridge] ${req.method} ${req.path}`);
            next();
        });
    }
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                timestamp: Date.now(),
                message: 'Agent Session Events Bridge is running',
                providers: Array.from(this.recentEvents.keys()),
                eventCounts: Object.fromEntries(Array.from(this.recentEvents.entries()).map(([provider, events]) => [provider, events.length]))
            });
        });
        SUPPORTED_AGENTS.forEach((agent) => {
            const agentInfo = getAgentInfo(agent);
            console.log(`[Agent Session Events Bridge] Setting up route for ${agentInfo.bridgeRoute}`);
            this.app.post(`/${agentInfo.bridgeRoute}`, async (req, res) => {
                try {
                    // Extract and validate session ID
                    const rawSessionId = req.body.session_id || req.body.sessionId;
                    if (!rawSessionId || typeof rawSessionId !== 'string' || rawSessionId.trim() === '') {
                        console.error(`[Agent Session Events Bridge] Missing or invalid session ID from ${agent}:`, rawSessionId);
                        res.status(400).json({
                            success: false,
                            error: 'Missing or invalid session_id. Events must include a valid session ID.'
                        });
                        return;
                    }
                    // Normalize session ID (trim whitespace)
                    const sessionId = rawSessionId.trim();
                    const event = {
                        provider: agent,
                        timestamp: Date.now(),
                        data: req.body,
                        eventType: req.body.hook_event_name || req.body.type || 'unknown',
                        sessionId,
                        workingDirectory: req.body.working_directory || req.body.workingDirectory,
                    };
                    // Store raw event
                    await this.storeEvent(event);
                    // Process the event using V2 processor
                    try {
                        await this.eventProcessorV2.processRawEvent(agent, req.body);
                        // Log is already handled in EventProcessor, no need to duplicate
                    }
                    catch (processError) {
                        console.error(`[Agent Session Events Bridge] Failed to process event:`, processError);
                        // Continue even if processing fails - we still have the raw event
                    }
                    // Broadcast raw event for compatibility
                    this.broadcastEvent(event);
                    res.json({ success: true, message: 'Event processed' });
                }
                catch (error) {
                    console.error(`[Agent Session Events Bridge] Error processing ${agent} event:`, error);
                    res.status(500).json({ success: false, error: 'Internal server error' });
                }
            });
        });
    }
    setupEventHandlers() {
        // IPC handler for renderer to subscribe to provider events
        ipcMain.handle(AgentSessionEventsAPIEvent.SUBSCRIBE, (event, provider) => {
            const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
            if (!windowId)
                return { success: false };
            console.log(`[Agent Session Events Bridge] Window ${windowId} subscribed to ${provider || 'all'} events`);
            return { success: true, port: this.port };
        });
        // IPC handler to get recent events for a provider
        ipcMain.handle(AgentSessionEventsAPIEvent.GET_RECENT_EVENTS, (_event, provider) => {
            if (provider) {
                return this.recentEvents.get(provider) || [];
            }
            // Return all events from all providers
            const allEvents = [];
            this.recentEvents.forEach((events) => {
                allEvents.push(...events);
            });
            // Sort by timestamp descending
            return allEvents.sort((a, b) => b.timestamp - a.timestamp);
        });
        // IPC handler to get events for a specific session
        ipcMain.handle(AgentSessionEventsAPIEvent.GET_SESSION_EVENTS, async (_event, sessionId) => {
            const sessionEvents = [];
            // Get events from memory first
            this.recentEvents.forEach((events) => {
                const filtered = events.filter(e => e.sessionId === sessionId);
                sessionEvents.push(...filtered);
            });
            // Also check persistent storage for all providers
            try {
                const storageManager = await getTypedStorageManagerInstance();
                // Get the index once
                const indexesResult = await storageManager.get('indexes', StaticNamespaces.AGENT_EVENT_INDEXES);
                if (!indexesResult.success || !indexesResult.data) {
                    return sessionEvents.sort((a, b) => b.timestamp - a.timestamp);
                }
                const allIndexes = indexesResult.data;
                for (const agent of SUPPORTED_AGENTS) {
                    const namespace = getAgentEventNamespace(agent);
                    const eventKeys = allIndexes[namespace] || [];
                    // Filter event keys by session ID (since key format is event-{sessionId}-{timestamp}-{eventType}-{hash})
                    const sessionEventKeys = eventKeys.filter(key => {
                        const parts = key.split('-');
                        return parts.length >= 2 && parts[1] === sessionId;
                    });
                    if (sessionEventKeys.length === 0)
                        continue;
                    // Batch read all events for this session in one go
                    const eventPromises = sessionEventKeys.map(eventKey => this.getAgentEvent(storageManager, eventKey, namespace));
                    const events = await Promise.all(eventPromises);
                    // Add non-null events to results
                    events.forEach((event) => {
                        if (event && event.sessionId === sessionId) {
                            sessionEvents.push(event);
                        }
                    });
                }
            }
            catch (error) {
                console.error('[Agent Session Events Bridge] Error fetching session events from storage:', error);
            }
            // Sort by timestamp descending
            return sessionEvents.sort((a, b) => b.timestamp - a.timestamp);
        });
        // IPC handler to clear events for a provider
        ipcMain.handle(AgentSessionEventsAPIEvent.CLEAR_EVENTS, (_event, provider) => {
            if (provider) {
                this.recentEvents.delete(provider);
            }
            else {
                this.recentEvents.clear();
            }
            return { success: true };
        });
        // IPC handler to reprocess events for a specific session
        ipcMain.handle(AgentSessionEventsAPIEvent.REPROCESS_SESSION_EVENTS, async (event, sessionId) => {
            try {
                console.log(`[Agent Session Events Bridge] Starting batch reprocessing for session ${sessionId}...`);
                if (!sessionId) {
                    return {
                        success: false,
                        error: 'Session ID is required'
                    };
                }
                const storageManager = await getTypedStorageManagerInstance();
                // Clear existing processed events for this session from AGENT_SESSIONS namespace
                const agentSessionsNamespace = StaticNamespaces.AGENT_SESSIONS;
                const sessionKey = sessionId; // Just the sessionId, not prefixed
                await storageManager.delete(sessionKey, agentSessionsNamespace);
                console.log(`[Agent Session Events Bridge] Cleared existing processed data for session ${sessionId}`);
                // Collect all raw events for this session
                const allEvents = [];
                // Get the index once for all agents
                const indexesResult = await storageManager.get('indexes', StaticNamespaces.AGENT_EVENT_INDEXES);
                const allIndexes = indexesResult.success ? indexesResult.data : null;
                if (allIndexes) {
                    // Process events from each agent namespace in parallel
                    const agentPromises = SUPPORTED_AGENTS.map(async (agent) => {
                        const namespace = getAgentEventNamespace(agent);
                        const eventKeys = allIndexes[namespace] || [];
                        // Filter for event keys matching this session (key format: event-{sessionId}-{timestamp}-{eventType}-{hash})
                        const sessionEventKeys = eventKeys.filter(key => {
                            const parts = key.split('-');
                            return parts.length >= 2 && parts[1] === sessionId;
                        });
                        if (sessionEventKeys.length === 0)
                            return [];
                        console.log(`[Agent Session Events Bridge] Found ${sessionEventKeys.length} events in ${namespace}`);
                        // Batch read all events for this agent/session in parallel
                        const eventPromises = sessionEventKeys.map(eventKey => this.getAgentEvent(storageManager, eventKey, namespace));
                        const events = await Promise.all(eventPromises);
                        // Convert to the expected format
                        return events
                            .filter((event) => event !== undefined && event !== null)
                            .map((event) => ({
                            provider: event.provider,
                            data: event.data
                        }));
                    });
                    // Wait for all agents to complete
                    const agentResults = await Promise.all(agentPromises);
                    // Flatten results into allEvents array
                    agentResults.forEach((events) => allEvents.push(...events));
                }
                const totalEvents = allEvents.length;
                console.log(`[Agent Session Events Bridge] Found ${totalEvents} total events to batch process`);
                if (totalEvents === 0) {
                    return {
                        success: true,
                        processedCount: 0
                    };
                }
                // Use the optimized batch processor
                const batchProcessor = new BatchEventReprocessor();
                // Process all events and build the session record
                const sessionRecord = await batchProcessor.reprocessSessionBatch(sessionId, allEvents, (current, total) => {
                    // Send progress updates
                    const progress = Math.min(100, Math.round((current / total) * 100));
                    if (event.sender && !event.sender.isDestroyed()) {
                        event.sender.send('agent-session-events:reprocess-progress', {
                            sessionId,
                            current,
                            total,
                            progress
                        });
                    }
                });
                // Store the complete session record in AGENT_SESSIONS namespace
                await storageManager.set(sessionKey, sessionRecord, agentSessionsNamespace);
                console.log(`[Agent Session Events Bridge] Batch reprocessing complete. Processed ${totalEvents} events and saved to storage`);
                return {
                    success: true,
                    processedCount: totalEvents
                };
            }
            catch (error) {
                console.error('[Agent Session Events Bridge] Error during batch reprocessing:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error during reprocessing'
                };
            }
        });
        // IPC handler to reprocess all events
        ipcMain.handle(AgentSessionEventsAPIEvent.REPROCESS_ALL_EVENTS, async () => {
            try {
                console.log('[Agent Session Events Bridge] Starting event reprocessing...');
                // Clear the processed events namespace
                const storageManager = await getTypedStorageManagerInstance();
                // Clear all processed events
                await storageManager.clear(StaticNamespaces.AGENT_SESSIONS);
                console.log('[Agent Session Events Bridge] Cleared processed events namespace');
                // Collect all events grouped by session
                const sessionEventsMap = new Map();
                // Process events from each agent namespace
                for (const namespaceName of Object.values(AgentEventNamespaces)) {
                    console.log(`[Agent Session Events Bridge] Collecting events from ${namespaceName}`);
                    // Get all keys in this namespace
                    const keysResult = await storageManager.keys(namespaceName);
                    if (!keysResult)
                        continue;
                    // Filter for event keys (not indexes or other metadata)
                    const eventKeys = keysResult.filter(key => key.startsWith('event-') &&
                        key.split('-').length >= 4 // event-sessionId-timestamp-eventType format
                    );
                    for (const eventKey of eventKeys) {
                        const rawEvent = await this.getAgentEvent(storageManager, eventKey, namespaceName);
                        if (!rawEvent)
                            continue;
                        // Validate event structure
                        if (!rawEvent.provider || !rawEvent.data) {
                            console.warn(`[Agent Session Events Bridge] Skipping malformed event ${eventKey}`);
                            continue;
                        }
                        // Extract session ID from the event
                        const data = rawEvent.data;
                        const sessionId = rawEvent.sessionId ||
                            (data && typeof data === 'object' && 'session_id' in data ? data.session_id : undefined) ||
                            (data && typeof data === 'object' && 'sessionId' in data ? data.sessionId : undefined) ||
                            'unknown';
                        // Group by session
                        if (!sessionEventsMap.has(sessionId)) {
                            sessionEventsMap.set(sessionId, []);
                        }
                        sessionEventsMap.get(sessionId).push({
                            provider: rawEvent.provider,
                            data: rawEvent.data
                        });
                    }
                }
                console.log(`[Agent Session Events Bridge] Found ${sessionEventsMap.size} unique sessions to reprocess`);
                // Use BatchEventReprocessor for each session
                const batchProcessor = new BatchEventReprocessor();
                let totalProcessed = 0;
                for (const [sessionId, events] of sessionEventsMap) {
                    try {
                        console.log(`[Agent Session Events Bridge] Processing session ${sessionId} with ${events.length} events`);
                        // Process all events for this session
                        const sessionData = await batchProcessor.reprocessSessionBatch(sessionId, events, (current, total) => {
                            // Progress callback
                            if (current % 100 === 0) {
                                console.log(`[Agent Session Events Bridge] Session ${sessionId}: ${current}/${total} events`);
                            }
                        });
                        // Store the processed session data
                        await storageManager.set(sessionId, sessionData, StaticNamespaces.AGENT_SESSIONS);
                        totalProcessed += sessionData.totalEvents;
                    }
                    catch (error) {
                        console.error(`[Agent Session Events Bridge] Failed to process session ${sessionId}:`, error);
                        // Continue with other sessions
                    }
                }
                console.log(`[Agent Session Events Bridge] Reprocessing complete. Processed ${totalProcessed} events across ${sessionEventsMap.size} sessions`);
                return { success: true, processedCount: totalProcessed };
            }
            catch (error) {
                console.error('[Agent Session Events Bridge] Error during reprocessing:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error during reprocessing'
                };
            }
        });
        // IPC handler to process a specific fallback file
        ipcMain.handle('agent-session-events:process-fallback-file', async (_, filePath, cli) => {
            try {
                // Find the matching agent
                const agent = SUPPORTED_AGENTS.find(a => a === cli);
                if (!agent) {
                    return {
                        success: false,
                        error: `Unsupported agent: ${cli}`
                    };
                }
                const result = await this.processFallbackFile(filePath, agent);
                return result;
            }
            catch (error) {
                console.error('[Agent Session Events Bridge] Error processing fallback file:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    async storeEvent(event) {
        try {
            // Store in memory for quick access (limited cache for UI display)
            const providerEvents = this.recentEvents.get(event.provider) || [];
            providerEvents.unshift(event);
            // Limit the in-memory cache only (not persistent storage)
            if (providerEvents.length > this.maxEventsPerProvider) {
                providerEvents.pop();
            }
            this.recentEvents.set(event.provider, providerEvents);
            // Store in persistent storage with namespace based on provider
            const storageManager = await getTypedStorageManagerInstance();
            const namespace = getAgentEventNamespace(event.provider);
            // Create a deterministic key for deduplication
            const eventKey = this.createEventKey(event);
            // Check if event already exists
            const existingEvent = await this.getAgentEvent(storageManager, eventKey, namespace);
            if (existingEvent) {
                console.log(`[Agent Session Events Bridge] Duplicate event detected, skipping: ${eventKey}`);
                return;
            }
            // Store the event
            await this.setAgentEvent(storageManager, eventKey, event, namespace);
            // Maintain the index in the centralized AGENT_EVENT_INDEXES namespace
            const indexesResult = await storageManager.get('indexes', StaticNamespaces.AGENT_EVENT_INDEXES);
            let allIndexes = indexesResult.success ? indexesResult.data : undefined;
            if (!allIndexes) {
                allIndexes = {
                    [AgentEventNamespaces.CLAUDE]: [],
                    [AgentEventNamespaces.GEMINI]: [],
                    [AgentEventNamespaces.OPENCODE]: []
                };
            }
            // Get the index for this specific namespace
            const eventIndex = allIndexes[namespace] || [];
            eventIndex.unshift(eventKey);
            // No longer delete events based on count limit - proper cleanup happens during archiving
            // Events are cleaned up when sessions are archived or explicitly deleted
            // Update the index for this namespace
            allIndexes[namespace] = eventIndex;
            await storageManager.set('indexes', allIndexes, StaticNamespaces.AGENT_EVENT_INDEXES);
            console.log(`[Agent Session Events Bridge] Stored event for ${event.provider}:`, {
                eventType: event.eventType,
                sessionId: event.sessionId,
                timestamp: event.timestamp
            });
        }
        catch (error) {
            console.error('[Agent Session Events Bridge] Error storing event:', error);
        }
    }
    broadcastEvent(event) {
        // Broadcast to all windows
        BrowserWindow.getAllWindows().forEach((window) => {
            if (!window.isDestroyed()) {
                try {
                    window.webContents.send('cli-provider:event', event);
                }
                catch (error) {
                    console.error('[Agent Session Events Bridge] Error broadcasting event:', error);
                }
            }
        });
    }
    start() {
        return new Promise((resolve, reject) => {
            const initialPort = this.port;
            let retryCount = 0;
            const tryListen = () => {
                this.server = this.app.listen(this.port, 'localhost', () => {
                    console.log(`🔌 Agent Session Events Bridge started on http://localhost:${this.port}`);
                    console.log(`   Health check: http://localhost:${this.port}/health`);
                    SUPPORTED_AGENTS.forEach((agent) => {
                        const agentInfo = getAgentInfo(agent);
                        console.log(`   ${agentInfo.displayName} hook: POST http://localhost:${this.port}/${agentInfo.hookPath}`);
                    });
                    // Store the port in a file for CLI tools to find
                    if (process.env.NODE_ENV === 'production') {
                        const portFile = path.join(app.getPath('userData'), 'agent-session-events-bridge-port');
                        try {
                            require('fs').writeFileSync(portFile, this.port.toString());
                        }
                        catch (error) {
                            console.error('Failed to write port file:', error);
                        }
                    }
                    resolve();
                });
                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE' && retryCount < this.maxPortRetries) {
                        console.log(`Port ${this.port} is in use, trying ${this.port + 1}`);
                        this.port++;
                        retryCount++;
                        this.server = null;
                        tryListen();
                    }
                    else if (error.code === 'EADDRINUSE') {
                        reject(new Error(`Could not find available port after ${this.maxPortRetries} attempts (tried ports ${initialPort}-${this.port})`));
                    }
                    else {
                        reject(error);
                    }
                });
            };
            tryListen();
        });
    }
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('🔌 Agent Session Events Bridge stopped');
                    // Clean up port file
                    if (process.env.NODE_ENV === 'production') {
                        const portFile = path.join(app.getPath('userData'), 'agent-session-events-bridge-port');
                        try {
                            require('fs').unlinkSync(portFile);
                        }
                        catch (_error) {
                            // Ignore errors during cleanup
                        }
                    }
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    getPort() {
        return this.port;
    }
    getProviders() {
        return Array.from(this.recentEvents.keys());
    }
    getEventCount(provider) {
        if (provider) {
            return this.recentEvents.get(provider)?.length || 0;
        }
        let total = 0;
        this.recentEvents.forEach((events) => {
            total += events.length;
        });
        return total;
    }
    setupEventProcessorListeners() {
        // Common listener logic for broadcasting processed events
        const broadcastProcessedEvent = (processedEvent) => {
            BrowserWindow.getAllWindows().forEach((window) => {
                if (!window.isDestroyed()) {
                    try {
                        window.webContents.send('agent-session:processed-event', processedEvent);
                    }
                    catch (error) {
                        console.error('[Agent Session Events Bridge] Error broadcasting processed event:', error);
                    }
                }
            });
        };
        // Listen for processed events from V2
        this.eventProcessorV2.on('event-processed', broadcastProcessedEvent);
    }
    /**
     * Create a deterministic event key for deduplication
     */
    createEventKey(event) {
        // Extract key fields for creating a unique ID
        const sessionId = event.sessionId || 'unknown';
        const timestamp = event.timestamp;
        const data = event.data;
        const eventType = event.eventType || (data && typeof data === 'object' && 'hook_event_name' in data ? data.hook_event_name : undefined) || 'unknown';
        // Create a short hash of the event data to handle rapid events
        const dataHash = createHash('sha256')
            .update(JSON.stringify(event.data))
            .digest('hex')
            .substring(0, 8);
        // Format: event-{sessionId}-{timestamp}-{eventType}-{hash}
        return `event-${sessionId}-${timestamp}-${eventType}-${dataHash}`;
    }
    /**
     * Process events from a hook fallback file
     */
    async processFallbackFile(filePath, provider) {
        try {
            const fs = await import('fs/promises');
            console.log(`[Agent Session Events Bridge] Processing fallback file: ${filePath}`);
            // Read and parse the file
            const content = await fs.readFile(filePath, 'utf8');
            let rawEvents;
            try {
                rawEvents = JSON.parse(content);
                if (!Array.isArray(rawEvents)) {
                    throw new Error('Fallback file does not contain an array of events');
                }
            }
            catch (parseError) {
                console.error(`[Agent Session Events Bridge] Failed to parse fallback file:`, parseError);
                return {
                    success: false,
                    error: `Failed to parse JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
                };
            }
            console.log(`[Agent Session Events Bridge] Found ${rawEvents.length} events in fallback file`);
            // Group events by session ID for batch processing
            const sessionEventsMap = new Map();
            for (const rawEvent of rawEvents) {
                const sessionId = rawEvent.session_id || rawEvent.sessionId || 'unknown';
                if (!sessionEventsMap.has(sessionId)) {
                    sessionEventsMap.set(sessionId, []);
                }
                sessionEventsMap.get(sessionId).push(rawEvent);
            }
            console.log(`[Agent Session Events Bridge] Found ${sessionEventsMap.size} unique sessions in fallback file`);
            let totalProcessed = 0;
            let totalStored = 0;
            // Process each session using BatchEventReprocessor
            const batchProcessor = new BatchEventReprocessor();
            const storageManager = await getTypedStorageManagerInstance();
            for (const [sessionId, sessionEvents] of sessionEventsMap) {
                try {
                    // Store raw events first
                    for (const rawEvent of sessionEvents) {
                        const event = {
                            provider,
                            timestamp: rawEvent.timestamp || Date.now(),
                            sessionId,
                            eventType: rawEvent.hook_event_name || rawEvent.eventType || 'unknown',
                            data: rawEvent
                        };
                        // Store raw event
                        await this.storeEvent(event);
                        totalStored++;
                    }
                    // Prepare events for batch processing
                    const eventsForBatch = sessionEvents.map(data => ({
                        provider,
                        data
                    }));
                    // Use BatchEventReprocessor to process all events for this session
                    const sessionData = await batchProcessor.reprocessSessionBatch(sessionId, eventsForBatch, (current, total) => {
                        // Progress callback - could emit events if needed
                        if (current % 100 === 0) {
                            console.log(`[Agent Session Events Bridge] Processing session ${sessionId}: ${current}/${total} events`);
                        }
                    });
                    // Store the processed session data
                    await storageManager.set(sessionId, sessionData, StaticNamespaces.AGENT_SESSIONS);
                    totalProcessed += sessionData.totalEvents;
                    console.log(`[Agent Session Events Bridge] Processed session ${sessionId} with ${sessionData.totalEvents} events`);
                }
                catch (error) {
                    console.error(`[Agent Session Events Bridge] Failed to process session ${sessionId}:`, error);
                    // Continue with other sessions
                }
            }
            // Delete the file after successful processing
            await fs.unlink(filePath);
            console.log(`[Agent Session Events Bridge] Fallback file processing complete. Stored: ${totalStored}, Processed: ${totalProcessed}`);
            console.log(`[Agent Session Events Bridge] Deleted processed file: ${filePath}`);
            return {
                success: true,
                processedCount: totalProcessed,
                storedCount: totalStored
            };
        }
        catch (error) {
            console.error(`[Agent Session Events Bridge] Error processing fallback file:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Auto-process fallback files on startup
     */
    async autoProcessFallbackFiles() {
        try {
            console.log('[Agent Session Events Bridge] Checking for fallback files to auto-process...');
            const hookManager = HookConfigurationManager.getInstance();
            // Get statistics first to log what we're looking at
            const statsResult = await hookManager.getFallbackStats();
            if (statsResult.success && statsResult.stats) {
                console.log(`[Agent Session Events Bridge] Fallback directory: ${statsResult.stats.directory}`);
                console.log(`[Agent Session Events Bridge] Directory exists: ${statsResult.stats.exists}`);
                if (statsResult.stats.exists) {
                    for (const agentStat of statsResult.stats.agents) {
                        if (agentStat.hasFile) {
                            console.log(`[Agent Session Events Bridge] ${agentStat.agent}: ${agentStat.eventCount} events (${agentStat.fileSize} bytes)`);
                        }
                    }
                }
            }
            // Read all fallback events
            const readResult = await hookManager.readFallbackEvents();
            if (!readResult.success) {
                console.error('[Agent Session Events Bridge] Failed to read fallback events:', readResult.error);
                return;
            }
            if (!readResult.events || readResult.events.length === 0) {
                console.log('[Agent Session Events Bridge] No fallback files with events found');
                return;
            }
            let totalProcessed = 0;
            let totalFiles = 0;
            // Process each agent's events
            for (const agentEvents of readResult.events) {
                console.log(`[Agent Session Events Bridge] Processing ${agentEvents.events.length} events for ${agentEvents.agent}`);
                const result = await this.processFallbackFile(agentEvents.filePath, agentEvents.agent);
                if (result.success) {
                    totalProcessed += result.processedCount || 0;
                    totalFiles++;
                    // Clear the processed file (backs it up first)
                    const clearResult = await hookManager.clearFallbackFile(agentEvents.filePath);
                    if (clearResult.success) {
                        console.log(`[Agent Session Events Bridge] Cleared fallback file, backup at: ${clearResult.backupPath}`);
                    }
                }
            }
            if (totalFiles > 0) {
                console.log(`[Agent Session Events Bridge] Auto-processed ${totalFiles} fallback files with ${totalProcessed} events`);
                // Notify any interested windows
                BrowserWindow.getAllWindows().forEach((window) => {
                    window.webContents.send('agent-session-events:fallback-files-processed', {
                        filesProcessed: totalFiles,
                        eventsProcessed: totalProcessed
                    });
                });
            }
        }
        catch (error) {
            console.error('[Agent Session Events Bridge] Error during auto-processing fallback files:', error);
        }
    }
}
