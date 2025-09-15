/**
 * ObservabilityIntegration - Connects RepoEvents from the event pipeline to the @a24z/observability-sdk
 *
 * This module integrates the agent monitoring pipeline with the observability SDK,
 * forwarding RepoNormalized events for centralized monitoring and analytics.
 */
import { EventEmitter } from 'events';
import { ObservabilitySDK } from '@a24z/observability-sdk';
export class ObservabilityIntegration extends EventEmitter {
    sdk;
    isInitialized = false;
    eventCount = 0;
    errorCount = 0;
    constructor(config = {}) {
        super();
        const databaseUrl = "postgres://postgres.hdbuazqkffjfnsppeajp:I93y1CFdDngWRgT2@aws-1-us-west-1.pooler.supabase.com:6543/postgres?sslmode=no-verify&supa=base-pooler.x";
        //config.databaseUrl || process.env.OBSERVABILITY_DATABASE_URL || process.env.DATABASE_URL;
        if (!databaseUrl) {
            console.warn('[ObservabilityIntegration] No database URL provided, observability disabled');
            this.sdk = null;
            return;
        }
        // Initialize the observability SDK with the correct constructor signature
        this.sdk = new ObservabilitySDK(databaseUrl);
        console.log('[ObservabilityIntegration] Initialized with database URL');
    }
    /**
     * Initialize the SDK and start processing events
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        if (!this.sdk) {
            // No SDK available (no database URL provided)
            console.log('[ObservabilityIntegration] Skipping initialization - no database URL');
            return;
        }
        try {
            // The SDK doesn't have an initialize method, it's ready after construction
            this.isInitialized = true;
            console.log('[ObservabilityIntegration] SDK ready for event processing');
            this.emit('initialized');
        }
        catch (error) {
            console.error('[ObservabilityIntegration] Failed to initialize:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Process a RepoNormalized event from the pipeline
     */
    async processRepoEvent(event) {
        if (!this.isInitialized || !this.sdk) {
            return;
        }
        try {
            // Use the new processEvent method that routes to the appropriate table
            // The SDK will handle different event types automatically
            await this.sdk.processEvent(event);
            this.eventCount++;
            // Log progress periodically
            if (this.eventCount % 10 === 0) {
                console.log(`[ObservabilityIntegration] Processed ${this.eventCount} events`);
            }
            // Emit for monitoring
            this.emit('event-tracked', event);
        }
        catch (error) {
            this.errorCount++;
            console.error('[ObservabilityIntegration] Error processing event:', error);
            this.emit('error', error);
        }
    }
    /**
     * Flush any pending events
     */
    async flush() {
        // The SDK handles its own batching internally
        // No explicit flush method available
        console.log('[ObservabilityIntegration] Flush requested (handled internally by SDK)');
    }
    /**
     * Shutdown the integration
     */
    async shutdown() {
        if (!this.isInitialized || !this.sdk) {
            return;
        }
        try {
            await this.sdk.close();
            this.isInitialized = false;
            console.log(`[ObservabilityIntegration] Shutdown complete. Processed ${this.eventCount} tool calls, ${this.errorCount} errors`);
            this.emit('shutdown');
        }
        catch (error) {
            console.error('[ObservabilityIntegration] Error during shutdown:', error);
            this.emit('error', error);
        }
    }
    /**
     * Get statistics about the integration
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            eventCount: this.eventCount,
            errorCount: this.errorCount,
            errorRate: this.eventCount > 0 ? this.errorCount / this.eventCount : 0
        };
    }
}
// Singleton instance
let observabilityIntegration = null;
/**
 * Get or create the singleton observability integration
 */
export function getObservabilityIntegration(config) {
    if (!observabilityIntegration) {
        observabilityIntegration = new ObservabilityIntegration(config);
    }
    return observabilityIntegration;
}
