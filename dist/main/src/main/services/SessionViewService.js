/**
 * Segment represents a group of related events in a session
 */
// export interface SessionSegment {
//   ... moved to shared/sessionViewTypes
// }
/**
 * Session view with segments and statistics
 */
// export interface SessionView {
//   ... moved to shared/sessionViewTypes
// }
/**
 * Service for generating session views from normalized events
 */
export class SessionViewService {
    static SEGMENT_IDLE_THRESHOLD_MS = 30000; // 30 seconds of inactivity creates new segment
    static MIN_SEGMENT_SIZE = 3; // Minimum events to form a segment
    /**
     * Generate a session view with segments from processed session data
     */
    static generateSessionView(sessionData) {
        const segments = this.createSegments(sessionData.events);
        // Calculate overall statistics
        const allFileAccesses = new Set();
        const allFileWrites = new Set();
        let totalToolCalls = 0;
        let totalWebAccesses = 0;
        for (const event of sessionData.events) {
            if (event.eventType === 'pre-tool-use' && event.toolName) {
                if (this.isFileReadTool(event.toolName)) {
                    const filePath = this.extractFilePath(event);
                    if (filePath)
                        allFileAccesses.add(filePath);
                }
                else if (this.isFileWriteTool(event.toolName)) {
                    const filePath = this.extractFilePath(event);
                    if (filePath)
                        allFileWrites.add(filePath);
                }
                else if (this.isWebAccessTool(event.toolName)) {
                    totalWebAccesses++;
                }
                totalToolCalls++;
            }
        }
        return {
            sessionId: sessionData.sessionId,
            provider: sessionData.provider,
            workingDirectory: sessionData.workingDirectory,
            normalizedWorkingDirectory: sessionData.events[0]?.normalizedWorkingDirectory,
            startTime: sessionData.startTime,
            endTime: sessionData.lastUpdateTime,
            duration: sessionData.lastUpdateTime - sessionData.startTime,
            segments,
            totalEvents: sessionData.totalEvents,
            uniqueFilesAccessed: allFileAccesses.size,
            uniqueFilesModified: allFileWrites.size,
            totalToolCalls,
            totalWebAccesses,
            repositoriesAccessed: sessionData.repositoriesAccessed,
        };
    }
    /**
     * Create segments from a list of events based on time gaps and activity patterns
     */
    static createSegments(events) {
        if (events.length === 0)
            return [];
        const segments = [];
        let currentSegmentEvents = [];
        let lastEventTime = events[0].timestamp;
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const timeSinceLast = event.timestamp - lastEventTime;
            // Start new segment if:
            // 1. Too much time has passed since last event
            // 2. Current segment is getting too large (>100 events)
            if (timeSinceLast > this.SEGMENT_IDLE_THRESHOLD_MS || currentSegmentEvents.length > 100) {
                if (currentSegmentEvents.length >= this.MIN_SEGMENT_SIZE) {
                    segments.push(this.createSegmentFromEvents(currentSegmentEvents));
                }
                currentSegmentEvents = [event];
            }
            else {
                currentSegmentEvents.push(event);
            }
            lastEventTime = event.timestamp;
        }
        // Add final segment
        if (currentSegmentEvents.length > 0) {
            segments.push(this.createSegmentFromEvents(currentSegmentEvents));
        }
        return segments;
    }
    /**
     * Create a segment summary from a group of events
     */
    static createSegmentFromEvents(events) {
        const fileAccesses = new Map();
        const fileWrites = new Map();
        const toolCalls = new Map();
        const webAccesses = [];
        for (const event of events) {
            if (event.eventType === 'pre-tool-use' && event.toolName) {
                // Track tool usage
                toolCalls.set(event.toolName, (toolCalls.get(event.toolName) || 0) + 1);
                // Categorize by tool type
                if (this.isFileReadTool(event.toolName)) {
                    const filePath = this.extractFilePath(event);
                    if (filePath) {
                        fileAccesses.set(filePath, (fileAccesses.get(filePath) || 0) + 1);
                    }
                }
                else if (this.isFileWriteTool(event.toolName)) {
                    const filePath = this.extractFilePath(event);
                    if (filePath) {
                        fileWrites.set(filePath, (fileWrites.get(filePath) || 0) + 1);
                    }
                }
                else if (this.isWebAccessTool(event.toolName)) {
                    const url = this.extractUrl(event);
                    if (url)
                        webAccesses.push(url);
                }
            }
        }
        // Determine primary activity
        let primaryActivity = 'mixed';
        if (fileWrites.size > fileAccesses.size && fileWrites.size > webAccesses.length) {
            primaryActivity = 'file-writing';
        }
        else if (fileAccesses.size > fileWrites.size && fileAccesses.size > webAccesses.length) {
            primaryActivity = 'file-reading';
        }
        else if (webAccesses.length > fileAccesses.size && webAccesses.length > fileWrites.size) {
            primaryActivity = 'web-research';
        }
        else if (toolCalls.size > 0) {
            primaryActivity = 'tool-usage';
        }
        // Generate description
        const description = this.generateSegmentDescription(primaryActivity, fileAccesses, fileWrites, webAccesses, toolCalls);
        return {
            id: `segment-${events[0].timestamp}`,
            startTime: events[0].timestamp,
            endTime: events[events.length - 1].timestamp,
            events,
            fileAccesses,
            fileWrites,
            toolCalls,
            webAccesses,
            primaryActivity,
            description,
        };
    }
    /**
     * Generate a human-readable description of the segment
     */
    static generateSegmentDescription(primaryActivity, fileAccesses, fileWrites, webAccesses, toolCalls) {
        const parts = [];
        if (fileAccesses.size > 0) {
            parts.push(`Read ${fileAccesses.size} file${fileAccesses.size !== 1 ? 's' : ''}`);
        }
        if (fileWrites.size > 0) {
            parts.push(`Modified ${fileWrites.size} file${fileWrites.size !== 1 ? 's' : ''}`);
        }
        if (webAccesses.length > 0) {
            parts.push(`${webAccesses.length} web access${webAccesses.length !== 1 ? 'es' : ''}`);
        }
        if (toolCalls.size > 0) {
            const totalCalls = Array.from(toolCalls.values()).reduce((sum, count) => sum + count, 0);
            parts.push(`${totalCalls} tool call${totalCalls !== 1 ? 's' : ''}`);
        }
        if (parts.length === 0) {
            return 'Session activity';
        }
        return parts.join(', ');
    }
    /**
     * Extract file path from event
     */
    static extractFilePath(event) {
        if (!event.toolInput)
            return null;
        const input = event.toolInput;
        return input.file_path || input.filePath || input.path || input.filename || null;
    }
    /**
     * Extract URL from event
     */
    static extractUrl(event) {
        if (!event.toolInput)
            return null;
        const input = event.toolInput;
        return input.url || input.uri || input.link || null;
    }
    /**
     * Check if a tool is a file reading tool
     */
    static isFileReadTool(toolName) {
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
    static isFileWriteTool(toolName) {
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
    static isWebAccessTool(toolName) {
        const webTools = new Set([
            'WebFetch', 'webfetch', 'web_fetch',
            'WebSearch', 'websearch', 'web_search',
            'get_url', 'GetUrl'
        ]);
        return webTools.has(toolName);
    }
}
