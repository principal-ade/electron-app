/**
 * Example usage of the AgentEventPipeline
 *
 * This shows how to integrate the pipeline into the existing
 * AgentSessionEventProcessor with minimal changes.
 */
import { PathNormalizationAdapter, RepositoryInfo, SupportedAgent } from '@principal-ai/agent-monitoring';
import { AgentEventPipeline } from './AgentEventPipeline';
/**
 * Example integration into existing AgentSessionEventProcessor
 */
export declare class UpdatedAgentSessionEventProcessor {
    private pipeline;
    private migrationHelper;
    constructor(findRepositoryRoot: (path: string) => Promise<RepositoryInfo | null>);
    /**
     * Process raw event - new implementation using pipeline
     */
    processRawEvent(provider: SupportedAgent, rawData: unknown): Promise<import("@principal-ai/agent-monitoring").NormalizedAgentSessionEvent>;
    /**
     * Batch processing example
     */
    reprocessEvents(events: Array<{
        agent: SupportedAgent;
        rawData: unknown;
    }>): Promise<import("./AgentEventPipeline").ProcessingResult[]>;
    private storeNormalizedEvent;
    private emit;
}
/**
 * Example with feature flag for gradual migration
 */
export declare class MigrationReadyEventProcessor {
    private findRepositoryRoot;
    private newPipeline?;
    private useNewPipeline;
    constructor(findRepositoryRoot: (path: string) => Promise<RepositoryInfo | null>, options?: {
        useNewPipeline?: boolean;
    });
    processRawEvent(provider: SupportedAgent, rawData: unknown): Promise<void | import("@principal-ai/agent-monitoring").NormalizedAgentSessionEvent>;
    private processRawEventLegacy;
}
/**
 * Example metrics collection
 */
export declare function createPipelineWithMetrics(adapter: PathNormalizationAdapter): AgentEventPipeline;
//# sourceMappingURL=usage-example.d.ts.map