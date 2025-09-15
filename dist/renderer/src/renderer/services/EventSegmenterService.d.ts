/**
 * EventSegmenterService - Groups session events by todos or stop events
 * Provides meaningful segmentation for event history visualization
 */
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
export interface TodoInfo {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}
export interface EventSegment {
    type: 'todo' | 'stop' | 'orphaned' | 'setup';
    todoInfo?: TodoInfo;
    startIndex: number;
    endIndex: number;
    events: NormalizedAgentSessionEvent[];
    timestamp: number;
    summary: string;
    stats: {
        duration: number;
        toolCounts: Record<string, number>;
        filesAccessed: string[];
        fileWrites: string[];
    };
}
export type SegmentationMode = 'todo' | 'stop' | 'hybrid';
export declare class EventSegmenterService {
    /**
     * Main segmentation method - choose strategy based on mode
     */
    segmentEvents(events: NormalizedAgentSessionEvent[], mode?: SegmentationMode): EventSegment[];
    /**
     * Segment events based on todo transitions
     */
    private segmentByTodos;
    /**
     * Segment events based on stop events
     */
    private segmentByStops;
    /**
     * Hybrid segmentation - combines todo and stop events
     */
    private segmentHybrid;
    /**
     * Create a segment with computed statistics
     */
    private createSegment;
    /**
     * Compute statistics for a segment
     */
    private computeStats;
    /**
     * Generate a human-readable summary for a segment
     */
    private generateSummary;
    /**
     * Get the most frequently used tool in a set of events
     */
    private getMostUsedTool;
    /**
     * Get a color for segment type (for UI)
     */
    getSegmentColor(type: EventSegment['type']): string;
    /**
     * Get an icon name for segment type (for UI)
     */
    getSegmentIcon(type: EventSegment['type']): string;
}
export declare const eventSegmenter: EventSegmenterService;
//# sourceMappingURL=EventSegmenterService.d.ts.map