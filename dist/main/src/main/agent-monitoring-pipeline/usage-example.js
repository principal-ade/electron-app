/**
 * Example usage of the AgentEventPipeline
 *
 * This shows how to integrate the pipeline into the existing
 * AgentSessionEventProcessor with minimal changes.
 */
import * as path from 'path';
import * as os from 'os';
import { AgentEventPipeline } from './AgentEventPipeline';
import { EventMigrationHelper } from './EventMigrationHelper';
/**
 * Node.js implementation of the PathNormalizationAdapter
 * This is what we provide to the pipeline
 */
class NodePathNormalizationAdapter {
    findRepositoryRoot;
    constructor(findRepositoryRoot) {
        this.findRepositoryRoot = findRepositoryRoot;
    }
    async getRawRepositoryInfo(absolutePath) {
        return this.findRepositoryRoot(absolutePath);
    }
    getSystemInfo() {
        return {
            homeDir: os.homedir(),
            pathSeparator: path.sep,
            platform: process.platform,
        };
    }
    resolvePath(relativePath, workingDirectory) {
        return path.resolve(workingDirectory, relativePath);
    }
    isAbsolutePath(filePath) {
        return path.isAbsolute(filePath);
    }
    getRelativePath(fromPath, toPath) {
        return path.relative(fromPath, toPath);
    }
    isAvailable() {
        return true;
    }
}
/**
 * Example integration into existing AgentSessionEventProcessor
 */
export class UpdatedAgentSessionEventProcessor {
    pipeline;
    migrationHelper = EventMigrationHelper;
    constructor(findRepositoryRoot) {
        // Create the adapter with our repository finding function
        const adapter = new NodePathNormalizationAdapter(findRepositoryRoot);
        // Create the pipeline with optional metrics
        this.pipeline = new AgentEventPipeline(adapter, {
            logErrors: true,
            metrics: {
                onEventProcessed: (event, durationMs, agent) => {
                    console.log(`Processed ${agent} event in ${durationMs}ms`);
                },
                onError: (error, context) => {
                    console.error(`Pipeline error at ${context.step}:`, error.message);
                },
            },
        });
    }
    /**
     * Process raw event - new implementation using pipeline
     */
    async processRawEvent(provider, rawData) {
        // Use the pipeline to process
        const normalizedEvent = await this.pipeline.processRawEvent(provider, rawData);
        // Convert to old format for UI compatibility (temporary during migration)
        const oldFormatEvent = this.migrationHelper.fromRepoNormalizedFormat(normalizedEvent);
        // Store and emit as before
        await this.storeNormalizedEvent(oldFormatEvent);
        this.emit('event-processed', oldFormatEvent);
        return oldFormatEvent;
    }
    /**
     * Batch processing example
     */
    async reprocessEvents(events) {
        const results = await this.pipeline.processEventBatch(events);
        // Handle results
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        console.log(`Processed ${successful.length} events successfully`);
        if (failed.length > 0) {
            console.error(`Failed to process ${failed.length} events`);
        }
        return results;
    }
    // Placeholder methods for the example
    async storeNormalizedEvent(event) {
        // Storage logic here
    }
    emit(eventName, data) {
        // Event emitter logic here
    }
}
/**
 * Example with feature flag for gradual migration
 */
export class MigrationReadyEventProcessor {
    findRepositoryRoot;
    newPipeline;
    useNewPipeline;
    constructor(findRepositoryRoot, options = {}) {
        this.findRepositoryRoot = findRepositoryRoot;
        this.useNewPipeline = options.useNewPipeline ?? false;
        if (this.useNewPipeline) {
            const adapter = new NodePathNormalizationAdapter(findRepositoryRoot);
            this.newPipeline = new AgentEventPipeline(adapter);
        }
    }
    async processRawEvent(provider, rawData) {
        if (this.useNewPipeline && this.newPipeline) {
            // New path
            const event = await this.newPipeline.processRawEvent(provider, rawData);
            // Convert for compatibility if needed
            return EventMigrationHelper.fromRepoNormalizedFormat(event);
        }
        else {
            // Old path (existing implementation)
            return this.processRawEventLegacy(provider, rawData);
        }
    }
    async processRawEventLegacy(provider, rawData) {
        // Existing implementation
        throw new Error('Legacy implementation would go here');
    }
}
/**
 * Example metrics collection
 */
export function createPipelineWithMetrics(adapter) {
    const eventCounts = new Map();
    const errorCounts = new Map();
    return new AgentEventPipeline(adapter, {
        metrics: {
            onEventProcessed: (event, durationMs, agent) => {
                // Track event counts
                eventCounts.set(agent, (eventCounts.get(agent) || 0) + 1);
                // Log slow events
                if (durationMs > 100) {
                    console.warn(`Slow event processing: ${durationMs}ms for ${agent}`);
                }
                // Could send to monitoring service
                // telemetry.recordMetric('event.processed', { agent, duration: durationMs });
            },
            onError: (error, context) => {
                // Track error counts
                const key = `${context.agent}:${context.step}`;
                errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
                // Could send to error tracking
                // errorReporter.report(error, context);
            },
        },
    });
}
