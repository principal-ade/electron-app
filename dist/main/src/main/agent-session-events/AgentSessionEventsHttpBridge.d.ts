import { EventEmitter } from 'events';
import { type SupportedAgent } from "@principal-ai/agent-monitoring";
export declare class AgentSessionEventsHttpBridge extends EventEmitter {
    private app;
    private server;
    private port;
    private maxPortRetries;
    private recentEvents;
    private maxEventsPerProvider;
    private eventProcessorV2;
    /**
     * Type-safe helper to get an event from an agent namespace
     * All agent namespaces store AgentSessionEvent, so this is always safe
     */
    private getAgentEvent;
    /**
     * Type-safe helper to set an event in an agent namespace
     */
    private setAgentEvent;
    /**
     * Type-safe helper to delete an event from an agent namespace
     */
    private deleteAgentEvent;
    constructor(startPort: number);
    private setupMiddleware;
    private setupRoutes;
    private setupEventHandlers;
    private storeEvent;
    private broadcastEvent;
    start(): Promise<void>;
    stop(): Promise<void>;
    getPort(): number;
    getProviders(): string[];
    getEventCount(provider?: string): number;
    private setupEventProcessorListeners;
    /**
     * Create a deterministic event key for deduplication
     */
    private createEventKey;
    /**
     * Process events from a hook fallback file
     */
    processFallbackFile(filePath: string, provider: SupportedAgent): Promise<{
        success: boolean;
        processedCount?: number;
        storedCount?: number;
        error?: string;
    }>;
    /**
     * Auto-process fallback files on startup
     */
    private autoProcessFallbackFiles;
}
//# sourceMappingURL=AgentSessionEventsHttpBridge.d.ts.map