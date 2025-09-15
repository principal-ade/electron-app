/**
 * Agent Event Processing Pipeline
 *
 * This is a proposed implementation for the @principal-ai/agent-monitoring library.
 * Currently implemented locally for testing, but designed to be moved to the library.
 *
 * This class orchestrates the complete event processing pipeline:
 * 1. Raw event data from agents
 * 2. Agent-specific normalization
 * 3. Path normalization with repository context
 * 4. Final normalized event output
 */
import { SupportedAgent, AgentEventProcessor, RepoNormalizedUniversalAgentSessionEvent, PathNormalizationAdapter } from '@principal-ai/agent-monitoring';
export interface PipelineOptions {
    /**
     * Optional metrics collector
     */
    metrics?: PipelineMetrics;
    /**
     * Custom processors for agents (useful for testing or extensions)
     */
    customProcessors?: Map<SupportedAgent, AgentEventProcessor>;
    /**
     * Whether to log errors to console
     */
    logErrors?: boolean;
}
export interface PipelineMetrics {
    /**
     * Called after successful event processing
     */
    onEventProcessed?: (event: RepoNormalizedUniversalAgentSessionEvent, durationMs: number, agent: SupportedAgent) => void;
    /**
     * Called when an error occurs
     */
    onError?: (error: Error, context: {
        agent: SupportedAgent;
        step: 'normalization' | 'path-normalization';
        rawData?: unknown;
    }) => void;
}
export interface ProcessingResult {
    success: boolean;
    event?: RepoNormalizedUniversalAgentSessionEvent;
    error?: Error;
    durationMs: number;
}
/**
 * Main pipeline class for processing agent events
 */
export declare class AgentEventPipeline {
    private processors;
    private pathService;
    private options;
    constructor(adapter: PathNormalizationAdapter, options?: PipelineOptions);
    /**
     * Create default processors for each agent
     */
    private createDefaultProcessors;
    /**
     * Process a single raw event through the complete pipeline
     */
    processRawEvent(agent: SupportedAgent, rawData: unknown): Promise<RepoNormalizedUniversalAgentSessionEvent>;
    /**
     * Process a batch of events
     * Returns results for each event, including failures
     */
    processEventBatch(events: Array<{
        agent: SupportedAgent;
        rawData: unknown;
    }>): Promise<ProcessingResult[]>;
    /**
     * Process event with error catching (returns result object instead of throwing)
     */
    processRawEventSafe(agent: SupportedAgent, rawData: unknown): Promise<ProcessingResult>;
    /**
     * Handle errors based on configuration
     */
    private handleError;
    /**
     * Update options after construction
     */
    setOptions(options: Partial<PipelineOptions>): void;
    /**
     * Get information about the pipeline configuration
     */
    getInfo(): {
        supportedAgents: SupportedAgent[];
        hasPathNormalization: boolean;
        hasMetrics: boolean;
    };
}
//# sourceMappingURL=AgentEventPipeline.d.ts.map