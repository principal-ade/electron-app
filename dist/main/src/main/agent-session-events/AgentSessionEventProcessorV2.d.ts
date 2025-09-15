/**
 * AgentSessionEventProcessorV2 - New implementation using agent-monitoring pipeline
 *
 * This is a parallel implementation that uses the new AgentEventPipeline
 * while maintaining compatibility with existing storage and IPC interfaces.
 */
import { EventEmitter } from 'events';
import { SupportedAgent, NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
/**
 * V2 Event Processor using the new pipeline
 */
export declare class AgentSessionEventProcessorV2 extends EventEmitter {
    private pipeline;
    private eventQueue;
    private processedEventCount;
    private errorCount;
    private observability;
    constructor();
    /**
     * Initialize observability integration
     */
    private initializeObservability;
    /**
     * Process a raw event from a hook using the new pipeline
     */
    processRawEvent(provider: SupportedAgent, rawData: unknown): Promise<NormalizedAgentSessionEvent>;
    /**
     * Log important events (same as V1)
     */
    private logEvent;
    /**
     * Store normalized event in AGENT_SESSIONS namespace
     * Uses EventQueue to serialize writes per session and prevent race conditions
     * (Identical to V1 implementation for compatibility)
     */
    private storeNormalizedEvent;
    /**
     * Emit session created event to notify UI
     */
    private emitSessionCreatedEvent;
    /**
     * Emit session updated event to notify UI
     */
    private emitSessionUpdatedEvent;
    /**
     * Test-only method: Process event through pipeline without storing or emitting
     * Used for parallel testing to validate the pipeline works
     */
    processRawEventTestOnly(provider: SupportedAgent, rawData: unknown): Promise<NormalizedAgentSessionEvent>;
    /**
     * Get statistics about processed events
     */
    getStats(): {
        processedEvents: number;
        errors: number;
        pipelineInfo: {
            supportedAgents: SupportedAgent[];
            hasPathNormalization: boolean;
            hasMetrics: boolean;
        };
        observability: {
            isInitialized: boolean;
            eventCount: number;
            errorCount: number;
            errorRate: number;
        } | undefined;
    };
    /**
     * Shutdown the event processor and observability
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=AgentSessionEventProcessorV2.d.ts.map