import { ProcessedSessionData } from '../storage-providers/typed-namespaces';
import type { SessionView } from '../../shared/sessionViewTypes';
/**
 * Segment represents a group of related events in a session
 */
/**
 * Session view with segments and statistics
 */
/**
 * Service for generating session views from normalized events
 */
export declare class SessionViewService {
    private static readonly SEGMENT_IDLE_THRESHOLD_MS;
    private static readonly MIN_SEGMENT_SIZE;
    /**
     * Generate a session view with segments from processed session data
     */
    static generateSessionView(sessionData: ProcessedSessionData): SessionView;
    /**
     * Create segments from a list of events based on time gaps and activity patterns
     */
    private static createSegments;
    /**
     * Create a segment summary from a group of events
     */
    private static createSegmentFromEvents;
    /**
     * Generate a human-readable description of the segment
     */
    private static generateSegmentDescription;
    /**
     * Extract file path from event
     */
    private static extractFilePath;
    /**
     * Extract URL from event
     */
    private static extractUrl;
    /**
     * Check if a tool is a file reading tool
     */
    private static isFileReadTool;
    /**
     * Check if a tool is a file writing tool
     */
    private static isFileWriteTool;
    /**
     * Check if a tool is a web access tool
     */
    private static isWebAccessTool;
}
//# sourceMappingURL=SessionViewService.d.ts.map