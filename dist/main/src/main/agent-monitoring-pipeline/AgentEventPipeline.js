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
import { SupportedAgent, ClaudeEventProcessor, GeminiEventProcessor, OpenCodeEventProcessor, PathNormalizationService, } from '@principal-ai/agent-monitoring';
/**
 * Main pipeline class for processing agent events
 */
export class AgentEventPipeline {
    processors;
    pathService;
    options;
    constructor(adapter, options = {}) {
        this.options = {
            logErrors: true,
            ...options,
        };
        // Initialize processors (use custom if provided)
        this.processors = options.customProcessors || this.createDefaultProcessors();
        // Initialize path normalization service
        this.pathService = new PathNormalizationService(adapter);
    }
    /**
     * Create default processors for each agent
     */
    createDefaultProcessors() {
        const processors = new Map();
        processors.set(SupportedAgent.CLAUDE, new ClaudeEventProcessor());
        processors.set(SupportedAgent.GEMINI, new GeminiEventProcessor());
        processors.set(SupportedAgent.OPENCODE, new OpenCodeEventProcessor());
        return processors;
    }
    /**
     * Process a single raw event through the complete pipeline
     */
    async processRawEvent(agent, rawData) {
        const startTime = Date.now();
        try {
            // Step 1: Get the appropriate processor
            const processor = this.processors.get(agent);
            if (!processor) {
                throw new Error(`No processor available for agent: ${agent}`);
            }
            // Step 2: Agent-specific normalization
            let universalEvent;
            try {
                universalEvent = processor.normalize(rawData);
            }
            catch (error) {
                const wrappedError = new Error(`Failed to normalize ${agent} event: ${error.message}`);
                this.handleError(wrappedError, { agent, step: 'normalization', rawData });
                throw wrappedError;
            }
            // Step 3: Ensure provider is set
            universalEvent.provider = universalEvent.provider || agent;
            // Step 4: Path normalization
            let normalizedEvent;
            try {
                normalizedEvent = await this.pathService.normalizePaths(universalEvent);
            }
            catch (error) {
                const wrappedError = new Error(`Failed to normalize paths: ${error.message}`);
                this.handleError(wrappedError, { agent, step: 'path-normalization' });
                throw wrappedError;
            }
            // Step 5: Report metrics if configured
            const durationMs = Date.now() - startTime;
            if (this.options.metrics?.onEventProcessed) {
                this.options.metrics.onEventProcessed(normalizedEvent, durationMs, agent);
            }
            return normalizedEvent;
        }
        catch (error) {
            // Error already logged in specific catch blocks
            throw error;
        }
    }
    /**
     * Process a batch of events
     * Returns results for each event, including failures
     */
    async processEventBatch(events) {
        const results = await Promise.allSettled(events.map((e) => this.processRawEventSafe(e.agent, e.rawData)));
        return results.map((result) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            else {
                return {
                    success: false,
                    error: result.reason,
                    durationMs: 0,
                };
            }
        });
    }
    /**
     * Process event with error catching (returns result object instead of throwing)
     */
    async processRawEventSafe(agent, rawData) {
        const startTime = Date.now();
        try {
            const event = await this.processRawEvent(agent, rawData);
            return {
                success: true,
                event,
                durationMs: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error,
                durationMs: Date.now() - startTime,
            };
        }
    }
    /**
     * Handle errors based on configuration
     */
    handleError(error, context) {
        if (this.options.metrics?.onError) {
            this.options.metrics.onError(error, context);
        }
        if (this.options.logErrors) {
            console.error('[AgentEventPipeline] Error:', error.message, {
                agent: context.agent,
                step: context.step,
            });
        }
    }
    /**
     * Update options after construction
     */
    setOptions(options) {
        this.options = { ...this.options, ...options };
    }
    /**
     * Get information about the pipeline configuration
     */
    getInfo() {
        return {
            supportedAgents: Array.from(this.processors.keys()),
            hasPathNormalization: true,
            hasMetrics: !!this.options.metrics,
        };
    }
}
