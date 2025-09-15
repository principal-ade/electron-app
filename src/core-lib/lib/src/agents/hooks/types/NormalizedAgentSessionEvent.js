/**
 * Normalized event structure for all agent session events
 * This provides a consistent interface across different agents (Claude, Gemini, OpenCode, etc.)
 */
/**
 * Type guard to check if an object is a normalized event
 */
export function isNormalizedAgentSessionEvent(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const event = obj;
    return (typeof event.eventType === 'string' &&
        typeof event.sessionId === 'string' &&
        typeof event.workingDirectory === 'string' &&
        typeof event.timestamp === 'number' &&
        typeof event.provider === 'string' &&
        event.raw !== undefined);
}
/**
 * Helper to determine if an event is a tool event
 */
export function isToolEvent(event) {
    return event.eventType === 'pre-tool-use' || event.eventType === 'post-tool-use';
}
/**
 * Helper to determine if an event is a stop event
 */
export function isStopEvent(event) {
    return event.eventType === 'stop' || event.eventType === 'subagent-stop';
}
/**
 * Helper to extract file path from tool input (if applicable)
 */
export function extractFilePath(event) {
    if (!isToolEvent(event) || !event.toolInput)
        return undefined;
    const input = event.toolInput;
    // Common file path properties across different tools
    return (input.file_path || input.filePath || input.path || input.fileName || input.filename || undefined);
}
//# sourceMappingURL=NormalizedAgentSessionEvent.js.map