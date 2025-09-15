/**
 * ObservabilityIntegration - Connects RepoEvents from the event pipeline to the @a24z/observability-sdk
 *
 * This module integrates the agent monitoring pipeline with the observability SDK,
 * forwarding RepoNormalized events for centralized monitoring and analytics.
 */
import { EventEmitter } from 'events';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
interface ObservabilityConfig {
    apiKey?: string;
    endpoint?: string;
    databaseUrl?: string;
    environment?: 'development' | 'staging' | 'production';
    batchSize?: number;
    flushInterval?: number;
    debug?: boolean;
}
export declare class ObservabilityIntegration extends EventEmitter {
    private sdk;
    private isInitialized;
    private eventCount;
    private errorCount;
    constructor(config?: ObservabilityConfig);
    /**
     * Initialize the SDK and start processing events
     */
    initialize(): Promise<void>;
    /**
     * Process a RepoNormalized event from the pipeline
     */
    processRepoEvent(event: RepoNormalizedUniversalAgentSessionEvent): Promise<void>;
    /**
     * Flush any pending events
     */
    flush(): Promise<void>;
    /**
     * Shutdown the integration
     */
    shutdown(): Promise<void>;
    /**
     * Get statistics about the integration
     */
    getStats(): {
        isInitialized: boolean;
        eventCount: number;
        errorCount: number;
        errorRate: number;
    };
}
/**
 * Get or create the singleton observability integration
 */
export declare function getObservabilityIntegration(config?: ObservabilityConfig): ObservabilityIntegration;
export {};
//# sourceMappingURL=ObservabilityIntegration.d.ts.map