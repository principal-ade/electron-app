import { ipcMain } from 'electron';
import { SupportedAgent, ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor } from "@principal-ai/agent-monitoring";
import { PathNormalizer } from './PathNormalizer';
import { repositoryCache } from '../stores/RepositoryCache';
import os from 'os';
/**
 * Helper function to extract file paths from event tool inputs
 */
function extractFilePathsFromEvent(event) {
    const paths = [];
    if (!event.toolInput || typeof event.toolInput !== 'object') {
        return paths;
    }
    const input = event.toolInput;
    // Common file path properties across different tools
    const pathProperties = ['file_path', 'filePath', 'path', 'fileName', 'filename'];
    for (const prop of pathProperties) {
        if (typeof input[prop] === 'string') {
            paths.push(input[prop]);
        }
    }
    // Handle arrays of paths
    if (Array.isArray(input.files)) {
        paths.push(...input.files.filter((f) => typeof f === 'string'));
    }
    if (Array.isArray(input.paths)) {
        paths.push(...input.paths.filter((p) => typeof p === 'string'));
    }
    return paths;
}
/**
 * Test handler for processing single events
 * This allows testing the normalization logic without storing events
 * This should be reusing functionlaity not writing itss own.
 */
export function registerEventProcessingTestHandlers() {
    // Create processors for each agent
    const processors = new Map([
        [SupportedAgent.CLAUDE, new ClaudeEventProcessor()],
        [SupportedAgent.GEMINI, new GeminiEventProcessor()],
        [SupportedAgent.OPENCODE, new OpenCodeEventProcessor()]
    ]);
    // Create path normalizer
    const pathNormalizer = new PathNormalizer({
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
                console.error('[Test] Error finding repository:', error);
            }
            return null;
        }
    });
    ipcMain.handle('test:process-event', async (_, agent, rawEvent) => {
        try {
            console.log('[Test] Processing event for agent:', agent);
            console.log('[Test] Raw event:', rawEvent);
            // Get the appropriate processor
            const processor = processors.get(agent);
            if (!processor) {
                return {
                    success: false,
                    error: `No processor found for agent: ${agent}`
                };
            }
            // Normalize the event
            const normalizedEvent = processor.normalize(rawEvent);
            console.log('[Test] Normalized event (before enrichment):', normalizedEvent);
            // Enrich with path normalization
            const enrichedEvent = await enrichEventWithPaths(normalizedEvent, pathNormalizer);
            console.log('[Test] Enriched event (after path normalization):', enrichedEvent);
            return {
                success: true,
                data: enrichedEvent
            };
        }
        catch (error) {
            console.error('[Test] Error processing event:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    });
}
/**
 * Enrich event with normalized paths (simplified version of the real processor)
 */
async function enrichEventWithPaths(event, pathNormalizer) {
    // Skip if no working directory
    if (!event.workingDirectory) {
        return event;
    }
    // Determine normalized working directory by checking if in a repository
    try {
        // Create a dummy file path to test if working directory is in a repo
        const testPath = event.workingDirectory + '/dummy';
        const normalizedPath = await pathNormalizer.normalizePath(testPath, event.workingDirectory);
        if (normalizedPath.repository) {
            event.normalizedWorkingDirectory = normalizedPath.repository.gitRoot;
        }
        else {
            event.normalizedWorkingDirectory = event.workingDirectory;
        }
    }
    catch (_error) {
        // If normalization fails, use the original working directory
        event.normalizedWorkingDirectory = event.workingDirectory;
    }
    // Process paths if this is a tool event with file inputs
    if (event.eventType === 'pre-tool-use' || event.eventType === 'post-tool-use') {
        const filePaths = extractFilePathsFromEvent(event);
        if (filePaths.length > 0) {
            try {
                const normalizedFiles = await pathNormalizer.normalizePaths(filePaths, event.workingDirectory);
                event.files = normalizedFiles;
            }
            catch (error) {
                // If path normalization fails, continue without setting files
                console.warn('Failed to normalize paths for event:', error);
            }
        }
    }
    return event;
}
