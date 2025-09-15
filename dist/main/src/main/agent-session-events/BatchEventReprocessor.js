import { SupportedAgent, ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor, } from "@principal-ai/agent-monitoring";
import { getTypedStorageManager } from '../storage-providers';
import { StaticNamespaces } from '../storage-providers/types';
import { repositoryCache } from '../stores/RepositoryCache';
import path from 'path';
/**
 * Optimized batch reprocessor for session events
 * Creates ProcessedSessionData with flat event list for efficient bulk operations
 */
export class BatchEventReprocessor {
    adapters;
    constructor() {
        // Initialize adapters
        this.adapters = new Map([
            [SupportedAgent.CLAUDE, new ClaudeEventProcessor()],
            [SupportedAgent.GEMINI, new GeminiEventProcessor()],
            [SupportedAgent.OPENCODE, new OpenCodeEventProcessor()]
        ]);
    }
    /**
     * Reprocess all events for a session in an optimized batch mode
     * Returns ProcessedSessionData with flat normalized event list
     */
    async reprocessSessionBatch(sessionId, events, onProgress) {
        const normalizedEvents = [];
        let workingDirectory = '';
        let provider = SupportedAgent.CLAUDE; // Will be overwritten
        let startTime = Number.MAX_SAFE_INTEGER;
        let lastUpdateTime = 0;
        // Repository tracking
        const repositoriesMap = new Map();
        // Pre-detect repositories for unique working directories to minimize lookups
        const uniqueWorkingDirs = new Set();
        for (const event of events) {
            const wd = event.data?.working_directory || event.data?.workingDirectory;
            if (wd)
                uniqueWorkingDirs.add(wd);
        }
        console.log(`[BatchReprocessor] Pre-detecting repositories for ${uniqueWorkingDirs.size} unique working directories`);
        // Batch detect repositories
        for (const wd of uniqueWorkingDirs) {
            try {
                const repoInfo = await repositoryCache.getRepositoryForPath(wd);
                if (repoInfo?.gitInfo.root && !repositoriesMap.has(repoInfo.gitInfo.root)) {
                    repositoriesMap.set(repoInfo.gitInfo.root, {
                        remoteUrl: repoInfo.repository.remoteUrl,
                        gitRoot: repoInfo.gitInfo.root
                    });
                    console.log(`[BatchReprocessor] Pre-cached repository: ${repoInfo.gitInfo.root}`);
                }
            }
            catch (_error) {
                // Skip if detection fails
            }
        }
        console.log(`[BatchReprocessor] Pre-cached ${repositoriesMap.size} repositories`);
        // Process all events and normalize them
        for (let i = 0; i < events.length; i++) {
            const eventData = events[i];
            try {
                // Get adapter
                const adapter = this.adapters.get(eventData.provider);
                if (!adapter) {
                    console.warn(`[BatchReprocessor] No adapter for provider: ${eventData.provider}`);
                    continue;
                }
                // Normalize event
                const normalizedEvent = adapter.normalize(eventData.data);
                // Enrich with normalized working directory
                await this.enrichEventWithGitRoot(normalizedEvent, repositoriesMap);
                normalizedEvents.push(normalizedEvent);
                // Track session metadata
                if (!workingDirectory && normalizedEvent.workingDirectory) {
                    workingDirectory = normalizedEvent.workingDirectory;
                }
                provider = normalizedEvent.provider;
                startTime = Math.min(startTime, normalizedEvent.timestamp);
                lastUpdateTime = Math.max(lastUpdateTime, normalizedEvent.timestamp);
            }
            catch (_error) {
                // Skip failed events but continue processing
                console.warn(`[BatchReprocessor] Failed to normalize event: ${_error}`);
            }
            // Report progress
            if (onProgress && (i + 1) % 10 === 0) {
                onProgress(i + 1, events.length);
            }
        }
        // Final progress
        if (onProgress) {
            onProgress(events.length, events.length);
        }
        // Fix startTime if no events were processed
        if (startTime === Number.MAX_SAFE_INTEGER) {
            startTime = Date.now();
        }
        // Calculate counters from normalized events
        const counters = this.calculateCounters(normalizedEvents);
        // Convert repository map to array
        const repositoriesAccessed = Array.from(repositoriesMap.values());
        // Create ProcessedSessionData
        const sessionData = {
            sessionId,
            provider,
            workingDirectory,
            startTime,
            lastUpdateTime,
            events: normalizedEvents,
            totalEvents: normalizedEvents.length,
            repositoriesAccessed,
            counters
        };
        return sessionData;
    }
    /**
     * Store the processed session data using type-safe store
     */
    async storeProcessedSession(sessionData) {
        const typedStore = await getTypedStorageManager();
        const result = await typedStore.set(sessionData.sessionId, sessionData, StaticNamespaces.AGENT_SESSIONS);
        if (!result.success) {
            throw new Error(`Failed to store reprocessed session: ${result.error?.message}`);
        }
        console.log(`[BatchReprocessor] Stored reprocessed session ${sessionData.sessionId} with ${sessionData.totalEvents} events`);
    }
    /**
     * Enrich event with normalized working directory during batch processing
     * Also updates repository tracking
     */
    async enrichEventWithGitRoot(event, repositoriesMap) {
        // Check if working directory is in a known repository
        // Normalize paths for comparison (handle both forward and backward slashes)
        const normalizedWorkingDir = path.normalize(event.workingDirectory);
        const knownRepo = Array.from(repositoriesMap.values()).find(repo => {
            const normalizedGitRoot = path.normalize(repo.gitRoot);
            // Check if working directory is the git root or a subdirectory of it
            return normalizedWorkingDir === normalizedGitRoot ||
                normalizedWorkingDir.startsWith(normalizedGitRoot + path.sep);
        });
        if (knownRepo) {
            event.normalizedWorkingDirectory = knownRepo.gitRoot;
            return;
        }
        // Not in a known repo, need to detect
        try {
            const repoInfo = await repositoryCache.getRepositoryForPath(event.workingDirectory);
            if (repoInfo?.gitInfo.root) {
                event.normalizedWorkingDirectory = repoInfo.gitInfo.root;
                // Add to repository map if not already there
                if (!repositoriesMap.has(repoInfo.gitInfo.root)) {
                    repositoriesMap.set(repoInfo.gitInfo.root, {
                        remoteUrl: repoInfo.repository.remoteUrl,
                        gitRoot: repoInfo.gitInfo.root
                    });
                    console.log(`[BatchReprocessor] Repository detected: ${repoInfo.gitInfo.root} -> ${repoInfo.repository.remoteUrl}`);
                    // Update repository last accessed time
                    await repositoryCache.updateRepositoryAccess(repoInfo.repository.remoteUrl);
                }
            }
            else {
                // Not in a git repo
                event.normalizedWorkingDirectory = event.workingDirectory;
            }
        }
        catch (_error) {
            // Git detection failed
            event.normalizedWorkingDirectory = event.workingDirectory;
            console.debug(`[BatchReprocessor] No repository found for ${event.workingDirectory}`);
        }
    }
    /**
     * Calculate counters from normalized events
     */
    calculateCounters(events) {
        const counters = {
            fileAccesses: 0,
            fileWrites: 0,
            toolCalls: 0,
            webAccesses: 0
        };
        for (const event of events) {
            if (event.eventType === 'pre-tool-use') {
                counters.toolCalls++;
                if (event.toolName) {
                    // Use the same tool classification as AgentSessionEventProcessor
                    if (this.isFileReadTool(event.toolName)) {
                        counters.fileAccesses++;
                    }
                    else if (this.isFileWriteTool(event.toolName)) {
                        counters.fileWrites++;
                    }
                    else if (this.isWebAccessTool(event.toolName)) {
                        counters.webAccesses++;
                    }
                }
            }
        }
        return counters;
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
}
