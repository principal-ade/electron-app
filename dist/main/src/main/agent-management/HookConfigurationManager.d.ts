import { type SupportedAgent } from '@principal-ai/agent-monitoring';
/**
 * Result type for hook operations
 */
export interface HookOperationResult {
    success: boolean;
    hookCount: number;
    error?: string;
    configPath?: string;
}
/**
 * Hook configuration status
 */
export interface HookConfigStatus {
    hasHooks: boolean;
    hookCount: number;
    isSupported: boolean;
    supportMessage?: string;
}
/**
 * Hook Configuration Manager using @a24z/agent-manager library
 *
 * This delegates to the external library for Claude hooks,
 * while maintaining compatibility with the existing interface.
 */
export declare class HookConfigurationManager {
    private static instance;
    private claudeManager;
    private constructor();
    static getInstance(): HookConfigurationManager;
    /**
     * Add hooks to an agent's configuration
     */
    addHooks(agentType: SupportedAgent): Promise<HookOperationResult>;
    /**
     * Remove hooks from an agent's configuration
     */
    removeHooks(agentType: SupportedAgent): Promise<HookOperationResult>;
    /**
     * Get the status of hooks for an agent
     */
    getHookStatus(agentType: SupportedAgent): Promise<HookConfigStatus>;
    /**
     * Check if an agent has a specific hook type configured
     */
    hasHook(agentType: SupportedAgent, hookType: string): Promise<boolean>;
    /**
     * Count the number of hooks configured for an agent
     */
    countHooks(agentType: SupportedAgent): Promise<number>;
    /**
     * Check if an agent is supported for hook configuration
     */
    private checkAgentSupport;
    /**
     * Get the configuration path for an agent
     */
    getConfigPath(agentType: SupportedAgent): string;
    /**
     * Get the directory where hook fallback files are stored
     */
    getHookFallbackDirectory(): string;
    /**
     * Read unprocessed events from fallback files
     */
    readFallbackEvents(agentType?: SupportedAgent): Promise<{
        success: boolean;
        events?: Array<{
            agent: SupportedAgent;
            filePath: string;
            events: any[];
        }>;
        error?: string;
    }>;
    /**
     * Clear processed events from a fallback file (by backing it up and creating a new empty one)
     */
    clearFallbackFile(filePath: string): Promise<{
        success: boolean;
        backupPath?: string;
        error?: string;
    }>;
    /**
     * Get statistics about fallback files
     */
    getFallbackStats(): Promise<{
        success: boolean;
        stats?: {
            directory: string;
            exists: boolean;
            agents: Array<{
                agent: SupportedAgent;
                hasFile: boolean;
                eventCount: number;
                fileSize?: number;
            }>;
        };
        error?: string;
    }>;
}
//# sourceMappingURL=HookConfigurationManager.d.ts.map